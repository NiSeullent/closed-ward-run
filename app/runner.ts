import { createWorldEvents, type WorldEventState } from './world-events';
import { createWorldEventVisual } from './world-event-visual';
import { soundtrackForStage, SOUNDTRACK_NAMES } from './soundtrack';
import { createBossEncounter, bossAt, type BossState } from './boss';
import { createRoadScenery } from './road-scenery';
import {
  createEndingSequence,
  ENDING_DURATION,
  type EndingBeat,
} from './ending';
import {
  stageAt,
  STAGE_LENGTH,
  MAX_STAGE,
  CLEAR_DISTANCE,
  type RunMode,
  forkChoice,
  dashDestination,
  blastHits,
  ITEM_LABELS,
  type Item,
  type Route,
} from './stages';
import * as THREE from 'three';
import { createMenhera, createCop, animateRunner } from './characters';
import {
  AMBULANCE_GAPS,
  HIT_GRACE,
  nextHit,
  collides,
  clampLane,
  speedForDistance,
  shouldActivateTaser,
  shouldActivateMartialLaw,
  jumpClearsTaser,
  TASER_INTERVAL_SECONDS,
  zoneForDistance,
  eventsUnlocked,
  ZONE_LENGTH_METERS,
  GATE_LEAD_METERS,
  curveIntensity,
  CURVE_DURATION_SECONDS,
  CURVE_MIN_INTERVAL_SECONDS,
  CURVE_MAX_INTERVAL_SECONDS,
  type Phase,
} from './rules';
export type MapItem = {
  kind: 'car' | 'taser' | 'helicopter' | 'police';
  lane: number;
  z: number;
};
export type CaptureReason = 'ambulance' | 'helicopter';
export type GameSnapshot = {
  stage: number;
  progress: number;
  boost: number;
  boosting: boolean;
  item: Item | null;
  police: number;
  route: Route;
  cleared: boolean;
  ending?: EndingBeat;
  mode: RunMode;
  boss: BossState | null;
  worldEvent: WorldEventState | null;
  phase: Phase;
  hits: number;
  speed: number;
  distance: number;
  best: number;
  elapsed: number;
  flash: string;
  ambulance: number;
  lane: number;
  jumping: boolean;
  jumpHeight: number;
  martialLaw: boolean;
  helicopter: boolean;
  taser: boolean;
  zone: string;
  curve: boolean;
  captureReason?: CaptureReason;
  mapItems: MapItem[];
};
export type GameAPI = {
  start: (seed?: number) => void;
  boost: () => void;
  useItem: () => void;
  setRival: (r: { lane: number; distance: number } | null) => void;
  pause: () => void;
  move: (dir: number) => void;
  jump: () => void;
  mute: (value: boolean) => void;
  dispose: () => void;
  getState: () => GameSnapshot;
  skipEnding: () => void;
  continueEndless: () => void;
  attack: () => void;
};
const mix = THREE.MathUtils.lerp,
  clamp = THREE.MathUtils.clamp;
