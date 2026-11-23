import * as T from 'three';
import { levitationBob, LEVITATION_PERIOD, LEVITATION_REF_SPAN, preparePoemLines, getPoemRowLookup } from './compartido.js';
import { LIGHT_RIGS, buildWarmToneLut } from '../lighting.js';

const SIL_POW26_LUT = Float32Array.from({ length: 1025 }, (_, i) => Math.pow(i / 1024, 26));
const SIL_POW23_LUT = Float32Array.from({ length: 1025 }, (_, i) => Math.pow(1 - i / 1024, 2.3));
const SIL_SHADE_LUT = buildWarmToneLut(0.95, 0.93, 0.89, 56, 2.0, 1024);
const DST_EXP_MAX = 2.0;
const DST_EXP_LUT = Float32Array.from({ length: 1025 }, (_, i) => 0.085 * Math.exp(-((i / 1024) * DST_EXP_MAX) * 3.0));

// Poema
const POEM_VERSES = [
  'Quince mil desaparecidos,',
  'diez mil presos, cuatro mil muertos,',
  'decenas de miles de desterrados',
  'son la cifra desnuda de ese terror.',
];

const DEFAULT_POEM_LINES = preparePoemLines(POEM_VERSES.join('\n'));

// Plantilla
const RECT_MIN_X = -0.74;
const RECT_MAX_X = 0.74;
const RECT_W = RECT_MAX_X - RECT_MIN_X;
const RECT_MIN_Y = -1.06;
const RECT_MAX_Y = 1.08;
const RECT_H = RECT_MAX_Y - RECT_MIN_Y;
const SDF_COLS = 160;
const SDF_ROWS = 220;
const SIL_DURATION = 6.8;

