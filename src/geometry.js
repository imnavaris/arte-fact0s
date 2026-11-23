import * as T from 'three';

const SAMPLERS = new WeakMap();
const GEO_COLOR_CACHE = new WeakMap();
let texVersion = 0;

// Muestreo
function samplerFor(texture) {
  if (!texture) return null;
  if (SAMPLERS.has(texture)) return SAMPLERS.get(texture);
  const img = texture.image;
  let sample = null;
  if (img && typeof img.getContext === 'function') {
    const w = img.width, h = img.height;
    const data = img.getContext('2d').getImageData(0, 0, w, h).data;
    sample = (u, v) => {
      const x = Math.min(w - 1, Math.max(0, Math.round(u * (w - 1))));
      const y = Math.min(h - 1, Math.max(0, Math.round((1 - v) * (h - 1))));
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
  }
  SAMPLERS.set(texture, sample);
  return sample;
}

export function invalidateTexture(texture) {
  SAMPLERS.delete(texture);
  texVersion++;
}

const hex = (r, g, b) => '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
// Papel
const PAPER_LUT = Array.from({ length: 256 }, (_, l) => {
  const t = 0.20 + 0.80 * Math.pow(l / 255, 0.85);
  return hex(Math.round(255 * t), Math.round(250 * t), Math.round(240 * t));
});
const GRAY_LUT = Array.from({ length: 256 }, (_, l) => hex(l, l, l));

function clampPaperColor(r, g, b, allowEmber = false) {
  if (allowEmber) return '#d99b26';
  const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return PAPER_LUT[Math.min(255, Math.max(0, lum))];
}

// Colores
function getTriColors(geo, mat, idx, pos, uv, sample, fixed, noise, isEmber, triCount) {
  const baseHex = mat && mat.color ? mat.color.getHex() : 0xffffff;
  const key = `${fixed || baseHex}|${noise ? 1 : 0}|${isEmber ? 1 : 0}|${sample ? texVersion : -1}|${triCount}`;
  let matMap = GEO_COLOR_CACHE.get(geo);
  if (!matMap) {
    matMap = new Map();
    GEO_COLOR_CACHE.set(geo, matMap);
  }
  const matKey = mat || null;
  const cached = matMap.get(matKey);
  if (cached && cached.key === key) return cached.colors;

  const baseR = (baseHex >> 16) & 255;
  const baseG = (baseHex >> 8) & 255;
  const baseB = baseHex & 255;
  const colors = new Array(triCount);

  if (fixed) {
    colors.fill(fixed);
  } else if (!uv || !sample) {
    let col;
    if (noise) {
      const l = Math.round(0.299 * baseR + 0.587 * baseG + 0.114 * baseB);
      col = GRAY_LUT[Math.min(255, Math.max(0, l))];
    } else {
      col = clampPaperColor(baseR, baseG, baseB, isEmber);
    }
    colors.fill(col);
  } else {
    const idxArr = idx && !idx.isInterleavedBufferAttribute ? idx.array : null;
    for (let t = 0; t < triCount; t++) {
      const baseI = t * 3;
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < 3; k++) {
        const vi = idxArr ? idxArr[baseI + k] : idx ? idx.getX(baseI + k) : baseI + k;
        const c = sample(uv.getX(vi), uv.getY(vi));
        r += c[0];
        g += c[1];
        b += c[2];
      }
      const rawR = Math.round(r / 3);
      const rawG = Math.round(g / 3);
      const rawB = Math.round(b / 3);
      if (noise) {
        const l = Math.round(0.299 * rawR + 0.587 * rawG + 0.114 * rawB);
        colors[t] = GRAY_LUT[Math.min(255, Math.max(0, l))];
      } else {
        colors[t] = clampPaperColor(rawR, rawG, rawB, isEmber);
      }
    }
  }
  matMap.set(matKey, { key, colors });
  return colors;
}

// Conversor
const _v = new T.Vector3();
let _vBuf = new Float64Array(4096 * 3);

