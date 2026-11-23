




// Glifos del fondo
const GLYPHS_HEAVY = ['@', '#', 'B', 'W', 'M', 'Q', '8', '&', '%', 'X', 'O', 'Z'];
const GLYPHS_MID   = ['w', 'q', 'd', 'b', 'k', 'h', 'm', 'p', 'u', 'x', 'z', 'c', 'o', 'a'];
const GLYPHS_LIGHT = ['1', 'l', 'i', '|', '/', '\\', '{', '}', '[', ']', '?', '!', '+', '*', '-', '='];

const ALL_CHARS = [
  ' ', '.', '·', ':', '-', '=', '+', '*', '?', '!',
  ...GLYPHS_LIGHT,
  ...GLYPHS_MID,
  ...GLYPHS_HEAVY
];

const ALPHAS = [0.035, 0.07, 0.12, 0.18];
const TW = 28;
const TH = 20;

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const sm = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};


// Retrato por celdas
function personBust(u, v, seed) {
  const headW = 0.32 + 0.04 * hash(seed, 1);
  const headH = 0.40 + 0.04 * hash(seed, 2);
  const headY = -0.42 + 0.03 * (hash(seed, 3) - 0.5);

  const hx = u / headW;
  const hy = (v - headY) / headH;
  const d2 = hx * hx + hy * hy;

  let lum = 0;

  
  const inHair = (v < headY + 0.1) && ((hx * hx) / 1.15 + Math.pow((hy + 0.08) / 1.1, 2) < 1.08);
  if (inHair) {
    lum = Math.max(lum, 0.70 + 0.22 * Math.sin(u * 16 + seed));
  }

  
  if (d2 < 1.0) {
    const nz = Math.sqrt(Math.max(0.08, 1 - 0.7 * hx * hx - 0.65 * hy * hy));
    let fLum = 0.44 + 0.48 * nz;

    
    const eyeSpacing = 0.38 + 0.05 * hash(seed, 5);
    const ex = Math.abs(hx) - eyeSpacing;
    const ey = hy + 0.02;
    const eyeSocket = Math.exp(-(ex * ex) / 0.03 - (ey * ey) / 0.02);
    fLum -= 0.38 * eyeSocket;

    
    const browArch = 0.04 * hash(seed, 6);
    const browY = hy + 0.14 + browArch * Math.cos(ex * 4.0);
    if (Math.abs(ex) < 0.25 && Math.abs(browY) < 0.04) fLum *= 0.35;

    
    if (hy > -0.06 && hy < 0.26 && Math.abs(hx) < 0.16) {
      fLum += 0.22 * Math.exp(-(hx * hx) / 0.008) * sm(-0.06, 0.22, hy);
      if (hy > 0.18) fLum -= 0.28 * sm(0.18, 0.26, hy);
    }

    
    const my = hy - 0.48;
    if (Math.abs(hx) < 0.26 && Math.abs(my) < 0.08) {
      if (Math.abs(my) < 0.024) fLum *= 0.32;
      else if (my > 0) fLum += 0.10 * (1 - Math.abs(hx) / 0.26);
    }

    const edge = 1 - sm(0.88, 1.0, d2);
    lum = Math.max(lum, clamp(fLum, 0.18, 0.95) * edge);
  }

  
  const neckW = 0.20 + 0.03 * hash(seed, 7);
  const neckTop = headY + headH * 0.78;
  const neckBot = neckTop + 0.16;
  if (v >= neckTop && v <= neckBot && Math.abs(u) < neckW) {
    const nShade = 0.52 * (1 - 0.4 * Math.pow(u / neckW, 2));
    lum = Math.max(lum, nShade);
  }

  
  const shoulderW = 0.88 + 0.10 * hash(seed, 8);
  const shY = neckBot - 0.02 + 0.28 * Math.pow(Math.min(1, Math.abs(u) / shoulderW), 1.3);
  if (v >= shY && Math.abs(u) <= shoulderW) {
    const shL = sm(0, 0.08, v - shY) * (1 - sm(shoulderW * 0.8, shoulderW, Math.abs(u))) * 0.58;
    lum = Math.max(lum, shL);
  }

  return lum;
}

