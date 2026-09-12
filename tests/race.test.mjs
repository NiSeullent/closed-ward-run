import test from 'node:test';
import assert from 'node:assert/strict';
import { raceOutcome } from '../app/race.ts';
const over = { distance: 500, elapsed: 20, phase: 'over', cleared: false };
test('race waits for both players and compares final distance', () => {
  assert.equal(raceOutcome(over, null), null);
  assert.equal(raceOutcome(over, { ...over, phase: 'running' }), null);
  assert.equal(raceOutcome(over, { ...over, distance: 400 }), 'win');
  assert.equal(raceOutcome(over, { ...over, distance: 600 }), 'lose');
  assert.equal(raceOutcome(over, over), 'draw');
});
test('clear takes priority, then completion time breaks a tie', () => {
  const clear = { ...over, distance: 36000, cleared: true };
  assert.equal(raceOutcome(clear, { ...clear, cleared: false }), 'win');
  assert.equal(raceOutcome(clear, { ...clear, elapsed: 25 }), 'win');
  assert.equal(raceOutcome(clear, { ...clear, elapsed: 15 }), 'lose');
});
