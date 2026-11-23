import * as T from 'three';
import { computeSceneBbox } from 'glyphcss';
import { levitationBob } from './compartido.js';

// Libro
const BOOK = {
  coverHalfWidth: 1.62,
  coverHalfHeight: 1.12,
  coverThickness: 0.065,
  coverWingTiltRad: 0.055,
  coverGapHalf: 0.05,
  spineRadius: 0.11,
  pageWidth: 1.48,
  pageHalfHeight: 1.04,
  gutterY: 0.04,
  coverBaseY: -0.17,
  coverColor: 0x5c5852,
  blockColor: 0xf2eee4,
  movingPageCount: 2,
  pageSegU: 10,
  pageSegV: 6,
};

const TOTAL_COVER_WIDTH_THREE = BOOK.coverHalfWidth * 2;
const ARCH_HEIGHT = 0.14;
const EDGE_HEIGHT = 0.05;

function pageArchOffset(u) {
  return ARCH_HEIGHT * Math.sin(u * Math.PI) + EDGE_HEIGHT * u;
}

function pageBottomY(xAbs) {
  const wingCenterDist = Math.max(0, xAbs - BOOK.coverGapHalf);
  const coverTop =
    BOOK.coverBaseY +
    BOOK.coverThickness * 0.5 +
    wingCenterDist * Math.sin(BOOK.coverWingTiltRad) +
    0.014;
  return Math.max(BOOK.coverBaseY + 0.045, coverTop);
}

function buildPageBlockGeometry(side) {
  const steps = 16;
  const shape = new T.Shape();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const xAbs = u * BOOK.pageWidth;
    const y = BOOK.gutterY + pageArchOffset(u);
    if (i === 0) {
      shape.moveTo(side * xAbs, y);
    } else {
      shape.lineTo(side * xAbs, y);
    }
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    const xAbs = u * BOOK.pageWidth;
    const y = pageBottomY(xAbs);
    shape.lineTo(side * xAbs, y);
  }
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: BOOK.pageHalfHeight * 2,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  geo.translate(0, 0, -BOOK.pageHalfHeight);
  return geo;
}

function buildLibroBase() {
  const root = new T.Group();
  root.name = 'LibroBase';
  const coverMat = new T.MeshStandardMaterial({
    color: BOOK.coverColor,
    roughness: 0.85,
    metalness: 0.04,
  });
  const blockMat = new T.MeshStandardMaterial({
    color: BOOK.blockColor,
    roughness: 0.9,
    metalness: 0.0,
  });
  const wingWidth = BOOK.coverHalfWidth - BOOK.coverGapHalf;
  const wingGeo = new T.BoxGeometry(
    wingWidth,
    BOOK.coverThickness,
    BOOK.coverHalfHeight * 2,
  );
  for (const side of [-1, 1]) {
    const wing = new T.Mesh(wingGeo, coverMat);
    const pivot = new T.Group();
    pivot.position.set(side * BOOK.coverGapHalf, BOOK.coverBaseY, 0);
    pivot.rotation.z = side * BOOK.coverWingTiltRad;
    wing.position.set(side * (wingWidth * 0.5), 0, 0);
    pivot.add(wing);
    root.add(pivot);
  }
  const spineGeo = new T.CylinderGeometry(
    BOOK.spineRadius,
    BOOK.spineRadius,
    BOOK.coverHalfHeight * 2,
    14,
    1,
  );
  spineGeo.rotateX(Math.PI * 0.5);
  spineGeo.scale(1.15, 0.48, 1);
  const spine = new T.Mesh(spineGeo, coverMat);
  spine.position.set(0, BOOK.coverBaseY - 0.015, 0);
  root.add(spine);
  const leftBlock = new T.Mesh(buildPageBlockGeometry(-1), blockMat);
  const rightBlock = new T.Mesh(buildPageBlockGeometry(1), blockMat);
  root.add(leftBlock, rightBlock);
  return root;
}

// Extraccion
function extractRawGlyphPolygons(root) {
  root.updateMatrixWorld(true);
  const out = [];
  const tmpA = new T.Vector3();
  const tmpB = new T.Vector3();
  const tmpC = new T.Vector3();
  root.traverse((obj) => {
    if (!(obj instanceof T.Mesh)) return;
    const geo = obj.geometry;
    const pos = geo.getAttribute('position');
    if (!pos) return;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const colorHex =
      mat && 'color' in mat && mat.color instanceof T.Color
        ? `#${mat.color.getHexString()}`
        : '#cccccc';
    const roughness = mat && Number.isFinite(mat.roughness) ? mat.roughness : 0.86;
    const metalness = mat && Number.isFinite(mat.metalness) ? mat.metalness : 0.02;
    const index = geo.getIndex();
    const triCount = index ? Math.floor(index.count / 3) : Math.floor(pos.count / 3);
    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      tmpA.fromBufferAttribute(pos, i0).applyMatrix4(obj.matrixWorld);
      tmpB.fromBufferAttribute(pos, i1).applyMatrix4(obj.matrixWorld);
      tmpC.fromBufferAttribute(pos, i2).applyMatrix4(obj.matrixWorld);
      out.push({
        vertices: [
          [tmpA.z, tmpA.x, tmpA.y],
          [tmpB.z, tmpB.x, tmpB.y],
          [tmpC.z, tmpC.x, tmpC.y],
        ],
        color: colorHex,
        roughness,
        metalness,
        unlit: false,
      });
    }
  });
  return out;
}

