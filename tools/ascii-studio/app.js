const outputCanvas = document.querySelector("#outputCanvas");
const outputCtx = outputCanvas.getContext("2d", { alpha: false });
const sourceCanvas = document.querySelector("#sourceCanvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const glyphCanvas = document.createElement("canvas");
const glyphCtx = glyphCanvas.getContext("2d");
const sourceVideo = document.querySelector("#sourceVideo");
const sourceImage = document.querySelector("#sourceImage");

const glyphUpload = document.querySelector("#glyphUpload");
const mediaUpload = document.querySelector("#mediaUpload");
const glyphDropZone = document.querySelector("#glyphDropZone");
const mediaDropZone = document.querySelector("#mediaDropZone");
const textGlyphsInput = document.querySelector("#textGlyphs");
const textFont = document.querySelector("#textFont");
const glyphList = document.querySelector("#glyphList");
const fgColor = document.querySelector("#fgColor");
const bgColor = document.querySelector("#bgColor");
const fgColorHex = document.querySelector("#fgColorHex");
const bgColorHex = document.querySelector("#bgColorHex");
const bgColorEnd = document.querySelector("#bgColorEnd");
const bgColorEndHex = document.querySelector("#bgColorEndHex");
const useGradient = document.querySelector("#useGradient");
const bgGradientEndField = document.querySelector("#bgGradientEndField");
const canvasScale = document.querySelector("#canvasScale");
const canvasScaleValue = document.querySelector("#canvasScaleValue");
const slidersEl = document.querySelector("#sliders");
const playToggle = document.querySelector("#playToggle");
const resetMedia = document.querySelector("#resetMedia");
const mediaMeta = document.querySelector("#mediaMeta");
const canvasMeta = document.querySelector("#canvasMeta");
const exportStatus = document.querySelector("#exportStatus");
const exportProgress = document.querySelector("#exportProgress");
const exportSvgButton = document.querySelector("#exportSvg");
const exportVideoButton = document.querySelector("#exportVideo");
const resetAllButton = document.querySelector("#resetAll");
const EXPORT_VIDEO_FPS = 60;

const sliderConfig = [
  ["brightness", "亮度", -100, 100, 0, 1],
  ["contrast", "对比度", -100, 100, 0, 1],
  ["blur", "模糊", 0, 12, 0, 0.1],
  ["noise", "噪点", 0, 100, 0, 1],
  ["spacing", "间距", 4, 64, 18, 1],
  ["maxDiameter", "最大尺寸", 2, 96, 22, 1],
  ["toneContrast", "明暗强度", 0.2, 4, 1.25, 0.05],
  ["solidFill", "填充阈值", 0, 100, 65, 1],
  ["minShapeSize", "最小尺寸", 0, 48, 1.5, 0.5],
  ["videoSpeed", "播放速度", 0.5, 1.5, 1, 0.05],
];

const state = {
  mode: "empty",
  objectUrl: "",
  mediaWidth: 0,
  mediaHeight: 0,
  raf: 0,
  videoFrameRequest: 0,
  renderQueued: 0,
  lastRenderedVideoTime: -1,
  isExporting: false,
  svgGlyphs: [],
  glyphCache: new Map(),
  textGlyphs: "01",
  textFont: "monospace",
  values: Object.fromEntries(sliderConfig.map(([key, , , , value]) => [key, value])),
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const defaultValues = Object.fromEntries(sliderConfig.map(([key, , , , value]) => [key, value]));

function setupSliders() {
  slidersEl.innerHTML = sliderConfig
    .map(
      ([key, label, min, max, value, step]) => `
        <div class="slider-row">
          <label>
            <span>${label}</span>
            <input id="${key}" type="range" min="${min}" max="${max}" value="${value}" step="${step}" />
          </label>
          <output id="${key}Value">${value}</output>
        </div>
      `,
    )
    .join("");

  sliderConfig.forEach(([key]) => {
    const input = document.querySelector(`#${key}`);
    const output = document.querySelector(`#${key}Value`);
    input.addEventListener("input", () => {
      state.values[key] = Number(input.value);
      output.value = input.value;
      if (key === "videoSpeed") applyVideoSpeed();
      requestRender();
    });
  });
}

function setStatus(text) {
  exportStatus.textContent = text;
}

function setExportProgress(value, visible = true) {
  exportProgress.hidden = !visible;
  exportProgress.value = Math.round(clamp(value, 0, 100));
}

function normalizeHexColor(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return "";
  let hex = match[1];
  if (hex.length === 3) {
    hex = [...hex].map((char) => char + char).join("");
  }
  return `#${hex.toUpperCase()}`;
}

function syncHexFromColor(colorInput, hexInput) {
  hexInput.value = colorInput.value.toUpperCase();
}

function bindColorControls(colorInput, hexInput) {
  colorInput.addEventListener("input", () => {
    syncHexFromColor(colorInput, hexInput);
    state.glyphCache.clear();
    requestRender();
  });

  hexInput.addEventListener("input", () => {
    const normalized = normalizeHexColor(hexInput.value);
    if (!normalized) return;
    colorInput.value = normalized;
    hexInput.value = normalized;
    state.glyphCache.clear();
    requestRender();
  });

  hexInput.addEventListener("blur", () => {
    const normalized = normalizeHexColor(hexInput.value);
    syncHexFromColor(colorInput, hexInput);
    if (normalized) {
      colorInput.value = normalized;
      syncHexFromColor(colorInput, hexInput);
    }
  });
}

function getBackgroundPaint(ctx, width, height) {
  if (!useGradient.checked || bgColor.value === bgColorEnd.value) return bgColor.value;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, bgColor.value);
  gradient.addColorStop(1, bgColorEnd.value);
  return gradient;
}

function updateGradientControls() {
  const enabled = useGradient.checked;
  bgGradientEndField.classList.toggle("is-disabled", !enabled);
  bgColorEnd.disabled = !enabled;
  bgColorEndHex.disabled = !enabled;
}

function revokeObjectUrl() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = "";
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
  return new XMLSerializer().serializeToString(svg);
}

