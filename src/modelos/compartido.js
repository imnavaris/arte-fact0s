import * as T from 'three';
export {T};
// Utiles
export const mat=(color='#dfdbc8',extra={})=>new T.MeshStandardMaterial({color,roughness:.62,metalness:.12,side:T.DoubleSide,...extra});
export function texMat(drawFn,extra={},w=256,h=256){
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 const ctx=cv.getContext('2d');drawFn(ctx,w,h);
 const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;tex.needsUpdate=true;
 return new T.MeshStandardMaterial({map:tex,roughness:.6,metalness:.1,side:T.DoubleSide,...extra});
}
export function part(root,geo,material,pos=[0,0,0],rot=[0,0,0]){const m=new T.Mesh(geo,material);m.position.set(...pos);m.rotation.set(...rot);root.add(m);return m;}
export const box=(r,size,m,p=[0,0,0],rot=[0,0,0])=>part(r,new T.BoxGeometry(...size),m,p,rot);
export function tube(root,points,r,m,tubularSegments=20,radialSegments=7){return part(root,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(pt=>new T.Vector3(...pt))),tubularSegments,r,radialSegments,false),m);}
export function shape(root,points,depth,m){const s=new T.Shape();s.moveTo(...points[0]);for(const p of points.slice(1))s.lineTo(...p);s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025});g.translate(0,0,-depth/2);return part(root,g,m);}
export function surface(root,nu,nv,fn,m,flip=false){
 const p=[],uvs=[],idx=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){p.push(...fn(i/nu,j/nv));uvs.push(i/nu,1-j/nv);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
  const a=j*(nu+1)+i,b=a+nu+1;
  if(flip)idx.push(a,a+1,b,b,a+1,b+1);
  else idx.push(a,b,a+1,b,b+1,a+1);
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 g.setIndex(idx);
 g.computeVertexNormals();
 return part(root,g,m);
}
export function morph(mesh,nu,nv,fn){
 const p=mesh.geometry.attributes.position;let k=0;
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const xyz=fn(i/nu,j/nv);p.setXYZ(k++,...xyz);}
 p.needsUpdate=true;mesh.geometry.computeVertexNormals();
}
export function paperTone(shade = 1, extra = {}) {
  const t = 0.56 + 0.34 * Math.min(1, Math.max(0, shade));
  const R = Math.round(255 * t);
  const G = Math.round(244 * t);
  const B = Math.round(224 * t);
  const hex = '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
  return mat(hex, extra);
}

// Levitacion
export const LEVITATION_PERIOD = 5.0;
export const LEVITATION_AMPLITUDE = 0.065;
export const LEVITATION_REF_SPAN = 2.15;

export function levitationBob(timeSec, scale = 1) {
  return Math.sin(((timeSec || 0) / LEVITATION_PERIOD) * Math.PI * 2) * (LEVITATION_AMPLITUDE * scale);
}

export function applyPolygonLevitation(polygons, bobZ) {
  if (!bobZ) return polygons;
  return polygons.map((poly) => ({
    ...poly,
    vertices: poly.vertices.map(([x, y, z]) => [x, y, z + bobZ]),
  }));
}

export function applyPolygonLevitationInPlace(polygons, bobZ) {
  if (!bobZ) return polygons;
  for (let i = 0; i < polygons.length; i++) {
    const verts = polygons[i].vertices;
    for (let k = 0; k < verts.length; k++) {
      verts[k][2] += bobZ;
    }
  }
  return polygons;
}

export function preparePoemLines(text) {
  const rawLines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s+/).join('·') + '·');
  if (rawLines.length === 1 && rawLines[0].length > 44) {
    const words = rawLines[0].slice(0, -1).split('·').filter(Boolean);
    const numLines = Math.max(2, Math.ceil(rawLines[0].length / 36));
    if (words.length >= numLines) {
      const wrapped = [];
      let idx = 0;
      let remLen = words.reduce((acc, w) => acc + w.length + 1, 0);
      for (let li = 0; li < numLines; li++) {
        const linesLeft = numLines - li;
        const target = remLen / linesLeft;
        let cur = '';
        while (idx < words.length) {
          const wordsAfter = words.length - idx - 1;
          if (wordsAfter < linesLeft - 1) break;
          const w = words[idx];
          const cand = cur ? `${cur}·${w}` : w;
          if (!cur) {
            cur = w;
            idx++;
            if (linesLeft > 1 && cand.length + 1 >= target) break;
            continue;
          }
          if (linesLeft === 1) {
            cur = cand;
            idx++;
            continue;
          }
          const diffCur = Math.abs(target - (cur.length + 1));
          const diffCand = Math.abs(target - (cand.length + 1));
          if (cand.length + 1 <= target || diffCand <= diffCur) {
            cur = cand;
            idx++;
            if (cand.length + 1 >= target) break;
          } else {
            break;
          }
        }
        if (cur) {
          wrapped.push(`${cur}·`);
          remLen -= cur.length + 1;
        }
      }
      if (wrapped.length) return wrapped;
    }
  }
  return rawLines;
}

const POEM_ROW_CACHE = new WeakMap();

export function getPoemRowLookup(lines, rows) {
  const nLines = lines ? lines.length : 0;
  if (!nLines || rows <= 0) return null;
  let cached = POEM_ROW_CACHE.get(lines);
  if (cached && cached.rows >= rows) return cached;
  const rowStrs = new Array(rows);
  const rowOffs = new Int32Array(rows);
  const rowLens = new Int32Array(rows);
  for (let r = 0; r < rows; r++) {
    const line = lines[r % nLines];
    const len = line.length;
    rowStrs[r] = line;
    rowLens[r] = len;
    rowOffs[r] = len > 0 ? (Math.floor(r / nLines) * 7) % len : 0;
  }
  cached = { rows, rowStrs, rowOffs, rowLens };
  POEM_ROW_CACHE.set(lines, cached);
  return cached;
}

export function poemCharAt(lines, r, c) {
  const nLines = lines ? lines.length : 0;
  if (!nLines) return '';
  const line = lines[r % nLines];
  const len = line.length;
  if (!len) return '';
  const rowOffset = (Math.floor(r / nLines) * 7) % len;
  return line[(c + rowOffset) % len];
}