const RIGHT_LANDMARKS = [
  [0, 0.975],
  [0.044, 0.962],
  [0.088, 0.922],
  [0.115, 0.862],
  [0.112, 0.798],
  [0.088, 0.742],
  [0.056, 0.706],
  [0.048, 0.684],
  [0.052, 0.652],
  [0.088, 0.626],
  [0.156, 0.594],
  [0.228, 0.552],
  [0.276, 0.484],
  [0.328, 0.365],
  [0.356, 0.215],
  [0.38, 0.065],
  [0.398, -0.075],
  [0.41, -0.145],
  [0.412, -0.202],
  [0.398, -0.252],
  [0.36, -0.264],
  [0.342, -0.244],
  [0.336, -0.192],
  [0.334, -0.135],
  [0.312, -0.075],
  [0.282, 0.065],
  [0.252, 0.21],
  [0.222, 0.345],
  [0.19, 0.375],
  [0.194, 0.295],
  [0.186, 0.165],
  [0.182, 0.035],
  [0.194, -0.09],
  [0.202, -0.195],
  [0.208, -0.34],
  [0.214, -0.555],
  [0.222, -0.74],
  [0.22, -0.895],
  [0.268, -0.948],
  [0.274, -0.974],
  [0.248, -0.986],
  [0.182, -0.986],
  [0.152, -0.972],
  [0.148, -0.895],
  [0.13, -0.73],
  [0.104, -0.555],
  [0.062, -0.355],
  [0.028, -0.245],
  [0, -0.225],
];

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep01(t) {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function hash01(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function buildSilhouetteControlsCCW() {
  const controls = [];
  controls.push(RIGHT_LANDMARKS[0]);
  for (let i = 1; i < RIGHT_LANDMARKS.length - 1; i++) {
    const [x, y] = RIGHT_LANDMARKS[i];
    controls.push([-x, y]);
  }
  controls.push(RIGHT_LANDMARKS[RIGHT_LANDMARKS.length - 1]);
  for (let i = RIGHT_LANDMARKS.length - 2; i >= 1; i--) {
    controls.push(RIGHT_LANDMARKS[i]);
  }
  return controls;
}

function buildClosedSplineContour(controls, subSegs) {
  const n = controls.length;
  const out = [];
  const tj = (ti, a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return ti + Math.pow(Math.max(d, 1e-6), 0.5);
  };
  for (let i = 0; i < n; i++) {
    const p0 = controls[(i - 1 + n) % n];
    const p1 = controls[i];
    const p2 = controls[(i + 1) % n];
    const p3 = controls[(i + 2) % n];
    const t0 = 0;
    const t1 = tj(t0, p0, p1);
    const t2 = tj(t1, p1, p2);
    const t3 = tj(t2, p2, p3);
    for (let s = 0; s < subSegs; s++) {
      const t = t1 + ((t2 - t1) * s) / subSegs;
      const a1x = ((t1 - t) / (t1 - t0)) * p0[0] + ((t - t0) / (t1 - t0)) * p1[0];
      const a1y = ((t1 - t) / (t1 - t0)) * p0[1] + ((t - t0) / (t1 - t0)) * p1[1];
      const a2x = ((t2 - t) / (t2 - t1)) * p1[0] + ((t - t1) / (t2 - t1)) * p2[0];
      const a2y = ((t2 - t) / (t2 - t1)) * p1[1] + ((t - t1) / (t2 - t1)) * p2[1];
      const a3x = ((t3 - t) / (t3 - t2)) * p2[0] + ((t - t2) / (t3 - t2)) * p3[0];
      const a3y = ((t3 - t) / (t3 - t2)) * p2[1] + ((t - t2) / (t3 - t2)) * p3[1];
      const b1x = ((t2 - t) / (t2 - t0)) * a1x + ((t - t0) / (t2 - t0)) * a2x;
      const b1y = ((t2 - t) / (t2 - t0)) * a1y + ((t - t0) / (t2 - t0)) * a2y;
      const b2x = ((t3 - t) / (t3 - t1)) * a2x + ((t - t1) / (t3 - t1)) * a3x;
      const b2y = ((t3 - t) / (t3 - t1)) * a2y + ((t - t1) / (t3 - t1)) * a3y;
      const cx = ((t2 - t) / (t2 - t1)) * b1x + ((t - t1) / (t2 - t1)) * b2x;
      const cy = ((t2 - t) / (t2 - t1)) * b1y + ((t - t1) / (t2 - t1)) * b2y;
      out.push([cx, cy]);
    }
  }
  return out;
}

let staticSdfCache = null;

function getStaticSdfCache() {
  if (staticSdfCache) return staticSdfCache;
  const contour = buildClosedSplineContour(buildSilhouetteControlsCCW(), 4);
  const n = contour.length;
  const segAx = new Float64Array(n);
  const segAy = new Float64Array(n);
  const segBx = new Float64Array(n);
  const segBy = new Float64Array(n);
  const segDx = new Float64Array(n);
  const segDy = new Float64Array(n);
  const segInvLenSq = new Float64Array(n);
  const segMinX = new Float64Array(n);
  const segMaxX = new Float64Array(n);
  const segMinY = new Float64Array(n);
  const segMaxY = new Float64Array(n);
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = contour[j][0];
    const ay = contour[j][1];
    const bx = contour[i][0];
    const by = contour[i][1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    segAx[i] = ax;
    segAy[i] = ay;
    segBx[i] = bx;
    segBy[i] = by;
    segDx[i] = dx;
    segDy[i] = dy;
    segInvLenSq[i] = lenSq > 1e-12 ? 1 / lenSq : 0;
    segMinX[i] = ax < bx ? ax : bx;
    segMaxX[i] = ax > bx ? ax : bx;
    segMinY[i] = ay < by ? ay : by;
    segMaxY[i] = ay > by ? ay : by;
  }

  const sdfGrid = new Float32Array(SDF_COLS * SDF_ROWS);
  const stepX = RECT_W / (SDF_COLS - 1);
  const halfCols = (SDF_COLS + 1) >> 1;

  for (let r = 0; r < SDF_ROWS; r++) {
    const y = RECT_MIN_Y + (r / (SDF_ROWS - 1)) * RECT_H;
    const rowOff = r * SDF_COLS;
    let prevDist = Infinity;
    for (let c = 0; c < halfCols; c++) {
      const x = RECT_MIN_X + (c / (SDF_COLS - 1)) * RECT_W;
      let inside = false;
      let minDistSq = c > 0 && Number.isFinite(prevDist)
        ? (prevDist + stepX * 1.1) * (prevDist + stepX * 1.1)
        : Infinity;
      let updated = false;
      for (let k = 0; k < n; k++) {
        const ay = segAy[k];
        const by = segBy[k];
        if ((ay > y) !== (by > y)) {
          const intersectX = ((segBx[k] - segAx[k]) * (y - ay)) / (by - ay) + segAx[k];
          if (x < intersectX) inside = !inside;
        }
        const dxBox = x < segMinX[k] ? segMinX[k] - x : x > segMaxX[k] ? x - segMaxX[k] : 0;
        const dyBox = y < segMinY[k] ? segMinY[k] - y : y > segMaxY[k] ? y - segMaxY[k] : 0;
        if (dxBox * dxBox + dyBox * dyBox >= minDistSq) continue;
        const dx = segDx[k];
        const dy = segDy[k];
        const inv = segInvLenSq[k];
        let proj = inv > 0 ? ((x - segAx[k]) * dx + (y - segAy[k]) * dy) * inv : 0;
        if (proj < 0) proj = 0;
        else if (proj > 1) proj = 1;
        const px = segAx[k] + proj * dx - x;
        const py = ay + proj * dy - y;
        const dSq = px * px + py * py;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          updated = true;
        }
      }
      if (!updated) {
        minDistSq = Infinity;
        for (let k = 0; k < n; k++) {
          const dxBox = x < segMinX[k] ? segMinX[k] - x : x > segMaxX[k] ? x - segMaxX[k] : 0;
          const dyBox = y < segMinY[k] ? segMinY[k] - y : y > segMaxY[k] ? y - segMaxY[k] : 0;
          if (dxBox * dxBox + dyBox * dyBox >= minDistSq) continue;
          const inv = segInvLenSq[k];
          let proj = inv > 0 ? ((x - segAx[k]) * segDx[k] + (y - segAy[k]) * segDy[k]) * inv : 0;
          if (proj < 0) proj = 0;
          else if (proj > 1) proj = 1;
          const px = segAx[k] + proj * segDx[k] - x;
          const py = segAy[k] + proj * segDy[k] - y;
          const dSq = px * px + py * py;
          if (dSq < minDistSq) minDistSq = dSq;
        }
      }
      const dist = Math.sqrt(minDistSq);
      prevDist = dist;
      const d = inside ? -dist : dist;
      sdfGrid[rowOff + c] = d;
      sdfGrid[rowOff + (SDF_COLS - 1 - c)] = d;
    }
  }
  const silBoostGrid = new Float32Array(SDF_COLS * SDF_ROWS);
  const dstRippleGrid = new Float32Array(SDF_COLS * SDF_ROWS);
  for (let r = 0; r < SDF_ROWS; r++) {
    const y = RECT_MIN_Y + (r / (SDF_ROWS - 1)) * RECT_H;
    const rowOff = r * SDF_COLS;
    const hy = (y - 0.835) / 0.15;
    const headBoost = hy * hy < 14 ? Math.exp(-hy * hy) * 0.032 : 0;
    const cy = (y - 0.28) / 0.28;
    const cy2 = cy * cy;
    for (let c = 0; c < halfCols; c++) {
      const x = RECT_MIN_X + (c / (SDF_COLS - 1)) * RECT_W;
      const cx = x / 0.22;
      const chestArg = cy2 + cx * cx;
      const chestBoost = chestArg < 14 ? Math.exp(-chestArg) * 0.028 : 0;
      const boost = 0.12 + headBoost + chestBoost;
      silBoostGrid[rowOff + c] = boost;
      silBoostGrid[rowOff + (SDF_COLS - 1 - c)] = boost;
    }
    for (let c = 0; c < SDF_COLS; c++) {
      const x = RECT_MIN_X + (c / (SDF_COLS - 1)) * RECT_W;
      dstRippleGrid[rowOff + c] = -0.045 + 0.022 * Math.sin(x * 4.2 + y * 3.1);
    }
  }

  staticSdfCache = { contour, sdfGrid, silBoostGrid, dstRippleGrid };
  return staticSdfCache;
}

const INV_RECT_W = 1 / RECT_W;
const INV_RECT_H = 1 / RECT_H;

function sampleSdfFromGrid(grid, x, y) {
  const tx = (x - RECT_MIN_X) * INV_RECT_W;
  const ty = (y - RECT_MIN_Y) * INV_RECT_H;
  const gx = (tx < 0 ? 0 : tx > 1 ? 1 : tx) * (SDF_COLS - 1);
  const gy = (ty < 0 ? 0 : ty > 1 ? 1 : ty) * (SDF_ROWS - 1);
  const ix = gx >= SDF_COLS - 1 ? SDF_COLS - 2 : gx | 0;
  const iy = gy >= SDF_ROWS - 1 ? SDF_ROWS - 2 : gy | 0;
  const fx = gx - ix;
  const fy = gy - iy;
  const i00 = iy * SDF_COLS + ix;
  const d00 = grid[i00];
  const d10 = grid[i00 + 1];
  const d01 = grid[i00 + SDF_COLS];
  const d11 = grid[i00 + SDF_COLS + 1];
  return (d00 + (d10 - d00) * fx) * (1 - fy) + (d01 + (d11 - d01) * fx) * fy;
}

function silDepthAt(x, y, d) {
  if (d >= 0) return 0;
  const inner = d <= -0.16 ? 1 : -d * 6.25;
  const oneMinus = 1 - inner;
  const dome = Math.sqrt(1 - oneMinus * oneMinus);
  return sampleSdfFromGrid(staticSdfCache.silBoostGrid, x, y) * dome;
}

const _nrm = [0, 0, 1];

function silNormalThreeInto(grid, x, y, zSign) {
  const eps = 0.018;
  const dx =
    (silDepthAt(x + eps, y, sampleSdfFromGrid(grid, x + eps, y)) -
      silDepthAt(x - eps, y, sampleSdfFromGrid(grid, x - eps, y))) /
    (2 * eps);
  const dy =
    (silDepthAt(x, y + eps, sampleSdfFromGrid(grid, x, y + eps)) -
      silDepthAt(x, y - eps, sampleSdfFromGrid(grid, x, y - eps))) /
    (2 * eps);
  const nx = -dx;
  const ny = -dy;
  const len = Math.hypot(nx, ny, zSign) || 1;
  _nrm[0] = nx / len;
  _nrm[1] = ny / len;
  _nrm[2] = zSign / len;
}

function dstSurfaceZ(x, y, sdf) {
  const dist = sdf > 0 ? sdf : 0;
  const expVal = dist >= DST_EXP_MAX
    ? 0.085 * Math.exp(-dist * 3.0)
    : DST_EXP_LUT[(dist * (1024 / DST_EXP_MAX) + 0.5) | 0];
  return expVal + sampleSdfFromGrid(staticSdfCache.dstRippleGrid, x, y);
}

function dstNormalThreeInto(grid, x, y) {
  const eps = 0.025;
  const dx =
    (dstSurfaceZ(x + eps, y, sampleSdfFromGrid(grid, x + eps, y)) -
      dstSurfaceZ(x - eps, y, sampleSdfFromGrid(grid, x - eps, y))) /
    (2 * eps);
  const dy =
    (dstSurfaceZ(x, y + eps, sampleSdfFromGrid(grid, x, y + eps)) -
      dstSurfaceZ(x, y - eps, sampleSdfFromGrid(grid, x, y - eps))) /
    (2 * eps);
  const nx = -dx;
  const ny = -dy;
  const len = Math.hypot(nx, ny, 1) || 1;
  _nrm[0] = nx / len;
  _nrm[1] = ny / len;
  _nrm[2] = 1 / len;
}

function silDepartAt(x, y) {
  const radial = Math.min(1, Math.hypot(x / 0.48, (y - 0.28) / 1.15));
  const yNorm = clamp01((y + 1.05) / 2.1);
  const ripple = 0.065 * Math.sin(x * 7.5 + y * 5.0) + 0.045 * Math.cos(x * 13.0 - y * 9.5);
  const w = clamp01(0.55 * (1 - radial) + 0.28 * yNorm + 0.08 + ripple);
  return 0.18 * w;
}

function dstArriveAt(x, y, sdfGrid) {
  const sdf = Math.max(0, sampleSdfFromGrid(sdfGrid, x, y));
  const yNorm = clamp01((y - RECT_MIN_Y) / RECT_H);
  const ripple = 0.065 * Math.sin(x * 7.5 + y * 5.0) + 0.045 * Math.cos(x * 13.0 - y * 9.5);
  const w = clamp01(0.5 * Math.min(1, sdf / 0.48) + 0.34 * yNorm + 0.08 + ripple);
  return 0.58 + 0.36 * w;
}

// Base
function buildSiluetaBase() {
  const root = new T.Group();
  root.name = 'Silueta';
  const K = 2.2;
  const positions = new Float32Array([
    -0.4 * K, -0.986 * K, -0.135 * K, 0.4 * K, -0.986 * K, 0.135 * K, 0.0, 0.975 * K, 0.0,
    -0.4 * K, -0.986 * K, 0.135 * K, 0.4 * K, -0.986 * K, -0.135 * K, 0.0, 0.975 * K, 0.0,
  ]);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const mat = new T.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.72 });
  root.add(new T.Mesh(geo, mat));
  return root;
}

