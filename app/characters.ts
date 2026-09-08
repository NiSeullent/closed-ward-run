import * as THREE from 'three';

/** Procedural runners. Forward is -Z; standing soles are at Y=0. */
type RunnerRig = {
  body: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftTail?: THREE.Group;
  rightTail?: THREE.Group;
  head: THREE.Group;
};

const material = (color: THREE.ColorRepresentation, roughness = 0.65, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material,
  x = 0, y = 0, z = 0, name = '') {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  if (name) object.name = name;
  parent.add(object);
  return object;
}

function ball(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number,
  sx: number, sy: number, sz: number, name = '') {
  const object = mesh(parent, new THREE.SphereGeometry(1, 16, 12), mat, x, y, z, name);
  object.scale.set(sx, sy, sz);
  return object;
}

function box(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number,
  sx: number, sy: number, sz: number, name = '') {
  return mesh(parent, new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z, name);
}

function pivot(parent: THREE.Object3D, name: string, x: number, y: number, z: number) {
  const p = new THREE.Group();
  p.name = name;
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

function ribbon(parent: THREE.Object3D, pink: THREE.Material, dark: THREE.Material,
  x: number, y: number, z: number, size = 1) {
  const group = pivot(parent, 'ribbon', x, y, z);
  const a = ball(group, pink, -0.10 * size, 0, 0, 0.13 * size, 0.08 * size, 0.05 * size);
  const b = ball(group, pink, 0.10 * size, 0, 0, 0.13 * size, 0.08 * size, 0.05 * size);
  a.rotation.z = -0.3;
  b.rotation.z = 0.3;
  ball(group, dark, 0, 0, -0.01 * size, 0.047 * size, 0.055 * size, 0.06 * size);
  return group;
}

function face(head: THREE.Group, skin: THREE.Material, iris: THREE.Material, cop = false) {
  const white = material('#fff7f8');
  const ink = material('#151329');
  const blush = material('#f7a2ba');
  ball(head, skin, 0, 0, 0, 0.37, 0.38, 0.335, 'face');
  for (const side of [-1, 1]) {
    ball(head, skin, side * 0.366, -0.02, 0, 0.07, 0.10, 0.066);
    ball(head, ink, side * 0.137, 0.025, -0.306, 0.080, cop ? 0.074 : 0.105, 0.045, 'eye-outline');
    ball(head, white, side * 0.137, 0.021, -0.343, 0.064, cop ? 0.052 : 0.083, 0.019);
    ball(head, iris, side * 0.13, 0.019, -0.362, 0.039, cop ? 0.047 : 0.065, 0.014);
    ball(head, ink, side * 0.13, 0.026, -0.375, 0.018, 0.037, 0.009);
    ball(head, white, side * 0.13 - 0.012, 0.047, -0.386, 0.013, 0.017, 0.007);
    const brow = box(head, ink, side * 0.14, 0.145, -0.307, 0.12, 0.019, 0.02);
    brow.rotation.z = side * (cop ? -0.18 : 0.09);
    ball(head, blush, side * 0.237, -0.107, -0.277, 0.055, 0.024, 0.012);
  }
  ball(head, skin, 0, -0.087, -0.34, 0.037, 0.035, 0.034, 'nose');
  box(head, ink, 0, -0.18, -0.29, 0.065, 0.013, 0.015, 'mouth');
}

function legs(parent: THREE.Group, pants: THREE.Material, boots: THREE.Material, trim: THREE.Material) {
  const pivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = pivot(parent, side < 0 ? 'leftLeg' : 'rightLeg', side * 0.18, 0.89, 0);
    ball(leg, pants, 0, -0.22, 0, 0.12, 0.28, 0.125);
    box(leg, boots, 0, -0.57, 0, 0.225, 0.39, 0.25, 'boot-shaft');
    box(leg, trim, 0, -0.415, -0.004, 0.236, 0.047, 0.263, 'boot-cuff');
    box(leg, boots, 0, -0.78, -0.06, 0.25, 0.18, 0.36, 'boot');
    box(leg, trim, 0, -0.873, -0.065, 0.265, 0.034, 0.37, 'sole');
    for (let i = 0; i < 3; i++) {
      box(leg, trim, 0, -0.50 - i * 0.064, -0.13, 0.095, 0.017, 0.013, 'boot-lace');
    }
    pivots.push(leg);
  }
  return pivots;
}

