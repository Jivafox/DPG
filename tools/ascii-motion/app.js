// Gradient shader adapted from React Bits Grainient; see assets/NOTICE.txt.
const outputCanvas = document.querySelector("#outputCanvas");
const outputCtx = outputCanvas.getContext("2d", { alpha: true });
const sourceCanvas = document.querySelector("#sourceCanvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const gradientCanvas = document.querySelector("#gradientCanvas");
const glyphScratchCanvas = document.createElement("canvas");
const glyphScratchCtx = glyphScratchCanvas.getContext("2d");
const grainTextureCanvas = document.createElement("canvas");
const grainTextureCtx = grainTextureCanvas.getContext("2d");

const panel = document.querySelector(".panel");
const canvasWrap = document.querySelector("#canvasWrap");
const glyphUpload = document.querySelector("#glyphUpload");
const glyphDropZone = document.querySelector("#glyphDropZone");
const glyphList = document.querySelector("#glyphList");
const textGlyphsInput = document.querySelector("#textGlyphs");
const textFontInput = document.querySelector("#textFont");
const fgColorInput = document.querySelector("#fgColor");
const fgColorHexInput = document.querySelector("#fgColorHex");
const bgColorInput = document.querySelector("#bgColor");
const bgColorHexInput = document.querySelector("#bgColorHex");
const bgColorField = document.querySelector("#bgColorField");
const backgroundModeInput = document.querySelector("#backgroundMode");
const blendModeInput = document.querySelector("#blendMode");
const glyphOpacityInput = document.querySelector("#glyphOpacity");
const glyphOpacityValue = document.querySelector("#glyphOpacityValue");
const revertToneInput = document.querySelector("#revertTone");
const gradientColorInputs = [1, 2, 3].map((index) => document.querySelector(`#gradientColor${index}`));
const gradientColorHexInputs = [1, 2, 3].map((index) => document.querySelector(`#gradientColor${index}Hex`));
const grainAnimatedInput = document.querySelector("#grainAnimated");
const grainBlendModeInput = document.querySelector("#grainBlendMode");
const gradientSlidersEl = document.querySelector("#gradientSliders");
const asciiSlidersEl = document.querySelector("#asciiSliders");
const grainSlidersEl = document.querySelector("#grainSliders");
const framePresetInput = document.querySelector("#framePreset");
const frameWidthInput = document.querySelector("#frameWidth");
const frameHeightInput = document.querySelector("#frameHeight");
const lockAspectInput = document.querySelector("#lockAspect");
const performanceNote = document.querySelector("#performanceNote");
const playToggle = document.querySelector("#playToggle");
const restartAnimationButton = document.querySelector("#restartAnimation");
const videoDurationInput = document.querySelector("#videoDuration");
const exportVideoButton = document.querySelector("#exportVideo");
const resetAllButton = document.querySelector("#resetAll");
const exportProgress = document.querySelector("#exportProgress");
const exportStatus = document.querySelector("#exportStatus");
const canvasMeta = document.querySelector("#canvasMeta");

const VIDEO_FPS = 60;
const MIN_FRAME_SIDE = 256;
const MAX_FRAME_SIDE = 4096;
const MAX_FRAME_PIXELS = MAX_FRAME_SIDE * MAX_FRAME_SIDE;
const MAX_ASCII_CELLS = 25_000;
const MAX_PREVIEW_SIDE = 1440;
const MAX_PREVIEW_PIXELS = 1_100_000;
const MAX_GRADIENT_SIDE = 4096;
const MAX_GRADIENT_PIXELS = 4_000_000;
const MAX_PNG_SIDE = 8192;
const MAX_PNG_PIXELS = 40_000_000;
const MAX_VIDEO_SIDE = 1920;
const MAX_VIDEO_PIXELS = 2_100_000;

const asciiSliderConfig = [
  ["brightness", "ASCII 亮度", -100, 100, 0, 1],
  ["contrast", "ASCII 对比度", -100, 100, 0, 1],
  ["blur", "ASCII 采样模糊", 0, 12, 0, 0.1],
  ["noise", "ASCII 随机扰动", 0, 100, 0, 1],
  ["spacing", "字符间距", 4, 64, 18, 1],
  ["maxDiameter", "最大字径", 2, 96, 22, 1],
  ["toneContrast", "明暗曲线", 0.2, 4, 1.25, 0.05],
  ["solidFill", "填充阈值", 0, 100, 65, 1],
  ["minShapeSize", "最小字径", 0, 48, 1.5, 0.5],
];

const gradientSliderConfig = [
  ["timeSpeed", "整体动画速度", 0, 2, 0.25, 0.05],
  ["colorBalance", "颜色平衡", -1, 1, 0, 0.01],
  ["warpStrength", "扭曲强度", 0, 5, 1, 0.05],
  ["warpFrequency", "扭曲频率", 0, 20, 5, 0.1],
  ["warpSpeed", "扭曲速度", 0, 10, 2, 0.1],
  ["warpAmplitude", "扭曲幅度", 1, 100, 50, 0.5],
  ["blendAngle", "混合角度", -180, 180, 0, 1],
  ["blendSoftness", "混合柔度", 0, 1, 0.05, 0.01],
  ["rotationAmount", "旋转量", 0, 1000, 500, 1],
  ["noiseScale", "渐变 噪声尺度", 0.1, 10, 2, 0.1],
  ["contrast", "渐变 对比度", 0.5, 3, 1.5, 0.05],
  ["gamma", "Gamma", 0.2, 3, 1, 0.05],
  ["saturation", "饱和度", 0, 2, 1, 0.05],
  ["centerX", "中心 X", -0.5, 0.5, 0, 0.01],
  ["centerY", "中心 Y", -0.5, 0.5, 0, 0.01],
  ["zoom", "缩放", 0.2, 3, 0.9, 0.05],
];

const grainSliderConfig = [
  ["amount", "颗粒强度", 0, 0.5, 0.1, 0.01],
  ["scale", "颗粒尺寸", 0.5, 10, 2, 0.1],
  ["balance", "杂色明暗平衡", -100, 100, 0, 1],
];

const asciiDefaults = Object.fromEntries(asciiSliderConfig.map(([key, , , , value]) => [key, value]));
const gradientDefaults = Object.fromEntries(gradientSliderConfig.map(([key, , , , value]) => [key, value]));
const grainDefaults = Object.fromEntries(grainSliderConfig.map(([key, , , , value]) => [key, value]));
const sliderInputs = new Map();
const LOCAL_FONTS = new Set(["Lora, serif", "Geist Mono, monospace", "Geist Pixel, monospace"]);

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const state = {
  frameWidth: 1920,
  frameHeight: 1080,
  aspectRatio: 16 / 9,
  ascii: { ...asciiDefaults },
  gradient: { ...gradientDefaults },
  grain: { ...grainDefaults },
  gradientColors: ["#48FF28", "#2C3D32", "#65A865"],
  backgroundMode: "gradient",
  backgroundColor: "#000000",
  foregroundColor: "#FFFFFF",
  blendMode: "source-over",
  glyphOpacity: 1,
  revertTone: false,
  grainAnimated: false,
  grainBlendMode: "soft-light",
  grainTextureFrame: -1,
  textGlyphs: "01",
  textFont: "monospace",
  svgGlyphs: [],
  glyphCache: new Map(),
  glyphId: 0,
  dragGlyphIndex: -1,
  dragDropIndex: -1,
  dragDropAfter: false,
  animationTime: 0,
  lastFrameTime: 0,
  lastPreviewRenderTime: 0,
  isPlaying: !reducedMotion.matches,
  isExporting: false,
  animationFrame: 0,
  renderRequest: 0,
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeHexColor(value) {
  const match = String(value).trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return "";
  let hex = match[1];
  if (hex.length === 3) hex = [...hex].map((character) => character + character).join("");
  return `#${hex.toUpperCase()}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex) || "#FFFFFF";
  return [
    Number.parseInt(normalized.slice(1, 3), 16) / 255,
    Number.parseInt(normalized.slice(3, 5), 16) / 255,
    Number.parseInt(normalized.slice(5, 7), 16) / 255,
  ];
}

function setStatus(text) {
  exportStatus.textContent = text;
}

function setExportProgress(value, visible = true) {
  exportProgress.hidden = !visible;
  exportProgress.value = Math.round(clamp(value, 0, 100));
}

function formatSliderValue(value, step) {
  const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  return Number(value).toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function setupSliderGroup(container, config, values, namespace) {
  container.innerHTML = config
    .map(([key, label, min, max, value, step]) => `
      <div class="slider-row">
        <label>
          <span>${label}</span>
          <input id="${namespace}-${key}" type="range" min="${min}" max="${max}" value="${value}" step="${step}" />
        </label>
        <output id="${namespace}-${key}-value">${formatSliderValue(value, step)}</output>
      </div>
    `)
    .join("");

  config.forEach(([key, , , , , step]) => {
    const input = document.querySelector(`#${namespace}-${key}`);
    const output = document.querySelector(`#${namespace}-${key}-value`);
    sliderInputs.set(`${namespace}:${key}`, { input, output, step });
    input.addEventListener("input", () => {
      values[key] = Number(input.value);
      output.value = formatSliderValue(values[key], step);
      requestRender();
    });
  });
}

