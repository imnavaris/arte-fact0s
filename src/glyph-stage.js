import { createGlyphScene, createGlyphOrthographicCamera } from "glyphcss";
import { preparePoemLines, getPoemRowLookup } from "./modelos/compartido.js";
import { LIGHT_RIGS, shadePolygons, applyDepthCreviceAO } from "./lighting.js";
// Trama
const CELL_W = 8;
const CELL_H = 14;
const FIRE = "^/\\|*+xX#%@";
const ASH = ".,\x27`";
const FIRE_MAX = 36;
const NOISE = " .:-=+*#%@";
const SMOKE = "\u00b7.:oO\u00b0";
const lerp = (a, b, t) => a + (b - a) * t;
let tvBandLut = null;
let tvGrayLut = null;
let fireColorLut = null;
// Rampa
function tvBand() {
  if (!tvBandLut) {
    const palette = Array.from({ length: 5 }, (_, k) => {
      const t = k / 4;
      const r = Math.round(92 + t * 148);
      const g = Math.round(88 + t * 144);
      const b = Math.round(82 + t * 136);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    });
    tvBandLut = Array.from({ length: 256 }, (_, q) => palette[Math.round((q / 255) * 4)]);
  }
  return tvBandLut;
}
function tvGray() {
  if (!tvGrayLut) {
    const palette = Array.from({ length: 5 }, (_, k) => {
      const a = Math.round(68 + (k / 4) * 168);
      const r = a;
      const g = Math.round(a * 0.98);
      const b = Math.round(a * 0.94);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    });
    tvGrayLut = Array.from({ length: 256 }, (_, q) => palette[Math.round((q / 255) * 4)]);
  }
  return tvGrayLut;
}
function fireColors() {
  if (!fireColorLut) {
    const stops = [[90, 46, 16], [185, 92, 20], [235, 158, 34], [255, 220, 120], [255, 246, 215]];
    const palette = Array.from({ length: 8 }, (_, k) => {
      const t = k / 7;
      const f = t * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(f));
      const frac = f - i;
      const c = stops[i].map((v, j) => Math.round(lerp(v, stops[i + 1][j], frac)));
      return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
    });
    fireColorLut = Array.from({ length: FIRE_MAX + 1 }, (_, h) => palette[Math.round((h / FIRE_MAX) * 7)]);
  }
  return fireColorLut;
}
function hash(r, c) {
  return Math.abs((r * 73856093) ^ (c * 19349663));
}
function isTvScreenCell(col) {
  if (typeof col !== "string" || col.length !== 7 || col[0] !== "#") return false;
  let hit = screenCache.get(col);
  if (hit === undefined) {
    const r = parseInt(col.slice(1, 3), 16);
    const b = parseInt(col.slice(5, 7), 16);
    hit = b - r >= 8;
    if (screenCache.size > 512) screenCache.clear();
    screenCache.set(col, hit);
  }
  return hit;
}
const screenCache = new Map();
const coolCache = new Map();
function neutralizeCoolColor(col) {
  if (typeof col !== "string" || col.length !== 7 || col[0] !== "#") return col;
  let out = coolCache.get(col);
  if (out !== undefined) return out;
  const r = parseInt(col.slice(1, 3), 16);
  const g = parseInt(col.slice(3, 5), 16);
  const b = parseInt(col.slice(5, 7), 16);
  if (b > r || b > g) {
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const rr = lum;
    const gg = Math.round(lum * 0.98);
    const bb = Math.round(lum * 0.94);
    out = `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
  } else {
    out = col;
  }
  if (coolCache.size > 512) coolCache.clear();
  coolCache.set(col, out);
  return out;
}
// Escena
export class GlyphStage {
  constructor(host, opts = {}) {
    this.host = host;
    this.text = "";
    this.lines = [];
    this.stream = "";
    this.burn = 0;
    this.scatter = 0;
    this.tvStatic = 0;
    this.tvTime = 0;
    this.isTv = false;
    this.nowMs = 0;
    this.extent = null;
    this.gd = null;
    this.heat = null;
    this.occ = null;
    this.colTop = null;
    this.colBot = null;
    this.cellW = CELL_W;
    this.cellH = CELL_H;
    this.cols = 80;
    this.rows = 24;
    this.cellAspect = CELL_H / CELL_W;
    this.cellEffect = opts.cellEffect || null;
    this.stageEffect = opts.stageEffect || null;
    this.lightRig = LIGHT_RIGS.default;
    this.doubleSided = opts.doubleSided !== false;
    this.rawPolygons = null;
    this._litSlots = [];
    this._fitting = false;
    this.animState = { progress: 0, time: 0, scrollIntensity: 0 };
    this.camera = createGlyphOrthographicCamera({ rotX: 62, rotY: -20, zoom: 120 });
    this.handle = createGlyphScene(host, {
      camera: this.camera,
      cols: this.cols,
      rows: this.rows,
      cellAspect: this.cellAspect,
      mode: "solid",
      glyphPalette: "default",
      useColors: true,
      colorTolerance: 16,
      retainShade: true,
      depthEpsilon: 0.02,
      supersample: 1,
      smoothShading: false,
      doubleSided: this.doubleSided,
      directionalLight: { direction: [0, 0, 1], intensity: 0 },
      ambientLight: { intensity: 1.0 },
      transformCells: (grid) => {
        this.sculpt(grid);
        if (!this._fitting && this.cellEffect) {
          const cols = grid.cols ?? 0;
          const rows = grid.rows ?? 0;
          this.cellEffect(grid, this.animState, {
            camera: this.camera,
            scene: { host: this.host },
            cellAspect: this.cellAspect,
            lines: this.lines,
            metrics: {
              cellWidth: this.cellW,
              cellHeight: this.cellH,
              centerCol: cols * (this.camera.center?.[0] ?? 0.5),
              centerRow: rows * (this.camera.center?.[1] ?? 0.5),
              zoom: this.camera.zoom,
            },
          });
        }
        if (!this._fitting) {
          this.lastChar = grid.char;
          this.lastCols = grid.cols ?? 0;
          this.lastRows = grid.rows ?? 0;
        }
      },
    });
  }
  get output() { return this.handle.output; }
  setText(text) {
    this.lines = preparePoemLines(text);
    this.text = text;
    this.stream = this.lines.join("");
  }
  setLightRig(id) {
    this.lightRig = LIGHT_RIGS[id] || LIGHT_RIGS.default;
  }
  setTvMode(value) {
    this.isTv = Boolean(value);
  }
  setBurn(value) {
    const b = value > 0 ? (value < 1 ? value : 1) : 0;
    if (b === 0 && this.heat) this.heat.fill(0);
    this.burn = b;
  }
  setScatter(value) {
    this.scatter = Math.max(0, Math.min(1, value || 0));
  }
  setTime(now) {
    this.nowMs = now || 0;
  }
  setTvStatic(amp, now = 0) {
    this.tvStatic = Math.max(0, Math.min(1, amp || 0));
    this.tvTime = now || 0;
  }
  setDirectionalLight(_direction, _intensity = 1.15) {
  }
  setAmbientLight(_intensity) {
  }
  setDoubleSided(value) {
    this.doubleSided = Boolean(value);
    this.handle.setOptions({ doubleSided: this.doubleSided });
  }
  setEffects(cellEffect = null, stageEffect = null) {
    this.cellEffect = cellEffect;
    this.stageEffect = stageEffect;
    if (!stageEffect && this.output) {
      this.output.classList.remove("glyph-output--floating");
      this.output.style.removeProperty("--float-y");
      this.output.style.removeProperty("--float-scale");
      this.output.style.removeProperty("--float-opacity");
    }
  }
  setAnimState(state = {}) {
    const s = this.animState;
    if (Number.isFinite(state.progress)) s.progress = state.progress;
    if (Number.isFinite(state.time)) s.time = state.time;
    if (Number.isFinite(state.scrollIntensity)) s.scrollIntensity = state.scrollIntensity;
  }
  // Esculpido
  sculpt(grid) {
    const { cols, rows } = grid;
    this.gd = { cols, rows };
    if (this.rawPolygons && this.rawPolygons.length === 0) {
      this.extent = null;
      return;
    }

    const gChar = grid.char;
    const gDepth = grid.depth;
    let minC = Infinity, maxC = -1, minR = Infinity, maxR = -1;

    if (this._fitting) {
      for (let r = 0; r < rows; r++) {
        const off = r * cols;
        for (let c = 0; c < cols; c++) {
          const i = off + c;
          if (gChar[i] === " " || gDepth[i] === -Infinity) continue;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
        }
      }
      this.extent = maxC < 0 ? null : { minC, maxC, minR, maxR };
      return;
    }

    if (!this.colTop || this.colTop.length !== cols) {
      this.colTop = new Int16Array(cols);
      this.colBot = new Int16Array(cols);
    }
    this.colTop.fill(32767);
    this.colBot.fill(-1);
    const total = cols * rows;
    if (!this.occ || this.occ.length !== total) this.occ = new Uint8Array(total);
    const occ = this.occ;
    occ.fill(0);

    let minD = Infinity;
    let maxD = -Infinity;
    for (let r = 0; r < rows; r++) {
      const off = r * cols;
      for (let c = 0; c < cols; c++) {
        const i = off + c;
        if (gChar[i] === " " || gDepth[i] === -Infinity) continue;
        occ[i] = 1;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (r < this.colTop[c]) this.colTop[c] = r;
        if (r > this.colBot[c]) this.colBot[c] = r;
        const d = gDepth[i];
        if (Number.isFinite(d)) {
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        }
      }
    }
    if (maxC < 0) {
      this.extent = null;
      return;
    }
    const e = { minC, maxC, minR, maxR };
    this.extent = e;

    const gColor = grid.color;
    const isTv = this.isTv;
    const tvStat = this.tvStatic;
    const tick = isTv ? Math.floor(this.tvTime / 75) : 0;
    const barRow = isTv ? minR + (((this.tvTime * 0.0005) % 1) * (maxR - minR + 1)) : 0;
    const bandLut = isTv ? tvBand() : null;
    const grayLut = isTv ? tvGray() : null;
    const midR = (minR + maxR) * 0.5;
    const band = isTv ? Math.max(0.8, (tvStat / 0.16) * (maxR - minR) * 0.42) : 0;
    const tvScale = Math.min(1, (tvStat - 0.1) / 0.5);
    const poemLookup = getPoemRowLookup(this.lines, rows);

    for (let r = minR; r <= maxR; r++) {
      const off = r * cols;
      const pLine = poemLookup ? poemLookup.rowStrs[r] : "";
      const pLen = poemLookup ? poemLookup.rowLens[r] : 0;
      const pOff = poemLookup ? poemLookup.rowOffs[r] : 0;
      const dR = isTv ? Math.abs(r - midR) : 0;
      const barDist = isTv ? Math.abs(r - barRow) : 0;
      const hum = isTv && barDist < 2.8 ? (1 - barDist / 2.8) * 0.45 : 0;
      for (let c = minC; c <= maxC; c++) {
        const i = off + c;
        if (!occ[i]) continue;
        const col = gColor ? gColor[i] : "";
        if (isTv && isTvScreenCell(col)) {
          occ[i] = 2;
          if (tvStat <= 0.02) {
            gChar[i] = (r + c) % 6 === 0 ? "·" : ".";
            if (gColor) gColor[i] = "#46433e";
          } else if (tvStat < 0.16) {
            if (dR <= band) {
              const h = (hash(r + tick * 17, c + tick * 31) % 1000) / 1000;
              const v = Math.min(1, (1 - dR / band) * 0.9 + h * 0.35);
              gChar[i] = NOISE[Math.min(NOISE.length - 1, Math.floor(v * NOISE.length))];
              if (gColor) gColor[i] = bandLut[Math.min(255, (v * 255) | 0)];
            } else {
              gChar[i] = ".";
              if (gColor) gColor[i] = "#46433e";
            }
          } else {
            const h = (hash(r + tick * 17, c + tick * 31) % 1000) / 1000;
            const v = Math.min(1, (Math.pow(h, 1.3) * 0.86 + hum) * tvScale);
            const gIdx = Math.min(NOISE.length - 1, Math.floor(v * NOISE.length));
            gChar[i] = NOISE[gIdx];
            if (gColor) gColor[i] = grayLut[Math.min(255, (v * 255) | 0)];
          }
          continue;
        }
        if (gColor && col) gColor[i] = neutralizeCoolColor(col);
        if (pLen > 0) gChar[i] = pLine[(c + pOff) % pLen];
      }
    }
    applyDepthCreviceAO(grid, occ, e, null, { minD, maxD });
    if (this.scatter > 0.005) {
      this.disperseCells(grid);
    }
    if (this.burn > 0) {
      this.burnCells(grid);
      if (this.burn > 0.5) this.windAsh(grid);
    }
  }
  disperseCells(grid) {
    const s = this.scatter;
    const e = this.extent;
    const { cols, rows } = grid;
    const midC = (e.minC + e.maxC) * 0.5;
    const halfW = Math.max(1, (e.maxC - e.minC) * 0.5);
    const spanR = Math.max(1, e.maxR - e.minR);
    const tempChar = new Array(grid.char.length);
    const tempColor = grid.color ? new Array(grid.color.length) : null;
    const maxSpan = Math.max(cols, rows) * 1.18;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!this.occ[i]) continue;
        const ch = grid.char[i];
        if (ch === " ") continue;
        const h1 = (hash(r, c) % 1000) / 1000;
        const h2 = (hash(c + 19, r + 47) % 1000) / 1000;
        const relY = (r - e.minR) / spanR;
        const relEdge = Math.min(1, Math.abs(c - midC) / halfW);
        const releaseAt = relY * 0.45 + (1 - relEdge) * 0.3 + h1 * 0.27;
        if (s <= releaseAt) {
          tempChar[i] = ch;
          if (tempColor && grid.color) tempColor[i] = grid.color[i];
          grid.char[i] = " ";
          continue;
        }
        const flight = Math.min(1, (s - releaseAt) / Math.max(0.18, 0.92 - releaseAt));
        const dirX = (c >= midC ? 1 : -1) * (0.15 + relEdge * 0.4) + (h1 - 0.5) * 0.5;
        const dirY = -0.9 - (1 - relY) * 0.3 + (h2 - 0.5) * 0.4;
        const dist = Math.pow(flight, 1.3) * maxSpan * (0.3 + 0.4 * h2);
        const swirl = Math.sin(flight * 6.0 + h1 * 6.28) * 1.5 * flight;
        const nr = Math.round(r + dirY * dist + swirl);
        const nc = Math.round(c + dirX * dist * 1.35 - swirl);
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const targetIdx = nr * cols + nc;
          tempChar[targetIdx] = ch;
          if (tempColor && grid.color) tempColor[targetIdx] = grid.color[i];
        }
        grid.char[i] = " ";
      }
    }
    for (let i = 0; i < grid.char.length; i++) {
      if (tempChar[i]) {
        grid.char[i] = tempChar[i];
        if (grid.color && tempColor) grid.color[i] = tempColor[i];
      }
    }
  }
// Fuego
  fireStep() {
    const e = this.extent;
    const g = this.gd;
    if (!e || !g || this.burn <= 0 || !this.colTop) return;
    const { cols, rows } = g;
    if (!this.heat || this.heat.length !== cols * rows) this.heat = new Uint8Array(cols * rows);
    const h = this.heat;
    const midC = (e.minC + e.maxC) * 0.5;
    const halfW = Math.max(1, (e.maxC - e.minC) * 0.5);
    for (let c = e.minC; c <= e.maxC; c++) {
      const topR = this.colTop[c];
      const botR = this.colBot[c];
      if (botR < topR) continue;
      const relX = Math.min(1, Math.abs(c - midC) / halfW);
      const colBurn = Math.max(0, Math.min(1, this.burn * 1.35 - (1 - relX) * 0.36));
      if (colBurn <= 0.01) continue;
      const colH = Math.max(1, botR - topR);
      const frontR = Math.min(botR, topR + Math.round(colBurn * colH));
      for (let dr = -1; dr <= 1; dr++) {
        const sr = Math.min(rows - 1, Math.max(0, frontR + dr));
        if (this.occ && this.occ[sr * cols + c]) {
          h[sr * cols + c] = Math.round(FIRE_MAX * Math.min(1, 0.55 + colBurn * 0.65));
        }
      }
    }
    for (let r = Math.min(rows - 1, e.maxR + 2); r >= Math.max(1, e.minR - 4); r--) {
      for (let c = e.minC; c <= e.maxC; c++) {
        const src = h[r * cols + c];
        if (!src) continue;
        const rnd = (Math.random() * 3) | 0;
        const dc = Math.min(e.maxC, Math.max(e.minC, c - rnd + 1));
        const inBook = this.occ && this.occ[(r - 1) * cols + dc];
        const cool = inBook ? ((2 + Math.random() * 5) | 0) : ((7 + Math.random() * 9) | 0);
        h[(r - 1) * cols + dc] = Math.max(0, src - cool);
      }
    }
  }
  burnCells(grid) {
    if (this.burn <= 0 || !this.extent || !this.colTop) return;
    const e = this.extent;
    const { cols, rows } = grid;
    if (!this.heat || this.heat.length !== cols * rows) this.heat = new Uint8Array(cols * rows);
    const h = this.heat;
    const midC = (e.minC + e.maxC) * 0.5;
    const halfW = Math.max(1, (e.maxC - e.minC) * 0.5);
    for (let c = e.minC; c <= e.maxC; c++) {
      const topR = this.colTop[c];
      const botR = this.colBot[c];
      if (botR < topR) continue;
      const relX = Math.min(1, Math.abs(c - midC) / halfW);
      const colBurn = Math.max(0, Math.min(1, this.burn * 1.35 - (1 - relX) * 0.36));
      if (colBurn <= 0.01) continue;
      const colH = Math.max(1, botR - topR);
      const frontR = Math.min(botR, topR + Math.round(colBurn * colH));
      const minTongueR = Math.max(0, topR - Math.min(6, Math.ceil(colBurn * 6)));
      const smokeTop = Math.max(0, minTongueR - 10);
      const drift = Math.floor(this.nowMs * 0.004 + ((hash(c, 7) % 1000) / 1000) * 6) % 12;
      const sway = Math.round(Math.sin(this.nowMs * 0.002 + c * 0.7) * 2);
      for (let r = smokeTop; r < minTongueR; r++) {
        const si = r * cols + c;
        if (this.occ[si] || grid.char[si] !== ' ') continue;
        const sv = h[si];
        if (sv < 1.5) continue;
        const sq = Math.min(SMOKE.length - 1, ((Math.min(1, sv / 20)) * SMOKE.length) | 0);
        const nr = r - drift;
        const nc = c + sway;
        if (nr < smokeTop || nr >= rows || nc < 0 || nc >= cols) continue;
        const j = nr * cols + nc;
        if (grid.char[j] !== ' ' || this.occ[j]) continue;
        grid.char[j] = SMOKE[sq];
        if (grid.color) grid.color[j] = '#57534d';
      }
      for (let r = minTongueR; r <= frontR; r++) {
        const i = r * cols + c;
        const gc = grid.color[i]; if (gc === '#c0392b' || gc === '#a93226') continue;
        const hv = h[i];
        const occupied = this.occ[i] === 1;
        const distToFront = frontR - r;
        if (!occupied && r < topR) {
          if (hv > 10 && distToFront <= 4) {
            grid.char[i] = FIRE[Math.min(FIRE.length - 1, Math.floor((hv / (FIRE_MAX + 1)) * FIRE.length))];
            if (grid.color) grid.color[i] = fireColors()[hv];
          }
          continue;
        }
        if (!occupied) continue;
        if (distToFront <= 2 && hv > 2) {
          const fIdx = Math.min(FIRE.length - 1, Math.max(2, Math.floor((hv / (FIRE_MAX + 1)) * FIRE.length)));
          grid.char[i] = FIRE[fIdx];
          if (grid.color) grid.color[i] = "#3f3b34";
        } else if (distToFront <= 9 && hv > 4) {
          grid.char[i] = FIRE[Math.min(6, Math.floor((hv / FIRE_MAX) * 7))];
          if (grid.color) grid.color[i] = "#d99b26";
        } else {
          grid.char[i] = ASH[hash(r, c) % ASH.length];
          if (grid.color) grid.color[i] = "#9e9484";
        }
      }
    }
  }
  windAsh(grid) {
    const e = this.extent;
    if (!e || !this.colTop) return;
    const { cols, rows } = grid;
    const n = cols * rows;
    if (!this._wIdx || this._wIdx.length < n) {
      this._wIdx = new Int32Array(n);
      this._wCh = new Array(n);
      this._wCo = new Array(n);
    }
    const w = Math.min(1, (this.burn - 0.5) / 0.5);
    const h = this.heat;
    const occ = this.occ;
    const idx = this._wIdx;
    const chs = this._wCh;
    const cos = this._wCo;
    let cnt = 0;
    for (let c = e.minC; c <= e.maxC; c++) {
      const topR = this.colTop[c];
      const botR = this.colBot[c];
      if (botR < topR) continue;
      const midC = (e.minC + e.maxC) * 0.5;
      const halfW = Math.max(1, (e.maxC - e.minC) * 0.5);
      const relX = Math.min(1, Math.abs(c - midC) / halfW);
      const colBurn = Math.max(0, Math.min(1, this.burn * 1.35 - (1 - relX) * 0.36));
      if (colBurn <= 0.01) continue;
      const colH = Math.max(1, botR - topR);
      const frontR = Math.min(botR, topR + Math.round(colBurn * colH));
      for (let r = Math.max(0, topR - 3); r <= frontR - 6; r++) {
        const i = r * cols + c;
        if (!occ[i] || h[i] >= 3) continue;
        if (grid.color[i] === '#d99b26' || grid.char[i] === ' ') continue;
        const h1 = (hash(r, c) % 1000) / 1000;
        const h3 = (hash(r + 31, c + 3) % 1000) / 1000;
        idx[cnt] = i;
        chs[cnt] = h3 < w * 0.75 ? null : grid.char[i];
        cos[cnt] = grid.color[i];
        cnt++;
        grid.char[i] = ' ';
      }
    }
    for (let k = 0; k < cnt; k++) {
      const ch = chs[k];
      if (ch == null) continue;
      const i = idx[k];
      const r = (i / cols) | 0;
      const c = i % cols;
      const h1 = (hash(r, c) % 1000) / 1000;
      const h2 = (hash(c + 7, r + 13) % 1000) / 1000;
      const nr = r - Math.round(w * (1 + 5 * h2));
      const nc = c + Math.round(w * (4 + 9 * h1));
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const j = nr * cols + nc;
      if (grid.char[j] !== ' ') continue;
      grid.char[j] = ch;
      if (grid.color) grid.color[j] = cos[k];
    }
  }
  setPolygons(polygons, render = true) {
    this.rawPolygons = polygons;
    const lit = this._fitting
      ? polygons
      : shadePolygons(polygons, this.camera, this.lightRig, this.doubleSided, this._litSlots);
    if (!this.mesh) {
      this.mesh = this.handle.add(lit);
    } else {
      this.mesh.setPolygons(lit);
    }
    if (render) this.handle.rerender();
    if (render && !this._fitting && this.stageEffect) this.stageEffect(this.output, this.animState);
  }
  relightAndRender() {
    if (!this.rawPolygons || !this.mesh) {
      this.handle.rerender();
      return;
    }
    const lit = shadePolygons(this.rawPolygons, this.camera, this.lightRig, this.doubleSided, this._litSlots);
    this.mesh.setPolygons(lit);
    this.handle.rerender();
    if (this.stageEffect) this.stageEffect(this.output, this.animState);
  }
  fit(targetW = 0.86, targetH = 0.8) {
    const base = this.handle.getBaseResolution();
    this.handle.rerender();
    const e = this.extent;
    if (!e) return;
    const w = e.maxC - e.minC + 1;
    const h = e.maxR - e.minR + 1;
    if (!w || !h) return;
    const ratio = Math.min((targetW * base.cols) / w, (targetH * base.rows) / h);
    if (Math.abs(ratio - 1) < 0.03) return;
    this.camera.zoom *= ratio;
    this.handle.rerender();
  }
  fitCache = new Map();
// Encuadre multi-estado
  fitMultiState(key, statesPolys, targetW = 0.86, targetH = 0.8) {
    const base = this.handle.getBaseResolution();
    let minC = Infinity, maxC = -1, minR = Infinity, maxR = -1;
    const savedCenter = this.camera.center;
    const probeZoom = 28;
    this.camera.center = [0.5, 0.5];
    this.camera.zoom = probeZoom;
    this._fitting = true;
    try {
      for (const polys of statesPolys) {
        this.setPolygons(polys, true);
        const e = this.extent;
        if (!e) continue;
        if (e.minC < minC) minC = e.minC;
        if (e.maxC > maxC) maxC = e.maxC;
        if (e.minR < minR) minR = e.minR;
        if (e.maxR > maxR) maxR = e.maxR;
      }
    } finally {
      this._fitting = false;
      this.camera.center = savedCenter;
    }
    if (maxC >= minC && maxR >= minR) {
      const w = maxC - minC + 1;
      const h = maxR - minR + 1;
      const ratio = Math.min((targetW * base.cols) / w, (targetH * base.rows) / h);
      this.camera.zoom = probeZoom * ratio;
    }
    this.fitCache.set(key, this.camera.zoom);
    return this.camera.zoom;
  }
  hitTestClient(clientX, clientY) {
    const pre = this.output;
    if (!pre || !this.lastChar || !this.lastCols || !this.lastRows) return false;
    const rect = pre.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
    const c = Math.floor(((clientX - rect.left) / rect.width) * this.lastCols);
    const r = Math.floor(((clientY - rect.top) / rect.height) * this.lastRows);
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr;
      if (rr < 0 || rr >= this.lastRows) continue;
      const off = rr * this.lastCols;
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc;
        if (cc < 0 || cc >= this.lastCols) continue;
        const ch = this.lastChar[off + cc];
        if (ch && ch !== " ") return true;
      }
    }
    return false;
  }
  resize(width, height) {
    this.cols = Math.max(20, Math.floor(width / this.cellW));
    this.rows = Math.max(10, Math.floor(height / this.cellH));
    this.handle.setOptions({ cols: this.cols, rows: this.rows, cellAspect: this.cellAspect });
    const base = this.handle.getBaseResolution();
    const pre = this.output;
    if (pre) {
      pre.style.width = base.cols * this.cellW + "px";
      pre.style.height = base.rows * this.cellH + "px";
    }
  }
  setCellMetrics(cellW, cellH) {
    this.cellW = cellW;
    this.cellH = cellH;
    this.cellAspect = cellH / cellW;
  }
}
