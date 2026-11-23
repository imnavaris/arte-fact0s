import {T,mat,texMat,part,tube} from "./compartido.js";
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const rnd=(i,k)=>{const s=Math.sin(i*127.1+k*311.7)*43758.5453;return s-Math.floor(s);};
const lerpAngle=(a,b,t)=>{const d=((b-a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return a+d*t;};
function flatShapeGeo(pts){
  const sh=new T.Shape();
  pts.forEach(([x,y],i)=>(i?sh.lineTo(x,y):sh.moveTo(x,y)));
  sh.closePath();
  return new T.ShapeGeometry(sh);
}
export function crearPajaros(){
  const root=new T.Group();
// Pajaros
  const N=16;
  const bodyMat=texMat((c,w,h)=>{
    const g=c.createLinearGradient(0,0,w,h);
    g.addColorStop(0,"#ffffff");g.addColorStop(.7,"#f5f2ea");g.addColorStop(1,"#dfd8c8");
    c.fillStyle=g;c.fillRect(0,0,w,h);
  },{roughness:.35,metalness:.04});
  const wingMat=texMat((c,w,h)=>{
    const g=c.createLinearGradient(0,0,w,h);
    g.addColorStop(0,"#ffffff");g.addColorStop(.65,"#f8f6f0");g.addColorStop(1,"#d8d0c0");
    c.fillStyle=g;c.fillRect(0,0,w,h);
  },{roughness:.32,metalness:.04});
  const beakMat=mat("#ffffff",{roughness:.24,metalness:.1});
  const cageBarMat=mat("#7e7669",{roughness:.30,metalness:.62});
  const cageRingMat=mat("#968e80",{roughness:.26,metalness:.65});
  const bodyGeo=new T.SphereGeometry(.125,5,3);
  const headGeo=new T.SphereGeometry(.092,4,3);
  const beakGeo=new T.ConeGeometry(.052,.17,3,1,true);
  const tailGeo=flatShapeGeo([[-.04,0],[.04,0],[.19,-.30],[-.19,-.30]]);
  const wingLGeo=flatShapeGeo([[0,0],[-.66,.28],[-.98,.14],[-.62,-.08],[-.22,-.14]]);
  const wingRGeo=flatShapeGeo([[0,0],[.66,.28],[.98,.14],[.62,-.08],[.22,-.14]]);
  const birds=[];
  for(let i=0;i<N;i++){
    const b=new T.Group();
    b.rotation.order="YXZ";
    root.add(b);
    const body=part(b,bodyGeo,bodyMat);
    body.scale.set(1.08,.96,2.15);
    part(b,headGeo,bodyMat,[0,.065,.20]);
    part(b,beakGeo,beakMat,[0,.055,.33],[Math.PI/2,0,0]);
    part(b,tailGeo,wingMat,[0,0,0],[Math.PI*.48,0,0]);
    const wings=[];
    for(const s of [-1,1]){
      const pivot=new T.Group();
      b.add(pivot);
      part(pivot,s<0?wingLGeo:wingRGeo,wingMat);
      wings.push({s,pivot});
    }
    const a=i*2.39996323;
    const rr=.22+.88*Math.sqrt((i+.5)/N);
    const dirX=-(0.55+rnd(i,6)*0.95);
    const sx=Math.cos(a)*rr, sy=-1.05+rnd(i,1)*1.65, sz=Math.sin(a)*rr;
    const phi=a+(rnd(i,5)-.5)*.9;
    const hd=7.5+rnd(i,3)*5.2;
    const ex=dirX*(4.8+rnd(i,7)*4.2)-Math.abs(Math.cos(phi))*hd*.28;
    const ey=4.6+rnd(i,4)*5.6;
    const ez=Math.sin(phi)*hd*.85;
    const dx=ex-sx, dy=ey-sy, dz=ez-sz;
    const yawFly=Math.atan2(dx,dz);
    const pitch=Math.atan2(dy,Math.hypot(dx,dz));
    const ti=.05+.36*rnd(i,2);
    birds.push({b,wingL:wings[0].pivot,wingR:wings[1].pivot,a,sx,sy,sz,dx,dy,dz,yawFly,pitch,ti});
  }
// Jaula
  const cage=new T.Group();
  root.add(cage);
  const bars=[];
  const nBars=12;
  for(let i=0;i<nBars;i++){
    const a=i/nBars*Math.PI*2,x=Math.cos(a),z=Math.sin(a);
    const g=new T.Group();
    g.position.set(x*1.58,-1.45,z*1.58);
    cage.add(g);
    tube(g,[[0,0,0],[0,1.95,0],[-x*.45,2.72,-z*.45],[-x*1.12,3.22,-z*1.12],[-x*1.58,3.40,-z*1.58]],.046,cageBarMat,7,3);
    bars.push({g,tan:new T.Vector3(-z,0,x),bx:x*1.58,bz:z*1.58,rx:x,rz:z});
  }
  const rings=new T.Group();
  cage.add(rings);
  const ringGeo=new T.TorusGeometry(1.58,.058,3,12);
  for(const y of [-1.45,-.62,.24,1.08]){
    part(rings,ringGeo,cageRingMat,[0,y,0],[Math.PI/2,0,0]);
  }
  part(rings,new T.CylinderGeometry(1.62,1.62,.08,12),cageBarMat,[0,-1.49,0]);
  const crown=part(cage,new T.TorusGeometry(.24,.052,4,8),cageRingMat,[0,1.95,0],[Math.PI/2,0,0]);
  const hook=part(cage,new T.TorusGeometry(.18,.042,4,8),cageRingMat,[0,2.22,0]);
  let curP=0, curT=0;
// Cierre
  function applyState(){
    const p=curP;
    const open=sm(.3,.55,p);
    const brk=sm(.55,.88,p);
    const exit=sm(.88,1,p);
    const fall=brk*brk;
    const cageVis=exit<1;
    cage.visible=cageVis;
    if(cageVis){
      cage.position.y=-exit*9;
      cage.rotation.y=open*.25*(1-brk);
      const barY=-1.45+open*0.3-fall*5.5;
      const zScale=open*0.6+fall*3.2;
      const xPosScale=open*0.14+fall*0.55;
      const tiltPos=open*0.42+brk*0.65;
      const tiltNeg=open*0.72+brk*1.15;
      for(let i=0;i<bars.length;i++){
        const {g,tan,bx,bz,rx,rz}=bars[i];
        g.quaternion.setFromAxisAngle(tan,-(rx>0?tiltPos:tiltNeg));
        const xOut=rx>0?rx*xPosScale:rx*zScale;
        g.position.set(bx+xOut,barY,bz+rz*zScale);
      }
      rings.visible=true;
      rings.position.y=open*1.6-fall*7;
      rings.rotation.x=brk*1.4;
      rings.scale.set(1+open*0.24,1,1+open*0.24);
      crown.visible=true;
      crown.position.y=1.95+open*1.4-brk*(1-brk)*4-fall*9;
      crown.rotation.z=brk*2.5;
      hook.visible=true;
      hook.position.y=2.22+open*1.8-brk*(1-brk)*4-fall*9;
      hook.rotation.z=-brk*3;
    }
    const timeTerm=curT*5+p*16;
    const rollBase=curT*1.5;
    for(let i=0;i<birds.length;i++){
      const {b,wingL,wingR,a,sx,sy,sz,dx,dy,dz,yawFly,pitch,ti}=birds[i];
      const s=sm(ti,.98,p);
      const vis=s<0.995;
      b.visible=vis;
      if(!vis)continue;
      const e=Math.pow(s,1.25);
      const sFade=sm(0,.2,s)*(1-sm(.82,.995,s));
      const waveY=Math.sin(s*Math.PI*2.2+i)*.38*sFade;
      const waveX=Math.cos(s*Math.PI*1.6+i)*.22*sFade;
      const px=sx+dx*e+waveX;
      const py=sy+dy*e+Math.sin(s*Math.PI)*.65+waveY;
      const pz=sz+dz*e;
      b.position.set(px,py,pz);
      const turn=sm(0,.14,s);
      b.rotation.set(-pitch*turn*.75,lerpAngle(-a,yawFly,turn),Math.sin(rollBase+i)*.1*turn);
      b.scale.setScalar(1.05-.12*s);
      const amp=.18+.68*sm(0,.08,s);
      const beat=Math.sin(timeTerm+i*1.3)*amp;
      const wAng=.16+beat;
      wingL.rotation.z=-wAng;
      wingR.rotation.z=wAng;
    }
  }
// Estado
  return {
    root,
    kind:"pajaros",
    animated:true,
    fitStates:[0, 0.12],
    frame(now){ curT=(now||0)*0.001; },
    update(p){ curP=p; applyState(); }
  };
}
