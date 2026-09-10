export type Phase='ready'|'running'|'paused'|'capture'|'over';
export const SPEEDS=[22,22,16,11,0] as const;
export const AMBULANCE_GAPS=[35,30,7,4.5,0] as const;
export const HIT_GRACE=1.4;
export const TASER_UNLOCK_SECONDS=90;
export const MARTIAL_LAW_SECONDS=120;
export const TASER_INTERVAL_SECONDS=13;
export const JUMP_CLEAR_HEIGHT=.82;
export function nextHit(hits:number,invulnerable:number,phase:Phase){if(phase!=='running'||invulnerable>0||hits>=4)return null;const next=Math.min(4,hits+1);return {hits:next,speed:SPEEDS[next],phase:(next===4?'capture':'running') as Phase};}
export function collides(playerX:number,carX:number,previousZ:number,z:number){return Math.abs(playerX-carX)<1.4&&Math.max(previousZ,z)>-2.3&&Math.min(previousZ,z)<1.5;}
export function clampLane(lane:number){return Math.max(-1,Math.min(1,lane));}
/** The road gets hotter the farther the player escapes. Hit penalties still matter, but never stop the ramp. */
export function speedForDistance(distance:number,hits=0){return Math.max(0,22+Math.min(20,Math.max(0,distance)*.018)-[0,0,4,8,22][Math.min(4,Math.max(0,hits))]);}
export function shouldActivateTaser(elapsed:number,hits:number){return elapsed>=TASER_UNLOCK_SECONDS&&hits>=1;}
export function shouldActivateMartialLaw(elapsed:number,hits:number){return elapsed>=MARTIAL_LAW_SECONDS&&hits>=3;}
export function jumpClearsTaser(height:number){return height>=JUMP_CLEAR_HEIGHT;}
export const ZONE_LENGTH_METERS=600;
export type ZoneSpec={name:string;banner:string;fog:string;sky:string;lampA:string;lampB:string;speedBonus:number;gapMin:number;gapMax:number;carBoost:number};
export const ZONES:ZoneSpec[]=[
 {name:'불야성 도심',banner:'불야성 도심 진입 — 네온이 너를 판다',fog:'#291934',sky:'#20152f',lampA:'#ff4aa6',lampB:'#46ccff',speedBonus:0,gapMin:17,gapMax:32,carBoost:0},
 {name:'주택가 골목',banner:'주택가 진입 — 조용히, 빨리',fog:'#1c1830',sky:'#161226',lampA:'#ffb35c',lampB:'#8f7bff',speedBonus:1,gapMin:14,gapMax:26,carBoost:-1},
 {name:'심야 고속도로',banner:'고속도로 진입 — 속도를 올려!',fog:'#232031',sky:'#191722',lampA:'#46ccff',lampB:'#ff4aa6',speedBonus:4,gapMin:15,gapMax:28,carBoost:3},
 {name:'병원 구역',banner:'병원 구역 진입 — 빈 침대가 기다린다',fog:'#33141f',sky:'#241019',lampA:'#ff2b65',lampB:'#ffd671',speedBonus:2,gapMin:13,gapMax:24,carBoost:1},
];
/** Zones rotate every ZONE_LENGTH_METERS; loop counts full rotations for difficulty scaling. */
export function zoneForDistance(distance:number){const step=Math.floor(Math.max(0,distance)/ZONE_LENGTH_METERS);const index=step%ZONES.length;return {index,loop:Math.floor(step/ZONES.length),spec:ZONES[index]};}