export function createGame(
  host: HTMLDivElement,
  onState: (s: GameSnapshot) => void,
): GameAPI {
  let randomState = 12345;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  let endingSequence: ReturnType<typeof createEndingSequence> | null = null;
  let endingTime = 0;
  const roadScenery = createRoadScenery(scene);
  const bossEncounter = createBossEncounter(scene);
  const defeatedBosses = new Set<number>();
  const worldEvents = createWorldEvents();
  const worldVisual = createWorldEventVisual();
  scene.add(worldVisual.root);
  worldVisual.update(null);
  let worldSpeedMultiplier = 1, worldJumpMultiplier = 1;
  roadScenery.enter(stageAt(0).map);
  scene.background = new THREE.Color('#20152f');
  scene.fog = new THREE.FogExp2('#291934', 0.015);
  const camera = new THREE.PerspectiveCamera(49, 1, 0.1, 240);
  camera.position.set(10, 6.5, 16);
  scene.add(new THREE.HemisphereLight('#e4c3ff', '#383050', 2.1));
  const key = new THREE.DirectionalLight('#b3b7ff', 3);
  key.position.set(-12, 25, 15);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 25;
  key.shadow.camera.bottom = -25;
  key.shadow.camera.far = 80;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const pinkLight = new THREE.PointLight('#ff4aa6', 65, 35, 2);
  pinkLight.position.set(6, 5, 1);
  scene.add(pinkLight);
  const cyanLight = new THREE.PointLight('#46ccff', 50, 30, 2);
  cyanLight.position.set(-7, 5, -10);
  scene.add(cyanLight);
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  function mat(color: string, glow = false) {
    const k = color + glow;
    let m = mats.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: glow ? 0.5 : 0.7,
        metalness: 0.12,
        emissive: glow ? color : '#000000',
        emissiveIntensity: glow ? 2 : 0,
      });
      mats.set(k, m);
    }
    return m;
  }
  function box(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
    glow = false,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, glow));
    m.position.set(x, y, z);
    m.castShadow = !glow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function label(
    parent: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    color = '#ff6faa',
    bg = '#241429',
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 58px "Malgun Gothic",sans-serif';
    ctx.fillText(text, 256, 67, 470);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  const groundMat = new THREE.MeshStandardMaterial({
    color: zoneForDistance(0).spec.ground,
    roughness: 0.9,
    metalness: 0,
  });
  const groundBase = new THREE.Mesh(
    new THREE.BoxGeometry(240, 0.2, 320),
    groundMat,
  );
  groundBase.position.set(0, -0.34, -80);
  groundBase.receiveShadow = true;
  scene.add(groundBase);
  box(scene, 12, 0.18, 300, 0, -0.12, -80, '#28273c');
  for (const x of [-6.5, 6.5]) {
    box(scene, 1, 0.4, 250, x, 0.02, -65, '#565066');
    box(
      scene,
      0.06,
      0.05,
      250,
      x - Math.sign(x) * 0.55,
      0.25,
      -65,
      '#ee629c',
      true,
    );
  }
  const road = new THREE.Group();
  scene.add(road);
  for (let i = 0; i < 40; i++)
    for (const x of [-2, 2])
      box(road, 0.09, 0.025, 2.4, x, 0.002, -i * 6, '#bda4c5');
  box(scene, 0.07, 0.02, 250, -5.7, 0.005, -65, '#e3b765', true);
  box(scene, 0.07, 0.02, 250, 5.7, 0.005, -65, '#e3b765', true);
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  type CityLook = {
    walls: string[];
    roof: string;
    windows: string[];
    windowMod: number;
    signs: { t: string; c: string; b: string }[];
    signEvery: (i: number) => boolean;
    signY: number;
    spread: number;
    minH: number;
    maxH: number;
    extra: 'neon' | 'houses' | 'highway' | 'hospital';
  };
  const CITY_LOOKS: CityLook[] = [
    {
      walls: ['#34304e', '#24283c', '#44334d', '#2d3049', '#3a2b3f', '#232b4a'],
      roof: '#544566',
      windows: ['#ef77a2', '#a79cdc'],
      windowMod: 4,
      signs: [
        { t: '불야성', c: '#86edee', b: '#241429' },
        { t: '24시 편의점', c: '#ff8aba', b: '#241429' },
        { t: '도망시', c: '#86edee', b: '#241429' },
        { t: '퇴원약국', c: '#ff8aba', b: '#241429' },
        { t: 'NIGHT RUN', c: '#86edee', b: '#193c40' },
        { t: '돌아와♥', c: '#ff8aba', b: '#241429' },
      ],
      signEvery: (i) => i % 2 === 0 || i < 4,
      signY: 3.7,
      spread: 0,
      minH: 7,
      maxH: 23,
      extra: 'neon',
    },
    {
      walls: ['#4a3b32', '#3a3230', '#54453a', '#463c34'],
      roof: '#6b4a3f',
      windows: ['#ffd98a', '#ffb35c'],
      windowMod: 4,
      signs: [
        { t: '민박', c: '#ffd98a', b: '#2b2118' },
        { t: '심야분식', c: '#ff9d6b', b: '#2b2118' },
        { t: '달빛 세탁소', c: '#cfe6ff', b: '#232830' },
      ],
      signEvery: (i) => i % 3 === 0,
      signY: 2.4,
      spread: 0,
      minH: 3,
      maxH: 7,
      extra: 'houses',
    },
    {
      walls: ['#2b3242', '#323a4e', '#28303e'],
      roof: '#3d465c',
      windows: ['#bfe3ff', '#9fd0ff'],
      windowMod: 5,
      signs: [
        { t: '도망 IC', c: '#b8e6d9', b: '#14362e' },
        { t: '출구 없음', c: '#ffd23e', b: '#1a1a12' },
        { t: '속도 준수', c: '#ffffff', b: '#1c2c4c' },
      ],
      signEvery: (i) => i % 3 === 0,
      signY: 4.5,
      spread: 4,
      minH: 6,
      maxH: 18,
      extra: 'highway',
    },
    {
      walls: ['#e8e4e4', '#dcd6d6', '#f2eeee', '#d5cfd8'],
      roof: '#b03a52',
      windows: ['#bfe9ff', '#dff4ff'],
      windowMod: 3,
      signs: [
        { t: '응급실', c: '#ff2b65', b: '#ffffff' },
        { t: '입원수속', c: '#193c40', b: '#e8f4f4' },
        { t: '면회 시간외', c: '#ffffff', b: '#8c1f36' },
      ],
      signEvery: (i) => i % 2 === 0,
      signY: 4,
      spread: 0,
      minH: 8,
      maxH: 16,
      extra: 'hospital',
    },
  ];
  function signTexture(s: { t: string; c: string; b: string }) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = s.b;
    x.fillRect(0, 0, 512, 128);
    x.strokeStyle = s.c;
    x.lineWidth = 7;
    x.strokeRect(6, 6, 500, 116);
    x.fillStyle = s.c;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = 'bold 58px "Malgun Gothic",sans-serif';
    x.fillText(s.t, 256, 67, 470);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  // All four variants share one seeded layout so swapping zones never pops positions.
  function buildCityVariant(v: CityLook) {
    const grp = new THREE.Group();
    const wallMats = v.walls.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.7,
          metalness: 0.12,
        }),
    );
    const roofMat = new THREE.MeshStandardMaterial({
      color: v.roof,
      roughness: 0.7,
      metalness: 0.12,
    });
    const winMats = v.windows.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.5,
          metalness: 0.12,
          emissive: c,
          emissiveIntensity: 2,
        }),
    );
    const doorMat = new THREE.MeshStandardMaterial({
      color: '#111626',
      roughness: 0.8,
    });
    const poleMat = new THREE.MeshStandardMaterial({
      color: '#8b779c',
      roughness: 0.7,
    });
    const poleGlow = new THREE.MeshStandardMaterial({
      color: '#ffc4de',
      roughness: 0.5,
      emissive: '#ffc4de',
      emissiveIntensity: 2,
    });
    const crossMat = new THREE.MeshStandardMaterial({
      color: '#ff2b65',
      roughness: 0.5,
      emissive: '#ff2b65',
      emissiveIntensity: 2,
    });
    const fenceMat = new THREE.MeshStandardMaterial({
      color: '#cfd6e3',
      roughness: 0.8,
    });
    const signTexs = v.signs.map(signTexture);
    const R = rng(20260910);
    const part = (
      gg: THREE.Group,
      geo: THREE.BufferGeometry,
      mt: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new THREE.Mesh(geo, mt);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      gg.add(m);
      return m;
    };
    for (let i = 0; i < 52; i++) {
      const side = i % 2 === 0 ? -1 : 1,
        z = -Math.floor(i / 2) * 12 + 18,
        w = 4 + R() * 4,
        h = v.minH + R() * (v.maxH - v.minH),
        x = side * (9 + w / 2 + R() * 3 + v.spread);
      const g = new THREE.Group();
      g.position.z = z;
      grp.add(g);
      part(
        g,
        new THREE.BoxGeometry(w, h, 8),
        wallMats[i % wallMats.length],
        x,
        h / 2,
        0,
      );
      part(g, new THREE.BoxGeometry(w + 0.3, 0.22, 8.3), roofMat, x, h, 0);
      for (let row = 0; row < Math.floor(h / 2.2); row++)
        for (let col = 0; col < 3; col++)
          if ((row + col + i) % v.windowMod !== 0)
            part(
              g,
              new THREE.BoxGeometry(0.55, 1, 0.035),
              winMats[(i + row) % winMats.length],
              x - w / 2 + 0.8 + col * 1.2,
              2 + row * 2.1,
              4.03,
            );
      part(
        g,
        new THREE.BoxGeometry(Math.min(w - 0.6, 2), 2, 0.08),
        doorMat,
        x,
        1.2,
        4.1,
      );
      if (v.signEvery(i)) {
        const sm = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.min(w * 0.96, 4.5), 1.25),
          new THREE.MeshBasicMaterial({
            map: signTexs[i % signTexs.length],
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );
        sm.position.set(x, Math.min(v.signY, h * 0.62), 4.15);
        g.add(sm);
      }
      if (v.extra === 'houses') {
        const roof = part(
          g,
          new THREE.CylinderGeometry(0.12, w * 0.72, 1.7, 4),
          roofMat,
          x,
          h + 0.8,
          0,
        );
        roof.rotation.y = Math.PI / 4;
        part(g, new THREE.BoxGeometry(w, 0.5, 0.08), fenceMat, x, 0.25, 4.3);
      }
      if (v.extra === 'hospital') {
        part(
          g,
          new THREE.BoxGeometry(0.5, 1.2, 0.06),
          crossMat,
          x,
          h * 0.72,
          4.06,
        );
        part(
          g,
          new THREE.BoxGeometry(1.2, 0.5, 0.06),
          crossMat,
          x,
          h * 0.72,
          4.06,
        );
      }
      if (v.extra === 'highway') g.visible = i % 3 === 0;
      part(g, new THREE.BoxGeometry(0.12, 6, 0.12), poleMat, side * 6.8, 3, 0);
      part(g, new THREE.BoxGeometry(1.9, 0.1, 0.12), poleMat, side * 6.2, 6, 0);
      part(
        g,
        new THREE.BoxGeometry(1.1, 0.07, 0.35),
        poleGlow,
        side * 5.8,
        5.95,
        0,
      );
    }
    const matSet = new Set<THREE.Material>();
    grp.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          m.transparent = true;
          matSet.add(m);
        });
      }
    });
    grp.userData.mats = [...matSet];
    return grp;
  }
  const cityGroups = CITY_LOOKS.map(buildCityVariant);
  cityGroups.forEach((g, idx) => {
    g.visible = idx === 0;
    scene.add(g);
  });
  let cityGroup = cityGroups[0],
    fadeFrom: THREE.Group | null = null,
    cityFadeT = -1;
  const CITY_FADE_SECONDS = 2.5;
  function setGroupOpacity(g: THREE.Group, o: number) {
    for (const m of g.userData.mats as THREE.Material[]) m.opacity = o;
  }
  // Instant swap (game start). In-game zone changes use startCityFade for a gradual crossfade.
  function setCityVariant(idx: number) {
    const next = cityGroups[idx];
    for (
      let i = 0;
      i < cityGroup.children.length && i < next.children.length;
      i++
    )
      next.children[i].position.z = cityGroup.children[i].position.z;
    if (fadeFrom && fadeFrom !== next) {
      setGroupOpacity(fadeFrom, 1);
      fadeFrom.visible = false;
    }
    setGroupOpacity(next, 1);
    cityGroup.visible = false;
    next.visible = true;
    cityGroup = next;
    fadeFrom = null;
    cityFadeT = -1;
  }
  function startCityFade(idx: number) {
    const next = cityGroups[idx];
    if (next === cityGroup) return;
    if (fadeFrom) {
      setGroupOpacity(fadeFrom, 1);
      fadeFrom.visible = false;
    }
    fadeFrom = cityGroup;
    cityGroup = next;
    for (let i = 0; i < fadeFrom.children.length; i++)
      next.children[i].position.z = fadeFrom.children[i].position.z;
    setGroupOpacity(next, 0);
    next.visible = true;
    cityFadeT = 0;
  }
  const skyline = new THREE.Group();
  scene.add(skyline);
  for (let i = 0; i < 28; i++) {
    const h = 10 + ((i * 11) % 29);
    box(skyline, 5, h, 8, (i - 14) * 7, h / 2, -145 - (i % 4) * 6, '#35213f');
  }
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(10, 64),
    new THREE.MeshBasicMaterial({ color: '#df8cac', fog: false }),
  );
  moon.position.set(26, 32, -170);
  scene.add(moon);
  const gantry = new THREE.Group();
  gantry.position.z = -76;
  scene.add(gantry);
  for (const x of [-6.3, 6.3]) box(gantry, 0.2, 10, 0.2, x, 5, 0, '#817086');
  box(gantry, 13, 0.2, 0.2, 0, 10, 0, '#817086');
  const zoneCanvas = document.createElement('canvas');
  zoneCanvas.width = 512;
  zoneCanvas.height = 128;
  const zoneCtx = zoneCanvas.getContext('2d')!;
  const zoneTex = new THREE.CanvasTexture(zoneCanvas);
  zoneTex.colorSpace = THREE.SRGBColorSpace;
  function drawZoneSign(text: string) {
    zoneCtx.fillStyle = '#193c40';
    zoneCtx.fillRect(0, 0, 512, 128);
    zoneCtx.strokeStyle = '#b8e6d9';
    zoneCtx.lineWidth = 7;
    zoneCtx.strokeRect(6, 6, 500, 116);
    zoneCtx.fillStyle = '#b8e6d9';
    zoneCtx.textAlign = 'center';
    zoneCtx.textBaseline = 'middle';
    zoneCtx.font = 'bold 44px Pretendard, sans-serif';
    zoneCtx.fillText(text, 256, 67, 470);
    zoneTex.needsUpdate = true;
  }
  drawZoneSign('↑ 도망시     출구 없음');
  const zoneSign = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.8),
    new THREE.MeshBasicMaterial({
      map: zoneTex,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  zoneSign.position.set(0, 8.4, 0.15);
  gantry.add(zoneSign);
  const lamps = new THREE.Group();
  scene.add(lamps);
  const LAMP_COUNT = 14;
  for (let i = 0; i < LAMP_COUNT; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const g = new THREE.Group();
    g.position.set(side * 7.4, 0, 20 - i * 22);
    box(g, 0.14, 6.4, 0.14, 0, 3.2, 0, '#6f6584');
    box(g, 1.6, 0.12, 0.12, -side * 0.8, 6.4, 0, '#6f6584');
    box(g, 0.9, 0.14, 0.5, -side * 1.5, 6.3, 0, '#ffe9b0', true);
    lamps.add(g);
  }
  const LAMP_SPAN = LAMP_COUNT * 22;
  const starGeo = new THREE.BufferGeometry();
  const starArr = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    starArr[i * 3] = (Math.random() - 0.5) * 220;
    starArr[i * 3 + 1] = 22 + Math.random() * 55;
    starArr[i * 3 + 2] = -60 - Math.random() * 120;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starArr, 3));
  scene.add(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: '#cfe6ff',
        size: 0.4,
        transparent: true,
        opacity: 0.8,
        fog: false,
      }),
    ),
  );
  function chevronTex(right: boolean) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#14141c';
    x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#ffd23e';
    x.lineWidth = 10;
    x.strokeRect(8, 8, 240, 112);
    x.fillStyle = '#ffd23e';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = 'bold 62px "Malgun Gothic",sans-serif';
    x.fillText(right ? '▶▶▶' : '◀◀◀', 128, 68, 220);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const chevMatL = new THREE.MeshBasicMaterial({
    map: chevronTex(false),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const chevMatR = new THREE.MeshBasicMaterial({
    map: chevronTex(true),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const chevrons = new THREE.Group();
  scene.add(chevrons);
  chevrons.visible = false;
  const chevBoards: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Group();
    b.position.set(i % 2 === 0 ? -7.2 : 7.2, 0, -15 - i * 16);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), chevMatL);
    p.position.y = 2.6;
    b.add(p);
    box(b, 0.12, 2.1, 0.12, 0, 1.05, 0, '#6f6584');
    chevrons.add(b);
    chevBoards.push(b);
  }
  // Tollgate/IC gate: approaches exactly at the zone boundary, with an exit-ramp fork on the right.
  const gate = new THREE.Group();
  scene.add(gate);
  gate.visible = false;
  let gateZone = '';
  const gateCanvas = document.createElement('canvas');
  gateCanvas.width = 512;
  gateCanvas.height = 160;
  const gateCtx = gateCanvas.getContext('2d')!;
  const gateTex = new THREE.CanvasTexture(gateCanvas);
  gateTex.colorSpace = THREE.SRGBColorSpace;
  function drawGateSign(title: string, sub: string) {
    gateCtx.fillStyle = '#12333a';
    gateCtx.fillRect(0, 0, 512, 160);
    gateCtx.strokeStyle = '#ffd23e';
    gateCtx.lineWidth = 8;
    gateCtx.strokeRect(8, 8, 496, 144);
    gateCtx.fillStyle = '#ffd23e';
    gateCtx.textAlign = 'center';
    gateCtx.font = 'bold 44px "Malgun Gothic",sans-serif';
    gateCtx.fillText(title, 256, 62, 470);
    gateCtx.fillStyle = '#ffffff';
    gateCtx.font = 'bold 52px "Malgun Gothic",sans-serif';
    gateCtx.fillText(sub, 256, 120, 470);
    gateTex.needsUpdate = true;
  }
  drawGateSign('전방 톨게이트', '다음 구역');
  const gateSign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2.4),
    new THREE.MeshBasicMaterial({
      map: gateTex,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  gateSign.position.set(0, 8.2, 0);
  gate.add(gateSign);
  for (const x of [-6.3, 6.3]) box(gate, 0.24, 10, 0.24, x, 5, 0, '#817086');
  box(gate, 13.4, 0.24, 0.24, 0, 10, 0, '#817086');
  for (const bz of [-6, 2]) {
    box(gate, 2.2, 2.4, 3, -8.4, 1.2, bz, '#2d3049');
    box(gate, 2.6, 0.25, 3.4, -8.4, 2.5, bz, '#544566');
    box(gate, 1.6, 0.9, 0.06, -7.25, 1.5, bz, '#ffd98a', true);
  }
  const ramp = box(gate, 3.2, 0.12, 46, 10.5, 0.02, -14, '#23232f');
  ramp.rotation.y = -0.2;
  box(gate, 0.6, 0.3, 40, 6.9, 0.15, -14, '#3a3f4a');
  box(gate, 0.64, 0.08, 40, 6.9, 0.34, -14, '#e3b765', true);
  for (let i = 0; i < 3; i++) {
    const cp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.65), chevMatR);
    cp.position.set(9.8 + i * 1.2, 1.4, -8 - i * 12);
    cp.rotation.y = -0.2;
    gate.add(cp);
  }
  function vehicle(color: string, ambulance = false) {
    const g = new THREE.Group();
    const wheels: THREE.Mesh[] = [];
    box(g, 2.1, 0.6, ambulance ? 4.8 : 4.1, 0, 0.65, 0, color);
    box(
      g,
      ambulance ? 2.05 : 1.8,
      ambulance ? 1.75 : 0.85,
      ambulance ? 3.7 : 2.1,
      0,
      ambulance ? 1.75 : 1.36,
      ambulance ? 0.45 : 0.15,
      color,
    );
    box(
      g,
      1.75,
      0.65,
      0.045,
      0,
      ambulance ? 1.65 : 1.4,
      ambulance ? -1.46 : -0.92,
      '#233a56',
    );
    if (!ambulance) box(g, 1.7, 0.55, 0.045, 0, 1.38, 1.22, '#34435e');
    for (const x of [-1.04, 1.04])
      for (const z of [-1.3, 1.3]) {
        const tire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.24, 12),
          mat('#11101b'),
        );
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.43, z);
        g.add(tire);
        wheels.push(tire);
        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.21, 0.21, 0.25, 12),
          mat('#9a99ae'),
        );
        hub.rotation.z = Math.PI / 2;
        hub.position.copy(tire.position);
        g.add(hub);
      }
    g.userData.wheels = wheels;
    for (const x of [-0.68, 0.68]) {
      box(
        g,
        0.44,
        0.2,
        0.06,
        x,
        0.82,
        -(ambulance ? 2.44 : 2.09),
        '#fff2c4',
        true,
      );
      box(
        g,
        0.35,
        0.16,
        0.04,
        x,
        0.85,
        ambulance ? 2.44 : 2.09,
        '#fc4475',
        true,
      );
    }
    if (ambulance) {
      for (const x of [-1.035, 1.035]) {
        box(g, 0.04, 0.25, 4.7, x, 1.05, 0, '#f54c85');
        box(g, 0.04, 0.8, 0.23, x, 1.9, 0.4, '#fd477c');
        box(g, 0.04, 0.23, 0.8, x, 1.9, 0.4, '#fd477c');
      }
      box(g, 1.4, 0.12, 0.55, 0, 2.68, -0.7, '#13192b');
      const red = box(g, 0.55, 0.23, 0.5, -0.39, 2.84, -0.7, '#ff2b65', true),
        blue = box(g, 0.55, 0.23, 0.5, 0.39, 2.84, -0.7, '#4894ff', true);
      g.userData.lights = [red, blue];
      const doors = [];
      for (const side of [-1, 1]) {
        const p = new THREE.Group();
        p.position.set(side * 1.025, 1.65, 2.32);
        box(p, 1, 0.0 + 1.65, 0.09, -side * 0.5, 0, 0, '#eee5eb');
        box(p, 0.65, 0.5, 0.1, -side * 0.5, 0.3, 0.06, '#243247');
        doors.push(p);
        g.add(p);
      }
      g.userData.doors = doors;
      box(g, 1.8, 1.45, 0.07, 0, 1.65, 2.26, '#161124');
      label(g, '119', 0, 0.65, 2.48, 1.2, 0.4, '#ff78a0', '#eae2eb');
    }
    return g;
  }
  const player = createMenhera();
  scene.add(player);
  const ambulance = vehicle('#f1e8f0', true);
  ambulance.position.set(3, 0, 35);
  scene.add(ambulance);
  const helicopter = new THREE.Group();
  box(helicopter, 2.55, 0.72, 1.35, 0, 0, 0, '#34405f');
  box(helicopter, 1.6, 0.55, 0.9, 0, 0.58, 0, '#43597d');
  box(helicopter, 1.25, 0.32, 0.04, 0, 0.58, -0.47, '#8de7f1', true);
  box(helicopter, 0.42, 0.22, 0.06, -1.46, 0.04, 0, '#27304d');
  box(helicopter, 2.2, 0.08, 0.12, -1.95, 0.28, 0, '#27304d');
  box(helicopter, 0.08, 0.08, 0.9, -3.03, 0.28, 0, '#27304d');
  const rotor = new THREE.Group();
  box(rotor, 3.9, 0.045, 0.08, 0, 0.99, 0, '#eab6e3', true);
  rotor.rotation.y = 0.25;
  helicopter.add(rotor);
  const tailRotor = new THREE.Group();
  box(tailRotor, 0.75, 0.04, 0.05, -3.02, 0.32, 0, '#ff74b2', true);
  box(tailRotor, 0.04, 0.75, 0.05, -3.02, 0.32, 0, '#ff74b2', true);
  helicopter.add(tailRotor);
  helicopter.visible = false;
  helicopter.position.set(0, 2.15, -70);
  scene.add(helicopter);
  const cops: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const c = createCop();
    c.visible = false;
    c.position.set(i % 2 === 0 ? -2.7 : 2.7, 0, 3 + Math.floor(i / 2) * 2);
    scene.add(c);
    cops.push(c);
  }
  const taserPolice = createCop();
  taserPolice.visible = false;
  scene.add(taserPolice);
  const taser = new THREE.Group();
  box(taser, 0.12, 0.12, 1.35, 0, 0, 0, '#f9dd57', true);
  box(taser, 0.28, 0.2, 0.2, 0, 0, 0, '#fff0a0', true);
  taser.rotation.x = Math.PI / 2;
  taser.visible = false;
  scene.add(taser);
  const stretcher = new THREE.Group();
  box(stretcher, 1.05, 0.18, 2.5, 0, 0.8, 0, '#c7b7c9');
  box(stretcher, 0.95, 0.13, 2.3, 0, 0.97, 0, '#ffa0bd');
  for (const x of [-0.4, 0.4])
    for (const z of [-0.8, 0.8]) {
      box(stretcher, 0.07, 0.6, 0.07, x, 0.46, z, '#a8a7bb');
      box(stretcher, 0.15, 0.18, 0.23, x, 0.12, z, '#181720');
    }
  stretcher.visible = false;
  scene.add(stretcher);
  const cars: { mesh: THREE.Group; hit: boolean; previousZ: number }[] = [];
  const colors = [
    '#f588b6',
    '#7e8fdb',
    '#c6c5d3',
    '#46a9bb',
    '#d9a374',
    '#8b6caa',
  ];
  for (let i = 0; i < 12; i++) {
    const v = vehicle(colors[i % colors.length]);
    v.position.set((((i * 7) % 3) - 1) * 3.65, 0, -22 - i * 17);
    scene.add(v);
    cars.push({ mesh: v, hit: false, previousZ: v.position.z });
  }
  const drunkMesh = vehicle('#c2540a');
  drunkMesh.visible = false;
  label(drunkMesh, '음주', 0, 2.35, 0, 1.6, 0.55, '#ffd23e', '#1a1a12');
  drunkMesh.userData.beacon = box(
    drunkMesh,
    1.1,
    0.16,
    0.4,
    0,
    2,
    0.08,
    '#ff8c00',
    true,
  );
  scene.add(drunkMesh);
  const speederMesh = vehicle('#e5484d');
  speederMesh.visible = false;
  scene.add(speederMesh);
  const wrongwayMesh = vehicle('#dfe3ee');
  wrongwayMesh.visible = false;
  wrongwayMesh.rotation.y = Math.PI;
  {
    const wl = label(
      wrongwayMesh,
      '역주행',
      0,
      2.35,
      0,
      1.8,
      0.6,
      '#ffd23e',
      '#1a1a12',
    );
    wl.rotation.y = Math.PI;
  }
  scene.add(wrongwayMesh);
  const wrecks: {
    mesh: THREE.Group;
    beacon: THREE.Mesh;
    active: boolean;
    consumed: boolean;
    t: number;
    previousZ: number;
  }[] = [];
  for (let i = 0; i < 3; i++) {
    const w = vehicle('#3a3f4a');
    w.visible = false;
    const beacon = box(w, 1.2, 0.18, 0.5, 0, 1.95, 0, '#ff8c00', true);
    scene.add(w);
    wrecks.push({
      mesh: w,
      beacon,
      active: false,
      consumed: false,
      t: 0,
      previousZ: 0,
    });
  }
  function spawnWreck(x: number, z: number) {
    explode(x, z);
    const w = wrecks.find((v) => !v.active);
    if (!w) return;
    w.active = true;
    w.consumed = false;
    w.t = 0;
    w.previousZ = z;
    w.mesh.position.set(x, 0, z);
    w.mesh.rotation.set(
      0,
      (Math.random() - 0.5) * 0.7,
      Math.random() < 0.5 ? -0.14 : 0.14,
    );
    w.mesh.visible = true;
  }
  const dustGeometry = new THREE.BufferGeometry();
  const dustArray = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) {
    dustArray[i * 3] = (Math.random() - 0.5) * 36;
    dustArray[i * 3 + 1] = Math.random() * 14;
    dustArray[i * 3 + 2] = -Math.random() * 100;
  }
  dustGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(dustArray, 3),
  );
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: '#ffb1df',
      size: 0.055,
      transparent: true,
      opacity: 0.65,
    }),
  );
  scene.add(dust);
  let state: GameSnapshot = {
    stage: 1,
    progress: 0,
    boost: 100,
    boosting: false,
    item: null,
    police: 0,
    route: 'left',
    cleared: false,
    mode: 'story',
    boss: null,
    worldEvent: null,
    phase: 'ready',
    hits: 0,
    speed: 22,
    distance: 0,
    best: 0,
    elapsed: 0,
    flash: '',
    ambulance: 35,
    lane: 0,
    jumping: false,
    jumpHeight: 0,
    martialLaw: false,
    helicopter: false,
    taser: false,
    zone: zoneForDistance(0).spec.name,
    curve: false,
    mapItems: [],
  };
  try {
    state.best = Number(localStorage.getItem('closed-run-v4-story-best')) || 0;
  } catch {}
  let lane = 0,
    invuln = 0,
    flashTime = 0,
    captureTime = 0,
    clock = 0,
    lastTime = performance.now(),
    raf = 0,
    publishTimer = 0,
    muted = false,
    disposed = false,
    shake = 0,
    jumpHeight = 0,
    jumpVelocity = 0,
    taserTimer = 0,
    taserActive = false,
    taserLane = 0,
    taserPreviousZ = 0,
    helicopterActive = false,
    helicopterPreviousZ = -70,
    zoneIndex = -1,
    curveDir = 0,
    curveT = 0,
    nextCurveAt = 30;
  let nextDrunkAt = 0,
    nextSpeedAt = 40,
    nextWrongAt = 90,
    drunkActive = false,
    drunkT = 0,
    drunkBaseX = 0,
    drunkPrevZ = 0,
    speedStage = 0,
    speedT = 0,
    speedLane = 0,
    speedPrevZ = 0,
    wrongActive = false,
    wrongT = 0,
    wrongVictim = -1,
    wrongPrevZ = 0;
  const zoneFog = new THREE.Color(zoneForDistance(0).spec.fog),
    zoneSky = new THREE.Color(zoneForDistance(0).spec.sky),
    zoneGround = new THREE.Color(zoneForDistance(0).spec.ground),
    zoneLampA = new THREE.Color(zoneForDistance(0).spec.lampA),
    zoneLampB = new THREE.Color(zoneForDistance(0).spec.lampB);
  // Phase soundtrack; level changes within a phase preserve playback position.
  const embeddedTracks =
    typeof __ZWF_AUDIO_SONG1__ === 'string'
      ? [
          __ZWF_AUDIO_SONG1__,
          __ZWF_AUDIO_CLOSED_RUN__!,
          __ZWF_AUDIO_P2__!,
          __ZWF_AUDIO_P3__!,
          __ZWF_AUDIO_BOSSFINAL__!,
        ]
      : null;
  const TRACK_URLS =
    embeddedTracks ??
    SOUNDTRACK_NAMES.map((p) => new URL('audio/' + p, document.baseURI).href);
  let trackIndex = 0;
  const bgm = new Audio(TRACK_URLS[0]);
  bgm.preload = 'auto';
  bgm.volume = 0.42;
  const playBgm = () => {
    bgm.muted = muted;
    void bgm.play().catch(() => {});
  };
  const playTrack = (i: number, volume: number) => {
    trackIndex =
      ((i % TRACK_URLS.length) + TRACK_URLS.length) % TRACK_URLS.length;
    if (bgm.src !== TRACK_URLS[trackIndex]) {
      bgm.src = TRACK_URLS[trackIndex];
      bgm.currentTime = 0;
    }
    bgm.volume = volume;
    playBgm();
  };
  const nextTrack = () => {
    if (!disposed && state.phase !== 'paused' && state.phase !== 'over')
      playTrack(soundtrackForStage(state.stage), bgm.volume);
  };
  bgm.addEventListener('ended', nextTrack);
  let audio: AudioContext | null = null,
    master: GainNode | null = null,
    siren: OscillatorNode | null = null,
    sirenGain: GainNode | null = null;
  function initAudio() {
    try {
      if (!audio) {
        audio = new AudioContext();
        master = audio.createGain();
        master.gain.value = muted ? 0 : 0.22;
        master.connect(audio.destination);
        siren = audio.createOscillator();
        siren.type = 'sine';
        sirenGain = audio.createGain();
        sirenGain.gain.value = 0;
        siren.connect(sirenGain);
        sirenGain.connect(master);
        siren.start();
      }
      void audio.resume();
    } catch {}
  }
  function beep(freq: number, duration = 0.12) {
    if (!audio || !master) return;
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq / 2,
      audio.currentTime + duration,
    );
    g.gain.setValueAtTime(0.3, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(audio.currentTime + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  function playTitleBgm() {
    playTrack(0, 0.35);
  }
  playTitleBgm();
  const emit = () => {
    const mapItems: MapItem[] = [];
    for (const c of cars) {
      if (c.mesh.position.z < 18 && c.mesh.position.z > -72)
        mapItems.push({
          kind: 'car',
          lane: Math.round(c.mesh.position.x / 3.65),
          z: c.mesh.position.z,
        });
    }
    if (taserActive)
      mapItems.push({ kind: 'taser', lane: taserLane, z: taser.position.z });
    if (helicopterActive)
      mapItems.push({
        kind: 'helicopter',
        lane: Math.round(helicopter.position.x / 3.65),
        z: helicopter.position.z,
      });
    if (taserPolice.visible)
      mapItems.push({
        kind: 'police',
        lane: taserLane,
        z: taserPolice.position.z,
      });
    for (const m of [drunkMesh, speederMesh, wrongwayMesh])
      if (m.visible)
        mapItems.push({
          kind: 'car',
          lane: Math.round(m.position.x / 3.65),
          z: m.position.z,
        });
    for (const w of wrecks)
      if (w.active)
        mapItems.push({
          kind: 'car',
          lane: Math.round(w.mesh.position.x / 3.65),
          z: w.mesh.position.z,
        });
    onState({
      ...state,
      lane,
      jumping: jumpHeight > 0.02,
      jumpHeight,
      martialLaw: shouldActivateMartialLaw(state.elapsed, state.hits),
      helicopter: helicopterActive,
      taser: taserActive,
      mapItems,
    });
  };
  function readBest(mode: RunMode) {
    try {
      const value = Number(localStorage.getItem('closed-run-v4-' + mode + '-best'));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch { return 0; }
  }
  function start(seed?: number) {
    endingTime = 0;
    bossEncounter.reset();
    worldEvents.reset();
    worldVisual.update(null);
    worldSpeedMultiplier = worldJumpMultiplier = 1;
    defeatedBosses.clear();
    randomState = (seed ?? Math.floor(random() * 2147483647)) >>> 0;
    dashTime = 0;
    empTime = 0;
    shield = false;
    lastStage = 1;
    nextPickup = 30;
    for (const e of explosions) e.mesh.visible = false;
    for (const b of bombs) b.mesh.visible = false;
    for (const p of pickups) p.mesh.visible = false;
    for (const h of hazards) h.mesh.visible = false;
    initAudio();
    bgm.currentTime = 0;
    playTrack(0, 0.42);
    state = {
      ...state,
      stage: 1,
      progress: 0,
      boost: 100,
      boosting: false,
      item: null,
      police: 0,
      route: 'left',
      cleared: false,
      mode: 'story',
      best: readBest('story'),
      boss: null,
    worldEvent: null,
      ending: undefined,
      phase: 'running',
      hits: 0,
      speed: 22,
      distance: 0,
      elapsed: 0,
      flash: '',
      ambulance: 35,
      lane: 0,
      jumping: false,
      jumpHeight: 0,
      martialLaw: false,
      helicopter: false,
      taser: false,
      zone: zoneForDistance(0).spec.name,
      curve: false,
      captureReason: undefined,
      mapItems: [],
    };
    lane = 0;
    invuln = 1;
    captureTime = 0;
    flashTime = 0;
    shake = 0;
    jumpHeight = 0;
    jumpVelocity = 0;
    taserTimer = 0;
    taserActive = false;
    helicopterActive = false;
    zoneIndex = -1;
    setCityVariant(0);
    roadScenery.enter(stageAt(0).map);
    curveDir = 0;
    curveT = 0;
    nextCurveAt = 30 + random() * 15;
    chevrons.visible = false;
    (scene.fog as THREE.FogExp2).density = 0.015;
    drunkActive = false;
    drunkMesh.visible = false;
    speedStage = 0;
    speederMesh.visible = false;
    nextSpeedAt = 40;
    wrongActive = false;
    wrongwayMesh.visible = false;
    nextWrongAt = 90;
    nextDrunkAt = 0;
    gate.visible = false;
    gateZone = '';
    for (const w of wrecks) {
      w.active = false;
      w.mesh.visible = false;
    }
    drawZoneSign('↑ 도망시     출구 없음');
    zoneFog.set(zoneForDistance(0).spec.fog);
    zoneSky.set(zoneForDistance(0).spec.sky);
    zoneGround.set(zoneForDistance(0).spec.ground);
    groundMat.color.set(zoneForDistance(0).spec.ground);
    zoneLampA.set(zoneForDistance(0).spec.lampA);
    zoneLampB.set(zoneForDistance(0).spec.lampB);
    player.visible = true;
    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);
    player.scale.setScalar(1);
    ambulance.visible = true;
    ambulance.position.set(3, 0, 35);
    ambulance.rotation.set(0, 0, 0);
    for (const d of ambulance.userData.doors) d.rotation.y = 0;
    helicopter.visible = false;
    taser.visible = false;
    taserPolice.visible = false;
    taserPolice.rotation.set(0, Math.PI, 0);
    stretcher.visible = false;
    cops.forEach((c) => {
      c.visible = false;
      c.rotation.set(0, 0, 0);
    });
    cars.forEach((c, i) => {
      c.mesh.position.set((((i * 7) % 3) - 1) * 3.65, 0, -24 - i * 18);
      c.hit = false;
      c.previousZ = c.mesh.position.z;
    });
    camera.position.set(0, 7, 13);
    beep(720);
    emit();
  }
  function pause() {
    if (state.phase === 'running') {
      state.phase = 'paused';
      bgm.pause();
    } else if (state.phase === 'paused') {
      state.phase = 'running';
      initAudio();
      playBgm();
    }
    emit();
  }
  function move(dir: number) {
    if (state.phase !== 'running') return;
    lane = clampLane(lane + dir);
    state.lane = lane;
    beep(300, 0.045);
  }
  function jump() {
    if (state.phase !== 'running' || jumpHeight > 0) return;
    jumpVelocity = 8.2 * worldJumpMultiplier;
    beep(540, 0.08);
  }
  function hit() {
    if (dashTime > 0) return;
    if (shield && invuln <= 0 && state.phase === 'running') {
      shield = false;
      invuln = HIT_GRACE;
      state.flash = '보호막이 충격을 흡수했다!';
      flashTime = 2;
      return;
    }
    const next = nextHit(state.hits, invuln, state.phase);
    if (!next) return;
    state.hits = next.hits;
    state.phase = next.phase;
    state.captureReason = 'ambulance';
    invuln = HIT_GRACE;
    shake = 0.45;
    flashTime = 1.5;
    state.flash = [
      '',
      '아야! 짭새 +1',
      '다리야… 일 좀 해!',
      '사이렌이 너무 가까운데?',
      '지금 바로 입원!',
    ][state.hits];
    beep(130, 0.4);
    cops[state.hits - 1].visible = true;
    if (state.phase === 'capture') {
      bgm.volume = 0.2;
      captureTime = 0;
      state.best = Math.max(state.best, state.distance);
      try {
        localStorage.setItem('closed-run-v4-' + state.mode + '-best', String(Math.floor(state.best)));
      } catch {}
    }
    emit();
  }
  function helicopterHit() {
    if (state.phase !== 'running' || dashTime > 0 || empTime > 0) return;
    state.phase = 'capture';
    state.captureReason = 'helicopter';
    state.helicopter = false;
    helicopterActive = false;
    helicopter.visible = false;
    state.flash = '공군 출동! 헬기로 입원합니다.';
    flashTime = 4;
    captureTime = 0;
    shake = 0.8;
    bgm.volume = 0.2;
    state.best = Math.max(state.best, state.distance);
    beep(75, 0.8);
    try {
      localStorage.setItem('closed-run-v4-' + state.mode + '-best', String(Math.floor(state.best)));
    } catch {}
    emit();
  }

  let dashTime = 0,
    empTime = 0,
    shield = false,
    lastStage = 1,
    nextPickup = 30;
  let rival: { lane: number; distance: number } | null = null;
  const ghost = createMenhera();
  ghost.scale.setScalar(0.9);
  ghost.visible = false;
  scene.add(ghost);
  label(ghost, 'RIVAL', 0, 3, 0, 2, 0.5, '#46ccff');
  const explosions = Array.from({ length: 12 }, () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({
        color: '#ff852b',
        transparent: true,
        opacity: 0.8,
        wireframe: true,
      }),
    );
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, life: 0 };
  });
  const bombs = Array.from({ length: 4 }, () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      mat('#FFD600', true),
    );
    mesh.visible = false;
    scene.add(mesh);
    return { mesh };
  });
  const pickups = Array.from({ length: 6 }, () => {
    const mesh = new THREE.Group();
    box(mesh, 0.8, 0.8, 0.8, 0, 1, 0, '#EC008C', true);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, item: 'boost' as Item };
  });
  const hazards = Array.from({ length: 4 }, () => {
    const mesh = new THREE.Group();
    box(mesh, 2.4, 0.65, 0.5, 0, 0.35, 0, '#FFD600');
    box(mesh, 2.4, 0.12, 0.6, 0, 0.65, 0, '#101820');
    mesh.visible = false;
    scene.add(mesh);
    return { mesh };
  });
  function burst(x: number, z: number, color = '#ff852b') {
    const e = explosions.find((v) => !v.mesh.visible) ?? explosions[0];
    e.life = 0.65;
    e.mesh.material.color.set(color);
    e.mesh.position.set(x, 1, z);
    e.mesh.scale.setScalar(0.2);
    e.mesh.visible = true;
    shake = Math.max(shake, 0.6);
    beep(80, 0.35);
  }
  function explode(x: number, z: number) {
    burst(x, z);
    if (blastHits(player.position.x, 0, x, z)) hit();
    for (const c of cars) {
      if (
        c.mesh.visible &&
        !c.hit &&
        blastHits(c.mesh.position.x, c.mesh.position.z, x, z, 4)
      ) {
        c.hit = true;
        c.mesh.visible = false;
      }
    }
  }
  function boost() {
    if (state.phase !== 'running' || state.boost < 100 || dashTime > 0) return;
    state.boost = 0;
    dashTime = 1.1;
    state.boosting = true;
    if (state.boss && !state.boss.defeated) {
      attackBoss(4);
      invuln = Math.max(invuln, 1.1);
      emit();
      return;
    }
    if (state.worldEvent?.kinds.includes('portal')) {
      lane = state.worldEvent.safeLane;
      player.position.x = lane * 3.65;
      invuln = Math.max(invuln, 1.1);
      state.flash = '순간이동! 안전 차선으로 돌진';
      flashTime = 1.5;
      emit();
      return;
    }
    state.distance = dashDestination(state.distance, state.mode);
    state.best = Math.max(state.best, state.distance);
    state.flash = '돌진! 다음 스테이지로 돌파';
    flashTime = 2;
    beep(980, 0.3);
    emit();
  }
  function useItem() {
    if (state.phase !== 'running' || !state.item) return;
    const item = state.item;
    state.item = null;
    state.flash = ITEM_LABELS[item] + ' 사용!';
    flashTime = 2;
    if (item === 'boost') state.boost = 100;
    if (item === 'shield') shield = true;
    if (item === 'medkit') state.hits = Math.max(0, state.hits - 1);
    if (item === 'emp') {
      empTime = 10;
      for (const c of cops)
        if (c.visible) {
          burst(c.position.x, c.position.z, '#00BCF2');
          c.visible = false;
        }
      if (taserPolice.visible)
        burst(taserPolice.position.x, taserPolice.position.z, '#00BCF2');
      if (helicopter.visible)
        burst(helicopter.position.x, helicopter.position.z, '#00BCF2');
      state.police = 0;
      state.flash = '경찰 부대 파괴! 지원 병력까지 10초';
      taserActive = false;
      taser.visible = false;
      taserPolice.visible = false;
      helicopterActive = false;
      helicopter.visible = false;
    }
    if (item === 'destroy') {
      invuln = Math.max(invuln, 0.8);
      for (const c of cars)
        if (
          c.mesh.visible &&
          c.mesh.position.z > -22 &&
          c.mesh.position.z < 5
        ) {
          c.hit = true;
          c.mesh.visible = false;
          explode(c.mesh.position.x, c.mesh.position.z);
        }
      for (const h of hazards)
        if (h.mesh.position.z > -22) h.mesh.visible = false;
    }
    if (
      state.boss &&
      !state.boss.defeated &&
      ['destroy', 'throw', 'emp'].includes(item)
    )
      attackBoss(item === 'emp' ? 5 : 4);
    if (item === 'throw') {
      const bomb = bombs.find((b) => !b.mesh.visible);
      if (bomb) {
        bomb.mesh.position.set(lane * 3.65, 1.2, -1);
        bomb.mesh.visible = true;
      }
    }
    emit();
  }
  function attackBoss(power = 1) {
    if (state.phase !== 'running' || !state.boss || state.boss.defeated) return;
    const landed = bossEncounter.attack(lane, power);
    state.boss = bossEncounter.snapshot();
    if (landed) {
      beep(850, 0.08);
      state.flash = '명중!';
      flashTime = 0.4;
    }
    if (state.boss?.defeated) {
      defeatedBosses.add(state.stage);
      state.flash = state.boss.name + ' 격파! 다음 구간으로';
      flashTime = 3;
      state.boost = 100;
      invuln = 2;
      ambulance.visible = true;
      nextCurveAt = state.elapsed + 30;
    }
    emit();
  }
  function continueEndless() {
    if (!state.cleared || state.mode !== 'story' || state.ending !== 'done') return;
    start();
    state.mode = 'endless';
    state.best = readBest('endless');
    state.distance = CLEAR_DISTANCE;
    state.best = Math.max(state.best, CLEAR_DISTANCE);
    state.stage = MAX_STAGE + 1;
    lastStage = MAX_STAGE + 1;
    state.flash = '무한모드 · 끝없이 달려라!';
    flashTime = 3;
    emit();
  }
  function tickMechanics(dt: number) {
    dashTime = Math.max(0, dashTime - dt);
    empTime = Math.max(0, empTime - dt);
    state.boosting = dashTime > 0;
    state.boost = Math.min(100, state.boost + dt * 3.5);
    if (state.stage !== lastStage) {
      if (dashTime <= 0) {
        const fork = forkChoice(lane);
        state.route = fork.route;
        if (fork.collision) {
          hit();
          lane = -1;
          state.flash = '분기 중앙 추돌 · 왼쪽 경로';
          flashTime = 2;
        }
      }
      lastStage = state.stage;
    }
    const info = stageAt(state.distance, state.route, state.mode);
    state.police = empTime > 0 ? 0 : Math.min(8, state.hits * info.map.police);
    if (info.complete && state.phase === 'running') {
      state.distance = CLEAR_DISTANCE;
      state.phase = 'over';
      state.cleared = true;
      state.ending = 'hospital';
      state.zone = '정신병원 · 퇴원 수속';
      state.boosting = false;
      endingTime = 0;
      endingSequence ??= createEndingSequence();
      endingSequence.update(0, camera.aspect);
      state.progress = 1;
      state.speed = 0;
      bgm.pause();
      if (audio && sirenGain)
        sirenGain.gain.setTargetAtTime(0, audio.currentTime, 0.05);
      try {
        localStorage.setItem('closed-run-v4-' + state.mode + '-best', String(state.distance));
      } catch {}
      emit();
      return;
    }
    if (state.distance >= nextPickup) {
      nextPickup = state.distance + 70;
      const p = pickups.find((p) => !p.mesh.visible);
      if (p) {
        p.item = (Object.keys(ITEM_LABELS) as Item[])[Math.floor(random() * 6)];
        p.mesh.position.set((Math.floor(random() * 3) - 1) * 3.65, 0, -55);
        p.mesh.visible = true;
        const old = p.mesh.children.find((c) => c.userData.itemLabel);
        if (old) {
          p.mesh.remove(old);
          const m = old as THREE.Mesh;
          m.geometry.dispose();
          const material = m.material as THREE.MeshBasicMaterial;
          material.map?.dispose();
          material.dispose();
        }
        const tag = label(p.mesh, ITEM_LABELS[p.item], 0, 2, 0, 2.8, 0.65);
        tag.userData.itemLabel = true;
      }
      if (
        info.map.hazard !== 'traffic' &&
        (!state.boss || state.boss.defeated) && !state.worldEvent
      ) {
        const h = hazards.find((h) => !h.mesh.visible);
        if (h) {
          h.mesh.position.set((Math.floor(random() * 3) - 1) * 3.65, 0, -85);
          h.mesh.visible = true;
        }
      }
    }
    for (const p of pickups) {
      if (!p.mesh.visible) continue;
      const prev = p.mesh.position.z;
      p.mesh.position.z += state.speed * dt;
      p.mesh.rotation.y += dt;
      if (
        collides(
          player.position.x,
          p.mesh.position.x,
          prev,
          p.mesh.position.z,
        ) &&
        !state.item
      ) {
        state.item = p.item;
        p.mesh.visible = false;
        state.flash = ITEM_LABELS[p.item] + ' 획득 · E로 사용';
        flashTime = 2;
        beep(800);
      }
      if (p.mesh.position.z > 15) p.mesh.visible = false;
    }
    for (const h of hazards) {
      if (!h.mesh.visible) continue;
      const prev = h.mesh.position.z;
      h.mesh.position.z += state.speed * dt;
      if (
        collides(
          player.position.x,
          h.mesh.position.x,
          prev,
          h.mesh.position.z,
        ) &&
        jumpHeight < 0.8
      ) {
        hit();
        h.mesh.visible = false;
      }
      if (h.mesh.position.z > 15) h.mesh.visible = false;
    }
    for (const b of bombs) {
      if (!b.mesh.visible) continue;
      const previous = b.mesh.position.z;
      b.mesh.position.z -= 65 * dt;
      b.mesh.position.y = 1.2 + Math.sin(-b.mesh.position.z * 0.05) * 1.5;
      const target = cars.find(
        (c) =>
          c.mesh.visible &&
          !c.hit &&
          Math.abs(c.mesh.position.x - b.mesh.position.x) < 1.5 &&
          c.mesh.position.z <= previous + 2 &&
          c.mesh.position.z >= b.mesh.position.z - 2,
      );
      if (target || b.mesh.position.z < -60) {
        explode(
          b.mesh.position.x,
          target?.mesh.position.z ?? b.mesh.position.z,
        );
        b.mesh.visible = false;
      }
    }
    for (const e of explosions) {
      if (!e.mesh.visible) continue;
      e.life -= dt;
      e.mesh.position.z += state.speed * dt;
      e.mesh.scale.setScalar(1 + (1 - e.life / 0.65) * 6);
      e.mesh.material.opacity = Math.max(0, e.life);
      if (e.life <= 0) e.mesh.visible = false;
    }
    ghost.visible = !!rival && Math.abs(rival.distance - state.distance) < 70;
    if (rival) {
      ghost.position.set(rival.lane * 3.65, 0, state.distance - rival.distance);
      animateRunner(ghost, clock, 1);
    }
  }
  const targetCamera = new THREE.Vector3(),
    lookTarget = new THREE.Vector3();
  function animate(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.04);
    lastTime = now;
    if (state.cleared && endingSequence) {
      endingTime = Math.min(ENDING_DURATION, endingTime + dt);
      const beat = endingSequence.update(endingTime, camera.aspect);
      if (state.ending !== beat) {
        state.ending = beat;
        emit();
      }
      renderer.render(endingSequence.scene, endingSequence.camera);
      return;
    }
    const running = state.phase === 'running',
      capturing = state.phase === 'capture';
    if (state.phase !== 'paused') clock += dt;
    if (running) {
      state.elapsed += dt;
      const trigger =
        state.mode === 'story'
          ? [55, 70].find(
              (stage) =>
                !defeatedBosses.has(stage) &&
                state.distance >= (stage - 1) * STAGE_LENGTH,
            )
          : undefined;
      if (trigger && (!state.boss || state.boss.defeated)) {
        state.distance = (trigger - 1) * STAGE_LENGTH;
        state.stage = trigger;
        state.boss = bossEncounter.start(bossAt(trigger)!);
        state.flash = state.boss.name + ' 등장 · 같은 차선에서 F로 반격!';
        flashTime = 4;
        invuln = 2;
        dashTime = 0;
        lastStage = trigger;
        lane = -1;
        cars.forEach((car) => (car.mesh.visible = false));
        hazards.forEach((h) => (h.mesh.visible = false));
        cops.forEach((c) => (c.visible = false));
        taserActive = false;
        taser.visible = false;
        taserPolice.visible = false;
        helicopterActive = false;
        helicopter.visible = false;
        drunkActive = false;
        drunkMesh.visible = false;
        speedStage = 0;
        speederMesh.visible = false;
        wrongActive = false;
        wrongwayMesh.visible = false;
        wrecks.forEach((w) => {
          w.active = false;
          w.mesh.visible = false;
        });
        curveDir = 0;
        chevrons.visible = false;
        gate.visible = false;
        ambulance.visible = false;
      }
      if (state.boss && !state.boss.defeated) {
        bossEncounter.tick(dt, lane, jumpHeight, () => hit());
        state.boss = bossEncounter.snapshot();
      }
      state.distance = Math.min(
        state.mode === 'endless' ? Number.MAX_SAFE_INTEGER : CLEAR_DISTANCE,
        state.distance +
          (state.boss && !state.boss.defeated ? 0 : state.speed * dt),
      );
      roadScenery.tick(state.speed * dt);
      state.best = Math.max(state.best, state.distance);
      state.stage = stageAt(state.distance, state.route, state.mode).stage;
      // Carry an event's safe-center promise through the next fork.
      if (state.stage !== lastStage && lane === 0 && state.worldEvent?.safeLane === 0) {
        lane = -1;
        player.position.x = lane * 3.65;
      }
      const world = worldEvents.update({ dt, stage: state.stage, distance: state.distance,
        lane, jumpHeight, boosting: dashTime > 0, suspended: !!state.boss && !state.boss.defeated });
      state.worldEvent = world.state;
      worldVisual.update(world.state, dt);
      worldSpeedMultiplier = world.speedMultiplier;
      worldJumpMultiplier = world.jumpMultiplier;
      if (world.teleportLane !== null) { lane = world.teleportLane; player.position.x = lane * 3.65; }
      state.boost = Math.min(100, state.boost + world.bonusBoost);
      if (world.state) {
        // The marked safe lane is a promise: unrelated traffic cannot hit it.
        cars.forEach(c => { c.mesh.visible = false; c.mesh.position.z = -85; });
        hazards.forEach(h => h.mesh.visible = false);
        cops.forEach(c => c.visible = false);
        wrecks.forEach(w => { w.active = false; w.mesh.visible = false; });
        taserActive = false; taser.visible = false; taserPolice.visible = false;
        helicopterActive = false; helicopter.visible = false;
        drunkActive = false; drunkMesh.visible = false;
        speedStage = 0; speederMesh.visible = false;
        wrongActive = false; wrongwayMesh.visible = false;
        curveDir = 0; chevrons.visible = false;
        nextCurveAt = state.elapsed + 15;
        if (world.damage) { hit(); state.flash = world.state.title + ' · 충돌'; flashTime = 1; }
      }
      tickMechanics(dt);
      if (state.cleared) {
        if (endingSequence)
          renderer.render(endingSequence.scene, endingSequence.camera);
        return;
      }
      const stageInfo = stageAt(state.distance, state.route, state.mode);
      const base = zoneForDistance(stageInfo.map.look * ZONE_LENGTH_METERS);
      const zf = {
        ...base,
        loop: 0,
        spec: {
          ...base.spec,
          lampA: stageInfo.map.color,
          name: stageInfo.map.name,
          banner: 'STAGE ' + stageInfo.stage + ' · ' + stageInfo.map.name,
          speedBonus: stageInfo.map.speed,
          gapMin: Math.max(9, base.spec.gapMin - stageInfo.difficulty * 2),
        },
      };
      state.stage = stageInfo.stage;
      state.progress = stageInfo.progress;
      if (state.stage !== zoneIndex) {
        zoneIndex = state.stage;
        const song = soundtrackForStage(state.stage);
        if (song !== trackIndex) playTrack(song, 0.42);
        state.zone = zf.spec.name;
        if (!state.flash.includes('분기 중앙')) state.flash = zf.spec.banner;
        flashTime = 2.4;
        drawZoneSign('↑ ' + zf.spec.name + '     출구 없음');
        if ('scenery' in stageInfo.map) {
          cityGroups.forEach(group => group.visible = false);
          fadeFrom = null;
          cityFadeT = -1;
        } else {
          cityGroup.visible = true;
          startCityFade(zf.index);
        }
        roadScenery.enter(stageInfo.map);
        zoneFog.set(zf.spec.fog);
        zoneSky.set(zf.spec.sky);
        zoneGround.set(zf.spec.ground);
        if ('scenery' in stageInfo.map) {
          const terrain = stageInfo.map.scenery;
          const snow = ['russia', 'alpine', 'salt'].includes(terrain);
          const arid = ['pyramid', 'nile', 'somalia', 'bazaar'].includes(terrain);
          zoneGround.set(snow ? '#c3d4d6' : arid ? '#b9a278' : '#708b70');
          zoneSky.set(snow ? '#8eaab8' : arid ? '#b5b9b5' : '#637c9a');
          zoneFog.copy(zoneSky);
        }
        zoneLampA.set(zf.spec.lampA);
        zoneLampB.set(zf.spec.lampB);
        beep(520, 0.15);
      }
      const remaining = STAGE_LENGTH - (state.distance % STAGE_LENGTH),
        nextSpec = stageAt(
          state.distance + remaining,
          state.route,
          state.mode,
        ).map;
      if (
        remaining <= GATE_LEAD_METERS &&
        (!state.boss || state.boss.defeated) && !state.worldEvent
      ) {
        gate.visible = true;
        gate.position.z = -remaining;
        if (gateZone !== nextSpec.name) {
          gateZone = nextSpec.name;
          drawGateSign(
            state.mode === 'story' && state.stage === MAX_STAGE
              ? '최종 탈출구'
              : '← ' +
                  stageAt(state.distance + remaining, 'left', state.mode).map
                    .name +
                  ' | ' +
                  stageAt(state.distance + remaining, 'right', state.mode).map
                    .name +
                  ' →',
            state.mode === 'story' && state.stage === MAX_STAGE
              ? '400 STAGES · 마지막 구간을 돌파하라!'
              : '가운데로 가면 충돌 후 왼쪽 진입',
          );
        }
      } else {
        gate.visible = false;
        gateZone = '';
      }
      const blend = 1 - Math.exp(-dt * 1.2);
      scene.fog!.color.lerp(zoneFog, blend);
      (scene.background as THREE.Color).lerp(zoneSky, blend);
      groundMat.color.lerp(zoneGround, blend);
      pinkLight.color.lerp(zoneLampA, blend);
      cyanLight.color.lerp(zoneLampB, blend);
      if (cityFadeT >= 0) {
        cityFadeT += dt;
        const fk = Math.min(1, cityFadeT / CITY_FADE_SECONDS);
        if (fadeFrom) setGroupOpacity(fadeFrom, 1 - fk);
        setGroupOpacity(cityGroup, fk);
        if (fk >= 1) {
          if (fadeFrom) {
            setGroupOpacity(fadeFrom, 1);
            fadeFrom.visible = false;
            fadeFrom = null;
          }
          setGroupOpacity(cityGroup, 1);
          cityFadeT = -1;
        }
      }
      if (
        (!state.boss || state.boss.defeated) && !state.worldEvent &&
        curveDir === 0 &&
        state.elapsed >= nextCurveAt
      ) {
        curveDir = random() < 0.5 ? -1 : 1;
        curveT = 0;
        state.flash =
          curveDir > 0 ? '⚠ 급커브! 오른쪽이다!' : '⚠ 급커브! 왼쪽이다!';
        flashTime = 2.2;
        chevrons.visible = true;
        chevBoards.forEach((b, i) => {
          b.position.set(i % 2 === 0 ? -7.2 : 7.2, 0, -15 - i * 16);
          (b.children[0] as THREE.Mesh).material =
            curveDir > 0 ? chevMatR : chevMatL;
        });
        beep(200, 0.4);
      }
      if (curveDir !== 0) {
        curveT += dt;
        if (curveT >= CURVE_DURATION_SECONDS) {
          curveDir = 0;
          chevrons.visible = false;
          nextCurveAt =
            state.elapsed +
            CURVE_MIN_INTERVAL_SECONDS +
            random() *
              (CURVE_MAX_INTERVAL_SECONDS - CURVE_MIN_INTERVAL_SECONDS);
        }
      }
      const ck = curveDir !== 0 ? curveIntensity(curveT) : 0;
      state.curve = curveDir !== 0;
      (scene.fog as THREE.FogExp2).density = 0.015 + 0.022 * ck;
      if (chevrons.visible)
        for (const b of chevBoards) {
          b.position.z += state.speed * dt;
          if (b.position.z > 20) b.position.z -= 128;
        }
      state.speed = mix(
        state.speed,
        (speedForDistance(Math.min(state.distance, STAGE_LENGTH * 2), state.hits) +
          zf.spec.speedBonus +
          stageInfo.difficulty * 2) *
          (dashTime > 0 ? 2.8 : 1) * worldSpeedMultiplier,
        1 - Math.exp(-dt * 4),
      );
      invuln = Math.max(0, invuln - dt);
      flashTime -= dt;
      if (flashTime <= 0) state.flash = '';
      if (jumpHeight > 0 || jumpVelocity > 0) {
        jumpVelocity -= 22 * dt;
        jumpHeight = Math.max(0, jumpHeight + jumpVelocity * dt);
        if (jumpHeight === 0) jumpVelocity = 0;
      }
      player.position.x = mix(
        player.position.x,
        lane * 3.65,
        1 - Math.exp(-dt * (stageInfo.map.hazard === 'ice' ? 4 : 15)),
      );
      player.position.y = jumpHeight;
      player.rotation.z = clamp(
        (lane * 3.65 - player.position.x) * -0.12,
        -0.22,
        0.22,
      );
      player.visible = invuln <= 0 || Math.floor(clock * 14) % 2 === 0;
      animateRunner(
        player,
        clock * Math.min(1.15, 0.6 + (0.4 * state.speed) / 22),
        jumpHeight > 0.03 ? 0.35 : 1,
      );
      if ((!state.boss || state.boss.defeated) && !state.worldEvent) {
        for (const c of cars) {
          c.previousZ = c.mesh.position.z;
          // Same-direction traffic: every car faces -Z like the player and the
          // relative speed stays BELOW the road scroll, so cars read as slower
          // cars ahead being overtaken instead of oncoming/reversing traffic.
          c.mesh.position.z +=
            Math.max(6, state.speed - 11 + zf.spec.carBoost + ck * 2) * dt;
          const wheels = c.mesh.userData.wheels as THREE.Mesh[] | undefined;
          if (wheels) for (const w of wheels) w.rotation.x += dt * 9;
          if (
            c.mesh.visible &&
            !c.hit &&
            collides(
              player.position.x,
              c.mesh.position.x,
              c.previousZ,
              c.mesh.position.z,
            )
          ) {
            c.hit = true;
            c.mesh.visible = false;
            explode(c.mesh.position.x, c.mesh.position.z);
            hit();
            if (state.phase === 'capture') break;
          }
          if (c.mesh.position.z > 22) {
            const minZ = Math.min(...cars.map((v) => v.mesh.position.z));
            const zgMin = Math.max(10, zf.spec.gapMin - zf.loop * 1.5);
            c.mesh.position.z =
              minZ -
              (zgMin + random() * (zf.spec.gapMax - zgMin)) *
                (curveDir !== 0 ? 0.8 : 1);
            c.mesh.position.x = (Math.floor(random() * 3) - 1) * 3.65;
            c.hit = false;
            c.mesh.visible = true;
            c.previousZ = c.mesh.position.z;
          }
        }
        if (
          empTime <= 0 &&
          shouldActivateTaser(state.elapsed, state.hits) &&
          !taserActive &&
          state.elapsed - taserTimer >= TASER_INTERVAL_SECONDS
        ) {
          taserActive = true;
          taserTimer = state.elapsed;
          taserLane = Math.floor(random() * 3) - 1;
          taser.position.set(taserLane * 3.65, 1.05, -30);
          taserPreviousZ = taser.position.z;
          taserPolice.position.set(taserLane * 3.65, 0, -30);
          taserPolice.rotation.set(0, Math.PI, 0);
          taser.visible = true;
          taserPolice.visible = true;
          beep(880, 0.12);
        }
        // Drunk driver: unlocked after a full zone loop, weaves across 2 lanes, then crashes.
        if (
          !drunkActive &&
          eventsUnlocked(state.distance) &&
          state.elapsed >= nextDrunkAt
        ) {
          drunkActive = true;
          drunkT = 0;
          drunkBaseX = (Math.floor(random() * 3) - 1) * 3.65;
          drunkPrevZ = -75;
          drunkMesh.position.set(drunkBaseX, 0, -75);
          drunkMesh.visible = true;
          state.flash = '음주운전 차량 발견!';
          flashTime = 1.6;
          beep(700, 0.2);
        }
        if (drunkActive) {
          drunkT += dt;
          drunkPrevZ = drunkMesh.position.z;
          drunkMesh.position.z += Math.max(5, state.speed - 14) * dt;
          drunkMesh.position.x = clamp(
            drunkBaseX + Math.sin(drunkT * 1.7) * 4.4,
            -5.5,
            5.5,
          );
          (drunkMesh.userData.beacon as THREE.Mesh).visible =
            Math.floor(clock * 7) % 2 === 0;
          const drunkHit =
            Math.abs(player.position.x - drunkMesh.position.x) < 3.2 &&
            Math.max(drunkPrevZ, drunkMesh.position.z) > -2.6 &&
            Math.min(drunkPrevZ, drunkMesh.position.z) < 1.8;
          if (drunkHit || drunkT >= 6.5) {
            spawnWreck(drunkMesh.position.x, drunkMesh.position.z);
            drunkActive = false;
            drunkMesh.visible = false;
            state.flash = '음주운전 차량 사고!';
            flashTime = 1.8;
            shake = 0.6;
            beep(95, 0.5);
            nextDrunkAt = state.elapsed + 45 + random() * 30;
            if (drunkHit) hit();
          }
        }
        // Speeder: warned, then overtakes the player's lane from behind.
        if (speedStage === 0 && state.elapsed >= nextSpeedAt) {
          speedStage = 1;
          speedT = 0;
          state.flash = '과속 차량 접근!';
          flashTime = 1.6;
          beep(880, 0.15);
        } else if (speedStage === 1) {
          speedT += dt;
          if (speedT >= 1.2) {
            speedStage = 2;
            speedLane = clamp(Math.round(player.position.x / 3.65), -1, 1);
            speederMesh.position.set(speedLane * 3.65, 0, 24);
            speedPrevZ = 24;
            speederMesh.visible = true;
            beep(440, 0.3);
          }
        } else if (speedStage === 2) {
          speedPrevZ = speederMesh.position.z;
          speederMesh.position.z -= 34 * dt;
          if (
            collides(
              player.position.x,
              speederMesh.position.x,
              speedPrevZ,
              speederMesh.position.z,
            )
          ) {
            hit();
            spawnWreck(speederMesh.position.x, speederMesh.position.z);
            speedStage = 0;
            speederMesh.visible = false;
            nextSpeedAt = state.elapsed + 40 + random() * 30;
            state.flash = '과속 차량 추돌 · 폭발!';
            flashTime = 1.2;
          }
          if (speedPrevZ > 2 && speederMesh.position.z <= 2) {
            shake = Math.max(shake, 0.35);
            beep(150, 0.35);
          }
          if (speederMesh.position.z < -78) {
            speedStage = 0;
            speederMesh.visible = false;
            nextSpeedAt = state.elapsed + 40 + random() * 30;
          }
        }
        // Wrong-way car: rushes at the player, then head-on crashes into the car ahead in its lane.
        if (!wrongActive && state.elapsed >= nextWrongAt) {
          let vi = -1,
            vz = -1e9;
          cars.forEach((c, i) => {
            if (
              c.mesh.visible &&
              !c.hit &&
              c.mesh.position.z < -15 &&
              c.mesh.position.z > vz
            ) {
              vz = c.mesh.position.z;
              vi = i;
            }
          });
          if (vi < 0) nextWrongAt = state.elapsed + 10;
          else {
            wrongActive = true;
            wrongT = 0;
            wrongVictim = vi;
            wrongwayMesh.position.set(cars[vi].mesh.position.x, 0, -78);
            wrongPrevZ = -78;
            wrongwayMesh.visible = true;
            state.flash = '역주행 차량 발생!';
            flashTime = 2;
            beep(300, 0.5);
          }
        } else if (wrongActive) {
          wrongT += dt;
          wrongPrevZ = wrongwayMesh.position.z;
          wrongwayMesh.position.z += (state.speed + 16) * dt;
          const vc = cars[wrongVictim];
          if (
            collides(
              player.position.x,
              wrongwayMesh.position.x,
              wrongPrevZ,
              wrongwayMesh.position.z,
            )
          ) {
            hit();
            spawnWreck(wrongwayMesh.position.x, wrongwayMesh.position.z);
            wrongActive = false;
            wrongwayMesh.visible = false;
            nextWrongAt = state.elapsed + 50 + random() * 40;
            state.flash = '역주행 차량 추돌 · 폭발!';
            flashTime = 1.4;
          }
          if (
            wrongActive &&
            vc &&
            vc.mesh.visible &&
            wrongwayMesh.position.z >= vc.mesh.position.z - 2.5
          ) {
            vc.hit = true;
            vc.mesh.visible = false;
            spawnWreck(vc.mesh.position.x, vc.mesh.position.z);
            spawnWreck(wrongwayMesh.position.x, wrongwayMesh.position.z);
            wrongActive = false;
            wrongwayMesh.visible = false;
            state.flash = '역주행 차량 정면충돌!';
            flashTime = 2;
            shake = 0.8;
            beep(90, 0.6);
            nextWrongAt = state.elapsed + 50 + random() * 40;
          } else if (wrongT > 7 || wrongwayMesh.position.z > 12) {
            wrongActive = false;
            wrongwayMesh.visible = false;
            if (wrongT > 7) {
              spawnWreck(
                wrongwayMesh.position.x,
                Math.min(wrongwayMesh.position.z, 10),
              );
              state.flash = '역주행 차량 단독사고!';
              flashTime = 1.6;
              shake = 0.5;
            }
            nextWrongAt = state.elapsed + 50 + random() * 40;
          }
        }
        for (const event of [
          {
            mesh: speederMesh,
            previous: speedPrevZ,
            active: speedStage === 2,
            stop: () => {
              speedStage = 0;
              nextSpeedAt = state.elapsed + 45;
            },
          },
          {
            mesh: drunkMesh,
            previous: drunkPrevZ,
            active: drunkActive,
            stop: () => {
              drunkActive = false;
              nextDrunkAt = state.elapsed + 45;
            },
          },
          {
            mesh: wrongwayMesh,
            previous: wrongPrevZ,
            active: wrongActive,
            stop: () => {
              wrongActive = false;
              nextWrongAt = state.elapsed + 55;
            },
          },
        ]) {
          if (!event.active || !event.mesh.visible) continue;
          const victim = cars.find(
            (c) =>
              c.mesh.visible &&
              !c.hit &&
              Math.abs(c.mesh.position.x - event.mesh.position.x) < 2.2 &&
              Math.min(
                event.previous - c.previousZ,
                event.mesh.position.z - c.mesh.position.z,
              ) <= 3 &&
              Math.max(
                event.previous - c.previousZ,
                event.mesh.position.z - c.mesh.position.z,
              ) >= -3,
          );
          if (victim) {
            victim.hit = true;
            victim.mesh.visible = false;
            event.mesh.visible = false;
            event.stop();
            spawnWreck(victim.mesh.position.x, victim.mesh.position.z);
            state.flash = '차량 연쇄 추돌! 폭발 반경을 피해!';
            flashTime = 2;
          }
        }
        // Crash wrecks: static obstacles with blinking beacons.
        for (const w of wrecks) {
          if (!w.active) continue;
          w.t += dt;
          w.previousZ = w.mesh.position.z;
          w.mesh.position.z += state.speed * dt;
          w.beacon.visible = Math.floor(clock * 7) % 2 === 0;
          if (
            !w.consumed &&
            collides(
              player.position.x,
              w.mesh.position.x,
              w.previousZ,
              w.mesh.position.z,
            )
          ) {
            w.consumed = true;
            hit();
            state.flash = '사고 잔해를 들이받았다!';
            flashTime = 1.2;
          }
          if (w.t > 14 || w.mesh.position.z > 26) {
            w.active = false;
            w.mesh.visible = false;
          }
        }
        if (taserActive) {
          taserPreviousZ = taser.position.z;
          taser.position.z += (state.speed + 28) * dt;
          // The shooter is a static roadblock: scroll with the world and stand
          // facing the player (+Z) in an aiming pose instead of running in place.
          taserPolice.position.z += state.speed * dt;
          taserPolice.position.x = taserLane * 3.65;
          taserPolice.rotation.set(0, Math.PI, 0);
          animateRunner(taserPolice, clock, 0.1);
          (taserPolice.userData.rightArm as THREE.Group).rotation.x = -1.45;
          if (
            !jumpClearsTaser(jumpHeight) &&
            collides(
              player.position.x,
              taser.position.x,
              taserPreviousZ,
              taser.position.z,
            )
          ) {
            taserActive = false;
            taser.visible = false;
            taserPolice.visible = false;
            state.flash = '테이저 적중!';
            flashTime = 1.2;
            hit();
          } else if (taser.position.z > 10) {
            taserActive = false;
            taser.visible = false;
            taserPolice.visible = false;
            state.flash = '테이저 회피!';
            flashTime = 1.2;
          }
        }
        if (
          empTime <= 0 &&
          shouldActivateMartialLaw(state.elapsed, state.hits) &&
          !helicopterActive
        ) {
          helicopterActive = true;
          helicopter.position.set(
            (Math.floor(random() * 3) - 1) * 3.65,
            2.15,
            -70,
          );
          helicopterPreviousZ = helicopter.position.z;
          helicopter.visible = true;
          beep(180, 0.7);
        }
        if (helicopterActive) {
          helicopterPreviousZ = helicopter.position.z;
          helicopter.position.z += (state.speed + 15) * dt;
          helicopter.rotation.y = Math.sin(clock * 1.8) * 0.12;
          rotor.rotation.y += dt * 13;
          tailRotor.rotation.z += dt * 11;
          if (
            collides(
              player.position.x,
              helicopter.position.x,
              helicopterPreviousZ,
              helicopter.position.z,
            ) &&
            jumpHeight < 1.15
          )
            helicopterHit();
          if (helicopter.position.z > 15) {
            helicopter.position.z = -70;
            helicopterPreviousZ = -70;
            helicopter.position.x = (Math.floor(random() * 3) - 1) * 3.65;
          }
        }
        ambulance.position.z = mix(
          ambulance.position.z,
          AMBULANCE_GAPS[state.hits],
          1 - Math.exp(-dt * 1.8),
        );
        ambulance.position.x = mix(
          ambulance.position.x,
          player.position.x > 1 ? -3.4 : 3.4,
          dt * 1.3,
        );
        state.ambulance = ambulance.position.z;
        cops.forEach((c, i) => {
          c.visible = i < state.police;
          c.rotation.set(0, 0, 0);
          c.position.x = mix(
            c.position.x,
            clamp(player.position.x + (i % 2 === 0 ? -2 : 2), -5, 5),
            dt * 3,
          );
          c.position.z = 2.8 + Math.floor(i / 2) * 1.9;
          animateRunner(c, clock + i * 0.18, 1);
        });
      }
      targetCamera.set(
        player.position.x * 0.18 + curveDir * 5.5 * ck,
        7 - 1.2 * ck,
        13,
      );
      lookTarget.set(player.position.x * 0.18 - curveDir * 7 * ck, 1, -12);
    } else if (state.phase === 'ready') {
      player.visible = true;
      player.position.set(3.2, 0, -1);
      player.scale.setScalar(1.7);
      player.rotation.set(0, Math.PI - 0.45, 0);
      animateRunner(player, clock * 0.6, 0.2);
      targetCamera.set(10, 6.5, 16);
      lookTarget.set(-16, 1, -11);
    } else if (capturing) {
      captureTime += dt;
      state.curve = false;
      chevrons.visible = false;
      drunkActive = false;
      drunkMesh.visible = false;
      speedStage = 0;
      speederMesh.visible = false;
      wrongActive = false;
      wrongwayMesh.visible = false;
      for (const w of wrecks) {
        w.active = false;
        w.mesh.visible = false;
      }
      gate.visible = false;
      (scene.fog as THREE.FogExp2).density = 0.015;
      state.speed = mix(state.speed, 0, dt * 3);
      const helicopterCapture = state.captureReason === 'helicopter';
      ambulance.visible = !helicopterCapture;
      helicopter.visible = helicopterCapture;
      player.visible = true;
      player.rotation.z = 0;
      player.scale.setScalar(1);
      animateRunner(player, 0, 0);
      cars.forEach((c) => {
        c.mesh.position.z += state.speed * dt;
      });
      const approach = clamp(captureTime / 1.3, 0, 1);
      ambulance.position.z = mix(ambulance.position.z, -4, dt * 4);
      ambulance.position.x = mix(ambulance.position.x, 0, dt * 2.6);
      if (helicopterCapture) {
        helicopter.position.set(0, 2.4, -4 + Math.sin(captureTime * 2) * 0.35);
        rotor.rotation.y += dt * 18;
        targetCamera.set(8, 5, 8);
        lookTarget.set(0, 1, -2);
      } else {
        targetCamera.set(10, 6, 10);
        lookTarget.set(0, 1, -2);
      }
      const doorOpen =
        clamp((captureTime - 0.8) / 0.6, 0, 1) *
        (1 - clamp((captureTime - 3.3) / 0.4, 0, 1));
      ambulance.userData.doors[0].rotation.y = -doorOpen * 1.8;
      ambulance.userData.doors[1].rotation.y = doorOpen * 1.8;
      cops.forEach((c, i) => {
        c.visible = true;
        c.position.set(i % 2 ? -2 : 2, 0, -0.5 - Math.floor(i / 2) * 2);
        c.rotation.set(
          0,
          Math.atan2(-(0 - c.position.x), -(-1 - c.position.z)),
          0,
        );
        animateRunner(c, clock, 0.45);
      });
      if (!helicopterCapture && captureTime > 1.25) {
        stretcher.visible = true;
        const load = clamp((captureTime - 1.8) / 1.5, 0, 1);
        stretcher.position.set(0, 0, mix(1, -4, load));
        player.position.set(0, 1.12, stretcher.position.z + 0.8);
        player.rotation.set(-Math.PI / 2, 0, 0);
        if (load > 0.88) {
          player.visible = false;
          stretcher.visible = false;
        }
      } else if (!helicopterCapture) {
        player.position.x = mix(player.position.x, 0, approach * 0.08);
      } else {
        player.position.set(0, 0, -1);
        if (captureTime > 1.6) player.visible = false;
      }
      if (captureTime > 4.1) {
        state.phase = 'over';
        state.speed = 0;
        bgm.pause();
        beep(85, 0.8);
        emit();
      }
    }
    if (state.phase !== 'paused' && state.phase !== 'over') {
      const drift = state.phase === 'ready' ? 3 : state.speed;
      road.position.z = (road.position.z + drift * dt) % 6;
      const scrollCity = (g: THREE.Object3D) => {
        g.position.z += drift * dt;
        if (g.position.z > 35) g.position.z -= 312;
      };
      cityGroup.children.forEach(scrollCity);
      if (fadeFrom) fadeFrom.children.forEach(scrollCity);
      lamps.children.forEach((g) => {
        g.position.z += drift * dt;
        if (g.position.z > 35) g.position.z -= LAMP_SPAN;
      });
      gantry.position.z += drift * dt;
      if (gantry.position.z > 25) gantry.position.z = -180;
      for (let i = 0; i < 160; i++) {
        dustArray[i * 3 + 2] += drift * dt * 0.5;
        if (dustArray[i * 3 + 2] > 20) dustArray[i * 3 + 2] = -100;
      }
      dustGeometry.attributes.position.needsUpdate = true;
    }
    if (state.phase !== 'paused') {
      camera.position.lerp(targetCamera, 1 - Math.exp(-dt * 4));
      camera.lookAt(lookTarget);
      shake = Math.max(0, shake - dt);
      if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.5;
        camera.position.y += (Math.random() - 0.5) * shake * 0.25;
      }
    }
    ambulance.userData.lights.forEach((m: THREE.Mesh, i: number) => {
      m.visible = Math.floor(clock * 8) % 2 === i;
    });
    if (audio && siren && sirenGain) {
      siren.frequency.setTargetAtTime(
        620 + Math.sin(clock * 5) * 220,
        audio.currentTime,
        0.05,
      );
      sirenGain.gain.setTargetAtTime(
        state.phase === 'paused' ||
          state.phase === 'ready' ||
          state.phase === 'over'
          ? 0
          : state.hits >= 2
            ? 0.13
            : state.hits === 1
              ? 0.025
              : 0.007,
        audio.currentTime,
        0.12,
      );
    }
    renderer.render(scene, camera);
    publishTimer += dt;
    if (publishTimer > 0.09) {
      publishTimer = 0;
      emit();
    }
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 62 : 49;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  function skipEnding() {
    if (!state.cleared || !endingSequence) return;
    endingTime = endingTime < 8 ? 8 : ENDING_DURATION;
    state.ending = endingSequence.update(endingTime, camera.aspect);
    emit();
  }
  function keydown(e: KeyboardEvent) {
    if (e.defaultPrevented || document.querySelector('dialog[open]')) return;
    if (
      (e.target as HTMLElement)?.closest(
        'input,textarea,select,[contenteditable=true]',
      )
    )
      return;
    if (
      [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'a',
        'A',
        'd',
        'D',
        'w',
        'W',
        'Enter',
        'Escape',
        ' ',
      ].includes(e.key)
    )
      e.preventDefault();
    if (e.repeat) return;
    if (
      state.cleared &&
      state.ending !== 'done' &&
      (e.key === 'Enter' || e.key === ' ')
    ) {
      skipEnding();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') move(-1);
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') move(1);
    if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key === ' ')
      jump();
    if (
      e.key === 'Enter' &&
      (state.phase === 'ready' || state.phase === 'over')
    )
      start();
    if (e.key === 'Escape') pause();
    if (e.key === 'Shift') boost();
    if (e.key.toLowerCase() === 'e') useItem();
    if (e.key.toLowerCase() === 'f') attackBoss();
  }
  const blur = () => {
    if (state.phase === 'running') pause();
  };
  window.addEventListener('keydown', keydown);
  window.addEventListener('blur', blur);
  let touchX = 0,
    touchY = 0;
  const pointerdown = (e: PointerEvent) => {
    touchX = e.clientX;
    touchY = e.clientY;
  };
  const pointerup = (e: PointerEvent) => {
    const dx = e.clientX - touchX,
      dy = e.clientY - touchY;
    if (Math.abs(dx) > 25 && Math.abs(dx) >= Math.abs(dy)) move(Math.sign(dx));
    else if (dy < -25 && Math.abs(dy) > Math.abs(dx)) jump();
  };
  host.addEventListener('pointerdown', pointerdown);
  host.addEventListener('pointerup', pointerup);
  targetCamera.copy(camera.position);
  lookTarget.set(-16, 1, -11);
  emit();
  raf = requestAnimationFrame(animate);
  return {
    start,
    skipEnding,
    continueEndless,
    attack: () => attackBoss(),
    pause,
    move,
    jump,
    boost,
    useItem,
    setRival(r) {
      rival = r;
    },
    mute(value) {
      muted = value;
      bgm.muted = value;
      if (master) master.gain.value = value ? 0 : 0.22;
    },
    getState: () => ({
      ...state,
      lane,
      jumping: jumpHeight > 0.02,
      jumpHeight,
      helicopter: helicopterActive,
      taser: taserActive,
    }),
    dispose() {
      bgm.removeEventListener('ended', nextTrack);
      bgm.pause();
      bgm.removeAttribute('src');
      bgm.load();
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      roadScenery.dispose();
      endingSequence?.dispose();
      bossEncounter.dispose();
      worldVisual.dispose();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', blur);
      host.removeEventListener('pointerdown', pointerdown);
      host.removeEventListener('pointerup', pointerup);
      void audio?.close();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          geometries.add(o.geometry);
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => {
            materials.add(m);
            if ('map' in m && m.map instanceof THREE.Texture)
              textures.add(m.map);
          });
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