// Medidas
const LIBRO_ANIMATION_DURATION = 5.6;

const metricsCache = new WeakMap();

function getLibroMetrics(basePolygons) {
  const cached = metricsCache.get(basePolygons);
  if (cached) return cached;
  const bbox = computeSceneBbox(basePolygons);
  const widthY = Math.max(1, bbox.max[1] - bbox.min[1]);
  const scale = widthY / TOTAL_COVER_WIDTH_THREE;
  const minYThree = BOOK.coverBaseY - BOOK.spineRadius * 0.48;
  const gutterZ = bbox.min[2] + (BOOK.gutterY - minYThree) * scale;
  const pageRadius = BOOK.pageWidth * scale;
  const halfHeightGlyph = BOOK.pageHalfHeight * scale;
  const centerX = (bbox.min[0] + bbox.max[0]) * 0.5;
  const metrics = {
    scale,
    gutterZ,
    pageRadius,
    spineMinX: centerX - halfHeightGlyph,
    spineMaxX: centerX + halfHeightGlyph,
  };
  metricsCache.set(basePolygons, metrics);
  return metrics;
}

function shadeGrayHex(t) {
  const v = Math.round(236 + (255 - 236) * t);
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothstep01(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function mapPagePhase(phase) {
  if (phase < 0.12) {
    return { turn: 0, peel: smoothstep01(phase / 0.12), settle: 0 };
  }
  if (phase > 0.88) {
    return { turn: 1, peel: 0, settle: smoothstep01((1 - phase) / 0.12) };
  }
  const active = (phase - 0.12) / 0.76;
  return { turn: easeInOutCubic(active), peel: 1, settle: 1 };
}

// Paginas
const PAGE_GRID_U = BOOK.pageSegU + 1;
const PAGE_GRID_V = BOOK.pageSegV + 1;
const _pageGridX = new Float64Array(PAGE_GRID_V);
const _pageGridY = new Float64Array(PAGE_GRID_U * PAGE_GRID_V);
const _pageGridZ = new Float64Array(PAGE_GRID_U * PAGE_GRID_V);
const _pageGridNy = new Float64Array(PAGE_GRID_U * PAGE_GRID_V);
const _pageGridNz = new Float64Array(PAGE_GRID_U * PAGE_GRID_V);
const _pagePools = Array.from({ length: BOOK.movingPageCount }, () => {
  const triCount = BOOK.pageSegU * BOOK.pageSegV * 4;
  const pool = new Array(triCount);
  for (let i = 0; i < triCount; i++) {
    pool[i] = {
      vertices: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
      color: '#ffffff',
      roughness: 0.88,
      metalness: 0.0,
      unlit: false,
    };
  }
  return pool;
});

function setTriSlot(slot, color, x0, y0, z0, x1, y1, z1, x2, y2, z2) {
  const v = slot.vertices;
  v[0][0] = x0; v[0][1] = y0; v[0][2] = z0;
  v[1][0] = x1; v[1][1] = y1; v[1][2] = z1;
  v[2][0] = x2; v[2][1] = y2; v[2][2] = z2;
  slot.color = color;
  return slot;
}

function buildTurningPagePolygons(phase, metrics, bobZ, pageIdx, out) {
  const { turn, peel, settle } = mapPagePhase(phase);
  const thetaBase = turn * Math.PI;
  const sinTheta = Math.sin(thetaBase);
  const activeLift = Math.max(sinTheta, 0.25 * Math.min(peel, settle));
  const color = shadeGrayHex(Math.pow(Math.sin(phase * Math.PI), 0.55));
  const segU = BOOK.pageSegU;
  const segV = BOOK.pageSegV;
  const { scale, gutterZ, pageRadius, spineMinX, spineMaxX } = metrics;
  const spanX = spineMaxX - spineMinX;
  const activeGutterZ = gutterZ + bobZ;
  for (let j = 0; j <= segV; j++) {
    _pageGridX[j] = spineMinX + (j / segV) * spanX;
  }
  const archScale = 1 - 0.42 * sinTheta;
  const liftScale = (0.005 + 0.022 * activeLift) * scale;
  const peelTerm = (1 - turn) * peel;
  const cornerScale = 0.085 * (peelTerm + settle * turn);
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const r = u * pageRadius;
    const flex = Math.pow(u, 1.5);
    const arch = pageArchOffset(u) * scale * archScale;
    const clearance = (liftScale + 0.018 * flex * peelTerm * scale) * (0.2 + 0.8 * u);
    const rowOff = i * PAGE_GRID_V;
    const paperLag = -0.52 * flex * sinTheta;
    const leadBase = 0.24 * flex * sinTheta;
    const peelBase = cornerScale * flex;
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const rawAngle = thetaBase + paperLag + leadBase * (v - 0.5) + peelBase * v;
      const angle = rawAngle < 0 ? 0 : rawAngle > Math.PI ? Math.PI : rawAngle;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const k = rowOff + j;
      _pageGridY[k] = r * cosA;
      _pageGridZ[k] = activeGutterZ + r * sinA + arch + clearance;
      _pageGridNy[k] = -sinA;
      _pageGridNz[k] = cosA;
    }
  }
  const eps = 0.005 * scale;
  const pool = _pagePools[pageIdx];
  let slotIdx = 0;
  for (let i = 0; i < segU; i++) {
    const r0 = i * PAGE_GRID_V;
    const r1 = r0 + PAGE_GRID_V;
    for (let j = 0; j < segV; j++) {
      const x0 = _pageGridX[j];
      const x1 = _pageGridX[j + 1];
      const k00 = r0 + j;
      const k10 = r1 + j;
      const k11 = r1 + j + 1;
      const k01 = r0 + j + 1;
      const y00 = _pageGridY[k00], z00 = _pageGridZ[k00], ny00 = _pageGridNy[k00] * eps, nz00 = _pageGridNz[k00] * eps;
      const y10 = _pageGridY[k10], z10 = _pageGridZ[k10], ny10 = _pageGridNy[k10] * eps, nz10 = _pageGridNz[k10] * eps;
      const y11 = _pageGridY[k11], z11 = _pageGridZ[k11], ny11 = _pageGridNy[k11] * eps, nz11 = _pageGridNz[k11] * eps;
      const y01 = _pageGridY[k01], z01 = _pageGridZ[k01], ny01 = _pageGridNy[k01] * eps, nz01 = _pageGridNz[k01] * eps;
      const r00y = y00 + ny00, r00z = z00 + nz00;
      const r10y = y10 + ny10, r10z = z10 + nz10;
      const r11y = y11 + ny11, r11z = z11 + nz11;
      const r01y = y01 + ny01, r01z = z01 + nz01;
      const v00y = y00 - ny00, v00z = z00 - nz00;
      const v10y = y10 - ny10, v10z = z10 - nz10;
      const v11y = y11 - ny11, v11z = z11 - nz11;
      const v01y = y01 - ny01, v01z = z01 - nz01;
      out.push(
        setTriSlot(pool[slotIdx++], color, x0, r00y, r00z, x1, r11y, r11z, x0, r10y, r10z),
        setTriSlot(pool[slotIdx++], color, x0, r00y, r00z, x1, r01y, r01z, x1, r11y, r11z),
        setTriSlot(pool[slotIdx++], color, x0, v00y, v00z, x0, v10y, v10z, x1, v11y, v11z),
        setTriSlot(pool[slotIdx++], color, x0, v00y, v00z, x1, v11y, v11z, x1, v01y, v01z),
      );
    }
  }
}

