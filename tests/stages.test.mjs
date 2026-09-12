import test from 'node:test';
import assert from 'node:assert/strict';
import { stageAt, MAX_STAGE, CLEAR_DISTANCE, STAGE_LENGTH, MAPS, WORLD_REGIONS, forkChoice, dashDestination, blastHits, worldMapAt } from '../app/stages.ts';

test('all 400 stages are playable; story completes after clearing the final stage', () => {
  assert.equal(MAX_STAGE, 400);
  assert.equal(CLEAR_DISTANCE, 144000);
  for (let stage = 1; stage <= 400; stage++) {
    const entry = stageAt((stage - 1) * STAGE_LENGTH);
    assert.equal(entry.stage, stage);
    assert.equal(entry.complete, false);
    assert.equal(entry.progress, 0);
    assert.ok(entry.map.name.length > 0);
  }
  assert.equal(stageAt(CLEAR_DISTANCE - 1).complete, false);
  assert.equal(stageAt(CLEAR_DISTANCE).complete, true);
  assert.equal(stageAt(CLEAR_DISTANCE).stage, 400);
  assert.equal(stageAt(CLEAR_DISTANCE).progress, 1);
  assert.equal(stageAt(CLEAR_DISTANCE, 'left', 'endless').stage, 401);
  assert.equal(stageAt(CLEAR_DISTANCE, 'left', 'endless').complete, false);
});

test('world route has continuous coverage from Korea through China and Russia to Somalia', () => {
  assert.equal(WORLD_REGIONS[0].start, 1);
  assert.equal(WORLD_REGIONS.at(-1).end, 400);
  for (let i = 1; i < WORLD_REGIONS.length; i++) {
    assert.equal(WORLD_REGIONS[i].start, WORLD_REGIONS[i - 1].end + 1);
  }
  assert.equal(stageAt(79 * 360).region.id, 'china');
  assert.equal(stageAt(109 * 360).region.id, 'russia');
  assert.equal(stageAt(359 * 360).region.id, 'somalia');
  for (const region of WORLD_REGIONS.slice(2)) {
    const names = new Set();
    const variants = new Set();
    for (let stage = region.start; stage <= region.end; stage++) {
      const map = stageAt((stage - 1) * 360).map;
      assert.equal(map.region, region.id);
      assert.equal(map.scenery, region.scenery);
      names.add(map.name);
      variants.add(map.variant);
    }
    assert.ok(names.size >= region.places.length, region.name);
    assert.equal(variants.size, 3, region.name);
  }
  assert.equal(worldMapAt(250, 'left').ferry, true);
  assert.equal(worldMapAt(280, 'left').ferry, true);
  assert.equal(worldMapAt(295, 'left').ferry, true);
});

test('49 is Panmunjeom, North Korea ends at 79, and both boss locations remain North Korean', () => {
  for (const route of ['left', 'right']) {
    assert.equal(stageAt(48 * 360, route).map.name, '판문점');
    for (const stage of [50, 55, 70, 79]) {
      assert.equal(stageAt((stage - 1) * 360, route).region.id, 'north-korea');
    }
  }
});

test('branch center crashes into left while right changes scenery variant', () => {
  assert.deepEqual(forkChoice(0), { route: 'left', collision: true });
  assert.deepEqual(forkChoice(1), { route: 'right', collision: false });
  assert.notEqual(stageAt(360, 'left').map, stageAt(360, 'right').map);
  for (const region of WORLD_REGIONS.slice(2)) {
    assert.notEqual(worldMapAt(region.start, 'left').variant, worldMapAt(region.start, 'right').variant);
  }
});

test('dash skips one stage and only caps at the completed final stage', () => {
  assert.equal(dashDestination(12), 360);
  assert.equal(dashDestination(360), 720);
  assert.equal(dashDestination(CLEAR_DISTANCE - 1), CLEAR_DISTANCE);
  assert.equal(dashDestination(CLEAR_DISTANCE), CLEAR_DISTANCE);
  assert.equal(dashDestination(CLEAR_DISTANCE, 'endless'), CLEAR_DISTANCE + 360);
});

test('base difficulty stays bounded and physical map speeds do not escalate around the world', () => {
  assert.equal(blastHits(0, 0, 3, 4), true);
  assert.equal(blastHits(0, 0, 6.01, 0), false);
  assert.equal(MAPS.length, 10);
  assert.equal(MAPS[3].police, 2);
  for (let stage = 1; stage <= 1000; stage++) {
    const info = stageAt((stage - 1) * 360, 'left', 'endless');
    assert.ok(info.difficulty >= 1 && info.difficulty <= 1.3);
    if (stage >= 80) assert.ok(info.map.speed >= -3 && info.map.speed <= 1);
  }
});

test('every world scenery builds real geometry and changes between route variants', async () => {
  const THREE = await import('three');
  const { createRoadScenery } = await import('../app/road-scenery.ts');
  const scene = new THREE.Scene();
  const scenery = createRoadScenery(scene);
  const fingerprints = new Set();
  for (const region of WORLD_REGIONS.slice(2)) {
    // After ferry landing each country must have its own visible landmarks.
    const stage = region.start + Math.ceil((region.end - region.start + 1) / region.places.length);
    scenery.enter(worldMapAt(stage, 'left'));
    const root = scene.getObjectByName('map-scenery');
    assert.equal(root.children.length, 8, region.name);
    const meshes = [];
    root.children[0].traverse((object) => {
      if (object.isMesh) meshes.push([object.geometry.type, object.geometry.parameters, object.position.toArray(), object.material.color.getHex()]);
    });
    assert.ok(meshes.length >= 8, region.name);
    const fingerprint = JSON.stringify(meshes);
    assert.ok(!fingerprints.has(fingerprint), `distinct landmarks for ${region.name}`);
    fingerprints.add(fingerprint);
    scenery.enter(worldMapAt(stage, 'right'));
    assert.notEqual(scene.getObjectByName('map-scenery').userData.map, worldMapAt(stage, 'left').name);
    scenery.tick(250);
    for (const piece of scene.getObjectByName('map-scenery').children) {
      assert.ok(piece.position.z <= 30 && piece.position.z > -170);
    }
  }
  scenery.dispose();
  assert.equal(scene.children.length, 0);
});


test('invalid distances safely begin stage one without leaking NaN progress', () => {
  for (const distance of [NaN, Infinity, -Infinity, -360]) {
    const info = stageAt(distance);
    assert.equal(info.stage, 1);
    assert.equal(info.progress, 0);
    assert.equal(info.complete, false);
  }
});
