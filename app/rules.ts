export type Phase='ready'|'running'|'paused'|'capture'|'over';
export const SPEEDS=[22,22,16,11,0] as const;
export const AMBULANCE_GAPS=[35,30,7,4.5,0] as const;
export const HIT_GRACE=1.4;
export function nextHit(hits:number,invulnerable:number,phase:Phase){if(phase!=='running'||invulnerable>0||hits>=4)return null;const next=Math.min(4,hits+1);return {hits:next,speed:SPEEDS[next],phase:(next===4?'capture':'running') as Phase};}
export function collides(playerX:number,carX:number,previousZ:number,z:number){return Math.abs(playerX-carX)<1.4&&Math.max(previousZ,z)>-2.3&&Math.min(previousZ,z)<1.5;}
export function clampLane(lane:number){return Math.max(-1,Math.min(1,lane));}