export function toGlyphPolygons(root, opts = {}) {
  const out = [];
  const hasOffset = Array.isArray(opts.centerOffset);
  const cx = hasOffset ? opts.centerOffset[0] : 0;
  const cy = hasOffset ? opts.centerOffset[1] : 0;
  const cz = hasOffset ? opts.centerOffset[2] : 0;

  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.visible || mesh.userData.asciiSkip) return;
    const geo = mesh.geometry;
    const mat = mesh.material;
    const pos = geo.attributes && geo.attributes.position;
    if (!pos) return;
    const idx = geo.index;
    const uv = geo.attributes.uv;
    const sample = samplerFor(mat && mat.map);
    const fixed = mat && mat.userData && mat.userData.fixedColor;
    const noise = Boolean(mesh.userData.glyphNoise);
    const isEmber = Boolean(mat && mat.userData && mat.userData.isEmber);
    const excludeCenter = Boolean(
      mesh.userData.excludeCenter ||
      (mesh.parent && mesh.parent.userData && mesh.parent.userData.excludeCenter),
    );
    const roughness = mat && Number.isFinite(mat.roughness) ? mat.roughness : 0.62;
    const metalness = mat && Number.isFinite(mat.metalness) ? mat.metalness : 0.12;
    const unlit = Boolean(fixed || (mat && mat.userData && mat.userData.unlit));
    const count = idx ? idx.count : pos.count;
    const triCount = (count / 3) | 0;
    if (triCount <= 0) return;

    const colors = getTriColors(geo, mat, idx, pos, uv, sample, fixed, noise, isEmber, triCount);

    const vCount = pos.count;
    if (_vBuf.length < vCount * 3) _vBuf = new Float64Array(vCount * 3);
    const me = mesh.matrixWorld.elements;
    const m0 = me[0], m1 = me[1], m2 = me[2];
    const m4 = me[4], m5 = me[5], m6 = me[6];
    const m8 = me[8], m9 = me[9], m10 = me[10];
    const m12 = me[12], m13 = me[13], m14 = me[14];

    if (!pos.isInterleavedBufferAttribute && pos.itemSize === 3) {
      const pa = pos.array;
      for (let vi = 0, o = 0; vi < vCount; vi++, o += 3) {
        const vx = pa[o];
        const vy = pa[o + 1];
        const vz = pa[o + 2];
        const wx = m0 * vx + m4 * vy + m8 * vz + m12;
        const wy = m1 * vx + m5 * vy + m9 * vz + m13;
        const wz = m2 * vx + m6 * vy + m10 * vz + m14;
        _vBuf[o] = wx - cx;
        _vBuf[o + 1] = -wz - cy;
        _vBuf[o + 2] = wy - cz;
      }
    } else {
      for (let vi = 0, o = 0; vi < vCount; vi++, o += 3) {
        _v.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrixWorld);
        _vBuf[o] = _v.x - cx;
        _vBuf[o + 1] = -_v.z - cy;
        _vBuf[o + 2] = _v.y - cz;
      }
    }

    const idxArr = idx && !idx.isInterleavedBufferAttribute ? idx.array : null;
    for (let t = 0; t < triCount; t++) {
      const baseI = t * 3;
      const o0 = (idxArr ? idxArr[baseI] : idx ? idx.getX(baseI) : baseI) * 3;
      const o1 = (idxArr ? idxArr[baseI + 1] : idx ? idx.getX(baseI + 1) : baseI + 1) * 3;
      const o2 = (idxArr ? idxArr[baseI + 2] : idx ? idx.getX(baseI + 2) : baseI + 2) * 3;
      out.push({
        vertices: [
          [_vBuf[o0], _vBuf[o0 + 1], _vBuf[o0 + 2]],
          [_vBuf[o1], _vBuf[o1 + 1], _vBuf[o1 + 2]],
          [_vBuf[o2], _vBuf[o2 + 1], _vBuf[o2 + 2]],
        ],
        color: colors[t],
        roughness,
        metalness,
        unlit,
        excludeCenter,
      });
    }
  });
  if (opts.center === false || hasOffset) return out;
  return center(out);
}

// Centro
export function computeCenter(polygons) {
  if (!polygons.length) return [0, 0, 0];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let matched = 0;
  for (let i = 0; i < polygons.length; i++) {
    const p = polygons[i];
    if (p.excludeCenter) continue;
    matched++;
    const verts = p.vertices;
    for (let k = 0; k < verts.length; k++) {
      const v = verts[k];
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
  }
  if (!matched) {
    for (let i = 0; i < polygons.length; i++) {
      const verts = polygons[i].vertices;
      for (let k = 0; k < verts.length; k++) {
        const v = verts[k];
        if (v[0] < minX) minX = v[0];
        if (v[0] > maxX) maxX = v[0];
        if (v[1] < minY) minY = v[1];
        if (v[1] > maxY) maxY = v[1];
        if (v[2] < minZ) minZ = v[2];
        if (v[2] > maxZ) maxZ = v[2];
      }
    }
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
}

function translateCenter(polygons, [cx, cy, cz]) {
  for (let i = 0; i < polygons.length; i++) {
    const verts = polygons[i].vertices;
    for (let k = 0; k < verts.length; k++) {
      const v = verts[k];
      v[0] -= cx;
      v[1] -= cy;
      v[2] -= cz;
    }
  }
  return polygons;
}

function center(polygons) {
  if (!polygons.length) return polygons;
  return translateCenter(polygons, computeCenter(polygons));
}

export function bounds(polygons) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < polygons.length; i++) {
    const verts = polygons[i].vertices;
    for (let k = 0; k < verts.length; k++) {
      const v = verts[k];
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}