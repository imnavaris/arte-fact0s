#!/usr/bin/env node
// Controles
import { readFileSync } from "node:fs";

const src = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const geo = src("src/geometry.js");
const mainJs = src("src/main.js");
const stage = src("src/glyph-stage.js");

let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`OK   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAILED ${name}: ${err.message}`);
  }
};
const eq = (got, want, what) => {
  if (!Object.is(got, want)) throw new Error(`${what}: expected ${want}, got ${got}`);
};
const grab = (text, re, what) => {
  const m = text.match(re);
  if (!m) throw new Error(`${what} not found`);
  return m[1];
};
const fnOf = (args, body) => new Function(...args, body);

check("axis map (wx,wy,wz)->(wx-cx,-wz-cy,wy-cz)", () => {
  if (!geo.includes("_vBuf[o] = wx - cx;") || !geo.includes("_vBuf[o + 1] = -wz - cy;") || !geo.includes("_vBuf[o + 2] = wy - cz;")) {
    throw new Error("Y-up to Z-up axis mapping missing in geometry.js");
  }
});

check("freeze window is 0.05..0.82", () => {
  eq(Number(grab(mainJs, /const FREEZE_LO = (-?[\d.]+);/, "FREEZE_LO")), 0.05, "FREEZE_LO");
  eq(Number(grab(mainJs, /const FREEZE_HI = (-?[\d.]+);/, "FREEZE_HI")), 0.82, "FREEZE_HI");
});

check("stateOf freezes below 0.05 and holds at/above 0.82", () => {
  const clampSrc = grab(mainJs, /const clamp = \(v, lo, hi\) => (\([^;]+\));/, "clamp");
  const clamp = fnOf(["v", "lo", "hi"], `return ${clampSrc};`);
  const lo = Number(grab(mainJs, /const FREEZE_LO = (-?[\d.]+);/, "FREEZE_LO"));
  const hi = Number(grab(mainJs, /const FREEZE_HI = (-?[\d.]+);/, "FREEZE_HI"));
  const body = grab(mainJs, /function stateOf\(p\) \{\s*return (.+?);\s*\}/s, "stateOf");
  const stateOf = fnOf(["p", "FREEZE_LO", "FREEZE_HI", "clamp"], `return ${body};`);
  const at = (p) => stateOf(p, lo, hi, clamp);
  eq(at(lo), 0, "stateOf(0.05)");
  eq(at(0), 0, "stateOf(0)");
  eq(at(hi), 1, "stateOf(0.82)");
  eq(at(1), 1, "stateOf(1)");
  if (Math.abs(at((lo + hi) / 2) - 0.5) > 1e-9) throw new Error("stateOf(midpoint) not 0.5");
  eq(at(lo - 0.01), 0, "stateOf(0.04)");
  if (!(at(hi - 0.01) > 0.98 && at(hi - 0.01) < 1)) throw new Error("stateOf(0.81) not near 1");
});

check("setBurn clamps to 0..1", () => {
  const expr = grab(stage, /setBurn\(value\) \{\s*const b = (.+?);\r?\n/, "setBurn clamp");
  const burnClamp = fnOf(["value"], `return (${expr});`);
  eq(burnClamp(-1), 0, "setBurn(-1)");
  eq(burnClamp(0), 0, "setBurn(0)");
  eq(burnClamp(2), 1, "setBurn(2)");
  eq(burnClamp(1), 1, "setBurn(1)");
  eq(burnClamp(0.4), 0.4, "setBurn(0.4)");
});

check("LUTs deferred past import", () => {
  for (const name of ["TV_BAND", "TV_GRAY", "FIRE_COLORS"]) {
    if (new RegExp(`^const ${name}\\b`, "m").test(stage)) throw new Error(`${name} built at import`);
  }
  if (/^Array\.from\(/m.test(stage)) throw new Error("top-level Array.from found in glyph-stage.js");
  for (const [getter, callRe] of [
    ["tvBand", /tvBand\(\)/],
    ["tvGray", /tvGray\(\)/],
    ["fireColors", /fireColors\(\)/],
  ]) {
    if (!new RegExp(`function ${getter}\\(`).test(stage)) throw new Error(`${getter}() missing`);
    if (!callRe.test(stage)) throw new Error(`${getter}() not used at call site`);
  }
});

if (failed) {
  console.log(`FAILED ${failed} check(s)`);
  process.exit(1);
}
console.log("OK   all checks passed");