const _basePoolCache = new WeakMap();

function getBasePool(basePolygons) {
  let pool = _basePoolCache.get(basePolygons);
  if (pool) return pool;
  pool = new Array(basePolygons.length);
  for (let i = 0; i < basePolygons.length; i++) {
    const p = basePolygons[i];
    const v = p.vertices;
    pool[i] = {
      vertices: [
        [v[0][0], v[0][1], v[0][2]],
        [v[1][0], v[1][1], v[1][2]],
        [v[2][0], v[2][1], v[2][2]],
      ],
      color: p.color,
      roughness: p.roughness,
      metalness: p.metalness,
      unlit: p.unlit,
    };
  }
  _basePoolCache.set(basePolygons, pool);
  return pool;
}

// Cuadro
function buildLibroFrame(basePolygons, state) {
  const metrics = getLibroMetrics(basePolygons);
  const bobZ = levitationBob(state.time, metrics.scale);
  const pool = getBasePool(basePolygons);
  const polygons = new Array(pool.length);
  for (let i = 0; i < pool.length; i++) {
    const src = basePolygons[i].vertices;
    const dst = pool[i].vertices;
    dst[0][0] = src[0][0]; dst[0][1] = src[0][1]; dst[0][2] = src[0][2] + bobZ;
    dst[1][0] = src[1][0]; dst[1][1] = src[1][1]; dst[1][2] = src[1][2] + bobZ;
    dst[2][0] = src[2][0]; dst[2][1] = src[2][1]; dst[2][2] = src[2][2] + bobZ;
    polygons[i] = pool[i];
  }
  const s = state.scrollIntensity;
  const activeCount = s >= 0.65 ? 0 : s >= 0.35 ? 1 : BOOK.movingPageCount;
  for (let i = 0; i < activeCount; i++) {
    const phase = (state.progress + i / BOOK.movingPageCount) % 1;
    buildTurningPagePolygons(phase, metrics, bobZ, i, polygons);
  }
  return { polygons, metrics, bobZ };
}

