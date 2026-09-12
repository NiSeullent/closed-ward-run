/** Continuous fictional road trip. Sea crossings are explicitly ferry stages. */
export type WorldScenery = 'pagoda' | 'onion' | 'baltic' | 'oldtown' | 'alpine' | 'roman' | 'island' | 'bazaar' | 'pyramid' | 'nile' | 'highland' | 'salt' | 'somalia';
export interface WorldRegion {
  id: string; name: string; start: number; end: number;
  scenery: WorldScenery; color: string; landmark: string;
  places: readonly string[]; ferry?: boolean;
}
export const WORLD_REGIONS: readonly WorldRegion[] = [
  { id: 'korea', name: '대한민국', start: 1, end: 49, scenery: 'oldtown', color: '#ec008c', landmark: '판문점', places: ['도심', '국경'] },
  { id: 'north-korea', name: '북한', start: 50, end: 79, scenery: 'highland', color: '#bf5047', landmark: '평양', places: ['국경도로', '평양', '산악도로'] },
  { id: 'china', name: '중국', start: 80, end: 109, scenery: 'pagoda', color: '#f7bc47', landmark: '단둥 성문', places: ['단둥 압록강 교량', '선양 기와 거리', '하얼빈 등불 대로', '만저우리 국경'] },
  { id: 'russia', name: '러시아', start: 110, end: 144, scenery: 'onion', color: '#a5d4f7', landmark: '시베리아 철도', places: ['자바이칼 설원', '바이칼 호수', '시베리아 철도변', '모스크바 광장', '상트페테르부르크 운하'] },
  { id: 'estonia', name: '에스토니아', start: 145, end: 159, scenery: 'baltic', color: '#78aeb9', landmark: '탈린 성벽', places: ['나르바 성곽', '탈린 탑길', '페르누 해안'] },
  { id: 'latvia', name: '라트비아', start: 160, end: 174, scenery: 'baltic', color: '#ad606d', landmark: '리가 첨탑', places: ['리가 벽돌 거리', '다우가바 교량', '바우스카 성문'] },
  { id: 'lithuania', name: '리투아니아', start: 175, end: 189, scenery: 'baltic', color: '#d8b959', landmark: '빌뉴스 종탑', places: ['파네베지스 숲길', '빌뉴스 종탑길', '카우나스 강변'] },
  { id: 'poland', name: '폴란드', start: 190, end: 204, scenery: 'oldtown', color: '#e18474', landmark: '바르샤바 시장', places: ['바르샤바 구시가', '브로츠와프 운하', '수데테 산길'] },
  { id: 'czechia', name: '체코', start: 205, end: 219, scenery: 'oldtown', color: '#db9470', landmark: '프라하 시계탑', places: ['프라하 시계탑길', '블타바 다리', '브르노 광장'] },
  { id: 'austria', name: '오스트리아', start: 220, end: 234, scenery: 'alpine', color: '#b6d7d0', landmark: '알프스 고개', places: ['빈 음악 거리', '그라츠 산악 철도', '알프스 국경 고개'] },
  { id: 'italy', name: '이탈리아', start: 235, end: 249, scenery: 'roman', color: '#e1bc8b', landmark: '아드리아 아치', places: ['베네치아 수로', '라벤나 아치길', '안코나 페리 항구'] },
  { id: 'greece', name: '그리스', start: 250, end: 264, scenery: 'island', color: '#74c5e4', landmark: '에게해 기둥', places: ['아드리아 페리 갑판', '이구메니차 항구', '테살로니키 해안', '에게해 국경'] , ferry: true },
  { id: 'turkey', name: '튀르키예', start: 265, end: 279, scenery: 'bazaar', color: '#d59c74', landmark: '이스탄불 돔', places: ['이스탄불 돔 거리', '카파도키아 바위', '메르신 페리 항구'] },
  { id: 'cyprus', name: '키프로스', start: 280, end: 294, scenery: 'island', color: '#d8cc95', landmark: '지중해 항구', places: ['지중해 페리 갑판', '키레니아 항구', '리마솔 해안'] , ferry: true },
  { id: 'egypt', name: '이집트', start: 295, end: 314, scenery: 'pyramid', color: '#ecc77a', landmark: '나일 피라미드', places: ['알렉산드리아 페리', '카이로 피라미드', '룩소르 열주', '아스완 강변'] , ferry: true },
  { id: 'sudan', name: '수단', start: 315, end: 329, scenery: 'nile', color: '#c89b65', landmark: '누비아 유적', places: ['와디할파 사막', '누비아 유적', '나일 합류점'] },
  { id: 'ethiopia', name: '에티오피아', start: 330, end: 344, scenery: 'highland', color: '#91a56c', landmark: '고원 암벽', places: ['곤다르 고원', '아디스아바바 대로', '디레다와 암벽길'] },
  { id: 'djibouti', name: '지부티', start: 345, end: 359, scenery: 'salt', color: '#a8e4de', landmark: '아살 소금호수', places: ['아살 소금호수', '타주라 화산길', '지부티 항구'] },
  { id: 'somalia', name: '소말리아', start: 360, end: 400, scenery: 'somalia', color: '#62b4e9', landmark: '인도양 종착점', places: ['제일라 산호 해안', '베르베라 항구', '하르게이사 시장', '가로웨 고원', '모가디슈 인도양 대로'] },
];
export function regionAt(stage: number): WorldRegion {
  return WORLD_REGIONS.find((region) => stage >= region.start && stage <= region.end) ?? WORLD_REGIONS[WORLD_REGIONS.length - 1];
}
export interface WorldMap {
  name: string; look: 0 | 1 | 2 | 3; speed: number; police: number;
  hazard: 'traffic' | 'barrier' | 'ice' | 'checkpoint' | 'water';
  color: string; region: string; scenery: WorldScenery; variant: number; ferry: boolean;
}
export function worldMapAt(stage: number, route: 'left' | 'right'): WorldMap {
  const region = regionAt(stage);
  const length = region.end - region.start + 1;
  const local = stage > 400 ? (stage - 360) % 41 : stage - region.start;
  const location = Math.min(region.places.length - 1, Math.floor(local * region.places.length / length));
  const variant = (local + (route === 'right' ? 1 : 0)) % 3;
  const ferry = Boolean(region.ferry && location === 0);
  return {
    name: `${region.name} · ${region.places[location]} · ${['대로', '우회로', '외곽길'][variant]}`,
    look: ferry ? 2 : variant === 0 ? 0 : variant === 1 ? 1 : 2,
    // Regional character comes from scenery/events, never runaway speed scaling.
    speed: ferry ? -3 : [0, -2, 1][variant],
    police: 1,
    hazard: ferry ? 'water' : region.id === 'russia' && variant === 2 ? 'ice' : variant === 1 ? 'barrier' : 'traffic',
    color: region.color, region: region.id, scenery: region.scenery, variant, ferry,
  };
}

