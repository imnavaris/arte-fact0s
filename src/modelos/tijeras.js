import * as T from 'three';
import { computeSceneBbox } from 'glyphcss';
import { levitationBob } from './compartido.js';

// Tijeras
const SCISSORS = {
  openHalfAngleRad: (22 * Math.PI) / 180,
  pivotZThree: -0.25,
  filmZThree: 0.34,
  pivotColor: 0xffffff,
  bladeAColor: 0xffffff,
  handleAColor: 0xd8d8d8,
  bladeBColor: 0xf0f0f0,
  handleBColor: 0xc8c8c8,
  filmRailColor: 0xc0c0c0,
  filmFrameColor: 0xf4f4f4,
  filmHalfLength: 0.95,
  filmWidth: 0.48,
  filmThickness: 0.028,
};

const FILM_PHYSICS = (() => {
  const densityKgM3 = 1310;
  const areaM2 = 0.0022;
  const thicknessM = 0.00014;
  const massKg = densityKgM3 * areaM2 * thicknessM;
  const airDragPerArea = 0.266;
  const dragRate = (airDragPerArea * areaM2) / massKg;
  const gravityMps2 = 9.81;
  return {
    fallDurationSec: 1.55,
    gravityMps2,
    massKg,
    dragRate,
    terminalVelocityMps: gravityMps2 / dragRate,
    worldScalePerMeter: 0.82,
    lateralDragRate: 2.1,
    rotationalDragRate: 1.8,
    shearImpulseY: 1.15,
    glideStrength: 0.55,
    flutterFreq: 4.1,
    flutterAmp: 0.34,
    flexAmp: 0.16,
    twistAmp: 0.28,
  };
})();

const SCISSORS_ANIMATION_DURATION = 5.0;

// Hojas
function createBladeGeometry() {
  const shape = new T.Shape();
  shape.moveTo(-0.12, 0.0);
  shape.lineTo(1.18, 0.006);
  shape.lineTo(1.18, 0.022);
  shape.quadraticCurveTo(0.75, 0.125, 0.14, 0.13);
  shape.lineTo(-0.12, 0.095);
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.007,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geo.translate(0, 0, -0.018);
  geo.rotateY(-Math.PI * 0.5);
  return geo;
}

function createHandleGeometry() {
  const outer = new T.Shape();
  outer.moveTo(-0.08, 0.025);
  outer.quadraticCurveTo(-0.22, -0.02, -0.40, -0.105);
  outer.absellipse(-0.62, -0.24, 0.31, 0.19, Math.PI * 0.25, Math.PI * 1.92, false, 0);
  outer.quadraticCurveTo(-0.18, -0.17, -0.08, -0.055);
  outer.closePath();
  const hole = new T.Path();
  hole.absellipse(-0.62, -0.24, 0.23, 0.125, 0, Math.PI * 2, true, 0);
  outer.holes.push(hole);
  const geo = new T.ExtrudeGeometry(outer, {
    depth: 0.054,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
    curveSegments: 14,
  });
  geo.translate(0, 0, -0.027);
  geo.rotateY(-Math.PI * 0.5);
  return geo;
}

// Mangos
function createHalfScissorsGroup(
  bladeColor,
  handleColor,
  xOffset,
  oppositeSide,
  openAngleRad,
) {
  const half = new T.Group();
  const bladeMat = new T.MeshStandardMaterial({ color: bladeColor, roughness: 0.26, metalness: 0.62 });
  const handleMat = new T.MeshStandardMaterial({ color: handleColor, roughness: 0.45, metalness: 0.35 });
  const blade = new T.Mesh(createBladeGeometry(), bladeMat);
  const handle = new T.Mesh(createHandleGeometry(), handleMat);
  blade.position.x = xOffset;
  handle.position.x = xOffset;
  const container = new T.Group();
  container.add(blade, handle);
  if (oppositeSide) {
    container.rotation.z = Math.PI;
    half.rotation.x = openAngleRad;
  } else {
    half.rotation.x = -openAngleRad;
  }
  half.position.set(0, 0, SCISSORS.pivotZThree);
  half.add(container);
  return half;
}