function syncSliderGroup(config, values, namespace) {
  config.forEach(([key, , min, , , step]) => {
    const controls = sliderInputs.get(`${namespace}:${key}`);
    if (!controls) return;
    controls.input.min = String(min);
    controls.input.value = String(values[key]);
    controls.output.value = formatSliderValue(values[key], step);
  });
}

function bindColorControls(colorInput, hexInput, onChange) {
  const commit = (value) => {
    const normalized = normalizeHexColor(value);
    if (!normalized) return false;
    colorInput.value = normalized;
    hexInput.value = normalized;
    onChange(normalized);
    requestRender();
    return true;
  };

  colorInput.addEventListener("input", () => commit(colorInput.value));
  hexInput.addEventListener("input", () => {
    if (normalizeHexColor(hexInput.value)) commit(hexInput.value);
  });
  hexInput.addEventListener("blur", () => {
    if (!commit(hexInput.value)) hexInput.value = colorInput.value.toUpperCase();
  });
}

class GrainientRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });
    this.ctx = null;
    this.program = null;
    this.uniforms = {};

    if (!this.gl) {
      this.ctx = canvas.getContext("2d", { alpha: false });
      return;
    }

    try {
      this.setupWebGl();
    } catch (error) {
      console.error(error);
      this.program = null;
      setStatus("WebGL Shader 初始化失败，将使用简化 Gradient。");
    }
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "Shader compile failed";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  setupWebGl() {
    const vertex = `#version 300 es
      precision highp float;
      const vec2 points[3] = vec2[3](
        vec2(-1.0, -1.0),
        vec2(3.0, -1.0),
        vec2(-1.0, 3.0)
      );
      void main() {
        gl_Position = vec4(points[gl_VertexID], 0.0, 1.0);
      }
    `;

    const fragment = `#version 300 es
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uTimeSpeed;
      uniform float uColorBalance;
      uniform float uWarpStrength;
      uniform float uWarpFrequency;
      uniform float uWarpSpeed;
      uniform float uWarpAmplitude;
      uniform float uBlendAngle;
      uniform float uBlendSoftness;
      uniform float uRotationAmount;
      uniform float uNoiseScale;
      uniform float uContrast;
      uniform float uGamma;
      uniform float uSaturation;
      uniform vec2 uCenterOffset;
      uniform float uZoom;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      out vec4 fragColor;
      #define S(a,b,t) smoothstep(a,b,t)
      mat2 Rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
      }
      vec2 hash(vec2 p) {
        p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
        return fract(sin(p) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        float n = mix(
          mix(dot(-1.0 + 2.0 * hash(i), f), dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
          mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
          u.y
        );
        return 0.5 + 0.5 * n;
      }
      void mainImage(out vec4 outputColor, vec2 coordinate) {
        float t = iTime * uTimeSpeed;
        vec2 uv = coordinate / iResolution.xy;
        float ratio = iResolution.x / iResolution.y;
        vec2 tuv = uv - 0.5 + uCenterOffset;
        tuv /= max(uZoom, 0.001);

        float degree = noise(vec2(t * 0.1, tuv.x * tuv.y) * uNoiseScale);
        tuv.y *= 1.0 / ratio;
        tuv *= Rot(radians((degree - 0.5) * uRotationAmount + 180.0));
        tuv.y *= ratio;

        float frequency = uWarpFrequency;
        float warpStrength = max(uWarpStrength, 0.001);
        float amplitude = uWarpAmplitude / warpStrength;
        float warpTime = t * uWarpSpeed;
        tuv.x += sin(tuv.y * frequency + warpTime) / amplitude;
        tuv.y += sin(tuv.x * (frequency * 1.5) + warpTime) / (amplitude * 0.5);

        float balance = uColorBalance;
        float softness = max(uBlendSoftness, 0.0);
        mat2 blendRotation = Rot(radians(uBlendAngle));
        float blendX = (tuv * blendRotation).x;
        float edge0 = -0.3 - balance - softness;
        float edge1 = 0.2 - balance + softness;
        float vertical0 = 0.5 - balance + softness;
        float vertical1 = -0.3 - balance - softness;
        vec3 layer1 = mix(uColor3, uColor2, S(edge0, edge1, blendX));
        vec3 layer2 = mix(uColor2, uColor1, S(edge0, edge1, blendX));
        vec3 color = mix(layer1, layer2, 1.0 - S(vertical1, vertical0, tuv.y));

        color = (color - 0.5) * uContrast + 0.5;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, uSaturation);
        color = pow(max(color, 0.0), vec3(1.0 / max(uGamma, 0.001)));
        outputColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }
      void main() {
        mainImage(fragColor, gl_FragCoord.xy);
      }
    `;

    const gl = this.gl;
    const program = gl.createProgram();
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertex);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
    }

    this.program = program;
    this.vao = gl.createVertexArray();
    const names = [
      "iResolution", "iTime", "uTimeSpeed", "uColorBalance", "uWarpStrength", "uWarpFrequency",
      "uWarpSpeed", "uWarpAmplitude", "uBlendAngle", "uBlendSoftness", "uRotationAmount",
      "uNoiseScale", "uContrast", "uGamma",
      "uSaturation", "uCenterOffset", "uZoom", "uColor1", "uColor2", "uColor3",
    ];
    names.forEach((name) => {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    });
  }

  resize(width, height) {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  renderFallback(width, height, time, values, colors) {
    if (!this.ctx) {
      const gl = this.gl;
      this.resize(width, height);
      gl.viewport(0, 0, width, height);
      const fallbackColor = hexToRgb(colors[2]);
      gl.clearColor(fallbackColor[0], fallbackColor[1], fallbackColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    this.resize(width, height);
    const ctx = this.ctx;
    const angle = (values.blendAngle * Math.PI) / 180;
    const dx = Math.cos(angle) * width;
    const dy = Math.sin(angle) * height;
    const gradient = ctx.createLinearGradient(width / 2 - dx / 2, height / 2 - dy / 2, width / 2 + dx / 2, height / 2 + dy / 2);
    gradient.addColorStop(0, colors[2]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[0]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const motion = time * values.timeSpeed * values.warpSpeed;
    const x = width * (0.5 + Math.sin(motion) * 0.24 + values.centerX);
    const y = height * (0.5 + Math.cos(motion * 0.8) * 0.24 + values.centerY);
    const radius = Math.max(width, height) * (0.35 / Math.max(values.zoom, 0.2));
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, colors[0]);
    glow.addColorStop(1, "transparent");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  render(width, height, time, values, colors) {
    if (!this.gl || !this.program) {
      this.renderFallback(width, height, time, values, colors);
      return;
    }

    this.resize(width, height);
    const gl = this.gl;
    const u = this.uniforms;
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(u.iResolution, width, height);
    gl.uniform1f(u.iTime, time);
    gl.uniform1f(u.uTimeSpeed, values.timeSpeed);
    gl.uniform1f(u.uColorBalance, values.colorBalance);
    gl.uniform1f(u.uWarpStrength, values.warpStrength);
    gl.uniform1f(u.uWarpFrequency, values.warpFrequency);
    gl.uniform1f(u.uWarpSpeed, values.warpSpeed);
    gl.uniform1f(u.uWarpAmplitude, values.warpAmplitude);
    gl.uniform1f(u.uBlendAngle, values.blendAngle);
    gl.uniform1f(u.uBlendSoftness, values.blendSoftness);
    gl.uniform1f(u.uRotationAmount, values.rotationAmount);
    gl.uniform1f(u.uNoiseScale, values.noiseScale);
    gl.uniform1f(u.uContrast, values.contrast);
    gl.uniform1f(u.uGamma, values.gamma);
    gl.uniform1f(u.uSaturation, values.saturation);
    gl.uniform2f(u.uCenterOffset, values.centerX, values.centerY);
    gl.uniform1f(u.uZoom, values.zoom);
    gl.uniform3fv(u.uColor1, hexToRgb(colors[0]));
    gl.uniform3fv(u.uColor2, hexToRgb(colors[1]));
    gl.uniform3fv(u.uColor3, hexToRgb(colors[2]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}

const gradientRenderer = new GrainientRenderer(gradientCanvas);

function scaleDimensions(width, height, maxSide, maxPixels, allowUpscale = false) {
  const sideScale = Math.min(maxSide / width, maxSide / height);
  const pixelScale = Math.sqrt(maxPixels / (width * height));
  const scale = allowUpscale ? Math.min(sideScale, pixelScale) : Math.min(1, sideScale, pixelScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

function getRequiredSpacing(width = state.frameWidth, height = state.frameHeight) {
  return Math.max(4, Math.ceil(Math.sqrt((width * height) / MAX_ASCII_CELLS)));
}

function getCellCount(spacing = state.ascii.spacing) {
  return Math.max(1, Math.floor(state.frameWidth / spacing)) * Math.max(1, Math.floor(state.frameHeight / spacing));
}

function enforcePerformanceSpacing() {
  const required = getRequiredSpacing();
  const controls = sliderInputs.get("ascii:spacing");
  if (controls) controls.input.min = String(required);
  let adjusted = false;
  if (state.ascii.spacing < required) {
    state.ascii.spacing = required;
    if (controls) {
      controls.input.value = String(required);
      controls.output.value = String(required);
    }
    adjusted = true;
  }
  const cellCount = getCellCount();
  performanceNote.textContent = adjusted
    ? `为避免卡死，字符间距 已自动调整为 ${required}；当前约 ${cellCount.toLocaleString()} 个字符格。`
    : `当前约 ${cellCount.toLocaleString()} 个字符格，安全上限 ${MAX_ASCII_CELLS.toLocaleString()}。`;
  performanceNote.classList.toggle("is-warning", adjusted);
}

function getGradientSize(targetWidth, targetHeight) {
  return scaleDimensions(targetWidth, targetHeight, MAX_GRADIENT_SIDE, MAX_GRADIENT_PIXELS);
}

function prepareCanvas(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function getCells(targetWidth, targetHeight) {
  const spacing = Math.max(getRequiredSpacing(), state.ascii.spacing);
  const cols = Math.max(1, Math.floor(state.frameWidth / spacing));
  const rows = Math.max(1, Math.floor(state.frameHeight / spacing));
  const stepX = targetWidth / cols;
  const stepY = targetHeight / rows;
  prepareCanvas(sourceCanvas, cols, rows);

  const blurScale = Math.min(cols / state.frameWidth, rows / state.frameHeight);
  sourceCtx.save();
  sourceCtx.clearRect(0, 0, cols, rows);
  sourceCtx.imageSmoothingEnabled = true;
  sourceCtx.filter = [
    `brightness(${100 + state.ascii.brightness}%)`,
    `contrast(${100 + state.ascii.contrast}%)`,
    `blur(${state.ascii.blur * blurScale}px)`,
  ].join(" ");
  sourceCtx.drawImage(gradientCanvas, 0, 0, cols, rows);
  sourceCtx.restore();

  const pixels = sourceCtx.getImageData(0, 0, cols, rows).data;
  const cells = [];
  const threshold = clamp(0.18 + state.ascii.solidFill * 0.00805, 0.18, 0.985);
  const noiseAmount = state.ascii.noise / 100;
  const targetScale = targetWidth / state.frameWidth;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = (row * cols + col) * 4;
      let luma = (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
      if (state.revertTone) luma = 1 - luma;
      if (noiseAmount) luma = clamp(luma + (Math.random() - 0.5) * noiseAmount);
      if (luma >= threshold) continue;
      const darkness = clamp((threshold - luma) / threshold);
      const weight = Math.pow(darkness, state.ascii.toneContrast);
      const rawSize = state.ascii.minShapeSize + weight * (state.ascii.maxDiameter - state.ascii.minShapeSize);
      if (rawSize <= 0.15) continue;
      cells.push({
        x: (col + 0.5) * stepX,
        y: (row + 0.5) * stepY,
        size: rawSize * targetScale,
        weight,
      });
    }
  }
  return { cells, cols, rows };
}

function pickGlyph(weight) {
  if (state.svgGlyphs.length) {
    const index = Math.min(state.svgGlyphs.length - 1, Math.floor(weight * state.svgGlyphs.length));
    return state.svgGlyphs[index];
  }
  const characters = [...(state.textGlyphs || "01")];
  const index = Math.min(characters.length - 1, Math.floor(weight * characters.length));
  return characters[index] || "0";
}

function getGlyphBox(glyph, x, y, size) {
  const aspect = glyph.aspect || 1;
  const width = aspect >= 1 ? size : size * aspect;
  const height = aspect >= 1 ? size / aspect : size;
  return { x: x - width / 2, y: y - height / 2, width, height };
}

function trimGlyphCache() {
  const maxEntries = 1200;
  if (state.glyphCache.size <= maxEntries) return;
  const keys = state.glyphCache.keys();
  const overflow = state.glyphCache.size - maxEntries;
  for (let index = 0; index < overflow; index += 1) state.glyphCache.delete(keys.next().value);
}

function drawSvgGlyph(context, glyph, x, y, size) {
  const box = getGlyphBox(glyph, x, y, size);
  const displaySize = Math.max(1, Math.ceil(size + 4));
  const rasterScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const cacheSize = Math.max(1, Math.ceil(displaySize * rasterScale));
  const cacheKey = `${glyph.id}:${state.foregroundColor}:${displaySize}:${rasterScale}`;
  let cached = state.glyphCache.get(cacheKey);

  if (!cached) {
    prepareCanvas(glyphScratchCanvas, cacheSize, cacheSize);
    glyphScratchCtx.setTransform(1, 0, 0, 1, 0, 0);
    glyphScratchCtx.clearRect(0, 0, cacheSize, cacheSize);
    glyphScratchCtx.imageSmoothingEnabled = true;
    glyphScratchCtx.setTransform(rasterScale, 0, 0, rasterScale, 0, 0);
    glyphScratchCtx.drawImage(
      glyph.image,
      (displaySize - box.width) / 2,
      (displaySize - box.height) / 2,
      box.width,
      box.height,
    );
    glyphScratchCtx.setTransform(1, 0, 0, 1, 0, 0);
    glyphScratchCtx.globalCompositeOperation = "source-in";
    glyphScratchCtx.fillStyle = state.foregroundColor;
    glyphScratchCtx.fillRect(0, 0, cacheSize, cacheSize);
    glyphScratchCtx.globalCompositeOperation = "source-over";

    cached = document.createElement("canvas");
    cached.width = cacheSize;
    cached.height = cacheSize;
    cached.dataset.displaySize = String(displaySize);
    cached.getContext("2d").drawImage(glyphScratchCanvas, 0, 0);
    state.glyphCache.set(cacheKey, cached);
    trimGlyphCache();
  }

  const targetSize = Number(cached.dataset.displaySize);
  context.imageSmoothingEnabled = true;
  context.drawImage(cached, x - targetSize / 2, y - targetSize / 2, targetSize, targetSize);
}

function updateGrainTexture(frameKey, transparentFallback) {
  const textureKey = `${frameKey}:${state.grain.balance}:${transparentFallback ? state.grainBlendMode : "blend"}`;
  if (state.grainTextureFrame === textureKey) return;
  const size = 128;
  prepareCanvas(grainTextureCanvas, size, size);
  const imageData = grainTextureCtx.createImageData(size, size);
  let seed = ((frameKey + 1) * 0x9e3779b1) >>> 0;
  for (let index = 0; index < size * size; index += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const rawValue = (seed & 255) / 255;
    let adjustedValue = clamp(rawValue + state.grain.balance / 200);
    if (transparentFallback) {
      if (state.grainBlendMode === "multiply") adjustedValue *= 0.5;
      else if (state.grainBlendMode === "screen") adjustedValue = 0.5 + adjustedValue * 0.5;
      else if (state.grainBlendMode === "soft-light") adjustedValue = 0.25 + adjustedValue * 0.5;
    }
    const value = Math.round(adjustedValue * 255);
    const offset = index * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }
  grainTextureCtx.putImageData(imageData, 0, 0);
  state.grainTextureFrame = textureKey;
}

function drawFinalGrain(context, width, height, time) {
  if (state.grain.amount <= 0) return;
  const frameKey = state.grainAnimated ? Math.floor(time * VIDEO_FPS) : 0;
  const transparentFallback = state.backgroundMode === "transparent";
  updateGrainTexture(frameKey, transparentFallback);
  const pattern = context.createPattern(grainTextureCanvas, "repeat");
  if (!pattern) return;
  const outputScale = width / state.frameWidth;
  const grainScale = Math.max(0.25, state.grain.scale * outputScale);
  if (typeof pattern.setTransform === "function" && "DOMMatrix" in window) {
    pattern.setTransform(new DOMMatrix().scale(grainScale));
  }
  context.save();
  context.globalAlpha = clamp(state.grain.amount, 0, 1);
  context.globalCompositeOperation = transparentFallback ? "source-atop" : state.grainBlendMode;
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function renderFrame(canvas, context, targetWidth, targetHeight, time, options = {}) {
  prepareCanvas(canvas, targetWidth, targetHeight);
  const gradientSize = getGradientSize(targetWidth, targetHeight);
  gradientRenderer.render(
    gradientSize.width,
    gradientSize.height,
    time,
    state.gradient,
    state.gradientColors,
  );

  const { cells, cols, rows } = getCells(targetWidth, targetHeight);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, targetWidth, targetHeight);

  if (options.forceOpaque && state.backgroundMode === "transparent") {
    context.fillStyle = options.matteColor || "#000000";
    context.fillRect(0, 0, targetWidth, targetHeight);
  } else if (state.backgroundMode === "gradient") {
    context.imageSmoothingEnabled = true;
    context.drawImage(gradientCanvas, 0, 0, targetWidth, targetHeight);
  } else if (state.backgroundMode === "solid") {
    context.fillStyle = state.backgroundColor;
    context.fillRect(0, 0, targetWidth, targetHeight);
  }

  context.save();
  context.globalAlpha = state.glyphOpacity;
  context.globalCompositeOperation = state.blendMode;
  context.fillStyle = state.foregroundColor;
  context.strokeStyle = state.foregroundColor;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const cell of cells) {
    const glyph = pickGlyph(cell.weight);
    if (typeof glyph === "string") {
      context.font = `${cell.size}px ${state.textFont}`;
      context.fillText(glyph, cell.x, cell.y + cell.size * 0.04);
    } else {
      drawSvgGlyph(context, glyph, cell.x, cell.y, cell.size);
    }
  }
  context.restore();
  drawFinalGrain(context, targetWidth, targetHeight, time);
  return { cellCount: cells.length, cols, rows, gradientSize };
}

function getPreviewSize() {
  return scaleDimensions(state.frameWidth, state.frameHeight, MAX_PREVIEW_SIDE, MAX_PREVIEW_PIXELS);
}

function getPreviewFps() {
  const cells = getCellCount();
  if (cells > 18_000) return 24;
  if (cells > 9_000) return 30;
  return 60;
}

function renderPreview() {
  if (state.isExporting) return;
  const preview = getPreviewSize();
  outputCanvas.style.aspectRatio = `${state.frameWidth} / ${state.frameHeight}`;
  const result = renderFrame(outputCanvas, outputCtx, preview.width, preview.height, state.animationTime);
  canvasMeta.textContent = `${state.frameWidth} × ${state.frameHeight} · 预览 ${preview.width} × ${preview.height} · ${result.cellCount.toLocaleString()} 字符 · ${getPreviewFps()}fps`;
}

function requestRender() {
  if (state.isExporting || (state.isPlaying && state.animationFrame)) return;
  if (state.renderRequest) return;
  state.renderRequest = requestAnimationFrame(() => {
    state.renderRequest = 0;
    renderPreview();
  });
}

function animationLoop(timestamp) {
  if (!state.isPlaying || state.isExporting) {
    state.animationFrame = 0;
    return;
  }
  if (state.lastFrameTime) {
    const elapsed = Math.min(0.1, Math.max(0, (timestamp - state.lastFrameTime) / 1000));
    state.animationTime += elapsed;
  }
  state.lastFrameTime = timestamp;
  const previewInterval = 1000 / getPreviewFps();
  if (!state.lastPreviewRenderTime || timestamp - state.lastPreviewRenderTime >= previewInterval) {
    renderPreview();
    state.lastPreviewRenderTime = timestamp;
  }
  state.animationFrame = requestAnimationFrame(animationLoop);
}

function startAnimation() {
  if (state.animationFrame || state.isExporting) return;
  state.isPlaying = true;
  state.lastFrameTime = 0;
  state.lastPreviewRenderTime = 0;
  playToggle.textContent = "Ⅱ";
  playToggle.title = "暂停动画";
  playToggle.setAttribute("aria-label", "暂停动画");
  state.animationFrame = requestAnimationFrame(animationLoop);
}

function pauseAnimation() {
  state.isPlaying = false;
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = 0;
  state.lastFrameTime = 0;
  state.lastPreviewRenderTime = 0;
  playToggle.textContent = "▶";
  playToggle.title = "播放动画";
  playToggle.setAttribute("aria-label", "播放动画");
}

function getSvgMetrics(svg) {
  const viewBox = svg?.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3], aspect: viewBox[2] / viewBox[3] };
  }
  const width = Number.parseFloat(svg?.getAttribute("width") || "");
  const height = Number.parseFloat(svg?.getAttribute("height") || "");
  if (width > 0 && height > 0) return { width, height, aspect: width / height };
  return { width: 100, height: 100, aspect: 1 };
}

function sanitizeSvg(svgText) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const svg = doc.documentElement;
  if (svg.localName !== "svg") return null;
  const allowedTags = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "clipPath", "mask", "title", "desc"]);
  const allowedAttrs = new Set(["xmlns", "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule", "opacity", "fill-opacity", "stroke-opacity", "id", "clip-path", "mask", "preserveAspectRatio"]);
  for (const node of [svg, ...svg.querySelectorAll("*")]) {
    if (!allowedTags.has(node.localName)) { node.remove(); continue; }
    const style = node.getAttribute("style") || "";
    for (const property of ["fill", "stroke", "stroke-width", "fill-rule", "opacity"]) {
      const match = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
      if (match) node.setAttribute(property, match[1].trim());
    }
    for (const attr of [...node.attributes]) {
      const unsafeUrl = /url\s*\(/i.test(attr.value) && !/^url\(#[a-zA-Z_][\w.-]*\)$/.test(attr.value);
      if (!allowedAttrs.has(attr.name) || unsafeUrl || /(?:javascript:|https?:|data:)/i.test(attr.value) && attr.name !== "xmlns") node.removeAttribute(attr.name);
    }
    for (const property of ["fill", "stroke"]) {
      if (node.hasAttribute(property) && node.getAttribute(property) !== "none") node.setAttribute(property, "currentColor");
    }
  }
  const metrics = getSvgMetrics(svg);
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0) {
    svg.setAttribute("viewBox", `0 0 ${metrics.width} ${metrics.height}`);
  }
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(metrics.width));
  svg.setAttribute("height", String(metrics.height));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("fill", "currentColor");
  return { svgText: new XMLSerializer().serializeToString(svg), aspect: metrics.aspect || 1 };
}

function svgToImage(svgText) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG 读取失败"));
    };
    image.src = url;
  });
}