export const MAX_STAGE = 400;
export const CLEAR_DISTANCE = MAX_STAGE * 360;
export type RunMode = 'story' | 'endless';
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
export const FINAL_MAPS = [
  {
    name: '판문점',
    look: 2,
    speed: 1,
    police: 2,
    hazard: 'checkpoint',
    color: '#7bc8ef',
  },
  {
    name: '군사분계선',
    look: 3,
    speed: 4,
    police: 2,
    hazard: 'checkpoint',
    color: '#ff604b',
  },
] as const;
export const NORTH_MAPS = [
  {
    name: '북한 국경도로',
    look: 2,
    speed: 3,
    police: 2,
    hazard: 'checkpoint',
    color: '#bf5047',
  },
  {
    name: '북한 산악도로',
    look: 1,
    speed: -2,
    police: 2,
    hazard: 'barrier',
    color: '#898e56',
  },
  {
    name: '평양 대로',
    look: 0,
    speed: 7,
    police: 2,
    hazard: 'traffic',
    color: '#e15952',
  },
  {
    name: '북한 군수기지',
    look: 3,
    speed: 1,
    police: 2,
    hazard: 'checkpoint',
    color: '#c89945',
  },
  {
    name: '아오지 탄광로',
    look: 1,
    speed: 2,
    police: 2,
    hazard: 'barrier',
    color: '#ba9975',
  },
] as const;
export type RoadMap =
  | WorldMap
  | (typeof MAPS)[number]
  | (typeof FINAL_MAPS)[number]
  | (typeof NORTH_MAPS)[number];
export function stageAt(
  distance: number,
  route: Route = 'left',
  mode: RunMode = 'story',
) {
  const safe = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const stage =
    mode === 'endless'
      ? Math.floor(safe / STAGE_LENGTH) + 1
      : Math.min(MAX_STAGE, Math.floor(safe / STAGE_LENGTH) + 1);
  const map: RoadMap =
    stage === 49
      ? FINAL_MAPS[0]
      : stage >= 80
        ? worldMapAt(stage, route)
        : stage >= 50
        ? NORTH_MAPS[
            (stage - 50 + (route === 'right' ? 2 : 0)) % NORTH_MAPS.length
          ]
        : MAPS[(stage - 1 + (route === 'right' ? 2 : 0)) % MAPS.length];
  return {
    stage,
    map,
    progress: Math.min(1, (safe - (stage - 1) * STAGE_LENGTH) / STAGE_LENGTH),
    region: regionAt(stage),
    difficulty: 1 + Math.min(0.3, (stage - 1) / 1330),
    complete: mode === 'story' && safe >= CLEAR_DISTANCE,
  };
}
export function forkChoice(lane: number): { route: Route; collision: boolean } {
  return { route: lane > 0 ? 'right' : 'left', collision: lane === 0 };
}
export function dashDestination(distance: number, mode: RunMode = 'story') {
  return Math.min(
    mode === 'endless' ? Number.MAX_SAFE_INTEGER : CLEAR_DISTANCE,
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