// Fondo vivo
export function createBackground(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let cw = 8, ch = 14, dpr = 1, cols = 0, rows = 0, cwp = 8, chp = 14;
  let tilesX = 0, tilesY = 0, numTiles = 0;
  let tileOrder = null, tileRev = null;
  let mask = null;
  let atlas = null;
  const charMap = new Map();
  let prog = 0;
  let lastDrawT = -1e9;
  let drawnProg = -1;
  let dotsLayer = null;
  let breathOf = null;
  let tileMaxMask = null;
  let tileCellStart = null;
  let tileLastQuant = null;
  let tileDirty = null;
  let figCount = 0;
  let figCellR = null;
  let figCellC = null;
  let figCellMask = null;
  let figCellTile = null;
  let figCellHeavy = null;
  let figCellMid = null;
  let figCellLight = null;
  let glitchBuckets = null;
  let lastGlitchMod = -1;
  let heavyCharIdxs = null;

  function buildAtlas() {
    atlas = document.createElement('canvas');
    atlas.width = ALL_CHARS.length * cwp;
    atlas.height = ALPHAS.length * chp;
    const actx = atlas.getContext('2d');
    actx.font = `${chp}px 'Sligoil Micro',ui-monospace,monospace`;
    actx.textAlign = 'center';
    actx.textBaseline = 'middle';

    ALL_CHARS.forEach((ch, cIdx) => {
      charMap.set(ch, cIdx);
      ALPHAS.forEach((alpha, aIdx) => {
        const y = aIdx * chp;
        actx.fillStyle = `rgba(200, 192, 175, ${alpha})`;
        actx.fillText(ch, (cIdx + 0.5) * cwp, y + chp * 0.5);
      });
    });
    heavyCharIdxs = Uint8Array.from(GLYPHS_HEAVY, (ch) => charMap.get(ch) || 0);
  }

  function getGlitchBucket(gMod) {
    let bucket = glitchBuckets[gMod];
    if (bucket) return bucket;
    const idxs = [];
    const gChars = [];
    for (let k = 0; k < figCount; k++) {
      const rSeed = hash(figCellC[k], figCellR[k], gMod);
      if (rSeed > 0.985) {
        idxs.push(k);
        gChars.push(heavyCharIdxs[Math.floor(rSeed * heavyCharIdxs.length)]);
      }
    }
    bucket = { idx: new Int32Array(idxs), gChar: new Uint8Array(gChars) };
    glitchBuckets[gMod] = bucket;
    return bucket;
  }

  function resize(w, h, cellW = 8, cellH = 14) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = cellW;
    ch = cellH;
    cwp = Math.round(cw * dpr);
    chp = Math.round(ch * dpr);
    cols = Math.ceil(w / cw);
    rows = Math.ceil(h / ch);
    canvas.width = cols * cwp;
    canvas.height = rows * chp;

    tilesX = Math.ceil(cols / TW);
    tilesY = Math.ceil(rows / TH);
    numTiles = tilesX * tilesY;

    tileOrder = new Float32Array(numTiles);
    tileRev = new Float32Array(numTiles);
    breathOf = new Float32Array(numTiles);
    tileMaxMask = new Float32Array(numTiles);
    tileCellStart = new Int32Array(numTiles + 1);
    tileLastQuant = new Int32Array(numTiles);
    tileDirty = new Uint8Array(numTiles);
    glitchBuckets = new Array(97).fill(null);
    lastGlitchMod = -1;
    lastDrawT = -1e9;
    drawnProg = -1;

    for (let t = 0; t < numTiles; t++) {
      tileOrder[t] = hash(t, 77);
    }

    const total = cols * rows;
    mask = new Float32Array(total);
    const tileCounts = new Int32Array(numTiles);

    for (let r = 0; r < rows; r++) {
      const ty = Math.floor(r / TH);
      const v = ((r % TH) / (TH - 1)) * 2 - 1;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const tx = Math.floor(c / TW);
        const t = ty * tilesX + tx;
        const u = ((c % TW) / (TW - 1)) * 2 - 1;
        const seed = (tx * 73856093) ^ (ty * 19349663);
        const m = personBust(u, v, seed);
        mask[i] = m;
        if (m >= 0.09) {
          tileCounts[t]++;
          if (m > tileMaxMask[t]) tileMaxMask[t] = m;
        }
      }
    }

    buildAtlas();
    setProgress(prog);

    dotsLayer = document.createElement('canvas');
    dotsLayer.width = canvas.width;
    dotsLayer.height = canvas.height;
    const dctx = dotsLayer.getContext('2d', { alpha: false });
    dctx.fillStyle = '#050608';
    dctx.fillRect(0, 0, canvas.width, canvas.height);
    const dotIdx = charMap.get('.') || 1;
    let totalFigs = 0;
    for (let t = 0; t < numTiles; t++) {
      tileCellStart[t] = totalFigs;
      totalFigs += tileCounts[t];
    }
    tileCellStart[numTiles] = totalFigs;
    figCount = totalFigs;

    figCellR = new Int16Array(totalFigs);
    figCellC = new Int16Array(totalFigs);
    figCellMask = new Float32Array(totalFigs);
    figCellTile = new Int32Array(totalFigs);
    figCellHeavy = new Uint8Array(totalFigs);
    figCellMid = new Uint8Array(totalFigs);
    figCellLight = new Uint8Array(totalFigs);

    const tileCursor = tileCellStart.slice(0, numTiles);
    const midIdxs = Uint8Array.from(GLYPHS_MID, (ch) => charMap.get(ch) || dotIdx);
    const lightIdxs = Uint8Array.from(GLYPHS_LIGHT, (ch) => charMap.get(ch) || dotIdx);

    for (let r = 0; r < rows; r++) {
      const ty = Math.floor(r / TH);
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const m = mask[i];
        if (m < 0.09) {
          if (r % 2 === 0 && c % 3 === 0) {
            dctx.drawImage(atlas, dotIdx * cwp, 0, cwp, chp, c * cwp, r * chp, cwp, chp);
          }
        } else {
          const tx = Math.floor(c / TW);
          const t = ty * tilesX + tx;
          const pos = tileCursor[t]++;
          figCellR[pos] = r;
          figCellC[pos] = c;
          figCellMask[pos] = m;
          figCellTile[pos] = t;
          figCellHeavy[pos] = heavyCharIdxs[Math.floor(hash(c, r, 1) * heavyCharIdxs.length)];
          figCellMid[pos] = midIdxs[Math.floor(hash(c, r, 2) * midIdxs.length)];
          figCellLight[pos] = lightIdxs[Math.floor(hash(c, r, 3) * lightIdxs.length)];
        }
      }
    }
    ctx.drawImage(dotsLayer, 0, 0);
  }

  function setProgress(p) {
    prog = clamp(p, 0, 1);
    for (let t = 0; t < numTiles; t++) {
      const start = tileOrder[t] * 0.75;
      tileRev[t] = sm(start, start + 0.22, prog);
    }
  }

  function draw(now = 0) {
    if (!atlas || !mask) return;
    if (now - lastDrawT < 120 && Math.abs(prog - drawnProg) < 0.002) return;
    lastDrawT = now;
    drawnProg = prog;

    for (let t = 0; t < numTiles; t++) {
      breathOf[t] = 1 + 0.07 * Math.sin(now * 0.0016 + tileOrder[t] * 6.28);
    }

    tileDirty.fill(0);
    for (let ty = 0; ty < tilesY; ty++) {
      const rBase = ty * TH;
      const tileH = Math.min(TH, rows - rBase);
      for (let tx = 0; tx < tilesX; tx++) {
        const t = ty * tilesX + tx;
        const eff = tileRev[t] * breathOf[t];
        const visible = tileMaxMask[t] * eff >= 0.08;
        const quant = visible ? Math.max(1, Math.round(eff * 32)) : 0;
        if (tileLastQuant[t] === quant) continue;

        tileLastQuant[t] = quant;
        tileDirty[t] = 1;
        const cBase = tx * TW;
        const tileW = Math.min(TW, cols - cBase);
        const rx = cBase * cwp;
        const ry = rBase * chp;
        const rw = tileW * cwp;
        const rh = tileH * chp;
        ctx.drawImage(dotsLayer, rx, ry, rw, rh, rx, ry, rw, rh);

        if (quant > 0) {
          const endK = tileCellStart[t + 1];
          for (let k = tileCellStart[t]; k < endK; k++) {
            const prod = figCellMask[k] * eff;
            const intensity = prod > 1 ? 1 : prod;
            if (intensity < 0.08) continue;
            const cIdx = intensity > 0.62 ? figCellHeavy[k] : intensity > 0.36 ? figCellMid[k] : figCellLight[k];
            const al = Math.min(3, (intensity * 4.2) | 0);
            ctx.drawImage(
              atlas,
              cIdx * cwp,
              al * chp,
              cwp,
              chp,
              figCellC[k] * cwp,
              figCellR[k] * chp,
              cwp,
              chp,
            );
          }
        }
      }
    }

    const gMod = ((Math.floor(now * 0.008) % 97) + 97) % 97;
    ctx.fillStyle = '#050608';

    if (lastGlitchMod >= 0 && lastGlitchMod !== gMod) {
      const prevBucket = getGlitchBucket(lastGlitchMod);
      const pIdx = prevBucket.idx;
      for (let m = 0; m < pIdx.length; m++) {
        const k = pIdx[m];
        const t = figCellTile[k];
        if (tileDirty[t]) continue;
        const eff = tileRev[t] * breathOf[t];
        const prod = figCellMask[k] * eff;
        const intensity = prod > 1 ? 1 : prod;
        const px = figCellC[k] * cwp;
        const py = figCellR[k] * chp;
        ctx.fillRect(px, py, cwp, chp);
        if (intensity >= 0.08) {
          const cIdx = intensity > 0.62 ? figCellHeavy[k] : intensity > 0.36 ? figCellMid[k] : figCellLight[k];
          const al = Math.min(3, (intensity * 4.2) | 0);
          ctx.drawImage(atlas, cIdx * cwp, al * chp, cwp, chp, px, py, cwp, chp);
        }
      }
    }

    const bucket = getGlitchBucket(gMod);
    const bIdx = bucket.idx;
    const bChar = bucket.gChar;
    const tickChanged = lastGlitchMod !== gMod;
    for (let m = 0; m < bIdx.length; m++) {
      const k = bIdx[m];
      const t = figCellTile[k];
      if (!tickChanged && !tileDirty[t]) continue;
      const eff = tileRev[t] * breathOf[t];
      const prod = figCellMask[k] * eff;
      const intensity = prod > 1 ? 1 : prod;
      if (intensity < 0.08) continue;
      const al = Math.min(3, (intensity * 4.2) | 0);
      const px = figCellC[k] * cwp;
      const py = figCellR[k] * chp;
      ctx.fillRect(px, py, cwp, chp);
      ctx.drawImage(atlas, bChar[m] * cwp, al * chp, cwp, chp, px, py, cwp, chp);
    }
    lastGlitchMod = gMod;
  }

  return {
    resize,
    setProgress,
    draw,
    get progress() { return prog; }
  };
}