async function loadGlyphFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name));
  if (!files.length) {
    setStatus("请选择 SVG 字符文件。");
    return;
  }

  const glyphs = [];
  let failures = 0;
  for (const file of files) {
    try {
      if (file.size > 2_000_000) throw new Error("SVG 文件过大");
      const sanitized = sanitizeSvg(await file.text());
      if (sanitized && [...state.svgGlyphs, ...glyphs].some(g => g.svgText === sanitized.svgText)) continue;
      if (!sanitized) throw new Error("SVG 格式无效");
      const image = await svgToImage(sanitized.svgText);
      glyphs.push({
        id: ++state.glyphId,
        name: file.name.replace(/\.svg$/i, ""),
        svgText: sanitized.svgText,
        aspect: sanitized.aspect,
        image,
      });
    } catch (error) {
      failures += 1;
      // Invalid uploads are reported as a count without logging file contents.
    }
  }

  state.svgGlyphs.push(...glyphs);
  state.glyphCache.clear();
  renderGlyphList();
  requestRender();
  const failureText = failures ? `，${failures} 个文件读取失败` : "";
  setStatus(`已载入 ${glyphs.length} 个 SVG 字符，共 ${state.svgGlyphs.length} 个${failureText}。`);
}

function renderGlyphList() {
  if (!state.svgGlyphs.length) {
    glyphList.innerHTML = [...(state.textGlyphs || "01")]
      .map((character) => `<span class="glyph-chip text-only"><span class="glyph-preview">${escapeHtml(character)}</span></span>`)
      .join("");
    return;
  }

  glyphList.innerHTML = state.svgGlyphs
    .map((glyph, index) => `
      <span class="glyph-chip" draggable="true" data-glyph-index="${index}" title="${escapeHtml(glyph.name)} · 拖动调整亮暗顺序">
        <span class="glyph-drag" aria-hidden="true">••</span>
        <span class="glyph-preview">${glyph.svgText}</span>
        <button class="glyph-move" type="button" data-move-glyph="${index}" data-direction="-1" aria-label="向亮部移动" ${index === 0 ? "disabled" : ""}>←</button>
        <button class="glyph-move" type="button" data-move-glyph="${index}" data-direction="1" aria-label="向暗部移动" ${index === state.svgGlyphs.length-1 ? "disabled" : ""}>→</button>
        <button class="glyph-delete" type="button" data-delete-glyph="${index}" aria-label="删除 ${escapeHtml(glyph.name)}">×</button>
      </span>
    `)
    .join("");
}

