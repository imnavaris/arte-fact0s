import { crearLibro } from './modelos/libro.js';
import { crearSilueta } from './modelos/silueta.js';
import { crearTijeras } from './modelos/tijeras.js';
import { crearTv } from './modelos/tv.js';
import { crearPajaros } from './modelos/pajaros.js';
import { crearVuelo } from './modelos/vuelo.js';
import { toGlyphPolygons, bounds, computeCenter } from './geometry.js';
import { levitationBob, applyPolygonLevitationInPlace, LEVITATION_REF_SPAN } from './modelos/compartido.js';
import { GlyphStage } from './glyph-stage.js';
import { SmoothScrollController, ScrollPacer } from './scroll.js';
import { createBackground } from './bg.js';
import { Typewriter } from './typewriter.js';
import { Dissolve, DissolveText } from './dissolve.js';

// Piezas
const PIECES = [
 { id: 'libro', create: crearLibro },
 { id: 'silueta', create: crearSilueta },
 { id: 'tijeras', create: crearTijeras },
 { id: 'tv', create: crearTv },
 { id: 'pajaros', create: crearPajaros },
 { id: 'vuelo', create: crearVuelo },
];

// Poses
const POSES = {
 libro: { rotX: 25, rotY: -35, zoom: 120 },
 silueta: { rotX: 90, rotY: 0, zoom: 120 },
 tijeras: { rotX: 56, rotY: -80, zoom: 120 },
 tv: { rotX: 90, rotY: -90, zoom: 120 },
 pajaros: { rotX: 86, rotY: 90, zoom: 120 },
 vuelo: { rotX: 80, rotY: 55, zoom: 120 },
};

// Render
const RENDER = {
  libro: { doubleSided: false },
  silueta: { doubleSided: false },
  tijeras: { doubleSided: true },
  tv: { doubleSided: true },
  pajaros: { doubleSided: true },
  vuelo: { doubleSided: true },
};

const PORTED = new Set(['libro', 'silueta', 'tijeras']);

// Escenario
const host = document.getElementById('stage');
const stage = new GlyphStage(host);
const bgEl = document.getElementById('bg');
const bg = createBackground(bgEl);
const srStatus = document.getElementById('sr-status');
const hudEl = document.getElementById('hud-progress');
const hudFill = hudEl ? hudEl.querySelector('.hud-fill') : null;
const hudNodesBox = hudEl ? hudEl.querySelector('.hud-nodes') : null;
const hudNodeBtns = [];

const errors = [];
addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => errors.push(`rejection: ${e.reason}`));

const q = new URLSearchParams(location.search);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
let reduceMotion = Boolean(reduceMotionQuery?.matches);

const debugPiece = q.get('piece');
const numParam = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const poseOverride = { rx: q.has('rx') ? numParam(q.get('rx')) : null, ry: q.has('ry') ? numParam(q.get('ry')) : null };
const debugP = q.has('p') ? numParam(q.get('p')) : null;
const debugBg = q.has('bgp') ? numParam(q.get('bgp')) : null;
const frozen = Boolean(debugPiece) || debugP !== null;


// Loader
const loaderMode = !(debugPiece || debugP !== null || debugBg !== null || q.has('probe'));
const loaderEl = document.getElementById('loader');
const enterBtn = document.getElementById('enter');
const fillEl = loaderEl ? loaderEl.querySelector('.loader-fill') : null;
document.documentElement.classList.toggle('locked', loaderMode);
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
function setLoad(frac) {
  if (fillEl) fillEl.style.width = `${Math.round(frac * 100)}%`;
}
let entered = !loaderMode;
const scrollPacer = new ScrollPacer(scrollY);
function enter() {
  if (entered) return;
  entered = true;
  if (loaderEl) loaderEl.classList.add('done');
  setTimeout(() => {
    document.documentElement.classList.remove('locked');
    scrollTo(0, 0);
    scrollPacer.reset(0);
    if (loaderEl) loaderEl.remove();
    document.body.classList.add('entered');
    requestAnimationFrame(frame);
  }, 320);
}
if (enterBtn) enterBtn.addEventListener('click', enter);

await document.fonts.ready;
setLoad(0.1);
await nextPaint();

let cellW = 8;
let cellH = 14;

