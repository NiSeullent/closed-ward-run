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
