(function () {
"use strict";

// ---------- 随机数与噪声 ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERM = new Uint8Array(512);
{
  const rand = mulberry32(1337);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

function grad2(hash, x, y) {
  switch (hash & 7) {
    case 0: return x + y;
    case 1: return x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

function noise2(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x);
  const v = fade(y);
  const aa = PERM[PERM[X] + Y];
  const ab = PERM[PERM[X] + Y + 1];
  const ba = PERM[PERM[X + 1] + Y];
  const bb = PERM[PERM[X + 1] + Y + 1];
  const x1 = lerp(grad2(aa, x, y), grad2(ba, x - 1, y), u);
  const x2 = lerp(grad2(ab, x, y - 1), grad2(bb, x - 1, y - 1), u);
  return lerp(x1, x2, v) * 0.7071;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function fbm(x, y, opts) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  const oct = Math.max(1, Math.min(8, Math.round(opts.octaves)));
  for (let i = 0; i < oct; i++) {
    sum += amp * noise2(x * freq, y * freq);
    norm += amp;
    amp *= opts.persistence;
    freq *= opts.lacunarity;
  }
  return sum / norm;
}

function ridgedFbm(x, y, opts) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  const oct = Math.max(1, Math.min(8, Math.round(opts.octaves)));
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise2(x * freq, y * freq));
    sum += amp * n * n;
    norm += amp;
    amp *= opts.persistence;
    freq *= opts.lacunarity;
  }
  return sum / norm;
}

// ---------- 颜色工具与调色板生成 ----------
function hexToRgb(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(rgb) {
  const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + to(rgb.r) + to(rgb.g) + to(rgb.b);
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255 };
}

const COLOR_TEMPLATES = [
  "Vibrant", "Random", "Warm", "Cool", "Dark", "Light",
  "Complementary", "Analogous", "Triadic", "Monochromatic",
];

function generatePalette(template, count, seed) {
  if (seed === undefined) seed = Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);
  const colors = [];
  const baseHue = rand() * 360;
  const push = (h, s, l) => colors.push(rgbToHex(hslToRgb(h, s, l)));
  switch (template) {
    case "Vibrant":
      for (let i = 0; i < count; i++)
        push(baseHue + i * (360 / count) + rand() * 24 - 12, 0.75 + rand() * 0.25, 0.5 + rand() * 0.15);
      break;
    case "Random":
      for (let i = 0; i < count; i++)
        push(rand() * 360, 0.4 + rand() * 0.6, 0.3 + rand() * 0.5);
      break;
    case "Warm":
      for (let i = 0; i < count; i++)
        push(rand() * 70 - 10, 0.7 + rand() * 0.3, 0.45 + rand() * 0.25);
      break;
    case "Cool":
      for (let i = 0; i < count; i++)
        push(160 + rand() * 140, 0.55 + rand() * 0.4, 0.4 + rand() * 0.3);
      break;
    case "Dark":
      for (let i = 0; i < count; i++)
        push(rand() * 360, 0.3 + rand() * 0.5, 0.06 + rand() * 0.2);
      break;
    case "Light":
      for (let i = 0; i < count; i++)
        push(rand() * 360, 0.35 + rand() * 0.4, 0.72 + rand() * 0.22);
      break;
    case "Complementary": {
      const comp = baseHue + 180;
      for (let i = 0; i < count; i++) {
        const h = i % 2 === 0 ? baseHue : comp;
        push(h + rand() * 30 - 15, 0.6 + rand() * 0.35, 0.35 + rand() * 0.35);
      }
      break;
    }
    case "Analogous":
      for (let i = 0; i < count; i++)
        push(baseHue + (i / Math.max(1, count - 1)) * 60 - 30, 0.6 + rand() * 0.3, 0.4 + rand() * 0.3);
      break;
    case "Triadic":
      for (let i = 0; i < count; i++)
        push(baseHue + (i % 3) * 120 + rand() * 16 - 8, 0.6 + rand() * 0.3, 0.4 + rand() * 0.3);
      break;
    case "Monochromatic":
      for (let i = 0; i < count; i++)
        push(baseHue + rand() * 10 - 5, 0.35 + rand() * 0.45, 0.15 + (i / Math.max(1, count - 1)) * 0.7);
      break;
  }
  return colors;
}

// 采样多色标渐变；stops 需按 pos 排序，返回 0-255 RGB
function sampleGradient(stops, t, smoothing) {
  if (stops.length === 0) return { r: 0, g: 0, b: 0 };
  if (stops.length === 1) return stops[0].rgb;
  if (t <= stops[0].pos) return stops[0].rgb;
  if (t >= stops[stops.length - 1].pos) return stops[stops.length - 1].rgb;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t >= a.pos && t <= b.pos) {
      let f = (t - a.pos) / Math.max(1e-6, b.pos - a.pos);
      if (smoothing) f = f * f * f * (f * (f * 6 - 15) + 10);
      return {
        r: a.rgb.r + (b.rgb.r - a.rgb.r) * f,
        g: a.rgb.g + (b.rgb.g - a.rgb.g) * f,
        b: a.rgb.b + (b.rgb.b - a.rgb.b) * f,
      };
    }
  }
  return stops[stops.length - 1].rgb;
}

// ---------- 混合模式 ----------
const BLEND_MODES = [
  "Average", "Multiply", "Screen", "Overlay", "Soft Light", "Hard Light",
  "Difference", "Exclusion", "Darken", "Lighten", "Color Burn", "Color Dodge",
];

const OVERLAY_BLEND_MODES = [
  "Multiply", "Screen", "Overlay", "Soft Light", "Hard Light",
  "Difference", "Exclusion", "Darken", "Lighten", "Color Burn", "Color Dodge",
];

function blendScalar(a, b, mode) {
  switch (mode) {
    case "Average": return (a + b) / 2;
    case "Multiply": return a * b;
    case "Screen": return 1 - (1 - a) * (1 - b);
    case "Overlay": return a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
    case "Soft Light":
      return b < 0.5
        ? a - (1 - 2 * b) * a * (1 - a)
        : a + (2 * b - 1) * (Math.sqrt(Math.max(0, a)) - a);
    case "Hard Light": return b < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
    case "Difference": return Math.abs(a - b);
    case "Exclusion": return a + b - 2 * a * b;
    case "Darken": return Math.min(a, b);
    case "Lighten": return Math.max(a, b);
    case "Color Burn": return b <= 0 ? 0 : clamp01(1 - (1 - a) / b);
    case "Color Dodge": return b >= 1 ? 1 : clamp01(a / (1 - b));
    default: return (a + b) / 2;
  }
}

function toCompositeOp(mode) {
  switch (mode) {
    case "Multiply": return "multiply";
    case "Screen": return "screen";
    case "Overlay": return "overlay";
    case "Soft Light": return "soft-light";
    case "Hard Light": return "hard-light";
    case "Difference": return "difference";
    case "Exclusion": return "exclusion";
    case "Darken": return "darken";
    case "Lighten": return "lighten";
    case "Color Burn": return "color-burn";
    case "Color Dodge": return "color-dodge";
    default: return "source-over";
  }
}

// ---------- 状态结构 / 默认值 / 随机化 ----------
const DISTORTION_TYPES = ["Organic", "Ridged Noise", "Waves", "Kura", "Tayu"];
const PATTERN_TYPES = ["Dot (grid)", "Line"];

function defaultXCurve() {
  return {
    p0: { x: 0.0, y: 0.52 },
    p1: { x: 0.35, y: 0.28 },
    p2: { x: 0.7, y: 0.42 },
    p3: { x: 1.0, y: 0.36 },
  };
}

function defaultYCurve() {
  return {
    p0: { x: 0.35, y: 0.0 },
    p1: { x: 0.25, y: 0.3 },
    p2: { x: 0.42, y: 0.62 },
    p3: { x: 0.68, y: 1.0 },
  };
}

