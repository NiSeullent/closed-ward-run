'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Heart,
  Maximize,
  Trophy,
  Users,
  Menu,
  Radar,
  HelpCircle,
  Zap,
  Package,
} from 'lucide-react';
import { createGame, type GameAPI, type GameSnapshot } from './runner';
import { CloudPanel } from './CloudPanel';
import { GameDialog } from './GameDialog';
import { isGameRuntime } from './runtime';
import { ITEM_LABELS } from './stages';
import { registerGameTools } from './webmcp';
const initial: GameSnapshot = {
  stage: 1,
  progress: 0,
  boost: 100,
  boosting: false,
  item: null,
  police: 0,
  route: 'left',
  cleared: false,
  phase: 'ready',
  hits: 0,
  speed: 22,
  distance: 0,
  best: 0,
  elapsed: 0,
  flash: '',
  ambulance: 35,
  lane: 0,
  jumping: false,
  jumpHeight: 0,
  martialLaw: false,
  helicopter: false,
  taser: false,
  zone: '불야성 도심',
  curve: false,
  mapItems: [],
};
const clockLabel = (seconds: number) =>
  Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0') +
  ':' +
  Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
const mapTop = (z: number) =>
  Math.max(10, Math.min(88, 12 + ((z + 70) / 85) * 76)) + '%';
