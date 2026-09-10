import * as THREE from 'three';
import { createMenhera,createCop,animateRunner } from './characters';
import { AMBULANCE_GAPS,HIT_GRACE,nextHit,collides,clampLane,speedForDistance,shouldActivateTaser,shouldActivateMartialLaw,jumpClearsTaser,TASER_INTERVAL_SECONDS,zoneForDistance,eventsUnlocked,ZONE_LENGTH_METERS,GATE_LEAD_METERS,curveIntensity,CURVE_DURATION_SECONDS,CURVE_MIN_INTERVAL_SECONDS,CURVE_MAX_INTERVAL_SECONDS,type Phase } from './rules';
export type MapItem={kind:'car'|'taser'|'helicopter'|'police';lane:number;z:number};
export type CaptureReason='ambulance'|'helicopter';
export type GameSnapshot={phase:Phase;hits:number;speed:number;distance:number;best:number;elapsed:number;flash:string;ambulance:number;lane:number;jumping:boolean;jumpHeight:number;martialLaw:boolean;helicopter:boolean;taser:boolean;zone:string;curve:boolean;captureReason?:CaptureReason;mapItems:MapItem[]};
export type GameAPI={start:()=>void;pause:()=>void;move:(dir:number)=>void;jump:()=>void;mute:(value:boolean)=>void;dispose:()=>void;getState:()=>GameSnapshot};
const mix=THREE.MathUtils.lerp,clamp=THREE.MathUtils.clamp;
export function createGame(host:HTMLDivElement,onState:(s:GameSnapshot)=>void):GameAPI{
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#20152f');scene.fog=new THREE.FogExp2('#291934',.015);
 const camera=new THREE.PerspectiveCamera(49,1,.1,240);camera.position.set(10,6.5,16);
 scene.add(new THREE.HemisphereLight('#e4c3ff','#383050',2.1));
 const key=new THREE.DirectionalLight('#b3b7ff',3);key.position.set(-12,25,15);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-20;key.shadow.camera.right=20;key.shadow.camera.top=25;key.shadow.camera.bottom=-25;key.shadow.camera.far=80;key.shadow.normalBias=.04;scene.add(key);
 const pinkLight=new THREE.PointLight('#ff4aa6',65,35,2);pinkLight.position.set(6,5,1);scene.add(pinkLight);
 const cyanLight=new THREE.PointLight('#46ccff',50,30,2);cyanLight.position.set(-7,5,-10);scene.add(cyanLight);
 const mats=new Map<string,THREE.MeshStandardMaterial>();
 function mat(color:string,glow=false){const k=color+glow;let m=mats.get(k);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:glow?.5:.7,metalness:.12,emissive:glow?color:'#000000',emissiveIntensity:glow?2:0});mats.set(k,m);}return m;}
 function box(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,color:string,glow=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,glow));m.position.set(x,y,z);m.castShadow=!glow;m.receiveShadow=true;parent.add(m);return m;}
 function label(parent:THREE.Object3D,text:string,x:number,y:number,z:number,w:number,h:number,color='#ff6faa',bg='#241429'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.strokeStyle=color;ctx.lineWidth=7;ctx.strokeRect(6,6,500,116);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 58px "Malgun Gothic",sans-serif';ctx.fillText(text,256,67,470);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,toneMapped:false}));m.position.set(x,y,z);parent.add(m);return m;
 }
  const groundMat=new THREE.MeshStandardMaterial({color:zoneForDistance(0).spec.ground,roughness:.9,metalness:0});
  const groundBase=new THREE.Mesh(new THREE.BoxGeometry(240,.2,320),groundMat);groundBase.position.set(0,-.34,-80);groundBase.receiveShadow=true;scene.add(groundBase);
  box(scene,12,.18,300,0,-.12,-80,'#28273c');
 for(const x of [-6.5,6.5]){box(scene,1,.4,250,x,.02,-65,'#565066');box(scene,.06,.05,250,x-Math.sign(x)*.55,.25,-65,'#ee629c',true);}
 const road=new THREE.Group();scene.add(road);
 for(let i=0;i<40;i++)for(const x of [-2,2])box(road,.09,.025,2.4,x,.002,-i*6,'#bda4c5');
 box(scene,.07,.02,250,-5.7,.005,-65,'#e3b765',true);box(scene,.07,.02,250,5.7,.005,-65,'#e3b765',true);
  function rng(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  type CityLook={walls:string[];roof:string;windows:string[];windowMod:number;signs:{t:string;c:string;b:string}[];signEvery:(i:number)=>boolean;signY:number;spread:number;minH:number;maxH:number;extra:'neon'|'houses'|'highway'|'hospital'};
  const CITY_LOOKS:CityLook[]=[
   {walls:['#34304e','#24283c','#44334d','#2d3049','#3a2b3f','#232b4a'],roof:'#544566',windows:['#ef77a2','#a79cdc'],windowMod:4,signs:[{t:'불야성',c:'#86edee',b:'#241429'},{t:'24시 편의점',c:'#ff8aba',b:'#241429'},{t:'도망시',c:'#86edee',b:'#241429'},{t:'퇴원약국',c:'#ff8aba',b:'#241429'},{t:'NIGHT RUN',c:'#86edee',b:'#193c40'},{t:'돌아와♥',c:'#ff8aba',b:'#241429'}],signEvery:i=>i%2===0||i<4,signY:3.7,spread:0,minH:7,maxH:23,extra:'neon'},
   {walls:['#4a3b32','#3a3230','#54453a','#463c34'],roof:'#6b4a3f',windows:['#ffd98a','#ffb35c'],windowMod:4,signs:[{t:'민박',c:'#ffd98a',b:'#2b2118'},{t:'심야분식',c:'#ff9d6b',b:'#2b2118'},{t:'달빛 세탁소',c:'#cfe6ff',b:'#232830'}],signEvery:i=>i%3===0,signY:2.4,spread:0,minH:3,maxH:7,extra:'houses'},
   {walls:['#2b3242','#323a4e','#28303e'],roof:'#3d465c',windows:['#bfe3ff','#9fd0ff'],windowMod:5,signs:[{t:'도망 IC',c:'#b8e6d9',b:'#14362e'},{t:'출구 없음',c:'#ffd23e',b:'#1a1a12'},{t:'속도 준수',c:'#ffffff',b:'#1c2c4c'}],signEvery:i=>i%3===0,signY:4.5,spread:4,minH:6,maxH:18,extra:'highway'},
   {walls:['#e8e4e4','#dcd6d6','#f2eeee','#d5cfd8'],roof:'#b03a52',windows:['#bfe9ff','#dff4ff'],windowMod:3,signs:[{t:'응급실',c:'#ff2b65',b:'#ffffff'},{t:'입원수속',c:'#193c40',b:'#e8f4f4'},{t:'면회 시간외',c:'#ffffff',b:'#8c1f36'}],signEvery:i=>i%2===0,signY:4,spread:0,minH:8,maxH:16,extra:'hospital'},
  ];
  function signTexture(s:{t:string;c:string;b:string}){const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d')!;x.fillStyle=s.b;x.fillRect(0,0,512,128);x.strokeStyle=s.c;x.lineWidth=7;x.strokeRect(6,6,500,116);x.fillStyle=s.c;x.textAlign='center';x.textBaseline='middle';x.font='bold 58px "Malgun Gothic",sans-serif';x.fillText(s.t,256,67,470);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  // All four variants share one seeded layout so swapping zones never pops positions.
  function buildCityVariant(v:CityLook){
   const grp=new THREE.Group();
   const wallMats=v.walls.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.7,metalness:.12}));
   const roofMat=new THREE.MeshStandardMaterial({color:v.roof,roughness:.7,metalness:.12});
   const winMats=v.windows.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.5,metalness:.12,emissive:c,emissiveIntensity:2}));
   const doorMat=new THREE.MeshStandardMaterial({color:'#111626',roughness:.8});
   const poleMat=new THREE.MeshStandardMaterial({color:'#8b779c',roughness:.7});
   const poleGlow=new THREE.MeshStandardMaterial({color:'#ffc4de',roughness:.5,emissive:'#ffc4de',emissiveIntensity:2});
   const crossMat=new THREE.MeshStandardMaterial({color:'#ff2b65',roughness:.5,emissive:'#ff2b65',emissiveIntensity:2});
   const fenceMat=new THREE.MeshStandardMaterial({color:'#cfd6e3',roughness:.8});
   const signTexs=v.signs.map(signTexture);
   const R=rng(20260910);
   const part=(gg:THREE.Group,geo:THREE.BufferGeometry,mt:THREE.Material,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geo,mt);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;gg.add(m);return m;};
   for(let i=0;i<52;i++){
    const side=i%2===0?-1:1,z=-Math.floor(i/2)*12+18,w=4+R()*4,h=v.minH+R()*(v.maxH-v.minH),x=side*(9+w/2+R()*3+v.spread);
    const g=new THREE.Group();g.position.z=z;grp.add(g);
    part(g,new THREE.BoxGeometry(w,h,8),wallMats[i%wallMats.length],x,h/2,0);
    part(g,new THREE.BoxGeometry(w+.3,.22,8.3),roofMat,x,h,0);
    for(let row=0;row<Math.floor(h/2.2);row++)for(let col=0;col<3;col++)if((row+col+i)%v.windowMod!==0)part(g,new THREE.BoxGeometry(.55,1,.035),winMats[(i+row)%winMats.length],x-w/2+.8+col*1.2,2+row*2.1,4.03);
    part(g,new THREE.BoxGeometry(Math.min(w-.6,2),2,.08),doorMat,x,1.2,4.1);
    if(v.signEvery(i)){const sm=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w*.96,4.5),1.25),new THREE.MeshBasicMaterial({map:signTexs[i%signTexs.length],side:THREE.DoubleSide,toneMapped:false}));sm.position.set(x,Math.min(v.signY,h*.62),4.15);g.add(sm);}
    if(v.extra==='houses'){const roof=part(g,new THREE.CylinderGeometry(.12,w*.72,1.7,4),roofMat,x,h+.8,0);roof.rotation.y=Math.PI/4;part(g,new THREE.BoxGeometry(w,.5,.08),fenceMat,x,.25,4.3);}
    if(v.extra==='hospital'){part(g,new THREE.BoxGeometry(.5,1.2,.06),crossMat,x,h*.72,4.06);part(g,new THREE.BoxGeometry(1.2,.5,.06),crossMat,x,h*.72,4.06);}
    if(v.extra==='highway')g.visible=i%3===0;
    part(g,new THREE.BoxGeometry(.12,6,.12),poleMat,side*6.8,3,0);part(g,new THREE.BoxGeometry(1.9,.1,.12),poleMat,side*6.2,6,0);part(g,new THREE.BoxGeometry(1.1,.07,.35),poleGlow,side*5.8,5.95,0);
   }
   const matSet=new Set<THREE.Material>();grp.traverse(o=>{if(o instanceof THREE.Mesh){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{m.transparent=true;matSet.add(m);});}});grp.userData.mats=[...matSet];
   return grp;
  }
  const cityGroups=CITY_LOOKS.map(buildCityVariant);
  cityGroups.forEach((g,idx)=>{g.visible=idx===0;scene.add(g);});
  let cityGroup=cityGroups[0],fadeFrom:THREE.Group|null=null,cityFadeT=-1;
  const CITY_FADE_SECONDS=2.5;
  function setGroupOpacity(g:THREE.Group,o:number){for(const m of (g.userData.mats as THREE.Material[]))m.opacity=o;}
  // Instant swap (game start). In-game zone changes use startCityFade for a gradual crossfade.
  function setCityVariant(idx:number){const next=cityGroups[idx];for(let i=0;i<cityGroup.children.length&&i<next.children.length;i++)next.children[i].position.z=cityGroup.children[i].position.z;if(fadeFrom&&fadeFrom!==next){setGroupOpacity(fadeFrom,1);fadeFrom.visible=false;}setGroupOpacity(next,1);cityGroup.visible=false;next.visible=true;cityGroup=next;fadeFrom=null;cityFadeT=-1;}
  function startCityFade(idx:number){const next=cityGroups[idx];if(next===cityGroup)return;if(fadeFrom){setGroupOpacity(fadeFrom,1);fadeFrom.visible=false;}fadeFrom=cityGroup;cityGroup=next;for(let i=0;i<fadeFrom.children.length;i++)next.children[i].position.z=fadeFrom.children[i].position.z;setGroupOpacity(next,0);next.visible=true;cityFadeT=0;}
 const skyline=new THREE.Group();scene.add(skyline);
 for(let i=0;i<28;i++){const h=10+(i*11%29);box(skyline,5,h,8,(i-14)*7,h/2,-145-(i%4)*6,'#35213f');}
 const moon=new THREE.Mesh(new THREE.CircleGeometry(10,64),new THREE.MeshBasicMaterial({color:'#df8cac',fog:false}));moon.position.set(26,32,-170);scene.add(moon);
  const gantry=new THREE.Group();gantry.position.z=-76;scene.add(gantry);for(const x of [-6.3,6.3])box(gantry,.2,10,.2,x,5,0,'#817086');box(gantry,13,.2,.2,0,10,0,'#817086');
  const zoneCanvas=document.createElement('canvas');zoneCanvas.width=512;zoneCanvas.height=128;const zoneCtx=zoneCanvas.getContext('2d')!;
  const zoneTex=new THREE.CanvasTexture(zoneCanvas);zoneTex.colorSpace=THREE.SRGBColorSpace;
  function drawZoneSign(text:string){zoneCtx.fillStyle='#193c40';zoneCtx.fillRect(0,0,512,128);zoneCtx.strokeStyle='#b8e6d9';zoneCtx.lineWidth=7;zoneCtx.strokeRect(6,6,500,116);zoneCtx.fillStyle='#b8e6d9';zoneCtx.textAlign='center';zoneCtx.textBaseline='middle';zoneCtx.font='bold 44px "Malgun Gothic",sans-serif';zoneCtx.fillText(text,256,67,470);zoneTex.needsUpdate=true;}
  drawZoneSign('↑ 도망시     출구 없음');
  const zoneSign=new THREE.Mesh(new THREE.PlaneGeometry(8,1.8),new THREE.MeshBasicMaterial({map:zoneTex,side:THREE.DoubleSide,toneMapped:false}));zoneSign.position.set(0,8.4,.15);gantry.add(zoneSign);
  const lamps=new THREE.Group();scene.add(lamps);const LAMP_COUNT=14;
  for(let i=0;i<LAMP_COUNT;i++){const side=i%2===0?-1:1;const g=new THREE.Group();g.position.set(side*7.4,0,20-i*22);box(g,.14,6.4,.14,0,3.2,0,'#6f6584');box(g,1.6,.12,.12,-side*.8,6.4,0,'#6f6584');box(g,.9,.14,.5,-side*1.5,6.3,0,'#ffe9b0',true);lamps.add(g);}
  const LAMP_SPAN=LAMP_COUNT*22;
  const starGeo=new THREE.BufferGeometry();const starArr=new Float32Array(120*3);
  for(let i=0;i<120;i++){starArr[i*3]=(Math.random()-.5)*220;starArr[i*3+1]=22+Math.random()*55;starArr[i*3+2]=-60-Math.random()*120;}
  starGeo.setAttribute('position',new THREE.BufferAttribute(starArr,3));
  scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#cfe6ff',size:.4,transparent:true,opacity:.8,fog:false})));
  function chevronTex(right:boolean){const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d')!;x.fillStyle='#14141c';x.fillRect(0,0,256,128);x.strokeStyle='#ffd23e';x.lineWidth=10;x.strokeRect(8,8,240,112);x.fillStyle='#ffd23e';x.textAlign='center';x.textBaseline='middle';x.font='bold 62px "Malgun Gothic",sans-serif';x.fillText(right?'▶▶▶':'◀◀◀',128,68,220);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  const chevMatL=new THREE.MeshBasicMaterial({map:chevronTex(false),side:THREE.DoubleSide,toneMapped:false});
  const chevMatR=new THREE.MeshBasicMaterial({map:chevronTex(true),side:THREE.DoubleSide,toneMapped:false});
  const chevrons=new THREE.Group();scene.add(chevrons);chevrons.visible=false;const chevBoards:THREE.Group[]=[];
  for(let i=0;i<8;i++){const b=new THREE.Group();b.position.set(i%2===0?-7.2:7.2,0,-15-i*16);const p=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.1),chevMatL);p.position.y=2.6;b.add(p);box(b,.12,2.1,.12,0,1.05,0,'#6f6584');chevrons.add(b);chevBoards.push(b);}
  // Tollgate/IC gate: approaches exactly at the zone boundary, with an exit-ramp fork on the right.
  const gate=new THREE.Group();scene.add(gate);gate.visible=false;let gateZone='';
  const gateCanvas=document.createElement('canvas');gateCanvas.width=512;gateCanvas.height=160;const gateCtx=gateCanvas.getContext('2d')!;
  const gateTex=new THREE.CanvasTexture(gateCanvas);gateTex.colorSpace=THREE.SRGBColorSpace;
  function drawGateSign(title:string,sub:string){gateCtx.fillStyle='#12333a';gateCtx.fillRect(0,0,512,160);gateCtx.strokeStyle='#ffd23e';gateCtx.lineWidth=8;gateCtx.strokeRect(8,8,496,144);gateCtx.fillStyle='#ffd23e';gateCtx.textAlign='center';gateCtx.font='bold 44px "Malgun Gothic",sans-serif';gateCtx.fillText(title,256,62,470);gateCtx.fillStyle='#ffffff';gateCtx.font='bold 52px "Malgun Gothic",sans-serif';gateCtx.fillText(sub,256,120,470);gateTex.needsUpdate=true;}
  drawGateSign('전방 톨게이트','다음 구역');
  const gateSign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.4),new THREE.MeshBasicMaterial({map:gateTex,side:THREE.DoubleSide,toneMapped:false}));gateSign.position.set(0,8.2,0);gate.add(gateSign);
  for(const x of [-6.3,6.3])box(gate,.24,10,.24,x,5,0,'#817086');box(gate,13.4,.24,.24,0,10,0,'#817086');
  for(const bz of [-6,2]){box(gate,2.2,2.4,3,-8.4,1.2,bz,'#2d3049');box(gate,2.6,.25,3.4,-8.4,2.5,bz,'#544566');box(gate,1.6,.9,.06,-7.25,1.5,bz,'#ffd98a',true);}
  const ramp=box(gate,3.2,.12,46,10.5,.02,-14,'#23232f');ramp.rotation.y=-.2;
  box(gate,.6,.3,40,6.9,.15,-14,'#3a3f4a');box(gate,.64,.08,40,6.9,.34,-14,'#e3b765',true);
  for(let i=0;i<3;i++){const cp=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.65),chevMatR);cp.position.set(9.8+i*1.2,1.4,-8-i*12);cp.rotation.y=-.2;gate.add(cp);}
  function vehicle(color:string,ambulance=false){const g=new THREE.Group();const wheels:THREE.Mesh[]=[];
   box(g,2.1,.6,ambulance?4.8:4.1,0,.65,0,color);box(g,ambulance?2.05:1.8,ambulance?1.75:.85,ambulance?3.7:2.1,0,ambulance?1.75:1.36,ambulance?.45:.15,color);
   box(g,1.75,.65,.045,0,ambulance?1.65:1.4,ambulance?-1.46:-.92,'#233a56');
   if(!ambulance)box(g,1.7,.55,.045,0,1.38,1.22,'#34435e');
   for(const x of [-1.04,1.04])for(const z of [-1.3,1.3]){const tire=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.24,12),mat('#11101b'));tire.rotation.z=Math.PI/2;tire.position.set(x,.43,z);g.add(tire);wheels.push(tire);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.25,12),mat('#9a99ae'));hub.rotation.z=Math.PI/2;hub.position.copy(tire.position);g.add(hub);}
   g.userData.wheels=wheels;
  for(const x of [-.68,.68]){box(g,.44,.2,.06,x,.82,-(ambulance?2.44:2.09),'#fff2c4',true);box(g,.35,.16,.04,x,.85,ambulance?2.44:2.09,'#fc4475',true);}
  if(ambulance){
   for(const x of [-1.035,1.035]){box(g,.04,.25,4.7,x,1.05,0,'#f54c85');box(g,.04,.8,.23,x,1.9,.4,'#fd477c');box(g,.04,.23,.8,x,1.9,.4,'#fd477c');}
   box(g,1.4,.12,.55,0,2.68,-.7,'#13192b');const red=box(g,.55,.23,.5,-.39,2.84,-.7,'#ff2b65',true),blue=box(g,.55,.23,.5,.39,2.84,-.7,'#4894ff',true);g.userData.lights=[red,blue];
   const doors=[];for(const side of [-1,1]){const p=new THREE.Group();p.position.set(side*1.025,1.65,2.32);box(p,1,.0+1.65,.09,-side*.5,0,0,'#eee5eb');box(p,.65,.5,.1,-side*.5,.3,.06,'#243247');doors.push(p);g.add(p);}g.userData.doors=doors;
   box(g,1.8,1.45,.07,0,1.65,2.26,'#161124');label(g,'119',0,.65,2.48,1.2,.4,'#ff78a0','#eae2eb');
  }
  return g;
 }
 const player=createMenhera();scene.add(player);
 const ambulance=vehicle('#f1e8f0',true);ambulance.position.set(3,0,35);scene.add(ambulance);
 const helicopter=new THREE.Group();
 box(helicopter,2.55,.72,1.35,0,0,0,'#34405f');box(helicopter,1.6,.55,.9,0,.58,0,'#43597d');
 box(helicopter,1.25,.32,.04,0,.58,-.47,'#8de7f1',true);box(helicopter,.42,.22,.06,-1.46,.04,0,'#27304d');
 box(helicopter,2.2,.08,.12,-1.95,.28,0,'#27304d');box(helicopter,.08,.08,.9,-3.03,.28,0,'#27304d');
 const rotor=new THREE.Group();box(rotor,3.9,.045,.08,0,.99,0,'#eab6e3',true);rotor.rotation.y=.25;helicopter.add(rotor);
 const tailRotor=new THREE.Group();box(tailRotor,.75,.04,.05,-3.02,.32,0,'#ff74b2',true);box(tailRotor,.04,.75,.05,-3.02,.32,0,'#ff74b2',true);helicopter.add(tailRotor);
 helicopter.visible=false;helicopter.position.set(0,2.15,-70);scene.add(helicopter);
 const cops:THREE.Group[]=[];for(let i=0;i<4;i++){const c=createCop();c.visible=false;c.position.set(i%2===0?-2.7:2.7,0,3+Math.floor(i/2)*2);scene.add(c);cops.push(c);}
 const taserPolice=createCop();taserPolice.visible=false;scene.add(taserPolice);
 const taser=new THREE.Group();box(taser,.12,.12,1.35,0,0,0,'#f9dd57',true);box(taser,.28,.2,.2,0,0,0,'#fff0a0',true);taser.rotation.x=Math.PI/2;taser.visible=false;scene.add(taser);
 const stretcher=new THREE.Group();box(stretcher,1.05,.18,2.5,0,.8,0,'#c7b7c9');box(stretcher,.95,.13,2.3,0,.97,0,'#ffa0bd');for(const x of [-.4,.4])for(const z of [-.8,.8]){box(stretcher,.07,.6,.07,x,.46,z,'#a8a7bb');box(stretcher,.15,.18,.23,x,.12,z,'#181720');}stretcher.visible=false;scene.add(stretcher);
 const cars:{mesh:THREE.Group;hit:boolean;previousZ:number}[]=[];const colors=['#f588b6','#7e8fdb','#c6c5d3','#46a9bb','#d9a374','#8b6caa'];
  for(let i=0;i<12;i++){const v=vehicle(colors[i%colors.length]);v.position.set(((i*7)%3-1)*3.65,0,-22-i*17);scene.add(v);cars.push({mesh:v,hit:false,previousZ:v.position.z});}
  const drunkMesh=vehicle('#c2540a');drunkMesh.visible=false;label(drunkMesh,'음주',0,2.35,0,1.6,.55,'#ffd23e','#1a1a12');drunkMesh.userData.beacon=box(drunkMesh,1.1,.16,.4,0,2,.08,'#ff8c00',true);scene.add(drunkMesh);
  const speederMesh=vehicle('#e5484d');speederMesh.visible=false;scene.add(speederMesh);
  const wrongwayMesh=vehicle('#dfe3ee');wrongwayMesh.visible=false;wrongwayMesh.rotation.y=Math.PI;{const wl=label(wrongwayMesh,'역주행',0,2.35,0,1.8,.6,'#ffd23e','#1a1a12');wl.rotation.y=Math.PI;}scene.add(wrongwayMesh);
  const wrecks:{mesh:THREE.Group;beacon:THREE.Mesh;active:boolean;consumed:boolean;t:number;previousZ:number}[]=[];
  for(let i=0;i<3;i++){const w=vehicle('#3a3f4a');w.visible=false;const beacon=box(w,1.2,.18,.5,0,1.95,0,'#ff8c00',true);scene.add(w);wrecks.push({mesh:w,beacon,active:false,consumed:false,t:0,previousZ:0});}
  function spawnWreck(x:number,z:number){const w=wrecks.find(v=>!v.active);if(!w)return;w.active=true;w.consumed=false;w.t=0;w.previousZ=z;w.mesh.position.set(x,0,z);w.mesh.rotation.set(0,(Math.random()-.5)*.7,Math.random()<.5?-.14:.14);w.mesh.visible=true;}
 const dustGeometry=new THREE.BufferGeometry();const dustArray=new Float32Array(160*3);for(let i=0;i<160;i++){dustArray[i*3]=(Math.random()-.5)*36;dustArray[i*3+1]=Math.random()*14;dustArray[i*3+2]=-Math.random()*100;}dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustArray,3));const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#ffb1df',size:.055,transparent:true,opacity:.65}));scene.add(dust);
  let state:GameSnapshot={phase:'ready',hits:0,speed:22,distance:0,best:0,elapsed:0,flash:'',ambulance:35,lane:0,jumping:false,jumpHeight:0,martialLaw:false,helicopter:false,taser:false,zone:zoneForDistance(0).spec.name,curve:false,mapItems:[]};try{state.best=Number(localStorage.getItem('closed-run-best'))||0;}catch{}
  let lane=0,invuln=0,flashTime=0,captureTime=0,clock=0,lastTime=performance.now(),raf=0,publishTimer=0,muted=false,disposed=false,shake=0,jumpHeight=0,jumpVelocity=0,taserTimer=0,taserActive=false,taserLane=0,taserPreviousZ=0,helicopterActive=false,helicopterPreviousZ=-70,zoneIndex=-1,curveDir=0,curveT=0,nextCurveAt=30;
  let nextDrunkAt=0,nextSpeedAt=40,nextWrongAt=90,drunkActive=false,drunkT=0,drunkBaseX=0,drunkPrevZ=0,speedStage=0,speedT=0,speedLane=0,speedPrevZ=0,wrongActive=false,wrongT=0,wrongVictim=-1,wrongPrevZ=0;
  const zoneFog=new THREE.Color(zoneForDistance(0).spec.fog),zoneSky=new THREE.Color(zoneForDistance(0).spec.sky),zoneGround=new THREE.Color(zoneForDistance(0).spec.ground),zoneLampA=new THREE.Color(zoneForDistance(0).spec.lampA),zoneLampB=new THREE.Color(zoneForDistance(0).spec.lampB);
  // Rotating soundtrack: every mp3 in public/audio plays in order, then loops.
  const TRACK_URLS=['audio/song1.mp3','audio/closed-run-bgm.mp3'].map(p=>new URL(p,document.baseURI).href);
  let trackIndex=0;
  const bgm=new Audio(TRACK_URLS[0]);bgm.preload='auto';bgm.volume=.42;
  const playBgm=()=>{bgm.muted=muted;void bgm.play().catch(()=>{});};
  const playTrack=(i:number,volume:number)=>{trackIndex=((i%TRACK_URLS.length)+TRACK_URLS.length)%TRACK_URLS.length;if(bgm.src!==TRACK_URLS[trackIndex]){bgm.src=TRACK_URLS[trackIndex];bgm.currentTime=0;}bgm.volume=volume;playBgm();};
  const nextTrack=()=>{if(!disposed)playTrack(trackIndex+1,bgm.volume);};
  bgm.addEventListener('ended',nextTrack);
 let audio:AudioContext|null=null,master:GainNode|null=null,siren:OscillatorNode|null=null,sirenGain:GainNode|null=null;
 function initAudio(){try{if(!audio){audio=new AudioContext();master=audio.createGain();master.gain.value=muted?0:.22;master.connect(audio.destination);siren=audio.createOscillator();siren.type='sine';sirenGain=audio.createGain();sirenGain.gain.value=0;siren.connect(sirenGain);sirenGain.connect(master);siren.start();}void audio.resume();}catch{}}
 function beep(freq:number,duration=.12){if(!audio||!master)return;const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq/2,audio.currentTime+duration);g.gain.setValueAtTime(.3,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(audio.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect();};}
  function playTitleBgm(){playTrack(0,.35);}
 playTitleBgm();
 const emit=()=>{const mapItems:MapItem[]=[];for(const c of cars){if(c.mesh.position.z<18&&c.mesh.position.z>-72)mapItems.push({kind:'car',lane:Math.round(c.mesh.position.x/3.65),z:c.mesh.position.z});}if(taserActive)mapItems.push({kind:'taser',lane:taserLane,z:taser.position.z});if(helicopterActive)mapItems.push({kind:'helicopter',lane:Math.round(helicopter.position.x/3.65),z:helicopter.position.z});if(taserPolice.visible)mapItems.push({kind:'police',lane:taserLane,z:taserPolice.position.z});for(const m of [drunkMesh,speederMesh,wrongwayMesh])if(m.visible)mapItems.push({kind:'car',lane:Math.round(m.position.x/3.65),z:m.position.z});for(const w of wrecks)if(w.active)mapItems.push({kind:'car',lane:Math.round(w.mesh.position.x/3.65),z:w.mesh.position.z});onState({...state,lane,jumping:jumpHeight>.02,jumpHeight,martialLaw:shouldActivateMartialLaw(state.elapsed,state.hits),helicopter:helicopterActive,taser:taserActive,mapItems});};
 function start(){initAudio();bgm.volume=.42;playBgm();state={...state,phase:'running',hits:0,speed:22,distance:0,elapsed:0,flash:'',ambulance:35,lane:0,jumping:false,jumpHeight:0,martialLaw:false,helicopter:false,taser:false,zone:zoneForDistance(0).spec.name,curve:false,captureReason:undefined,mapItems:[]};lane=0;invuln=1;captureTime=0;flashTime=0;shake=0;jumpHeight=0;jumpVelocity=0;taserTimer=0;taserActive=false;helicopterActive=false;zoneIndex=-1;setCityVariant(0);curveDir=0;curveT=0;nextCurveAt=30+Math.random()*15;chevrons.visible=false;(scene.fog as THREE.FogExp2).density=.015;drunkActive=false;drunkMesh.visible=false;speedStage=0;speederMesh.visible=false;nextSpeedAt=40;wrongActive=false;wrongwayMesh.visible=false;nextWrongAt=90;nextDrunkAt=0;gate.visible=false;gateZone='';for(const w of wrecks){w.active=false;w.mesh.visible=false;}drawZoneSign('↑ 도망시     출구 없음');zoneFog.set(zoneForDistance(0).spec.fog);zoneSky.set(zoneForDistance(0).spec.sky);zoneGround.set(zoneForDistance(0).spec.ground);groundMat.color.set(zoneForDistance(0).spec.ground);zoneLampA.set(zoneForDistance(0).spec.lampA);zoneLampB.set(zoneForDistance(0).spec.lampB);player.visible=true;player.position.set(0,0,0);player.rotation.set(0,0,0);player.scale.setScalar(1);ambulance.visible=true;ambulance.position.set(3,0,35);ambulance.rotation.set(0,0,0);for(const d of ambulance.userData.doors)d.rotation.y=0;helicopter.visible=false;taser.visible=false;taserPolice.visible=false;taserPolice.rotation.set(0,Math.PI,0);stretcher.visible=false;cops.forEach(c=>{c.visible=false;c.rotation.set(0,0,0);});cars.forEach((c,i)=>{c.mesh.position.set(((i*7)%3-1)*3.65,0,-24-i*18);c.hit=false;c.previousZ=c.mesh.position.z;});camera.position.set(0,7,13);beep(720);emit();}
 function pause(){if(state.phase==='running'){state.phase='paused';bgm.pause();}else if(state.phase==='paused'){state.phase='running';initAudio();playBgm();}emit();}
 function move(dir:number){if(state.phase!=='running')return;lane=clampLane(lane+dir);state.lane=lane;beep(300,.045);}
 function jump(){if(state.phase!=='running'||jumpHeight>0)return;jumpVelocity=8.2;beep(540,.08);}
 function hit(){const next=nextHit(state.hits,invuln,state.phase);if(!next)return;state.hits=next.hits;state.phase=next.phase;state.captureReason='ambulance';invuln=HIT_GRACE;shake=.45;flashTime=1.5;state.flash=['','아야! 짭새 +1','다리야… 일 좀 해!','사이렌이 너무 가까운데?','지금 바로 입원!'][state.hits];beep(130,.4);cops[state.hits-1].visible=true;if(state.phase==='capture'){bgm.volume=.2;captureTime=0;state.best=Math.max(state.best,state.distance);try{localStorage.setItem('closed-run-best',String(Math.floor(state.best)));}catch{}}emit();}
 function helicopterHit(){if(state.phase!=='running')return;state.phase='capture';state.captureReason='helicopter';state.helicopter=false;helicopterActive=false;helicopter.visible=false;state.flash='공군 출동! 헬기로 입원합니다.';flashTime=4;captureTime=0;shake=.8;bgm.volume=.2;state.best=Math.max(state.best,state.distance);beep(75,.8);try{localStorage.setItem('closed-run-best',String(Math.floor(state.best)));}catch{}emit();}
 const targetCamera=new THREE.Vector3(),lookTarget=new THREE.Vector3();
 function animate(now:number){if(disposed)return;raf=requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;const running=state.phase==='running',capturing=state.phase==='capture';if(state.phase!=='paused')clock+=dt;
   if(running){state.elapsed+=dt;state.distance+=state.speed*dt;state.best=Math.max(state.best,state.distance);
    const zf=zoneForDistance(state.distance);
     if(zf.index!==zoneIndex){zoneIndex=zf.index;state.zone=zf.spec.name;state.flash=zf.spec.banner;flashTime=2.4;drawZoneSign('↑ '+zf.spec.name+'     출구 없음');startCityFade(zf.index);zoneFog.set(zf.spec.fog);zoneSky.set(zf.spec.sky);zoneGround.set(zf.spec.ground);zoneLampA.set(zf.spec.lampA);zoneLampB.set(zf.spec.lampB);beep(520,.15);}
    const remaining=ZONE_LENGTH_METERS-(state.distance%ZONE_LENGTH_METERS),nextSpec=zoneForDistance(state.distance+remaining).spec;
    if(remaining<=GATE_LEAD_METERS){gate.visible=true;gate.position.z=-remaining;if(gateZone!==nextSpec.name){gateZone=nextSpec.name;drawGateSign(nextSpec.name==='심야 고속도로'?'전방 톨게이트':'전방 IC','다음: '+nextSpec.name);}}
    else{gate.visible=false;gateZone='';}
    const blend=1-Math.exp(-dt*1.2);scene.fog!.color.lerp(zoneFog,blend);(scene.background as THREE.Color).lerp(zoneSky,blend);groundMat.color.lerp(zoneGround,blend);pinkLight.color.lerp(zoneLampA,blend);cyanLight.color.lerp(zoneLampB,blend);
    if(cityFadeT>=0){cityFadeT+=dt;const fk=Math.min(1,cityFadeT/CITY_FADE_SECONDS);if(fadeFrom)setGroupOpacity(fadeFrom,1-fk);setGroupOpacity(cityGroup,fk);if(fk>=1){if(fadeFrom){setGroupOpacity(fadeFrom,1);fadeFrom.visible=false;fadeFrom=null;}setGroupOpacity(cityGroup,1);cityFadeT=-1;}}
    if(curveDir===0&&state.elapsed>=nextCurveAt){curveDir=Math.random()<.5?-1:1;curveT=0;state.flash=curveDir>0?'⚠ 급커브! 오른쪽이다!':'⚠ 급커브! 왼쪽이다!';flashTime=2.2;chevrons.visible=true;chevBoards.forEach((b,i)=>{b.position.set(i%2===0?-7.2:7.2,0,-15-i*16);(b.children[0] as THREE.Mesh).material=curveDir>0?chevMatR:chevMatL;});beep(200,.4);}
    if(curveDir!==0){curveT+=dt;if(curveT>=CURVE_DURATION_SECONDS){curveDir=0;chevrons.visible=false;nextCurveAt=state.elapsed+CURVE_MIN_INTERVAL_SECONDS+Math.random()*(CURVE_MAX_INTERVAL_SECONDS-CURVE_MIN_INTERVAL_SECONDS);}}
    const ck=curveDir!==0?curveIntensity(curveT):0;state.curve=curveDir!==0;
    (scene.fog as THREE.FogExp2).density=.015+.022*ck;
    if(chevrons.visible)for(const b of chevBoards){b.position.z+=state.speed*dt;if(b.position.z>20)b.position.z-=128;}
    state.speed=mix(state.speed,speedForDistance(state.distance,state.hits)+zf.spec.speedBonus,1-Math.exp(-dt*4));invuln=Math.max(0,invuln-dt);flashTime-=dt;if(flashTime<=0)state.flash='';
   if(jumpHeight>0||jumpVelocity>0){jumpVelocity-=22*dt;jumpHeight=Math.max(0,jumpHeight+jumpVelocity*dt);if(jumpHeight===0)jumpVelocity=0;}
   player.position.x=mix(player.position.x,lane*3.65,1-Math.exp(-dt*15));player.position.y=jumpHeight;player.rotation.z=clamp((lane*3.65-player.position.x)*-.12,-.22,.22);player.visible=invuln<=0||Math.floor(clock*14)%2===0;animateRunner(player,clock*Math.min(1.15,.6+.4*state.speed/22),jumpHeight>.03?.35:1);
    for(const c of cars){c.previousZ=c.mesh.position.z;
     // Same-direction traffic: every car faces -Z like the player and the
     // relative speed stays BELOW the road scroll, so cars read as slower
     // cars ahead being overtaken instead of oncoming/reversing traffic.
     c.mesh.position.z+=Math.max(6,state.speed-11+zf.spec.carBoost+ck*2)*dt;
     const wheels=c.mesh.userData.wheels as THREE.Mesh[]|undefined;if(wheels)for(const w of wheels)w.rotation.x+=dt*9;
     if(!c.hit&&collides(player.position.x,c.mesh.position.x,c.previousZ,c.mesh.position.z)){c.hit=true;hit();if(state.phase==='capture')break;}
     if(c.mesh.position.z>22){const minZ=Math.min(...cars.map(v=>v.mesh.position.z));const zgMin=Math.max(10,zf.spec.gapMin-zf.loop*1.5);c.mesh.position.z=minZ-(zgMin+Math.random()*(zf.spec.gapMax-zgMin))*(curveDir!==0?.8:1);c.mesh.position.x=(Math.floor(Math.random()*3)-1)*3.65;c.hit=false;c.mesh.visible=true;c.previousZ=c.mesh.position.z;}}
     if(shouldActivateTaser(state.elapsed,state.hits)&&!taserActive&&state.elapsed-taserTimer>=TASER_INTERVAL_SECONDS){taserActive=true;taserTimer=state.elapsed;taserLane=Math.floor(Math.random()*3)-1;taser.position.set(taserLane*3.65,1.05,-30);taserPreviousZ=taser.position.z;taserPolice.position.set(taserLane*3.65,0,-30);taserPolice.rotation.set(0,Math.PI,0);taser.visible=true;taserPolice.visible=true;beep(880,.12);}
    // Drunk driver: unlocked after a full zone loop, weaves across 2 lanes, then crashes.
    if(!drunkActive&&eventsUnlocked(state.distance)&&state.elapsed>=nextDrunkAt){drunkActive=true;drunkT=0;drunkBaseX=(Math.floor(Math.random()*3)-1)*3.65;drunkPrevZ=-75;drunkMesh.position.set(drunkBaseX,0,-75);drunkMesh.visible=true;state.flash='음주운전 차량 발견!';flashTime=1.6;beep(700,.2);}
    if(drunkActive){drunkT+=dt;drunkPrevZ=drunkMesh.position.z;drunkMesh.position.z+=Math.max(5,state.speed-14)*dt;drunkMesh.position.x=clamp(drunkBaseX+Math.sin(drunkT*1.7)*4.4,-5.5,5.5);(drunkMesh.userData.beacon as THREE.Mesh).visible=Math.floor(clock*7)%2===0;
     const drunkHit=Math.abs(player.position.x-drunkMesh.position.x)<3.2&&Math.max(drunkPrevZ,drunkMesh.position.z)>-2.6&&Math.min(drunkPrevZ,drunkMesh.position.z)<1.8;
     if(drunkHit||drunkT>=6.5){spawnWreck(drunkMesh.position.x,drunkMesh.position.z);drunkActive=false;drunkMesh.visible=false;state.flash='음주운전 차량 사고!';flashTime=1.8;shake=.6;beep(95,.5);nextDrunkAt=state.elapsed+45+Math.random()*30;if(drunkHit)hit();}}
    // Speeder: warned, then overtakes the player's lane from behind.
    if(speedStage===0&&state.elapsed>=nextSpeedAt){speedStage=1;speedT=0;state.flash='과속 차량 접근!';flashTime=1.6;beep(880,.15);}
    else if(speedStage===1){speedT+=dt;if(speedT>=1.2){speedStage=2;speedLane=clamp(Math.round(player.position.x/3.65),-1,1);speederMesh.position.set(speedLane*3.65,0,24);speedPrevZ=24;speederMesh.visible=true;beep(440,.3);}}
    else if(speedStage===2){speedPrevZ=speederMesh.position.z;speederMesh.position.z-=34*dt;if(collides(player.position.x,speederMesh.position.x,speedPrevZ,speederMesh.position.z)){hit();state.flash='과속 차량과 접촉!';flashTime=1.2;}if(speedPrevZ>2&&speederMesh.position.z<=2){shake=Math.max(shake,.35);beep(150,.35);}if(speederMesh.position.z<-78){speedStage=0;speederMesh.visible=false;nextSpeedAt=state.elapsed+40+Math.random()*30;}}
    // Wrong-way car: rushes at the player, then head-on crashes into the car ahead in its lane.
    if(!wrongActive&&state.elapsed>=nextWrongAt){let vi=-1,vz=-1e9;cars.forEach((c,i)=>{if(c.mesh.position.z<-15&&c.mesh.position.z>vz){vz=c.mesh.position.z;vi=i;}});if(vi<0)nextWrongAt=state.elapsed+10;else{wrongActive=true;wrongT=0;wrongVictim=vi;wrongwayMesh.position.set(cars[vi].mesh.position.x,0,-78);wrongPrevZ=-78;wrongwayMesh.visible=true;state.flash='역주행 차량 발생!';flashTime=2;beep(300,.5);}}
    else if(wrongActive){wrongT+=dt;wrongPrevZ=wrongwayMesh.position.z;wrongwayMesh.position.z+=(state.speed+16)*dt;const vc=cars[wrongVictim];
     if(collides(player.position.x,wrongwayMesh.position.x,wrongPrevZ,wrongwayMesh.position.z)){hit();state.flash='역주행 차량과 충돌!';flashTime=1.4;}
     if(vc&&wrongwayMesh.position.z>=vc.mesh.position.z-2.5){vc.hit=true;vc.mesh.visible=false;spawnWreck(vc.mesh.position.x,vc.mesh.position.z);spawnWreck(wrongwayMesh.position.x,wrongwayMesh.position.z);wrongActive=false;wrongwayMesh.visible=false;state.flash='역주행 차량 정면충돌!';flashTime=2;shake=.8;beep(90,.6);nextWrongAt=state.elapsed+50+Math.random()*40;}
     else if(wrongT>7||wrongwayMesh.position.z>12){wrongActive=false;wrongwayMesh.visible=false;if(wrongT>7){spawnWreck(wrongwayMesh.position.x,Math.min(wrongwayMesh.position.z,10));state.flash='역주행 차량 단독사고!';flashTime=1.6;shake=.5;}nextWrongAt=state.elapsed+50+Math.random()*40;}}
    // Crash wrecks: static obstacles with blinking beacons.
    for(const w of wrecks){if(!w.active)continue;w.t+=dt;w.previousZ=w.mesh.position.z;w.mesh.position.z+=state.speed*dt;w.beacon.visible=Math.floor(clock*7)%2===0;if(!w.consumed&&collides(player.position.x,w.mesh.position.x,w.previousZ,w.mesh.position.z)){w.consumed=true;hit();state.flash='사고 잔해를 들이받았다!';flashTime=1.2;}if(w.t>14||w.mesh.position.z>26){w.active=false;w.mesh.visible=false;}}
    if(taserActive){taserPreviousZ=taser.position.z;taser.position.z+=(state.speed+28)*dt;
     // The shooter is a static roadblock: scroll with the world and stand
     // facing the player (+Z) in an aiming pose instead of running in place.
     taserPolice.position.z+=state.speed*dt;taserPolice.position.x=taserLane*3.65;taserPolice.rotation.set(0,Math.PI,0);animateRunner(taserPolice,clock,.1);(taserPolice.userData.rightArm as THREE.Group).rotation.x=-1.45;
     if(!jumpClearsTaser(jumpHeight)&&collides(player.position.x,taser.position.x,taserPreviousZ,taser.position.z)){taserActive=false;taser.visible=false;taserPolice.visible=false;state.flash='테이저 적중!';flashTime=1.2;hit();}else if(taser.position.z>10){taserActive=false;taser.visible=false;taserPolice.visible=false;state.flash='테이저 회피!';flashTime=1.2;}}
   if(shouldActivateMartialLaw(state.elapsed,state.hits)&&!helicopterActive){helicopterActive=true;helicopter.position.set((Math.floor(Math.random()*3)-1)*3.65,2.15,-70);helicopterPreviousZ=helicopter.position.z;helicopter.visible=true;beep(180,.7);}
   if(helicopterActive){helicopterPreviousZ=helicopter.position.z;helicopter.position.z+=(state.speed+15)*dt;helicopter.rotation.y=Math.sin(clock*1.8)*.12;rotor.rotation.y+=dt*13;tailRotor.rotation.z+=dt*11;if(collides(player.position.x,helicopter.position.x,helicopterPreviousZ,helicopter.position.z)&&jumpHeight<1.15)helicopterHit();if(helicopter.position.z>15){helicopter.position.z=-70;helicopterPreviousZ=-70;helicopter.position.x=(Math.floor(Math.random()*3)-1)*3.65;}}
   ambulance.position.z=mix(ambulance.position.z,AMBULANCE_GAPS[state.hits],1-Math.exp(-dt*1.8));ambulance.position.x=mix(ambulance.position.x,player.position.x>1?-3.4:3.4,dt*1.3);state.ambulance=ambulance.position.z;
    cops.forEach((c,i)=>{c.visible=i<state.hits;c.rotation.set(0,0,0);c.position.x=mix(c.position.x,clamp(player.position.x+(i%2===0?-2:2),-5,5),dt*3);c.position.z=2.8+Math.floor(i/2)*1.9;animateRunner(c,clock+i*.18,1);});
    targetCamera.set(player.position.x*.18+curveDir*5.5*ck,7-1.2*ck,13);lookTarget.set(player.position.x*.18-curveDir*7*ck,1,-12);
  }else if(state.phase==='ready'){
   player.visible=true;player.position.set(3.2,0,-1);player.scale.setScalar(1.7);player.rotation.set(0,Math.PI-.45,0);animateRunner(player,clock*.6,.2);targetCamera.set(10,6.5,16);lookTarget.set(-16,1,-11);
  }else if(capturing){
       captureTime+=dt;state.curve=false;chevrons.visible=false;drunkActive=false;drunkMesh.visible=false;speedStage=0;speederMesh.visible=false;wrongActive=false;wrongwayMesh.visible=false;for(const w of wrecks){w.active=false;w.mesh.visible=false;}gate.visible=false;(scene.fog as THREE.FogExp2).density=.015;state.speed=mix(state.speed,0,dt*3);const helicopterCapture=state.captureReason==='helicopter';ambulance.visible=!helicopterCapture;helicopter.visible=helicopterCapture;player.visible=true;player.rotation.z=0;player.scale.setScalar(1);animateRunner(player,0,0);cars.forEach(c=>{c.mesh.position.z+=state.speed*dt;});
   const approach=clamp(captureTime/1.3,0,1);ambulance.position.z=mix(ambulance.position.z,-4,dt*4);ambulance.position.x=mix(ambulance.position.x,0,dt*2.6);if(helicopterCapture){helicopter.position.set(0,2.4,-4+Math.sin(captureTime*2)*.35);rotor.rotation.y+=dt*18;targetCamera.set(8,5,8);lookTarget.set(0,1,-2);}else{targetCamera.set(10,6,10);lookTarget.set(0,1,-2);}
   const doorOpen=clamp((captureTime-.8)/.6,0,1)*(1-clamp((captureTime-3.3)/.4,0,1));ambulance.userData.doors[0].rotation.y=-doorOpen*1.8;ambulance.userData.doors[1].rotation.y=doorOpen*1.8;
    cops.forEach((c,i)=>{c.visible=true;c.position.set(i%2?-2:2,0,-.5-Math.floor(i/2)*2);c.rotation.set(0,Math.atan2(-(0-c.position.x),-(-1-c.position.z)),0);animateRunner(c,clock,.45);});
   if(!helicopterCapture&&captureTime>1.25){stretcher.visible=true;const load=clamp((captureTime-1.8)/1.5,0,1);stretcher.position.set(0,0,mix(1,-4,load));player.position.set(0,1.12,stretcher.position.z+.8);player.rotation.set(-Math.PI/2,0,0);if(load>.88){player.visible=false;stretcher.visible=false;}}
   else if(!helicopterCapture){player.position.x=mix(player.position.x,0,approach*.08);}else{player.position.set(0,0,-1);if(captureTime>1.6)player.visible=false;}
   if(captureTime>4.1){state.phase='over';state.speed=0;bgm.pause();beep(85,.8);emit();}
  }
  if(state.phase!=='paused'&&state.phase!=='over'){
    const drift=state.phase==='ready'?3:state.speed;road.position.z=(road.position.z+drift*dt)%6;const scrollCity=(g:THREE.Object3D)=>{g.position.z+=drift*dt;if(g.position.z>35)g.position.z-=312;};cityGroup.children.forEach(scrollCity);if(fadeFrom)fadeFrom.children.forEach(scrollCity);lamps.children.forEach(g=>{g.position.z+=drift*dt;if(g.position.z>35)g.position.z-=LAMP_SPAN;});gantry.position.z+=drift*dt;if(gantry.position.z>25)gantry.position.z=-180;
   for(let i=0;i<160;i++){dustArray[i*3+2]+=drift*dt*.5;if(dustArray[i*3+2]>20)dustArray[i*3+2]=-100;}dustGeometry.attributes.position.needsUpdate=true;
  }
  if(state.phase!=='paused'){camera.position.lerp(targetCamera,1-Math.exp(-dt*4));camera.lookAt(lookTarget);shake=Math.max(0,shake-dt);if(shake>0){camera.position.x+=(Math.random()-.5)*shake*.5;camera.position.y+=(Math.random()-.5)*shake*.25;}}
  ambulance.userData.lights.forEach((m:THREE.Mesh,i:number)=>{m.visible=Math.floor(clock*8)%2===i;});
  if(audio&&siren&&sirenGain){siren.frequency.setTargetAtTime(620+Math.sin(clock*5)*220,audio.currentTime,.05);sirenGain.gain.setTargetAtTime(state.phase==='paused'||state.phase==='ready'||state.phase==='over'?0:state.hits>=2?.13:state.hits===1?.025:.007,audio.currentTime,.12);}
  renderer.render(scene,camera);publishTimer+=dt;if(publishTimer>.09){publishTimer=0;emit();}
 }
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<.9?62:49;camera.updateProjectionMatrix();}const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function keydown(e:KeyboardEvent){if((e.target as HTMLElement)?.closest('button,input,textarea,select'))return;if(['ArrowLeft','ArrowRight','ArrowUp','a','A','d','D','w','W','Enter','Escape',' '].includes(e.key))e.preventDefault();if(e.repeat)return;if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')move(-1);if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')move(1);if(e.key==='ArrowUp'||e.key.toLowerCase()==='w'||e.key===' ')jump();if(e.key==='Enter'&&(state.phase==='ready'||state.phase==='over'))start();if(e.key==='Escape')pause();}
 const blur=()=>{if(state.phase==='running')pause();};window.addEventListener('keydown',keydown);window.addEventListener('blur',blur);
   let touchX=0,touchY=0;const pointerdown=(e:PointerEvent)=>{touchX=e.clientX;touchY=e.clientY;};const pointerup=(e:PointerEvent)=>{const dx=e.clientX-touchX,dy=e.clientY-touchY;if(Math.abs(dx)>25&&Math.abs(dx)>=Math.abs(dy))move(Math.sign(dx));else if(dy<-25&&Math.abs(dy)>Math.abs(dx))jump();};host.addEventListener('pointerdown',pointerdown);host.addEventListener('pointerup',pointerup);
 targetCamera.copy(camera.position);lookTarget.set(-16,1,-11);emit();raf=requestAnimationFrame(animate);
 return {start,pause,move,jump,mute(value){muted=value;bgm.muted=value;if(master)master.gain.value=value?0:.22;},getState:()=>({...state}),dispose(){bgm.removeEventListener('ended',nextTrack);bgm.pause();bgm.removeAttribute('src');bgm.load();disposed=true;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('blur',blur);host.removeEventListener('pointerdown',pointerdown);host.removeEventListener('pointerup',pointerup);void audio?.close();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometries.add(o.geometry);const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{materials.add(m);if('map'in m&&m.map instanceof THREE.Texture)textures.add(m.map);});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();}};
}