// Mascara
function fillMaskWithPoem(cols, rows, isActive, mirrorHorizontal, poemLines) {
  const results = new Array(rows);
  const lookup = getPoemRowLookup(poemLines, rows);
  for (let r = 0; r < rows; r++) {
    const charCells = [];
    const pLine = lookup ? lookup.rowStrs[r] : '';
    const pLen = lookup ? lookup.rowLens[r] : 0;
    const pOff = lookup ? lookup.rowOffs[r] : 0;
    for (let c = 0; c < cols; c++) {
      if (!isActive(c, r)) continue;
      const outCol = mirrorHorizontal ? cols - 1 - c : c;
      const ch = pLen > 0 ? pLine[(outCol + pOff) % pLen] : '·';
      charCells.push({ c: outCol, ch });
    }
    results[r] = { charCells, spaceCells: [] };
  }
  return results;
}

function sortBySpatialBand(slots) {
  const n = slots.length;
  const indices = new Array(n);
  const bands = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    indices[i] = i;
    bands[i] = Math.round(slots[i].ny * 6.5);
  }
  indices.sort((ia, ib) => {
    const bandA = bands[ia];
    const bandB = bands[ib];
    if (bandA !== bandB) return bandB - bandA;
    const a = slots[ia];
    const b = slots[ib];
    if (a.nx !== b.nx) return a.nx - b.nx;
    return a.ny - b.ny;
  });
  return indices;
}