function clearGlyphDropMarkers() {
  glyphList.querySelectorAll(".drop-before, .drop-after, .is-dragging").forEach((element) => {
    element.classList.remove("drop-before", "drop-after", "is-dragging");
  });
}

function moveGlyph(fromIndex, targetIndex, insertAfter) {
  if (fromIndex < 0 || targetIndex < 0 || fromIndex >= state.svgGlyphs.length || targetIndex >= state.svgGlyphs.length) return;
  let insertionIndex = targetIndex + (insertAfter ? 1 : 0);
  const [moved] = state.svgGlyphs.splice(fromIndex, 1);
  if (fromIndex < insertionIndex) insertionIndex -= 1;
  state.svgGlyphs.splice(clamp(insertionIndex, 0, state.svgGlyphs.length), 0, moved);
  state.glyphCache.clear();
  renderGlyphList();
  requestRender();
  setStatus("SVG 顺序已更新：左侧映射较亮区域，右侧映射较暗区域。");
}

function setupDropZone(zone, onFiles) {
  ["dragenter", "dragover"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.add("is-dragging");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove("is-dragging");
    });
  });
  zone.addEventListener("drop", (event) => onFiles(event.dataTransfer?.files));
}

function updateBackgroundControls() {
  const solid = state.backgroundMode === "solid";
  bgColorField.classList.toggle("is-disabled", !solid);
  bgColorInput.disabled = !solid;
  bgColorHexInput.disabled = !solid;
  canvasWrap.classList.toggle("is-transparent", state.backgroundMode === "transparent");
}

