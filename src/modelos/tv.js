import { T, mat, texMat, box, part } from './compartido.js';
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function crearTv() {
  const root = new T.Group();
// Gabinete
  const woodMat = texMat((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#cfc4ae');
    g.addColorStop(0.5, '#b8ad96');
    g.addColorStop(1, '#9e937d');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(34, 16, 6, 0.14)';
    for (let y = 0; y < h; y += 12) c.fillRect(0, y, w, 3);
  }, { roughness: 0.44, metalness: 0.18 });
  const fasciaMat = mat('#2a2723', { roughness: 0.78, metalness: 0.06 });
  fasciaMat.userData = { fixedColor: '#4c4740', unlit: true };
  const gasketMat = mat('#1d1b18', { roughness: 0.88, metalness: 0.04 });
  gasketMat.userData = { fixedColor: '#33302b', unlit: true };
  const trimMat = mat('#ddd4c5', { roughness: 0.26, metalness: 0.48 });
  const grilleBarMat = mat('#dfd7c7', { roughness: 0.28, metalness: 0.40 });
  const bezelMat = texMat((c, w, h) => {
    c.fillStyle = '#ece4d6';
    c.fillRect(0, 0, w, h);
  }, { color: '#ece4d6', roughness: 0.30, metalness: 0.26 });
  const chromeMat = mat('#ffffff', { roughness: 0.12, metalness: 0.85 });
  const domeMat = mat('#b6ae9e', { roughness: 0.30, metalness: 0.56 });
  const badgeMat = mat('#ffffff', { roughness: 0.22, metalness: 0.35 });
  const pointerTipMat = mat('#ffffff', { roughness: 0.14, metalness: 0.60 });
  const grilleDarkMat = mat('#1c1a17', { roughness: 0.90, metalness: 0.04 });
  grilleDarkMat.userData = { fixedColor: '#2d2a26', unlit: true };
// Pantalla
  const screenMat = mat('#384468', { roughness: 0.2, metalness: 0.0 });
  screenMat.userData = { fixedColor: '#384468', unlit: true };
  const backMat = mat('#c6bba6', { roughness: 0.38, metalness: 0.22 });
  const backTrimMat = mat('#efe7d8', { roughness: 0.26, metalness: 0.42 });
  const ventMat = mat('#38342f', { roughness: 0.82, metalness: 0.06 });
  ventMat.userData = { fixedColor: '#3e3a34', unlit: true };

// Cuerpo
  const W = 3.52, H = 2.22, D = 1.44;
  box(root, [W, H, D], woodMat, [0, 0, -0.02]);
  box(root, [2.74, 1.66, 0.78], backMat, [-0.08, -0.02, -1.04]);
  box(root, [2.80, 0.10, 0.08], backTrimMat, [-0.08, 0.78, -1.42]);
  box(root, [2.80, 0.10, 0.08], backTrimMat, [-0.08, -0.82, -1.42]);
  box(root, [1.56, 1.06, 0.58], backMat, [-0.14, 0.02, -1.66]);
  for (const vy of [0.54, 0.30, -0.26, -0.50]) {
    box(root, [2.24, 0.09, 0.06], ventMat, [-0.08, vy, -1.43]);
  }
  part(root, new T.CylinderGeometry(0.42, 0.46, 0.28, 10), backTrimMat, [-0.14, 0.02, -2.02], [Math.PI / 2, 0, 0]);
  part(root, new T.CylinderGeometry(0.24, 0.24, 0.08, 8), ventMat, [-0.14, 0.02, -2.17], [Math.PI / 2, 0, 0]);

// Borde
  const rimT = 0.095, rimZ = 0.72, rimD = 0.15;
  box(root, [W, rimT, rimD], woodMat, [0, H / 2 - rimT / 2, rimZ]);
  box(root, [W, rimT, rimD], woodMat, [0, -H / 2 + rimT / 2, rimZ]);
  box(root, [rimT, H - rimT * 2, rimD], woodMat, [-W / 2 + rimT / 2, 0, rimZ]);
  box(root, [rimT, H - rimT * 2, rimD], woodMat, [W / 2 - rimT / 2, 0, rimZ]);

// Frente
  box(root, [W - rimT * 2, H - rimT * 2, 0.08], fasciaMat, [0, 0, 0.725]);
  box(root, [0.08, H - rimT * 2 - 0.08, 0.05], trimMat, [0.76, 0, 0.785]);

// Patas
  for (const sx of [-1.42, 1.42]) for (const sz of [-0.46, 0.46]) {
    part(root, new T.CylinderGeometry(0.085, 0.095, 0.08, 10), gasketMat, [sx, -H / 2 - 0.04, sz]);
  }

// Marco
  const SX = -0.46, SY = 0.03, SW = 1.96, SH = 1.46, B = 0.17;
  box(root, [SW + B * 2, B, 0.14], bezelMat, [SX, SY + SH / 2 + B / 2, 0.81]);
  box(root, [SW + B * 2, B, 0.14], bezelMat, [SX, SY - SH / 2 - B / 2, 0.81]);
  box(root, [B, SH, 0.14], bezelMat, [SX - SW / 2 - B / 2, SY, 0.81]);
  box(root, [B, SH, 0.14], bezelMat, [SX + SW / 2 + B / 2, SY, 0.81]);

// Junta
  box(root, [SW + 0.05, 0.045, 0.06], gasketMat, [SX, SY + SH / 2 + 0.015, 0.845]);
  box(root, [SW + 0.05, 0.045, 0.06], gasketMat, [SX, SY - SH / 2 - 0.015, 0.845]);
  box(root, [0.045, SH + 0.02, 0.06], gasketMat, [SX - SW / 2 - 0.015, SY, 0.845]);
  box(root, [0.045, SH + 0.02, 0.06], gasketMat, [SX + SW / 2 + 0.015, SY, 0.845]);

  const sg = new T.PlaneGeometry(SW, SH, 8, 6);
  const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const nx = sp.getX(i) / (SW / 2), ny = sp.getY(i) / (SH / 2);
    sp.setZ(i, 0.22 * (1 - (nx * nx + ny * ny) * 0.45));
  }
  sg.computeVertexNormals();
  part(root, sg, screenMat, [SX, SY, 0.80]);