function randomCurve(rand, horizontal) {
  const r = (min, max) => min + rand() * (max - min);
  if (horizontal) {
    return {
      p0: { x: 0, y: r(0.2, 0.8) },
      p1: { x: r(0.15, 0.45), y: r(0.05, 0.95) },
      p2: { x: r(0.55, 0.85), y: r(0.05, 0.95) },
      p3: { x: 1, y: r(0.2, 0.8) },
    };
  }
  return {
    p0: { x: r(0.2, 0.8), y: 0 },
    p1: { x: r(0.05, 0.95), y: r(0.15, 0.45) },
    p2: { x: r(0.05, 0.95), y: r(0.55, 0.85) },
    p3: { x: r(0.2, 0.8), y: 1 },
  };
}

function stopsFromPalette(palette) {
  const n = palette.length;
  return palette.map((hex, i) => ({ hex, pos: n === 1 ? 0.5 : i / (n - 1) }));
}

function createDefaultState() {
  const palette = generatePalette("Vibrant", 5, 20240607);
  return {
    width: 1460,
    height: 910,
    globalBlend: "Difference",
    feather: 18,
    noise: 6,
    colors: stopsFromPalette(palette),
    selectedColor: 0,
    colorTemplate: "Vibrant",
    amount: 5,
    distortion: {
      enabled: false,
      expanded: false,
      type: "Organic",
      intensity: 2,
      scale: 0.5,
      seed: 0,
      octaves: 1,
      lacunarity: 1.5,
      persistence: 0.3,
      warp: 2.6,
      relief: 0,
    },
    glitter: {
      enabled: true,
      expanded: true,
      density: 30,
      sizeMin: 0.5,
      sizeMax: 3,
      opacity: 100,
      blend: "Normal",
    },
    patterns: {
      enabled: false,
      expanded: false,
      type: "Dot (grid)",
      dotSize: 3,
      distance: 24,
      color: "#ffffff",
      opacity: 100,
      blend: "Normal",
    },
    beta: { expanded: false, animated: false, speed: 1, symmetry: false },
    curves: {
      active: "x",
      x: defaultXCurve(),
      y: defaultYCurve(),
      smoothing: true,
      visible: true,
      inverted: false,
    },
    resolution: 1,
    format: "PNG",
  };
}

function randomizeColors(state) {
  return stopsFromPalette(generatePalette(state.colorTemplate, state.amount));
}

function randomizeAll(state) {
  const seed = Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);
  const templates = [
    "Vibrant", "Warm", "Cool", "Dark", "Light", "Complementary", "Analogous", "Triadic", "Monochromatic",
  ];
  const template = templates[Math.floor(rand() * templates.length)];
  const amount = 3 + Math.floor(rand() * 5);
  return Object.assign({}, state, {
    globalBlend: BLEND_MODES[Math.floor(rand() * BLEND_MODES.length)],
    feather: Math.round(rand() * 40 + 4),
    noise: Math.round(rand() * 14),
    colorTemplate: template,
    amount: amount,
    colors: stopsFromPalette(generatePalette(template, amount, seed + 7)),
    selectedColor: 0,
    curves: Object.assign({}, state.curves, {
      x: randomCurve(rand, true),
      y: randomCurve(rand, false),
      inverted: rand() > 0.7,
    }),
  });
}

// ---------- 精选模板 ----------
const grad = (hexes) => hexes.map((h, i) => ({ hex: h, pos: hexes.length === 1 ? 0.5 : i / (hexes.length - 1) }));

const TEMPLATES = [
  {
    name: "Aurora",
    make: () => ({
      colors: grad(["#06121f", "#0e5e4a", "#3ddc84", "#b8f7d4", "#123c2b"]),
      globalBlend: "Screen", feather: 30, noise: 8,
      distortion: Object.assign(createDefaultState().distortion, { enabled: true, type: "Waves", intensity: 3, scale: 0.8, octaves: 2 }),
      glitter: Object.assign(createDefaultState().glitter, { enabled: true, density: 45 }),
    }),
  },
  {
    name: "Ember",
    make: () => ({
      colors: grad(["#1a0500", "#7a1802", "#e84e0f", "#ffb347", "#2b0a00"]),
      globalBlend: "Multiply", feather: 14, noise: 10,
      distortion: Object.assign(createDefaultState().distortion, { enabled: true, type: "Ridged Noise", intensity: 3.4, scale: 0.9, octaves: 3 }),
    }),
  },
  {
    name: "Lagoon",
    make: () => ({
      colors: grad(["#03203c", "#0a6aa8", "#3fd2e0", "#c9f7ef", "#084d6e"]),
      globalBlend: "Soft Light", feather: 24, noise: 5,
      curves: Object.assign(createDefaultState().curves, { inverted: false }),
    }),
  },
  {
    name: "Mono",
    make: () => ({
      colors: grad(["#0a0a0a", "#3a3a3a", "#9a9a9a", "#e8e8e8"]),
      globalBlend: "Difference", feather: 12, noise: 4,
      distortion: Object.assign(createDefaultState().distortion, { enabled: true, type: "Kura", intensity: 2.4, scale: 0.6, octaves: 2 }),
      glitter: Object.assign(createDefaultState().glitter, { enabled: false }),
    }),
  },
  {
    name: "Candy",
    make: () => ({
      colors: grad(["#ff5ea8", "#ffd166", "#7bf1a8", "#5ea8ff", "#c77bff"]),
      globalBlend: "Lighten", feather: 34, noise: 3,
      curves: Object.assign(createDefaultState().curves, { inverted: false }),
    }),
  },
  {
    name: "Nebula",
    make: () => ({
      colors: grad(["#0b0033", "#4b1d8f", "#b14aed", "#ff7ad9", "#05001a"]),
      globalBlend: "Screen", feather: 26, noise: 12,
      distortion: Object.assign(createDefaultState().distortion, { enabled: true, type: "Organic", intensity: 2.8, scale: 0.45, octaves: 4, persistence: 0.5 }),
      glitter: Object.assign(createDefaultState().glitter, { enabled: true, density: 60, sizeMax: 2.4 }),
    }),
  },
  {
    name: "Solar",
    make: () => ({
      colors: grad(["#2b1000", "#c2360d", "#ff8a00", "#ffe45e", "#fff6c8"]),
      globalBlend: "Color Dodge", feather: 20, noise: 7,
    }),
  },
  {
    name: "Forest",
    make: () => ({
      colors: grad(["#04180b", "#14532d", "#3f8f3a", "#a3d95b", "#e8f7b0"]),
      globalBlend: "Overlay", feather: 22, noise: 6,
    }),
  },
  {
    name: "Velvet",
    make: () => ({
      colors: grad(["#12001f", "#4a0e4e", "#8f2d56", "#d65f7a", "#ffb4a2"]),
      globalBlend: "Hard Light", feather: 16, noise: 9,
      distortion: Object.assign(createDefaultState().distortion, { enabled: true, type: "Tayu", intensity: 2, scale: 1.1, octaves: 2 }),
    }),
  },
  {
    name: "Frost",
    make: () => ({
      colors: grad(["#dceefb", "#a8d4f0", "#5ea8dd", "#1f5f9e", "#0a2a4a"]),
      globalBlend: "Exclusion", feather: 28, noise: 4,
    }),
  },
  {
    name: "Magma",
    make: () => ({
      colors: grad(["#000000", "#3d0000", "#a80f00", "#ff5e00", "#ffd23e"]),
      globalBlend: "Difference", feather: 10, noise: 11,
      distortion: Object.assign(createDefaultState().distortion, { enabled: true, type: "Ridged Noise", intensity: 4, scale: 1.3, octaves: 4, warp: 3.4 }),
    }),
  },
  {
    name: "Peach",
    make: () => ({
      colors: grad(["#ff9a8b", "#ffc3a0", "#ffe0d1", "#ff6f91", "#c94b6d"]),
      globalBlend: "Average", feather: 32, noise: 5,
    }),
  },
];