function normalizeFrameDimensions(width, height) {
  let normalizedWidth = clamp(Math.round(Number(width) || state.frameWidth), MIN_FRAME_SIDE, MAX_FRAME_SIDE);
  let normalizedHeight = clamp(Math.round(Number(height) || state.frameHeight), MIN_FRAME_SIDE, MAX_FRAME_SIDE);
  const pixels = normalizedWidth * normalizedHeight;
  if (pixels > MAX_FRAME_PIXELS) {
    const scale = Math.sqrt(MAX_FRAME_PIXELS / pixels);
    normalizedWidth = Math.max(MIN_FRAME_SIDE, Math.floor(normalizedWidth * scale));
    normalizedHeight = Math.max(MIN_FRAME_SIDE, Math.floor(normalizedHeight * scale));
  }
  return { width: normalizedWidth, height: normalizedHeight };
}

function matchFramePreset() {
  const value = `${state.frameWidth}x${state.frameHeight}`;
  const option = [...framePresetInput.options].find((item) => item.value === value);
  framePresetInput.value = option ? value : "custom";
}

function isPngSizeAllowed(multiplier) {
  const width = state.frameWidth * multiplier;
  const height = state.frameHeight * multiplier;
  return width <= MAX_PNG_SIDE && height <= MAX_PNG_SIDE && width * height <= MAX_PNG_PIXELS;
}