function svgToSymbol(svgText, id) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return "";
  const viewBox = svg.getAttribute("viewBox") || `0 0 ${svg.getAttribute("width") || 100} ${svg.getAttribute("height") || 100}`;
  return `<symbol id="${id}" viewBox="${escapeHtml(viewBox)}" preserveAspectRatio="none">${svg.innerHTML}</symbol>`;
}

function getSvgMetrics(svg) {
  const viewBox = svg?.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3], aspect: viewBox[2] / viewBox[3] };
  }

  const width = parseFloat(svg?.getAttribute("width") || "");
  const height = parseFloat(svg?.getAttribute("height") || "");
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return { width, height, aspect: width / height };

  return { width: 100, height: 100, aspect: 1 };
}

function getSvgAspect(svgText, image) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  const metrics = getSvgMetrics(svg);
  if (metrics.aspect > 0) return metrics.aspect;

  if (image?.naturalWidth > 0 && image?.naturalHeight > 0) return image.naturalWidth / image.naturalHeight;
  return 1;
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
  if (state.isExporting) return;
  const files = Array.from(fileList || []).filter((file) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name));
  if (!files.length) {
    setStatus("请拖入 SVG 字符文件。");
    return;
  }

  const glyphs = [];
  let rejected = 0;
  for (const file of files) {
    try {
      const svgText = sanitizeSvg(await file.text());
      if (!svgText) { rejected += 1; continue; }
      const image = await svgToImage(svgText);
      const svg = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
      glyphs.push({
        name: file.name.replace(/\.svg$/i, ""), svgText, image,
        aspect: getSvgAspect(svgText, image),
        viewBoxValues: svg.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number),
      });
    } catch { rejected += 1; }
  }
  state.glyphCache.clear();
  state.svgGlyphs = [...state.svgGlyphs, ...glyphs];
  renderGlyphList();
  requestRender();
  setStatus(`已载入 ${glyphs.length} 个 SVG 字符，共 ${state.svgGlyphs.length} 个。${rejected ? ` ${rejected} 个文件无法读取。` : ""}`);
}

async function handleGlyphUpload(event) {
  await loadGlyphFiles(event.target.files);
  event.target.value = "";
}

