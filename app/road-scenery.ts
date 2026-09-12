import * as THREE from 'three';
import type { RoadMap, WorldMap } from './stages';

/** Region landmarks and route variants, rebuilt only when entering a map. */
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
  function cone(parent: THREE.Object3D, radius: number, height: number, position: number[], color: string, sides = 6) {
    const g = new THREE.ConeGeometry(radius, height, sides);
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...position as [number, number, number]);
    parent.add(mesh); geometries.add(g); materials.add(m);
    return mesh;
  }
  function worldLandmarks(p: THREE.Group, map: WorldMap, i: number) {
    const offset = map.variant * 1.3;
    if (map.ferry) {
      box(p, [13, 0.1, 25], [0, -0.02, 0], '#647c85');
      box(p, [40, 0.1, 25], [0, -0.5, 0], '#247d9d', true);
      for (const side of [-1, 1]) {
        box(p, [0.15, 1.4, 25], [side * 6.4, 0.7, 0], '#e2e5e3');
        box(p, [0.2, 5, 0.2], [side * 7, 2.5, -6], '#dfe4e4');
        box(p, [3, 2, 5], [side * 9, 1, -5], map.color);
      }
      return;
    }
    for (const side of [-1, 1]) {
      const x = side * (9 + offset);
      const z = -5 - (i % 3) * 2;
      // Every branch changes roadside spacing and silhouette, not just its label.
      if (map.variant === 1) {
        box(p, [0.18, 1.6, 21], [side * 6.7, 0.8, -5], map.color);
      } else if (map.variant === 2) {
        cone(p, 1.4, 3.4, [side * 7.8, 1.6, 3], map.color, 5);
      }
      switch (map.scenery) {
        case 'pagoda':
          box(p, [4, 4, 5], [x, 2, z], '#b96547');
          for (let tier = 0; tier < 3; tier++) {
            const roof = cone(p, 3.7 - tier * 0.7, 1, [x, 4 + tier * 1.2, z], '#4b5c48', 4);
            roof.rotation.y = Math.PI / 4;
          }
          box(p, [0.1, 4, 0.1], [side * 7, 2, 2], '#74513b');
          cone(p, 0.55, 1.1, [side * 7, 3.6, 2], '#e6a137', 8);
          break;
        case 'onion':
          box(p, [3, 5, 4], [x, 2.5, z], i % 2 ? '#c7dcdb' : '#ae635b');
          cone(p, 2, 2, [x, 5.7, z], '#598a7c', 10);
          cone(p, 1, 2, [x, 7.1, z], '#dbc167', 10);
          box(p, [0.4, 0.3, 24], [side * 7, 0.15, -5], '#d4e3e8');
          break;
        case 'baltic': {
          const height = map.region === 'estonia' ? 6 : map.region === 'latvia' ? 8 : 10;
          box(p, [3, height, 4], [x, height / 2, z], map.color);
          cone(p, 2.2, 3, [x, height + 1.5, z], '#6d4a44', 4);
          const windows = map.region === 'lithuania' ? 3 : 2;
          for (let w = 0; w < windows; w++)
            box(p, [0.8, 0.8, 0.1], [x, 2 + w * 1.6, z + 2.1], '#ffdc89');
          if (map.region === 'estonia')
            box(p, [5, 2, 0.5], [x, 1, z + 1], '#a4aaa0');
          break;
        }
        case 'oldtown':
          box(p, [4, 5, 5], [x, 2.5, z], map.color);
          cone(p, 3.2, 2, [x, 6, z], '#715252', 4).rotation.y = Math.PI / 4;
          if (map.region === 'czechia') {
            box(p, [1.7, 1.7, 0.1], [x, 4.1, z + 2.6], '#eed997');
            box(p, [0.12, 0.65, 0.15], [x, 4.3, z + 2.7], '#343e4a');
          } else box(p, [5, 0.25, 1.5], [x, 2, z + 2.5], '#b66057');
          break;
        case 'alpine':
          cone(p, 6, 13, [side * 17, 5, z], '#9ca8a8', 5);
          cone(p, 2.5, 5, [side * 17, 9.2, z], '#e1eeed', 5);
          box(p, [4, 3, 4], [x, 1.5, z], '#a98467');
          cone(p, 3.2, 2, [x, 3.9, z], '#675250', 4).rotation.y = Math.PI / 4;
          break;
        case 'roman':
          for (const dx of [-1.8, 1.8]) {
            box(p, [0.8, 5, 1.2], [x + dx, 2.5, z], '#d7c6a7');
            box(p, [1.4, 0.5, 1.7], [x + dx, 5, z], '#e9ddc4');
          }
          box(p, [5, 0.8, 1.7], [x, 5.6, z], '#d7c6a7');
          box(p, [4, 0.04, 23], [side * 7.7, 0.02, -5], '#498d99', true);
          break;
        case 'island':
          box(p, [4, 3, 5], [x, 1.5, z], '#f2eee0');
          cone(p, 2.4, 1.6, [x, 3.7, z], map.region === 'greece' ? '#3e8dc6' : '#c4ad78', 12);
          box(p, [0.8, 1.8, 0.1], [x, 0.9, z + 2.6], '#287db2');
          box(p, [15, 0.05, 25], [side * 20, -0.05, 0], '#31a6bb', true);
          break;
        case 'bazaar':
          box(p, [4, 4, 5], [x, 2, z], '#c9ab8c');
          cone(p, 2.5, 2, [x, 4.8, z], '#6fa6a1', 12);
          box(p, [0.7, 8, 0.7], [x + side * 2.5, 4, z], '#dbc3a0');
          cone(p, 0.7, 1.6, [x + side * 2.5, 8.6, z], '#729b96', 8);
          box(p, [4, 0.15, 2], [x, 2.4, z + 3], '#ae6254');
          break;
        case 'pyramid':
          cone(p, 7, 10, [side * 16, 4.6, z], '#d8b46e', 4).rotation.y = Math.PI / 4;
          box(p, [1, 5, 1], [x, 2.5, z], '#e4c689');
          cone(p, 0.72, 1, [x, 5.5, z], '#d6ad68', 4);
          break;
        case 'nile':
          cone(p, 3.5, 7, [x, 3.2, z], '#b08658', 4).rotation.y = Math.PI / 4;
          box(p, [7, 0.08, 25], [side * 16, -0.02, 0], '#4b9694', true);
          box(p, [0.4, 4, 0.4], [side * 7.5, 2, 1], '#866245');
          cone(p, 2, 0.8, [side * 7.5, 4, 1], '#708353', 5);
          break;
        case 'highland':
          box(p, [8, 7, 12], [side * 14, 2.8, z], '#846e58');
          box(p, [5, 0.5, 8], [side * 14, 6.5, z], '#89a25a');
          box(p, [3, 2.5, 3], [x, 1.25, z], '#bda682');
          cone(p, 2.7, 2, [x, 3.1, z], '#81644e', 8);
          break;
        case 'salt':
          box(p, [20, 0.08, 25], [side * 18, 0.01, 0], '#d9efea');
          cone(p, 5, 7, [side * 17, 2.8, z], '#5b6864', 5);
          for (let n = 0; n < 3; n++) cone(p, 0.6, 2 + n * 0.4, [x + n, 1, z], '#c5f0e4', 4);
          break;
        case 'somalia':
          box(p, [5, 3.5, 5], [x, 1.75, z], '#e3d4b4');
          box(p, [5.3, 0.4, 5.3], [x, 3.7, z], '#ece3ca');
          box(p, [1, 2, 0.1], [x, 1, z + 2.6], '#418b9e');
          box(p, [0.4, 5, 0.4], [side * 7.5, 2.5, 2], '#967951');
          for (const tilt of [-1, 1]) {
            const palm = box(p, [3.5, 0.2, 0.7], [side * 7.5 + tilt, 5, 2], '#75946a');
            palm.rotation.z = tilt * 0.25;
          }
          if (map.variant === 0) box(p, [20, 0.08, 25], [side * 23, -0.08, 0], '#3aa1b5', true);
          if (map.variant === 1) box(p, [4, 0.2, 2], [x, 2.3, z + 3], '#6096b5');
          break;
      }
    }
  }
  function enter(map: RoadMap) {
    if (current === map.name) return;
    clear();
    current = map.name;
    root.userData.map = current;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Group();
      p.position.z = -i * 25;
      root.add(p);
      pieces.push(p);
      if ('scenery' in map) {
        worldLandmarks(p, map, i);
        continue;
      }
      switch (map.name) {
        case '북한 국경도로':
        case '북한 산악도로':
        case '평양 대로':
        case '북한 군수기지':
        case '아오지 탄광로':
          for (const side of [-1, 1]) {
            box(p, [0.18, 5.5, 0.18], [side * 7, 2.75, 0], '#adaba0');
            box(p, [1.8, 1, 0.07], [side * 7 + 0.8, 4.8, 0], '#be383c');
            if (map.name === '평양 대로') {
              box(
                p,
                [5, 9 + (i % 3) * 3, 6],
                [side * 10, 4.5 + (i % 3) * 1.5, -8],
                '#c2bdac',
              );
              box(p, [0.1, 5, 3], [side * 7.4, 4, -8], '#406570');
            } else if (map.name === '북한 산악도로') {
              box(p, [8, 5 + (i % 4), 12], [side * 12, 2, -8], '#56634b');
              box(p, [1, 4, 1], [side * 8, 2, -10], '#3a513f');
            } else if (map.name === '북한 군수기지') {
              box(p, [4, 3, 7], [side * 9, 1.5, -5], '#687250');
              box(p, [3, 0.8, 3], [side * 8, 0.4, 3], '#999273');
            } else if (map.name === '아오지 탄광로') {
              box(p, [4, 2.5, 5], [side * 9, 1, -6], '#383c36');
              box(p, [0.3, 6, 0.3], [side * 7, 3, -9], '#998166');
            } else {
              box(p, [0.2, 2, 23], [side * 6.6, 1, -6], '#8c927d');
              box(p, [2, 4, 2], [side * 9, 2, -8], '#747962');
            }
          }
          break;
        case '판문점':
          for (const side of [-1, 1]) {
            box(p, [3.7, 2.7, 6], [side * 8.8, 1.35, -4], '#6bb7d6');
            box(p, [4.3, 0.22, 6.5], [side * 8.8, 2.85, -4], '#376578');
            box(p, [0.08, 0.9, 1.7], [side * 6.9, 1.65, -4], '#142f47');
            box(p, [0.12, 2, 22], [side * 6.5, 1, -6], '#a9afb4');
          }
          box(p, [12, 0.03, 0.3], [0, 0.04, -8], '#f4eed4');
          break;
        case '군사분계선':
          for (const side of [-1, 1]) {
            box(p, [0.25, 5.5, 0.25], [side * 7, 2.75, 0], '#62644c');
            box(p, [2.3, 1.5, 2.3], [side * 7, 5.3, 0], '#77795b');
            box(p, [0.2, 1.7, 23], [side * 6.6, 0.9, -7], '#838977');
            box(p, [0.16, 0.18, 23], [side * 6.6, 2.1, -7], '#e7b05f');
          }
          break;
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
        if (p.position.z > 30) p.position.z -= Math.ceil((p.position.z - 30) / 200) * 200;
      }
    },
    dispose() {
      clear();
      scene.remove(root);
    },
  };
}