function updateExportAvailability() {
  document.querySelectorAll("[data-export-png]").forEach((button) => {
    const multiplier = Number(button.dataset.exportPng);
    const width = state.frameWidth * multiplier;
    const height = state.frameHeight * multiplier;
    const allowed = isPngSizeAllowed(multiplier);
    button.disabled = state.isExporting || !allowed;
    button.title = allowed ? `导出 ${width} × ${height}` : `${width} × ${height} 超出安全导出上限`;
  });
  exportVideoButton.disabled = state.isExporting;
}

function applyFrameSize(width, height, updateRatio = true) {
  const normalized = normalizeFrameDimensions(width, height);
  state.frameWidth = normalized.width;
  state.frameHeight = normalized.height;
  if (updateRatio) state.aspectRatio = state.frameWidth / state.frameHeight;
  frameWidthInput.value = String(state.frameWidth);
  frameHeightInput.value = String(state.frameHeight);
  matchFramePreset();
  enforcePerformanceSpacing();
  updateExportAvailability();
  requestRender();
}

function commitFrameDimension(changedDimension) {
  let width = Number(frameWidthInput.value);
  let height = Number(frameHeightInput.value);
  if (lockAspectInput.checked) {
    if (changedDimension === "width") height = Math.round(width / state.aspectRatio);
    else width = Math.round(height * state.aspectRatio);
  }
  applyFrameSize(width, height, false);
}

function getVideoSize() {
  const scaled = scaleDimensions(state.frameWidth, state.frameHeight, MAX_VIDEO_SIDE, MAX_VIDEO_PIXELS);
  return {
    width: Math.max(2, Math.floor(scaled.width / 2) * 2),
    height: Math.max(2, Math.floor(scaled.height / 2) * 2),
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas 导出失败"));
    }, type);
  });
}

function beginExport() {
  const wasPlaying = state.isPlaying;
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = 0;
  state.lastFrameTime = 0;
  state.isExporting = true;
  panel.inert = true;
  updateExportAvailability();
  return wasPlaying;
}

function finishExport(wasPlaying) {
  state.isExporting = false;
  panel.inert = false;
  updateExportAvailability();
  renderPreview();
  if (wasPlaying) startAnimation();
  else pauseAnimation();
}

async function exportPng(multiplier) {
  if (!isPngSizeAllowed(multiplier) || state.isExporting) return;
  const wasPlaying = beginExport();
  const width = state.frameWidth * multiplier;
  const height = state.frameHeight * multiplier;
  const exportCanvas = document.createElement("canvas");
  const context = exportCanvas.getContext("2d", { alpha: true });

  try {
    setExportProgress(10);
    setStatus(`正在渲染 PNG ${width} × ${height}…`);
    renderFrame(exportCanvas, context, width, height, state.animationTime);
    setExportProgress(72);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const blob = await canvasToBlob(exportCanvas);
    downloadBlob(blob, `ascii-${width}x${height}.png`);
    setExportProgress(100);
    setStatus(`PNG 已导出：${width} × ${height}。`);
  } catch (error) {
    console.error(error);
    setStatus("PNG 导出失败，请降低画幅尺寸或导出倍率。");
    setExportProgress(0, false);
  } finally {
    exportCanvas.width = 1;
    exportCanvas.height = 1;
    finishExport(wasPlaying);
  }
}

const textEncoder = new TextEncoder();

