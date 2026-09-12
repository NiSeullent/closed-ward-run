/** Stage events alter decisions, never the player's input directions or raw speed. */
export type EventKind = 'lantern' | 'portal' | 'gravity' | 'train' | 'traffic-light' | 'glass' | 'mirror' | 'avalanche' | 'opera' | 'tide' | 'carpet' | 'mirage' | 'sandstorm' | 'quake' | 'shipping' | 'aurora';
export type WorldEventState = {
  title: string; instruction: string; phase: 'warning' | 'active';
  safeLane: number; hazardLanes: number[]; progress: number; color: string;
  kinds: EventKind[]; pulse: boolean;
};
export type WorldEventInput = { dt: number; stage: number; distance: number; lane: number; jumpHeight: number; boosting: boolean; suspended?: boolean };
export type WorldEventResult = { state: WorldEventState | null; damage: 0 | 1; bonusBoost: number; teleportLane: number | null; speedMultiplier: number; jumpMultiplier: number };
type Profile = { kind: EventKind; title: string; hint: string; color: string };
export const WORLD_EVENT_PROFILES: readonly Profile[] = [
  { kind: 'lantern', title: '거대 등불 낙하', hint: '점프해도 닿습니다 · 초록 차선으로', color: '#ffb342' },
  { kind: 'portal', title: '차선 순간이동 문', hint: '보라 문에서 돌진하면 안전 차선으로 이동', color: '#bd7dff' },
  { kind: 'gravity', title: '달처럼 가벼운 도로', hint: '점프가 높아집니다 · 충격파를 넘거나 초록 차선으로', color: '#adddff' },
  { kind: 'train', title: '끝없는 화물열차', hint: '열차가 번갈아 지나갑니다 · 초록 차선 유지', color: '#f2aa65' },
  { kind: 'traffic-light', title: '춤추는 신호등', hint: '빨간불에는 점프 · 초록불에는 부스트 충전', color: '#fa5d79' },
  { kind: 'glass', title: '깨지는 유리 도로', hint: '빨간 바닥 위에 서 있으면 깨집니다 · 점프', color: '#6de4f5' },
  { kind: 'mirror', title: '거울 터널의 가짜 문', hint: '화살표 대신 초록 차선을 믿으세요', color: '#b79cff' },
  { kind: 'avalanche', title: '옆으로 굴러오는 눈덩이', hint: '낮은 눈덩이를 점프로 넘거나 초록 차선으로', color: '#effbff' },
  { kind: 'opera', title: '도로 위 오페라', hint: '박자에 맞춰 점프 · 음파 사이에는 쉬기', color: '#ff96ce' },
  { kind: 'tide', title: '도로를 가르는 파도', hint: '파도는 점프로 · 젖은 차선에서는 잠시 감속', color: '#46c8ee' },
  { kind: 'carpet', title: '날아다니는 카펫 천장', hint: '붉은 차선에서는 점프 금지 · 낮게 달리기', color: '#e4b26a' },
  { kind: 'mirage', title: '신기루 오아시스', hint: '초록 차선에 머물면 부스트 충전 · 붉은 신기루 주의', color: '#ffe383' },
  { kind: 'sandstorm', title: '모래폭풍 돌풍', hint: '돌풍의 틈을 기다리거나 돌진으로 통과', color: '#ddb45e' },
  { kind: 'quake', title: '도로가 지그재그 지진', hint: '진동하는 붉은 차선은 점프로 넘기', color: '#ef846e' },
  { kind: 'shipping', title: '컨테이너 공중 배송', hint: '머리 위 화물은 점프로 피할 수 없습니다', color: '#f28b61' },
  { kind: 'aurora', title: '도로 위 오로라', hint: '초록 차선은 충전 · 붉은 광선은 돌진으로 통과', color: '#80ffca' },
];
const LANES = [-1, 0, 1];
export const WORLD_EVENT_WARNING = 2.4;
const ACTIVE_SECONDS = 4.8;
/** Region seed keeps the route reproducible for multiplayer racers. */
function regionPool(stage: number): number[] {
  if (stage < 110) return [0, 1, 4];
  if (stage < 145) return [2, 3, 15];
  if (stage < 190) return [5, 6, 4];
  if (stage < 235) return [7, 8, 3];
  if (stage < 265) return [8, 9, 5];
  if (stage < 295) return [10, 1, 6];
  if (stage < 330) return [11, 12, 10];
  if (stage < 360) return [13, 14, 9];
  return [14, 12, 13, 1, 9, 6, 8, 10];
}
export function worldEventKinds(stage: number, sequence: number): EventKind[] {
  const pool = regionPool(stage);
  const index = Math.abs(Math.floor(stage + sequence)) % pool.length;
  const count = stage >= 385 ? 3 : stage >= 360 ? 2 : 1;
  return Array.from({ length: count }, (_, n) => WORLD_EVENT_PROFILES[pool[(index + n) % pool.length]].kind);
}
function empty(): WorldEventResult { return { state: null, damage: 0, bonusBoost: 0, teleportLane: null, speedMultiplier: 1, jumpMultiplier: 1 }; }
/** Pure event decision: every combination has a permanently safe lane, including airborne players. */
export function eventThreat(kind: EventKind, input: Pick<WorldEventInput, 'lane' | 'jumpHeight' | 'boosting'>, safeLane: number, time: number): boolean {
  if (input.lane === safeLane || input.boosting) return false;
  const jumping = input.jumpHeight > 0.65;
  switch (kind) {
    case 'gravity': case 'avalanche': case 'tide': case 'quake': return !jumping;
    case 'glass': return time >= 1.1 && !jumping;
    case 'traffic-light': return time % 1.6 < 0.65 && !jumping;
    case 'opera': return time % 1.2 < 0.35 && !jumping;
    case 'carpet': return jumping;
    case 'sandstorm': return time % 1.8 < 0.85;
    case 'train': {
      const occupied = LANES.filter(lane => lane !== safeLane);
      return input.lane === occupied[Math.floor(time / 1.2) % 2];
    }
    case 'shipping': return time >= 0.8 && time % 2 < 1.4;
    case 'portal': return time >= 1;
    default: return true;
  }
}
export function createWorldEvents() {
  let stage = -1, sequence = 0, elapsed = 0, cooldown = 3;
  let kinds: EventKind[] = [], safeLane = 0, dealtDamage = false, rewarded = false;
  function reset() { stage = -1; sequence = 0; elapsed = 0; cooldown = 3; kinds = []; dealtDamage = false; rewarded = false; }
  function update(input: WorldEventInput): WorldEventResult {
    const result = empty();
    if (input.suspended || input.stage < 80) { reset(); return result; }
    if (!Number.isFinite(input.dt) || input.dt <= 0) return result;
    // A long background tab frame cannot consume the player's warning window.
    const dt = Math.min(input.dt, 0.1);
    if (stage !== input.stage) {
      stage = input.stage; sequence = 0; kinds = []; elapsed = 0;
      cooldown = stage >= 360 ? 0.7 : 2;
    }
    if (!kinds.length) {
      cooldown -= dt;
      if (cooldown > 0) return result;
      kinds = worldEventKinds(stage, sequence);
      safeLane = LANES[(stage + sequence * 2) % 3];
      elapsed = 0; dealtDamage = false; rewarded = false;
      sequence++;
    }
    elapsed += dt;
    if (elapsed >= WORLD_EVENT_WARNING + ACTIVE_SECONDS) {
      kinds = []; cooldown = stage >= 385 ? 1.4 : stage >= 360 ? 2 : 4.5;
      return result;
    }
    const phase = elapsed < WORLD_EVENT_WARNING ? 'warning' : 'active';
    const activeTime = Math.max(0, elapsed - WORLD_EVENT_WARNING);
    const profiles = kinds.map(kind => WORLD_EVENT_PROFILES.find(profile => profile.kind === kind)!);
    const hazards = LANES.filter(lane => lane !== safeLane);
    result.state = {
      title: profiles.map(profile => profile.title).join(' + '),
      instruction: kinds.length > 1 ? `복합 사건! 초록 ${safeLane === -1 ? '왼쪽' : safeLane === 0 ? '가운데' : '오른쪽'} 차선은 항상 안전 · 돌진으로도 통과` : profiles[0].hint,
      phase, safeLane, hazardLanes: phase === 'warning' ? hazards : hazards.filter(lane => kinds.some(kind => eventThreat(kind, { lane, jumpHeight: 0, boosting: false }, safeLane, activeTime) || kind === 'carpet')),
      progress: phase === 'warning' ? elapsed / WORLD_EVENT_WARNING : activeTime / ACTIVE_SECONDS,
      color: profiles[0].color, kinds: [...kinds], pulse: kinds.some(kind => eventThreat(kind, { lane: hazards[0], jumpHeight: 0, boosting: false }, safeLane, activeTime)),
    };
    if (phase === 'warning') return result;
    if (kinds.includes('gravity')) result.jumpMultiplier = 1.2;
    if (kinds.includes('tide') && input.lane !== safeLane && input.jumpHeight < 0.3) result.speedMultiplier = 0.84;
    if (kinds.includes('portal') && input.boosting && input.lane !== safeLane) result.teleportLane = safeLane;
    if (!rewarded && input.lane === safeLane && activeTime >= 1 && kinds.some(kind => ['mirage', 'aurora', 'traffic-light'].includes(kind))) { result.bonusBoost = 12; rewarded = true; }
    if (!dealtDamage && kinds.some(kind => eventThreat(kind, input, safeLane, activeTime))) { result.damage = 1; dealtDamage = true; }
    return result;
  }
  return { update, reset };
}