function renderGlyphList() {
  if (state.svgGlyphs.length) {
    glyphList.innerHTML = state.svgGlyphs
      .map(
        (glyph, index) => `
          <span class="glyph-chip" title="${escapeHtml(glyph.name)}">
            <span class="glyph-preview">${glyph.svgText}</span>
            <button class="glyph-delete" type="button" data-delete-glyph="${index}" title="删除" aria-label="删除字符">×</button>
          </span>
        `,
      )
      .join("");
    return;
  }

  glyphList.innerHTML = [...state.textGlyphs || "01"]
    .map((char) => `<span class="glyph-chip text-only"><span class="glyph-preview">${escapeHtml(char)}</span></span>`)
    .join("");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setMediaButtons() {
  const isVideo = state.mode === "video";
  playToggle.disabled = !isVideo || state.isExporting;
  resetMedia.disabled = state.mode === "empty" || state.isExporting;
  exportVideoButton.disabled = !isVideo || state.isExporting;
  document.querySelectorAll(".panel input, .panel select, .panel button").forEach((control) => {
    if (![playToggle, resetMedia, exportVideoButton].includes(control)) control.disabled = state.isExporting;
  });
  document.querySelectorAll("[data-export-png], #exportSvg").forEach((button) => {
    button.disabled = state.mode === "empty" || state.isExporting;
  });
  document.querySelector("#emptyHint").hidden = state.mode !== "empty";
}

function applyVideoSpeed() {
  sourceVideo.playbackRate = state.values.videoSpeed;
}

function loadMediaFile(fileList) {
  const file = Array.from(fileList || []).find((item) => item.type.startsWith("image/") || item.type.startsWith("video/"));
  if (state.isExporting) return;
  if (!file) { setStatus("请选择图片或视频文件。"); return; }

  clearMedia();
  setStatus("正在读取素材…");
  sourceImage.onerror = sourceVideo.onerror = () => { clearMedia(); setStatus("无法读取素材，请更换文件或格式。"); };
  cancelAnimationFrame(state.raf);
  revokeObjectUrl();
  state.objectUrl = URL.createObjectURL(file);
  if (file.type.startsWith("video/")) {
    state.mode = "video";
    sourceVideo.src = state.objectUrl;
    applyVideoSpeed();
    sourceVideo.load();
    sourceVideo.onloadedmetadata = () => {
      state.mediaWidth = sourceVideo.videoWidth;
      state.mediaHeight = sourceVideo.videoHeight;
      updateCanvasSize();
      mediaMeta.textContent = `${state.mediaWidth} x ${state.mediaHeight} · ${formatTime(sourceVideo.duration)}`;
      setMediaButtons();
      requestRender();
      setStatus("视频已载入，可播放预览或导出无声视频。");
    };
    sourceVideo.onplay = startRenderLoop;
    sourceVideo.onpause = stopRenderLoop;
    sourceVideo.onended = () => {
      playToggle.textContent = "▶";
      stopRenderLoop();
    };
    return;
  }

  state.mode = "image";
  sourceImage.onload = () => {
    state.mediaWidth = sourceImage.naturalWidth;
    state.mediaHeight = sourceImage.naturalHeight;
    updateCanvasSize();
    mediaMeta.textContent = `${state.mediaWidth} x ${state.mediaHeight}`;
    setMediaButtons();
    requestRender();
    setStatus("图片已载入，可以调整参数并导出。");
  };
  sourceImage.src = state.objectUrl;
}

function clearMedia() {
  cancelAnimationFrame(state.raf);
  stopRenderLoop();
  revokeObjectUrl();
  sourceVideo.pause();
  sourceVideo.removeAttribute("src");
  sourceVideo.load();
  sourceImage.removeAttribute("src");
  mediaUpload.value = "";

  state.mode = "empty";
  state.mediaWidth = 0;
  state.mediaHeight = 0;
  state.lastRenderedVideoTime = -1;
  playToggle.textContent = "▶";
  mediaMeta.textContent = "等待素材";
  canvasMeta.textContent = "-";
  outputCtx.fillStyle = getBackgroundPaint(outputCtx, outputCanvas.width, outputCanvas.height);
  outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  setExportProgress(0, false);
  setMediaButtons();
  setStatus("已清除图片/视频素材。");
}

function handleMediaUpload(event) {
  loadMediaFile(event.target.files);
  event.target.value = "";
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

  zone.addEventListener("drop", (event) => {
    onFiles(event.dataTransfer?.files);
  });
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function updateCanvasSize(exportScale = 1) {
  if (!state.mediaWidth || !state.mediaHeight) return;
  const scale = Number(canvasScale.value) * exportScale;
  const width = Math.max(1, Math.round(state.mediaWidth * scale));
  const height = Math.max(1, Math.round(state.mediaHeight * scale));
  setCanvasPixelSize(width, height);
  canvasMeta.textContent = `${width} x ${height}`;
}

function setCanvasPixelSize(width, height, updateDisplay = true) {
  if (outputCanvas.width !== width) outputCanvas.width = width;
  if (outputCanvas.height !== height) outputCanvas.height = height;
  if (updateDisplay) {
    outputCanvas.style.aspectRatio = `${width} / ${height}`;
  }
}

function updateCanvasScaleValue() {
  canvasScaleValue.value = `${Number(canvasScale.value).toFixed(1).replace(/\.0$/, "")}x`;
}

function drawFilteredMedia(ctx, width, height, blurScale = 1) {
  const { brightness, contrast, blur } = state.values;
  ctx.save();
  ctx.fillStyle = getBackgroundPaint(ctx, width, height);
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.filter = [
    `brightness(${100 + brightness}%)`,
    `contrast(${100 + contrast}%)`,
    `blur(${blur * blurScale}px)`,
  ].join(" ");

  if (state.mode === "video") {
    ctx.drawImage(sourceVideo, 0, 0, width, height);
  } else if (state.mode === "image") {
    ctx.drawImage(sourceImage, 0, 0, width, height);
  }
  ctx.restore();
}

function getCells(sampleWidth, sampleHeight) {
  const spacing = state.values.spacing;
  const width = sampleWidth ?? outputCanvas.width;
  const height = sampleHeight ?? outputCanvas.height;
  const cols = Math.max(1, Math.floor(width / spacing));
  const rows = Math.max(1, Math.floor(height / spacing));
  const stepX = outputCanvas.width / cols;
  const stepY = outputCanvas.height / rows;
  if (sourceCanvas.width !== cols) sourceCanvas.width = cols;
  if (sourceCanvas.height !== rows) sourceCanvas.height = rows;
  const blurScale = Math.min(cols / width, rows / height);
  drawFilteredMedia(sourceCtx, cols, rows, blurScale);
  const pixels = sourceCtx.getImageData(0, 0, cols, rows).data;
  const cells = [];
  const threshold = clamp(0.18 + state.values.solidFill * 0.00805, 0.18, 0.985);
  const noiseAmount = state.values.noise / 100;
  const tonePower = state.values.toneContrast;
  const scale = sampleWidth ? (outputCanvas.width / width) : 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = (row * cols + col) * 4;
      let luma = (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
      if (noiseAmount) {
        const jitter = (Math.random() - 0.5) * noiseAmount;
        luma = clamp(luma + jitter);
      }
      if (luma >= threshold) continue;
      const darkness = clamp((threshold - luma) / threshold);
      const weight = Math.pow(darkness, tonePower);
      const rawSize = state.values.minShapeSize + weight * (state.values.maxDiameter - state.values.minShapeSize);
      if (rawSize <= 0.15) continue;
      const size = rawSize * scale;
      cells.push({ x: (col + 0.5) * stepX, y: (row + 0.5) * stepY, size, weight });
    }
  }

  return cells;
}
function pickGlyph(weight) {
  if (state.svgGlyphs.length) {
    const index = Math.min(state.svgGlyphs.length - 1, Math.floor(weight * state.svgGlyphs.length));
    return state.svgGlyphs[index];
  }

  const chars = [...(state.textGlyphs || "01")];
  const index = Math.min(chars.length - 1, Math.floor(weight * chars.length));
  return chars[index] || "0";
}

function getTextFont(size) {
  return `${size}px ${state.textFont}`;
}

function getGlyphBox(glyph, x, y, size) {
  const aspect = glyph.aspect || 1;
  const width = aspect >= 1 ? size : size * aspect;
  const height = aspect >= 1 ? size / aspect : size;
  return {
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
  };
}

function drawSvgGlyph(glyph, x, y, size) {
  const box = getGlyphBox(glyph, x, y, size);
  const glyphIndex = state.svgGlyphs.indexOf(glyph);
  const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  const displaySize = Math.max(1, Math.ceil(size + 4));
  const cacheSize = Math.ceil(displaySize * pixelRatio);
  const cacheKey = `${glyphIndex}:${fgColor.value}:${cacheSize}`;
  let cached = state.glyphCache.get(cacheKey);

  if (!cached) {
    glyphCanvas.width = cacheSize;
    glyphCanvas.height = cacheSize;
    glyphCtx.clearRect(0, 0, cacheSize, cacheSize);
    glyphCtx.imageSmoothingEnabled = true;
    glyphCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    glyphCtx.drawImage(glyph.image, (displaySize - box.width) / 2, (displaySize - box.height) / 2, box.width, box.height);
    glyphCtx.setTransform(1, 0, 0, 1, 0, 0);
    glyphCtx.globalCompositeOperation = "source-in";
    glyphCtx.fillStyle = fgColor.value;
    glyphCtx.fillRect(0, 0, cacheSize, cacheSize);
    glyphCtx.globalCompositeOperation = "source-over";

    cached = document.createElement("canvas");
    cached.width = cacheSize;
    cached.height = cacheSize;
    cached.dataset.displaySize = displaySize;
    cached.getContext("2d").drawImage(glyphCanvas, 0, 0);
    state.glyphCache.set(cacheKey, cached);
    trimGlyphCache();
  }

  const targetSize = Number(cached.dataset.displaySize);
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.drawImage(cached, x - targetSize / 2, y - targetSize / 2, targetSize, targetSize);
}

function trimGlyphCache() {
  const maxEntries = 1200;
  if (state.glyphCache.size <= maxEntries) return;
  const overflow = state.glyphCache.size - maxEntries;
  const keys = state.glyphCache.keys();
  for (let index = 0; index < overflow; index++) {
    state.glyphCache.delete(keys.next().value);
  }
}

function render(keepSize = false, sampleWidth, sampleHeight) {
  if (state.mode === "empty" || !state.mediaWidth || !state.mediaHeight) return;
  if (!keepSize) updateCanvasSize();

  outputCtx.fillStyle = getBackgroundPaint(outputCtx, outputCanvas.width, outputCanvas.height);
  outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputCtx.fillStyle = fgColor.value;
  outputCtx.strokeStyle = fgColor.value;
  outputCtx.textAlign = "center";
  outputCtx.textBaseline = "middle";
  outputCtx.font = getTextFont(Math.max(8, state.values.maxDiameter));

  const cells = getCells(sampleWidth, sampleHeight);
  for (const cell of cells) {
    const glyph = pickGlyph(cell.weight);
    if (typeof glyph === "string") {
      outputCtx.font = getTextFont(cell.size);
      outputCtx.fillText(glyph, cell.x, cell.y + cell.size * 0.04);
    } else {
      drawSvgGlyph(glyph, cell.x, cell.y, cell.size);
    }
  }
}

function renderVideoFrameIfNeeded(force = false) {
  if (force || sourceVideo.currentTime !== state.lastRenderedVideoTime) {
    state.lastRenderedVideoTime = sourceVideo.currentTime;
    render();
  }
}

function requestRender() {
  if (state.renderQueued) return;
  state.renderQueued = requestAnimationFrame(() => {
    state.renderQueued = 0;
    render();
  });
}

function loop() {
  renderVideoFrameIfNeeded();
  if (!sourceVideo.paused && !sourceVideo.ended) {
    state.raf = requestAnimationFrame(loop);
  }
}

function startRenderLoop() {
  if (state.isExporting) return;
  stopRenderLoop();
  state.lastRenderedVideoTime = -1;
  if ("requestVideoFrameCallback" in sourceVideo) {
    const onVideoFrame = () => {
      renderVideoFrameIfNeeded(true);
      if (!sourceVideo.paused && !sourceVideo.ended) {
        state.videoFrameRequest = sourceVideo.requestVideoFrameCallback(onVideoFrame);
      }
    };
    state.videoFrameRequest = sourceVideo.requestVideoFrameCallback(onVideoFrame);
    return;
  }
  loop();
}

function stopRenderLoop() {
  cancelAnimationFrame(state.raf);
  state.raf = 0;
  if (state.videoFrameRequest && "cancelVideoFrameCallback" in sourceVideo) {
    sourceVideo.cancelVideoFrameCallback(state.videoFrameRequest);
  }
  state.videoFrameRequest = 0;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

function exportPng(multiplier) {
  if (state.mode === "empty") return;
  const previewWidth = outputCanvas.width;
  const previewHeight = outputCanvas.height;
  const exportWidth = Math.max(1, Math.round(previewWidth * multiplier));
  const exportHeight = Math.max(1, Math.round(previewHeight * multiplier));

  state.glyphCache.clear();
  setCanvasPixelSize(exportWidth, exportHeight, false);
  render(true, previewWidth, previewHeight);
  outputCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `ascii-${multiplier}x.png`);
    state.glyphCache.clear();
    setCanvasPixelSize(previewWidth, previewHeight, false);
    outputCanvas.style.aspectRatio = `${previewWidth} / ${previewHeight}`;
    render(true);
  }, "image/png");
}
function buildSvgMarkup() {
  const cells = getCells();
  const width = outputCanvas.width;
  const height = outputCanvas.height;
  const body = cells
    .map((cell) => {
      const glyph = pickGlyph(cell.weight);
      if (typeof glyph === "string") {
        return `<text x="${cell.x.toFixed(2)}" y="${(cell.y + cell.size * 0.34).toFixed(2)}" text-anchor="middle" font-family="${escapeHtml(state.textFont)}" font-size="${cell.size.toFixed(2)}" fill="${fgColor.value}">${escapeHtml(glyph)}</text>`;
      }
      const box = getGlyphBox(glyph, cell.x, cell.y, cell.size);
      const vb = glyph.viewBoxValues;
      const scaleX = box.width / vb[2];
      const scaleY = box.height / vb[3];
      const innerMatch = glyph.svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      let coloredInnerHTML = innerMatch ? innerMatch[1].trim() : "";
      // 移除所有非 none 的 fill 和 stroke 属性，让 <g> 的 fill 生效
      coloredInnerHTML = coloredInnerHTML
        .replace(/\s+fill="(?!none")[^"]*"/gi, "")
        .replace(/\s+stroke="[^"]*"/gi, "")
        .replace(/fill:\s*[^;{}]+/gi, "")
        .replace(/stroke:\s*[^;{}]+/gi, "");
      return `<g transform="translate(${box.x.toFixed(2)}, ${box.y.toFixed(2)}) scale(${scaleX.toFixed(6)}, ${scaleY.toFixed(6)}) translate(${-vb[0]}, ${-vb[1]})" fill="${fgColor.value}">${coloredInnerHTML}</g>`;
    })
    .join("");

  const bgDef = !useGradient.checked || bgColor.value === bgColorEnd.value
    ? ""
    : `<linearGradient id="bgGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${bgColor.value}" /><stop offset="100%" stop-color="${bgColorEnd.value}" /></linearGradient>`;
  const bgFill = bgDef ? "url(#bgGradient)" : bgColor.value;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${bgDef}</defs>
  <rect width="100%" height="100%" fill="${bgFill}" />
  ${body}
</svg>`;
}
function resetAll() {
  cancelAnimationFrame(state.raf);
  stopRenderLoop();
  cancelAnimationFrame(state.renderQueued);
  state.renderQueued = 0;
  revokeObjectUrl();
  sourceVideo.pause();
  sourceVideo.removeAttribute("src");
  sourceVideo.load();
  sourceImage.removeAttribute("src");

  state.mode = "empty";
  state.mediaWidth = 0;
  state.mediaHeight = 0;
  state.lastRenderedVideoTime = -1;
  state.svgGlyphs = [];
  state.glyphCache.clear();
  state.textGlyphs = "01";
  state.textFont = "monospace";
  state.values = { ...defaultValues };

  glyphUpload.value = "";
  mediaUpload.value = "";
  textGlyphsInput.value = "01";
  textFont.value = "monospace";
  fgColor.value = "#ffffff";
  bgColor.value = "#000000";
  bgColorEnd.value = "#000000";
  useGradient.checked = false;
  updateGradientControls();
  syncHexFromColor(fgColor, fgColorHex);
  syncHexFromColor(bgColor, bgColorHex);
  syncHexFromColor(bgColorEnd, bgColorEndHex);
  canvasScale.value = "1";
  updateCanvasScaleValue();
  sliderConfig.forEach(([key]) => {
    const input = document.querySelector(`#${key}`);
    const output = document.querySelector(`#${key}Value`);
    input.value = state.values[key];
    output.value = state.values[key];
  });
  applyVideoSpeed();

  outputCtx.fillStyle = getBackgroundPaint(outputCtx, outputCanvas.width, outputCanvas.height);
  outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  mediaMeta.textContent = "等待素材";
  canvasMeta.textContent = "-";
  playToggle.textContent = "▶";
  setExportProgress(0, false);
  setMediaButtons();
  renderGlyphList();
  setStatus("已重置。");
}