function bytes(...parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function ascii(value) {
  return textEncoder.encode(value);
}

function u8(value) {
  return new Uint8Array([value & 255]);
}

function u16(value) {
  return new Uint8Array([(value >>> 8) & 255, value & 255]);
}

function u24(value) {
  return new Uint8Array([(value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function u32(value) {
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function fixed16(value) {
  return u32(Math.round(value * 65536));
}

function box(type, ...payloads) {
  const payload = bytes(...payloads);
  return bytes(u32(payload.length + 8), ascii(type), payload);
}

function fullBox(type, version, flags, ...payloads) {
  return box(type, u8(version), u24(flags), ...payloads);
}

function makeStsd(width, height, avcConfig) {
  const compressor = new Uint8Array(32);
  const avc1 = box(
    "avc1", new Uint8Array(6), u16(1), new Uint8Array(16), u16(width), u16(height),
    u32(0x00480000), u32(0x00480000), u32(0), u16(1), compressor, u16(24), u16(0xffff),
    box("avcC", avcConfig),
  );
  return fullBox("stsd", 0, 0, u32(1), avc1);
}

function makeMp4({ chunks, avcConfig, width, height, fps }) {
  const timescale = 90000;
  const sampleDurations = chunks.map((chunk) => Math.max(1, Math.round(((chunk.duration || Math.round(1_000_000 / fps)) / 1_000_000) * timescale)));
  const duration = sampleDurations.reduce((total, value) => total + value, 0);
  const sizes = chunks.map((chunk) => chunk.data.length);
  const mdat = box("mdat", bytes(...chunks.map((chunk) => chunk.data)));

  const makeMoov = (chunkOffset) => {
    const timingEntries = [];
    sampleDurations.forEach((sampleDuration) => {
      const last = timingEntries[timingEntries.length - 1];
      if (last && last.duration === sampleDuration) last.count += 1;
      else timingEntries.push({ count: 1, duration: sampleDuration });
    });
    const stts = fullBox("stts", 0, 0, u32(timingEntries.length), ...timingEntries.flatMap((entry) => [u32(entry.count), u32(entry.duration)]));
    const stsc = fullBox("stsc", 0, 0, u32(1), u32(1), u32(chunks.length), u32(1));
    const stsz = fullBox("stsz", 0, 0, u32(0), u32(chunks.length), ...sizes.map(u32));
    const stco = fullBox("stco", 0, 0, u32(1), u32(chunkOffset));
    const syncSamples = chunks.map((chunk, index) => (chunk.type === "key" ? index + 1 : 0)).filter(Boolean);
    const stss = fullBox("stss", 0, 0, u32(syncSamples.length), ...syncSamples.map(u32));
    const stbl = box("stbl", makeStsd(width, height, avcConfig), stts, stsc, stsz, stco, stss);
    const dinf = box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1)));
    const minf = box("minf", fullBox("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf, stbl);
    const hdlr = fullBox("hdlr", 0, 0, u32(0), ascii("vide"), new Uint8Array(12), ascii("VideoHandler\0"));
    const mdhd = fullBox("mdhd", 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
    const mdia = box("mdia", mdhd, hdlr, minf);
    const tkhd = fullBox(
      "tkhd", 0, 7, u32(0), u32(0), u32(1), u32(0), u32(duration), new Uint8Array(8),
      u16(0), u16(0), u16(0), u16(0),
      u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000),
      fixed16(width), fixed16(height),
    );
    const trak = box("trak", tkhd, mdia);
    const mvhd = fullBox(
      "mvhd", 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u32(0x00010000),
      u16(0x0100), u16(0), new Uint8Array(8),
      u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000),
      new Uint8Array(24), u32(2),
    );
    return box("moov", mvhd, trak);
  };

  const ftyp = box("ftyp", ascii("isom"), u32(0x200), ascii("isom"), ascii("iso2"), ascii("avc1"), ascii("mp41"));
  const placeholderMoov = makeMoov(0);
  const moov = makeMoov(ftyp.length + placeholderMoov.length + 8);
  return bytes(ftyp, moov, mdat);
}

function getSupportedVideoMime() {
  if (!("MediaRecorder" in window)) return "";
  const types = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function waitForEncoderCapacity(encoder) {
  while (encoder.encodeQueueSize > 8) {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
}

async function exportVideoOffline(videoCanvas, context, width, height, duration) {
  if (!("VideoEncoder" in window) || !("VideoFrame" in window)) return false;

  const candidateConfigs = ["avc1.42002A", "avc1.42E01E"].map((codec) => ({
    codec,
    width,
    height,
    bitrate: 10_000_000,
    framerate: VIDEO_FPS,
    avc: { format: "avc" },
  }));
  let config = null;
  for (const candidate of candidateConfigs) {
    try {
      const support = await VideoEncoder.isConfigSupported(candidate);
      if (support.supported) {
        config = support.config || candidate;
        break;
      }
    } catch {
      // Try the next H.264 profile.
    }
  }
  if (!config) return false;

  const chunks = [];
  let avcConfig = null;
  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({
        data,
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration || Math.round(1_000_000 / VIDEO_FPS),
      });
      if (metadata?.decoderConfig?.description) avcConfig = new Uint8Array(metadata.decoderConfig.description);
    },
    error: (error) => {
      encoderError = error;
    },
  });
  encoder.configure(config);

  const frameCount = duration * VIDEO_FPS;
  setStatus(`正在逐帧导出 ${duration} 秒 MP4，请保持页面打开。`);
  setExportProgress(0);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    if (encoderError) throw encoderError;
    const time = frameIndex / VIDEO_FPS;
    renderFrame(videoCanvas, context, width, height, time, { forceOpaque: true, matteColor: "#000000" });
    const frame = new VideoFrame(videoCanvas, {
      timestamp: Math.round(time * 1_000_000),
      duration: Math.round(1_000_000 / VIDEO_FPS),
    });
    encoder.encode(frame, { keyFrame: frameIndex % VIDEO_FPS === 0 });
    frame.close();
    await waitForEncoderCapacity(encoder);

    if (frameIndex % 3 === 0 || frameIndex === frameCount - 1) {
      const percent = ((frameIndex + 1) / frameCount) * 100;
      setExportProgress(percent);
      setStatus(`正在导出 MP4 ${Math.round(percent)}% · ${frameIndex + 1} / ${frameCount} 帧`);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  await encoder.flush();
  encoder.close();
  if (encoderError) throw encoderError;
  if (!avcConfig || !chunks.length) return false;
  chunks.sort((first, second) => first.timestamp - second.timestamp);
  const mp4 = makeMp4({ chunks, avcConfig, width, height, fps: VIDEO_FPS });
  downloadBlob(new Blob([mp4], { type: "video/mp4" }), `ascii-video-${duration}s.mp4`);
  setExportProgress(100);
  setStatus(`视频已导出：${width} × ${height} · ${duration} 秒 · ${VIDEO_FPS}fps。`);
  return true;
}

async function exportVideoRealtime(videoCanvas, context, width, height, duration) {
  const mimeType = getSupportedVideoMime();
  if (!mimeType || typeof videoCanvas.captureStream !== "function") {
    throw new Error("当前浏览器不支持视频录制");
  }

  renderFrame(videoCanvas, context, width, height, 0, { forceOpaque: true, matteColor: "#000000" });
  let stream = videoCanvas.captureStream(0);
  let [videoTrack] = stream.getVideoTracks();
  const manualFrames = Boolean(videoTrack?.requestFrame);
  if (!manualFrames) {
    stream.getTracks().forEach((track) => track.stop());
    stream = videoCanvas.captureStream(VIDEO_FPS);
    [videoTrack] = stream.getVideoTracks();
  }

  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10_000_000 });
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (event) => reject(event.error || new Error("MediaRecorder failed"));
  });

  recorder.start(1000);
  const frameCount = duration * VIDEO_FPS;
  const startedAt = performance.now();
  setStatus(`当前浏览器正在实时录制 ${duration} 秒视频。`);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const scheduledAt = startedAt + (frameIndex * 1000) / VIDEO_FPS;
    const wait = scheduledAt - performance.now();
    if (wait > 1) await new Promise((resolve) => window.setTimeout(resolve, wait));
    const time = frameIndex / VIDEO_FPS;
    renderFrame(videoCanvas, context, width, height, time, { forceOpaque: true, matteColor: "#000000" });
    videoTrack?.requestFrame?.();
    if (frameIndex % 15 === 0 || frameIndex === frameCount - 1) {
      const percent = ((frameIndex + 1) / frameCount) * 100;
      setExportProgress(percent);
      setStatus(`正在实时录制 ${Math.round(percent)}% · ${frameIndex + 1} / ${frameCount} 帧`);
    }
  }

  await new Promise((resolve) => window.setTimeout(resolve, 100));
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  if (!chunks.length) throw new Error("视频录制没有产生数据");
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  downloadBlob(new Blob(chunks, { type: mimeType }), `ascii-video-${duration}s.${extension}`);
  setExportProgress(100);
  setStatus(`视频已导出 ${extension.toUpperCase()}：${width} × ${height} · ${duration} 秒。`);
}

async function exportVideo() {
  if (state.isExporting) return;
  const wasPlaying = beginExport();
  const duration = Number(videoDurationInput.value);
  const { width, height } = getVideoSize();
  const videoCanvas = document.createElement("canvas");
  const context = videoCanvas.getContext("2d", { alpha: false });

  try {
    const transparentNote = state.backgroundMode === "transparent" ? "透明背景将使用黑色填充。" : "";
    setStatus(`准备导出 ${width} × ${height} 视频。${transparentNote}`);
    setExportProgress(0);
    const exportedOffline = await exportVideoOffline(videoCanvas, context, width, height, duration);
    if (!exportedOffline) {
      setStatus("离线 MP4 编码不可用，正在切换到实时录制。");
      await exportVideoRealtime(videoCanvas, context, width, height, duration);
    }
  } catch (error) {
    console.error(error);
    setStatus("视频导出失败，请降低画幅尺寸、增大 字符间距，或改用最新版 Chrome。 ");
    setExportProgress(0, false);
  } finally {
    videoCanvas.width = 1;
    videoCanvas.height = 1;
    finishExport(wasPlaying);
  }
}

async function loadLocalFont(fontFamily) {
  if (!LOCAL_FONTS.has(fontFamily)) return;
  setStatus("正在加载字体…");
  try {
    await document.fonts.load(`16px ${fontFamily}`);
    setStatus("已使用本机字体；未安装时使用系统回退字体。");
  } catch {
    setStatus("字体加载失败，将使用回退字体。");
  }
}

