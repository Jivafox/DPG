import * as THREE from './three.module.min.js';

// ---------- 状态 ----------
const settings = {
  density: 1200,
  symbolSize: 0.05,
  rotationSpeed: 1,
  sphereRadius: 2.0,
  distribution: 0.0,
  edgeNoise: 0.0,
  flashThreshold: 0.4,
  isPlaying: true,
  seed: 42,
};
let customSymbols = []; // {id, name, dataUrl, ratio}

const $ = (id) => document.getElementById(id);
const glArea = $("glArea");
const stageMeta = $("stageMeta");

// ---------- 种子化随机（Park-Miller） ----------
function seededRandom(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------- 默认符号纹理（CanvasTexture 手绘 11 种） ----------
const DEFAULT_SYMBOLS = ['square', 'circle', 'diamond', 'cross', 'hash', 'dot', 'vline', 'hline', 'diag1', 'ring', 'x'];

function createSymbolTexture(type, size) {
  const s = size || 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d', { alpha: true });
  const pad = s * 0.18;

  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, s * 0.06);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (type) {
    case 'square':
      ctx.strokeRect(pad, pad, s - pad * 2, s - pad * 2);
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, (s - pad * 2) / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'ring': {
      const r1 = (s - pad * 2) / 2;
      ctx.beginPath(); ctx.arc(s / 2, s / 2, r1, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(2, s * 0.04);
      ctx.beginPath(); ctx.arc(s / 2, s / 2, r1 * 0.5, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(s / 2, pad); ctx.lineTo(s - pad, s / 2);
      ctx.lineTo(s / 2, s - pad); ctx.lineTo(pad, s / 2);
      ctx.closePath(); ctx.stroke();
      break;
    case 'cross': {
      const c = s / 2;
      ctx.beginPath();
      ctx.moveTo(c, pad); ctx.lineTo(c, s - pad);
      ctx.moveTo(pad, c); ctx.lineTo(s - pad, c);
      ctx.stroke();
      break;
    }
    case 'x': {
      ctx.beginPath();
      ctx.moveTo(pad, pad); ctx.lineTo(s - pad, s - pad);
      ctx.moveTo(s - pad, pad); ctx.lineTo(pad, s - pad);
      ctx.stroke();
      break;
    }
    case 'hash': {
      const step = (s - pad * 2) / 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(pad, pad + step * i); ctx.lineTo(s - pad, pad + step * i);
        ctx.stroke();
      }
      ctx.lineWidth = Math.max(2, s * 0.04);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(pad + step * i, pad); ctx.lineTo(pad + step * i, s - pad);
        ctx.stroke();
      }
      break;
    }
    case 'dot':
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'vline':
      ctx.beginPath();
      ctx.moveTo(s / 2, pad); ctx.lineTo(s / 2, s - pad);
      ctx.stroke();
      break;
    case 'hline':
      ctx.beginPath();
      ctx.moveTo(pad, s / 2); ctx.lineTo(s - pad, s / 2);
      ctx.stroke();
      break;
    case 'diag1':
      ctx.beginPath();
      ctx.moveTo(pad, pad); ctx.lineTo(s - pad, s - pad);
      ctx.stroke();
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format = THREE.RGBAFormat;
  texture.needsUpdate = true;
  return texture;
}

// ---------- 大陆分布算法 ----------
function generateContinents(scatter, seed) {
  const rng = seededRandom(seed);
  // scatter 控制碎片化：0 → 2-3 块大陆，1.0 → 80-100 个碎点
  const count = Math.max(2, Math.round(2 + Math.pow(scatter, 2.2) * 90));
  const continents = [];
  for (let i = 0; i < count; i++) {
    const u = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const z = u;
    const inc = Math.acos(Math.min(1, Math.max(-1, z)));
    const az = Math.atan2(y, x);
    const sizeBase = Math.max(0.06, 1.15 - Math.pow(scatter, 1.5) * 1.1);
    const size = sizeBase * (0.5 + rng() * 1.0);
    const strength = 0.6 + rng() * 0.6;
    continents.push({ x, y, z, inc, az, size, strength });
  }
  return continents;
}

function sphericalDistance(inc1, az1, inc2, az2) {
  return Math.acos(
    Math.min(1, Math.max(-1,
      Math.sin(inc1) * Math.sin(inc2) * Math.cos(az1 - az2) +
      Math.cos(inc1) * Math.cos(inc2)
    ))
  );
}

// 多频边缘噪声：让大陆边界不规则
function evalEdgeNoise(inc, az, seed, amount) {
  if (amount <= 0) return 0;
  const s1 = Math.sin(inc * 3.7 + seed * 1.31) * Math.cos(az * 2.3 + seed * 0.71);
  const s2 = Math.sin(inc * 7.1 + az * 5.3 + seed * 2.17) * 0.5;
  const s3 = Math.sin(inc * 13.7 + seed * 3.41) * Math.cos(az * 11.3 + seed * 1.91) * 0.25;
  return (s1 + s2 + s3) * amount;
}

function generateSpherePositions(count, radius, scatter, edgeNoiseAmount, seed) {
  const positions = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const angleIncrement = Math.PI * 2 * goldenRatio;

  const continents = generateContinents(scatter, seed);
  const rng = seededRandom(seed + 999);

  const candidates = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const inc = Math.acos(1 - 2 * t);
    const az = angleIncrement * i;
    const nx = Math.sin(inc) * Math.cos(az);
    const ny = Math.sin(inc) * Math.sin(az);
    const nz = Math.cos(inc);

    let score = -Infinity;
    for (const c of continents) {
      const dist = sphericalDistance(inc, az, c.inc, c.az);
      const tFalloff = Math.max(0, 1 - dist / c.size);
      const influence = tFalloff * tFalloff * c.strength;
      score = Math.max(score, influence);
    }
    score += evalEdgeNoise(inc, az, seed, edgeNoiseAmount);

    candidates.push({ x: radius * nx, y: radius * ny, z: radius * nz, score });
  }

  const landRatio = 0.40 + scatter * 0.15;
  const scores = candidates.map((c) => c.score).sort((a, b) => a - b);
  const threshold = scores[Math.floor(scores.length * (1 - landRatio))];

  for (const c of candidates) {
    if (c.score <= threshold) continue;
    const jitterScale = 0.01 + scatter * 0.02;
    const jx = (rng() - 0.5) * jitterScale * 2;
    const jy = (rng() - 0.5) * jitterScale * 2;
    const jz = (rng() - 0.5) * jitterScale * 2;
    positions.push([c.x + jx, c.y + jy, c.z + jz]);
  }
  return positions;
}

// ---------- WebGL 初始化（带降级提示） ----------
let renderer = null;
try {
  if (!window.WebGLRenderingContext) throw new Error('no webgl');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
} catch (e) {
  renderer = null;
}

let scene, camera, group, planeGeo;
const defaultTextures = new Map();
const customTextures = new Map(); // id -> THREE.Texture | null(加载中)
const meshes = new Map();         // type -> InstancedMesh
const bgMeshes = new Map();
let typeData = new Map();         // type -> SymbolInfo[]
let bgData = new Map();           // type -> {x,y,size,phase}[]
let totalSymbols = 0;

const clock = new THREE.Clock();
const dummy = new THREE.Object3D();
const bgDummy = new THREE.Object3D();
const tmpV = new THREE.Vector3();
const tmpCam = new THREE.Vector3();
const tmpC = new THREE.Color();

function distribute() {
  const positions = generateSpherePositions(
    settings.density,
    settings.sphereRadius,
    settings.distribution,
    settings.edgeNoise,
    settings.seed
  );
  totalSymbols = positions.length;
  const hasCustom = customSymbols.length > 0;
  const customTotalRatio = customSymbols.reduce((s, c) => s + (c.ratio || 0), 0);

  typeData = new Map();
  if (hasCustom) {
    customSymbols.forEach((c) => typeData.set('custom-' + c.id, []));
  } else {
    DEFAULT_SYMBOLS.forEach((t) => typeData.set(t, []));
  }

  positions.forEach((pos) => {
    if (hasCustom && customTotalRatio > 0) {
      const roll = Math.random() * customTotalRatio;
      let cumulative = 0;
      let selectedId = customSymbols[0] && customSymbols[0].id;
      for (const c of customSymbols) {
        cumulative += (c.ratio || 0);
        if (roll <= cumulative) { selectedId = c.id; break; }
      }
      const arr = typeData.get('custom-' + selectedId);
      if (arr) {
        arr.push({
          position: pos,
          zRot: Math.random() * Math.PI * 2,
          scale: 0.7 + Math.random() * 0.8,
          flashPhase: Math.random() * Math.PI * 2,
          flashSpeed: 0.02 + Math.random() * 0.04,
          isCustom: true,
        });
      }
    } else {
      const type = DEFAULT_SYMBOLS[Math.floor(Math.random() * DEFAULT_SYMBOLS.length)];
      typeData.get(type).push({
        position: pos,
        zRot: Math.random() * Math.PI * 2,
        scale: 0.7 + Math.random() * 0.8,
        flashPhase: Math.random() * Math.PI * 2,
        flashSpeed: 0.02 + Math.random() * 0.04,
        isCustom: false,
      });
    }
  });

  buildMeshes();
  updateMeta();
}

function textureFor(type) {
  if (type.indexOf('custom-') === 0) {
    return customTextures.get(type.slice(7)) || undefined;
  }
  return defaultTextures.get(type);
}

function buildMeshes() {
  meshes.forEach((m) => {
    group.remove(m);
    m.material.dispose();
  });
  meshes.clear();
  const white = new THREE.Color(1, 1, 1);
  typeData.forEach((symbols, type) => {
    if (!symbols.length) return;
    const tex = textureFor(type);
    if (!tex) return;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      alphaTest: 0.01,
    });
    const mesh = new THREE.InstancedMesh(planeGeo, mat, symbols.length);
    mesh.frustumCulled = false;
    for (let i = 0; i < symbols.length; i++) mesh.setColorAt(i, white);
    meshes.set(type, mesh);
    group.add(mesh);
  });
}