// Libro en llamas
const FIRE_MAX = 36;
const FIRE_STEP_DT = 1 / 34;
const MAX_ASH = 320;

const FIRE_STOPS = ['#1f1714', '#5f1907', '#a82e04', '#e05b07', '#f7810c', '#ffb21e', '#ffe052', '#fffde0'];
const FIRE_PALETTE = Array.from({ length: FIRE_MAX + 1 }, (_, i) => FIRE_STOPS[Math.round((i / FIRE_MAX) * (FIRE_STOPS.length - 1))]);

const FIRE_GLYPHS = ['.', "'", ':', '~', '^', '+', '*', 'x', 'X', '%', '#', '@'];
const CHARRED_COLORS = ['#4f433c', '#382c26'];
const SKELETON_CHARS = ['#', ':', '.', ',', "'", '-'];
const SMOKE_CHARS = ['~', ':', '.', ',', "'"];
const SMOKE_COLORS = ['#7a7470', '#605c59', '#484644', '#383635'];
const ASH_GLYPHS = ['.', ',', "'", '`', '*', '~', '·', '°'];
const ASH_COLORS = ['#fff0a0', '#ff8c28', '#b5ab99', '#8a8173', '#6b645a', '#4d4841'];

function hash01(index) {
  const s = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function staticBurnNoise(col, row) {
  const n1 = Math.sin(col * 0.24 + row * 0.31);
  const n2 = Math.cos(col * 0.51 - row * 0.44 + Math.sin(col * 0.17) * 1.4);
  const n3 = Math.sin((col + row) * 0.78);
  return 0.5 + 0.5 * (0.48 * n1 + 0.34 * n2 + 0.18 * n3);
}

// Umbral
function computeBurnThreshold(col, row, minC, maxC, minR, maxR, normDepth) {
  const midC = (minC + maxC) * 0.5;
  const halfW = Math.max(1, (maxC - minC) * 0.5);
  const midR = (minR + maxR) * 0.5;
  const halfH = Math.max(1, (maxR - minR) * 0.5);
  const dx = Math.abs(col - midC) / halfW;
  const dy = Math.abs(row - midR) / halfH;
  const edgeProximity = Math.max(dx * 0.88, dy * 0.76);
  const rightBias = (col - minC) / Math.max(1, maxC - minC);
  const topBias = 1 - (row - minR) / Math.max(1, maxR - minR);
  const cornerLead = rightBias * 0.12 + topBias * 0.08;
  const prog = Math.max(0, Math.min(1, 1 - edgeProximity * 0.92 + (0.14 - cornerLead)));
  const jagged = (staticBurnNoise(col, row) - 0.5) * 0.18;
  const depthBias = (1 - normDepth) * 0.05;
  return Math.max(0.03, Math.min(0.84, 0.05 + prog * 0.75 + depthBias + jagged));
}

function createLibroEnLlamasCellEffect() {
  let lastCols = 0;
  let lastRows = 0;
  let lastTime = -1;
  let fireAcc = 0;
  let prevIntensity = 0;
  let rngState = 0x9e3779b9;
  let spawnCursor = 0;
  let emitAcc = 0;

  let isBook = new Uint8Array(0);
  let seedHeat = new Uint8Array(0);
  let firePixels = new Uint8Array(0);
  let fireNext = new Uint8Array(0);
  let smokePixels = new Float32Array(0);
  let burnNoiseBuf = new Float32Array(0);
  let skelNoiseBuf = new Float32Array(0);

  const ashX = new Float32Array(MAX_ASH);
  const ashY = new Float32Array(MAX_ASH);
  const ashVx = new Float32Array(MAX_ASH);
  const ashVy = new Float32Array(MAX_ASH);
  const ashAge = new Float32Array(MAX_ASH);
  const ashMaxAge = new Float32Array(MAX_ASH);
  const ashPhase = new Float32Array(MAX_ASH);
  const ashFreq = new Float32Array(MAX_ASH);
  const ashAmp = new Float32Array(MAX_ASH);
  const ashKind = new Uint8Array(MAX_ASH);
  const ashGlyph = new Uint8Array(MAX_ASH);
  ashAge.fill(999);

  let seedList = new Int32Array(0);

  const nextRand = () => {
    rngState ^= rngState << 13;
    rngState ^= rngState >>> 17;
    rngState ^= rngState << 5;
    return rngState >>> 0;
  };
  const rand01 = () => (nextRand() & 0xffff) / 65536;

  function spawnAshParticle(r, c, hot) {
    let slot = -1;
    for (let k = 0; k < MAX_ASH; k++) {
      const idx = (spawnCursor + k) % MAX_ASH;
      if (ashAge[idx] >= ashMaxAge[idx]) {
        slot = idx;
        spawnCursor = (idx + 1) % MAX_ASH;
        break;
      }
    }
    if (slot < 0) {
      slot = spawnCursor;
      spawnCursor = (spawnCursor + 1) % MAX_ASH;
    }
    ashX[slot] = c + (rand01() - 0.5) * 1.6;
    ashY[slot] = r - rand01() * 0.7;
    const wideDrift = !hot && rand01() < 0.35;
    if (hot) {
      ashKind[slot] = 0;
      ashVx[slot] = (rand01() - 0.42) * 7.5;
      ashVy[slot] = -(5.5 + rand01() * 6.5);
    } else if (wideDrift) {
      ashKind[slot] = rand01() < 0.55 ? 1 : 2;
      ashVx[slot] = (rand01() - 0.45) * 14.0;
      ashVy[slot] = -(2.0 + rand01() * 4.0);
    } else {
      ashKind[slot] = rand01() < 0.6 ? 1 : 2;
      ashVx[slot] = (rand01() - 0.35) * 6.0;
      ashVy[slot] = -(2.4 + rand01() * 4.4);
    }
    ashAge[slot] = 0;
    ashMaxAge[slot] = wideDrift ? 7.0 + rand01() * 7.0 : 5.5 + rand01() * 6.5;
    ashPhase[slot] = rand01() * Math.PI * 2;
    ashFreq[slot] = 0.8 + rand01() * 1.5;
    ashAmp[slot] = wideDrift ? 2.4 + rand01() * 4.8 : 1.6 + rand01() * 3.8;
    ashGlyph[slot] = Math.floor(rand01() * ASH_GLYPHS.length);
    return slot;
  }

  function stepFireTick(cols, rows, intensity, tNow, minBookRow, maxBookRow, fireMinCol, fireMaxCol, seedCount) {
    const activeCutoff = Math.max(0, minBookRow - Math.round(14 + intensity * 14));
    const minLoopRow = Math.max(1, minBookRow - 32);
    const maxLoopRow = Math.min(rows - 1, maxBookRow + 1);
    for (let r = minLoopRow; r <= maxLoopRow; r++) {
      fireNext.fill(0, r * cols + fireMinCol, r * cols + fireMaxCol + 1);
    }
    fireNext.fill(0, (minLoopRow - 1) * cols + fireMinCol, (minLoopRow - 1) * cols + fireMaxCol + 1);

    for (let r = minLoopRow; r <= maxLoopRow; r++) {
      const rowOff = r * cols;
      const dstRowOff = (r - 1) * cols;
      const breeze = Math.sin(tNow * 1.5 - r * 0.16);
      const windPush = breeze > 0.35 ? 1 : breeze < -0.35 ? -1 : 0;
      const abovePaperZone = r - 1 < minBookRow - 3;
      const highCool = abovePaperZone || r < activeCutoff + 4;
      for (let c = fireMinCol; c <= fireMaxCol; c++) {
        const src = firePixels[rowOff + c];
        if (!src) continue;
        const rnd = nextRand();
        const wind = ((rnd & 3) - 1) + windPush;
        let dc = c + wind;
        if (dc < 0) dc = 0;
        else if (dc >= cols) dc = cols - 1;
        const dstIdx = dstRowOff + dc;
        let cool;
        if (intensity <= 0.02) {
          cool = 5;
        } else if (highCool) {
          cool = 1 + ((rnd >> 2) & 1) + ((rnd >> 3) & 1) + (intensity < 0.5 && (rnd & 16) ? 1 : 0);
        } else {
          cool = (rnd >> 2) & 1;
          if (!isBook[dstIdx] && ((rnd >> 3) & 1)) cool += 1;
        }
        const nextVal = src > cool ? src - cool : 0;
        if (nextVal > fireNext[dstIdx]) fireNext[dstIdx] = nextVal;
      }
    }
    for (let k = 0; k < seedCount; k++) {
      const idx = seedList[k];
      const jitter = nextRand() & 3;
      const v = Math.min(FIRE_MAX, Math.max(12, seedHeat[idx] - jitter));
      if (v > fireNext[idx]) fireNext[idx] = v;
    }
    const tmp = firePixels;
    firePixels = fireNext;
    fireNext = tmp;

    const smokeC0 = Math.max(1, fireMinCol);
    const smokeC1 = Math.min(cols - 2, fireMaxCol);
    for (let r = Math.max(1, minBookRow - 18); r <= maxBookRow; r++) {
      const off = r * cols;
      const dstOff = (r - 1) * cols;
      const rowDrift = Math.sin(tNow * 1.1 + r * 0.2) >= 0 ? 1 : -1;
      for (let c = smokeC0; c <= smokeC1; c++) {
        const idx = off + c;
        const hv = firePixels[idx];
        const prevSmoke = smokePixels[idx];
        if (hv >= 4 && hv <= 20) {
          smokePixels[dstOff + c] = Math.min(1, smokePixels[dstOff + c] + 0.08);
        }
        if (prevSmoke > 0.02) {
          const driftC = c + ((nextRand() & 1) ? 0 : rowDrift);
          const cc = driftC < 0 ? 0 : driftC >= cols ? cols - 1 : driftC;
          smokePixels[dstOff + cc] = Math.max(smokePixels[dstOff + cc] * 0.94, prevSmoke * 0.88);
          smokePixels[idx] = prevSmoke * 0.72;
        }
      }
    }
  }

  function advanceAsh(dt, cols, rows, tNow) {
    const drag = Math.exp(-dt * 1.25);
    const baseWind = Math.sin(tNow * 0.42) * 2.1 + 1.25;
    for (let k = 0; k < MAX_ASH; k++) {
      const age = ashAge[k];
      const maxA = ashMaxAge[k];
      if (age >= maxA) continue;
      const nextAge = age + dt;
      ashAge[k] = nextAge;
      if (nextAge >= maxA) continue;
      if (ashKind[k] === 0 && nextAge > 0.65) {
        ashKind[k] = 1;
      }
      const x = ashX[k];
      const y = ashY[k];
      const ph = ashPhase[k];
      const freq = ashFreq[k];
      const vxWind = baseWind + Math.cos(tNow * freq + ph + y * 0.12) * ashAmp[k];
      const vyHover = -0.85 + Math.sin(tNow * freq * 0.65 + ph + x * 0.08) * 0.85;
      ashVx[k] = ashVx[k] * drag + vxWind * (1 - drag);
      ashVy[k] = ashVy[k] * drag + vyHover * (1 - drag);
      let nx = x + ashVx[k] * dt;
      let ny = y + ashVy[k] * dt;
      if (nx < 1) nx = cols - 2;
      else if (nx > cols - 2) nx = 1;
      if (ny < 1) {
        ny = 1;
        ashVy[k] = Math.abs(ashVy[k]) * 0.35;
      } else if (ny > rows - 2) {
        ny = rows - 2;
        ashVy[k] = -Math.abs(ashVy[k]) * 0.55;
      }
      ashX[k] = nx;
      ashY[k] = ny;
    }
  }

  return (grid, state) => {
    const intensity = Math.min(1, Math.max(0, state.scrollIntensity));
    const { cols, rows, char, color, depth } = grid;
    const total = cols * rows;
    if (total === 0) return;

    if (cols !== lastCols || rows !== lastRows || firePixels.length !== total) {
      lastCols = cols;
      lastRows = rows;
      isBook = new Uint8Array(total);
      seedHeat = new Uint8Array(total);
      firePixels = new Uint8Array(total);
      fireNext = new Uint8Array(total);
      smokePixels = new Float32Array(total);
      seedList = new Int32Array(total);
      burnNoiseBuf = new Float32Array(total);
      skelNoiseBuf = new Float32Array(total);
      for (let r = 0; r < rows; r++) {
        const off = r * cols;
        for (let c = 0; c < cols; c++) {
          burnNoiseBuf[off + c] = staticBurnNoise(c, r);
          skelNoiseBuf[off + c] = staticBurnNoise(c * 1.7, r * 1.9);
        }
      }
      ashAge.fill(999);
      fireAcc = 0;
      prevIntensity = 0;
    }

    const tNow = state.time || 0;
    const rawDt = lastTime < 0 ? 0.016 : tNow - lastTime;
    const dt = rawDt < 0 || rawDt > 0.25 ? 0.016 : rawDt;
    lastTime = tNow;

    if (intensity <= 0.004) {
      firePixels.fill(0);
      smokePixels.fill(0);
      ashAge.fill(999);
      prevIntensity = 0;
      fireAcc = 0;
      return;
    }

    isBook.fill(0);

    let minBookRow = rows;
    let maxBookRow = -1;
    let minBookCol = cols;
    let maxBookCol = -1;
    let minDepth = Infinity;
    let maxDepth = -Infinity;
    for (let r = 0; r < rows; r++) {
      const rowOff = r * cols;
      for (let c = 0; c < cols; c++) {
        const idx = rowOff + c;
        if (char[idx] !== ' ') {
          isBook[idx] = 1;
          if (r < minBookRow) minBookRow = r;
          if (r > maxBookRow) maxBookRow = r;
          if (c < minBookCol) minBookCol = c;
          if (c > maxBookCol) maxBookCol = c;
          const d = depth?.[idx];
          if (d !== undefined && Number.isFinite(d)) {
            if (d < minDepth) minDepth = d;
            if (d > maxDepth) maxDepth = d;
          }
        }
      }
    }
    if (maxBookRow < 0) return;
    const depthSpan = maxDepth > minDepth ? maxDepth - minDepth : 0;
    const invDepthSpan = depthSpan > 0 ? 1 / depthSpan : 0;
    const midC = (minBookCol + maxBookCol) * 0.5;
    const invHalfW = 1 / Math.max(1, (maxBookCol - minBookCol) * 0.5);
    const midR = (minBookRow + maxBookRow) * 0.5;
    const invHalfH = 1 / Math.max(1, (maxBookRow - minBookRow) * 0.5);
    const invColSpan = 1 / Math.max(1, maxBookCol - minBookCol);
    const invRowSpan = 1 / Math.max(1, maxBookRow - minBookRow);

    let seedCount = 0;
    for (let r = minBookRow; r <= maxBookRow; r++) {
      const rowOff = r * cols;
      const dy = Math.abs(r - midR) * invHalfH * 0.76;
      const topBias = (1 - (r - minBookRow) * invRowSpan) * 0.08;
      for (let c = minBookCol; c <= maxBookCol; c++) {
        const idx = rowOff + c;
        if (isBook[idx] === 0) continue;
        const d = depth?.[idx];
        const normDepth =
          invDepthSpan > 0 && d !== undefined && Number.isFinite(d)
            ? Math.max(0, Math.min(1, (d - minDepth) * invDepthSpan))
            : 0.5;
        const dx = Math.abs(c - midC) * invHalfW * 0.88;
        const edgeProximity = dx > dy ? dx : dy;
        const rightBias = (c - minBookCol) * invColSpan * 0.12;
        const cornerLead = rightBias + topBias;
        const progRaw = 1 - edgeProximity * 0.92 + (0.14 - cornerLead);
        const prog = progRaw < 0 ? 0 : progRaw > 1 ? 1 : progRaw;
        const jagged = (burnNoiseBuf[idx] - 0.5) * 0.18;
        const depthBias = (1 - normDepth) * 0.05;
        const thrRaw = 0.05 + prog * 0.75 + depthBias + jagged;
        const threshold = thrRaw < 0.03 ? 0.03 : thrRaw > 0.84 ? 0.84 : thrRaw;
        const delta = intensity - threshold;
        if (delta < -0.09) {
          continue;
        }
        if (delta < 0) {
          const charMix = (delta + 0.09) / 0.09;
          color[idx] = charMix > 0.55 ? CHARRED_COLORS[1] : CHARRED_COLORS[0];
          if (delta >= -0.025) {
            seedHeat[idx] = Math.round(14 + 12 * ((delta + 0.025) / 0.025));
            seedList[seedCount++] = idx;
          }
          continue;
        }
        if (delta < 0.11) {
          const band = 1 - delta / 0.11;
          const hVal = Math.min(FIRE_MAX, Math.max(16, Math.round(20 + band * 16)));
          seedHeat[idx] = hVal;
          seedList[seedCount++] = idx;
          color[idx] = FIRE_PALETTE[Math.min(FIRE_MAX, Math.max(6, hVal))];
          const gIdx = Math.min(FIRE_GLYPHS.length - 1, Math.floor((hVal / FIRE_MAX) * FIRE_GLYPHS.length));
          char[idx] = FIRE_GLYPHS[gIdx];
          continue;
        }
        isBook[idx] = 0;
        const travel = delta - 0.11;
        if (delta < 0.20) {
          const edgeHeat = Math.round(18 * (1 - travel / 0.09));
          if (edgeHeat > 4) {
            seedHeat[idx] = edgeHeat;
            seedList[seedCount++] = idx;
          }
        }
        if (delta < 0.25) {
          const skelProgress = travel / 0.14;
          const skelNoise = skelNoiseBuf[idx];
          if (skelNoise > 0.30 + skelProgress * 0.65) {
            char[idx] = SKELETON_CHARS[(c * 3 + r * 5) % SKELETON_CHARS.length];
            color[idx] = skelProgress < 0.35 ? '#6e5245' : skelNoise > 0.65 ? '#6e6e6e' : '#4a4a4a';
          } else {
            char[idx] = ' ';
            color[idx] = null;
          }
        } else {
          char[idx] = ' ';
          color[idx] = null;
        }
      }
    }

    const fireMinCol = Math.max(0, minBookCol - 24);
    const fireMaxCol = Math.min(cols - 1, maxBookCol + 24);
    const coldJump = prevIntensity <= 0.01 && intensity > 0.12;
    if (coldJump) {
      for (let step = 0; step < 16; step++) {
        stepFireTick(cols, rows, intensity, tNow - (16 - step) * FIRE_STEP_DT, minBookRow, maxBookRow, fireMinCol, fireMaxCol, seedCount);
      }
      if (seedCount > 0) {
        const preCount = Math.min(48, Math.max(18, Math.round(intensity * 55)));
        for (let p = 0; p < preCount; p++) {
          const si = seedList[(rand01() * seedCount) | 0];
          const slot = spawnAshParticle((si / cols) | 0, si % cols, rand01() < 0.25);
          const simSec = 0.4 + rand01() * 3.8;
          ashAge[slot] = simSec;
          ashX[slot] += (rand01() - 0.38) * simSec * 8.5;
          ashY[slot] -= (1.5 + rand01() * 3.2) * Math.min(2.6, simSec);
          if (ashY[slot] < 2) ashY[slot] = 2 + rand01() * (rows * 0.45);
          if (ashX[slot] < 1 || ashX[slot] >= cols - 1) {
            ashX[slot] = 2 + rand01() * (cols - 4);
          }
        }
      }
    } else {
      fireAcc += dt;
      let ticks = 0;
      while (fireAcc >= FIRE_STEP_DT && ticks < 3) {
        stepFireTick(cols, rows, intensity, tNow, minBookRow, maxBookRow, fireMinCol, fireMaxCol, seedCount);
        fireAcc -= FIRE_STEP_DT;
        ticks++;
      }
      if (ticks === 3) fireAcc = 0;
    }

    const burnDelta = Math.max(0, intensity - prevIntensity);
    if (seedCount > 0) {
      const rate = 26 + burnDelta * 600 + intensity * 14;
      emitAcc += rate * dt;
      const toEmit = Math.min(12, Math.floor(emitAcc));
      emitAcc -= toEmit;
      for (let eIdx = 0; eIdx < toEmit; eIdx++) {
        const si = seedList[(rand01() * seedCount) | 0];
        spawnAshParticle((si / cols) | 0, si % cols, rand01() < 0.36);
      }
    } else if (intensity > 0.15) {
      emitAcc += 14 * dt;
      const toEmit = Math.min(4, Math.floor(emitAcc));
      emitAcc -= toEmit;
      for (let eIdx = 0; eIdx < toEmit; eIdx++) {
        const rc = minBookCol + ((rand01() * Math.max(1, maxBookCol - minBookCol)) | 0);
        const rr = minBookRow + ((rand01() * Math.max(1, maxBookRow - minBookRow)) | 0);
        spawnAshParticle(rr, rc, false);
      }
    }
    prevIntensity = intensity;

    advanceAsh(dt, cols, rows, tNow);

    const flameTop = Math.max(0, minBookRow - 32);
    for (let r = flameTop; r <= maxBookRow; r++) {
      const off = r * cols;
      for (let c = fireMinCol; c <= fireMaxCol; c++) {
        const idx = off + c;
        const hv = firePixels[idx];
        if (hv >= 2) {
          if (isBook[idx] && hv < 8) continue;
          const gIdx = Math.min(FIRE_GLYPHS.length - 1, Math.floor((hv / (FIRE_MAX + 1)) * FIRE_GLYPHS.length));
          char[idx] = FIRE_GLYPHS[gIdx];
          color[idx] = FIRE_PALETTE[Math.min(FIRE_MAX, hv)];
        } else if (smokePixels[idx] > 0.14 && char[idx] === ' ') {
          const sv = smokePixels[idx];
          const sq = Math.min(SMOKE_COLORS.length - 1, Math.floor((1 - Math.min(1, sv)) * SMOKE_COLORS.length));
          const gi = Math.floor(sv * 13 + c + r * 3) % SMOKE_CHARS.length;
          char[idx] = SMOKE_CHARS[gi];
          color[idx] = SMOKE_COLORS[sq];
        }
      }
    }

    for (let k = 0; k < MAX_ASH; k++) {
      const age = ashAge[k];
      const maxA = ashMaxAge[k];
      if (age >= maxA) continue;
      const r = Math.round(ashY[k]);
      const c = Math.round(ashX[k]);
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const idx = r * cols + c;
      if (isBook[idx] === 1 || firePixels[idx] >= 18) continue;
      const life = age / maxA;
      let colIdx;
      if (ashKind[k] === 0 && age < 0.65) {
        colIdx = age < 0.25 ? 0 : 1;
      } else if (life < 0.42) {
        colIdx = 2;
      } else if (life < 0.7) {
        colIdx = 3;
      } else if (life < 0.88) {
        colIdx = 4;
      } else {
        colIdx = 5;
      }
      char[idx] = ASH_GLYPHS[ashGlyph[k]];
      color[idx] = ASH_COLORS[colIdx];
    }
  };
}

// Estado
let _basePolygons = null;
let _root = null;

export function crearLibro() {
  if (!_root) {
    _root = buildLibroBase();
    _basePolygons = extractRawGlyphPolygons(_root);
  }
  const cellEffect = createLibroEnLlamasCellEffect();
  return {
    root: _root,
    kind: 'libro',
    duration: LIBRO_ANIMATION_DURATION,
    animated: true,
    burn: () => 0,
    cellEffect,
    update() {},
    frame() {},
    buildFrame(state) {
      const progress = (((state.time / LIBRO_ANIMATION_DURATION) % 1) + 1) % 1;
      return buildLibroFrame(_basePolygons, {
        progress,
        time: state.time,
        scrollIntensity: state.scrollIntensity,
      }).polygons;
    },
  };
}
