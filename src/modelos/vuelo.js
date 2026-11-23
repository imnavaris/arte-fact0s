import {T,mat,texMat,box,part,tube} from './compartido.js';

const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

export function crearVuelo(){
 const root=new T.Group();

// Fuselaje
 const fuselageMat=texMat((c,w,h)=>{
 const g=c.createLinearGradient(0,0,0,h);
 g.addColorStop(0,'#f2efe6');g.addColorStop(.45,'#dfd8c8');g.addColorStop(.55,'#b8b0a0');
 g.addColorStop(.75,'#968e80');g.addColorStop(1,'#787062');
 c.fillStyle=g;c.fillRect(0,0,w,h);
 },{roughness:.46,metalness:.28});
 const wingMat=texMat((c,w,h)=>{
 const g=c.createLinearGradient(0,0,w,h);
 g.addColorStop(0,'#f5f2ea');g.addColorStop(.45,'#e6dfd1');g.addColorStop(.85,'#bfb7a7');g.addColorStop(1,'#968e80');
 c.fillStyle=g;c.fillRect(0,0,w,h);
 },{roughness:.38,metalness:.55});
 const tailFinMat=texMat((c,w,h)=>{
 const g=c.createLinearGradient(0,0,w,h);
 g.addColorStop(0,'#ebe4d6');g.addColorStop(.5,'#d8d0c0');g.addColorStop(1,'#8e8678');
 c.fillStyle=g;c.fillRect(0,0,w,h);
 },{roughness:.44,metalness:.30});

 const nacelleMat=mat('#b8b0a0',{roughness:.36,metalness:.6});
 const darkMetal=mat('#7c7466',{roughness:.45,metalness:.5});
 const glassMat=mat('#524d44',{roughness:.22,metalness:.4});
 const propTipMat=mat('#ebe4d6',{roughness:.32,metalness:.55});
 
 const rampMat=mat('#f7f3e8',{roughness:.34,metalness:.28});
 const rampRibMat=mat('#c8c0b0',{roughness:.42,metalness:.4});
 
 const voidMat=mat('#22201d',{roughness:1,metalness:0});
 voidMat.userData={fixedColor:'#22201d',unlit:true};

 
 box(root,[2.75,.94,1.08],fuselageMat,[-.15,-.02,0]);
 
 box(root,[.72,.10,1.08],fuselageMat,[1.36,.41,0]);
 for(const s of [-1,1]){
 box(root,[.72,.88,.09],fuselageMat,[1.36,-.02,s*.50]);
 }
 
 box(root,[.06,.78,.88],voidMat,[1.18,-.02,0]);
 box(root,[.54,.76,.04],voidMat,[1.38,-.02,-.42]);
 box(root,[.54,.76,.04],voidMat,[1.38,-.02,.42]);

 const nose=part(root,new T.SphereGeometry(.65,14,10),fuselageMat,[-1.55,-.06,0]);
 nose.scale.set(.85,.69,.8);
 box(root,[.7,.48,.9],fuselageMat,[-1.25,.5,0],[0,0,-.28]);

 for(const s of [-1,1]){
 box(root,[.52,.26,.025],glassMat,[-1.34,.47,s*.48],[0,0,-.2]);
 for(let i=0;i<5;i++)box(root,[.20,.22,.028],glassMat,[-.75+i*.43,.14,s*.55]);
 }

 
 box(root,[1.05,.12,5.6],wingMat,[-.12,.66,0]);
 box(root,[.86,.09,2.82],wingMat,[1.42,.48,0]);

 for(const s of [-1,1]){
 
 box(root,[.76,1.18,.10],tailFinMat,[1.42,.68,s*1.36]);
 part(root,new T.CylinderGeometry(.20,.20,.80,12),nacelleMat,[-.2,.55,s*1.3],[0,0,Math.PI/2]);
 part(root,new T.ConeGeometry(.20,.28,12),darkMetal,[-.72,.55,s*1.3],[0,0,Math.PI/2]);
 tube(root,[[0,-.35,s*.52],[-.08,.64,s*1.45]],.034,wingMat,12,5);
 tube(root,[[.12,-.42,s*.48],[.15,-.88,s*1.74]],.048,darkMetal,12,5);
 part(root,new T.CylinderGeometry(.20,.20,.16,12),darkMetal,[.15,-.88,s*1.75],[Math.PI/2,0,0]);
 }

 part(root,new T.CylinderGeometry(.15,.15,.13,12),darkMetal,[-1.45,-.82,0],[Math.PI/2,0,0]);
 tube(root,[[-1.38,-.4,0],[-1.45,-.82,0]],.038,darkMetal,12,5);

// Helices
 const props=[];
 for(const s of [-1,1]){
 const p=new T.Group();
 p.position.set(-.86,.55,s*1.3);
 root.add(p);
 box(p,[.035,.86,.08],propTipMat);
 box(p,[.035,.08,.86],propTipMat);
 props.push(p);
 }

 
// Rampa
 const ramp=new T.Group();
 ramp.position.set(1.68,-.44,0);
 root.add(ramp);
 box(ramp,[.08,1.28,1.02],rampMat,[0,.64,0]);
 for(const y of [.22,.48,.74,1.0,1.2])box(ramp,[.11,.05,.96],rampRibMat,[0,y,0]);
 for(const s of [-1,1]){
 box(ramp,[.12,1.28,.07],rampMat,[0,.64,s*.49]);
 }

 
 const struts=new T.Group();
 root.add(struts);
 for(const s of [-1,1]){
 tube(struts,[[1.52,.22,s*.46],[2.25,-.62,s*.46]],.032,propTipMat,8,5);
 }

 root.rotation.set(.34,-.78,-.06);
 root.scale.setScalar(.9);

 return {
 root,
 kind:'vuelo',
  animated:true,
  fitStates:[0,0.5,1.0],
  frame(now){ this._t=(now||0)*0.001; },
// Vuelo
 update(p){
  const t=this._t||0;
  const turn=sm(.04,.70,p);
  const open=sm(.16,.76,p);
  ramp.rotation.z=-open*Math.PI*.68;
  struts.visible=open>.22;
  props[0].rotation.x = -(p*12+t*3.5);
  props[1].rotation.x = p*12+t*3.5;
  root.rotation.y=-1.60+turn*1.24;
  root.rotation.x=.08*(1-turn);
  root.rotation.z=-.04+turn*.08;
 }
 };
}