// ---------- 分享（URL hash 编码） ----------
function encodeState(state) {
  try {
    const json = JSON.stringify(state);
    return btoa(unescape(encodeURIComponent(json)));
  } catch (e) {
    return "";
  }
}

function decodeState(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json);
    const def = createDefaultState();
    return Object.assign({}, def, parsed, {
      distortion: Object.assign({}, def.distortion, parsed.distortion),
      glitter: Object.assign({}, def.glitter, parsed.glitter),
      patterns: Object.assign({}, def.patterns, parsed.patterns),
      beta: Object.assign({}, def.beta, parsed.beta),
      curves: Object.assign({}, def.curves, parsed.curves),
    });
  } catch (e) {
    return null;
  }
}

// ---------- 渲染引擎（Canvas 2D CPU 光栅化） ----------
const LUT_SIZE = 512;

function cubic(c, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const d = 3 * mt * t * t;
  const e = t * t * t;
  return {
    x: a * c.p0.x + b * c.p1.x + d * c.p2.x + e * c.p3.x,
    y: a * c.p0.y + b * c.p1.y + d * c.p2.y + e * c.p3.y,
  };
}

function buildXToY(c) {
  const lut = new Float32Array(LUT_SIZE).fill(-1);
  const N = 1024;
  for (let i = 0; i <= N; i++) {
    const p = cubic(c, i / N);
    const idx = Math.min(LUT_SIZE - 1, Math.max(0, Math.round(p.x * (LUT_SIZE - 1))));
    lut[idx] = p.y;
  }
  let last = 0.5;
  for (let i = 0; i < LUT_SIZE; i++) {
    if (lut[i] >= 0) last = lut[i];
    else lut[i] = last;
  }
  last = lut[LUT_SIZE - 1];
  for (let i = LUT_SIZE - 1; i >= 0; i--) {
    if (lut[i] >= 0) last = lut[i];
    else lut[i] = last;
  }
  return lut;
}

function buildYToX(c) {
  const lut = new Float32Array(LUT_SIZE).fill(-1);
  const N = 1024;
  for (let i = 0; i <= N; i++) {
    const p = cubic(c, i / N);
    const idx = Math.min(LUT_SIZE - 1, Math.max(0, Math.round(p.y * (LUT_SIZE - 1))));
    lut[idx] = p.x;
  }
  let last = 0.5;
  for (let i = 0; i < LUT_SIZE; i++) {
    if (lut[i] >= 0) last = lut[i];
    else lut[i] = last;
  }
  last = lut[LUT_SIZE - 1];
  for (let i = LUT_SIZE - 1; i >= 0; i--) {
    if (lut[i] >= 0) last = lut[i];
    else lut[i] = last;
  }
  return lut;
}

function sampleLut(lut, t) {
  const f = clamp01(t) * (LUT_SIZE - 1);
  const i = Math.floor(f);
  const frac = f - i;
  const a = lut[i];
  const b = lut[Math.min(LUT_SIZE - 1, i + 1)];
  return a + (b - a) * frac;
}

let grainTile = null;
function getGrainTile() {
  if (!grainTile) {
    const S = 256;
    grainTile = new Float32Array(S * S);
    const rand = mulberry32(987654);
    for (let i = 0; i < S * S; i++) grainTile[i] = rand();
  }
  return grainTile;
}

// 周期化 fBm：沿圆形路径采样噪声，phase=0 与 phase=2π 的场完全一致（无缝循环）
function fbmLoop(x, y, phase, radius, opts) {
  return (
    fbm(x + Math.cos(phase) * radius, y + Math.sin(phase) * radius, opts) * 0.72 +
    fbm(x - Math.sin(phase) * radius * 0.9, y + Math.cos(phase) * radius * 0.9, opts) * 0.28
  );
}

function ridgedLoop(x, y, phase, radius, opts) {
  return (
    ridgedFbm(x + Math.cos(phase) * radius, y + Math.sin(phase) * radius, opts) * 0.72 +
    ridgedFbm(x - Math.sin(phase) * radius * 0.9, y + Math.cos(phase) * radius * 0.9, opts) * 0.28
  );
}

function applyDistortion(u, v, p) {
  const s = Math.max(0.05, p.scale) * 4;
  const x = u * s + p.seed * 13.37;
  const y = v * s + p.seed * 7.77;
  const amp = p.intensity * 0.012 * Math.max(0.2, p.warp * 0.5);
  const opts = { octaves: p.octaves, lacunarity: p.lacunarity, persistence: p.persistence };
  const ph = p.phase;
  const R = 2.2;
  switch (p.type) {
    case "Organic": {
      const dx = fbmLoop(x, y, ph, R, opts);
      const dy = fbmLoop(x + 31.4, y, ph, R, opts);
      return [u + dx * amp, v + dy * amp];
    }
    case "Ridged Noise": {
      const dx = ridgedLoop(x, y, ph, R, opts) - 0.5;
      const dy = ridgedLoop(x + 17.2, y, ph, R, opts) - 0.5;
      return [u + dx * amp * 2, v + dy * amp * 2];
    }
    case "Waves": {
      const f = Math.max(0.05, p.scale);
      const dx = Math.sin(v * f * 22 + p.seed * 10 + ph) * p.intensity * 0.01;
      const dy = Math.cos(u * f * 18 + p.seed * 6 + ph * 1.2) * p.intensity * 0.01;
      return [u + dx, v + dy];
    }
    case "Kura": {
      const cx = u - 0.5, cy = v - 0.5;
      const r = Math.sqrt(cx * cx + cy * cy) + 1e-5;
      const n = fbmLoop(x, y, ph, R, opts);
      const ang = n * p.intensity * 0.35 / (r * 3 + 0.4) + ph * 0.12;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      return [0.5 + cx * cos - cy * sin, 0.5 + cx * sin + cy * cos];
    }
    case "Tayu": {
      const f = Math.max(0.05, p.scale) * 8;
      const gx = Math.floor(u * f), gy = Math.floor(v * f);
      const h = noise2(gx * 0.7 + p.seed, gy * 0.7);
      const jit = fbmLoop(x * 2, y * 2, ph, R, opts);
      const dx = h * p.intensity * 0.015 + jit * p.intensity * 0.006;
      const dy = noise2(gx * 0.7, gy * 0.7 + p.seed) * p.intensity * 0.015 +
        fbmLoop(x * 2 + 9, y * 2, ph, R, opts) * p.intensity * 0.006;
      return [u + dx, v + dy];
    }
    default:
      return [u, v];
  }
}

function distortParams(d, time) {
  return {
    type: d.type,
    intensity: d.intensity,
    scale: d.scale,
    seed: d.seed,
    octaves: d.octaves,
    lacunarity: d.lacunarity,
    persistence: d.persistence,
    warp: d.warp,
    phase: ((time || 0) * Math.PI * 2 * 0.22) % (Math.PI * 2),
  };
}

function sortedStops(state) {
  return state.colors
    .map((s) => ({ rgb: hexToRgb(s.hex), pos: s.pos }))
    .sort((a, b) => a.pos - b.pos);
}

