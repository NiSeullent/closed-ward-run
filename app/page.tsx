'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Volume2, VolumeX, Pause, Play, RotateCcw, Heart, Siren, Maximize, X } from 'lucide-react';
import { createGame, type GameAPI, type GameSnapshot } from './runner';
import { registerGameTools } from './webmcp';
const initial: GameSnapshot = { phase:'ready', hits:0, speed:22, distance:0, best:0, flash:'', ambulance:35 };
export default function Home() {
  const mount=useRef<HTMLDivElement>(null), game=useRef<GameAPI|null>(null);
  const [state,setState]=useState(initial), [muted,setMuted]=useState(false), [help,setHelp]=useState(false), [error,setError]=useState('');
  useEffect(()=>{if(!mount.current)return;let unregister=()=>{};try{game.current=createGame(mount.current,setState);unregister=registerGameTools(game.current);}catch{setError('3D 화면을 열 수 없습니다. 브라우저의 하드웨어 가속을 켜고 새로고침해 주세요.');}return()=>{unregister();game.current?.dispose();};},[]);
  const start=()=>{setHelp(false);game.current?.start();};
  const active=state.phase==='running'||state.phase==='paused';
  return <main className="arcade">
    <header className="topbar"><a href="./" className="brand" aria-label="폐쇄런 홈"><span className="brand-mark">閉</span><span>폐쇄런<small>CLOSED RUN</small></span></a><div className="edition"><span className="live-dot"/> ENDLESS NIGHT / VOL. 01</div><div className="top-actions"><button onClick={()=>{if(state.phase==='running')game.current?.pause();setHelp(true);}}>플레이 가이드 <ArrowUpRight size={15}/></button><span className="version">v.1.0</span></div></header>
    <section className={'game-frame phase-'+state.phase} aria-label="폐쇄런 3D 게임">
      <div ref={mount} className="world"/><div className="vignette"/><div className="scanlines"/>
      <div className="scene-label"><span className="live-dot"/> LIVE FROM 도망시 <span>02:17 AM</span></div>
      {state.phase==='ready'&&<div className="start-screen"><div className="start-copy"><div className="eyebrow">오늘도 무사히, 퇴원은 셀프.</div><h1>폐쇄<span>런</span><i>逃走中</i></h1><p className="intro">멈추면 입원이다.<br/>일단 뛰어. 뒤는 돌아보지 말고.</p><button className="start-button" onClick={start} disabled={!!error}>도망 시작 <ArrowRight size={24}/></button><div className="start-key"><kbd>ENTER</kbd> 눌러서 시작</div><div className="character-credit"><span>PLAYER 01</span><strong>멘헤라짱</strong><span className="pink">멘탈은 약해도 다리는 강하다.</span></div></div><div className="scene-sticker"><span>주의!</span><strong>뒤에 구급차 있음</strong><Siren size={23}/></div></div>}
      {state.phase!=='ready'&&<div className="hud"><div className="distance"><span>도주 거리</span><strong>{Math.floor(state.distance).toLocaleString()}<small> m</small></strong><em>BEST {Math.floor(state.best).toLocaleString()} m</em></div><div className="wanted"><span>수배 레벨</span><div aria-label={`수배 별 ${state.hits}개`}>{[1,2,3,4].map(i=><b key={i} className={state.hits>=i?'on':''}>★</b>)}</div><small>짭새 {state.hits}명 추격 중</small></div><div className="run-controls"><button aria-label={muted?'소리 켜기':'소리 끄기'} onClick={()=>{setMuted(!muted);game.current?.mute(!muted);}}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>{active&&<button aria-label={state.phase==='paused'?'계속 달리기':'일시 정지'} onClick={()=>game.current?.pause()}>{state.phase==='paused'?<Play size={20}/>:<Pause size={20}/>}</button>}</div></div>}
      {active&&<><div className="speed-panel"><span>현재 속도</span><strong>{Math.round(state.speed*1.8)}<small> km/h</small></strong><div className="speed-bars">{Array.from({length:16},(_,i)=><i key={i} className={i<state.speed/22*16?'filled':''}/>)}</div><p className={state.hits>=2?'danger':''}>{state.hits>=3?'바로 뒤에 있어. 진짜로.':state.hits>=2?'구급차 접근 중!':'아직은… 괜찮아.'}</p></div><div className="lives" aria-label={`남은 충돌 기회 ${4-state.hits}회`}>{[1,2,3,4].map(i=><Heart key={i} className={i<=4-state.hits?'alive':''} size={24}/>)}</div><div className="touch-controls"><button aria-label="왼쪽 차선" onClick={()=>game.current?.move(-1)}><ArrowLeft/></button><button aria-label="오른쪽 차선" onClick={()=>game.current?.move(1)}><ArrowRight/></button></div></>}
      {state.flash&&state.phase==='running'&&<div key={state.hits} className="hit-message" role="status">{state.flash}</div>}
      {state.phase==='capture'&&<div className="capture-caption">퇴원 취소. 침대 확보.</div>}
      {state.phase==='paused'&&!help&&<div className="modal-scrim"><div className="pause-card"><span className="eyebrow">잠깐 숨 고르기</span><h2>아직 안 잡혔다.</h2><button className="start-button" onClick={()=>game.current?.pause()}>계속 뛰기 <Play size={20}/></button><button className="text-button" onClick={start}><RotateCcw size={15}/> 처음부터 다시</button></div></div>}
      {state.phase==='over'&&<div className="modal-scrim gameover"><div className="end-card"><span className="eyebrow">도주 종료 · 강제 체크인</span><h2>지금 바로<br/>입원!</h2><p>구급차가 고객님을 모셨습니다.</p><div className="end-stats"><div><span>최종 도주 거리</span><strong>{Math.floor(state.distance)}<small> m</small></strong></div><div><span>수배 기록</span><strong className="stars-final">★★★★</strong></div></div><button className="start-button" onClick={start}>다시 탈출하기 <RotateCcw size={21}/></button></div></div>}
      {help&&<div className="modal-scrim"><div className="help-card"><button className="close" onClick={()=>setHelp(false)} aria-label="가이드 닫기"><X/></button><span className="eyebrow">생존 매뉴얼</span><h2>4번 박으면, 입원.</h2><p><kbd>←</kbd> <kbd>→</kbd> 또는 <kbd>A</kbd> <kbd>D</kbd>로 차를 피하세요.<br/>모바일에서는 좌우 버튼이나 스와이프.</p><ol><li><b>첫 번째</b><span>살았다. 대신 짭새가 따라온다.</span></li><li><b>두 번째</b><span>다리가 무거워진다. 구급차 등장.</span></li><li><b>세 번째</b><span>더 느려진다. 뒤에서 사이렌이.</span></li><li><b>네 번째</b><span>지금 바로 입원!</span></li></ol><p className="help-note">부딪힐 때마다 별 +1, 짭새 +1.<br/><kbd>ESC</kbd> 일시 정지 · 자동으로 앞으로 달립니다.</p><button className="start-button" onClick={()=>{setHelp(false);if(state.phase==='paused')game.current?.pause();else if(state.phase==='ready'||state.phase==='over')start();}}>알았어, 뛸게 <ArrowRight size={20}/></button></div></div>}
      {error&&<div className="engine-error" role="alert">{error}</div>}
      <div className="frame-footer"><span><i/> NIGHT SHIFT : 끝나지 않는 퇴근길</span><button aria-label="전체 화면" onClick={()=>{const el=document.querySelector('.game-frame');if(document.fullscreenElement)void document.exitFullscreen();else void el?.requestFullscreen?.().catch(()=>{});}}><Maximize size={16}/></button></div>
    </section>
    <footer className="below-game"><div className="key-guide"><span className="key-pair"><kbd>←</kbd><kbd>→</kbd></span><span>차선 이동</span><i/><kbd>ESC</kbd><span>잠깐 정지</span></div><p>차는 피하고. 별은 적게. 입원은 다음에.</p><span className="content-label">BGM : 정신이 건강한 의학과</span></footer>
  </main>;
}



