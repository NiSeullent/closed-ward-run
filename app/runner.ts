import * as THREE from 'three';
import { createMenhera,createCop,animateRunner } from './characters';
import { AMBULANCE_GAPS,HIT_GRACE,nextHit,collides,clampLane,speedForDistance,shouldActivateTaser,shouldActivateMartialLaw,jumpClearsTaser,TASER_INTERVAL_SECONDS,type Phase } from './rules';
export type MapItem={kind:'car'|'taser'|'helicopter'|'police';lane:number;z:number};
export type CaptureReason='ambulance'|'helicopter';
export type GameSnapshot={phase:Phase;hits:number;speed:number;distance:number;best:number;elapsed:number;flash:string;ambulance:number;lane:number;jumping:boolean;jumpHeight:number;martialLaw:boolean;helicopter:boolean;taser:boolean;captureReason?:CaptureReason;mapItems:MapItem[]};
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
 box(scene,180,.2,260,0,-.34,-65,'#14121f');box(scene,12,.18,250,0,-.12,-65,'#28273c');
 for(const x of [-6.5,6.5]){box(scene,1,.4,250,x,.02,-65,'#565066');box(scene,.06,.05,250,x-Math.sign(x)*.55,.25,-65,'#ee629c',true);}
 const road=new THREE.Group();scene.add(road);
 for(let i=0;i<40;i++)for(const x of [-2,2])box(road,.09,.025,2.4,x,.002,-i*6,'#bda4c5');
 box(scene,.07,.02,250,-5.7,.005,-65,'#e3b765',true);box(scene,.07,.02,250,5.7,.005,-65,'#e3b765',true);
 const city=new THREE.Group();scene.add(city);
 const signs=['불야성','24시 편의점','도망시','오늘도 영업','돌아와♥','퇴원약국','NIGHT RUN','입원 문의'];
 for(let i=0;i<34;i++){
  const side=i%2===0?-1:1,z=-Math.floor(i/2)*12+18,w=4+(i*7%4),h=7+(i*13%14),x=side*(9+w/2+(i%3));const g=new THREE.Group();g.position.z=z;city.add(g);
  box(g,w,h,8,x,h/2,0,['#34304e','#24283c','#44334d','#2d3049'][i%4]);box(g,w+.3,.22,8.3,x,h,0,'#544566');
  for(let row=0;row<Math.floor(h/2.2);row++)for(let col=0;col<3;col++)if((row+col+i)%4!==0)box(g,.55,1,.035,x-w/2+.8+col*1.2,2+row*2.1,4.03,(i+row)%3===0?'#ef77a2':'#a79cdc',true);
  box(g,w-.6,2,.08,x,1.2,4.1,'#111626');box(g,w-.3,.15,.15,x,2.35,4.2,i%3===0?'#70d9ed':'#fa69b0',true);
  if(i%2===0||i<4)label(g,signs[i%signs.length],x,3.7,4.15,w*.96,1.25,i%3===0?'#86edee':'#ff8aba');
  box(g,.12,6,.12,side*6.8,3,0,'#8b779c');box(g,1.9,.1,.12,side*6.2,6,0,'#8b779c');box(g,1.1,.07,.35,side*5.8,5.95,0,'#ffc4de',true);
 }
 const skyline=new THREE.Group();scene.add(skyline);
 for(let i=0;i<28;i++){const h=10+(i*11%29);box(skyline,5,h,8,(i-14)*7,h/2,-145-(i%4)*6,'#35213f');}
 const moon=new THREE.Mesh(new THREE.CircleGeometry(10,64),new THREE.MeshBasicMaterial({color:'#df8cac',fog:false}));moon.position.set(26,32,-170);scene.add(moon);
 const gantry=new THREE.Group();gantry.position.z=-76;scene.add(gantry);for(const x of [-6.3,6.3])box(gantry,.2,10,.2,x,5,0,'#817086');box(gantry,13,.2,.2,0,10,0,'#817086');label(gantry,'↑ 도망시     출구 없음',0,8.4,.15,8,1.8,'#b8e6d9','#193c40');
 function vehicle(color:string,ambulance=false){const g=new THREE.Group();
  box(g,2.1,.6,ambulance?4.8:4.1,0,.65,0,color);box(g,ambulance?2.05:1.8,ambulance?1.75:.85,ambulance?3.7:2.1,0,ambulance?1.75:1.36,ambulance?.45:.15,color);
  box(g,1.75,.65,.045,0,ambulance?1.65:1.4,ambulance?-1.46:-.92,'#233a56');
  if(!ambulance)box(g,1.7,.55,.045,0,1.38,1.22,'#34435e');
  for(const x of [-1.04,1.04])for(const z of [-1.3,1.3]){const tire=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.24,12),mat('#11101b'));tire.rotation.z=Math.PI/2;tire.position.set(x,.43,z);g.add(tire);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.25,12),mat('#9a99ae'));hub.rotation.z=Math.PI/2;hub.position.copy(tire.position);g.add(hub);}
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
 const dustGeometry=new THREE.BufferGeometry();const dustArray=new Float32Array(160*3);for(let i=0;i<160;i++){dustArray[i*3]=(Math.random()-.5)*36;dustArray[i*3+1]=Math.random()*14;dustArray[i*3+2]=-Math.random()*100;}dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustArray,3));const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#ffb1df',size:.055,transparent:true,opacity:.65}));scene.add(dust);
 let state:GameSnapshot={phase:'ready',hits:0,speed:22,distance:0,best:0,elapsed:0,flash:'',ambulance:35,lane:0,jumping:false,jumpHeight:0,martialLaw:false,helicopter:false,taser:false,mapItems:[]};try{state.best=Number(localStorage.getItem('closed-run-best'))||0;}catch{}
 let lane=0,invuln=0,flashTime=0,captureTime=0,clock=0,lastTime=performance.now(),raf=0,publishTimer=0,muted=false,disposed=false,shake=0,jumpHeight=0,jumpVelocity=0,taserTimer=0,taserActive=false,taserLane=0,taserPreviousZ=0,helicopterActive=false,helicopterPreviousZ=-70;
 const bgm=new Audio(new URL('audio/song1.mp3',document.baseURI).href);bgm.loop=true;bgm.preload='auto';bgm.volume=.42;
 const playBgm=()=>{bgm.muted=muted;void bgm.play().catch(()=>{});};
 let audio:AudioContext|null=null,master:GainNode|null=null,siren:OscillatorNode|null=null,sirenGain:GainNode|null=null;
 function initAudio(){try{if(!audio){audio=new AudioContext();master=audio.createGain();master.gain.value=muted?0:.22;master.connect(audio.destination);siren=audio.createOscillator();siren.type='sine';sirenGain=audio.createGain();sirenGain.gain.value=0;siren.connect(sirenGain);sirenGain.connect(master);siren.start();}void audio.resume();}catch{}}
 function beep(freq:number,duration=.12){if(!audio||!master)return;const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq/2,audio.currentTime+duration);g.gain.setValueAtTime(.3,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(audio.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect();};}
 const emit=()=>{const mapItems:MapItem[]=[];for(const c of cars){if(c.mesh.position.z<18&&c.mesh.position.z>-72)mapItems.push({kind:'car',lane:Math.round(c.mesh.position.x/3.65),z:c.mesh.position.z});}if(taserActive)mapItems.push({kind:'taser',lane:taserLane,z:taser.position.z});if(helicopterActive)mapItems.push({kind:'helicopter',lane:Math.round(helicopter.position.x/3.65),z:helicopter.position.z});if(taserPolice.visible)mapItems.push({kind:'police',lane:taserLane,z:taserPolice.position.z});onState({...state,lane,jumping:jumpHeight>.02,jumpHeight,martialLaw:shouldActivateMartialLaw(state.elapsed,state.hits),helicopter:helicopterActive,taser:taserActive,mapItems});};
 function start(){initAudio();bgm.currentTime=0;bgm.volume=.42;playBgm();state={...state,phase:'running',hits:0,speed:22,distance:0,elapsed:0,flash:'',ambulance:35,lane:0,jumping:false,jumpHeight:0,martialLaw:false,helicopter:false,taser:false,captureReason:undefined,mapItems:[]};lane=0;invuln=1;captureTime=0;flashTime=0;shake=0;jumpHeight=0;jumpVelocity=0;taserTimer=0;taserActive=false;helicopterActive=false;player.visible=true;player.position.set(0,0,0);player.rotation.set(0,0,0);player.scale.setScalar(1);ambulance.visible=true;ambulance.position.set(3,0,35);ambulance.rotation.set(0,0,0);for(const d of ambulance.userData.doors)d.rotation.y=0;helicopter.visible=false;taser.visible=false;taserPolice.visible=false;stretcher.visible=false;cops.forEach(c=>{c.visible=false;});cars.forEach((c,i)=>{c.mesh.position.set(((i*7)%3-1)*3.65,0,-24-i*18);c.hit=false;c.previousZ=c.mesh.position.z;});camera.position.set(0,7,13);beep(720);emit();}
 function pause(){if(state.phase==='running'){state.phase='paused';bgm.pause();}else if(state.phase==='paused'){state.phase='running';initAudio();playBgm();}emit();}
 function move(dir:number){if(state.phase!=='running')return;lane=clampLane(lane+dir);state.lane=lane;beep(300,.045);}
 function jump(){if(state.phase!=='running'||jumpHeight>0)return;jumpVelocity=8.2;beep(540,.08);}
 function hit(){const next=nextHit(state.hits,invuln,state.phase);if(!next)return;state.hits=next.hits;state.phase=next.phase;state.captureReason='ambulance';invuln=HIT_GRACE;shake=.45;flashTime=1.5;state.flash=['','아야! 짭새 +1','다리야… 일 좀 해!','사이렌이 너무 가까운데?','지금 바로 입원!'][state.hits];beep(130,.4);cops[state.hits-1].visible=true;if(state.phase==='capture'){bgm.volume=.2;captureTime=0;state.best=Math.max(state.best,state.distance);try{localStorage.setItem('closed-run-best',String(Math.floor(state.best)));}catch{}}emit();}
 function helicopterHit(){if(state.phase!=='running')return;state.phase='capture';state.captureReason='helicopter';state.helicopter=false;helicopterActive=false;helicopter.visible=false;state.flash='공군 출동! 헬기로 입원합니다.';flashTime=4;captureTime=0;shake=.8;bgm.volume=.2;state.best=Math.max(state.best,state.distance);beep(75,.8);try{localStorage.setItem('closed-run-best',String(Math.floor(state.best)));}catch{}emit();}
 const targetCamera=new THREE.Vector3(),lookTarget=new THREE.Vector3();
 function animate(now:number){if(disposed)return;raf=requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;const running=state.phase==='running',capturing=state.phase==='capture';if(state.phase!=='paused')clock+=dt;
  if(running){state.elapsed+=dt;state.distance+=state.speed*dt;state.best=Math.max(state.best,state.distance);state.speed=mix(state.speed,speedForDistance(state.distance,state.hits),1-Math.exp(-dt*4));invuln=Math.max(0,invuln-dt);flashTime-=dt;if(flashTime<=0)state.flash='';
   if(jumpHeight>0||jumpVelocity>0){jumpVelocity-=22*dt;jumpHeight=Math.max(0,jumpHeight+jumpVelocity*dt);if(jumpHeight===0)jumpVelocity=0;}
   player.position.x=mix(player.position.x,lane*3.65,1-Math.exp(-dt*15));player.position.y=jumpHeight;player.rotation.z=clamp((lane*3.65-player.position.x)*-.12,-.22,.22);player.visible=invuln<=0||Math.floor(clock*14)%2===0;animateRunner(player,clock*state.speed/22,jumpHeight>.03?.35:1);
   for(const c of cars){c.previousZ=c.mesh.position.z;c.mesh.position.z+=(state.speed+9)*dt;if(!c.hit&&collides(player.position.x,c.mesh.position.x,c.previousZ,c.mesh.position.z)){c.hit=true;hit();if(state.phase==='capture')break;}if(c.mesh.position.z>22){const minZ=Math.min(...cars.map(v=>v.mesh.position.z));c.mesh.position.z=minZ-(17+Math.random()*15);c.mesh.position.x=(Math.floor(Math.random()*3)-1)*3.65;c.hit=false;}}
   if(shouldActivateTaser(state.elapsed,state.hits)&&!taserActive&&state.elapsed-taserTimer>=TASER_INTERVAL_SECONDS){taserActive=true;taserTimer=state.elapsed;taserLane=Math.floor(Math.random()*3)-1;taser.position.set(taserLane*3.65,1.05,-30);taserPreviousZ=taser.position.z;taserPolice.position.set(taserLane*3.65,0,-30);taser.visible=true;taserPolice.visible=true;beep(880,.12);}
   if(taserActive){taserPreviousZ=taser.position.z;taser.position.z+=(state.speed+28)*dt;taserPolice.position.x=taserLane*3.65;animateRunner(taserPolice,clock,.12);if(!jumpClearsTaser(jumpHeight)&&collides(player.position.x,taser.position.x,taserPreviousZ,taser.position.z)){taserActive=false;taser.visible=false;taserPolice.visible=false;state.flash='테이저 적중!';flashTime=1.2;hit();}else if(taser.position.z>10){taserActive=false;taser.visible=false;taserPolice.visible=false;state.flash='점프로 테이저 회피!';flashTime=1.2;}}
   if(shouldActivateMartialLaw(state.elapsed,state.hits)&&!helicopterActive){helicopterActive=true;helicopter.position.set((Math.floor(Math.random()*3)-1)*3.65,2.15,-70);helicopterPreviousZ=helicopter.position.z;helicopter.visible=true;beep(180,.7);}
   if(helicopterActive){helicopterPreviousZ=helicopter.position.z;helicopter.position.z+=(state.speed+15)*dt;helicopter.rotation.y=Math.sin(clock*1.8)*.12;rotor.rotation.y+=dt*13;tailRotor.rotation.z+=dt*11;if(collides(player.position.x,helicopter.position.x,helicopterPreviousZ,helicopter.position.z)&&jumpHeight<1.15)helicopterHit();if(helicopter.position.z>15){helicopter.position.z=-70;helicopter.position.x=(Math.floor(Math.random()*3)-1)*3.65;}}
   ambulance.position.z=mix(ambulance.position.z,AMBULANCE_GAPS[state.hits],1-Math.exp(-dt*1.8));ambulance.position.x=mix(ambulance.position.x,player.position.x>1?-3.4:3.4,dt*1.3);state.ambulance=ambulance.position.z;
   cops.forEach((c,i)=>{c.visible=i<state.hits;c.position.x=mix(c.position.x,clamp(player.position.x+(i%2===0?-2:2),-5,5),dt*3);c.position.z=2.8+Math.floor(i/2)*1.9;animateRunner(c,clock+i*.18,1);});
   targetCamera.set(player.position.x*.18,7,13);lookTarget.set(player.position.x*.18,1,-12);
  }else if(state.phase==='ready'){
   player.visible=true;player.position.set(3.2,0,-1);player.scale.setScalar(1.7);player.rotation.set(0,Math.PI-.45,0);animateRunner(player,clock*.6,.2);targetCamera.set(10,6.5,16);lookTarget.set(-16,1,-11);
  }else if(capturing){
   captureTime+=dt;state.speed=mix(state.speed,0,dt*3);const helicopterCapture=state.captureReason==='helicopter';ambulance.visible=!helicopterCapture;helicopter.visible=helicopterCapture;player.visible=true;player.rotation.z=0;player.scale.setScalar(1);animateRunner(player,0,0);cars.forEach(c=>{c.mesh.position.z+=state.speed*dt;});
   const approach=clamp(captureTime/1.3,0,1);ambulance.position.z=mix(ambulance.position.z,-4,dt*4);ambulance.position.x=mix(ambulance.position.x,0,dt*2.6);if(helicopterCapture){helicopter.position.set(0,2.4,-4+Math.sin(captureTime*2)*.35);rotor.rotation.y+=dt*18;targetCamera.set(8,5,8);lookTarget.set(0,1,-2);}else{targetCamera.set(10,6,10);lookTarget.set(0,1,-2);}
   const doorOpen=clamp((captureTime-.8)/.6,0,1)*(1-clamp((captureTime-3.3)/.4,0,1));ambulance.userData.doors[0].rotation.y=-doorOpen*1.8;ambulance.userData.doors[1].rotation.y=doorOpen*1.8;
   cops.forEach((c,i)=>{c.visible=true;c.position.set(i%2?-2:2,0,-.5-Math.floor(i/2)*2);animateRunner(c,clock,.15);});
   if(!helicopterCapture&&captureTime>1.25){stretcher.visible=true;const load=clamp((captureTime-1.8)/1.5,0,1);stretcher.position.set(0,0,mix(1,-4,load));player.position.set(0,1.12,stretcher.position.z+.8);player.rotation.set(-Math.PI/2,0,0);if(load>.88){player.visible=false;stretcher.visible=false;}}
   else if(!helicopterCapture){player.position.x=mix(player.position.x,0,approach*.08);}else{player.position.set(0,0,-1);if(captureTime>1.6)player.visible=false;}
   if(captureTime>4.1){state.phase='over';state.speed=0;bgm.pause();beep(85,.8);emit();}
  }
  if(state.phase!=='paused'&&state.phase!=='over'){
   const drift=state.phase==='ready'?3:state.speed;road.position.z=(road.position.z+drift*dt)%6;city.children.forEach(g=>{g.position.z+=drift*dt;if(g.position.z>35)g.position.z-=204;});gantry.position.z+=drift*dt;if(gantry.position.z>25)gantry.position.z=-180;
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
 let touchX=0;const pointerdown=(e:PointerEvent)=>{touchX=e.clientX;};const pointerup=(e:PointerEvent)=>{const dx=e.clientX-touchX;if(Math.abs(dx)>25)move(Math.sign(dx));};host.addEventListener('pointerdown',pointerdown);host.addEventListener('pointerup',pointerup);
 targetCamera.copy(camera.position);lookTarget.set(-16,1,-11);emit();raf=requestAnimationFrame(animate);
 return {start,pause,move,jump,mute(value){muted=value;bgm.muted=value;if(master)master.gain.value=value?0:.22;},getState:()=>({...state}),dispose(){bgm.pause();bgm.removeAttribute('src');bgm.load();disposed=true;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('blur',blur);host.removeEventListener('pointerdown',pointerdown);host.removeEventListener('pointerup',pointerup);void audio?.close();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometries.add(o.geometry);const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{materials.add(m);if('map'in m&&m.map instanceof THREE.Texture)textures.add(m.map);});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();}};
}



