import { createBook } from './models/book.js';
import { createSilhouette } from './models/silhouette.js';
import { createScissors } from './models/scissors.js';
import { createTv } from './models/tv.js';
import { createBirds } from './models/birds.js';
import { createFlight } from './models/flight.js';
import { toGlyphPolygons, bounds } from './geometry.js';
import { GlyphStage } from './glyph-stage.js';
import { createBackground } from './bg.js';
import { Typewriter } from './typewriter.js';
import { Dissolve, DissolveText } from './dissolve.js';

const PIECES = [
 { id: 'book', create: createBook },
 { id: 'silhouette', create: createSilhouette },
 { id: 'scissors', create: createScissors },
 { id: 'tv', create: createTv },
 { id: 'birds', create: createBirds },
 { id: 'flight', create: createFlight },
];

const POSES = {
 book: { rotX: 70, rotY: 90, zoom: 120 },
 silhouette: { rotX: 80, rotY: 90, zoom: 120 },
 scissors: { rotX: 60, rotY: 30, zoom: 120 },
 tv: { rotX: 90, rotY: 270, zoom: 120 }, 
 birds: { rotX: 86, rotY: 90, zoom: 120 },
 flight: { rotX: 26, rotY: 55, zoom: 120 },
};

const LIGHTS = {
  default: { direction: [0.45, 0.65, 0.8], intensity: 1.15 },
  tv: { direction: [0.35, 0.55, 0.85], intensity: 1.15 },
};

const host = document.getElementById('stage');
const stage = new GlyphStage(host);
const bg = createBackground(document.getElementById('bg'));

const errors = [];
addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => errors.push(`rejection: ${e.reason}`));

const q = new URLSearchParams(location.search);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const reduceMotion = false; 