function exportSvg() {
  if (state.mode === "empty") return;
  const svg = buildSvgMarkup();
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "ascii.svg");
}

function getSupportedVideoMime() {
  if (!("MediaRecorder" in window)) return "";
  const types = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
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
    "avc1",
    new Uint8Array(6),
    u16(1),
    new Uint8Array(16),
    u16(width),
    u16(height),
    u32(0x00480000),
    u32(0x00480000),
    u32(0),
    u16(1),
    compressor,
    u16(24),
    u16(0xffff),
    box("avcC", avcConfig),
  );
  return fullBox("stsd", 0, 0, u32(1), avc1);
}

function makeMp4({ chunks, avcConfig, width, height, fps }) {
  const timescale = 90000;
  const defaultSampleDuration = Math.round(timescale / fps);
  const sampleDurations = chunks.map((chunk) => Math.max(1, Math.round(((chunk.duration || Math.round(1_000_000 / fps)) / 1_000_000) * timescale)));
  const duration = sampleDurations.reduce((total, value) => total + value, 0);
  const sizes = chunks.map((chunk) => chunk.data.length);
  const mdatPayload = bytes(...chunks.map((chunk) => chunk.data));
  const mdat = box("mdat", mdatPayload);

  const makeMoov = (chunkOffset) => {
    const sttsEntries = [];
    for (const sampleDuration of sampleDurations) {
      const last = sttsEntries[sttsEntries.length - 1];
      if (last && last.duration === sampleDuration) {
        last.count += 1;
      } else {
        sttsEntries.push({ count: 1, duration: sampleDuration });
      }
    }
    const stts = fullBox("stts", 0, 0, u32(sttsEntries.length), ...sttsEntries.flatMap((entry) => [u32(entry.count), u32(entry.duration)]));
    const stsc = fullBox("stsc", 0, 0, u32(1), u32(1), u32(chunks.length), u32(1));
    const stsz = fullBox("stsz", 0, 0, u32(0), u32(chunks.length), ...sizes.map(u32));
    const stco = fullBox("stco", 0, 0, u32(1), u32(chunkOffset));
    const syncSamples = chunks
      .map((chunk, index) => (chunk.type === "key" ? index + 1 : 0))
      .filter(Boolean);
    const stss = fullBox("stss", 0, 0, u32(syncSamples.length), ...syncSamples.map(u32));

    const stbl = box("stbl", makeStsd(width, height, avcConfig), stts, stsc, stsz, stco, stss);
    const dinf = box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1)));
    const minf = box("minf", fullBox("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf, stbl);
    const hdlr = fullBox("hdlr", 0, 0, u32(0), ascii("vide"), new Uint8Array(12), ascii("VideoHandler\0"));
    const mdhd = fullBox("mdhd", 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
    const mdia = box("mdia", mdhd, hdlr, minf);
    const tkhd = fullBox(
      "tkhd",
      0,
      7,
      u32(0),
      u32(0),
      u32(1),
      u32(0),
      u32(duration),
      new Uint8Array(8),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0x00010000),
      u32(0),
      u32(0),
      u32(0),
      u32(0x00010000),
      u32(0),
      u32(0),
      u32(0),
      u32(0x40000000),
      fixed16(width),
      fixed16(height),
    );
    const trak = box("trak", tkhd, mdia);
    const mvhd = fullBox(
      "mvhd",
      0,
      0,
      u32(0),
      u32(0),
      u32(timescale),
      u32(duration),
      u32(0x00010000),
      u16(0x0100),
      u16(0),
      new Uint8Array(8),
      u32(0x00010000),
      u32(0),
      u32(0),
      u32(0),
      u32(0x00010000),
      u32(0),
      u32(0),
      u32(0),
      u32(0x40000000),
      new Uint8Array(24),
      u32(2),
    );
    return box("moov", mvhd, trak);
  };

  const ftyp = box("ftyp", ascii("isom"), u32(0x200), ascii("isom"), ascii("iso2"), ascii("avc1"), ascii("mp41"));
  const placeholderMoov = makeMoov(0);
  const moov = makeMoov(ftyp.length + placeholderMoov.length + 8);
  return bytes(ftyp, moov, mdat);
}

