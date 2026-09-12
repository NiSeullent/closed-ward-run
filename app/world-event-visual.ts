import * as THREE from 'three';
import type { WorldEventState } from './world-events';
/** Pooled geometry: no allocations or canvas textures during event animation. */
export function createWorldEventVisual() {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  function material(color: string, opacity = 1) { const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }); materials.push(m); return m; }
  const safeMaterial = material('#53ffbd', 0.46), warningMaterial = material('#ffb347', 0.28), dangerMaterial = material('#ff4666', 0.58);
  const plane = new THREE.PlaneGeometry(2.8, 21); geometries.push(plane);
  const columns = [-1, 0, 1].map(lane => {
    const strip = new THREE.Mesh(plane, safeMaterial); strip.rotation.x = -Math.PI / 2; strip.position.set(lane * 3.65, 0.075, -8); root.add(strip); return strip;
  });
  const sphere = new THREE.SphereGeometry(0.7, 10, 8), box = new THREE.BoxGeometry(2.2, 1.4, 1.5), ring = new THREE.TorusGeometry(1.05, 0.12, 6, 20);
  geometries.push(sphere, box, ring);
  const objects = Array.from({ length: 6 }, (_, index) => {
    const m = material('#ffc663'); const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(box, m); mesh.position.z = -6 - (index % 3) * 6; root.add(mesh); return mesh;
  });
  let time = 0;
  function update(state: WorldEventState | null, dt = 0) {
    root.visible = !!state;
    if (!state) return;
    time += Math.min(Math.max(dt, 0), 0.1);
    columns.forEach((strip, index) => { const lane = index - 1; strip.material = lane === state.safeLane ? safeMaterial : state.phase === 'warning' ? warningMaterial : dangerMaterial; strip.visible = lane === state.safeLane || state.phase === 'warning' || state.hazardLanes.includes(lane); });
    const lanes = [-1, 0, 1].filter(lane => lane !== state.safeLane);
    objects.forEach((mesh, index) => {
      const kind = state.kinds[index % state.kinds.length];
      const lane = lanes[index % 2];
      mesh.visible = state.phase === 'warning' || state.hazardLanes.includes(lane);
      mesh.position.x = lane * 3.65;
      mesh.position.z = -4 - Math.floor(index / 2) * 6;
      mesh.position.y = state.phase === 'warning' ? 3.5 + Math.sin(time * 3 + index) * 0.25 : 1;
      mesh.rotation.set(0, time * 0.4, 0); mesh.scale.set(1, 1, 1);
      (mesh.material as THREE.MeshBasicMaterial).color.set(state.color);
      mesh.geometry = ['portal', 'mirror', 'aurora', 'opera'].includes(kind) ? ring : ['lantern', 'avalanche', 'gravity', 'mirage'].includes(kind) ? sphere : box;
      if (kind === 'carpet') { mesh.position.y = 2.4; mesh.scale.set(1.2, 0.15, 1.4); }
      if (kind === 'tide' || kind === 'quake') { mesh.position.y = 0.35; mesh.scale.set(1.25, 0.3, 0.25); }
      if (kind === 'glass') { mesh.position.y = 0.14; mesh.scale.set(1.1, 0.08, 2); }
      if (kind === 'sandstorm') { mesh.scale.set(0.2, 2.5, 0.2); mesh.rotation.z = Math.sin(time * 4) * 0.3; }
      if (kind === 'shipping' && state.phase === 'active') mesh.position.y = Math.max(0.75, 5 - state.progress * 18);
      if (kind === 'train') mesh.position.z += (time * 5 + index) % 6;
    });
  }
  function dispose() { geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); root.clear(); }
  root.visible = false;
  return { root, update, dispose };
}