function renderGradient(canvas, state, opts) {
  opts = opts || {};
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || W === 0 || H === 0) return;

  const lutX = buildXToY(state.curves.x);
  const lutY = buildYToX(state.curves.y);
  const stops = sortedStops(state);
  const smoothing = state.curves.smoothing;

  const span = stops.length >= 2 ? stops[stops.length - 1].pos - stops[0].pos : 1;
  const pos0 = stops.length ? stops[0].pos : 0;
  // 调色板往返流动（前进再镜像返回），动画无接缝
  const period = 2 * span;
  const sampleFlow = (f) => {
    let t = (f - pos0) % period;
    if (t < 0) t += period;
    if (t > span) t = period - t;
    return sampleGradient(stops, pos0 + t, smoothing);
  };

  const img = ctx.createImageData(W, H);
  const data = img.data;
  const feather = 0.005 + (state.feather / 200) * 1.4;
  const grain = getGrainTile();
  const grainAmt = state.noise / 100;
  const grainOff = (opts.grainSeed != null ? opts.grainSeed : 1) * 7919;
  const d = state.distortion;
  const distortOn = d.enabled;
  const dp = distortParams(d, opts.time || 0);
  const relief = d.enabled ? d.relief / 100 : 0;
  const inv = state.curves.inverted;
  const aspect = W / H;
  const gradFlow = opts.time ? (opts.time * 0.22 * span) % period : 0;

  // 在粗网格上预计算扭曲位移，逐像素双线性插值（约 16 倍提速，视觉上等价）
  let duGrid = null, dvGrid = null;
  let gw = 0, gh = 0, gstride = 1;
  if (distortOn) {
    gstride = Math.max(2, Math.round(W / 320));
    gw = Math.ceil(W / gstride) + 1;
    gh = Math.ceil(H / gstride) + 1;
    duGrid = new Float32Array(gw * gh);
    dvGrid = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
      const gv = Math.min(1, (gy * gstride) / H);
      for (let gx = 0; gx < gw; gx++) {
        const gu = Math.min(1, (gx * gstride) / W);
        const dd = applyDistortion(gu, gv, dp);
        const o = gy * gw + gx;
        duGrid[o] = dd[0] - gu;
        dvGrid[o] = dd[1] - gv;
      }
    }
  }

  const symmetry = state.beta.symmetry;
  const aspectFix = 1 / Math.max(0.6, 1 / aspect);
  for (let y = 0; y < H; y++) {
    const v0 = y / H;
    const gyf = y / gstride;
    const gy0 = Math.min(gh - 2, Math.floor(gyf));
    const gty = gyf - gy0;
    for (let x = 0; x < W; x++) {
      let u = x / W;
      let v = v0;
      if (duGrid && dvGrid) {
        const gxf = x / gstride;
        const gx0 = Math.min(gw - 2, Math.floor(gxf));
        const gtx = gxf - gx0;
        const i00 = gy0 * gw + gx0;
        const i10 = i00 + 1;
        const i01 = i00 + gw;
        const i11 = i01 + 1;
        const w00 = (1 - gtx) * (1 - gty), w10 = gtx * (1 - gty);
        const w01 = (1 - gtx) * gty, w11 = gtx * gty;
        u += duGrid[i00] * w00 + duGrid[i10] * w10 + duGrid[i01] * w01 + duGrid[i11] * w11;
        v += dvGrid[i00] * w00 + dvGrid[i10] * w10 + dvGrid[i01] * w01 + dvGrid[i11] * w11;
      }
      if (symmetry) {
        u = u < 0.5 ? u : 1 - u;
      }
      const dA = (v - sampleLut(lutX, u)) * aspectFix;
      const dB = u - sampleLut(lutY, v);
      const a = smoothstep(-feather, feather, dA);
      const b = smoothstep(-feather, feather, dB);
      let f = blendScalar(a, b, state.globalBlend);
      if (inv) f = 1 - f;
      let rgb = gradFlow !== 0 ? sampleFlow(f + gradFlow) : sampleGradient(stops, f, smoothing);
      if (relief > 0) {
        const n = noise2(u * 60, v * 60) * 0.5 + noise2(u * 140, v * 140) * 0.5;
        const l = 1 + n * relief * 0.9;
        rgb = { r: rgb.r * l, g: rgb.g * l, b: rgb.b * l };
      }
      let r = rgb.r, g = rgb.g, bch = rgb.b;
      if (grainAmt > 0) {
        const gidx = (((y + grainOff) & 255) << 8) | ((x + grainOff) & 255);
        const gr = (grain[gidx] - 0.5) * 2 * grainAmt * 48;
        r += gr; g += gr; bch += gr;
      }
      const o = (y * W + x) * 4;
      data[o] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[o + 2] = bch < 0 ? 0 : bch > 255 ? 255 : bch;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  if (state.glitter.enabled) {
    drawGlitter(ctx, W, H, state, opts.grainSeed != null ? opts.grainSeed : 1);
  }
  if (state.patterns.enabled) {
    drawPattern(ctx, W, H, state);
  }
}

function drawGlitter(ctx, W, H, state, seed) {
  const g = state.glitter;
  const rand = mulberry32(seed * 31337 + Math.round(g.density * 7 + g.sizeMin * 13 + g.sizeMax * 17));
  const count = Math.round((g.density / 100) * (W * H) / 900);
  ctx.save();
  ctx.globalCompositeOperation = toCompositeOp(g.blend);
  ctx.globalAlpha = clamp01(g.opacity / 100);
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const size = lerp(Math.min(g.sizeMin, g.sizeMax), Math.max(g.sizeMin, g.sizeMax), rand());
    const bright = 200 + Math.floor(rand() * 55);
    const warm = rand() > 0.5;
    ctx.fillStyle = warm
      ? "rgb(" + bright + "," + bright + "," + Math.floor(bright * 0.85) + ")"
      : "rgb(" + bright + "," + bright + "," + bright + ")";
    const scale = W / 900;
    const r = Math.max(0.3, size * scale * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPattern(ctx, W, H, state) {
  const p = state.patterns;
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const octx = off.getContext("2d");
  if (!octx) return;
  const scale = W / 900;
  const dist = Math.max(4, p.distance * scale);
  const size = Math.max(0.5, p.dotSize * scale);
  octx.fillStyle = p.color;
  octx.strokeStyle = p.color;
  if (p.type === "Dot (grid)") {
    for (let y = dist / 2; y < H; y += dist) {
      for (let x = dist / 2; x < W; x += dist) {
        octx.beginPath();
        octx.arc(x, y, size / 2, 0, Math.PI * 2);
        octx.fill();
      }
    }
  } else {
    octx.lineWidth = size;
    for (let y = dist / 2; y < H; y += dist) {
      octx.beginPath();
      octx.moveTo(0, y);
      octx.lineTo(W, y);
      octx.stroke();
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = toCompositeOp(p.blend);
  ctx.globalAlpha = clamp01(p.opacity / 100);
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

// 大导出分带异步渲染，避免冻结 UI。
// 修复：原作分带路径只画基础渐变场，导出结果丢失 glitter / pattern 覆盖层；
// 这里在所有带拼合完成后补画两层覆盖层，与整幅渲染路径的输出一致。
async function renderGradientAsync(canvas, state, onProgress) {
  const W = canvas.width;
  const H = canvas.height;
  if (W * H <= 2000000) {
    renderGradient(canvas, state, {});
    if (onProgress) onProgress(1);
    return;
  }
  const band = Math.max(64, Math.floor(2000000 / W));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const tmp = document.createElement("canvas");
  tmp.width = W;
  for (let y0 = 0; y0 < H; y0 += band) {
    const bh = Math.min(band, H - y0);
    tmp.height = bh;
    renderBand(tmp, state, y0 / H, (y0 + bh) / H);
    ctx.drawImage(tmp, 0, y0);
    if (onProgress) onProgress((y0 + bh) / H);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (state.glitter.enabled) drawGlitter(ctx, W, H, state, 1);
  if (state.patterns.enabled) drawPattern(ctx, W, H, state);
}

// 只渲染整幅画面垂直区间 [vStart, vEnd) 的一条带到 tmp 画布
function renderBand(tmp, state, vStart, vEnd) {
  const W = tmp.width;
  const H = tmp.height;
  const ctx = tmp.getContext("2d");
  if (!ctx) return;
  const fullH = H / (vEnd - vStart);
  const lutX = buildXToY(state.curves.x);
  const lutY = buildYToX(state.curves.y);
  const stops = sortedStops(state);
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const feather = 0.005 + (state.feather / 200) * 1.4;
  const grain = getGrainTile();
  const grainAmt = state.noise / 100;
  const d = state.distortion;
  const dp = distortParams(d, 0);
  const relief = d.enabled ? d.relief / 100 : 0;
  const inv = state.curves.inverted;
  const smoothing = state.curves.smoothing;
  const fullW = W;
  const aspect = fullW / fullH;
  let duGrid = null, dvGrid = null;
  let gw = 0, gh = 0, gstride = 1;
  if (d.enabled) {
    gstride = Math.max(2, Math.round(W / 320));
    gw = Math.ceil(W / gstride) + 1;
    gh = Math.ceil(H / gstride) + 1;
    duGrid = new Float32Array(gw * gh);
    dvGrid = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
      const gv = vStart + Math.min(1, (gy * gstride) / H) * (vEnd - vStart);
      for (let gx = 0; gx < gw; gx++) {
        const gu = Math.min(1, (gx * gstride) / W);
        const dd = applyDistortion(gu, gv, dp);
        const o = gy * gw + gx;
        duGrid[o] = dd[0] - gu;
        dvGrid[o] = dd[1] - gv;
      }
    }
  }
  const aspectFix = 1 / Math.max(0.6, 1 / aspect);
  for (let y = 0; y < H; y++) {
    const v0 = vStart + (y / H) * (vEnd - vStart);
    const gyf = y / gstride;
    const gy0 = Math.min(gh - 2, Math.floor(gyf));
    const gty = gyf - gy0;
    for (let x = 0; x < W; x++) {
      let u = x / W;
      let v = v0;
      if (duGrid && dvGrid) {
        const gxf = x / gstride;
        const gx0 = Math.min(gw - 2, Math.floor(gxf));
        const gtx = gxf - gx0;
        const i00 = gy0 * gw + gx0;
        const i10 = i00 + 1;
        const i01 = i00 + gw;
        const i11 = i01 + 1;
        const w00 = (1 - gtx) * (1 - gty), w10 = gtx * (1 - gty);
        const w01 = (1 - gtx) * gty, w11 = gtx * gty;
        u += duGrid[i00] * w00 + duGrid[i10] * w10 + duGrid[i01] * w01 + duGrid[i11] * w11;
        v += dvGrid[i00] * w00 + dvGrid[i10] * w10 + dvGrid[i01] * w01 + dvGrid[i11] * w11;
      }
      if (state.beta.symmetry) u = u < 0.5 ? u : 1 - u;
      const dA = (v - sampleLut(lutX, u)) * aspectFix;
      const dB = u - sampleLut(lutY, v);
      const a = smoothstep(-feather, feather, dA);
      const b = smoothstep(-feather, feather, dB);
      let f = blendScalar(a, b, state.globalBlend);
      if (inv) f = 1 - f;
      let rgb = sampleGradient(stops, f, smoothing);
      if (relief > 0) {
        const n = noise2(u * 60, v * 60) * 0.5 + noise2(u * 140, v * 140) * 0.5;
        const l = 1 + n * relief * 0.9;
        rgb = { r: rgb.r * l, g: rgb.g * l, b: rgb.b * l };
      }
      let r = rgb.r, g = rgb.g, bch = rgb.b;
      if (grainAmt > 0) {
        const gy = Math.round(v0 * fullH);
        const gidx = (((gy + 7919) & 255) << 8) | ((x + 7919) & 255);
        const gr = (grain[gidx] - 0.5) * 2 * grainAmt * 48;
        r += gr; g += gr; bch += gr;
      }
      const o = (y * W + x) * 4;
      data[o] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[o + 2] = bch < 0 ? 0 : bch > 255 ? 255 : bch;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- 应用状态 ----------
let state = createDefaultState();
{
  const hash = window.location.hash;
  if (hash.indexOf("#s=") === 0) {
    const decoded = decodeState(hash.slice(3));
    if (decoded) state = decoded;
  }
}

const $ = (id) => document.getElementById(id);
const preview = $("preview");
const canvasArea = $("canvasArea");
const canvasWrap = $("canvasWrap");
const overlaySvg = $("curveOverlay");
const canvasMeta = $("canvasMeta");
const btnExport = $("btnExport");

const syncers = [];
function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

// ---------- 预览尺寸适配（保持宽高比） ----------
const box = { w: 0, h: 0 };
function fitBox() {
  const availW = Math.max(200, canvasArea.clientWidth - 44);
  const availH = Math.max(200, canvasArea.clientHeight - 44);
  const aspect = state.width / state.height;
  let w = availW, h = w / aspect;
  if (h > availH) { h = availH; w = h * aspect; }
  box.w = Math.max(1, Math.round(w));
  box.h = Math.max(1, Math.round(h));
  canvasWrap.style.width = box.w + "px";
  canvasWrap.style.height = box.h + "px";
  preview.style.width = box.w + "px";
  preview.style.height = box.h + "px";
}

// ---------- 渲染调度：40ms 防抖 + 动画 rAF ----------
function renderStatic() {
  if (state.beta.animated || box.w === 0) return;
  const rs = Math.min(1, 900 / box.w);
  preview.width = Math.max(1, Math.round(box.w * rs));
  preview.height = Math.max(1, Math.round(box.h * rs));
  renderGradient(preview, state, { time: 0 });
}

let renderTimer = null;
function scheduleRender() {
  if (state.beta.animated) return;
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => { renderTimer = null; renderStatic(); }, 40);
}

let rafId = 0;
let animTime = 0;
function startAnim() {
  cancelAnimationFrame(rafId);
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    animTime += dt * state.beta.speed;
    if (box.w > 0) {
      const rs = Math.min(0.5, 640 / box.w);
      const w = Math.max(2, Math.round(box.w * rs));
      const h = Math.max(2, Math.round(box.h * rs));
      if (preview.width !== w || preview.height !== h) {
        preview.width = w;
        preview.height = h;
      }
      renderGradient(preview, state, { time: animTime });
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}
function stopAnim() {
  cancelAnimationFrame(rafId);
  rafId = 0;
  scheduleRender();
}

// ---------- 曲线 SVG 覆盖层 ----------
const SVGNS = "http://www.w3.org/2000/svg";
let curveDrag = null;

function pathFor(c) {
  let d = "";
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, mt = 1 - t;
    const x = mt * mt * mt * c.p0.x + 3 * mt * mt * t * c.p1.x + 3 * mt * t * t * c.p2.x + t * t * t * c.p3.x;
    const y = mt * mt * mt * c.p0.y + 3 * mt * mt * t * c.p1.y + 3 * mt * t * t * c.p2.y + t * t * t * c.p3.y;
    d += (i === 0 ? "M" : "L") + (x * box.w).toFixed(1) + "," + (y * box.h).toFixed(1) + " ";
  }
  return d;
}

function updateOverlay() {
  overlaySvg.innerHTML = "";
  if (!state.curves.visible) return;
  ["y", "x"].forEach((key) => {
    const c = state.curves[key];
    const isActive = state.curves.active === key;
    const g = document.createElementNS(SVGNS, "g");
    const path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", pathFor(c));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgba(255,255,255,0.95)");
    path.setAttribute("stroke-width", isActive ? "2.5" : "2");
    if (!isActive) path.setAttribute("stroke-dasharray", "3 7");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("opacity", isActive ? "1" : "0.65");
    g.appendChild(path);
    ["p0", "p1", "p2", "p3"].forEach((name, i) => {
      const p = c[name];
      const isEndpoint = i === 0 || i === 3;
      const circle = document.createElementNS(SVGNS, "circle");
      circle.setAttribute("cx", p.x * box.w);
      circle.setAttribute("cy", p.y * box.h);
      circle.setAttribute("r", isActive ? (isEndpoint ? 7 : 8) : 6);
      circle.setAttribute("fill", isActive ? "#fff" : "rgba(0,0,0,0.35)");
      circle.setAttribute("stroke", "#fff");
      circle.setAttribute("stroke-width", isActive ? "0" : "2");
      circle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        curveDrag = { curve: key, point: name };
      });
      g.appendChild(circle);
    });
    overlaySvg.appendChild(g);
  });
}

window.addEventListener("pointermove", (e) => {
  if (!curveDrag) return;
  const rect = overlaySvg.getBoundingClientRect();
  const u = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const v = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
  state.curves[curveDrag.curve][curveDrag.point] = { x: u, y: v };
  updateOverlay();
  scheduleRender();
});
window.addEventListener("pointerup", () => { curveDrag = null; });

// ---------- 控件 helpers ----------
function makeSlider(parent, def) {
  const step = def.step != null ? def.step : 1;
  const fmt = def.fmt || (step < 0.1
    ? (v) => (+v).toFixed(2)
    : step < 1 ? (v) => (+v).toFixed(1) : (v) => String(Math.round(v)));
  const row = el("div", "slider-row");
  const lab = el("label");
  const name = el("span");
  name.textContent = def.label;
  const val = el("span", "val");
  lab.append(name, val);
  const line = el("div", "slider-line");
  const range = el("input");
  range.type = "range";
  range.min = def.min; range.max = def.max; range.step = step;
  range.setAttribute("aria-label", def.label);
  const num = el("input", "num");
  num.type = "number";
  num.min = def.min; num.max = def.max; num.step = step;
  num.setAttribute("aria-label", def.label + " 数值");
  line.append(range, num);
  row.append(lab, line);
  parent.appendChild(row);
  const show = () => {
    const v = def.get();
    val.textContent = fmt(v);
    range.value = v;
    num.value = fmt(v);
  };
  range.addEventListener("input", () => {
    const v = parseFloat(range.value);
    def.set(v);
    val.textContent = fmt(v);
    num.value = fmt(v);
    (def.after || scheduleRender)();
  });
  num.addEventListener("change", () => {
    const v = parseFloat(num.value);
    if (!isNaN(v)) {
      def.set(Math.min(def.max, Math.max(def.min, v)));
      (def.after || scheduleRender)();
    }
    show();
  });
  syncers.push(show);
  show();
  return row;
}

function fillSelect(sel, options) {
  options.forEach((o) => {
    const op = el("option");
    op.value = o;
    op.textContent = o;
    sel.appendChild(op);
  });
}

function bindSelect(id, get, set, after) {
  const sel = $(id);
  const show = () => { sel.value = get(); };
  sel.addEventListener("change", () => { set(sel.value); (after || scheduleRender)(); });
  syncers.push(show);
  show();
}

function makeSelectRow(parent, label, options, get, set, after) {
  const row = el("div", "row");
  const lab = el("label");
  lab.textContent = label;
  const sel = el("select");
  sel.setAttribute("aria-label", label);
  fillSelect(sel, options);
  const show = () => { sel.value = get(); };
  sel.addEventListener("change", () => { set(sel.value); (after || scheduleRender)(); });
  row.append(lab, sel);
  parent.appendChild(row);
  syncers.push(show);
  show();
  return sel;
}

function bindSwitch(id, get, set, after) {
  const sw = $(id);
  const show = () => sw.setAttribute("aria-checked", String(get()));
  sw.addEventListener("click", () => {
    set(!get());
    show();
    (after || scheduleRender)();
  });
  syncers.push(show);
  show();
}

function makeSwitchRow(parent, def) {
  const row = el("div", "switch-row");
  const lab = el("span");
  lab.textContent = def.label;
  const sw = el("button", "switch");
  sw.type = "button";
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-label", def.label);
  sw.innerHTML = '<span class="knob"></span>';
  const show = () => sw.setAttribute("aria-checked", String(def.get()));
  sw.addEventListener("click", () => {
    def.set(!def.get());
    show();
    (def.after || scheduleRender)();
  });
  row.append(lab, sw);
  parent.appendChild(row);
  syncers.push(show);
  show();
}

const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

function buildCollapse(def) {
  const sec = el("div", "collapse");
  const head = el("div", "collapse-head");
  head.setAttribute("role", "button");
  head.tabIndex = 0;
  const title = el("span", "head-title");
  title.textContent = def.title;
  head.appendChild(title);
  let sw = null;
  if (def.getEnabled) {
    sw = el("button", "switch");
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", def.title + " 开关");
    sw.innerHTML = '<span class="knob"></span>';
    sw.addEventListener("click", (e) => {
      e.stopPropagation();
      def.setEnabled(!def.getEnabled());
      refreshHead();
      scheduleRender();
    });
    head.appendChild(sw);
  }
  const caret = el("span", "caret");
  caret.innerHTML = CHEVRON_SVG;
  head.appendChild(caret);
  const body = el("div", "collapse-body");
  sec.append(head, body);
  function refreshHead() {
    sec.classList.toggle("open", def.getExpanded());
    head.setAttribute("aria-expanded", String(def.getExpanded()));
    if (sw) sw.setAttribute("aria-checked", String(def.getEnabled()));
  }
  const toggle = () => { def.setExpanded(!def.getExpanded()); refreshHead(); };
  head.addEventListener("click", toggle);
  head.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  syncers.push(refreshHead);
  def.build(body);
  refreshHead();
  $("panelDyn").appendChild(sec);
}

// ---------- 顶部信息 ----------
function updateMeta() {
  canvasMeta.textContent = state.width + " × " + state.height;
}
let exporting = false;
function updateExportLabel() {
  if (!exporting) btnExport.textContent = "导出 " + state.format;
}
function updateSeg() {
  $("segX").classList.toggle("active", state.curves.active === "x");
  $("segY").classList.toggle("active", state.curves.active === "y");
}
function syncUI() {
  for (const f of syncers) f();
  updateSeg();
  updateMeta();
  updateExportLabel();
  rebuildStrip();
}

// ---------- 生成 Generate ----------
$("btnRandomAll").addEventListener("click", () => {
  state = randomizeAll(state);
  syncUI();
  updateOverlay();
  scheduleRender();
});
bindSelect("resolution", () => String(state.resolution), (v) => { state.resolution = parseInt(v, 10); }, () => {});
bindSelect("format", () => state.format, (v) => { state.format = v; }, updateExportLabel);

$("btnShare").addEventListener("click", async () => {
  const encoded = encodeState(state);
  const url = location.origin + location.pathname + "#s=" + encoded;
  const btn = $("btnShare");
  const shareUrl = $("shareUrl");
  const done = (text) => {
    btn.textContent = text;
    setTimeout(() => { btn.textContent = "分享链接"; }, 1600);
  };
  try {
    await navigator.clipboard.writeText(url);
    shareUrl.hidden = true;
    done("已复制");
    return;
  } catch (e) { /* 继续尝试后备方案 */ }
  // 后备一：选中文本 + execCommand（兼容剪贴板权限被拒的环境）
  const ta = document.createElement("textarea");
  ta.value = url;
  ta.readOnly = true;
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  ta.remove();
  if (ok) {
    shareUrl.hidden = true;
    done("已复制");
    return;
  }
  // 后备二：行内展示链接，手动复制（不使用阻塞式 prompt）
  shareUrl.value = url;
  shareUrl.hidden = false;
  shareUrl.focus();
  shareUrl.select();
  done("请手动复制");
});

btnExport.addEventListener("click", async () => {
  if (exporting) return;
  exporting = true;
  btnExport.disabled = true;
  btnExport.textContent = "导出中…";
  try {
    const scale = state.resolution;
    const canvas = document.createElement("canvas");
    canvas.width = state.width * scale;
    canvas.height = state.height * scale;
    await renderGradientAsync(canvas, state);
    const mime = state.format === "WebP" ? "image/webp" : "image/png";
    const blob = await new Promise((res) => canvas.toBlob(res, mime, 0.95));
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gradient-curves-" + canvas.width + "x" + canvas.height +
        "." + (state.format === "WebP" ? "webp" : "png");
      a.click();
      URL.revokeObjectURL(url);
    }
  } finally {
    exporting = false;
    btnExport.disabled = false;
    updateExportLabel();
  }
});

// ---------- 曲线 Curves ----------
$("segX").addEventListener("click", () => { state.curves.active = "x"; updateSeg(); updateOverlay(); });
$("segY").addEventListener("click", () => { state.curves.active = "y"; updateSeg(); updateOverlay(); });
bindSwitch("swInvert", () => state.curves.inverted, (v) => { state.curves.inverted = v; });
bindSwitch("swSmoothing", () => state.curves.smoothing, (v) => { state.curves.smoothing = v; });
bindSwitch("swVisible", () => state.curves.visible, (v) => { state.curves.visible = v; }, () => { updateOverlay(); scheduleRender(); });
$("btnRandomCurves").addEventListener("click", () => {
  const rand = mulberry32(Math.floor(Math.random() * 1e9));
  state.curves.x = randomCurve(rand, true);
  state.curves.y = randomCurve(rand, false);
  updateOverlay();
  scheduleRender();
});

// ---------- 画布 Canvas ----------
function bindNumberField(id, get, set) {
  const inp = $(id);
  const show = () => { inp.value = String(get()); };
  inp.addEventListener("change", () => {
    const v = parseInt(inp.value, 10);
    if (!isNaN(v)) {
      set(Math.min(8192, Math.max(16, v)));
      updateMeta();
      fitBox();
      updateOverlay();
      scheduleRender();
    }
    show();
  });
  syncers.push(show);
  show();
}
bindNumberField("widthIn", () => state.width, (v) => { state.width = v; });
bindNumberField("heightIn", () => state.height, (v) => { state.height = v; });

fillSelect($("globalBlend"), BLEND_MODES);
bindSelect("globalBlend", () => state.globalBlend, (v) => { state.globalBlend = v; });

makeSlider($("canvasSliders"), { label: "羽化 Feather", min: 0, max: 200, get: () => state.feather, set: (v) => { state.feather = v; } });
makeSlider($("canvasSliders"), { label: "噪点 Noise", min: 0, max: 100, get: () => state.noise, set: (v) => { state.noise = v; } });

// ---------- 颜色 Colors ----------
const strip = $("colorStrip");
let stripDrag = null;

function stripGradient() {
  const sorted = state.colors.slice().sort((a, b) => a.pos - b.pos);
  return "linear-gradient(to right, " +
    sorted.map((c) => c.hex + " " + (c.pos * 100).toFixed(1) + "%").join(", ") + ")";
}

function rebuildStrip() {
  strip.innerHTML = "";
  strip.style.background = stripGradient();
  state.colors.forEach((c, i) => {
    const stop = el("div", "strip-stop" + (i === state.selectedColor ? " sel" : ""));
    stop.style.left = "calc(" + (8 + c.pos * 100) + "% - " + (c.pos * 16).toFixed(1) + "px)";
    stop.style.background = c.hex;
    stop.setAttribute("aria-label", "色标 " + (i + 1));
    stop.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      stripDrag = i;
      selectColor(i);
    });
    strip.appendChild(stop);
  });
}

function stripPos(e) {
  const rect = strip.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

window.addEventListener("pointermove", (e) => {
  if (stripDrag === null) return;
  state.colors[stripDrag].pos = stripPos(e);
  rebuildStrip();
  scheduleRender();
});
window.addEventListener("pointerup", () => { stripDrag = null; });

strip.addEventListener("dblclick", (e) => {
  if (state.colors.length >= 10) return;
  const sel = selectedStop();
  state.colors.push({ hex: sel ? sel.hex : "#ffffff", pos: stripPos(e) });
  state.selectedColor = state.colors.length - 1;
  rebuildStrip();
  syncHex();
  scheduleRender();
});

function selectedStop() {
  return state.colors[state.selectedColor] || state.colors[0];
}
function syncHex() {
  const s = selectedStop();
  const hex = s ? s.hex : "#ffffff";
  $("colorPicker").value = hex;
  $("colorHex").value = hex;
}
function selectColor(i) {
  state.selectedColor = i;
  rebuildStrip();
  syncHex();
}
function afterColors() {
  rebuildStrip();
  syncHex();
  scheduleRender();
}
syncers.push(syncHex);

$("btnReverse").addEventListener("click", () => {
  state.colors = state.colors.map((c) => ({ hex: c.hex, pos: 1 - c.pos })).reverse();
  state.selectedColor = Math.min(state.selectedColor, state.colors.length - 1);
  afterColors();
});
$("btnEven").addEventListener("click", () => {
  const n = state.colors.length;
  state.colors = state.colors.map((c, i) => ({ hex: c.hex, pos: n === 1 ? 0.5 : i / (n - 1) }));
  afterColors();
});
$("btnShuffle").addEventListener("click", () => {
  const hexes = state.colors.map((c) => c.hex);
  for (let i = hexes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = hexes[i]; hexes[i] = hexes[j]; hexes[j] = t;
  }
  state.colors = state.colors.map((c, i) => ({ hex: hexes[i], pos: c.pos }));
  afterColors();
});
$("btnDelete").addEventListener("click", () => {
  if (state.colors.length <= 2) return;
  state.colors = state.colors.filter((_, j) => j !== state.selectedColor);
  state.selectedColor = Math.max(0, state.selectedColor - 1);
  afterColors();
});

$("colorPicker").addEventListener("input", (e) => {
  const s = selectedStop();
  if (!s) return;
  s.hex = e.target.value;
  $("colorHex").value = s.hex;
  rebuildStrip();
  scheduleRender();
});
$("colorHex").addEventListener("input", () => {
  const inp = $("colorHex");
  const v = inp.value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(v) || /^#?[0-9a-fA-F]{3}$/.test(v)) {
    let h = v.charAt(0) === "#" ? v : "#" + v;
    if (h.length === 4) h = "#" + h.slice(1).split("").map((ch) => ch + ch).join("");
    const s = selectedStop();
    if (!s) return;
    s.hex = h.toLowerCase();
    $("colorPicker").value = s.hex;
    rebuildStrip();
    scheduleRender();
  }
});
$("colorHex").addEventListener("blur", syncHex);

fillSelect($("colorTemplate"), COLOR_TEMPLATES);
bindSelect("colorTemplate", () => state.colorTemplate, (v) => { state.colorTemplate = v; }, () => {});

$("btnRandomColors").addEventListener("click", () => {
  state.colors = randomizeColors(state);
  state.selectedColor = 0;
  afterColors();
});

function applyAmount(n) {
  n = Math.round(n);
  state.amount = n;
  const palette = generatePalette(state.colorTemplate, n);
  state.colors = palette.map((hex, i) => ({ hex, pos: n === 1 ? 0.5 : i / (n - 1) }));
  state.selectedColor = 0;
  rebuildStrip();
  syncHex();
  scheduleRender();
}
makeSlider($("colorSliders"), {
  label: "颜色数量 Amount", min: 2, max: 10,
  get: () => state.amount,
  set: (v) => { applyAmount(v); },
  after: () => {},
});

// ---------- 扭曲 Distortion ----------
buildCollapse({
  title: "扭曲 Distortion",
  getEnabled: () => state.distortion.enabled,
  setEnabled: (v) => { state.distortion.enabled = v; },
  getExpanded: () => state.distortion.expanded,
  setExpanded: (v) => { state.distortion.expanded = v; },
  build(body) {
    makeSelectRow(body, "类型 Type", DISTORTION_TYPES, () => state.distortion.type, (v) => { state.distortion.type = v; });
    makeSlider(body, { label: "强度 Intensity", min: 0, max: 10, step: 0.1, get: () => state.distortion.intensity, set: (v) => { state.distortion.intensity = v; } });
    makeSlider(body, { label: "缩放 Scale", min: 0.1, max: 3, step: 0.05, get: () => state.distortion.scale, set: (v) => { state.distortion.scale = v; } });
    makeSlider(body, { label: "种子 Seed", min: 0, max: 100, get: () => state.distortion.seed, set: (v) => { state.distortion.seed = v; } });
    makeSlider(body, { label: "倍频 Octaves", min: 1, max: 8, get: () => state.distortion.octaves, set: (v) => { state.distortion.octaves = v; } });
    makeSlider(body, { label: "间隙度 Lacunarity", min: 1, max: 4, step: 0.1, get: () => state.distortion.lacunarity, set: (v) => { state.distortion.lacunarity = v; } });
    makeSlider(body, { label: "持续度 Persistence", min: 0, max: 1, step: 0.05, fmt: (v) => (+v).toFixed(2), get: () => state.distortion.persistence, set: (v) => { state.distortion.persistence = v; } });
    makeSlider(body, { label: "扭曲强度 Warp", min: 0, max: 5, step: 0.1, get: () => state.distortion.warp, set: (v) => { state.distortion.warp = v; } });
    makeSlider(body, { label: "浮雕 Relief", min: 0, max: 100, get: () => state.distortion.relief, set: (v) => { state.distortion.relief = v; } });
  },
});

// ---------- 闪粉 Glitter ----------
buildCollapse({
  title: "闪粉 Glitter",
  getEnabled: () => state.glitter.enabled,
  setEnabled: (v) => { state.glitter.enabled = v; },
  getExpanded: () => state.glitter.expanded,
  setExpanded: (v) => { state.glitter.expanded = v; },
  build(body) {
    makeSlider(body, { label: "密度 Density", min: 0, max: 100, get: () => state.glitter.density, set: (v) => { state.glitter.density = v; } });
    makeSlider(body, { label: "最小尺寸 Size min", min: 0.1, max: 10, step: 0.1, get: () => state.glitter.sizeMin, set: (v) => { state.glitter.sizeMin = v; } });
    makeSlider(body, { label: "最大尺寸 Size max", min: 0.1, max: 10, step: 0.1, get: () => state.glitter.sizeMax, set: (v) => { state.glitter.sizeMax = v; } });
    makeSlider(body, { label: "不透明度 Opacity", min: 0, max: 100, get: () => state.glitter.opacity, set: (v) => { state.glitter.opacity = v; } });
    makeSelectRow(body, "混合模式 Blend", ["Normal"].concat(OVERLAY_BLEND_MODES), () => state.glitter.blend, (v) => { state.glitter.blend = v; });
  },
});

// ---------- 图案 Patterns ----------
buildCollapse({
  title: "图案 Patterns",
  getEnabled: () => state.patterns.enabled,
  setEnabled: (v) => { state.patterns.enabled = v; },
  getExpanded: () => state.patterns.expanded,
  setExpanded: (v) => { state.patterns.expanded = v; },
  build(body) {
    makeSelectRow(body, "类型 Type", PATTERN_TYPES, () => state.patterns.type, (v) => { state.patterns.type = v; });
    makeSlider(body, { label: "点大小 Dot size", min: 1, max: 30, get: () => state.patterns.dotSize, set: (v) => { state.patterns.dotSize = v; } });
    makeSlider(body, { label: "间距 Distance", min: 6, max: 120, get: () => state.patterns.distance, set: (v) => { state.patterns.distance = v; } });

    const row = el("div", "row");
    const lab = el("label");
    lab.textContent = "颜色 Color";
    const pr = el("div", "picker-row");
    pr.style.marginBottom = "0";
    const pc = el("input");
    pc.type = "color";
    pc.setAttribute("aria-label", "图案颜色");
    const ph = el("input", "hex-input");
    ph.type = "text";
    ph.spellcheck = false;
    ph.setAttribute("aria-label", "图案颜色 HEX 色值");
    const showColor = () => { pc.value = state.patterns.color; ph.value = state.patterns.color; };
    pc.addEventListener("input", () => {
      state.patterns.color = pc.value;
      ph.value = pc.value;
      scheduleRender();
    });
    ph.addEventListener("input", () => {
      const v = ph.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        state.patterns.color = v.toLowerCase();
        pc.value = state.patterns.color;
        scheduleRender();
      }
    });
    ph.addEventListener("blur", showColor);
    pr.append(pc, ph);
    row.append(lab, pr);
    body.appendChild(row);
    syncers.push(showColor);
    showColor();

    makeSlider(body, { label: "不透明度 Opacity", min: 0, max: 100, get: () => state.patterns.opacity, set: (v) => { state.patterns.opacity = v; } });
    makeSelectRow(body, "混合模式 Blend", ["Normal", "Multiply", "Screen", "Overlay", "Darken"], () => state.patterns.blend, (v) => { state.patterns.blend = v; });
  },
});

// ---------- 实验功能 Beta ----------
buildCollapse({
  title: "实验功能 Beta",
  getExpanded: () => state.beta.expanded,
  setExpanded: (v) => { state.beta.expanded = v; },
  build(body) {
    const playRow = el("div", "switch-row");
    const playLab = el("span");
    playLab.textContent = "动画 Animate distortion";
    const playBtn = el("button", "btn btn-small");
    playBtn.type = "button";
    const showPlay = () => {
      playBtn.textContent = state.beta.animated ? "停止" : "播放";
      playBtn.classList.toggle("on", state.beta.animated);
    };
    playBtn.addEventListener("click", () => {
      state.beta.animated = !state.beta.animated;
      showPlay();
      if (state.beta.animated) startAnim();
      else stopAnim();
    });
    playRow.append(playLab, playBtn);
    body.appendChild(playRow);
    syncers.push(showPlay);
    showPlay();

    makeSlider(body, { label: "动画速度 Speed", min: 0.1, max: 4, step: 0.1, get: () => state.beta.speed, set: (v) => { state.beta.speed = v; }, after: () => {} });
    makeSwitchRow(body, { label: "水平对称 Symmetry", get: () => state.beta.symmetry, set: (v) => { state.beta.symmetry = v; } });
  },
});

// ---------- 精选模板弹窗 ----------
let tplBuilt = false;
function mergeTemplate(base, partial) {
  return Object.assign({}, base, partial, {
    distortion: Object.assign({}, base.distortion, partial.distortion),
    glitter: Object.assign({}, base.glitter, partial.glitter),
    patterns: Object.assign({}, base.patterns, partial.patterns),
    beta: Object.assign({}, base.beta, partial.beta),
    curves: Object.assign({}, base.curves, partial.curves),
  });
}
function buildTemplates() {
  const grid = $("tplGrid");
  TEMPLATES.forEach((t) => {
    const card = el("button", "tpl-card");
    card.type = "button";
    const cv = el("canvas");
    cv.width = 240;
    cv.height = 140;
    const merged = mergeTemplate(createDefaultState(), t.make());
    renderGradient(cv, merged, {});
    const name = el("span");
    name.textContent = t.name;
    card.append(cv, name);
    card.addEventListener("click", () => {
      applyTemplate(t.make());
      closeTemplates();
    });
    grid.appendChild(card);
  });
  tplBuilt = true;
}
function openTemplates() {
  if (!tplBuilt) buildTemplates();
  $("tplModal").hidden = false;
}
function closeTemplates() {
  $("tplModal").hidden = true;
}
function applyTemplate(partial) {
  state = mergeTemplate(state, partial);
  state.selectedColor = 0;
  syncUI();
  updateOverlay();
  scheduleRender();
}
$("btnTemplates").addEventListener("click", openTemplates);
$("tplClose").addEventListener("click", closeTemplates);
$("tplBackdrop").addEventListener("click", closeTemplates);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("tplModal").hidden) closeTemplates();
});

// ---------- 自适应与启动 ----------
const ro = new ResizeObserver(() => {
  fitBox();
  updateOverlay();
  if (!state.beta.animated) scheduleRender();
});
ro.observe(canvasArea);

fitBox();
syncUI();
updateOverlay();
if (state.beta.animated) startAnim();
else renderStatic();

})();