function arms(parent: THREE.Group, sleeve: THREE.Material, skin: THREE.Material, cuff: THREE.Material) {
  const pivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = pivot(parent, side < 0 ? 'leftArm' : 'rightArm', side * 0.33, 1.50, 0);
    ball(arm, sleeve, side * 0.035, -0.095, 0, 0.15, 0.18, 0.15, 'sleeve');
    ball(arm, skin, side * 0.075, -0.33, -0.005, 0.075, 0.205, 0.081, 'forearm');
    box(arm, cuff, side * 0.075, -0.42, -0.005, 0.17, 0.074, 0.18, 'cuff');
    ball(arm, skin, side * 0.075, -0.515, -0.012, 0.084, 0.10, 0.09, 'hand');
    pivots.push(arm);
  }
  return pivots;
}

function finish(group: THREE.Group, rig: RunnerRig) {
  // Both direct named pivots and a typed rig collection are available to callers.
  Object.assign(group.userData, rig, { rig, forward: '-Z', height: 2.5 });
  return group;
}

export function createMenhera(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'menhera-runner';
  const body = pivot(group, 'runnerBody', 0, 0, 0);
  const skin = material('#ffe0d9');
  const black = material('#191522');
  const boot = material('#191924', 0.40);
  const pink = material('#ff479e', 0.46);
  const hair = material('#fa73b4', 0.55);
  const hairLight = material('#ffacd7', 0.50);
  const ivory = material('#ffedf5');
  const [leftLeg, rightLeg] = legs(body, ivory, boot, pink);
  ball(body, black, 0, 1.27, 0, 0.29, 0.36, 0.20, 'dress-bodice');
  mesh(body, new THREE.CylinderGeometry(0.235, 0.42, 0.43, 12), black, 0, 0.99, 0, 'flared-skirt');
  mesh(body, new THREE.CylinderGeometry(0.408, 0.428, 0.057, 12), pink, 0, 0.787, 0, 'skirt-hem');
  // Vertical pink panels read clearly from the chase camera as the skirt moves.
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const panel = box(body, i % 3 === 0 ? pink : black,
      Math.sin(angle) * 0.325, 0.96, Math.cos(angle) * 0.325, 0.038, 0.30, 0.03, 'skirt-pleat');
    panel.rotation.set(Math.cos(angle) * -0.37, angle, Math.sin(angle) * 0.37);
  }
  mesh(body, new THREE.CylinderGeometry(0.287, 0.287, 0.064, 16), pink, 0, 1.20, 0, 'waistband');
  ball(body, skin, 0, 1.64, 0, 0.095, 0.13, 0.09, 'neck');
  const collarA = box(body, ivory, -0.092, 1.50, -0.16, 0.14, 0.09, 0.045);
  const collarB = box(body, ivory, 0.092, 1.50, -0.16, 0.14, 0.09, 0.045);
  collarA.rotation.z = -0.3;
  collarB.rotation.z = 0.3;
  ribbon(body, pink, black, 0, 1.40, -0.21, 0.75);
  ribbon(body, pink, ivory, 0, 1.21, 0.227, 1.45);
  for (const side of [-1, 1]) {
    const ribbonEnd = box(body, pink, side * 0.08, 1.01, 0.265, 0.09, 0.28, 0.032);
    ribbonEnd.rotation.z = side * 0.22;
  }
  const [leftArm, rightArm] = arms(body, black, skin, pink);
  const head = pivot(body, 'head', 0, 1.98, 0);
  ball(head, hair, 0, 0.045, 0.074, 0.427, 0.415, 0.36, 'hair-back');
  face(head, skin, pink);
  // Rounded fringe with asymmetrical tips leaves both eyes visible.
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.099;
    const lock = ball(head, i % 3 === 0 ? hairLight : hair,
      x, 0.255 - Math.abs(i - 3) * 0.012, -0.23,
      0.085, i === 3 ? 0.165 : 0.14, 0.135, 'fringe');
    lock.rotation.z = (i - 3) * -0.13;
  }
  const tails: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const tail = pivot(head, side < 0 ? 'leftTail' : 'rightTail', side * 0.395, 0.15, 0.09);
    ball(tail, black, side * 0.035, -0.025, 0, 0.10, 0.11, 0.10, 'hair-tie');
    const upper = ball(tail, hair, side * 0.115, -0.18, 0.055, 0.15, 0.28, 0.165, 'twin-tail');
    upper.rotation.z = side * 0.27;
    const lower = ball(tail, hair, side * 0.165, -0.48, 0.10, 0.135, 0.245, 0.14, 'tail-tip');
    lower.rotation.z = side * -0.22;
    ball(tail, hairLight, side * 0.12, -0.23, 0.207, 0.041, 0.19, 0.026, 'hair-highlight');
    ribbon(tail, black, pink, side * 0.04, 0.015, -0.10, 0.75);
    tails.push(tail);
  }
  // Cross-shaped hair clip and tiny back-of-head accents.
  box(head, ivory, -0.26, 0.20, -0.325, 0.105, 0.028, 0.025);
  box(head, ivory, -0.26, 0.20, -0.327, 0.028, 0.105, 0.025);
  return finish(group, { body, leftLeg, rightLeg, leftArm, rightArm, head,
    leftTail: tails[0], rightTail: tails[1] });
}