function ensureCustomTextures() {
  customSymbols.forEach((sym) => {
    if (sym.dataUrl && !customTextures.has(sym.id)) {
      customTextures.set(sym.id, null);
      new THREE.TextureLoader().load(sym.dataUrl, (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        customTextures.set(sym.id, tex);
        buildMeshes();
      });
    }
  });
}

function updateMeta() {
  stageMeta.textContent =
    totalSymbols.toLocaleString('zh-CN') + ' 符号 · 半径 ' +
    settings.sphereRadius.toFixed(1) + ' · 种子 ' + settings.seed;
}

// ---------- 每帧渲染 ----------
function animate() {
  const t = clock.getElapsedTime();

  if (settings.isPlaying) {
    group.rotation.y += 0.003 * settings.rotationSpeed;
    group.rotation.x += 0.001 * settings.rotationSpeed;
  }
  if (!dragging && settings.isPlaying) {
    group.rotation.y += vel.x;
    group.rotation.x += vel.y;
    vel.x *= 0.92;
    vel.y *= 0.92;
    if (Math.abs(vel.x) < 0.0001) vel.x = 0;
    if (Math.abs(vel.y) < 0.0001) vel.y = 0;
  }

  tmpCam.copy(camera.position).normalize();

  typeData.forEach((symbols, type) => {
    const mesh = meshes.get(type);
    if (!mesh || !symbols.length) return;
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      const isFlashing = Math.sin(sym.flashPhase + t * sym.flashSpeed * 20) > (1 - settings.flashThreshold * 2);
      const scale = settings.symbolSize * sym.scale * (isFlashing ? 1.3 : 1.0);

      dummy.position.set(sym.position[0], sym.position[1], sym.position[2]);
      dummy.lookAt(0, 0, 0);
      dummy.rotateZ(sym.zRot);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // 按朝向压暗：正面 1.0 → 侧缘 0.35 → 背面中心约 0.03
      tmpV.set(sym.position[0], sym.position[1], sym.position[2]).normalize().applyEuler(group.rotation);
      const facing = tmpV.dot(tmpCam);
      const facingT = (facing + 1) * 0.5;
      const brightness = Math.pow(Math.max(0, facingT), 2.2) * 0.95 + 0.03;

      if (isFlashing) {
        tmpC.setRGB(1.5 * brightness, 1.2 * brightness, 0.6 * brightness);
      } else {
        const base = sym.isCustom ? 1.05 : 1.0;
        tmpC.setRGB(base * brightness, base * brightness, base * brightness);
      }
      mesh.setColorAt(i, tmpC);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  bgData.forEach((symbols, type) => {
    const mesh = bgMeshes.get(type);
    if (!mesh || !symbols.length) return;
    for (let i = 0; i < symbols.length; i++) {
      const bg = symbols[i];
      let x = bg.x + t * 0.005;
      const y = bg.y + Math.sin(t * 0.2 + bg.phase) * 0.01;
      if (x > 12) x -= 24;
      if (x < -12) x += 24;
      bgDummy.position.set(x, y, -6);
      bgDummy.scale.set(bg.size, bg.size, bg.size);
      bgDummy.updateMatrix();
      mesh.setMatrixAt(i, bgDummy.matrix);
      const alpha = 0.12 + Math.sin(t * 0.5 + bg.phase) * 0.06;
      mesh.setColorAt(i, tmpC.setRGB(alpha, alpha, alpha));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  renderer.render(scene, camera);
}

// ---------- 拖拽旋转 + 惯性 ----------
let dragging = false;
let lastX = 0, lastY = 0;
const vel = { x: 0, y: 0 };

function initScene() {
  renderer.setClearColor('#000000');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  glArea.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 5);

  group = new THREE.Group();
  scene.add(group);
  planeGeo = new THREE.PlaneGeometry(1, 1);

  DEFAULT_SYMBOLS.forEach((sym) => {
    defaultTextures.set(sym, createSymbolTexture(sym, 256));
  });

  // 背景漂浮符号（远景装饰，初始化一次）
  const bgTypes = ['square', 'circle', 'dot'];
  bgTypes.forEach((t) => bgData.set(t, []));
  for (let i = 0; i < 120; i++) {
    const type = bgTypes[Math.floor(Math.random() * 3)];
    bgData.get(type).push({
      x: (Math.random() - 0.5) * 24,
      y: (Math.random() - 0.5) * 24,
      size: 0.012 + Math.random() * 0.025,
      phase: Math.random() * Math.PI * 2,
    });
  }
  const white = new THREE.Color(1, 1, 1);
  bgData.forEach((symbols, type) => {
    if (!symbols.length) return;
    const mat = new THREE.MeshBasicMaterial({
      map: defaultTextures.get(type),
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.01,
    });
    const mesh = new THREE.InstancedMesh(planeGeo, mat, symbols.length);
    mesh.frustumCulled = false;
    for (let i = 0; i < symbols.length; i++) mesh.setColorAt(i, white);
    bgMeshes.set(type, mesh);
    scene.add(mesh);
  });

  glArea.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    vel.x = 0;
    vel.y = 0;
    glArea.classList.add('dragging');
    if (glArea.setPointerCapture) {
      try { glArea.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
  });
  glArea.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const rotY = dx * 0.005;
    const rotX = dy * 0.005;
    group.rotation.y += rotY;
    group.rotation.x += rotX;
    vel.x = rotY * 0.5;
    vel.y = rotX * 0.5;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => {
    dragging = false;
    glArea.classList.remove('dragging');
  };
  glArea.addEventListener('pointerup', endDrag);
  glArea.addEventListener('pointercancel', endDrag);

  new ResizeObserver(() => {
    const w = glArea.clientWidth;
    const h = glArea.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }).observe(glArea);

  distribute();
  renderer.setAnimationLoop(animate);
}

// ---------- 控件 helpers ----------
function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

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
  const commit = (v) => {
    def.set(Math.min(def.max, Math.max(def.min, v)));
    show();
    if (def.after) def.after();
  };
  range.addEventListener("input", () => commit(parseFloat(range.value)));
  num.addEventListener("change", () => {
    const v = parseFloat(num.value);
    if (!isNaN(v)) commit(v);
    else show();
  });
  show();
  return row;
}

const rebuild = () => { if (renderer) distribute(); };
let ratioRebuildTimer = null;
function rebuildDebounced() {
  if (ratioRebuildTimer) clearTimeout(ratioRebuildTimer);
  ratioRebuildTimer = setTimeout(rebuild, 100);
}

// ---------- 球体 Sphere ----------
makeSlider($("sphereSliders"), {
  label: "密度 Density", min: 200, max: 10000, step: 100,
  get: () => settings.density, set: (v) => { settings.density = Math.round(v); },
  after: rebuild,
});
makeSlider($("sphereSliders"), {
  label: "符号大小 Symbol size", min: 0.01, max: 0.12, step: 0.001,
  fmt: (v) => (+v).toFixed(3),
  get: () => settings.symbolSize, set: (v) => { settings.symbolSize = v; },
});
makeSlider($("sphereSliders"), {
  label: "球半径 Radius", min: 1.0, max: 5.0, step: 0.1,
  get: () => settings.sphereRadius, set: (v) => { settings.sphereRadius = v; },
  after: rebuild,
});
makeSlider($("sphereSliders"), {
  label: "转速 Speed", min: 0, max: 3, step: 0.1,
  get: () => settings.rotationSpeed, set: (v) => { settings.rotationSpeed = v; },
});

// ---------- 分布 Distribution ----------
makeSlider($("distSliders"), {
  label: "碎片化 Scatter", min: 0, max: 1, step: 0.05,
  fmt: (v) => (v <= 0.15 ? "整块" : v >= 0.85 ? "细碎" : String(Math.round(v * 100))),
  get: () => settings.distribution, set: (v) => { settings.distribution = v; },
  after: rebuild,
});
makeSlider($("distSliders"), {
  label: "边缘噪声 Edge noise", min: 0, max: 1, step: 0.05,
  fmt: (v) => (v <= 0.15 ? "干净" : v >= 0.85 ? "毛边" : String(Math.round(v * 100))),
  get: () => settings.edgeNoise, set: (v) => { settings.edgeNoise = v; },
  after: rebuild,
});
makeSlider($("distSliders"), {
  label: "闪烁阈值 Flash", min: 0, max: 1, step: 0.01,
  get: () => settings.flashThreshold, set: (v) => { settings.flashThreshold = v; },
});

// ---------- 生成 Generate ----------
const btnPlay = $("btnPlay");
btnPlay.addEventListener("click", () => {
  settings.isPlaying = !settings.isPlaying;
  btnPlay.textContent = settings.isPlaying ? "暂停" : "播放";
});
$("btnRandom").addEventListener("click", () => {
  settings.seed = Math.floor(Math.random() * 1000000);
  rebuild();
});

// ---------- 自定义符号 ----------
const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

function totalRatio() {
  return customSymbols.reduce((s, c) => s + (c.ratio || 0), 0);
}

function renderSymbolUI() {
  const section = $("customSection");
  section.hidden = customSymbols.length === 0;
  $("symCount").textContent = customSymbols.length + " 个符号";
  updateRatioTotal();

  const list = $("symList");
  list.innerHTML = "";
  customSymbols.forEach((sym) => {
    const row = el("div", "sym-row");
    const thumb = el("div", "sthumb");
    const img = el("img");
    img.src = sym.dataUrl;
    img.alt = sym.name;
    thumb.appendChild(img);

    const main = el("div", "smain");
    const meta = el("div", "smeta");
    const name = el("span", "sname");
    name.textContent = sym.name;
    name.title = sym.name;
    const pct = el("span", "spct");
    meta.append(name, pct);
    const range = el("input");
    range.type = "range";
    range.min = 0; range.max = 100; range.step = 1;
    range.value = Math.round((sym.ratio || 0) * 100);
    range.setAttribute("aria-label", sym.name + " 占比");
    const showPct = () => { pct.textContent = Math.round((sym.ratio || 0) * 100) + "%"; };
    range.addEventListener("input", () => {
      sym.ratio = Math.max(0, Math.min(1, parseInt(range.value, 10) / 100));
      showPct();
      updateRatioTotal();
      rebuildDebounced();
    });
    main.append(meta, range);

    const del = el("button", "sym-del");
    del.type = "button";
    del.title = "删除 " + sym.name;
    del.innerHTML = TRASH_SVG;
    del.addEventListener("click", () => removeSymbol(sym.id));

    row.append(thumb, main, del);
    list.appendChild(row);
    showPct();
  });

  const grid = $("uploadList");
  grid.innerHTML = "";
  customSymbols.forEach((sym) => {
    const cell = el("div", "thumb");
    const img = el("img");
    img.src = sym.dataUrl;
    img.alt = sym.name;
    const btn = el("button");
    btn.type = "button";
    btn.title = "删除 " + sym.name;
    btn.innerHTML = X_SVG;
    btn.addEventListener("click", () => removeSymbol(sym.id));
    const tname = el("div", "tname");
    tname.textContent = sym.name;
    cell.append(img, btn, tname);
    grid.appendChild(cell);
  });
}

function updateRatioTotal() {
  const total = totalRatio();
  const badge = $("ratioTotal");
  badge.textContent = Math.round(total * 100) + "%";
  badge.classList.toggle("bad", Math.abs(total - 1) >= 0.01);
  $("btnNormalize").disabled = Math.abs(total - 1) < 0.01 || customSymbols.length === 0;
}

function equalizeRatios() {
  const n = customSymbols.length;
  if (!n) return;
  customSymbols.forEach((s) => { s.ratio = 1 / n; });
}

function afterSymbolsChange() {
  if (renderer) {
    ensureCustomTextures();
    distribute();
  }
  renderSymbolUI();
}

function removeSymbol(id) {
  const tex = customTextures.get(id);
  if (tex && tex.dispose) tex.dispose();
  customTextures.delete(id);
  customSymbols = customSymbols.filter((s) => s.id !== id);
  if (customSymbols.length) equalizeRatios();
  afterSymbolsChange();
}

$("btnEqualize").addEventListener("click", () => {
  equalizeRatios();
  afterSymbolsChange();
});
$("btnNormalize").addEventListener("click", () => {
  const total = totalRatio();
  if (!customSymbols.length || total === 0) return;
  customSymbols.forEach((s) => { s.ratio = (s.ratio || 0) / total; });
  afterSymbolsChange();
});
$("btnClear").addEventListener("click", () => {
  customSymbols.forEach((s) => {
    const tex = customTextures.get(s.id);
    if (tex && tex.dispose) tex.dispose();
  });
  customTextures.clear();
  customSymbols = [];
  afterSymbolsChange();
});

// ---------- 上传弹窗 ----------
const uploadModal = $("uploadModal");
const uploadMsg = $("uploadMsg");
const fileInput = $("fileInput");
const dropzone = $("dropzone");

function openUpload() { uploadModal.hidden = false; uploadMsg.textContent = ""; }
function closeUpload() { uploadModal.hidden = true; }
$("btnUpload").addEventListener("click", openUpload);
$("uploadClose").addEventListener("click", closeUpload);
$("uploadBackdrop").addEventListener("click", closeUpload);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !uploadModal.hidden) closeUpload();
});

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("over");
});
dropzone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dropzone.classList.remove("over");
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("over");
  processFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  processFiles(fileInput.files);
  fileInput.value = "";
});

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function processFiles(files) {
  const all = Array.from(files || []);
  if (!all.length) return;
  const accepted = [];
  const rejected = [];
  all.forEach((f) => {
    if (!f.type || f.type.indexOf("image/") !== 0) {
      rejected.push("「" + f.name + "」不是图片");
    } else if (f.size > MAX_FILE_SIZE) {
      rejected.push("「" + f.name + "」超过 2MB");
    } else {
      accepted.push(f);
    }
  });
  uploadMsg.textContent = rejected.length
    ? "已跳过 " + rejected.length + " 个文件：" + rejected.join("、")
    : "";

  if (!accepted.length) return;
  Promise.all(accepted.map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
        name: file.name,
        dataUrl: e.target.result,
        ratio: 0,
      });
    };
    reader.readAsDataURL(file);
  }))).then((newSymbols) => {
    customSymbols = customSymbols.concat(newSymbols);
    equalizeRatios();
    afterSymbolsChange();
  });
}

// ---------- 启动 ----------
document.addEventListener("contextmenu", (e) => e.preventDefault());

if (renderer) {
  initScene();
} else {
  $("glFallback").hidden = false;
  updateMeta();
}
renderSymbolUI();