// Pelicula
function createFilmHalfGroup(side) {
  const group = new T.Group();
  const railMat = new T.MeshStandardMaterial({
    color: SCISSORS.filmRailColor,
    roughness: 0.62,
    metalness: 0.05,
  });
  const frameMat = new T.MeshStandardMaterial({
    color: SCISSORS.filmFrameColor,
    roughness: 0.52,
    metalness: 0.05,
  });
  const gapHalf = 0.005;
  const xStart = side === -1 ? -SCISSORS.filmHalfLength : gapHalf;
  const xEnd = side === -1 ? -gapHalf : SCISSORS.filmHalfLength;
  const len = xEnd - xStart;
  const halfW = SCISSORS.filmWidth * 0.5;
  const filmShape = new T.Shape();
  filmShape.moveTo(xStart, -halfW);
  filmShape.lineTo(xEnd, -halfW);
  filmShape.lineTo(xEnd, halfW);
  filmShape.lineTo(xStart, halfW);
  filmShape.closePath();
  const sprocketCount = 6;
  const step = len / sprocketCount;
  const holeW = step * 0.44;
  const holeH = 0.056;
  const railOffset = halfW - 0.056;
  for (let i = 0; i < sprocketCount; i++) {
    const xCenter = xStart + (i + 0.5) * step;
    for (const zSign of [-1, 1]) {
      const hole = new T.Path();
      const zCenter = zSign * railOffset;
      hole.moveTo(xCenter - holeW * 0.5, zCenter - holeH * 0.5);
      hole.lineTo(xCenter + holeW * 0.5, zCenter - holeH * 0.5);
      hole.lineTo(xCenter + holeW * 0.5, zCenter + holeH * 0.5);
      hole.lineTo(xCenter - holeW * 0.5, zCenter + holeH * 0.5);
      hole.closePath();
      filmShape.holes.push(hole);
    }
  }
  const railGeo = new T.ExtrudeGeometry(filmShape, {
    depth: SCISSORS.filmThickness,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  railGeo.translate(0, 0, -SCISSORS.filmThickness * 0.5);
  railGeo.rotateX(-Math.PI * 0.5);
  const railMesh = new T.Mesh(railGeo, railMat);
  group.add(railMesh);
  const frameCount = 2;
  const framePitch = len / frameCount;
  const frameGeo = new T.BoxGeometry(
    framePitch * 0.72,
    SCISSORS.filmThickness + 0.012,
    SCISSORS.filmWidth * 0.54,
  );
  for (let i = 0; i < frameCount; i++) {
    const f = new T.Mesh(frameGeo, frameMat);
    f.position.set(xStart + (i + 0.5) * framePitch, 0, 0);
    group.add(f);
  }
  group.position.set(0, 0, SCISSORS.filmZThree);
  return group;
}

// Eje
function createPivotGroup() {
  const group = new T.Group();
  const pivotMat = new T.MeshStandardMaterial({
    color: SCISSORS.pivotColor,
    roughness: 0.22,
    metalness: 0.7,
  });
  const pivotGeo = new T.CylinderGeometry(0.055, 0.055, 0.13, 14);
  pivotGeo.rotateZ(Math.PI * 0.5);
  const pivot = new T.Mesh(pivotGeo, pivotMat);
  pivot.position.set(0, 0, SCISSORS.pivotZThree);
  group.add(pivot);
  return group;
}

function buildTijerasFilmBase() {
  const root = new T.Group();
  root.name = 'Tijera';
  root.add(
    createPivotGroup(),
    createHalfScissorsGroup(
      SCISSORS.bladeAColor,
      SCISSORS.handleAColor,
      0.02,
      false,
      SCISSORS.openHalfAngleRad,
    ),
    createHalfScissorsGroup(
      SCISSORS.bladeBColor,
      SCISSORS.handleBColor,
      0.02,
      true,
      SCISSORS.openHalfAngleRad,
    ),
    createFilmHalfGroup(-1),
    createFilmHalfGroup(1),
  );
  return root;
}

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
    const roughness = mat && Number.isFinite(mat.roughness) ? mat.roughness : 0.45;
    const metalness = mat && Number.isFinite(mat.metalness) ? mat.metalness : 0.2;
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

function mapRawToCalibrated(polys, rawCenter, baseCenter, scale) {
  const [rcx, rcy, rcz] = rawCenter;
  const [bcx, bcy, bcz] = baseCenter;
  return polys.map((poly) => ({
    ...poly,
    vertices: poly.vertices.map(
      ([x, y, z]) => [
        bcx + (x - rcx) * scale,
        bcy + (y - rcy) * scale,
        bcz + (z - rcz) * scale,
      ],
    ),
  }));
}

const partsCache = new WeakMap();

function getArticulatedScissors(basePolygons) {
  const cached = partsCache.get(basePolygons);
  if (cached) return cached;
  const baseBbox = computeSceneBbox(basePolygons);
  const baseSpan = Math.max(
    1,
    baseBbox.max[0] - baseBbox.min[0],
    baseBbox.max[1] - baseBbox.min[1],
    baseBbox.max[2] - baseBbox.min[2],
  );
  const baseCenter = [
    (baseBbox.min[0] + baseBbox.max[0]) * 0.5,
    (baseBbox.min[1] + baseBbox.max[1]) * 0.5,
    (baseBbox.min[2] + baseBbox.max[2]) * 0.5,
  ];
  const refOpenRaw = extractRawGlyphPolygons(buildTijerasFilmBase());
  const rawBbox = computeSceneBbox(refOpenRaw);
  const rawSpan = Math.max(
    1e-6,
    rawBbox.max[0] - rawBbox.min[0],
    rawBbox.max[1] - rawBbox.min[1],
    rawBbox.max[2] - rawBbox.min[2],
  );
  const rawCenter = [
    (rawBbox.min[0] + rawBbox.max[0]) * 0.5,
    (rawBbox.min[1] + rawBbox.max[1]) * 0.5,
    (rawBbox.min[2] + rawBbox.max[2]) * 0.5,
  ];
  const scale = baseSpan / rawSpan;
  const pivotPolys = mapRawToCalibrated(
    extractRawGlyphPolygons(createPivotGroup()),
    rawCenter,
    baseCenter,
    scale,
  );
  const bladeAPolys = mapRawToCalibrated(
    extractRawGlyphPolygons(
      createHalfScissorsGroup(SCISSORS.bladeAColor, SCISSORS.handleAColor, 0.02, false, 0),
    ),
    rawCenter,
    baseCenter,
    scale,
  );
  const bladeBPolys = mapRawToCalibrated(
    extractRawGlyphPolygons(
      createHalfScissorsGroup(SCISSORS.bladeBColor, SCISSORS.handleBColor, 0.02, true, 0),
    ),
    rawCenter,
    baseCenter,
    scale,
  );
  const filmLeftPolys = mapRawToCalibrated(
    extractRawGlyphPolygons(createFilmHalfGroup(-1)),
    rawCenter,
    baseCenter,
    scale,
  );
  const filmRightPolys = mapRawToCalibrated(
    extractRawGlyphPolygons(createFilmHalfGroup(1)),
    rawCenter,
    baseCenter,
    scale,
  );
  const pivotPoint = [
    baseCenter[0] + (SCISSORS.pivotZThree - rawCenter[0]) * scale,
    baseCenter[1] + (0 - rawCenter[1]) * scale,
    baseCenter[2] + (0 - rawCenter[2]) * scale,
  ];
  const filmCutOrigin = [
    baseCenter[0] + (SCISSORS.filmZThree - rawCenter[0]) * scale,
    baseCenter[1] + (0 - rawCenter[1]) * scale,
    baseCenter[2] + (0 - rawCenter[2]) * scale,
  ];
  const makePool = (polys) => {
    const pool = new Array(polys.length);
    for (let i = 0; i < polys.length; i++) {
      const p = polys[i];
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
    return pool;
  };
  const totalCount =
    pivotPolys.length +
    bladeAPolys.length +
    bladeBPolys.length +
    filmLeftPolys.length +
    filmRightPolys.length;
  const parts = {
    pivotPoint,
    filmCutOrigin,
    scale,
    totalCount,
    pivotPolys,
    pivotPool: makePool(pivotPolys),
    bladeAPolys,
    bladeAPool: makePool(bladeAPolys),
    bladeBPolys,
    bladeBPool: makePool(bladeBPolys),
    filmLeftPolys,
    filmLeftPool: makePool(filmLeftPolys),
    filmRightPolys,
    filmRightPool: makePool(filmRightPolys),
  };
  partsCache.set(basePolygons, parts);
  return parts;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function transformBladePolygons(polys, pool, pivotPoint, angleRad, bobZ, out, outIdx) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const px = pivotPoint[0];
  const pz = pivotPoint[2];
  for (let i = 0; i < polys.length; i++) {
    const verts = polys[i].vertices;
    const slot = pool[i];
    const dst = slot.vertices;
    for (let j = 0; j < verts.length; j++) {
      const sv = verts[j];
      const dv = dst[j];
      const dx = sv[0] - px;
      const dz = sv[2] - pz;
      dv[0] = px + dx * cos - dz * sin;
      dv[1] = sv[1];
      dv[2] = pz + dx * sin + dz * cos + bobZ;
    }
    out[outIdx++] = slot;
  }
  return outIdx;
}

function transformFilmHalfPolygons(
  polys,
  pool,
  cutOrigin,
  side,
  fallProgress,
  idleWave,
  bobZ,
  scale,
  out,
  outIdx,
) {
  const ox = cutOrigin[0];
  const oy = cutOrigin[1];
  const oz = cutOrigin[2];
  const halfLen = SCISSORS.filmHalfLength * 0.5 * scale;
  const comX = ox;
  const comY = oy + side * halfLen;
  const comZ = oz;
  const invScale = 1 / Math.max(1, scale);
  const flutterScale = 0.012 * scale;
  if (fallProgress <= 0.0001) {
    for (let i = 0; i < polys.length; i++) {
      const verts = polys[i].vertices;
      const slot = pool[i];
      const dst = slot.vertices;
      for (let j = 0; j < verts.length; j++) {
        const sv = verts[j];
        const dv = dst[j];
        const dist = Math.abs(sv[1] - oy) * invScale;
        const flutter = Math.sin(idleWave + dist * 1.9) * (flutterScale * dist);
        dv[0] = sv[0];
        dv[1] = sv[1];
        dv[2] = sv[2] + bobZ + flutter;
      }
      out[outIdx++] = slot;
    }
    return outIdx;
  }
  const p = FILM_PHYSICS;
  const tau = fallProgress * p.fallDurationSec;
  const onset = 1 - Math.exp(-tau * 5.5);
  const asym = side === -1 ? 1.0 : 1.16;
  const freqMul = side === -1 ? 1.0 : 1.14;
  const driftXSign = side === -1 ? -1 : 1;
  const k = p.dragRate;
  const dragFallMeters = p.terminalVelocityMps * (tau - (1 - Math.exp(-k * tau)) / k);
  const dropZ = -dragFallMeters * p.worldScalePerMeter * scale;
  const massInertia = Math.sqrt(0.000403 / p.massKg);
  const recoilY =
    side *
    p.shearImpulseY *
    massInertia *
    ((1 - Math.exp(-p.lateralDragRate * tau)) / p.lateralDragRate) *
    scale *
    0.45;
  const pitchAngle =
    side *
    (0.62 * asym * (1 - Math.exp(-p.rotationalDragRate * tau)) +
      p.flutterAmp * onset * Math.sin(p.flutterFreq * freqMul * tau));
  const cosP = Math.cos(pitchAngle);
  const sinP = Math.sin(pitchAngle);
  const glideY = sinP * p.glideStrength * tau * scale * 0.35;
  const driftX =
    driftXSign * 0.18 * scale * onset * (1 - Math.cos(p.flutterFreq * 0.7 * tau));
  const bobFade = bobZ * Math.exp(-tau * 4.0);
  const invHalfLen = 1 / Math.max(1e-6, halfLen);
  const archBase = -p.flexAmp * scale * onset * cosP;
  const waveAmp = 0.055 * scale * onset;
  const wavePhase = p.flutterFreq * freqMul * tau;
  const rollBase = side * 0.24 * asym * onset;
  const twistScale = p.twistAmp * onset * Math.sin(p.flutterFreq * 0.85 * tau + (side === 1 ? 0.6 : 0));
  const idleDecay = 1 - onset;
  const xShift = comX + driftX;
  const yShift = comY + recoilY + glideY;
  const zShift = comZ + dropZ + bobFade;

  for (let i = 0; i < polys.length; i++) {
    const verts = polys[i].vertices;
    const slot = pool[i];
    const dst = slot.vertices;
    for (let j = 0; j < verts.length; j++) {
      const sv = verts[j];
      const dv = dst[j];
      const x = sv[0];
      const y = sv[1];
      const z = sv[2];
      const dist = Math.abs(y - oy) * invScale;
      const idleFlutter = Math.sin(idleWave + dist * 1.9) * (flutterScale * dist) * idleDecay;
      const lx = x - comX;
      const ly = y - comY;
      const lz = z - comZ + idleFlutter;
      const uRaw = ly * invHalfLen;
      const u = uRaw < -1 ? -1 : uRaw > 1 ? 1 : uRaw;
      const arch = archBase * (u * u - 0.33);
      const ribbonWave = waveAmp * Math.sin(u * 2.4 - wavePhase);
      const lzBent = lz + arch + ribbonWave;
      const rollAngle = rollBase + twistScale * u;
      const cosR = Math.cos(rollAngle);
      const sinR = Math.sin(rollAngle);
      const rxLocal = lx * cosR - lzBent * sinR;
      const rzRolled = lx * sinR + lzBent * cosR;
      const ryPitch = ly * cosP - rzRolled * sinP;
      const rzPitch = ly * sinP + rzRolled * cosP;
      dv[0] = xShift + rxLocal;
      dv[1] = yShift + ryPitch;
      dv[2] = zShift + rzPitch;
    }
    out[outIdx++] = slot;
  }
  return outIdx;
}

// Corte
function applyTijerasFrame(basePolygons, state) {
  const parts = getArticulatedScissors(basePolygons);
  const t = state.progress * Math.PI * 2;
  const bobZ = levitationBob(state.time, parts.scale);
  const scroll = Math.min(1, Math.max(0, state.scrollIntensity));
  const closeT = easeInOutCubic(Math.min(1, scroll / 0.48));
  const idleBreath = Math.sin(t * 2) * ((2 * Math.PI) / 180) * (1 - closeT);
  const halfAngle = SCISSORS.openHalfAngleRad * (1 - closeT) + idleBreath;
  const fallProgress = scroll <= 0.48 ? 0 : (scroll - 0.48) / 0.52;
  const out = new Array(parts.totalCount);
  let outIdx = 0;
  const pivPolys = parts.pivotPolys;
  const pivPool = parts.pivotPool;
  for (let i = 0; i < pivPolys.length; i++) {
    const svs = pivPolys[i].vertices;
    const slot = pivPool[i];
    const dvs = slot.vertices;
    for (let j = 0; j < svs.length; j++) {
      dvs[j][0] = svs[j][0];
      dvs[j][1] = svs[j][1];
      dvs[j][2] = svs[j][2] + bobZ;
    }
    out[outIdx++] = slot;
  }
  outIdx = transformBladePolygons(parts.bladeAPolys, parts.bladeAPool, parts.pivotPoint, halfAngle, bobZ, out, outIdx);
  outIdx = transformBladePolygons(parts.bladeBPolys, parts.bladeBPool, parts.pivotPoint, -halfAngle, bobZ, out, outIdx);
  outIdx = transformFilmHalfPolygons(
    parts.filmLeftPolys,
    parts.filmLeftPool,
    parts.filmCutOrigin,
    -1,
    fallProgress,
    t,
    bobZ,
    parts.scale,
    out,
    outIdx,
  );
  transformFilmHalfPolygons(
    parts.filmRightPolys,
    parts.filmRightPool,
    parts.filmCutOrigin,
    1,
    fallProgress,
    t,
    bobZ,
    parts.scale,
    out,
    outIdx,
  );
  return out;
}

// Estado
let _tijerasBase = null;
let _tijerasRoot = null;

export function crearTijeras() {
  if (!_tijerasRoot) {
    _tijerasRoot = buildTijerasFilmBase();
    _tijerasBase = extractRawGlyphPolygons(_tijerasRoot);
  }
  return {
    root: _tijerasRoot,
    kind: 'tijeras',
    duration: SCISSORS_ANIMATION_DURATION,
    animated: true,
    fitStates: [0, 0.12],
    update() {},
    frame() {},
    buildFrame(state) {
      const progress = (((state.time / SCISSORS_ANIMATION_DURATION) % 1) + 1) % 1;
      return applyTijerasFrame(_tijerasBase, {
        progress,
        time: state.time,
        scrollIntensity: state.scrollIntensity,
      });
    },
  };
}
