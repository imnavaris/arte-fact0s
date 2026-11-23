function clamp(value, lo, hi) {
 if (!Number.isFinite(value)) return lo;
 return value < lo ? lo : value > hi ? hi : value;
}

function clamp01(value) {
 return clamp(value, 0, 1);
}

// Scroll virtual
export class SmoothScrollController {
 target = 0;
 current = 0;
 lastSampleMs = null;

 constructor({ maxVel = 0.28, reducedMotion = false } = {}) {
  this.maxVel = maxVel;
  this.reducedMotion = Boolean(reducedMotion);
  window.addEventListener('wheel', this.handleWheel, { passive: false });
 }

 setReducedMotion(value) {
  this.reducedMotion = Boolean(value);
  if (this.reducedMotion) this.current = this.target;
 }

 handleWheel = (event) => {
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const rawDelta = clamp(event.deltaY * unit, -90, 90);
  this.target = clamp01(this.target + rawDelta * 0.00032);
  if (this.reducedMotion) this.current = this.target;
 };

 sample(nowMs = performance.now()) {
  if (this.reducedMotion) {
   this.lastSampleMs = nowMs;
   this.current = this.target;
   return this.current;
  }
  const dtSec =
   this.lastSampleMs === null
    ? 1 / 60
    : Math.min(0.1, Math.max(0.001, (nowMs - this.lastSampleMs) / 1000));
  this.lastSampleMs = nowMs;
  const alpha = 1 - Math.pow(1 - 0.065, dtSec * 30);
  const maxStep = this.maxVel * dtSec;
  const step = clamp((this.target - this.current) * alpha, -maxStep, maxStep);
  this.current += step;
  if (Math.abs(this.target - this.current) < 0.0005) {
   this.current = this.target;
  }
  return this.current;
 }

 reset() {
  this.target = 0;
  this.current = 0;
  this.lastSampleMs = null;
 }

 destroy() {
  window.removeEventListener('wheel', this.handleWheel);
 }
}

// Scroll
export class ScrollPacer {
 constructor(initialY = window.scrollY) {
  this.pos = initialY;
  this.lastAppliedY = initialY;
  this.vel = 0;
  this.impulse = 0;
  this.glideTarget = null;
 }

 reset(y = window.scrollY) {
  this.pos = y;
  this.lastAppliedY = y;
  this.vel = 0;
  this.impulse = 0;
  this.glideTarget = null;
 }

 glideTo(targetY) {
  if (!Number.isFinite(targetY)) return;
  this.pos = window.scrollY;
  this.lastAppliedY = this.pos;
  this.vel = 0;
  this.impulse = 0;
  this.glideTarget = targetY;
 }

 addDelta(delta, capVel) {
  if (!Number.isFinite(delta) || delta === 0) return;
  this.glideTarget = null;
  if (this.vel !== 0 && Math.sign(delta) !== Math.sign(this.vel)) {
   this.vel *= 0.35;
   this.impulse *= 0.2;
  }
  const capImp = capVel * 1.25;
  this.impulse = clamp(this.impulse + delta * 3.6, -capImp, capImp);
 }

 addWheelDelta(event, capVel) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const rawDelta = clamp(event.deltaY * unit, -240, 240);
  this.addDelta(rawDelta, capVel);
 }

 syncExternal() {
  const curY = window.scrollY;
  const diff = curY - this.lastAppliedY;
  const extJump = Math.abs(diff) > 1.5;
  if (extJump || (this.vel === 0 && this.impulse === 0 && this.glideTarget === null)) {
   this.pos = curY;
   this.lastAppliedY = curY;
   if (extJump) {
    this.vel = 0;
    this.impulse = 0;
    this.glideTarget = null;
   }
  }
  return extJump ? Math.abs(diff) : 0;
 }

 step(dt, maxY, capVel, reducedMotion = false) {
  if (reducedMotion) {
   if (this.glideTarget !== null) {
    const t = clamp(this.glideTarget, 0, maxY);
    window.scrollTo(0, t);
    this.reset(window.scrollY);
    return true;
   }
   this.reset(window.scrollY);
   return false;
  }
  if (this.glideTarget !== null) {
   const target = clamp(this.glideTarget, 0, maxY);
   const diff = target - this.pos;
   if (Math.abs(diff) < 1.2) {
    this.pos = target;
    this.glideTarget = null;
    this.vel = 0;
   } else {
    const stepY = diff * (1 - Math.exp(-dt * 6.8));
    this.pos = clamp(this.pos + stepY, 0, maxY);
   }
   window.scrollTo(0, this.pos);
   this.lastAppliedY = window.scrollY;
   return true;
  }
  const transfer = 1 - Math.exp(-dt * 18);
  const capImp = capVel * 1.25;
  this.impulse = clamp(this.impulse, -capImp, capImp);
  this.vel = clamp(this.vel + this.impulse * transfer, -capVel, capVel);
  this.impulse *= 1 - transfer;
  this.vel *= Math.exp(-dt * 2.9);
  if (Math.abs(this.impulse) < 0.5) this.impulse = 0;
  if (Math.abs(this.vel) < 1.2 && this.impulse === 0) {
   this.vel = 0;
   return false;
  }
  this.pos = clamp(this.pos + this.vel * dt, 0, maxY);
  if (this.pos <= 0 || this.pos >= maxY) {
   this.vel = 0;
   this.impulse = 0;
  }
  window.scrollTo(0, this.pos);
  this.lastAppliedY = window.scrollY;
  return true;
 }
}