// Medida de celda
function measureCellMetrics() {
 const probe = document.createElement('span');
 cellH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell-h')) || 14;
 probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:${cellH}px`;
 probe.style.fontFamily = "'Sligoil Micro',ui-monospace,'Cascadia Mono',Consolas,monospace";
 probe.textContent = 'MMMMMMMMMM';
 document.body.appendChild(probe);
 cellW = probe.getBoundingClientRect().width / 10 || 8;
 probe.remove();
 stage.setCellMetrics(cellW, cellH);
}

measureCellMetrics();
bg.resize(innerWidth, Math.ceil(innerHeight * 1.24), cellW, cellH);

const corpus = await fetch('assets/texts/texts.json').then((r) => r.json());
const quoteFor = (id) => corpus.texts.find((t) => t.piece === id);

setLoad(0.18);
await nextPaint();

function poseOf(id) {
 const pose = { ...POSES[id] };
 if (debugPiece === id) {
 if (Number.isFinite(poseOverride.rx)) pose.rotX = poseOverride.rx;
 if (Number.isFinite(poseOverride.ry)) pose.rotY = poseOverride.ry;
 }
 return pose;
}

const models = new Map();
const modelCenters = new Map();
const modelScales = new Map();
for (const piece of PIECES) models.set(piece.id, piece.create());

stage.resize(host.clientWidth, host.clientHeight);

function stageCenterFor(index, id) {
 if (innerWidth <= 1100) return [0.5, id === 'pajaros' ? 0.27 : 0.31];
 const modelRight = index % 2 === 0;
 if (id === 'tv') return [0.35, 0.56];
 if (id === 'pajaros') return [0.65, 0.44];
 return modelRight ? [0.65, 0.50] : [0.35, 0.50];
}

// Encuadre por pieza
function fitPiece(piece, index) {
 const model = models.get(piece.id);
 model.prewarm?.();
 const pose = poseOf(piece.id);
 stage.camera.rotX = pose.rotX;
 stage.camera.rotY = pose.rotY;
 stage.camera.zoom = pose.zoom;
 stage.camera.center = stageCenterFor(index, piece.id);
 stage.setLightRig(piece.id);
 const render = RENDER[piece.id];
 stage.setDoubleSided(render ? render.doubleSided : true);
 let refCenter = null;
 if (!model.buildFrame) {
 model.frame?.(0);
 model.update(0);
 const rawRef = toGlyphPolygons(model.root, { center: false });
 refCenter = computeCenter(rawRef);
 modelCenters.set(piece.id, refCenter);
 const b = bounds(rawRef);
 const span = Math.max(1e-3, b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ);
 modelScales.set(piece.id, span / LEVITATION_REF_SPAN);
 }
 const sampleStates = model.fitStates || [0, 0.25, 0.5, 0.75, 1];
 const states = sampleStates.map((s) => {
 if (model.buildFrame && !model.fitRoot) {
 return model.buildFrame({ progress: s, time: 5.0 * s, scrollIntensity: s });
 }
 model.frame?.(5000 * s);
 model.update(s);
 return toGlyphPolygons(model.root, refCenter ? { centerOffset: refCenter } : {});
 });
 const FIT_BOX = {
  libro: [0.46, 0.74],
  silueta: [0.46, 0.76],
  tijeras: [0.46, 0.68],
  tv: [0.46, 0.78],
  pajaros: [0.46, 0.76],
  vuelo: [0.54, 0.78],
 };
 const [deskW, deskH] = FIT_BOX[piece.id] || [0.48, 0.76];
 const targetW = innerWidth > 1100 ? deskW : 0.78;
 const targetH = innerWidth > 1100 ? deskH : 0.46;
 stage.fitMultiState(piece.id, states, targetW, targetH);
 model.update(0);
}

setLoad(0.3);
await nextPaint();
for (let i = 0; i < PIECES.length; i++) fitPiece(PIECES[i], i);
setLoad(0.85);
await nextPaint();

const FREEZE_LO = 0.05;
const FREEZE_HI = 0.82;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function progressOf(section) {
 return clamp((scrollY - section.top) / section.travel, 0, 1);
}

function stateOf(p) {
 return clamp((p - FREEZE_LO) / (FREEZE_HI - FREEZE_LO), 0, 1);
}


const stageOpacity = (p) => sm(0.01, 0.18, p);
const titleForm = (p) => sm(0.02, 0.44, p);

// Columna de lectura
const sections = [...document.querySelectorAll('.piece')].map((el) => ({
 el,
 id: el.dataset.piece,
 state: 0,
 top: 0,
 travel: 1,
 tw: null,
 twState: 'idle',
 dz: null,
 narr: el.querySelector('.narrativa'),
}));
for (const s of sections) {
 const cite = s.el.querySelector('.citation');
 if (cite) cite.setAttribute('aria-hidden', 'true');
}

// Relato
const narrSeg = (p) => sm(0.14, 0.34, p);
const animSeg = (p) => clamp((p - 0.26) / 0.52, 0, 1);

function docTop(el) {
 let y = 0;
 let node = el;
 while (node) {
 y += node.offsetTop;
 node = node.offsetParent;
 }
 return y;
}

let creditsTop = Infinity;
function measureSections() {
 for (const s of sections) {
 s.top = docTop(s.el);
 s.travel = Math.max(1, s.el.offsetHeight - innerHeight);
 }
 const cred = document.getElementById('credits');
 creditsTop = cred ? docTop(cred) : Infinity;
}
measureSections();

function updateReadingColumn(id) {
 const quote = quoteFor(id);
 const block = document.querySelector(`[data-piece="${id}"]`);
 if (!block || !quote) return;
 const p = block.querySelector('.citation p');
 const footer = block.querySelector('.citation footer');
 if (p && !p.textContent.trim()) {
 p.innerHTML = quote.excerpt.split('\n').map((l) => `<span>${escapeHtml(l)}</span>`).join('');
 }
 if (footer && !footer.textContent.trim()) {
 footer.textContent = quote.author
 ? `${quote.author}, ${quote.work}${quote.year ? ', ' + quote.year : ''}`
 : 'Sin atribucion: texto provisorio.';
 }
}

function escapeHtml(s) {
 return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]));
}

for (const piece of PIECES) updateReadingColumn(piece.id);

sections.forEach((s, i) => {
 const p = s.el.querySelector('.citation p');
 const h = s.el.querySelector('.piece-title');
 if (p) s.tw = new Typewriter(p, { seed: 11 + i * 7 });
 if (h) s.dz = new Dissolve(h, { seed: 5 + i, reducedMotion: reduceMotion });
 if (reduceMotion || frozen) { s.tw?.finish(); s.dz?.set(1); }
});

if (hudNodesBox) {
 hudNodesBox.innerHTML = '';
 sections.forEach((s, i) => {
  const quote = quoteFor(s.id);
  const titleEl = s.el.querySelector('.piece-title');
  const title = (titleEl?.getAttribute('aria-label') || quote?.title || titleEl?.textContent || s.id).trim();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hud-node';
  btn.dataset.piece = s.id;
  btn.setAttribute('aria-label', title);
  const dot = document.createElement('span');
  dot.className = 'hud-dot';
  const label = document.createElement('span');
  label.className = 'hud-label';
  label.textContent = title;
  btn.append(dot, label);
  btn.addEventListener('click', (e) => {
   e.preventDefault();
   const targetY = Math.round(s.top + s.travel * 0.25);
   if (reduceMotion) {
    scrollTo(0, targetY);
    scrollPacer.reset(targetY);
   } else {
    scrollPacer.glideTo(targetY);
   }
  });
  hudNodesBox.appendChild(btn);
  hudNodeBtns.push(btn);
 });
}

setLoad(0.92);
await nextPaint();

function activeIndex() {
 const mid = scrollY + innerHeight * 0.5;
 let idx = 0;
 for (let i = 0; i < sections.length; i++) {
 if (sections[i].top <= mid) idx = i;
 }
 return idx;
}

let current = -1;
let smoothSceneY = null;
const userAngles = new Map();
let yaw = 0;
let pitch = 0;

function applyPiece(index) {
 const section = sections[index];
 const pose = poseOf(section.id);
 const angles = userAngles.get(section.id) || { yaw: 0, pitch: 0 };
 yaw = angles.yaw;
 pitch = angles.pitch;
 stage.camera.rotX = pose.rotX + pitch;
 stage.camera.rotY = pose.rotY + yaw;
 stage.camera.zoom = stage.fitCache.get(section.id) ?? pose.zoom;
 stage.camera.center = stageCenterFor(index, section.id);
 stage.setLightRig(section.id);
 const render = RENDER[section.id];
 stage.setDoubleSided(render ? render.doubleSided : true);
 stage.setTvMode(section.id === 'tv');
 const model = models.get(section.id);
 stage.setEffects(model.cellEffect || null, model.stageEffect || null);
 disarmScroll();
 const quote = quoteFor(section.id);
 stage.setText(quote ? (quote.inscription || quote.excerpt) : '');
 document.querySelectorAll('.piece').forEach((el) => el.classList.toggle('is-active', el === section.el));
 current = index;
 smoothSceneY = null;
 section.state = -1;
 damped.set(section.id, -0.2);
 if (srStatus) {
  const titleEl = section.el.querySelector('.piece-title');
  const title = (titleEl?.getAttribute('aria-label') || quote?.title || titleEl?.textContent || '').trim();
  if (title) srStatus.textContent = title;
 }
 for (let i = 0; i < hudNodeBtns.length; i++) {
  hudNodeBtns[i].classList.toggle('is-active', i === index);
  hudNodeBtns[i].classList.toggle('is-passed', i < index);
  if (i === index) hudNodeBtns[i].setAttribute('aria-current', 'step');
  else hudNodeBtns[i].removeAttribute('aria-current');
 }
 if (index === 0 || interO < 0.85 || frozen) redraw(performance.now());
}

function redraw(now) {
 const section = sections[current];
 if (!section) return;
 const model = models.get(section.id);
 const st = Math.max(0, section.state);
 if (model.buildFrame) {
 const intensity = debugP !== null ? debugP : animSeg(progressOf(section));
 const loopT = now / 1000;
 const dur = model.duration > 0 ? model.duration : 5;
 stage.setAnimState({ progress: st, time: loopT, scrollIntensity: intensity });
 stage.setBurn(0);
 stage.setTvStatic(0, now);
 stage.setScatter(0);
 stage.setPolygons(model.buildFrame({ progress: (((loopT / dur) % 1) + 1) % 1, time: loopT, scrollIntensity: intensity }));
 } else {
 model.frame?.(now);
 model.update(st);
 const burnVal = model.burn ? model.burn(st) : 0;
 stage.setBurn(burnVal);
 stage.setTvStatic(model.tvStatic ? model.tvStatic(st) : 0, now);
 stage.setScatter(model.isSilhouette ? sm(0.6, 1.0, st) : 0);
 if (stage.burn > 0 && now - lastFireStepMs >= 48) {
  lastFireStepMs = now;
  stage.fireStep();
 }
 stage.setAnimState({ progress: st, time: now / 1000, scrollIntensity: debugP !== null ? debugP : st });
 const basePolys = toGlyphPolygons(model.root, { centerOffset: modelCenters.get(section.id) });
 const bobZ = reduceMotion ? 0 : levitationBob(now / 1000, modelScales.get(section.id) || 1);
 stage.setPolygons(applyPolygonLevitationInPlace(basePolys, bobZ));
 }
}

const damped = new Map();
let last = performance.now();

// Scroll virtual
let scrollCtl = null;
let portedP = 0;
function armScroll() {
 if (!scrollCtl) scrollCtl = new SmoothScrollController({ reducedMotion: reduceMotion });
 scrollCtl.setReducedMotion(reduceMotion);
 scrollCtl.reset();
 portedP = 0;
}
function disarmScroll() {
 if (scrollCtl) scrollCtl.destroy();
 scrollCtl = null;
 portedP = 0;
}

// Scroll
const baseScrollVel = () => clamp(innerHeight * 2.5, 1800, 2800);
const exitScrollVel = () => clamp(innerHeight * 0.48, 360, 480);
const poemScrollVel = () => clamp(innerHeight * 0.28, 220, 310);
const poemDoneVel = () => clamp(innerHeight * 0.80, 600, 880);
const inFooter = () => Number.isFinite(creditsTop) && scrollY >= creditsTop - innerHeight * 0.9;

function interludeWindow() {
 const sec = sections[current];
 if (!sec || frozen) return { id: null, d: 0, cardO: 0, targetO: 0, floor: 0, textOutO: 0 };
 if (current === 0) {
  const d0 = scrollY / innerHeight;
  if (d0 < 0.76) {
   return {
    id: sections[0].id,
    d: d0,
    cardO: 1 - sm(0.52, 0.74, d0),
    targetO: 1,
    floor: d0 > 0.02 ? sm(0.02, 0.22, d0) : 0,
    textOutO: 1 - sm(0.24, 0.52, d0),
   };
  }
 }
 const nxt = sections[current + 1];
 const dIn = current > 0 ? (scrollY - (sec.top - innerHeight * 0.5)) / innerHeight : Infinity;
 const dOut = nxt ? (scrollY - (nxt.top - innerHeight * 0.5)) / innerHeight : -Infinity;
 let id = null, d = 0;
 if (nxt && dOut > -0.58) {
  id = nxt.id;
  d = dOut;
 } else if (current > 0 && dIn < 0.76) {
  id = sec.id;
  d = dIn;
 }
 if (!id) return { id: null, d: 0, cardO: 0, targetO: 0, floor: 0, textOutO: 0 };
 const textOutO = d > 0 ? 1 - sm(0.24, 0.52, d) : 1;
 const cardO = d <= 0 ? sm(-0.58, -0.32, d) : 1 - sm(0.52, 0.74, d);
 const targetO = d <= 0 ? sm(-0.36, -0.06, d) : 1;
 const floor = d <= 0 ? sm(-0.26, -0.04, d) : 1;
 return { id, d, cardO, targetO, floor, textOutO };
}

function effectiveMaxScrollVel() {
 const base = baseScrollVel();
 const sec = sections[current];
 const nxt = sec ? sections[current + 1] : null;
 const dOut = nxt ? (scrollY - (nxt.top - innerHeight * 0.5)) / innerHeight : -Infinity;
 const p = sec ? progressOf(sec) : 0;
 const win = interludeWindow();
 if (!win.id) {
  const byP = stateOf(p) >= 1 ? sm(FREEZE_HI, FREEZE_HI + 0.04, p) : 0;
  const byOut = nxt ? sm(-1.12, -0.82, dOut) : 0;
  const exitBlend = Math.max(byP, byOut);
  if (exitBlend <= 0) return base;
  const exitCap = exitScrollVel();
  return base + (exitCap - base) * exitBlend;
 }
 const zone = (win.d <= 0 && current > 0) ? 1 : 1 - sm(0.32, 0.60, win.d);
 if (zone <= 0) return base;
 const doneBlend = win.id === interId ? (interCompleted ? 1 : sm(0.92, 0.99, interReveal)) : 0;
 const interCap = poemScrollVel() + (poemDoneVel() - poemScrollVel()) * doneBlend;
 if (win.d <= 0 && current > 0) {
  const toPoem = sm(-0.58, -0.32, win.d);
  const exitCap = exitScrollVel();
  const cap = exitCap + (interCap - exitCap) * toPoem;
  return base + (cap - base) * zone;
 }
 return base + (interCap - base) * zone;
}

window.addEventListener('wheel', (e) => {
 if (!entered || frozen || reduceMotion || e.shiftKey || e.ctrlKey || e.metaKey) return;
 if (inFooter()) {
  scrollPacer.reset(scrollY);
  return;
 }
 if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
 e.preventDefault();
 scrollPacer.addWheelDelta(e, effectiveMaxScrollVel());
}, { passive: false });
window.addEventListener('wheel', (e) => {
 if (!scrollCtl) return;
 if (e.deltaY > 0 && portedP >= 0.999) scrollBy(0, e.deltaY);
 else if (e.deltaY < 0 && portedP <= 0.001) scrollBy(0, e.deltaY);
});

let lastScrollY = -1;
let lastRedraw = 0;
let lastFireStepMs = 0;
let stageO = -1;
let smoothG = 0;
const FRAME_MS = 16;
const EFFECT_FRAME_MS = 55;

// Interpoema
const interEl = document.getElementById('interpoema');
const interPoema = interEl ? interEl.querySelector('.inter-poema') : null;
const interAutor = interEl ? interEl.querySelector('.inter-autor') : null;
let interId = null;
let interO = -1;
let interReveal = 0;
let interCompleted = false;
let interAutorO = '';
let interSpans = null;
let interPoemaO = '';
let interPoemaT = '';
let interAutorT = '';
const INTER_REVEAL_CPS = 46;
const INTER_HIDE_CPS = 72;
function updateInterlude(dt = 1 / 60, immediate = false) {
  const win = interludeWindow();
  const { id, d, cardO, targetO, floor, textOutO } = win;
  if (id !== interId) {
    interId = id;
    interSpans = null;
    interReveal = 0;
    interCompleted = false;
    interAutorO = '0';
    interPoemaO = '1.000';
    interPoemaT = '';
    interAutorT = '';
    if (interPoema) {
      interPoema.textContent = '';
      interPoema.style.opacity = '1';
      interPoema.style.transform = '';
    }
    if (interAutor) {
      const qNext = id ? quoteFor(id) : null;
      interAutor.textContent = qNext ? qNext.author : '';
      interAutor.style.opacity = '0';
      interAutor.style.transform = '';
    }
  }
  if (interEl) {
    if (interId) {
      const q = quoteFor(interId);
      if (!interSpans && q) {
        interSpans = [];
        if (interPoema) {
          const lines = q.excerpt.split('\n');
          lines.forEach((line, li) => {
            const words = line.trim().split(/\s+/).filter(Boolean);
            words.forEach((w, wi) => {
              const wordEl = document.createElement('span');
              wordEl.className = 'inter-word';
              for (const ch of w) {
                const s = document.createElement('span');
                s.textContent = ch;
                s.style.opacity = '0';
                interSpans.push(s);
                wordEl.appendChild(s);
              }
              interPoema.appendChild(wordEl);
              if (wi < words.length - 1) interPoema.appendChild(document.createTextNode(' '));
            });
            if (li < lines.length - 1) interPoema.appendChild(document.createElement('br'));
          });
        }
      }
      if (interSpans) {
        const fn = Math.max(1, interSpans.length);
        const stepUp = (INTER_REVEAL_CPS / fn) * Math.max(dt, 0.001);
        const stepDown = (INTER_HIDE_CPS / fn) * Math.max(dt, 0.001);
        if (reduceMotion) {
          interReveal = targetO > 0.02 ? 1 : 0;
        } else if (immediate) {
          interReveal = targetO;
        } else if (targetO >= interReveal) {
          interReveal = Math.min(targetO, Math.max(floor, interReveal + stepUp));
        } else {
          interReveal = Math.max(targetO, interReveal - stepDown);
        }
        if (interReveal >= 0.98) interCompleted = true;
        const W = 8;
        for (let i = 0; i < interSpans.length; i++) {
          const wo = reduceMotion
            ? (interReveal > 0.5 ? 1 : 0)
            : (() => {
                const t = clamp((interReveal * (fn + W) - i) / W, 0, 1);
                return t * t * (3 - 2 * t);
              })();
          if (interSpans[i]._o !== wo) {
            interSpans[i]._o = wo;
            interSpans[i].style.opacity = wo.toFixed(2);
          }
        }
      }
      const outFactor = reduceMotion ? 1 : textOutO;
      const poemaOStr = outFactor.toFixed(3);
      if (interPoema && poemaOStr !== interPoemaO) {
        interPoemaO = poemaOStr;
        interPoema.style.opacity = poemaOStr;
      }
      if (interAutor) {
        const autorBase = reduceMotion
          ? (interReveal > 0.5 ? 1 : 0)
          : sm(0.45, 0.95, interReveal);
        const autorStr = (autorBase * outFactor).toFixed(3);
        if (autorStr !== interAutorO) {
          interAutorO = autorStr;
          interAutor.style.opacity = autorStr;
        }
      }
      const poemaT = (!reduceMotion && !frozen) ? `translate3d(0,${(-d * 14).toFixed(2)}vh,0)` : '';
      const autorT = (!reduceMotion && !frozen) ? `translate3d(0,${(-d * 18).toFixed(2)}vh,0)` : '';
      if (interPoema && poemaT !== interPoemaT) {
        interPoemaT = poemaT;
        interPoema.style.transform = poemaT;
      }
      if (interAutor && autorT !== interAutorT) {
        interAutorT = autorT;
        interAutor.style.transform = autorT;
      }
    } else {
      if (interPoema && (interPoema.firstChild || interPoemaO !== '1.000' || interPoemaT)) {
        interPoema.textContent = '';
        interPoema.style.opacity = '1';
        interPoema.style.transform = '';
      }
      if (interAutor && (interAutor.textContent || interAutorO !== '0' || interAutorT)) {
        interAutor.textContent = '';
        interAutor.style.opacity = '0';
        interAutor.style.transform = '';
      }
      interPoemaO = '1.000';
      interPoemaT = '';
      interAutorT = '';
      interAutorO = '0';
      interReveal = 0;
      interSpans = null;
    }
    if (cardO === 0 ? interO !== 0 : Math.abs(cardO - interO) > 0.004) {
      interO = cardO;
      interEl.style.opacity = cardO.toFixed(3);
      interEl.setAttribute('aria-hidden', cardO > 0.05 ? 'false' : 'true');
    }
  }
}

// Bucle
function frame(now) {
 const dt = Math.min(1 / 20, (now - last) / 1000);
 last = now;
 stage.setTime(now);
 const scrolled = scrollY !== lastScrollY;
 lastScrollY = scrollY;
 let largeJump = false;
 if (entered && !frozen) {
 const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
 const extJumpDist = scrollPacer.syncExternal();
 largeJump = extJumpDist > 40;
 scrollPacer.step(dt, maxY, effectiveMaxScrollVel(), reduceMotion);
 }

 const idx = debugPiece ? sections.findIndex((s) => s.id === debugPiece) : activeIndex();
 if (idx >= 0 && idx !== current) applyPiece(idx);

 
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const p = progressOf(s);
    if (s.narr) {
      const o = narrSeg(p);
      if (o === 0 ? (s._narrO ?? -1) !== 0 : Math.abs(o - (s._narrO ?? -1)) > 0.004) {
        s._narrO = o;
        s.narr.style.opacity = o.toFixed(3);
      }
      let narrT = '';
      if (!reduceMotion && !frozen && Math.abs(i - current) <= 1) {
        const narrVh = innerWidth > 1100
          ? ((0.36 - p) * 92 - sm(0.60, 0.90, p) * 58)
          : ((1 - sm(0.08, 0.34, p)) * 6 - sm(0.36, 0.90, p) * 108);
        narrT = `translate3d(0,${narrVh.toFixed(2)}vh,0)`;
      }
      if (narrT !== (s._narrT ?? '')) {
        s._narrT = narrT;
        s.narr.style.transform = narrT;
      }
    }
    if (!frozen && !reduceMotion) {
      if (Math.abs(i - current) <= 1) {
        if (scrolled) s.dz?.frame?.(now);
        s.dz?.set(titleForm(p));
        s.tw?.setScroll(p, now, dt, largeJump);
      } else if (i < current - 1) {
        s.dz?.set(1);
        if (s.tw && !s.tw.done) s.tw.finish();
      } else {
        s.dz?.set(0);
        if (s.tw && (s.tw.done || s.tw.curT > 0)) s.tw.reset();
      }
    }
    if (!frozen) {
      if (i < current && p >= FREEZE_HI) { s.state = 1; damped.set(s.id, 1); }
      else if (i > current && p <= FREEZE_LO) { s.state = 0; damped.set(s.id, 0); }
    }
  }

 const section = sections[current];
 if (section) {
 updateInterlude(dt, largeJump);
 if (scrollCtl) portedP = scrollCtl.sample(now);
 const p = scrollCtl ? portedP : progressOf(section);
 let target = debugP !== null ? debugP : stateOf(p);
 const prev = damped.get(section.id) ?? target;
 const next = (debugP !== null || reduceMotion) ? target : prev + (target - prev) * (1 - Math.exp(-dt * 12));
 damped.set(section.id, next);

 const model = models.get(section.id);
 const pVis = scrollCtl ? Math.max(portedP, progressOf(section)) : p;
 const dIn = current > 0 ? (scrollY - (section.top - innerHeight * 0.5)) / innerHeight : Infinity;
 const nxt = sections[current + 1];
 const dOut = nxt ? (scrollY - (nxt.top - innerHeight * 0.5)) / innerHeight : -Infinity;
 const enterIn = frozen ? 1
 : current === 0 ? sm(0.76, 1.12, scrollY / innerHeight)
 : sm(0.76, 1.12, dIn);
 const exitOut = frozen ? 1
 : nxt ? 1 - sm(-0.56, -0.34, dOut)
 : 1 - sm(0.95, 1.0, p);
 const o = enterIn * exitOut;
 const changed = Math.abs(next - Math.max(0, section.state)) > 0.0022;
 const modelIdle = (Boolean(nxt) && dOut > -0.56 && !changed) || (section.id === 'pajaros' && next >= 0.992);
 const animating = !modelIdle && (model.animated || stage.burn > 0 || stage.scatter > 0);
 const effectCadence = !changed && (section.id === 'tv' || section.id === 'pajaros' || (section.id === 'libro' && next > 0.08) || stage.burn > 0) ? EFFECT_FRAME_MS : FRAME_MS;
 if ((changed || (animating && o > 0.002)) && now - lastRedraw >= effectCadence) {
 section.state = next;
 lastRedraw = now;
 redraw(now);
 updateGlow(next);
 }
 if (o === 0 ? stageO !== 0 : Math.abs(o - stageO) > 0.003) {
 stageO = o;
 host.style.setProperty('--stage-o', o.toFixed(3));
 }
 updateParallax(p, nxt ? dOut : -Infinity, dt);
 }

 const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
 const progRatio = maxScroll > 0 ? clamp(scrollY / maxScroll, 0, 1) : 0;
 if (hudFill && sections.length > 0) {
  const n = Math.max(1, sections.length - 1);
  let y0 = sections[0].top + sections[0].travel * 0.12;
  let y1 = sections[n].top + sections[n].travel * 0.85;
  let fIdx = 0;
  if (scrollY <= y0) {
   fIdx = 0;
  } else if (scrollY >= y1) {
   fIdx = n;
  } else {
   for (let i = 0; i < n; i++) {
    const a = sections[i].top + (i === 0 ? sections[0].travel * 0.12 : sections[i].travel * 0.22);
    const b = sections[i + 1].top + (i + 1 === n ? sections[n].travel * 0.85 : sections[i + 1].travel * 0.22);
    if (scrollY >= a && scrollY <= b) {
     fIdx = i + clamp((scrollY - a) / Math.max(1, b - a), 0, 1);
     break;
    }
   }
  }
  const nodeProg = clamp(fIdx / n, 0, 1);
  hudFill.style.height = `${(nodeProg * 100).toFixed(2)}%`;
  for (let i = 0; i < hudNodeBtns.length; i++) {
   const isCur = i === current;
   const isPass = i < current || fIdx >= i - 0.04;
   hudNodeBtns[i].classList.toggle('is-active', isCur);
   hudNodeBtns[i].classList.toggle('is-passed', !isCur && isPass);
  }
 }
 if (hudEl) hudEl.classList.toggle('is-hidden', inFooter() || frozen);
 const g = debugBg !== null ? debugBg : clamp((scrollY / maxScroll) * 1.04, 0, 1);
 smoothG = (debugBg !== null || reduceMotion) ? g : smoothG + (g - smoothG) * (1 - Math.exp(-dt * 6));
 bg.setProgress(smoothG);
 if (bgEl) {
  const bgT = (!reduceMotion && !frozen && maxScroll > 0)
   ? `translate3d(0,-${(clamp(scrollY / maxScroll, 0, 1) * 22).toFixed(2)}vh,0)`
   : '';
  if (bgT !== lastBgT) {
   lastBgT = bgT;
   bgEl.style.transform = bgT;
  }
 }
 if (interO < 0.995) bg.draw(now);

 requestAnimationFrame(frame);
}

const GLOW_STEPS = [0.72, 0.86, 1];
let glowStep = -1;
function updateGlow(state) {
 const idx = state > 0.15 && state < 0.85 ? 2 : state > 0.02 ? 1 : 0;
 if (idx === glowStep) return;
 glowStep = idx;
 document.documentElement.style.setProperty('--glow', String(GLOW_STEPS[idx]));
}

let sceneEl = null;
let lastBgT = '';
function updateParallax(p, dOut = -Infinity, dt = 1 / 60) {
 if (reduceMotion || frozen) {
  smoothSceneY = null;
  if (sceneEl) sceneEl.style.transform = '';
  return;
 }
 if (!sceneEl) sceneEl = host.querySelector('.glyph-scene');
 if (!sceneEl) return;
 const midDriftVh = (0.5 - clamp(p / FREEZE_HI, 0, 1)) * 4;
 const rawOver = stateOf(p) >= 1
  ? Math.max(
      clamp((p - FREEZE_HI) / (0.995 - FREEZE_HI), 0, 1),
      Number.isFinite(dOut) ? clamp((dOut + 1.08) / 0.56, 0, 1) : 0
    )
  : 0;
 const over = rawOver * rawOver * (3 - 2 * rawOver);
 const targetY = midDriftVh - over * 84;
 const dampRate = stateOf(p) >= 1 ? 5.2 : 6.5;
 smoothSceneY = smoothSceneY === null
  ? targetY
  : smoothSceneY + (targetY - smoothSceneY) * (1 - Math.exp(-dt * dampRate));
 sceneEl.style.transform = `translate3d(0,${smoothSceneY.toFixed(2)}vh,0)`;
}

reduceMotionQuery?.addEventListener?.('change', (e) => {
 reduceMotion = e.matches;
 scrollCtl?.setReducedMotion(reduceMotion);
 scrollPacer.reset(scrollY);
 for (const s of sections) {
  s.dz?.setReducedMotion(reduceMotion);
  if (reduceMotion) {
   s.tw?.finish();
   s.dz?.set(1);
   if (s.narr && s._narrT) {
    s._narrT = '';
    s.narr.style.transform = '';
   }
  } else {
   s.tw?.setScroll(progressOf(s), performance.now(), 1 / 60, true);
   s.dz?.set(titleForm(progressOf(s)));
  }
 }
 if (reduceMotion) {
  smoothSceneY = null;
  if (sceneEl) sceneEl.style.transform = '';
  if (bgEl && lastBgT) {
   lastBgT = '';
   bgEl.style.transform = '';
  }
  if (interPoema && interPoemaT) {
   interPoemaT = '';
   interPoema.style.transform = '';
  }
  if (interAutor && interAutorT) {
   interAutorT = '';
   interAutor.style.transform = '';
  }
 }
 updateInterlude(1 / 60, true);
 redraw(performance.now());
});

let dragging = false;
let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;

// Arrastre
host.addEventListener('pointerdown' , (e) => {
 if (!stage.hitTestClient(e.clientX, e.clientY)) return;
 dragging = true;
 host.classList.add('is-dragging');
 startX = lastX = e.clientX;
 startY = lastY = e.clientY;
 host.setPointerCapture(e.pointerId);
});

host.addEventListener('pointermove', (e) => {
 if (!dragging) {
  const overModel = stageO > 0.05 && interO < 0.2 && stage.hitTestClient(e.clientX, e.clientY);
  host.classList.toggle('is-hover-model', overModel);
  return;
 }
 const dx = e.clientX - lastX;
 const dy = e.clientY - lastY;
 if (e.pointerType === 'touch' && Math.abs(dy) >= Math.abs(dx) * 0.85) return;
 if (Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
 lastX = e.clientX;
 lastY = e.clientY;
 yaw += dx * 0.25;
 if (Math.abs(yaw) > 3600) yaw -= Math.trunc(yaw / 360) * 360;
 pitch = clamp(pitch + dy * 0.12, -90, 90);
 userAngles.set(sections[current].id, { yaw, pitch });
 const pose = poseOf(sections[current].id);
 stage.camera.rotX = pose.rotX + pitch;
 stage.camera.rotY = pose.rotY + yaw;
 stage.relightAndRender();
});

host.addEventListener('pointerup', (e) => {
 dragging = false;
 host.classList.remove('is-dragging');
 if (host.hasPointerCapture?.(e.pointerId)) host.releasePointerCapture(e.pointerId);
});
host.addEventListener('pointercancel', () => {
 dragging = false;
 host.classList.remove('is-dragging');
});
host.addEventListener('pointerleave', () => {
 if (!dragging) host.classList.remove('is-hover-model');
});

// Teclado
window.addEventListener('keydown', (e) => {
 const target = e.target;
 if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

 if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
  const isScrollKey = e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp';
  if (isScrollKey && entered && !frozen && !reduceMotion && !inFooter()) {
   e.preventDefault();
   const dir = (e.key === 'PageUp' || e.key === 'ArrowUp') ? -1 : 1;
   const stepDelta = (e.key === 'ArrowDown' || e.key === 'ArrowUp') ? 75 : 220;
   scrollPacer.addDelta(dir * stepDelta, effectiveMaxScrollVel());
   return;
  }
 }

 scrollPacer.reset(scrollY);

 if (e.shiftKey && e.key.startsWith('Arrow')) {
 e.preventDefault();
 if (current < 0) return;
 const secId = sections[current].id;
 const angles = userAngles.get(secId) || { yaw: 0, pitch: 0 };
 if (e.key === 'ArrowLeft') angles.yaw -= 12;
 if (e.key === 'ArrowRight') angles.yaw += 12;
 if (e.key === 'ArrowUp') angles.pitch = clamp(angles.pitch - 8, -85, 85);
 if (e.key === 'ArrowDown') angles.pitch = clamp(angles.pitch + 8, -85, 85);
 userAngles.set(secId, angles);
 yaw = angles.yaw;
 pitch = angles.pitch;
 const pose = poseOf(secId);
 stage.camera.rotX = pose.rotX + pitch;
 stage.camera.rotY = pose.rotY + yaw;
 stage.relightAndRender();
 return;
 }

 if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
 e.preventDefault();
 const milestones = [...sections.map((s) => s.el), document.getElementById('credits')].filter(Boolean);
 const mid = scrollY + innerHeight * 0.35;
 let curIdx = 0;
 for (let i = 0; i < milestones.length; i++) {
 if (milestones[i].getBoundingClientRect().top + scrollY <= mid) curIdx = i;
 }
 const targetIdx = clamp(curIdx + (e.key === 'ArrowRight' ? 1 : -1), 0, milestones.length - 1);
 if (targetIdx < sections.length) {
   const targetSec = sections[targetIdx];
   scrollTo(0, Math.round(targetSec.top + targetSec.travel * 0.25));
 } else {
   milestones[targetIdx].scrollIntoView({ behavior: 'auto', block: 'start' });
 }
 scrollPacer.reset(scrollY);
 }
});

const fit = () => {
 measureCellMetrics();
 stage.resize(host.clientWidth, host.clientHeight);
 bg.resize(innerWidth, Math.ceil(innerHeight * 1.24), cellW, cellH);
 stage.fitCache.clear();
 for (let i = 0; i < PIECES.length; i++) fitPiece(PIECES[i], i);
 measureSections();
 const section = sections[current];
 if (section) {
 const pose = poseOf(section.id);
 const angles = userAngles.get(section.id) || { yaw: 0, pitch: 0 };
 yaw = angles.yaw;
 pitch = angles.pitch;
 stage.camera.rotX = pose.rotX + pitch;
 stage.camera.rotY = pose.rotY + yaw;
 stage.camera.zoom = stage.fitCache.get(section.id) ?? pose.zoom;
 stage.camera.center = stageCenterFor(current, section.id);
 redraw(performance.now());
 }
};
window.addEventListener('resize', fit);

{
 // Creditos
const box = document.querySelector('.credits');
 if (box && !box.textContent.trim()) {
 box.innerHTML = corpus.texts.map((t) => `
 <div class="credits-item">
 <p class="credits-cite">${escapeHtml(t.excerpt)}</p>
 <p class="credits-meta">${escapeHtml(t.author)}${t.work ? ', ' + escapeHtml(t.work) : ''}${t.year ? ', ' + t.year : ''}. ${escapeHtml(t.source || '')}</p>
 <p class="credits-meta">${escapeHtml(t.license || '')}</p>
 </div>`).join('');
 }
}

if (debugPiece) {
 const debugSec = sections.find((s) => s.id === debugPiece);
 if (debugSec) {
 if (debugP === null) debugSec.el.scrollIntoView({ behavior: 'auto', block: 'start' });
 else scrollTo(0, debugSec.top);
 }
}

if (q.has('probe')) {
 const report = [];
 const steps = 30;
 let frames = 0;
 const count = () => { frames++; requestAnimationFrame(count); };
 requestAnimationFrame(count);
 (async () => {
 for (let i = 0; i <= steps; i++) {
 const y = (document.body.scrollHeight - innerHeight) * (i / steps);
 scrollTo(0, y);
 await new Promise((r) => setTimeout(r, 120));
 const active = document.querySelector('.piece.is-active');
 const sec = active ? sections.find((s) => s.id === active.dataset.piece) : null;
 report.push({ want: Math.round(y), real: Math.round(scrollY), piece: active ? active.dataset.piece : null, state: sec ? sec.state.toFixed(2) : null, frames });
 }
 const out = document.createElement('pre');
 out.id = 'report';
 out.textContent = JSON.stringify({ report, errors }, null, 1);
 document.body.appendChild(out);
 })();
}

window.__artefact0s = { stage, models, corpus, sections, bg, errors };

// Arranque
if (loaderMode) {
 setLoad(1);
 if (loaderEl) loaderEl.classList.add('ready');
 if (enterBtn) { enterBtn.disabled = false; enterBtn.focus({ preventScroll: true }); }
} else {
 if (loaderEl) loaderEl.classList.add('done');
 document.documentElement.classList.remove('locked');
 if (loaderEl) setTimeout(() => loaderEl.remove(), 500);
 document.body.classList.add('entered');
 requestAnimationFrame(frame);
}