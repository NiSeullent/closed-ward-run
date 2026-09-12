import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldEvents, worldEventKinds, eventThreat, WORLD_EVENT_PROFILES, WORLD_EVENT_WARNING } from '../app/world-events.ts';
const base = { dt: 0.1, stage: 80, distance: 28440, lane: 0, jumpHeight: 0, boosting: false };
test('all 16 regional mechanics occur along the route and Somalia combines three', () => {
  const found = new Set();
  for (let stage = 80; stage <= 400; stage++) for (let i = 0; i < 4; i++) worldEventKinds(stage, i).forEach(kind => found.add(kind));
  assert.equal(found.size, 16);
  assert.equal(worldEventKinds(359, 0).length, 1);
  assert.equal(worldEventKinds(360, 0).length, 2);
  assert.equal(worldEventKinds(399, 0).length, 3);
});
test('every event and Somalia combination guarantees an always safe lane at every jump height', () => {
  for (const { kind } of WORLD_EVENT_PROFILES) for (const safeLane of [-1, 0, 1]) for (const jumpHeight of [0, 0.4, 1.2, 3]) for (let time = 0; time < 4.8; time += 0.07) {
    assert.equal(eventThreat(kind, { lane: safeLane, jumpHeight, boosting: false }, safeLane, time), false);
    assert.equal(eventThreat(kind, { lane: (safeLane + 2) % 3 - 1, jumpHeight, boosting: true }, safeLane, time), false);
  }
});
test('warnings deal zero damage; long frame cannot skip telegraph; compound event damage capped once', () => {
  const engine = createWorldEvents(); let warning = 0, damage = 0, seenActive = false;
  for (let i = 0; i < 70; i++) {
    const result = engine.update({ ...base, stage: 399, dt: i === 8 ? 30 : 0.1 });
    if (result.state?.phase === 'warning') { warning++; assert.equal(result.damage, 0); }
    if (result.state?.phase === 'active') seenActive = true;
    damage += result.damage;
  }
  assert.ok(warning >= Math.floor(WORLD_EVENT_WARNING / 0.1) - 1);
  assert.ok(seenActive); assert.ok(damage <= 1);
});
test('jump and grounded mechanics are distinct and pulse windows really open', () => {
  assert.equal(eventThreat('quake', { ...base, lane: -1 }, 1, 1), true);
  assert.equal(eventThreat('quake', { ...base, lane: -1, jumpHeight: 1 }, 1, 1), false);
  assert.equal(eventThreat('carpet', { ...base, lane: -1 }, 1, 1), false);
  assert.equal(eventThreat('carpet', { ...base, lane: -1, jumpHeight: 1 }, 1, 1), true);
  assert.equal(eventThreat('opera', { ...base, lane: -1 }, 1, 0.1), true);
  assert.equal(eventThreat('opera', { ...base, lane: -1 }, 1, 0.7), false);
  assert.equal(eventThreat('shipping', { ...base, lane: -1, jumpHeight: 2 }, 1, 1), true);
});
test('stage change and suspended bosses reset the event rather than inheriting hazards', () => {
  const engine = createWorldEvents(); for (let i = 0; i < 55; i++) engine.update(base);
  assert.equal(engine.update({ ...base, suspended: true }).state, null);
  assert.equal(engine.update(base).state, null);
  assert.equal(engine.update({ ...base, stage: 110 }).state, null);
  assert.equal(engine.update({ ...base, stage: 70 }).state, null);
});
test('safe route at every stage can finish every scheduled event without losing health', () => {
  for (let stage = 80; stage <= 400; stage++) {
    const engine = createWorldEvents(); let lane = 0;
    for (let i = 0; i < 200; i++) {
      const result = engine.update({ ...base, stage, lane });
      assert.equal(result.damage, 0, `stage ${stage}`);
      if (result.state) lane = result.state.safeLane;
      assert.ok(result.speedMultiplier >= 0.84 && result.speedMultiplier <= 1);
      assert.ok(result.jumpMultiplier >= 1 && result.jumpMultiplier <= 1.2);
    }
  }
});