export function createCop(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cop-runner';
  const body = pivot(group, 'runnerBody', 0, 0, 0);
  const navy = material('#182f63');
  const navyLight = material('#304c87');
  const black = material('#141b2b', 0.42);
  const silver = material('#b7d6ed', 0.32, 0.65);
  const gold = material('#ffd671', 0.30, 0.65);
  const skin = material('#edbc9d');
  const [leftLeg, rightLeg] = legs(body, navy, black, black);
  ball(body, navy, 0, 1.26, 0, 0.325, 0.36, 0.225, 'uniform-shirt');
  box(body, black, 0, 0.99, 0, 0.61, 0.11, 0.40, 'utility-belt');
  box(body, silver, 0, 0.99, -0.218, 0.13, 0.10, 0.037, 'belt-buckle');
  box(body, black, -0.31, 1.00, 0, 0.13, 0.20, 0.17, 'radio');
  box(body, black, -0.31, 1.15, 0, 0.018, 0.16, 0.02, 'radio-antenna');
  box(body, black, 0.33, 0.92, 0.045, 0.10, 0.25, 0.11, 'belt-pouch');
  for (let i = 0; i < 3; i++) ball(body, silver, 0, 1.17 + i * 0.105, -0.225, 0.02, 0.02, 0.012);
  box(body, navyLight, -0.18, 1.35, -0.187, 0.17, 0.12, 0.035, 'shirt-pocket');
  ball(body, gold, 0.16, 1.41, -0.20, 0.066, 0.084, 0.024, 'badge');
  box(body, silver, 0, 1.38, 0.22, 0.42, 0.066, 0.024, 'back-reflector');
  ball(body, skin, 0, 1.65, 0, 0.11, 0.12, 0.09);
  const [leftArm, rightArm] = arms(body, navy, skin, navyLight);
  for (const side of [-1, 1]) {
    box(side < 0 ? leftArm : rightArm, gold, side * 0.035, 0.005, 0, 0.16, 0.027, 0.21, 'epaulet');
  }
  const head = pivot(body, 'head', 0, 1.99, 0);
  ball(head, black, 0, 0.09, 0.045, 0.382, 0.325, 0.335, 'hair');
  face(head, skin, navyLight, true);
  mesh(head, new THREE.CylinderGeometry(0.365, 0.40, 0.13, 16), navy, 0, 0.29, 0, 'cap-band');
  ball(head, navyLight, 0, 0.39, 0.015, 0.42, 0.115, 0.36, 'cap-crown');
  ball(head, black, 0, 0.242, -0.29, 0.34, 0.035, 0.25, 'cap-visor');
  ball(head, gold, 0, 0.325, -0.389, 0.069, 0.071, 0.018, 'cap-badge');
  return finish(group, { body, leftLeg, rightLeg, leftArm, rightArm, head });
}

/** t is elapsed seconds; amount is 0 for idle through 1 for a full sprint. */
export function animateRunner(group: THREE.Group, t: number, amount = 1): void {
  const rig = group.userData.rig as RunnerRig | undefined;
  if (!rig) return;
  const strength = THREE.MathUtils.clamp(amount, 0, 1);
  const phase = t * 13;
  const step = Math.sin(phase) * strength;
  rig.leftLeg.rotation.x = step * 0.85;
  rig.rightLeg.rotation.x = -step * 0.85;
  rig.leftArm.rotation.x = -step * 0.73 - strength * 0.12;
  rig.rightArm.rotation.x = step * 0.73 - strength * 0.12;
  rig.leftArm.rotation.z = 0.10 + strength * 0.06;
  rig.rightArm.rotation.z = -0.10 - strength * 0.06;
  rig.body.position.y = Math.abs(Math.cos(phase)) * 0.085 * strength + Math.sin(t * 2.8) * 0.008 * (1 - strength);
  rig.body.rotation.x = -strength * 0.08;
  rig.body.rotation.z = Math.sin(phase) * 0.035 * strength;
  rig.head.rotation.y = Math.sin(phase * 0.5) * 0.035 * strength;
  rig.head.rotation.x = strength * 0.065;
  for (const [tail, side] of [[rig.leftTail, -1], [rig.rightTail, 1]] as const) {
    if (!tail) continue;
    tail.rotation.x = strength * 0.25 + Math.sin(phase + side * 0.6) * 0.18 * strength;
    tail.rotation.z = side * (0.05 + strength * 0.07) + Math.cos(phase * 0.5) * 0.055;
  }
}