const mapLeft = (lane: number) => 50 + lane * 25 + '%';
type Panel = 'ranking' | 'multiplayer' | 'menu' | 'help' | null;
export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLElement>(null);
  const game = useRef<GameAPI | null>(null);
  const resumeAfterPanel = useRef(false);
  const [state, setState] = useState(initial);
  const [muted, setMuted] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [radar, setRadar] = useState(false);
  const [error, setError] = useState('');
  const [runtime] = useState(isGameRuntime);
  useEffect(() => {
    if (!mount.current) return;
    let unregister = () => {};
    try {
      game.current = createGame(mount.current, setState);
      unregister = registerGameTools(game.current);
    } catch {
      setError(
        '3D 화면을 열 수 없습니다. 브라우저의 하드웨어 가속을 켜고 새로고침해 주세요.',
      );
    }
    return () => {
      unregister();
      game.current?.dispose();
    };
  }, []);
  const openPanel = (next: Panel) => {
    if (!panel) {
      resumeAfterPanel.current = game.current?.getState().phase === 'running';
      if (resumeAfterPanel.current) game.current?.pause();
    }
    setPanel(next);
  };
  const closePanel = (resume = true) => {
    setPanel(null);
    if (
      resume &&
      resumeAfterPanel.current &&
      game.current?.getState().phase === 'paused'
    )
      game.current.pause();
    resumeAfterPanel.current = false;
  };
  const start = () => {
    closePanel(false);
    game.current?.start();
  };
  const toggleSound = () => {
    setMuted(!muted);
    game.current?.mute(!muted);
  };
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen?.().catch(() => {});
    closePanel();
  };
  const active = state.phase === 'running' || state.phase === 'paused';
  const warning = state.martialLaw
    ? '헬기 접근 · 차선 변경으로 회피'
    : state.taser
      ? '테이저 조준 · 점프로 회피'
      : state.curve
        ? '급커브 · 표지판을 확인하세요'
        : '';
  return (
    <main className={'arcade' + (runtime ? ' arcade--runtime' : '')}>
      {!runtime && (
        <header className="topbar">
          <a href="./" className="brand" aria-label="폐쇄런 홈">
            <span className="brand-mark">閉</span>
            <span>
              폐쇄런<small>CLOSED RUN</small>
            </span>
          </a>
          <div className="edition">
            <span className="live-dot" /> ZUKU JUMP / 100 STAGES
          </div>
          <div className="top-actions">
            <button onClick={() => openPanel('help')}>
              플레이 가이드 <ArrowUpRight size={15} />
            </button>
            <span className="version">v.2.1.0</span>
          </div>
        </header>
      )}
      <section
        ref={frame}
        className={'game-frame phase-' + state.phase}
        aria-label="폐쇄런 3D 게임"
      >
        <div ref={mount} className="world" />
        <div className="vignette" />
        <div className="scanlines" />
        <header className="hud">
          {state.phase === 'ready' ? (
            <span className="ready-label">100 STAGES / NIGHT RUN</span>
          ) : (
            <div className="run-summary">
              <div className="stage-panel">
                <strong>
                  STAGE {state.stage}
                  <span> / 100 · {state.zone}</span>
                </strong>
                <progress
                  aria-label="스테이지 진행"
                  value={state.progress}
                  max={1}
                />
              </div>
              <div className="distance">
                <strong>
                  {Math.floor(state.distance).toLocaleString()}
                  <small> m</small>
                </strong>
                <time>{clockLabel(state.elapsed)}</time>
                <span className="speed-value">
                  {Math.round(state.speed * 1.8)} km/h
                </span>
              </div>
            </div>
          )}
          <nav className="run-controls" aria-label="게임 메뉴">
            <button
              className="hud-button"
              aria-label="랭킹 열기"
              title="랭킹"
              onClick={() => openPanel('ranking')}
            >
              <Trophy size={18} />
              <span>랭킹</span>
            </button>
            <button
              className="hud-button"
              aria-label="멀티플레이 열기"
              title="멀티플레이"
              onClick={() => openPanel('multiplayer')}
            >
              <Users size={18} />
              <span>멀티</span>
            </button>
            {active && (
              <button
                className="icon-button"
                aria-label={
                  state.phase === 'paused' ? '계속 달리기' : '일시 정지'
                }
                onClick={() => game.current?.pause()}
              >
                {state.phase === 'paused' ? (
                  <Play size={18} />
                ) : (
                  <Pause size={18} />
                )}
              </button>
            )}
            <button
              className="icon-button"
              aria-label="게임 설정 열기"
              title="설정 · 전체 화면"
              onClick={() => openPanel('menu')}
            >
              <Menu size={20} />
            </button>
          </nav>
        </header>
        {state.phase === 'ready' && (
          <div className="start-screen">
            <div className="start-copy">
              <div className="eyebrow">오늘도 무사히, 퇴원은 셀프.</div>
              <h1>
                폐쇄<span>런</span>
                <i>逃走中</i>
              </h1>
              <p className="intro">
                멈추면 입원이다.
                <br />
                일단 뛰어. 뒤는 돌아보지 말고.
              </p>
              <button
                className="start-button"
                onClick={start}
                disabled={!!error}
              >
                도망 시작 <ArrowRight size={22} />
              </button>
              <div className="start-key">
                <kbd>ENTER</kbd> 눌러서 시작
              </div>
            </div>
          </div>
        )}
        {active && (
          <>
            <div
              className="vitals"
              aria-label={'남은 충돌 기회 ' + (4 - state.hits) + '회'}
            >
              <div className="lives">
                {[1, 2, 3, 4].map((i) => (
                  <Heart
                    key={i}
                    className={i <= 4 - state.hits ? 'alive' : ''}
                    size={15}
                  />
                ))}
              </div>
              <span>경찰 {state.police}</span>
            </div>
            <div className="action-dock">
              <div className="touch-controls" aria-label="이동 조작">
                <button
                  aria-label="왼쪽 차선"
                  onClick={() => game.current?.move(-1)}
                >
                  <ArrowLeft size={20} />
                  <kbd>←</kbd>
                </button>
                <button aria-label="점프" onClick={() => game.current?.jump()}>
                  <ArrowUp size={20} />
                  <kbd>SPACE</kbd>
                </button>
                <button
                  aria-label="오른쪽 차선"
                  onClick={() => game.current?.move(1)}
                >
                  <ArrowRight size={20} />
                  <kbd>→</kbd>
                </button>
              </div>
              <div className="ability-controls">
                <button
                  className="boost-button"
                  aria-label={'돌진 ' + Math.floor(state.boost) + '%'}
                  disabled={state.boost < 100 || state.phase !== 'running'}
                  onClick={() => game.current?.boost()}
                  style={
                    { '--charge': state.boost + '%' } as React.CSSProperties
                  }
                >
                  <Zap size={18} />
                  <span>
                    돌진 <small>{Math.floor(state.boost)}%</small>
                  </span>
                  <kbd>SHIFT</kbd>
                </button>
                <button
                  aria-label={
                    state.item
                      ? ITEM_LABELS[state.item] + ' 사용'
                      : '아이템 없음'
                  }
                  disabled={!state.item || state.phase !== 'running'}
                  onClick={() => game.current?.useItem()}
                >
                  <Package size={18} />
                  <span>
                    {state.item ? ITEM_LABELS[state.item] : '아이템'}
                    <small>{state.item ? '사용 가능' : '없음'}</small>
                  </span>
                  <kbd>E</kbd>
                </button>
              </div>
            </div>
            {warning && (
              <div className="warning-notice" role="status">
                {warning}
              </div>
            )}
          </>
        )}
        {radar && active && (
          <div className="radar-map" aria-label="전방 2D 지도">
            <div className="radar-title">전방 감시</div>
            <div className="radar-road">
              <b
                className="radar-player"
                style={{
                  left: mapLeft(state.lane),
                  bottom: state.jumping ? '20px' : '8px',
                }}
              >
                {state.jumping ? '↑' : '●'}
              </b>
              {state.mapItems.map((item, index) => (
                <b
                  key={item.kind + index}
                  className={'radar-item radar-' + item.kind}
                  style={{ left: mapLeft(item.lane), top: mapTop(item.z) }}
                >
                  {item.kind === 'car'
                    ? '◆'
                    : item.kind === 'taser'
                      ? 'ϟ'
                      : item.kind === 'helicopter'
                        ? '✦'
                        : '♟'}
                </b>
              ))}
            </div>
          </div>
        )}
        {state.flash && state.phase === 'running' && (
          <div className="hit-message" role="status">
            {state.flash}
          </div>
        )}
        {state.phase === 'capture' && (
          <div className="capture-caption">
            {state.captureReason === 'helicopter'
              ? '공군 헬기 입원. 퇴원 취소.'
              : '퇴원 취소. 침대 확보.'}
          </div>
        )}
        {state.phase === 'over' && (
          <div className="modal-scrim gameover">
            <div className="end-card">
              <span className="eyebrow">
                {state.cleared ? '100 STAGES CLEAR' : '도주 종료'}
              </span>
              <h2>{state.cleared ? '완전 탈출!' : '지금 바로 입원!'}</h2>
              <div className="end-stats">
                <div>
                  <span>최종 도주 거리</span>
                  <strong>
                    {Math.floor(state.distance).toLocaleString()}
                    <small> m</small>
                  </strong>
                </div>
                <div>
                  <span>수배 기록</span>
                  <strong>
                    {state.hits ? '★'.repeat(state.hits) : '수배 없음'}
                  </strong>
                </div>
              </div>
              <button className="start-button" onClick={start}>
                다시 탈출하기 <RotateCcw size={20} />
              </button>
              <button
                className="text-button"
                onClick={() => openPanel('ranking')}
              >
                <Trophy size={16} /> 랭킹 보기
              </button>
            </div>
          </div>
        )}
        <GameDialog
          open={state.phase === 'paused' && !panel}
          title="잠깐 숨 고르기"
          onClose={() => game.current?.pause()}
        >
          <p>준비되면 다시 달려요.</p>
          <button
            className="start-button"
            onClick={() => game.current?.pause()}
          >
            계속 뛰기 <Play size={20} />
          </button>
          <div className="dialog-actions">
            <button onClick={() => openPanel('ranking')}>
              <Trophy size={16} /> 랭킹
            </button>
            <button onClick={() => openPanel('menu')}>
              <Menu size={16} /> 설정
            </button>
            <button onClick={start}>
              <RotateCcw size={16} /> 다시 시작
            </button>
          </div>
        </GameDialog>
        <GameDialog
          open={panel === 'menu'}
          title="게임 설정"
          onClose={() => closePanel()}
        >
          <div className="settings-grid">
            <button onClick={toggleSound}>
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              {muted ? '소리 켜기' : '소리 끄기'}
            </button>
            <button aria-pressed={radar} onClick={() => setRadar(!radar)}>
              <Radar size={20} />
              전방 지도 {radar ? '켜짐' : '꺼짐'}
            </button>
            <button onClick={fullscreen}>
              <Maximize size={20} />
              전체 화면
            </button>
            <button onClick={() => openPanel('help')}>
              <HelpCircle size={20} />
              플레이 가이드
            </button>
          </div>
          <p className="subtle">
            방향키로 이동 · SPACE 점프 · SHIFT 돌진 · E 아이템
          </p>
        </GameDialog>
        <GameDialog
          open={panel === 'help'}
          title="플레이 가이드"
          onClose={() => closePanel()}
        >
          <p>
            차를 피하며 100개 스테이지를 통과하세요. 네 번째 충돌에는 도주가
            끝납니다.
          </p>
          <ul className="help-list">
            <li>
              <b>이동 · 점프</b>
              <span>
                ← → / A D로 차선 이동, SPACE / ↑로 점프. 화면 아래 버튼이나
                화면을 밀어서도 조작할 수 있어요.
              </span>
            </li>
            <li>
              <b>돌진 · 아이템</b>
              <span>
                SHIFT로 다음 구간까지 돌진. E로 가진 아이템을 사용하세요.
              </span>
            </li>
            <li>
              <b>분기 · 도로</b>
              <span>
                360m마다 다음 스테이지. 중앙 분기는 추돌 후 왼쪽 진입, 자동차
                전용도로는 경찰 2배.
              </span>
            </li>
            <li>
              <b>추격 · 폭발</b>
              <span>
                차량 폭발 반경 6m 주의. 테이저는 점프로, 헬기는 차선을 바꿔
                피하세요.
              </span>
            </li>
          </ul>
          <button
            className="start-button"
            onClick={() =>
              state.phase === 'ready' || state.phase === 'over'
                ? start()
                : closePanel()
            }
          >
            알았어, 뛸게 <ArrowRight size={20} />
          </button>
        </GameDialog>
        <CloudPanel
          state={state}
          game={game}
          panel={panel === 'ranking' || panel === 'multiplayer' ? panel : null}
          onClose={() => closePanel()}
          onRaceStart={() => closePanel(false)}
        />
        {error && (
          <div className="engine-error" role="alert">
            {error}
          </div>
        )}
      </section>
      {!runtime && (
        <footer className="below-game">
          <div className="key-guide">
            <kbd>←</kbd>
            <kbd>→</kbd>
            <span>이동</span>
            <kbd>SPACE</kbd>
            <span>점프</span>
            <kbd>SHIFT</kbd>
            <span>돌진</span>
          </div>
          <span>차는 피하고. 입원은 다음에.</span>
        </footer>
      )}
    </main>
  );
}
