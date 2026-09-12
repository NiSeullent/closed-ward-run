import * as THREE from 'three';
import { MAPS } from './stages';

/** Distinct, pooled geometry for the ten routes; rebuilt only when entering a map. */
export function createRoadScenery(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = 'map-scenery';
  scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const pieces: THREE.Group[] = [];
  let current = '';
  function clear() {
    root.clear();
    pieces.length = 0;
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    geometries.clear();
    materials.clear();
  }
  function box(
    parent: THREE.Object3D,
    dimensions: number[],
    position: number[],
    color: string,
    glass = false,
  ) {
    const g = new THREE.BoxGeometry(
      ...(dimensions as [number, number, number]),
    );
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: glass ? 0.15 : 0.7,
      metalness: glass ? 0.45 : 0.1,
      transparent: glass,
      opacity: glass ? 0.5 : 1,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...(position as [number, number, number]));
    parent.add(mesh);
    geometries.add(g);
    materials.add(m);
    return mesh;
  }
  function enter(map: (typeof MAPS)[number]) {
    if (current === map.name) return;
    clear();
    current = map.name;
    root.userData.map = current;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Group();
      p.position.z = -i * 25;
      root.add(p);
      pieces.push(p);
      switch (map.name) {
        case '네온 도심':
          for (const side of [-1, 1]) {
            box(p, [0.2, 6, 0.2], [side * 6.8, 3, 0], map.color);
            box(p, [2, 0.3, 0.3], [side * 7.8, 5.5, 0], '#00BCF2');
          }
          break;
        case '주택가 골목':
          for (const side of [-1, 1]) {
            box(p, [0.25, 1.3, 17], [side * 6.8, 0.65, -5], '#8e654b');
            box(p, [1.1, 0.7, 1], [side * 7.8, 0.35, 1], '#368b58');
          }
          break;
        case '심야 고속도로':
          for (const side of [-1, 1])
            box(p, [0.25, 0.65, 23], [side * 6.5, 0.6, 0], '#a7b1b9');
          box(p, [13, 0.2, 0.4], [0, 6.5, 0], '#759297');
          box(p, [4, 1.1, 0.3], [0, 5.9, 0], '#087953');
          break;
        case '자동차 전용도로':
          for (const side of [-1, 1]) {
            box(p, [0.7, 1.2, 23], [side * 6.7, 0.6, 0], '#65616c');
            box(p, [0.4, 0.15, 1], [side * 6.7, 1.25, 0], '#ff405c');
          }
          break;
        case '공사 구간':
          for (const side of [-1, 1]) {
            box(p, [1.5, 0.9, 1.5], [side * 7, 0.45, 0], '#f7b732');
            box(p, [0.3, 8, 0.3], [side * 10, 4, -7], '#f7b732');
            box(p, [5, 0.3, 0.3], [side * 8.4, 8, -7], '#f7b732');
          }
          break;
        case '빙판 교량':
          box(p, [12, 0.04, 20], [0, 0.025, -5], '#b6f2ff', true);
          for (const side of [-1, 1]) {
            box(p, [0.45, 7, 0.5], [side * 6.7, 3.5, 0], '#a3d2e2');
            box(p, [0.15, 1.2, 25], [side * 6.7, 2, 0], '#d5ebf5');
          }
          break;
        case '병원 검문소':
          for (const side of [-1, 1]) {
            box(p, [1.4, 2, 2], [side * 7.2, 1, 0], '#e8eff3');
            box(p, [0.3, 1, 0.1], [side * 7.2, 1.6, 1.1], '#ec3654');
            box(p, [0.8, 0.3, 0.1], [side * 7.2, 1.6, 1.1], '#ec3654');
          }
          break;
        case '침수 지하도로':
          box(p, [12, 0.08, 24], [0, 0.03, 0], '#1e8493', true);
          for (const side of [-1, 1])
            box(p, [0.6, 10, 24], [side * 6.7, 5, 0], '#33555c');
          box(p, [13.7, 0.4, 24], [0, 10.1, 0], '#33555c');
          break;
        case '물류 창고':
          for (const side of [-1, 1])
            for (let level = 0; level < 2; level++)
              box(
                p,
                [3, 1.8, 5],
                [side * 8, level * 1.85 + 0.9, level * 1.5],
                level ? '#934495' : '#b09168',
              );
          break;
        case '최종 봉쇄선':
          for (const side of [-1, 1]) {
            box(p, [1.2, 1.1, 17], [side * 6.7, 0.55, -5], '#714942');
            box(p, [0.35, 7, 0.35], [side * 6.7, 3.5, 0], '#ff6038');
          }
          box(p, [13.7, 0.35, 0.35], [0, 7, 0], '#ff6038');
          break;
      }
    }
  }
  return {
    enter,
    tick(distance: number) {
      for (const p of pieces) {
        p.position.z += distance;
        if (p.position.z > 30) p.position.z -= 200;
      }
    },
    dispose() {
      clear();
      scene.remove(root);
    },
  };
}
