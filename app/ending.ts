import * as THREE from 'three';

export type EndingBeat = 'hospital' | 'discharge' | 'credits' | 'done';
export const CREDITS_START = 8;
export const ENDING_DURATION = 20;
export function endingBeat(seconds: number): EndingBeat {
  return seconds < 3 ? 'hospital' : seconds < CREDITS_START ? 'discharge' : seconds < ENDING_DURATION ? 'credits' : 'done';
}

/** A quiet hospital room, allocated only after the final world stage. */
export function createEndingSequence() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dbe9e5');
  scene.add(new THREE.HemisphereLight('#fffaf0', '#93aaa8', 2.6));
  const daylight = new THREE.DirectionalLight('#fff5dc', 2.4);
  daylight.position.set(-5, 9, 4);
  scene.add(daylight);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  const textures: THREE.Texture[] = [];
  function box(parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], color: string) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }
  function sign(text: string, at: [number, number, number], width: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f8fcf9';
    ctx.fillRect(0, 0, 1024, 192);
    ctx.fillStyle = '#39615d';
    ctx.font = '700 76px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 96, 980);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 192 / 1024), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.position.set(...at);
    scene.add(mesh);
  }
  // Open-front room: both characters remain visible on narrow screens.
  box(scene, [14, 0.25, 14], [0, -0.15, -2], '#e8e1ce');
  box(scene, [14, 6, 0.25], [0, 3, -7], '#d2e3db');
  box(scene, [0.25, 6, 14], [-7, 3, -2], '#dcebe5');
  box(scene, [14, 0.18, 0.3], [0, 1.15, -6.8], '#83a39c');
  box(scene, [3.5, 2.6, 0.16], [-3.7, 3.6, -6.8], '#fcfaf0');
  box(scene, [3.15, 2.3, 0.18], [-3.7, 3.6, -6.68], '#abd9ea');
  box(scene, [0.1, 2.3, 0.22], [-3.7, 3.6, -6.54], '#fffef9');
  box(scene, [3.15, 0.1, 0.22], [-3.7, 3.6, -6.54], '#fffef9');
  box(scene, [2.25, 4.4, 0.2], [4.2, 2.2, -6.75], '#8aa79c');
  box(scene, [1.85, 4.1, 0.23], [4.2, 2.06, -6.6], '#c4d1b9');
  box(scene, [0.1, 0.12, 0.15], [3.58, 2, -6.43], '#526f6e');
  sign('정신건강의학과 · 회복 병동', [0, 5.3, -6.8], 5.6);
  sign('400호', [4.2, 4.6, -6.5], 1.2);
  const bed = new THREE.Group();
  bed.position.set(-1.2, 0, -1.7);
  scene.add(bed);
  box(bed, [2.3, 0.22, 4], [0, 0.7, 0], '#a3b6b0');
  box(bed, [2.2, 0.38, 3.9], [0, 1, 0], '#fffdf1');
  box(bed, [2.2, 0.14, 1.8], [0, 1.27, 0.9], '#9bc6cd');
  box(bed, [1.5, 0.23, 0.75], [0, 1.31, -1.3], '#fffef7');
  for (const side of [-1, 1]) {
    box(bed, [0.13, 1.6, 0.15], [side, 0.8, -1.85], '#a3b6b0');
    box(bed, [0.13, 0.75, 0.15], [side, 0.38, 1.85], '#a3b6b0');
  }
  box(bed, [2.15, 0.12, 0.15], [0, 1.6, -1.85], '#a3b6b0');
  box(scene, [1, 1.25, 0.9], [-3, 0.62, -2.8], '#b2c0a7');
  box(scene, [0.3, 0.4, 0.3], [-3, 1.45, -2.8], '#f4f7f0');
  function person(nurse: boolean) {
    const root = new THREE.Group();
    root.name = nurse ? 'discharge-nurse' : 'recovered-patient';
    const clothes = nurse ? '#f3fcf6' : '#b0ceda';
    const skin = '#e5b79d';
    const legs: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      legs.push(box(root, [0.25, 0.68, 0.3], [side * 0.18, 0.4, 0], clothes));
      box(root, [0.27, 0.14, 0.42], [side * 0.18, 0.1, 0.06], nurse ? '#f8fff8' : '#758994');
    }
    box(root, [0.78, 0.87, 0.43], [0, 1.16, 0], clothes);
    box(root, [0.56, 0.58, 0.48], [0, 1.94, 0], skin);
    box(root, [0.6, 0.19, 0.5], [0, 2.2, 0], '#413939');
    for (const side of [-1, 1]) box(root, [0.055, 0.045, 0.03], [side * 0.13, 1.98, 0.25], '#343b3b');
    box(root, [0.13, 0.025, 0.03], [0, 1.81, 0.25], '#9f665b');
    box(root, [0.2, 0.7, 0.28], [-0.49, 1.13, 0], clothes);
    const arm = new THREE.Group();
    arm.position.set(0.47, 1.52, 0);
    root.add(arm);
    box(arm, [0.2, 0.6, 0.28], [0, -0.28, 0], clothes);
    box(arm, [0.19, 0.2, 0.25], [0, -0.67, 0], skin);
    if (nurse) {
      box(root, [0.69, 0.2, 0.5], [0, 2.36, 0], '#ffffff');
      box(root, [0.13, 0.11, 0.02], [0, 2.37, 0.26], '#5a9b94');
      box(root, [0.24, 0.14, 0.03], [-0.18, 1.35, 0.23], '#6baca7');
      box(root, [0.48, 0.61, 0.08], [-0.48, 0.81, 0.19], '#7a9995');
      box(root, [0.38, 0.48, 0.03], [-0.48, 0.81, 0.24], '#fffdf1');
    } else {
      for (const x of [-0.22, 0, 0.22]) box(root, [0.04, 0.75, 0.02], [x, 1.15, 0.225], '#dceef1');
    }
    return { root, arm, legs };
  }
  const nurse = person(true), patient = person(false);
  scene.add(nurse.root, patient.root);
  patient.root.position.set(-0.7, 0, 1.15);
  patient.root.rotation.y = 0.25;
  return {
    scene,
    camera,
    update(seconds: number, aspect: number) {
      const beat = endingBeat(seconds);
      const approach = THREE.MathUtils.smoothstep(seconds, 0.8, 3.8);
      nurse.root.position.set(3.6 - approach * 2.5, 0, -4.9 + approach * 5.6);
      nurse.root.rotation.y = -0.25;
      const walking = seconds > 0.8 && seconds < 3.8;
      nurse.legs.forEach((leg, i) => { leg.rotation.x = walking ? Math.sin(seconds * 9 + i * Math.PI) * 0.28 : 0; });
      nurse.arm.rotation.x = beat === 'discharge' ? -0.7 : 0;
      nurse.arm.rotation.z = beat === 'discharge' ? -0.25 + Math.sin(seconds * 3) * 0.07 : 0;
      patient.root.rotation.x = seconds > 5 && seconds < 6.5 ? Math.sin((seconds - 5) / 1.5 * Math.PI) * 0.12 : 0;
      camera.aspect = Math.max(aspect, 0.1);
      camera.fov = aspect < 0.9 ? 57 : 45;
      camera.updateProjectionMatrix();
      const close = THREE.MathUtils.smoothstep(seconds, 0, 4);
      camera.position.set(0.2, 4.6 - close * 1.3, (aspect < 0.9 ? 12 : 9) - close * 1.2);
      camera.lookAt(0.1, 1.35, -0.8);
      return beat;
    },
    dispose() {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
        }
      });
      textures.forEach((texture) => texture.dispose());
    },
  };
}
