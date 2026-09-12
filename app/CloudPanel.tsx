import { GameDialog } from './GameDialog';
import { raceOutcome } from './race';
import { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  DEFAULT_PROJECT,
  parsePeer,
  watchGameCloudAuth,
  type Score,
  type Peer,
  type Room,
} from './cloud';
import type { GameAPI, GameSnapshot } from './runner';
export function CloudPanel({
  state,
  game,
  panel,
  onClose,
  onRaceStart,
}: {
  state: GameSnapshot;
  game: React.RefObject<GameAPI | null>;
  panel: 'ranking' | 'multiplayer' | null;
  onClose: () => void;
  onRaceStart: () => void;
}) {
  const [content, setContent] = useState(DEFAULT_PROJECT),
    [token, setToken] = useState(''),
    [cloud, setCloud] = useState<Cloud | null>(null),
    [status, setStatus] = useState('ZUKU Cloud 연결 전'),
    [roomStatus, setRoomStatus] = useState(''),
    [rows, setRows] = useState<Score[]>([]),
    [nextOffset, setNextOffset] = useState<number | null>(null),
    [code, setCode] = useState(''),
    [room, setRoom] = useState<{ roomId: string; hostId: string } | null>(null),
    [peer, setPeer] = useState<Peer | null>(null),
    [busy, setBusy] = useState(false),
    [countdown, setCountdown] = useState('');
  const identity = useRef({ id: '', name: '' }),
    latest = useRef(state),
    saved = useRef(false),
    seq = useRef(0),
    started = useRef(false),
    round = useRef<number | null>(null),
    saving = useRef(false);
  const onRaceStartRef = useRef(onRaceStart);
  const connectionEpoch = useRef(0),
    connecting = useRef(false);
  const previousPhase = useRef(state.phase);
  const runAccountInvalid = useRef(false);
  onRaceStartRef.current = onRaceStart;
  latest.current = state;
  const sandbox =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('zwf-session');
  async function refresh(c: Cloud, more = false) {
    const epoch = connectionEpoch.current;
    const data = await c.scores(
      more ? (nextOffset ?? 0) : 0,
      latest.current.mode,
    );
    if (epoch !== connectionEpoch.current) return;
    setRows((old) => (more ? [...old, ...data.rows] : data.rows));
    setNextOffset(data.nextOffset);
  }
  async function connect(interactive = true) {
    if (connecting.current) return;
    connecting.current = true;
    const epoch = connectionEpoch.current;
    setBusy(true);
    setStatus('ZUKU 계정 연결 확인 중…');
    try {
      if (!sandbox && (!content.trim() || !token.trim()))
        throw new Error('JUMP 게임 ID와 세션 토큰을 입력하세요.');
      const c = new Cloud(content, token.trim());
      const ctx = await c.context(interactive);
      if (epoch !== connectionEpoch.current) return;
      await refresh(c);
      const save = await c.load(latest.current.mode);
      if (epoch !== connectionEpoch.current) return;
      identity.current = ctx.player;
      setCloud(c);
      setToken('');
      setStatus(
        `${ctx.player.name} · Cloud 연결됨${save.data?.best ? ` · 최고 ${save.data.best}m` : ''}`,
      );
    } catch (e) {
      if (epoch === connectionEpoch.current) setStatus((e as Error).message);
    } finally {
      if (epoch === connectionEpoch.current) {
        connecting.current = false;
        setBusy(false);
      }
    }
  }
  function clearConnection() {
    connectionEpoch.current++;
    connecting.current = false;
    saving.current = false;
    saved.current = true; // A previous account's run must not be saved as the next account.
    runAccountInvalid.current = true;
    identity.current = { id: '', name: '' };
    setCloud(null);
    setRoom(null);
    setPeer(null);
    setRows([]);
    setNextOffset(null);
    setCode('');
    setRoomStatus('');
    setCountdown('');
    setBusy(false);
    started.current = false;
    round.current = null;
    game.current?.setRival(null);
  }
  useEffect(() => {
    if (!sandbox) return;
    void connect();
    const unsubscribe = watchGameCloudAuth(() => {
      clearConnection();
      void connect(false);
    });
    return () => {
      unsubscribe();
      connectionEpoch.current++;
      connecting.current = false;
    };
  }, [sandbox]);
  async function join(host: boolean) {
    if (!cloud) return;
    const epoch = connectionEpoch.current;
    setBusy(true);
    try {
      if (room) await cloud.call('room-leave', { roomId: room.roomId });
      const r = await cloud.call<Room>(
        host ? 'room-create' : 'room-join',
        host ? { capacity: 2 } : { roomId: code.trim() },
      );
      if (epoch !== connectionEpoch.current) return;
      seq.current =
        r.members?.find((m) => m.id === identity.current.id)?.seq ?? 0;
      started.current = false;
      round.current = null;
      setRoom(r);
      setCode(r.roomId);
      setRoomStatus('방장이 시작하면 3초 후 함께 출발합니다.');
    } catch (e) {
      if (epoch !== connectionEpoch.current) return;
      setRoom(null);
      setStatus((e as Error).message);
    } finally {
      if (epoch === connectionEpoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!cloud || !room) return;
    const epoch = connectionEpoch.current;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const s = latest.current;
        const r = await cloud.call<Room>('room-sync', {
          roomId: room.roomId,
          seq: ++seq.current,
          state: {
            lane: s.lane,
            distance: s.distance,
            phase: s.phase,
            updated: Date.now(),
            elapsed: s.elapsed,
            cleared: s.cleared,
            mode: s.mode,
            round: round.current,
          },
        });
        if (cancelled || epoch !== connectionEpoch.current) return;
        const other = r.members.find(
          (m) =>
            m.id !== identity.current.id && r.serverTime - m.seenAt < 10000,
        );
        const remote = parsePeer(other?.state);
        const p =
          remote &&
          remote.round === round.current &&
          (remote.mode ?? 'story') === s.mode
            ? remote
            : null;
        setPeer(p);
        game.current?.setRival(p);
        if (r.startsAt && !started.current) {
          const remaining = r.startsAt - r.serverTime;
          setCountdown(
            remaining > 0 ? `${Math.ceil(remaining / 1000)}초 후 출발` : '',
          );
          if (remaining <= 0) {
            started.current = true;
            round.current = r.startsAt;
            onRaceStartRef.current();
            game.current?.start(r.seed);
          }
        }
        setRoomStatus(
          p ? '상대 연결됨 · 2인 레이스' : '상대 대기 중 / 연결 끊김',
        );
      } catch (e) {
        if (!cancelled && epoch === connectionEpoch.current) {
          setPeer(null);
          game.current?.setRival(null);
          setRoomStatus((e as Error).message);
        }
      } finally {
        if (!cancelled && epoch === connectionEpoch.current)
          timer = setTimeout(poll, 500);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      game.current?.setRival(null);
    };
  }, [cloud, room, game]);
  async function leave() {
    if (!cloud || !room) return;
    const leaving = room.roomId;
    setRoom(null);
    setRoomStatus('');
    setPeer(null);
    setCountdown('');
    game.current?.setRival(null);
    setBusy(true);
    try {
      await cloud.call('room-leave', { roomId: leaving });
      setStatus('방에서 나왔습니다.');
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveResult() {
    if (!cloud || saving.current || runAccountInvalid.current) return;
    const epoch = connectionEpoch.current;
    saving.current = true;
    setBusy(true);
    try {
      const s = latest.current;
      await cloud.submit(
        {
          ...identity.current,
          distance: Math.floor(s.distance),
          stage: s.stage,
        },
        s.mode,
      );
      if (epoch !== connectionEpoch.current) return;
      const previousSave = await cloud.load(s.mode);
      if (epoch !== connectionEpoch.current) return;
      const previousBest = Number(previousSave.data?.best);
      await cloud.save(
        {
          best: Math.floor(Math.max(s.best, Number.isFinite(previousBest) ? previousBest : 0)),
          stage: s.stage,
          cleared: s.cleared,
          version: 4,
        },
        s.mode,
      );
      if (epoch !== connectionEpoch.current) return;
      await refresh(cloud);
      if (epoch !== connectionEpoch.current) return;
      setStatus('클라우드 기록 저장 완료');
    } catch (e) {
      if (epoch !== connectionEpoch.current) return;
      saved.current = false;
      setStatus(`저장 실패 · 재시도 가능: ${(e as Error).message}`);
    } finally {
      if (epoch === connectionEpoch.current) {
        saving.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    if (
      state.phase === 'running' &&
      !['running', 'paused'].includes(previousPhase.current)
    ) {
      saved.current = false;
      runAccountInvalid.current = false;
    }
    previousPhase.current = state.phase;
    if (state.phase === 'over' && cloud && !saved.current) {
      saved.current = true;
      void saveResult();
    }
  }, [state.phase, cloud]);
  useEffect(() => {
    if (cloud) void refresh(cloud).catch((e) => setStatus(e.message));
  }, [state.mode]);
  const outcome = started.current ? raceOutcome(state, peer) : null;
  return (
    <>
      {!panel && (countdown || outcome) && (
        <div className="race-notice" role="status">
          {countdown ||
            '레이스 결과 · ' +
              (outcome === 'win'
                ? '승리!'
                : outcome === 'lose'
                  ? '아쉽게 패배'
                  : '무승부')}
        </div>
      )}
      <GameDialog
        open={panel !== null}
        title={panel === 'multiplayer' ? '멀티플레이' : '클라우드 랭킹'}
        onClose={onClose}
      >
        <section className="cloud-panel" aria-label="ZUKU Cloud">
          <p className="cloud-status" role="status">
            {status}
          </p>
          {!cloud ? (
            <div className="cloud-connect">
              {!sandbox && (
                <>
                  <label>
                    JUMP 게임 ID
                    <input
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="등록된 JUMP 콘텐츠 ID"
                    />
                  </label>
                  <label>
                    ZUKU 세션 토큰
                    <input
                      type="password"
                      autoComplete="off"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="현재 탭에서만 사용"
                    />
                  </label>
                </>
              )}
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void connect()}
              >
                {sandbox ? 'ZUKU 계정으로 연결' : 'Cloud 연결'}
              </button>
              <p className="subtle">
                {panel === 'ranking'
                  ? '계정을 연결하면 클라우드 기록을 불러오고 도주 결과를 저장합니다.'
                  : '계정을 연결하고 친구와 함께 출발하세요.'}
              </p>
            </div>
          ) : (
            <>
              {panel === 'multiplayer' && (
                <>
                  <div className="dialog-actions">
                    <button disabled={busy} onClick={() => void join(true)}>
                      2인 방 만들기
                    </button>
                    <label>
                      초대 코드
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    </label>
                    <button
                      disabled={busy || !code.trim()}
                      onClick={() => void join(false)}
                    >
                      참가
                    </button>
                  </div>
                  {room && (
                    <>
                      <output>초대 코드 {room.roomId}</output>
                      <p className="room-status" role="status">
                        {roomStatus}
                      </p>
                      <div className="dialog-actions">
                        {room.hostId === identity.current.id && (
                          <button
                            className="primary-button"
                            disabled={busy || started.current}
                            onClick={() => {
                              setBusy(true);
                              void cloud
                                .call('room-start', { roomId: room.roomId })
                                .catch((e) => setStatus(e.message))
                                .finally(() => setBusy(false));
                            }}
                          >
                            함께 출발
                          </button>
                        )}
                        <button disabled={busy} onClick={() => void leave()}>
                          방 나가기
                        </button>
                      </div>
                    </>
                  )}
                  {countdown && <strong role="status">{countdown}</strong>}
                  {outcome && (
                    <strong role="status">
                      레이스 결과 ·{' '}
                      {outcome === 'win'
                        ? '승리!'
                        : outcome === 'lose'
                          ? '아쉽게 패배'
                          : '무승부'}
                    </strong>
                  )}
                  {started.current &&
                    state.phase === 'over' &&
                    peer &&
                    peer.phase !== 'over' && (
                      <p>내 도주 종료 · 상대의 도주 종료를 기다립니다.</p>
                    )}
                  {peer && (
                    <p>
                      상대 {Math.floor(peer.distance)}m ·{' '}
                      {Math.floor(state.distance - peer.distance)}m 차이 ·{' '}
                      {peer.phase === 'running' ? '달리는 중' : '대기 / 종료'}
                    </p>
                  )}
                </>
              )}
              {panel === 'ranking' && (
                <>
                  <div className="ranking-heading">
                    <span>최고 도주 거리</span>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void refresh(cloud)
                          .catch((e) => setStatus(e.message))
                          .finally(() => setBusy(false));
                      }}
                    >
                      랭킹 새로고침
                    </button>
                  </div>
                  {rows.length ? (
                    <ol className="ranking-list">
                      {rows.map((r, index) => (
                        <li key={r.id}>
                          <span className="rank-number">{index + 1}</span>
                          <span className="rank-player">
                            {r.name}
                            <small>STAGE {r.stage}</small>
                          </span>
                          <strong>
                            {r.distance.toLocaleString()}
                            <small> m</small>
                          </strong>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="empty-ranking">등록된 기록 없음</p>
                  )}
                  {nextOffset !== null && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void refresh(cloud, true)
                          .catch((e) => setStatus(e.message))
                          .finally(() => setBusy(false));
                      }}
                    >
                      다음 50명
                    </button>
                  )}
                  <button
                    disabled={
                      busy ||
                      state.phase !== 'over' ||
                      runAccountInvalid.current
                    }
                    onClick={() => void saveResult()}
                  >
                    기록 저장 / 재시도
                  </button>
                  <p className="subtle">
                    플레이어 제출 기록 · 보상 없는 친선 랭킹
                  </p>
                </>
              )}
              <button
                className="text-button"
                disabled={busy || !!room}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await cloud.call('consent-revoke');
                    clearConnection();
                    setStatus(
                      '자동 연결을 해제했습니다. 다시 연결할 때 동의가 필요합니다.',
                    );
                  } catch (e) {
                    setStatus((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                자동 연결 해제
              </button>
            </>
          )}
        </section>
      </GameDialog>
    </>
  );
}