function resetAll() {
  cancelAnimationFrame(state.animationFrame);
  cancelAnimationFrame(state.renderRequest);
  state.animationFrame = 0;
  state.renderRequest = 0;
  state.lastFrameTime = 0;
  state.lastPreviewRenderTime = 0;
  state.animationTime = 0;
  state.isPlaying = !reducedMotion.matches;
  Object.assign(state.ascii, asciiDefaults);
  Object.assign(state.gradient, gradientDefaults);
  Object.assign(state.grain, grainDefaults);
  state.gradientColors = ["#48FF28", "#2C3D32", "#65A865"];
  state.backgroundMode = "gradient";
  state.backgroundColor = "#000000";
  state.foregroundColor = "#FFFFFF";
  state.blendMode = "source-over";
  state.glyphOpacity = 1;
  state.revertTone = false;
  state.grainAnimated = false;
  state.grainBlendMode = "soft-light";
  state.grainTextureFrame = -1;
  state.textGlyphs = "01";
  state.textFont = "monospace";
  state.svgGlyphs = [];
  state.glyphCache.clear();
  state.glyphId = 0;
  state.frameWidth = 1920;
  state.frameHeight = 1080;
  state.aspectRatio = 16 / 9;

  syncSliderGroup(asciiSliderConfig, state.ascii, "ascii");
  syncSliderGroup(gradientSliderConfig, state.gradient, "gradient");
  syncSliderGroup(grainSliderConfig, state.grain, "grain");
  gradientColorInputs.forEach((input, index) => {
    input.value = state.gradientColors[index];
    gradientColorHexInputs[index].value = state.gradientColors[index];
  });
  fgColorInput.value = state.foregroundColor;
  fgColorHexInput.value = state.foregroundColor;
  bgColorInput.value = state.backgroundColor;
  bgColorHexInput.value = state.backgroundColor;
  backgroundModeInput.value = state.backgroundMode;
  blendModeInput.value = state.blendMode;
  glyphOpacityInput.value = "100";
  glyphOpacityValue.value = "100%";
  revertToneInput.checked = false;
  grainAnimatedInput.checked = false;
  grainBlendModeInput.value = "soft-light";
  textGlyphsInput.value = "01";
  textFontInput.value = "monospace";
  glyphUpload.value = "";
  frameWidthInput.value = "1920";
  frameHeightInput.value = "1080";
  framePresetInput.value = "1920x1080";
  lockAspectInput.checked = true;
  videoDurationInput.value = "5";
  setExportProgress(0, false);
  updateBackgroundControls();
  renderGlyphList();
  enforcePerformanceSpacing();
  updateExportAvailability();
  setStatus("已重置全部参数。");
  renderPreview();
  if (state.isPlaying) startAnimation(); else pauseAnimation();
}

setupSliderGroup(gradientSlidersEl, gradientSliderConfig, state.gradient, "gradient");
setupSliderGroup(asciiSlidersEl, asciiSliderConfig, state.ascii, "ascii");
setupSliderGroup(grainSlidersEl, grainSliderConfig, state.grain, "grain");

gradientColorInputs.forEach((input, index) => {
  bindColorControls(input, gradientColorHexInputs[index], (color) => {
    state.gradientColors[index] = color;
  });
});
bindColorControls(fgColorInput, fgColorHexInput, (color) => {
  state.foregroundColor = color;
  state.glyphCache.clear();
});
bindColorControls(bgColorInput, bgColorHexInput, (color) => {
  state.backgroundColor = color;
});

glyphUpload.addEventListener("change", async (event) => {
  await loadGlyphFiles(event.target.files);
  event.target.value = "";
});
setupDropZone(glyphDropZone, loadGlyphFiles);

glyphList.addEventListener("click", (event) => {
  const move = event.target.closest("[data-move-glyph]");
  if (move) { const i=Number(move.dataset.moveGlyph), d=Number(move.dataset.direction); moveGlyph(i,i+d,d>0); glyphList.querySelector(`[data-move-glyph="${i+d}"][data-direction="${d}"]`)?.focus(); return; }
  const deleteButton = event.target.closest("[data-delete-glyph]");
  if (!deleteButton) return;
  state.svgGlyphs.splice(Number(deleteButton.dataset.deleteGlyph), 1);
  state.glyphCache.clear();
  renderGlyphList();
  requestRender();
  setStatus(state.svgGlyphs.length ? `已删除字符，剩余 ${state.svgGlyphs.length} 个。` : "已清空 SVG 字符，恢复默认文本字符。");
});

glyphList.addEventListener("dragstart", (event) => {
  const chip = event.target.closest("[data-glyph-index]");
  if (!chip) return;
  state.dragGlyphIndex = Number(chip.dataset.glyphIndex);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(state.dragGlyphIndex));
  requestAnimationFrame(() => chip.classList.add("is-dragging"));
});

glyphList.addEventListener("dragover", (event) => {
  if (state.dragGlyphIndex < 0) return;
  const chip = event.target.closest("[data-glyph-index]");
  if (!chip) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  glyphList.querySelectorAll(".drop-before, .drop-after").forEach((element) => element.classList.remove("drop-before", "drop-after"));
  const bounds = chip.getBoundingClientRect();
  const insertAfter = event.clientX > bounds.left + bounds.width / 2;
  chip.classList.add(insertAfter ? "drop-after" : "drop-before");
  state.dragDropIndex = Number(chip.dataset.glyphIndex);
  state.dragDropAfter = insertAfter;
});

glyphList.addEventListener("drop", (event) => {
  if (state.dragGlyphIndex < 0 || state.dragDropIndex < 0) return;
  event.preventDefault();
  moveGlyph(state.dragGlyphIndex, state.dragDropIndex, state.dragDropAfter);
  state.dragGlyphIndex = -1;
  state.dragDropIndex = -1;
  clearGlyphDropMarkers();
});

glyphList.addEventListener("dragend", () => {
  state.dragGlyphIndex = -1;
  state.dragDropIndex = -1;
  clearGlyphDropMarkers();
});

textGlyphsInput.addEventListener("input", () => {
  state.textGlyphs = textGlyphsInput.value || "01";
  renderGlyphList();
  requestRender();
});

textFontInput.addEventListener("change", async () => {
  state.textFont = textFontInput.value;
  await loadLocalFont(state.textFont);
  requestRender();
});

grainAnimatedInput.addEventListener("change", () => {
  state.grainAnimated = grainAnimatedInput.checked;
  state.grainTextureFrame = -1;
  requestRender();
});

grainBlendModeInput.addEventListener("change", () => {
  state.grainBlendMode = grainBlendModeInput.value;
  requestRender();
});

blendModeInput.addEventListener("change", () => {
  state.blendMode = blendModeInput.value;
  requestRender();
});

glyphOpacityInput.addEventListener("input", () => {
  state.glyphOpacity = Number(glyphOpacityInput.value) / 100;
  glyphOpacityValue.value = `${glyphOpacityInput.value}%`;
  requestRender();
});

revertToneInput.addEventListener("change", () => {
  state.revertTone = revertToneInput.checked;
  requestRender();
});

backgroundModeInput.addEventListener("change", () => {
  state.backgroundMode = backgroundModeInput.value;
  updateBackgroundControls();
  requestRender();
});

framePresetInput.addEventListener("change", () => {
  if (framePresetInput.value === "custom") return;
  const [width, height] = framePresetInput.value.split("x").map(Number);
  state.aspectRatio = width / height;
  applyFrameSize(width, height, false);
});

frameWidthInput.addEventListener("change", () => commitFrameDimension("width"));
frameHeightInput.addEventListener("change", () => commitFrameDimension("height"));
lockAspectInput.addEventListener("change", () => {
  if (lockAspectInput.checked) state.aspectRatio = state.frameWidth / state.frameHeight;
});

const spacingControls = sliderInputs.get("ascii:spacing");
spacingControls.input.addEventListener("input", () => {
  enforcePerformanceSpacing();
  updateExportAvailability();
});

playToggle.addEventListener("click", () => {
  if (state.isPlaying) pauseAnimation();
  else startAnimation();
});

restartAnimationButton.addEventListener("click", () => {
  state.animationTime = 0;
  state.lastFrameTime = 0;
  requestRender();
});

document.querySelectorAll("[data-export-png]").forEach((button) => {
  button.addEventListener("click", () => exportPng(Number(button.dataset.exportPng)));
});
exportVideoButton.addEventListener("click", exportVideo);
resetAllButton.addEventListener("click", resetAll);

renderGlyphList();
updateBackgroundControls();
enforcePerformanceSpacing();
updateExportAvailability();
renderPreview();
if (state.isPlaying) startAnimation(); else pauseAnimation();
reducedMotion.addEventListener("change", e => { if(e.matches) pauseAnimation(); });
