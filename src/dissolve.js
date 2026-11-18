



const RAMP = " .·░▒▓█";
const GLITCH = ["·", "░", "▒", "▓", "*", "+", "x", "X", "#", "%", "@", "$", "&"];

function hash(a, b = 0) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Dissolve {
  constructor(el, { seed = 3 } = {}) {
    this.el = el;
    this.seed = seed;
    this.rawText = el.textContent.trim();
    this.cleanText = this.rawText.toUpperCase();
    this.chars = [...this.cleanText.replace(/ /g, '')];
    el.setAttribute("aria-label", this.rawText);
    el.textContent = "";

    this.wrapper = document.createElement("div");
    this.wrapper.className = "dissolve-art";
    this.wrapper.setAttribute("aria-hidden", "true");
    el.appendChild(this.wrapper);

    this.spans = [];
    for (const word of this.cleanText.split(' ')) {
      const wst = document.createElement('span');
      wst.className = 'dz-word';
      this.wrapper.appendChild(wst);
      for (const ch of word) {
        const s = document.createElement('span');
        s.className = 'dz-char';
        wst.appendChild(s);
        this.spans.push(s);
      }
      this.wrapper.appendChild(document.createTextNode(' '));
    }

    this.t = -1;
    this.now = 0;
    this.set(0);
  }

  set(t) {
    t = Math.min(1, Math.max(0, t));
    if (Math.abs(t - this.t) < 0.003) return;
    this.t = t;

    if (t <= 0.01) {
      this.el.style.opacity = "0";
      for (const s of this.spans) s.textContent = "";
      return;
    }

    this.el.style.opacity = String(Math.min(1, t * 1.8));

    const len = this.chars.length;
    for (let i = 0; i < len; i++) {
      const ch = this.chars[i];
      const span = this.spans[i];
      

      
      const thr = (i / Math.max(1, len)) * 0.52 + hash(i, this.seed) * 0.22;
      const loc = (t - thr) / 0.26;

      if (loc <= 0) {
        span.textContent = "";
        span.className = "dz-char";
      } else if (loc < 0.32) {
        
        const gIdx = Math.floor(Math.random() * 3);
        span.textContent = ["·", ".", " "][gIdx];
        span.className = "dz-char dz-glitch";
      } else if (loc < 0.88) {
        
        const gIdx = Math.floor(Math.random() * GLITCH.length);
        span.textContent = GLITCH[gIdx];
        span.className = "dz-char dz-glitch";
      } else {
        
        span.textContent = ch;
        span.className = "dz-char";
      }
    }
  }

  frame(now) {
    this.now = now;
    
    if (this.t > 0.02 && this.t < 0.98) {
      const prevT = this.t;
      this.t = -1; 
      this.set(prevT);
    }
  }
}

export class DissolveText extends Dissolve {}
