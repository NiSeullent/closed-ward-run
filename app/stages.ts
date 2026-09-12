export const MAX_STAGE = 100;
export const STAGE_LENGTH = 360;
export type Route = 'left' | 'right';
export const MAPS = [
  {
    name: '네온 도심',
    look: 0,
    speed: 0,
    police: 1,
    hazard: 'traffic',
    color: '#EC008C',
  },
  {
    name: '주택가 골목',
    look: 1,
    speed: -3,
    police: 1,
    hazard: 'barrier',
    color: '#ffb35c',
  },
  {
    name: '심야 고속도로',
    look: 2,
    speed: 9,
    police: 1,
    hazard: 'traffic',
    color: '#46ccff',
  },
  {
    name: '자동차 전용도로',
    look: 2,
    speed: 5,
    police: 2,
    hazard: 'traffic',
    color: '#ff405c',
  },
  {
    name: '공사 구간',
    look: 1,
    speed: -2,
    police: 1,
    hazard: 'barrier',
    color: '#ffd600',
  },
  {
    name: '빙판 교량',
    look: 2,
    speed: 3,
    police: 1,
    hazard: 'ice',
    color: '#b6f2ff',
  },
  {
    name: '병원 검문소',
    look: 3,
    speed: 0,
    police: 1,
    hazard: 'checkpoint',
    color: '#ff2b65',
  },
  {
    name: '침수 지하도로',
    look: 0,
    speed: -6,
    police: 1,
    hazard: 'water',
    color: '#00bcb2',
  },
  {
    name: '물류 창고',
    look: 1,
    speed: 2,
    police: 1,
    hazard: 'barrier',
    color: '#b69aff',
  },
  {
    name: '최종 봉쇄선',
    look: 3,
    speed: 4,
    police: 2,
    hazard: 'checkpoint',
    color: '#ff6038',
  },
] as const;
export function stageAt(distance: number, route: Route = 'left') {
  const safe = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const stage = Math.min(MAX_STAGE, Math.floor(safe / STAGE_LENGTH) + 1);
  const map = MAPS[(stage - 1 + (route === 'right' ? 2 : 0)) % MAPS.length];
  return {
    stage,
    map,
    progress: Math.min(1, (safe - (stage - 1) * STAGE_LENGTH) / STAGE_LENGTH),
    difficulty: 1 + (stage - 1) / 35,
    complete: safe >= MAX_STAGE * STAGE_LENGTH,
  };
}
export function forkChoice(lane: number): { route: Route; collision: boolean } {
  return { route: lane > 0 ? 'right' : 'left', collision: lane === 0 };
}
export function dashDestination(distance: number) {
  return Math.min(
    MAX_STAGE * STAGE_LENGTH,
    (Math.floor(distance / STAGE_LENGTH) + 1) * STAGE_LENGTH,
  );
}
export function blastHits(
  px: number,
  pz: number,
  x: number,
  z: number,
  radius = 6,
) {
  return Math.hypot(px - x, pz - z) <= radius;
}
export type Item = 'destroy' | 'throw' | 'emp' | 'shield' | 'medkit' | 'boost';
export const ITEM_LABELS: Record<Item, string> = {
  destroy: '파괴 망치',
  throw: '투척 폭탄',
  emp: '경찰 EMP',
  shield: '보호막',
  medkit: '구급약',
  boost: '부스트 충전',
};