// Trama
function buildUnifiedLayout(gridCols, gridRows, cellWidth, cellHeight, zoom, centerCol, centerRow, poemLines = DEFAULT_POEM_LINES) {
  const { sdfGrid } = getStaticSdfCache();
  const worldPerCol = cellWidth / zoom;
  const worldPerRow = cellHeight / zoom;
  const maxFieldRows = centerRow < gridRows * 0.42
    ? Math.min(gridRows - 4, Math.round(gridRows * 0.46), Math.max(18, Math.floor((centerRow - 1.5) * 2)))
    : Math.min(gridRows - 4, Math.round(gridRows * 0.80));
  const fieldRows = Math.max(18, maxFieldRows);
  const fieldCols = Math.max(
    16,
    Math.min(gridCols - 4, Math.round(fieldRows * (RECT_W / RECT_H) * (cellHeight / cellWidth))),
  );
  const startCol = Math.round(centerCol - fieldCols * 0.5);
  const startRow = Math.max(1, Math.min(gridRows - fieldRows - 1, Math.round(centerRow - fieldRows * 0.5)));
  const fieldHeightWorld = fieldRows * worldPerRow;
  const depthWorldScale = fieldHeightWorld / RECT_H;
  const invFieldCols = 1 / fieldCols;
  const invFieldRows = 1 / fieldRows;

  const normXArr = new Float64Array(fieldCols);
  const worldXArr = new Float64Array(fieldCols);
  for (let c = 0; c < fieldCols; c++) {
    normXArr[c] = RECT_MIN_X + (c + 0.5) * invFieldCols * RECT_W;
    worldXArr[c] = (startCol + c - centerCol) * worldPerCol;
  }
  const normYArr = new Float64Array(fieldRows);
  const worldYArr = new Float64Array(fieldRows);
  for (let r = 0; r < fieldRows; r++) {
    normYArr[r] = RECT_MAX_Y - (r + 0.5) * invFieldRows * RECT_H;
    worldYArr[r] = (centerRow - (startRow + r)) * worldPerRow;
  }

  const cellSdf = new Float32Array(fieldCols * fieldRows);
  for (let r = 0; r < fieldRows; r++) {
    const ny = normYArr[r];
    const off = r * fieldCols;
    for (let c = 0; c < fieldCols; c++) {
      cellSdf[off + c] = sampleSdfFromGrid(sdfGrid, normXArr[c], ny);
    }
  }
  const isSilCell = (c, r) => cellSdf[r * fieldCols + c] <= -0.004;
  const isDstCell = (c, r) => cellSdf[r * fieldCols + c] > 0.012;
  const srcSlots = [];
  const dstSlots = [];
  const occluders = [];
  const dstOccluders = [];
  const silFrontRows = fillMaskWithPoem(fieldCols, fieldRows, isSilCell, false, poemLines);
  for (let r = 0; r < fieldRows; r++) {
    const rowRes = silFrontRows[r];
    const ny = normYArr[r];
    const wyRaw = worldYArr[r];
    const rowOff = r * fieldCols;
    for (let i = 0; i < rowRes.charCells.length; i++) {
      const { c, ch } = rowRes.charCells[i];
      const nx = normXArr[c];
      const wxRaw = worldXArr[c];
      const sdf = cellSdf[rowOff + c];
      const wz = silDepthAt(nx, ny, sdf) * depthWorldScale;
      const kInv = 1 - (wz * 50) / 32000;
      silNormalThreeInto(sdfGrid, nx, ny, 1);
      srcSlots.push({
        c, r, nx, ny, wx: wxRaw * kInv, wy: wyRaw * kInv, wz,
        gnx: _nrm[2], gny: _nrm[0], gnz: _nrm[1],
        sdf, rimGlow: sdf > -0.045 ? clamp01(1 + sdf / 0.045) : 0, ch,
      });
    }
  }
  const silBackRows = fillMaskWithPoem(
    fieldCols,
    fieldRows,
    (c, r) => isSilCell(fieldCols - 1 - c, r),
    true,
    poemLines,
  );
  for (let r = 0; r < fieldRows; r++) {
    const rowRes = silBackRows[r];
    const ny = normYArr[r];
    const wyRaw = worldYArr[r];
    const rowOff = r * fieldCols;
    for (let i = 0; i < rowRes.charCells.length; i++) {
      const { c, ch } = rowRes.charCells[i];
      const nx = normXArr[c];
      const wxRaw = worldXArr[c];
      const sdf = cellSdf[rowOff + c];
      const wz = -silDepthAt(nx, ny, sdf) * depthWorldScale;
      const kInv = 1 - (Math.abs(wz) * 50) / 32000;
      silNormalThreeInto(sdfGrid, nx, ny, -1);
      srcSlots.push({
        c, r, nx, ny, wx: wxRaw * kInv, wy: wyRaw * kInv, wz,
        gnx: _nrm[2], gny: _nrm[0], gnz: _nrm[1],
        sdf, rimGlow: sdf > -0.045 ? clamp01(1 + sdf / 0.045) : 0, ch,
      });
    }
  }
  const rimSlices = [-0.22, -0.06];
  for (let r = 1; r < fieldRows - 1; r++) {
    const ny = normYArr[r];
    const wyRaw = worldYArr[r];
    const rowOff = r * fieldCols;
    for (let c = 1; c < fieldCols - 1; c++) {
      if (!isSilCell(c, r)) continue;
      const isEdge =
        !isSilCell(c - 1, r) ||
        !isSilCell(c + 1, r) ||
        !isSilCell(c, r - 1) ||
        !isSilCell(c, r + 1);
      if (!isEdge || (c + r) % 2 !== 0) continue;
      const nx = normXArr[c];
      const wxRaw = worldXArr[c];
      const sdf = cellSdf[rowOff + c];
      const zMax = Math.max(0.035, silDepthAt(nx, ny, sdf)) * depthWorldScale;
      const gx = cellSdf[rowOff + (c + 1)] - cellSdf[rowOff + (c - 1)];
      const gy = cellSdf[rowOff - fieldCols + c] - cellSdf[rowOff + fieldCols + c];
      const gLen = Math.hypot(gx, gy) || 1;
      const outX = gx / gLen;
      const outY = gy / gLen;
      const rowChars = silFrontRows[r].charCells;
      let ch = null;
      for (let k = 0; k < rowChars.length; k++) {
        if (rowChars[k].c === c) { ch = rowChars[k].ch; break; }
      }
      if (ch === null) continue;
      for (let sIdx = 0; sIdx < rimSlices.length; sIdx++) {
        const wz = zMax * rimSlices[sIdx];
        srcSlots.push({
          c, r, nx, ny, wx: wxRaw, wy: wyRaw, wz,
          gnx: rimSlices[sIdx] * 0.35, gny: outX, gnz: outY,
          sdf, rimGlow: 0.75, ch,
        });
      }
    }
  }
  const dstFrontRows = fillMaskWithPoem(fieldCols, fieldRows, isDstCell, false, poemLines);
  const dstOccupied = [];
  for (let r = 0; r < fieldRows; r++) {
    const rowRes = dstFrontRows[r];
    const ny = normYArr[r];
    const wyRaw = worldYArr[r];
    const rowOff = r * fieldCols;
    for (let i = 0; i < rowRes.charCells.length; i++) {
      const { c, ch } = rowRes.charCells[i];
      const nx = normXArr[c];
      const wxRaw = worldXArr[c];
      const sdf = cellSdf[rowOff + c];
      const wz = dstSurfaceZ(nx, ny, sdf) * depthWorldScale;
      const kInv = 1 - (wz * 50) / 32000;
      dstNormalThreeInto(sdfGrid, nx, ny);
      const slot = {
        c, r, nx, ny, wx: wxRaw * kInv, wy: wyRaw * kInv, wz,
        gnx: _nrm[2], gny: _nrm[0], gnz: _nrm[1],
        sdf, rimGlow: sdf < 0.055 ? clamp01(1 - sdf / 0.055) : 0, ch,
      };
      dstSlots.push(slot);
      dstOccupied.push(slot);
    }
  }
  if (srcSlots.length > dstSlots.length) {
    const surplus = srcSlots.length - dstSlots.length;
    const nearRimCandidates = dstOccupied.filter((d) => d.sdf < 0.055);
    let added = 0;
    const rimCap = Math.min(surplus, nearRimCandidates.length);
    for (let i = 0; i < rimCap; i++) {
      const idx = Math.floor((i * nearRimCandidates.length) / rimCap);
      const base = nearRimCandidates[idx];
      const depthShift = (0.12 + 0.1 * hash01(i * 17.3)) * depthWorldScale;
      dstSlots.push({
        ...base,
        wz: base.wz - depthShift,
        gnx: -0.7,
        rimGlow: 0.7,
      });
      added++;
    }
    const remaining = surplus - added;
    for (let i = 0; i < remaining; i++) {
      const idx = Math.floor((i * dstOccupied.length) / remaining) % dstOccupied.length;
      const base = dstOccupied[idx];
      const depthShift = (0.16 + 0.12 * hash01(i * 41.7 + 2.3)) * depthWorldScale;
      dstSlots.push({
        ...base,
        wz: base.wz - depthShift,
        gnx: -0.95,
        gny: -base.gny * 0.25,
        gnz: -base.gnz * 0.25,
        rimGlow: base.rimGlow * 0.5,
      });
    }
  } else if (dstSlots.length > srcSlots.length) {
    const deficit = dstSlots.length - srcSlots.length;
    const frontCount = silFrontRows.reduce((acc, row) => acc + row.charCells.length, 0);
    for (let i = 0; i < deficit; i++) {
      const base = srcSlots[Math.floor((i * frontCount) / deficit) % Math.max(1, frontCount)];
      srcSlots.push({
        ...base,
        wz: -Math.abs(base.wz) * (0.28 + 0.34 * hash01(i * 29.1)),
      });
    }
  }
  const srcBuckets = new Map();
  const dstBuckets = new Map();
  for (let i = 0; i < srcSlots.length; i++) {
    const s = srcSlots[i];
    let arr = srcBuckets.get(s.ch);
    if (!arr) {
      arr = [];
      srcBuckets.set(s.ch, arr);
    }
    arr.push(s);
  }
  for (let i = 0; i < dstSlots.length; i++) {
    const d = dstSlots[i];
    let arr = dstBuckets.get(d.ch);
    if (!arr) {
      arr = [];
      dstBuckets.set(d.ch, arr);
    }
    arr.push(d);
  }
  const pairedSrc = [];
  const pairedDst = [];
  const leftoverSrc = [];
  const leftoverDst = [];
  for (const [ch, sList] of srcBuckets) {
    const dList = dstBuckets.get(ch) ?? [];
    const sOrder = sortBySpatialBand(sList);
    const dOrder = sortBySpatialBand(dList);
    const matchCount = Math.min(sOrder.length, dOrder.length);
    for (let i = 0; i < matchCount; i++) {
      pairedSrc.push(sList[sOrder[i]]);
      pairedDst.push(dList[dOrder[i]]);
    }
    for (let i = matchCount; i < sOrder.length; i++) {
      leftoverSrc.push(sList[sOrder[i]]);
    }
  }
  for (const [ch, dList] of dstBuckets) {
    const sLen = srcBuckets.get(ch)?.length ?? 0;
    if (dList.length > sLen) {
      const dOrder = sortBySpatialBand(dList);
      for (let i = sLen; i < dOrder.length; i++) {
        leftoverDst.push(dList[dOrder[i]]);
      }
    }
  }
  const lSrcOrder = sortBySpatialBand(leftoverSrc);
  const lDstOrder = sortBySpatialBand(leftoverDst);
  const remCount = Math.min(lSrcOrder.length, lDstOrder.length);
  for (let i = 0; i < remCount; i++) {
    pairedSrc.push(leftoverSrc[lSrcOrder[i]]);
    pairedDst.push(leftoverDst[lDstOrder[i]]);
  }
  const count = pairedSrc.length;
  const x0 = new Float32Array(count);
  const y0 = new Float32Array(count);
  const z0 = new Float32Array(count);
  const dxArr = new Float32Array(count);
  const dyArr = new Float32Array(count);
  const dzArr = new Float32Array(count);
  const nx0 = new Float32Array(count);
  const ny0 = new Float32Array(count);
  const nz0 = new Float32Array(count);
  const dnxArr = new Float32Array(count);
  const dnyArr = new Float32Array(count);
  const dnzArr = new Float32Array(count);
  const tStart = new Float32Array(count);
  const invDur = new Float32Array(count);
  const tEnd = new Float32Array(count);
  const rim0 = new Float32Array(count);
  const dRimArr = new Float32Array(count);
  const txSwirl = new Float32Array(count);
  const tySwirl = new Float32Array(count);
  const swirlMul = new Float32Array(count);
  const phaseOff = new Float32Array(count);
  const zArchAmp = new Float32Array(count);
  const srcChar = new Array(count);
  const dstChar = new Array(count);
  const shimmerSpan = 0.025 * fieldHeightWorld;
  const swirlScale = 0.065 * fieldHeightWorld;
  for (let i = 0; i < count; i++) {
    const sSlot = pairedSrc[i];
    const dSlot = pairedDst[i];
    const sx = sSlot.wx, sy = sSlot.wy, sz = sSlot.wz;
    const dx = dSlot.wx - sx, dy = dSlot.wy - sy, dz = dSlot.wz - sz;
    x0[i] = sx;
    y0[i] = sy;
    z0[i] = sz;
    dxArr[i] = dx;
    dyArr[i] = dy;
    dzArr[i] = dz;
    nx0[i] = sSlot.gnx;
    ny0[i] = sSlot.gny;
    nz0[i] = sSlot.gnz;
    dnxArr[i] = dSlot.gnx - sSlot.gnx;
    dnyArr[i] = dSlot.gny - sSlot.gny;
    dnzArr[i] = dSlot.gnz - sSlot.gnz;
    const st = silDepartAt(sSlot.nx, sSlot.ny);
    const en = Math.min(0.94, Math.max(st + 0.48, dstArriveAt(dSlot.nx, dSlot.ny, sdfGrid)));
    tStart[i] = st;
    tEnd[i] = en;
    invDur[i] = 1 / (en - st);
    rim0[i] = sSlot.rimGlow;
    dRimArr[i] = dSlot.rimGlow - sSlot.rimGlow;
    const h1 = hash01(i * 19.7 + 1.3);
    const h2 = hash01(i * 43.1 + 7.1);
    const sDir = h2 >= 0.5 ? 1 : -1;
    const len = Math.hypot(dx, dy) || 1;
    const sw = swirlScale * (0.45 + 0.55 * h1);
    txSwirl[i] = (-dy / len) * sDir * sw;
    tySwirl[i] = (dx / len) * sDir * sw;
    swirlMul[i] = shimmerSpan;
    phaseOff[i] = h1 * 6.283;
    const zSign = sz >= 0 ? 1 : -1;
    zArchAmp[i] = zSign * (0.14 + 0.2 * h1) * depthWorldScale;
    srcChar[i] = sSlot.ch;
    dstChar[i] = dSlot.ch;
  }
  return {
    gridCols, gridRows, fieldCols, fieldRows, startCol, startRow,
    cellWidth, cellHeight, centerCol, centerRow, zoom,
    fieldHeightWorld, count,
    x0, y0, z0, dxArr, dyArr, dzArr, nx0, ny0, nz0, dnxArr, dnyArr, dnzArr,
    tStart, tEnd, invDur, rim0, dRimArr, txSwirl, tySwirl, swirlMul, phaseOff, zArchAmp,
    srcChar, dstChar,
    occluders, dstOccluders,
  };
}