// Emblema
  const BY = SY - SH / 2 - B - 0.065;
  box(root, [0.075, 0.06, 0.05], badgeMat, [SX - 0.10, BY, 0.79]);
  box(root, [0.075, 0.06, 0.05], badgeMat, [SX, BY, 0.79]);
  box(root, [0.075, 0.06, 0.05], badgeMat, [SX + 0.10, BY, 0.79]);

// Panel
  const PX = 1.23;
  box(root, [0.82, 0.055, 0.05], trimMat, [PX, 0.34, 0.785]);
  box(root, [0.82, 0.055, 0.05], trimMat, [PX, -0.38, 0.785]);

// Perillas
  for (const ky of [0.82, 0.54]) {
    for (const kx of [PX - 0.20, PX + 0.20]) {
      part(root, new T.CylinderGeometry(0.115, 0.12, 0.12, 8), chromeMat, [kx, ky, 0.83], [Math.PI / 2, 0, 0]);
      part(root, new T.CylinderGeometry(0.052, 0.052, 0.05, 6), gasketMat, [kx, ky, 0.90], [Math.PI / 2, 0, 0]);
    }
  }

// Diales
  const knobs = [];
  for (let idx = 0; idx < 2; idx++) {
    const dy = idx === 0 ? 0.15 : -0.20;
    part(root, new T.CylinderGeometry(0.205, 0.215, 0.08, 10), chromeMat, [PX, dy, 0.82], [Math.PI / 2, 0, 0]);
    part(root, new T.CylinderGeometry(0.135, 0.135, 0.09, 8), gasketMat, [PX, dy, 0.84], [Math.PI / 2, 0, 0]);
    const k = new T.Group();
    k.position.set(PX, dy, 0.90);
    k.rotation.z = idx === 0 ? 0.78 : -1.05;
    root.add(k);
    box(k, [0.085, 0.34, 0.08], chromeMat, [0, 0, 0]);
    box(k, [0.09, 0.10, 0.09], pointerTipMat, [0, 0.11, 0.008]);
    knobs.push({ k, baseRot: k.rotation.z });
  }

// Parlante
  const SYG = -0.71;
  const spkBg = part(root, new T.CylinderGeometry(0.31, 0.31, 0.04, 10), grilleDarkMat, [PX, SYG, 0.77], [Math.PI / 2, 0, 0]);
  spkBg.scale.set(0.92, 1.0, 1.08);
  for (const dx of [-0.22, -0.11, 0, 0.11, 0.22]) {
    const h = 0.56 * Math.sqrt(Math.max(0.22, 1 - (dx / 0.27) * (dx / 0.27)));
    box(root, [0.055, h, 0.06], grilleBarMat, [PX + dx, SYG, 0.81]);
  }

// Antenas
  part(root, new T.SphereGeometry(0.35, 10, 6), domeMat, [0, H / 2 + 0.06, 0.08]).scale.set(1.25, 0.55, 0.95);
  const ants = [];
  for (const s of [-1, 1]) {
    const g = new T.Group();
    g.userData.excludeCenter = true;
    g.position.set(s * 0.08, H / 2 + 0.12, 0.08);
    g.rotation.z = -s * 0.48;
    root.add(g);
    part(g, new T.CylinderGeometry(0.024, 0.028, 0.94, 5), chromeMat, [0, 0.47, 0]);
    part(g, new T.CylinderGeometry(0.032, 0.032, 0.045, 5), domeMat, [0, 0.94, 0]);
    part(g, new T.CylinderGeometry(0.018, 0.022, 0.96, 5), chromeMat, [0, 1.42, 0]);
    part(g, new T.SphereGeometry(0.052, 6, 4), chromeMat, [0, 1.91, 0]);
    ants.push({ g, s });
  }

  root.rotation.set(0.04, 0, 0);
  return {
    root,
    kind: 'tv',
    animated: true,
    fitStates: [0, 0.5, 1.0],
    frame(now) { this._t = (now || 0) * 0.001; },
// Estatica
    tvStatic(p) { return sm(0.04, 0.45, p); },
// Estado
    update(p) {
      const t = this._t || 0;
      root.rotation.y = Math.sin(p * Math.PI) * 0.16;
      root.rotation.x = 0.04 + Math.sin(p * Math.PI) * 0.045;
      for (let i = 0; i < knobs.length; i++) {
        knobs[i].k.rotation.z = knobs[i].baseRot + (i ? -1 : 1) * p * 5.2;
      }
      for (let i = 0; i < ants.length; i++) {
        const { g, s } = ants[i];
        g.rotation.z = -s * (0.48 + p * 0.06) + Math.sin(p * 6 + s + t * 1.4) * 0.015;
      }
    }
  };
}
