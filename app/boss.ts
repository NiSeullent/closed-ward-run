import * as THREE from 'three';
export type BossKind = 'commander' | 'leader';
export type BossState = {
  kind: BossKind;
  name: string;
  hp: number;
  maxHp: number;
  lane: number;
  attackLanes: number[];
  warning: number;
  cooldown: number;
  defeated: boolean;
};
export function bossAt(stage: number): BossKind | null {
  return stage === 55 ? 'commander' : stage === 70 ? 'leader' : null;
}
export function createBossState(kind: BossKind): BossState {
  const hp = kind === 'commander' ? 12 : 20;
  return {
    kind,
    name: kind === 'commander' ? '인민군 사령관' : '김정은',
    hp,
    maxHp: hp,
    lane: 0,
    attackLanes: [],
    warning: 0,
    cooldown: 0,
    defeated: false,
  };
}
export function bossPattern(kind: BossKind, round: number) {
  const lane = [-1, 1, 0][round % 3];
  return kind === 'commander'
    ? [lane]
    : [-1, 0, 1].filter((value) => value !== lane);
}
export function createBossEncounter(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = 'boss-encounter';
  scene.add(root);
  root.visible = false;
  const materials: THREE.Material[] = [],
    geometries: THREE.BufferGeometry[] = [];
  function box(
    parent: THREE.Object3D,
    size: number[],
    at: number[],
    color: string,
  ) {
    const geometry = new THREE.BoxGeometry(
      ...(size as [number, number, number]),
    );
    const material = new THREE.MeshStandardMaterial({ color });
    geometries.push(geometry);
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...(at as [number, number, number]));
    parent.add(mesh);
    return mesh;
  }
  const body = new THREE.Group();
  root.add(body);
  box(body, [2.8, 0.8, 3.6], [0, 0.6, 0], '#464e37');
  for (const side of [-1, 1])
    box(body, [0.45, 0.7, 3.8], [side * 1.5, 0.4, 0], '#252d29');
  const coat = box(body, [1.25, 1.35, 0.7], [0, 1.6, 0], '#656944');
  box(body, [0.78, 0.7, 0.65], [0, 2.65, 0], '#dcb98e');
  const hat = box(body, [0.83, 0.23, 0.7], [0, 3.09, 0], '#747849');
  for (const side of [-1, 1])
    box(body, [0.08, 0.06, 0.03], [side * 0.18, 2.69, 0.34], '#131917');
  box(body, [0.25, 0.04, 0.03], [0, 2.45, 0.34], '#795645');
  const warnings = [-1, 0, 1].map((lane) => {
    const plane = box(
      root,
      [3.4, 0.04, 25],
      [lane * 3.65, 0.05, -3],
      '#ed4349',
    );
    const mat = plane.material;
    mat.transparent = true;
    mat.opacity = 0.25;
    plane.visible = false;
    return plane;
  });
  const shot = box(root, [0.2, 0.2, 1], [0, 1.2, 0], '#ffed87');
  shot.visible = false;
  let state: BossState | null = null,
    timer = 0,
    round = 0,
    shotTime = 0;
  return {
    start(kind: BossKind) {
      state = createBossState(kind);
      timer = 1.6;
      round = 0;
      root.visible = true;
      coat.material.color.set(kind === 'leader' ? '#232828' : '#656944');
      hat.material.color.set(kind === 'leader' ? '#141b1a' : '#747849');
      body.position.set(0, 0, -17);
      warnings.forEach((w) => (w.visible = false));
      return state;
    },
    tick(dt: number, lane: number, jumpHeight: number, damage: () => void) {
      if (!state || state.defeated) return;
      state.cooldown = Math.max(0, state.cooldown - dt);
      body.position.x = THREE.MathUtils.lerp(
        body.position.x,
        state.lane * 3.65,
        1 - Math.exp(-dt * 6),
      );
      if (shotTime > 0) {
        shotTime -= dt;
        shot.position.z -= 80 * dt;
        shot.visible = shotTime > 0;
      }
      if (state.warning > 0) {
        state.warning = Math.max(0, state.warning - dt);
        warnings.forEach((w, i) => {
          w.visible = state!.attackLanes.includes(i - 1);
          w.material.opacity = 0.2 + Math.sin(state!.warning * 20) * 0.1;
        });
        if (state.warning === 0) {
          if (state.attackLanes.includes(lane) && jumpHeight < 0.85) damage();
          warnings.forEach((w) => (w.visible = false));
          state.attackLanes = [];
          timer = state.kind === 'leader' ? 1.1 : 1.6;
          round++;
          state.lane = [0, 1, -1][round % 3];
        }
      } else {
        timer -= dt;
        if (timer <= 0) {
          state.attackLanes = bossPattern(state.kind, round);
          state.warning = state.kind === 'leader' ? 1.1 : 1.4;
        }
      }
    },
    attack(lane: number, power = 1) {
      if (!state || state.defeated || state.cooldown > 0) return false;
      state.cooldown = power > 1 ? 0.8 : 0.38;
      shot.position.set(lane * 3.65, 1.3, 0);
      shotTime = 0.25;
      shot.visible = true;
      if (lane !== state.lane) return false;
      state.hp = Math.max(0, state.hp - power);
      if (state.hp === 0) {
        state.defeated = true;
        root.visible = false;
        state.attackLanes = [];
        state.warning = 0;
      }
      return true;
    },
    reset() {
      state = null;
      root.visible = false;
      shot.visible = false;
    },
    snapshot() {
      return state ? { ...state, attackLanes: [...state.attackLanes] } : null;
    },
    dispose() {
      scene.remove(root);
      materials.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
    },
  };
}
