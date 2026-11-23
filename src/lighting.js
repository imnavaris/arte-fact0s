// Iluminacion
function norm3([x, y, z]) {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function makeRig(cfg) {
  return {
    keyDir: norm3(cfg.keyDir),
    keyIntensity: cfg.keyIntensity,
    fillDir: norm3(cfg.fillDir),
    fillIntensity: cfg.fillIntensity,
    rimDir: norm3(cfg.rimDir),
    rimIntensity: cfg.rimIntensity,
    hemiSky: cfg.hemiSky,
    hemiGround: cfg.hemiGround,
    specScale: cfg.specScale,
    wrap: cfg.wrap,
    minFloor: cfg.minFloor,
  };
}

export const LIGHT_RIGS = {
  default: makeRig({
    keyDir: [0.54, -0.38, 0.75],
    keyIntensity: 0.94,
    fillDir: [-0.62, 0.40, 0.67],
    fillIntensity: 0.26,
    rimDir: [-0.42, 0.72, 0.55],
    rimIntensity: 0.40,
    hemiSky: 0.24,
    hemiGround: 0.10,
    specScale: 0.28,
    wrap: 0.24,
    minFloor: 0.25,
  }),
  libro: makeRig({
    keyDir: [0.55, -0.45, 0.70],
    keyIntensity: 0.92,
    fillDir: [-0.65, 0.35, 0.67],
    fillIntensity: 0.24,
    rimDir: [-0.35, 0.65, 0.67],
    rimIntensity: 0.28,
    hemiSky: 0.24,
    hemiGround: 0.10,
    specScale: 0.18,
    wrap: 0.28,
    minFloor: 0.26,
  }),
  silueta: makeRig({
    keyDir: [0.54, -0.38, 0.75],
    keyIntensity: 0.94,
    fillDir: [-0.42, 0.68, 0.60],
    fillIntensity: 0.26,
    rimDir: [-0.68, -0.32, 0.66],
    rimIntensity: 0.42,
    hemiSky: 0.24,
    hemiGround: 0.10,
    specScale: 0.28,
    wrap: 0.24,
    minFloor: 0.26,
  }),
  tijeras: makeRig({
    keyDir: [-0.38, -0.62, 0.68],
    keyIntensity: 0.98,
    fillDir: [0.72, -0.42, 0.55],
    fillIntensity: 0.22,
    rimDir: [0.45, 0.65, 0.61],
    rimIntensity: 0.48,
    hemiSky: 0.22,
    hemiGround: 0.08,
    specScale: 0.56,
    wrap: 0.16,
    minFloor: 0.24,
  }),
  tv: makeRig({
    keyDir: [-0.34, -0.82, 0.45],
    keyIntensity: 0.98,
    fillDir: [0.35, 0.84, 0.41],
    fillIntensity: 0.56,
    rimDir: [0.30, 0.65, 0.70],
    rimIntensity: 0.52,
    hemiSky: 0.28,
    hemiGround: 0.18,
    specScale: 0.68,
    wrap: 0.32,
    minFloor: 0.32,
  }),
  pajaros: makeRig({
    keyDir: [0.45, 0.62, 0.64],
    keyIntensity: 0.95,
    fillDir: [-0.65, 0.60, 0.46],
    fillIntensity: 0.26,
    rimDir: [-0.30, -0.72, 0.62],
    rimIntensity: 0.44,
    hemiSky: 0.25,
    hemiGround: 0.10,
    specScale: 0.38,
    wrap: 0.24,
    minFloor: 0.24,
  }),
  vuelo: makeRig({
    keyDir: [0.28, 0.62, 0.73],
    keyIntensity: 0.98,
    fillDir: [0.78, 0.45, -0.43],
    fillIntensity: 0.24,
    rimDir: [-0.55, -0.42, 0.72],
    rimIntensity: 0.46,
    hemiSky: 0.22,
    hemiGround: 0.10,
    specScale: 0.54,
    wrap: 0.18,
    minFloor: 0.24,
  }),
};

// Camara
export function cameraViewDir(camera) {
  const rx = ((camera?.rotX ?? 65) * Math.PI) / 180;
  const ry = ((camera?.rotY ?? 45) * Math.PI) / 180;
  const sx = Math.sin(rx);
  return [Math.cos(ry) * sx, Math.sin(ry) * sx, Math.cos(rx)];
}

const HEX_NIBBLE = new Int8Array(128).fill(-1);
for (let i = 0; i < 10; i++) HEX_NIBBLE[48 + i] = i;
for (let i = 0; i < 6; i++) {
  HEX_NIBBLE[65 + i] = 10 + i;
  HEX_NIBBLE[97 + i] = 10 + i;
}

function parseHexBytes(col) {
  if (typeof col !== 'string' || col.length !== 7 || col.charCodeAt(0) !== 35) return 0xded9cf;
  const r0 = HEX_NIBBLE[col.charCodeAt(1)];
  const r1 = HEX_NIBBLE[col.charCodeAt(2)];
  const g0 = HEX_NIBBLE[col.charCodeAt(3)];
  const g1 = HEX_NIBBLE[col.charCodeAt(4)];
  const b0 = HEX_NIBBLE[col.charCodeAt(5)];
  const b1 = HEX_NIBBLE[col.charCodeAt(6)];
  if ((r0 | r1 | g0 | g1 | b0 | b1) < 0) return 0xded9cf;
  return (((r0 << 4) | r1) << 16) | (((g0 << 4) | g1) << 8) | ((b0 << 4) | b1);
}

const HEX_STR = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const FRESNEL_LUT = Float32Array.from({ length: 1025 }, (_, i) => Math.pow(1 - i / 1024, 2.4));
const INV_255 = 1 / 255;

function shoulder(x) {
  return x <= 0.75 ? x : 0.75 + (x - 0.75) / (1 + 1.15 * (x - 0.75));
}

export function shadePolygons(polygons, camera, rig = LIGHT_RIGS.default, doubleSided = true, slotPool = null) {
  if (!polygons || !polygons.length) return polygons;
  const activeRig = rig || LIGHT_RIGS.default;
  const [vx, vy, vz] = cameraViewDir(camera);
  const [kx, ky, kz] = activeRig.keyDir;
  const [fx, fy, fz] = activeRig.fillDir;
  const [rx, ry, rz] = activeRig.rimDir;
  let hx = kx + vx;
  let hy = ky + vy;
  let hz = kz + vz;
  const hLen = Math.hypot(hx, hy, hz) || 1;
  hx /= hLen;
  hy /= hLen;
  hz /= hLen;

  const {
    keyIntensity,
    fillIntensity,
    rimIntensity,
    hemiSky,
    hemiGround,
    specScale,
    wrap,
    minFloor,
  } = activeRig;
  const invWrap = 1 / (1 + wrap);
  const hemiDelta = hemiSky - hemiGround;
  const out = new Array(polygons.length);

  for (let i = 0; i < polygons.length; i++) {
    const poly = polygons[i];
    if (!poly || poly.unlit || !poly.vertices || poly.vertices.length < 3) {
      out[i] = poly;
      continue;
    }
    const verts = poly.vertices;
    const v0 = verts[0];
    const v1 = verts[1];
    let v2 = verts[2];
    const ax = v1[0] - v0[0];
    const ay = v1[1] - v0[1];
    const az = v1[2] - v0[2];
    let bx = v2[0] - v0[0];
    let by = v2[1] - v0[1];
    let bz = v2[2] - v0[2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    let nLen = Math.hypot(nx, ny, nz);
    if (nLen < 1e-8 && verts.length > 3) {
      v2 = verts[3];
      bx = v2[0] - v0[0];
      by = v2[1] - v0[1];
      bz = v2[2] - v0[2];
      nx = ay * bz - az * by;
      ny = az * bx - ax * bz;
      nz = ax * by - ay * bx;
      nLen = Math.hypot(nx, ny, nz);
    }
    if (nLen < 1e-8) {
      nx = vx;
      ny = vy;
      nz = vz;
    } else {
      const invLen = 1 / nLen;
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;
    }

    let ndv = nx * vx + ny * vy + nz * vz;
    if (doubleSided && ndv < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
      ndv = -ndv;
    }

    const packed = parseHexBytes(poly.color);
    const ar = ((packed >> 16) & 255) * INV_255;
    const ag = ((packed >> 8) & 255) * INV_255;
    const ab = (packed & 255) * INV_255;

    const ndotl = nx * kx + ny * ky + nz * kz;
    const keyDiff = ndotl + wrap > 0 ? (ndotl + wrap) * invWrap : 0;
    const fillDot = nx * fx + ny * fy + nz * fz;
    const fillDiff = fillDot > 0 ? fillDot : 0;
    const hemi = hemiGround + hemiDelta * (0.5 + 0.5 * nz);
    const viewBounce = ndv > 0 ? 0.08 * ndv : 0;
    const sumDiff = hemi + viewBounce + keyDiff * keyIntensity + fillDiff * fillIntensity;
    const diffLum = sumDiff > minFloor ? sumDiff : minFloor;

    const rough = clamp01(poly.roughness ?? 0.62);
    const metal = clamp01(poly.metalness ?? 0.12);
    const ndoth = nx * hx + ny * hy + nz * hz;
    let spec = 0;
    if (ndoth > 0.01) {
      const oneMinusR = 1 - rough;
      const shininess = 8 + oneMinusR * oneMinusR * 96;
      spec =
        Math.pow(ndoth, shininess) *
        specScale *
        (0.28 + 0.95 * metal) *
        (0.35 + (ndotl > 0 ? 0.65 * ndotl : 0));
    }

    const absNdv = ndv < 0 ? -ndv : ndv;
    const fresnel = FRESNEL_LUT[absNdv >= 1 ? 1024 : (absNdv * 1024 + 0.5) | 0];
    const rimDot = nx * rx + ny * ry + nz * rz;
    const rim = fresnel * (0.35 + (rimDot > 0 ? 0.65 * rimDot : 0)) * rimIntensity;

    const specTint = 0.7 * metal;
    const sr = 1 - specTint + specTint * ar;
    const sg = 1 - specTint + specTint * ag;
    const sb = 1 - specTint + specTint * ab;

    const add = spec + rim;
    const lr = shoulder(ar * diffLum + add * sr);
    const lg = shoulder(ag * diffLum * 0.985 + add * sg * 0.985);
    const lb = shoulder(ab * diffLum * 0.955 + add * sb * 0.955);

    const baseLum = ar > ag ? (ar > ab ? ar : ab) : (ag > ab ? ag : ab);
    const floorByte = Math.max(46, (baseLum * minFloor * 255 + 0.5) | 0);
    const rRaw = (lr * 255 + 0.5) | 0;
    const gRaw = (lg * 255 + 0.5) | 0;
    const bRaw = (lb * 255 + 0.5) | 0;
    const R = rRaw > 255 ? 255 : rRaw < floorByte ? floorByte : rRaw;
    const gMin = (floorByte * 0.98 + 0.5) | 0;
    const G = gRaw > R ? R : gRaw < gMin ? gMin : gRaw;
    const bMin = (floorByte * 0.94 + 0.5) | 0;
    const B = bRaw > G ? G : bRaw < bMin ? bMin : bRaw;
    const colHex = `#${HEX_STR[R]}${HEX_STR[G]}${HEX_STR[B]}`;
    if (slotPool) {
      let slot = slotPool[i];
      if (!slot) {
        slot = { vertices: poly.vertices, color: colHex, roughness: poly.roughness, metalness: poly.metalness, unlit: poly.unlit };
        slotPool[i] = slot;
      } else {
        slot.vertices = poly.vertices;
        slot.color = colHex;
        slot.roughness = poly.roughness;
        slot.metalness = poly.metalness;
        slot.unlit = poly.unlit;
      }
      out[i] = slot;
    } else {
      out[i] = { ...poly, color: colHex };
    }
  }
  return out;
}

export function shadeWarmTone(ar, ag, ab, litRatio, floorLum = 56) {
  const s = shoulder(litRatio);
  const R = Math.min(255, Math.max(floorLum, Math.round(ar * s * 255)));
  const G = Math.min(R, Math.max(Math.round(floorLum * 0.98), Math.round(ag * s * 0.985 * 255)));
  const B = Math.min(G, Math.max(Math.round(floorLum * 0.94), Math.round(ab * s * 0.955 * 255)));
  return `#${HEX_STR[R]}${HEX_STR[G]}${HEX_STR[B]}`;
}

export function buildWarmToneLut(ar, ag, ab, floorLum = 56, maxRatio = 2.0, steps = 1024) {
  const lut = new Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    lut[i] = shadeWarmTone(ar, ag, ab, (i / steps) * maxRatio, floorLum);
  }
  return lut;
}

// Oclusion
export function applyDepthCreviceAO(grid, occ, extent, skipColorFn = null, depthRange = null) {
  if (!extent || !occ || !grid.depth || !grid.color) return;
  const { cols, rows, depth, color } = grid;
  const { minR, maxR, minC, maxC } = extent;
  let minD = depthRange ? depthRange.minD : Infinity;
  let maxD = depthRange ? depthRange.maxD : -Infinity;
  if (!depthRange) {
    for (let r = minR; r <= maxR; r++) {
      const off = r * cols;
      for (let c = minC; c <= maxC; c++) {
        const i = off + c;
        if (!occ[i]) continue;
        const d = depth[i];
        if (Number.isFinite(d)) {
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        }
      }
    }
  }
  const dSpan = maxD - minD;
  if (!(dSpan > 1e-4)) return;
  const scale = 1 / (dSpan * 0.16);

  for (let r = minR; r <= maxR; r++) {
    const off = r * cols;
    const hasUp = r > 0;
    const hasDn = r + 1 < rows;
    for (let c = minC; c <= maxC; c++) {
      const i = off + c;
      if (!occ[i] || occ[i] === 2) continue;
      const col = color[i];
      if (!col || col.length !== 7 || col.charCodeAt(0) !== 35) continue;
      if (skipColorFn && skipColorFn(col)) continue;
      const d = depth[i];
      if (!Number.isFinite(d)) continue;

      let occSum = 0;
      if (hasUp && occ[i - cols]) {
        const delta = (depth[i - cols] - d) * scale;
        if (delta > 0) occSum += delta > 1 ? 1 : delta;
      }
      if (hasDn && occ[i + cols]) {
        const delta = (depth[i + cols] - d) * scale;
        if (delta > 0) occSum += delta > 1 ? 1 : delta;
      }
      if (c > 0 && occ[i - 1]) {
        const delta = (depth[i - 1] - d) * scale;
        if (delta > 0) occSum += delta > 1 ? 1 : delta;
      }
      if (c + 1 < cols && occ[i + 1]) {
        const delta = (depth[i + 1] - d) * scale;
        if (delta > 0) occSum += delta > 1 ? 1 : delta;
      }

      if (occSum <= 0.04) continue;
      const ao = 1 - Math.min(0.28, occSum * 0.11);
      const packed = parseHexBytes(col);
      const r0 = (packed >> 16) & 255;
      const g0 = (packed >> 8) & 255;
      const b0 = packed & 255;
      const rRaw = (r0 * ao + 0.5) | 0;
      const gRaw = (g0 * ao + 0.5) | 0;
      const bRaw = (b0 * ao + 0.5) | 0;
      const R = rRaw > 255 ? 255 : rRaw < 44 ? 44 : rRaw;
      const G = gRaw > R ? R : gRaw < 42 ? 42 : gRaw;
      const B = bRaw > G ? G : bRaw < 40 ? 40 : bRaw;
      color[i] = `#${HEX_STR[R]}${HEX_STR[G]}${HEX_STR[B]}`;
    }
  }
}
