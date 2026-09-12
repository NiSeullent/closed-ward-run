import test from 'node:test';
import assert from 'node:assert/strict';
import { endingBeat, CREDITS_START, ENDING_DURATION } from '../app/ending.ts';
test('hospital discharge precedes credits and credits precede endless results', () => {
  assert.equal(endingBeat(0), 'hospital');
  assert.equal(endingBeat(2.99), 'hospital');
  assert.equal(endingBeat(3), 'discharge');
  assert.equal(endingBeat(CREDITS_START - 0.01), 'discharge');
  assert.equal(endingBeat(CREDITS_START), 'credits');
  assert.equal(endingBeat(ENDING_DURATION - 0.01), 'credits');
  assert.equal(endingBeat(ENDING_DURATION), 'done');
});
test('hospital scene includes nurse and patient, approaches the patient, and supports portrait camera', async () => {
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) };
  try {
    const { createEndingSequence } = await import('../app/ending.ts');
    const ending = createEndingSequence();
    const nurse = ending.scene.getObjectByName('discharge-nurse');
    const patient = ending.scene.getObjectByName('recovered-patient');
    assert.ok(nurse && patient);
    ending.update(0, 16 / 9);
    const initialDistance = nurse.position.distanceTo(patient.position);
    assert.equal(ending.update(4, 390 / 844), 'discharge');
    assert.ok(nurse.position.distanceTo(patient.position) < initialDistance);
    assert.equal(ending.camera.aspect, 390 / 844);
    assert.ok(ending.camera.projectionMatrix.elements.every(Number.isFinite));
    assert.equal(ending.update(10, 844 / 390), 'credits');
    let disposed = 0;
    ending.scene.traverse(object => object.geometry?.addEventListener('dispose', () => disposed++));
    ending.dispose();
    assert.ok(disposed > 40);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});