function seekVideo(time) {
  const target = Math.min(Math.max(time, 0), Math.max(0, sourceVideo.duration - 0.001));
  if (Math.abs(sourceVideo.currentTime - target) < 0.0001 && sourceVideo.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      sourceVideo.removeEventListener("seeked", onSeeked);
      sourceVideo.removeEventListener("error", onError);
      error ? reject(error) : resolve();
    };
    const onSeeked = () => finish();
    const onError = () => finish(new Error("视频读取失败"));
    const timer = setTimeout(() => finish(new Error("视频读取超时")), 15000);
    sourceVideo.addEventListener("seeked", onSeeked);
    sourceVideo.addEventListener("error", onError);
    sourceVideo.currentTime = target;
  });
}

async function exportVideoOffline() {
  if (!("VideoEncoder" in window) || !("VideoFrame" in window)) {
    setStatus("当前浏览器不支持离线 MP4 编码，将使用实时导出。");
    return false;
  }

  const fps = EXPORT_VIDEO_FPS;
  const speed = state.values.videoSpeed;
  const sourceDuration = sourceVideo.duration || 0;
  const outputDuration = sourceDuration / speed;
  const frameCount = Math.max(1, Math.ceil(outputDuration * fps));
  const width = outputCanvas.width + (outputCanvas.width % 2);
  const height = outputCanvas.height + (outputCanvas.height % 2);
  const encodeCanvas = document.createElement("canvas");
  encodeCanvas.width = width;
  encodeCanvas.height = height;
  const encodeCtx = encodeCanvas.getContext("2d");
  const chunks = [];
  let avcConfig = null;

  const config = {
    codec: "avc1.42E01E",
    width,
    height,
    bitrate: 10_000_000,
    framerate: fps,
    avc: { format: "avc" },
  };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) return false;

  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({
        data,
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration || Math.round(1_000_000 / fps),
      });
      if (metadata?.decoderConfig?.description) {
        avcConfig = new Uint8Array(metadata.decoderConfig.description);
      }
    },
    error: () => {
      encoderError = new Error("VideoEncoder failed");
    },
  });
  try {
  encoder.configure(config);

  stopRenderLoop();
  sourceVideo.pause();
  exportVideoButton.disabled = true;
  state.isExporting = true;
  setMediaButtons();
  setExportProgress(0);
  setStatus("正在预热前几秒画面，请保持页面打开。");

  const warmupDuration = Math.min(3, outputDuration);
  const warmupFrames = Math.min(Math.ceil(warmupDuration * 12), frameCount);
  for (let warmupIndex = 0; warmupIndex < warmupFrames; warmupIndex++) {
    const outputTime = warmupFrames <= 1 ? 0 : (warmupIndex / (warmupFrames - 1)) * warmupDuration;
    await seekVideo(outputTime * speed);
    render();
    if (warmupIndex % 6 === 0) {
      const percent = warmupFrames ? (warmupIndex / warmupFrames) * 5 : 0;
      setExportProgress(percent);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  await seekVideo(0);
  state.lastRenderedVideoTime = -1;
  setExportProgress(0);
  setStatus("正在逐帧导出 MP4，请保持页面打开。");

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const outputTime = frameIndex / fps;
    await seekVideo(outputTime * speed);
    render();
    encodeCtx.drawImage(outputCanvas, 0, 0, width, height);
    const frame = new VideoFrame(encodeCanvas, {
      timestamp: Math.round(outputTime * 1_000_000),
      duration: Math.round(1_000_000 / fps),
    });
    const keyFrameInterval = outputTime < 3 ? Math.max(1, Math.round(fps / 4)) : Math.max(1, Math.round(fps / 2));
    if (encoderError) { frame.close(); throw encoderError; }
    encoder.encode(frame, { keyFrame: frameIndex % keyFrameInterval === 0 });
    frame.close();

    if (frameIndex % 4 === 0 || frameIndex === frameCount - 1) {
      const percent = ((frameIndex + 1) / frameCount) * 100;
      setExportProgress(percent);
      setStatus(`正在逐帧导出 MP4 ${Math.round(percent)}% · ${frameIndex + 1} / ${frameCount} 帧`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  await encoder.flush();
  if (encoderError) throw encoderError;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }

  if (!avcConfig || !chunks.length) {
    state.isExporting = false;
    setMediaButtons();
    return false;
  }
  chunks.sort((a, b) => a.timestamp - b.timestamp);
  const mp4 = makeMp4({ chunks, avcConfig, width, height, fps });
  downloadBlob(new Blob([mp4], { type: "video/mp4" }), "ascii-video.mp4");
  setExportProgress(100);
  setStatus(`视频已逐帧导出 MP4，${fps}fps。`);
  state.isExporting = false;
  setMediaButtons();
  return true;
}

async function exportVideo() {
  if (state.mode !== "video") return;
  const wasPaused = sourceVideo.paused;
  const previousTime = sourceVideo.currentTime;
  try {
    if (await exportVideoOffline()) {
      sourceVideo.currentTime = previousTime;
      if (!wasPaused) await sourceVideo.play();
      return;
    }
  } catch {
    state.isExporting = false;
    setMediaButtons();
    setStatus("逐帧 MP4 导出失败，将使用实时导出。");
  }
  sourceVideo.currentTime = previousTime;
  try { await exportVideoRealtime(wasPaused); } catch {
    state.isExporting = false; setMediaButtons(); setExportProgress(0, false);
    setStatus("视频导出失败，请更换浏览器或素材重试。");
  }
}

async function exportVideoRealtime(wasPausedOverride) {
  if (state.mode !== "video") return;
  const mimeType = getSupportedVideoMime();
  if (!mimeType) {
    setStatus("当前浏览器不支持直接录制视频。");
    setExportProgress(0, false);
    return;
  }

  setStatus("正在导出视频，请保持页面打开。");
  setExportProgress(0);
  exportVideoButton.disabled = true;
  state.isExporting = true;
  setMediaButtons();
  stopRenderLoop();
  state.lastRenderedVideoTime = -1;
  const wasPaused = wasPausedOverride ?? sourceVideo.paused;
  sourceVideo.pause();
  await seekVideo(0);

  const chunks = [];
  let stream = outputCanvas.captureStream(0);
  let [videoTrack] = stream.getVideoTracks();
  const hasManualFrameRequest = Boolean(videoTrack?.requestFrame);
  if (!hasManualFrameRequest) {
    stream.getTracks().forEach((track) => track.stop());
    stream = outputCanvas.captureStream(EXPORT_VIDEO_FPS);
    [videoTrack] = stream.getVideoTracks();
  }
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
  });
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.onerror = () => {
    state.isExporting = false;
    window.clearTimeout(frameTimer);
    sourceVideo.removeEventListener("timeupdate", updateProgress);
    setMediaButtons();
    setStatus("视频导出中断，请降低画布比例或增大间距 后再试。");
  };
  recorder.onstop = () => {
    const extension = mimeType.includes("mp4") ? "mp4" : "webm";
    downloadBlob(new Blob(chunks, { type: mimeType }), `ascii-video.${extension}`);
    setExportProgress(100);
    setStatus(extension === "mp4" ? `视频已导出 MP4，录制帧率 ${EXPORT_VIDEO_FPS}fps。` : `当前浏览器不支持 MP4，已按 ${EXPORT_VIDEO_FPS}fps 导出 WebM。`);
    state.isExporting = false;
    if (wasPaused) sourceVideo.pause();
    setMediaButtons();
  };

  const previousOnEnded = sourceVideo.onended;
  let frameTimer = 0;
  let exportFrame = 0;
  let exportStartedAt = 0;
  let lastProgressUpdate = 0;
  const pushFrame = () => {
    renderVideoFrameIfNeeded();
    videoTrack?.requestFrame?.();
    if (!sourceVideo.paused && !sourceVideo.ended) {
      exportFrame += 1;
      const nextAt = exportStartedAt + (exportFrame * 1000) / EXPORT_VIDEO_FPS;
      frameTimer = window.setTimeout(pushFrame, Math.max(0, nextAt - performance.now()));
    }
  };
  const updateProgress = () => {
    const duration = sourceVideo.duration || 0;
    if (!duration) return;
    const now = performance.now();
    if (now - lastProgressUpdate < 250 && sourceVideo.currentTime < duration) return;
    lastProgressUpdate = now;
    const percent = (sourceVideo.currentTime / duration) * 100;
    setExportProgress(percent);
    setStatus(`正在导出视频 ${Math.round(percent)}% · ${formatTime(sourceVideo.currentTime)} / ${formatTime(duration)}`);
  };
  sourceVideo.onended = () => {
    sourceVideo.removeEventListener("timeupdate", updateProgress);
    window.clearTimeout(frameTimer);
    render();
    videoTrack?.requestFrame?.();
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    playToggle.textContent = "▶";
    sourceVideo.onended = previousOnEnded;
  };
  sourceVideo.addEventListener("timeupdate", updateProgress);
  recorder.start();
  applyVideoSpeed();
  await sourceVideo.play();
  playToggle.textContent = "Ⅱ";
  exportStartedAt = performance.now();
  updateProgress();
  pushFrame();
}

glyphUpload.addEventListener("change", handleGlyphUpload);
mediaUpload.addEventListener("change", handleMediaUpload);
setupDropZone(glyphDropZone, loadGlyphFiles);
setupDropZone(mediaDropZone, loadMediaFile);
glyphList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-glyph]");
  if (!button) return;
  state.svgGlyphs.splice(Number(button.dataset.deleteGlyph), 1);
  state.glyphCache.clear();
  renderGlyphList();
  requestRender();
  setStatus(state.svgGlyphs.length ? `已删除字符，剩余 ${state.svgGlyphs.length} 个。` : "已清空 SVG 字符，恢复默认字符。");
});
textGlyphsInput.addEventListener("input", () => {
  state.textGlyphs = textGlyphsInput.value || "01";
  renderGlyphList();
  requestRender();
});
textFont.addEventListener("input", async () => {
  state.textFont = textFont.value;
  requestRender();
});
bindColorControls(fgColor, fgColorHex);
bindColorControls(bgColor, bgColorHex);
bindColorControls(bgColorEnd, bgColorEndHex);
useGradient.addEventListener("change", () => {
  updateGradientControls();
  requestRender();
});
canvasScale.addEventListener("input", () => {
  updateCanvasScaleValue();
  requestRender();
});

playToggle.addEventListener("click", async () => {
  if (state.mode !== "video") return;
  if (sourceVideo.paused) {
    await sourceVideo.play();
    playToggle.textContent = "Ⅱ";
  } else {
    sourceVideo.pause();
    playToggle.textContent = "▶";
  }
});

resetMedia.addEventListener("click", () => {
  clearMedia();
});

document.querySelectorAll("[data-export-png]").forEach((button) => {
  button.addEventListener("click", () => exportPng(Number(button.dataset.exportPng)));
});
exportSvgButton.addEventListener("click", exportSvg);
exportVideoButton.addEventListener("click", exportVideo);
resetAllButton.addEventListener("click", resetAll);

setupSliders();
renderGlyphList();
setMediaButtons();
updateCanvasScaleValue();
updateGradientControls();