function stampSpaceOccludersAffine(
  occs,
  activePredicate,
  ox, oy, oz, ax, ay, az, bx, by, bz, cx, cy, cz,
  cols,
  rows,
  depth,
) {
  for (let i = 0; i < occs.length; i++) {
    const occ = occs[i];
    if (!activePredicate(occ.tDepart)) continue;
    const px = ox + occ.wz * ax + occ.wx * bx + occ.wy * cx;
    const py = oy + occ.wz * ay + occ.wx * by + occ.wy * cy;
    const zBuf = oz + occ.wz * az + occ.wx * bz + occ.wy * cz;
    const c = Math.round(px);
    const r = Math.round(py);
    if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
    const idx = r * cols + c;
    if (Number.isFinite(zBuf) && zBuf > depth[idx]) {
      depth[idx] = zBuf;
    }
  }
}

// Efecto
function createSiluetaPoemEffect() {
  let layout = null;
  let layoutLinesKey = '';
  let rowCountBuf = new Int16Array(0);
  let nxRowBuf = new Float64Array(0);
  const rig = LIGHT_RIGS.silueta;
  const [kx, ky, kz] = rig.keyDir;
  const [fx, fy, fz] = rig.fillDir;
  const [rx, ry, rz] = rig.rimDir;
  const vx = 1, vy = 0, vz = 0;
  let hx = kx + vx, hy = ky + vy, hz = kz + vz;
  const hLen = Math.hypot(hx, hy, hz) || 1;
  hx /= hLen; hy /= hLen; hz /= hLen;
  const invWrap = 1 / (1 + rig.wrap);
  const hemiDelta = rig.hemiSky - rig.hemiGround;
  const specScale = rig.specScale * 0.35;

  return (grid, state, context) => {
    const { cols, rows, char, color, depth } = grid;
    const total = cols * rows;
    if (total === 0 || !context) return;
    const { camera, scene, cellAspect, metrics } = context;
    const activeLines = context.lines && context.lines.length ? context.lines : DEFAULT_POEM_LINES;
    const linesKey = activeLines.join('|');
    const cw = metrics.cellWidth ?? (scene.host.clientWidth > 0 ? scene.host.clientWidth / cols : 5.4);
    const chPx = metrics.cellHeight ?? (scene.host.clientHeight > 0 ? scene.host.clientHeight / rows : 9.0);
    const centerCol = metrics.centerCol ?? cols * camera.center[0];
    const centerRow = metrics.centerRow ?? rows * camera.center[1];
    const zoom = camera.zoom;
    if (
      !layout ||
      layoutLinesKey !== linesKey ||
      layout.gridCols !== cols ||
      layout.gridRows !== rows ||
      Math.abs(layout.cellWidth - cw) > 0.05 ||
      Math.abs(layout.cellHeight - chPx) > 0.05 ||
      Math.abs(layout.centerCol - centerCol) > 0.05 ||
      Math.abs(layout.centerRow - centerRow) > 0.05 ||
      Math.abs(layout.zoom - zoom) > 0.01
    ) {
      layout = buildUnifiedLayout(cols, rows, cw, chPx, zoom, centerCol, centerRow, activeLines);
      layoutLinesKey = linesKey;
    }
    char.fill(' ');
    color.fill(null);
    depth.fill(-Infinity);
    const s = clamp01(state.scrollIntensity);
    const restStart = s <= 0.0005;
    const restEnd = s >= 0.945;
    const tNow = state.time || 0;
    const bobZ = 0;
    const isDefaultFront =
      Math.abs((camera?.rotX ?? 90) - 90) < 0.5 &&
      Math.abs((((camera?.rotY ?? 0) % 360) + 360) % 360) < 0.5;
    const poemLookup = getPoemRowLookup(activeLines, rows);

    if ((restStart || restEnd) && isDefaultFront) {
      const { sdfGrid } = getStaticSdfCache();
      const { fieldCols, fieldRows, startCol, startRow, fieldHeightWorld } = layout;
      const bobNormY = (bobZ / fieldHeightWorld) * RECT_H;
      const rMin = Math.max(0, startRow - 4);
      const rMax = Math.min(rows - 1, startRow + fieldRows + 3);
      const cMin = Math.max(0, startCol);
      const cMax = Math.min(cols - 1, startCol + fieldCols - 1);
      if (nxRowBuf.length < fieldCols) nxRowBuf = new Float64Array(fieldCols);
      for (let c = cMin; c <= cMax; c++) {
        nxRowBuf[c - startCol] = RECT_MIN_X + ((c - startCol + 0.5) / fieldCols) * RECT_W;
      }
      const invFieldRows = 1 / fieldRows;
      for (let r = rMin; r <= rMax; r++) {
        const ny = RECT_MAX_Y - ((r - startRow + 0.5) * invFieldRows) * RECT_H - bobNormY;
        if (ny < RECT_MIN_Y || ny > RECT_MAX_Y) continue;
        const rowOff = r * cols;
        const pLine = poemLookup ? poemLookup.rowStrs[r] : '';
        const pLen = poemLookup ? poemLookup.rowLens[r] : 0;
        const pOff = poemLookup ? poemLookup.rowOffs[r] : 0;
        const ty = (ny - RECT_MIN_Y) * INV_RECT_H;
        const gy = (ty < 0 ? 0 : ty > 1 ? 1 : ty) * (SDF_ROWS - 1);
        const iy = gy >= SDF_ROWS - 1 ? SDF_ROWS - 2 : gy | 0;
        const fy = gy - iy;
        const oneMinusFy = 1 - fy;
        const sdfRow0 = iy * SDF_COLS;
        const sdfRow1 = sdfRow0 + SDF_COLS;
        for (let c = cMin; c <= cMax; c++) {
          const nx = nxRowBuf[c - startCol];
          const tx = (nx - RECT_MIN_X) * INV_RECT_W;
          const gx = (tx < 0 ? 0 : tx > 1 ? 1 : tx) * (SDF_COLS - 1);
          const ix = gx >= SDF_COLS - 1 ? SDF_COLS - 2 : gx | 0;
          const fxS = gx - ix;
          const d00 = sdfGrid[sdfRow0 + ix];
          const d10 = sdfGrid[sdfRow0 + ix + 1];
          const d01 = sdfGrid[sdfRow1 + ix];
          const d11 = sdfGrid[sdfRow1 + ix + 1];
          const sdf = (d00 + (d10 - d00) * fxS) * oneMinusFy + (d01 + (d11 - d01) * fxS) * fy;
          const inside = restStart ? sdf <= -0.004 : sdf > 0.012;
          if (!inside) continue;

          const idx = rowOff + c;
          if (restStart) silNormalThreeInto(sdfGrid, nx, ny, 1);
          else dstNormalThreeInto(sdfGrid, nx, ny);
          const gnx = _nrm[2];
          const gny = _nrm[0];
          const gnz = _nrm[1];
          depth[idx] = restStart
            ? 1 + silDepthAt(nx, ny, sdf) * 10
            : 1 + dstSurfaceZ(nx, ny, sdf) * 5;
          char[idx] = pLen > 0 ? pLine[(c + pOff) % pLen] : '·';
          const ndv = gnx < 0 ? -gnx : gnx;
          const ndotl = gnx * kx + gny * ky + gnz * kz;
          const keyDiff = ndotl + rig.wrap > 0 ? (ndotl + rig.wrap) * invWrap : 0;
          const fillDot = gnx * fx + gny * fy + gnz * fz;
          const fillDiff = fillDot > 0 ? fillDot : 0;
          const hemi = rig.hemiGround + hemiDelta * (0.5 + 0.5 * gnz);
          const hd = gnx * hx + gny * hy + gnz * hz;
          const spec = hd > 0.05
            ? SIL_POW26_LUT[hd >= 1 ? 1024 : (hd * 1024 + 0.5) | 0] * specScale * (0.35 + (ndotl > 0 ? 0.65 * ndotl : 0))
            : 0;
          const fresnel = SIL_POW23_LUT[ndv >= 1 ? 1024 : (ndv * 1024 + 0.5) | 0];
          const rimDot = gnx * rx + gny * ry + gnz * rz;
          const rimGate = 0.35 + (rimDot > 0 ? 0.65 * rimDot : 0);
          const rimGlow = restStart
            ? (sdf > -0.045 ? clamp01(1 + sdf / 0.045) : 0)
            : (sdf < 0.055 ? clamp01(1 - sdf / 0.055) : 0);
          const rim = fresnel * rimGate * rig.rimIntensity + rimGlow * 0.14;
          const diffSum = hemi + 0.08 * ndv + keyDiff * rig.keyIntensity + fillDiff * rig.fillIntensity;
          const litRatio = (diffSum > rig.minFloor ? diffSum : rig.minFloor) + spec + rim;
          color[idx] = SIL_SHADE_LUT[litRatio >= 2.0 ? 1024 : litRatio <= 0 ? 0 : (litRatio * 512 + 0.5) | 0];
        }
      }
    } else {
      const p0 = camera.project([0, 0, 0], cols, rows, cellAspect, metrics);
      const px1 = camera.project([1, 0, 0], cols, rows, cellAspect, metrics);
      const py1 = camera.project([0, 1, 0], cols, rows, cellAspect, metrics);
      const pz1 = camera.project([0, 0, 1], cols, rows, cellAspect, metrics);
      const ox = p0[0], oy = p0[1], oz = p0[3] ?? p0[2];
      const ax = px1[0] - ox, ay = px1[1] - oy, az = (px1[3] ?? px1[2]) - oz;
      const bx = py1[0] - ox, by = py1[1] - oy, bz = (py1[3] ?? py1[2]) - oz;
      const cx = pz1[0] - ox, cy = pz1[1] - oy, cz = (pz1[3] ?? pz1[2]) - oz;

      if (s < 0.22 && layout.occluders.length) {
        stampSpaceOccludersAffine(
          layout.occluders,
          (tDepart) => s <= tDepart,
          ox, oy, oz, ax, ay, az, bx, by, bz, cx, cy, cz,
          cols, rows, depth,
        );
      } else if (s > 0.72 && layout.dstOccluders.length) {
        if (Number.isFinite(p0[2]) && Number.isFinite(px1[2]) && px1[2] > p0[2]) {
          stampSpaceOccludersAffine(
            layout.dstOccluders,
            (tArrive) => s >= tArrive,
            ox, oy, oz, ax, ay, az, bx, by, bz, cx, cy, cz,
            cols, rows, depth,
          );
        }
      }

      const {
        count, x0, y0, z0, dxArr, dyArr, dzArr, nx0, ny0, nz0, dnxArr, dnyArr, dnzArr,
        tStart, tEnd, invDur, rim0, dRimArr, txSwirl, tySwirl, swirlMul, phaseOff, zArchAmp,
        srcChar, dstChar,
      } = layout;
      const skipDepth = restStart || restEnd;
      for (let i = 0; i < count; i++) {
        let u;
        if (restStart) {
          u = 0;
        } else if (restEnd) {
          u = 1;
        } else {
          const st = tStart[i];
          if (s <= st) u = 0;
          else if (s >= tEnd[i]) u = 1;
          else {
            const t = (s - st) * invDur[i];
            u = t * t * (3 - 2 * t);
          }
        }
        let wx, wy, wz, arc = 0;
        if (u === 0) {
          wx = x0[i]; wy = y0[i]; wz = z0[i];
        } else if (u === 1) {
          wx = x0[i] + dxArr[i]; wy = y0[i] + dyArr[i]; wz = z0[i] + dzArr[i];
        } else {
          arc = Math.sin(u * Math.PI);
          const shimmer = Math.sin(u * 6.2831853 + phaseOff[i]) * swirlMul[i] * arc;
          wx = x0[i] + dxArr[i] * u + txSwirl[i] * arc;
          wy = y0[i] + dyArr[i] * u + tySwirl[i] * arc + shimmer;
          wz = z0[i] + dzArr[i] * u + zArchAmp[i] * arc;
        }
        if (u < 0.5 && z0[i] <= 0) continue;
        const wyBob = wy + bobZ;
        const pc = ox + wz * ax + wx * bx + wyBob * cx;
        const pr = oy + wz * ay + wx * by + wyBob * cy;
        if (!Number.isFinite(pc) || !Number.isFinite(pr)) continue;
        const c = Math.round(pc);
        const r = Math.round(pr);
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const idx = r * cols + c;
        const zBuf = oz + wz * az + wx * bz + wyBob * cz;
        if (!skipDepth && (!Number.isFinite(zBuf) || zBuf <= depth[idx])) continue;
        depth[idx] = zBuf;
        if (u === 0 || u === 1) {
          if (poemLookup && poemLookup.rowLens[r] > 0) {
            char[idx] = poemLookup.rowStrs[r][(c + poemLookup.rowOffs[r]) % poemLookup.rowLens[r]];
          } else {
            char[idx] = srcChar[i];
          }
        } else {
          const sc = srcChar[i];
          const dc = dstChar[i];
          char[idx] = sc === dc ? sc : u < 0.5 ? sc : dc;
        }
        let gnx = nx0[i] + dnxArr[i] * u;
        let gny = ny0[i] + dnyArr[i] * u;
        let gnz = nz0[i] + dnzArr[i] * u;
        const nLen = Math.hypot(gnx, gny, gnz) || 1;
        gnx /= nLen; gny /= nLen; gnz /= nLen;
        const ndv = Math.abs(gnx * vx + gny * vy + gnz * vz);
        const ndotl = gnx * kx + gny * ky + gnz * kz;
        const keyDiff = ndotl + rig.wrap > 0 ? (ndotl + rig.wrap) * invWrap : 0;
        const fillDot = gnx * fx + gny * fy + gnz * fz;
        const fillDiff = fillDot > 0 ? fillDot : 0;
        const hemi = rig.hemiGround + hemiDelta * (0.5 + 0.5 * gnz);
        const hd = gnx * hx + gny * hy + gnz * hz;
        const spec = hd > 0.05
          ? SIL_POW26_LUT[hd >= 1 ? 1024 : (hd * 1024 + 0.5) | 0] * specScale * (0.35 + (ndotl > 0 ? 0.65 * ndotl : 0))
          : 0;
        const fresnel = SIL_POW23_LUT[ndv >= 1 ? 1024 : (ndv * 1024 + 0.5) | 0];
        const rimDot = gnx * rx + gny * ry + gnz * rz;
        const rimGate = 0.35 + (rimDot > 0 ? 0.65 * rimDot : 0);
        const rim = fresnel * rimGate * rig.rimIntensity + (rim0[i] + dRimArr[i] * u) * 0.14;
        const flightGlow = arc * 0.22;
        const diffSum = hemi + 0.08 * ndv + keyDiff * rig.keyIntensity + fillDiff * rig.fillIntensity;
        const litRatio = (diffSum > rig.minFloor ? diffSum : rig.minFloor) + spec + rim + flightGlow;
        color[idx] = SIL_SHADE_LUT[litRatio >= 2.0 ? 1024 : litRatio <= 0 ? 0 : (litRatio * 512 + 0.5) | 0];
      }
    }

    if (rowCountBuf.length < rows) rowCountBuf = new Int16Array(rows);
    const rowCount = rowCountBuf;
    for (let r = 0; r < rows; r++) {
      let n = 0;
      const off = r * cols;
      for (let c = 0; c < cols; c++) if (char[off + c] !== ' ') n++;
      rowCount[r] = n;
    }
    for (let r = 1; r < rows - 1; r++) {
      if (rowCount[r] !== 0) continue;
      let r2 = r;
      while (r2 < rows - 1 && rowCount[r2] === 0) r2++;
      const gap = r2 - r;
      if (gap <= 2 && rowCount[r - 1] > 0 && r2 < rows && rowCount[r2] > 0) {
        const srcOff = (r - 1) * cols;
        for (let rf = r; rf < r2; rf++) {
          const dstOff = rf * cols;
          for (let c = 0; c < cols; c++) {
            const src = char[srcOff + c];
            if (src === ' ') continue;
            const j = dstOff + c;
            char[j] = src;
            color[j] = color[srcOff + c];
            depth[j] = depth[srcOff + c];
          }
        }
      }
      r = r2;
    }
  };
}

// Estado
let _silRoot = null;

export function crearSilueta() {
  if (!_silRoot) _silRoot = buildSiluetaBase();
  return {
    root: _silRoot,
    kind: 'silueta',
    duration: SIL_DURATION,
    animated: true,
    fitRoot: true,
    prewarm() {
      getStaticSdfCache();
      buildUnifiedLayout(60, 28, 8, 14, 150, 21, 14, DEFAULT_POEM_LINES);
    },
    cellEffect: createSiluetaPoemEffect(),
    stageEffect(output, state) {
      if (!output) return;
      output.classList.add('glyph-output--floating');
      const floatPx = Math.sin(((state?.time || 0) / LEVITATION_PERIOD) * Math.PI * 2) * 7.5;
      output.style.setProperty('--float-y', `${floatPx.toFixed(2)}px`);
    },
    update() {},
    frame() {},
    buildFrame() { return []; },
  };
}