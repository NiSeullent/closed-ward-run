import { raceOutcome } from './race';
import { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  DEFAULT_PROJECT,
  parsePeer,
  type Score,
  type Peer,
  type Room,
} from './cloud';
import type { GameAPI, GameSnapshot } from './runner';
export function CloudPanel({
  state,
  game,
}: {
  state: GameSnapshot;
  game: React.RefObject<GameAPI | null>;
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
  latest.current = state;
  const sandbox =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('zwf-session');
  async function refresh(c: Cloud, more = false) {
    const data = await c.scores(more ? (nextOffset ?? 0) : 0);
    setRows((old) => (more ? [...old, ...data.rows] : data.rows));
    setNextOffset(data.nextOffset);
  }
  async function connect() {
    setBusy(true);
    try {
      if (!sandbox && (!content.trim() || !token.trim()))
        throw new Error('JUMP 게임 ID와 세션 토큰을 입력하세요.');
      const c = new Cloud(content, token.trim());
      const ctx = await c.context();
      identity.current = ctx.player;
      await refresh(c);
      const save = await c.load();
      setCloud(c);
      setToken('');
      setStatus(
        `${ctx.player.name} · Cloud 연결됨${save.data?.best ? ` · 최고 ${save.data.best}m` : ''}`,
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join(host: boolean) {
    if (!cloud) return;
    setBusy(true);
    try {
      if (room) await cloud.call('room-leave', { roomId: room.roomId });
      const r = await cloud.call<Room>(
        host ? 'room-create' : 'room-join',
        host ? { capacity: 2 } : { roomId: code.trim() },
      );
      seq.current =
        r.members?.find((m) => m.id === identity.current.id)?.seq ?? 0;
      started.current = false;
      round.current = null;
      setRoom(r);
      setCode(r.roomId);
      setRoomStatus('방장이 시작하면 3초 후 함께 출발합니다.');
    } catch (e) {
      setRoom(null);
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!cloud || !room) return;
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
            round: round.current,
          },
        });
        if (cancelled) return;
        const other = r.members.find(
          (m) =>
            m.id !== identity.current.id && r.serverTime - m.seenAt < 10000,
        );
        const remote = parsePeer(other?.state);
        const p = remote && remote.round === round.current ? remote : null;
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
            game.current?.start(r.seed);
          }
        }
        setRoomStatus(
          p ? '상대 연결됨 · 2인 레이스' : '상대 대기 중 / 연결 끊김',
        );
      } catch (e) {
        if (!cancelled) {
          setPeer(null);
          game.current?.setRival(null);
          setRoomStatus((e as Error).message);
        }
      } finally {
        if (!cancelled) timer = setTimeout(poll, 500);
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
    if (!cloud || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const s = latest.current;
      await cloud.submit({
        ...identity.current,
        distance: Math.floor(s.distance),
        stage: s.stage,
      });
      await cloud.save({
        best: Math.floor(s.best),
        stage: s.stage,
        cleared: s.cleared,
        version: 2,
      });
      await refresh(cloud);
      setStatus('클라우드 기록 저장 완료');
    } catch (e) {
      saved.current = false;
      setStatus(`저장 실패 · 재시도 가능: ${(e as Error).message}`);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (state.phase === 'running') saved.current = false;
    if (state.phase === 'over' && cloud && !saved.current) {
      saved.current = true;
      void saveResult();
    }
  }, [state.phase, cloud]);
  const outcome = started.current ? raceOutcome(state, peer) : null;
  return (
    <section className="cloud-panel" aria-label="ZUKU Cloud">
      <div>
        <strong>
          <img src="./brand/zuku-jump.png" alt="" width="24" height="24" /> ZUKU{' '}
          <span>JUMP</span> / CLOUD
        </strong>
        <p role="status">{status}</p>
        {room && (
          <p className="room-status" role="status">
            {roomStatus}
          </p>
        )}
      </div>
      {!cloud ? (
        <>
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
          <button disabled={busy} onClick={() => void connect()}>
            {sandbox ? 'ZUKU 계정으로 연결' : 'Cloud 연결'}
          </button>
        </>
      ) : (
        <>
          <button disabled={busy} onClick={() => void join(true)}>
            2인 방 만들기
          </button>
          <label>
            초대 코드
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button disabled={busy} onClick={() => void join(false)}>
            참가
          </button>
          {room && (
            <>
              <output>초대 코드 {room.roomId}</output>
              {room.hostId === identity.current.id && (
                <button
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
            </>
          )}
          {countdown && <strong>{countdown}</strong>}
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
          <button
            disabled={busy || state.phase !== 'over'}
            onClick={() => void saveResult()}
          >
            기록 저장 / 재시도
          </button>
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
          <button
            disabled={!!room}
            onClick={() => {
              setCloud(null);
              setRows([]);
              setStatus('연결 해제됨');
            }}
          >
            연결 해제
          </button>
        </>
      )}
      <details>
        <summary>클라우드 랭킹 · 캐주얼</summary>
        <p>플레이어 제출 기록 · 보상 없는 친선 랭킹</p>
        {rows.length ? (
          <ol>
            {rows.map((r) => (
              <li key={r.id}>
                {r.name} · {r.distance.toLocaleString()}m · STAGE {r.stage}
              </li>
            ))}
          </ol>
        ) : (
          <p>{cloud ? '등록된 기록 없음' : 'Cloud 연결 후 표시됩니다.'}</p>
        )}
        {cloud && nextOffset !== null && (
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
      </details>
    </section>
  );
}