const debugPiece = q.get('piece');
const poseOverride = { rx: q.has('rx') ? parseFloat(q.get('rx')) : null, ry: q.has('ry') ? parseFloat(q.get('ry')) : null };
const debugP = q.has('p') ? parseFloat(q.get('p')) : null;
const debugBg = q.has('bgp') ? parseFloat(q.get('bgp')) : null;
const frozen = Boolean(debugPiece) || debugP !== null;


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
function enter() {
  if (entered) return;
  entered = true;
  if (loaderEl) loaderEl.classList.add('done');
  setTimeout(() => {
    document.documentElement.classList.remove('locked');
    scrollTo(0, 0);
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
bg.resize(innerWidth, innerHeight, cellW, cellH);

const corpus = await fetch('assets/texts/texts.json').then((r) => r.json());
const quoteFor = (id) => corpus.texts.find((t) => t.piece === id);

setLoad(0.18);
await nextPaint();

function poseOf(id) {
 const pose = { ...POSES[id] };
 if (debugPiece === id) {
 if (poseOverride.rx !== null) pose.rotX = poseOverride.rx;
 if (poseOverride.ry !== null) pose.rotY = poseOverride.ry;
 }
 return pose;
}

const models = new Map();
for (const piece of PIECES) models.set(piece.id, piece.create());

stage.resize(host.clientWidth, host.clientHeight);

function fitPiece(piece) {
 const model = models.get(piece.id);
 const pose = poseOf(piece.id);
 stage.camera.rotX = pose.rotX;
 stage.camera.rotY = pose.rotY;
 stage.camera.zoom = pose.zoom;
 const sampleStates = model.fitStates || [0, 0.25, 0.5, 0.75, 1];
 const states = sampleStates.map((s) => {
 model.update(s);
 model.frame?.(5000 * s);
 return toGlyphPolygons(model.root);
 });
 stage.fitMultiState(piece.id, states, innerWidth > 1100 ? 0.44 : 0.82, 0.76);
 model.update(0);
}

setLoad(0.3);
await nextPaint();
for (const piece of PIECES) fitPiece(piece);
setLoad(0.85);
await nextPaint();

const FREEZE_LO = 0.05;
const FREEZE_HI = 0.85;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function progressOf(section) {
 return clamp((scrollY - section.top) / section.travel, 0, 1);
}

function stateOf(p) {
 return clamp((p - FREEZE_LO) / (FREEZE_HI - FREEZE_LO), 0, 1);
}


const stageOpacity = (p) => sm(0.01, 0.15, p);
const titleForm = (p) => sm(0.02, 0.44, p);

const sections = [...document.querySelectorAll('.piece')].map((el) => ({
 el,
 id: el.dataset.piece,
 state: 0,
 top: 0,
 travel: 1,
 tw: null,
 twState: 'idle',
 dz: null,
}));

function docTop(el) {
 let y = 0;
 let node = el;
 while (node) {
 y += node.offsetTop;
 node = node.offsetParent;
 }
 return y;
}

function measureSections() {
 for (const s of sections) {
 s.top = docTop(s.el);
 s.travel = Math.max(1, s.el.offsetHeight - innerHeight);
 }
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
 return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

for (const piece of PIECES) updateReadingColumn(piece.id);

sections.forEach((s, i) => {
 const p = s.el.querySelector('.citation p');
 const h = s.el.querySelector('.piece-title');
 if (p) s.tw = new Typewriter(p, { seed: 11 + i * 7 });
 if (h) s.dz = new Dissolve(h, { seed: 5 + i });
 if (reduceMotion || frozen) { s.tw?.finish(); s.dz?.set(1); }
});

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
const userAngles = new Map();
let yaw = 0;
let pitch = 0;
let targetY = -1, appliedY = -1, smoothed = false;
let ghost = null;
const parseRGB = (hex) => {
  if (typeof hex !== "string" || hex.length !== 7 || hex[0] !== "#") return [200, 200, 200];
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
};
const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

function applyPiece(index) {
 const prev = sections[current];
 if (prev && prev.tw && prev.twState === 'started' && !prev.tw.done) prev.tw.finish();
 if (prev && prev.lastPolys) {
   ghost = {
     polys: prev.lastPolys.map((pg) => ({ vertices: pg.vertices.map((v) => [v[0], v[1], v[2]]), color: pg.color })),
     cols: prev.lastPolys.map((pg) => parseRGB(pg.color)),
     y0: (typeof scrollY !== "undefined" ? scrollY : 0),
     lift: 0,
     burn: stage.burn,
     scatter: stage.scatter,
     cam: { rotX: stage.camera.rotX, rotY: stage.camera.rotY, zoom: stage.camera.zoom },
   };
 } else ghost = null;
 const section = sections[index];
 const pose = poseOf(section.id);
 const angles = userAngles.get(section.id) || { yaw: 0, pitch: 0 };
 yaw = angles.yaw;
 pitch = angles.pitch;
 stage.camera.rotX = pose.rotX + pitch;
 stage.camera.rotY = pose.rotY + yaw;
 stage.camera.zoom = stage.fitCache.get(section.id) ?? pose.zoom;
 const light = LIGHTS[section.id] || LIGHTS.default;
 stage.setDirectionalLight(light.direction, light.intensity);
 const quote = quoteFor(section.id);
 stage.setText(quote ? (quote.inscription || quote.excerpt) : '');
 document.querySelectorAll('.piece').forEach((el) => el.classList.toggle('is-active', el === section.el));
 current = index;
 section.state = -1;
 damped.set(section.id, -0.2);
 if (ghost) {
   ghost.camTo = { rotX: stage.camera.rotX, rotY: stage.camera.rotY, zoom: stage.camera.zoom };
   stage.camera.rotX = ghost.cam.rotX;
   stage.camera.rotY = ghost.cam.rotY;
   stage.camera.zoom = ghost.cam.zoom;
 }
 redraw(performance.now());
}

function redraw(now) {
 const section = sections[current];
 if (!section) return;
 const model = models.get(section.id);
 model.update(Math.max(0, section.state));
 model.frame?.(now);
 const st0 = clamp(section.state, 0, 1);
 model.root.position.y += sm(0.82, 1, st0) * 3 - (1 - sm(section.top - 1200, section.top + 100, scrollY)) * 2;
 const burnVal = model.burn ? model.burn(Math.max(0, section.state)) : (ghost ? ghost.burn : 0);
stage.setBurn(burnVal);
 stage.setTvStatic(model.tvStatic ? model.tvStatic(Math.max(0, section.state)) : 0, now);
stage.setScatter(model.isSilhouette ? sm(0.6, 1.0, Math.max(0, section.state)) : (ghost ? ghost.scatter : 0));
 if (stage.burn > 0) stage.fireStep();
 const fresh = toGlyphPolygons(model.root);
section.lastPolys = fresh;
let polys = fresh;
if (ghost) {
  const gt = Math.min(1, Math.abs(scrollY - ghost.y0) / 600);
  const gl = gt * 2.5;
  const dl = gl - ghost.lift;
  ghost.lift = gl;
  const gp = ghost.polys;
  for (let gi = 0; gi < gp.length; gi++) {
    const vs = gp[gi].vertices;
    for (let vi = 0; vi < vs.length; vi++) vs[vi][1] += dl;
    const gc = ghost.cols[gi];
    gp[gi].color = toHex(gc[0] + (5 - gc[0]) * gt, gc[1] + (6 - gc[1]) * gt, gc[2] + (7 - gc[2]) * gt);
  }
  if (gt >= 1) ghost = null;
  else {
    const ge = gt * gt * (3 - 2 * gt);
    stage.camera.rotX = ghost.cam.rotX + (ghost.camTo.rotX - ghost.cam.rotX) * ge;
    stage.camera.rotY = ghost.cam.rotY + (ghost.camTo.rotY - ghost.cam.rotY) * ge;
    stage.camera.zoom = ghost.cam.zoom + (ghost.camTo.zoom - ghost.cam.zoom) * ge;
    polys = [...gp, ...fresh];
  }
}
stage.setPolygons(polys);
}

const damped = new Map();
let last = performance.now();
let lastScrollY = -1;
let lastRedraw = 0;
let stageO = -1;
let smoothG = 0;
const FRAME_MS = 16;

function frame(now) {
 const dt = Math.min(1 / 20, (now - last) / 1000);
 last = now;
 stage.setTime(now);
 const scrolled = scrollY !== lastScrollY;
 lastScrollY = scrollY;
  const wasSmoothed = smoothed; smoothed = false;
  if (targetY >= 0 && !wasSmoothed && scrollY !== appliedY) targetY = scrollY;
  if (targetY >= 0 && entered && !frozen) {
    const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    targetY = clamp(targetY, 0, maxY);
    const ny = scrollY + (targetY - scrollY) * Math.min(1, dt * 7);
    if (Math.abs(ny - scrollY) < 0.5) targetY = -1;
    else { appliedY = ny; scrollTo(0, ny); smoothed = true; }
  }

 const idx = debugPiece ? sections.findIndex((s) => s.id === debugPiece) : activeIndex();
 if (idx >= 0 && idx !== current) applyPiece(idx);

 
  for (const s of sections) {
    const p = progressOf(s);
    if (!frozen && !reduceMotion) {
      if (scrolled) s.dz?.frame?.(now);
      s.dz?.set(titleForm(p));
      s.tw?.setScroll(p, now, dt); 
    }
  }

 const section = sections[current];
 if (section) {
 const p = progressOf(section);
 let target = debugP !== null ? debugP : stateOf(p);
 const prev = damped.get(section.id) ?? target;
 const next = debugP !== null ? target : prev + (target - prev) * (1 - Math.exp(-dt * 12));
 damped.set(section.id, next);

 const model = models.get(section.id);
 const enterK = frozen ? 1 : sm(8, 80, scrollY);
 const oTarget = frozen ? 1 : stageOpacity(p) * enterK;
 const animating = model.animated || stage.burn > 0 || stage.scatter > 0 || Math.abs(oTarget - stageO) > 0.003;
 const changed = Math.abs(next - section.state) > 0.0012;
 if ((changed || animating) && now - lastRedraw >= FRAME_MS) {
 section.state = next;
 lastRedraw = now;
 redraw(now);
 updateGlow(next);
 }
 const oGhost = ghost ? Math.max(0, 1 - Math.abs(scrollY - ghost.y0) / 600) : -1;
 const o = Math.max(oTarget, oGhost);
 if (Math.abs(o - stageO) > 0.003) {
 stageO = o;
 host.style.setProperty('--stage-o', o.toFixed(3));
 }
 updateParallax(p);
 }

 const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
 const g = debugBg !== null ? debugBg : clamp((scrollY / maxScroll) * 1.04, 0, 1);
 smoothG = debugBg !== null ? g : smoothG + (g - smoothG) * (1 - Math.exp(-dt * 6));
 bg.setProgress(smoothG);
 bg.draw(now);

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
function updateParallax(p) {
 if (reduceMotion) return;
 if (!sceneEl) sceneEl = host.querySelector('.glyph-scene');
 if (sceneEl) sceneEl.style.transform = `translate3d(0,${((p - 0.5) * 4).toFixed(2)}%,0)`;
}

let dragging = false;
let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;

addEventListener('wheel', (e) => {
  if (!entered || frozen || e.shiftKey || e.ctrlKey || e.metaKey) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (targetY < 0) { targetY = scrollY; appliedY = scrollY; }
  const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  targetY = clamp(targetY + e.deltaY * 1.15, 0, maxY);
}, { passive: false });

host.addEventListener('pointerdown' , (e) => {
 dragging = true;
 startX = lastX = e.clientX;
 startY = lastY = e.clientY;
 host.setPointerCapture(e.pointerId);
});

host.addEventListener('pointermove', (e) => {
 if (!dragging) return;
 if (Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
 const dx = e.clientX - lastX;
 const dy = e.clientY - lastY;
 lastX = e.clientX;
 lastY = e.clientY;
 yaw += dx * 0.25;
 if (Math.abs(yaw) > 3600) yaw -= Math.trunc(yaw / 360) * 360;
 pitch = clamp(pitch + dy * 0.12, -90, 90);
 userAngles.set(sections[current].id, { yaw, pitch });
 const pose = poseOf(sections[current].id);
 stage.camera.rotX = pose.rotX + pitch;
 stage.camera.rotY = pose.rotY + yaw;
 stage.handle.rerender();
});

host.addEventListener('pointerup', (e) => {
 dragging = false;
 host.releasePointerCapture(e.pointerId);
});
host.addEventListener('pointercancel', () => { dragging = false; });

window.addEventListener('keydown', (e) => {
 const target = e.target;
 if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  targetY = -1;

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
 stage.handle.rerender();
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
 milestones[targetIdx].scrollIntoView({ behavior: 'auto', block: 'start' });
 }
});

const fit = () => {
 measureCellMetrics();
 stage.resize(host.clientWidth, host.clientHeight);
 bg.resize(innerWidth, innerHeight, cellW, cellH);
 stage.fitCache.clear();
 for (const piece of PIECES) fitPiece(piece);
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
 redraw(performance.now());
 }
};
window.addEventListener('resize', fit);

{
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

window.__artefact0s = { stage, models, corpus, sections, bg, errors, get ghost() { return ghost ? { n: ghost.polys.length, lift: +ghost.lift.toFixed(2), y0: Math.round(ghost.y0) } : null; } };

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