const base = new URL('./', location.href);
const home = document.querySelector('#home');
const detail = document.querySelector('#detail');
const missing = document.querySelector('#not-found');
const list = document.querySelector('#tool-list');
const catalogStatus = document.querySelector('#catalog-status');
const retryCatalog = document.querySelector('#retry-catalog');
const region = document.querySelector('#frame-region');
const frameStatus = document.querySelector('#frame-status');
const retryTool = document.querySelector('#retry-tool');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let catalog = [];
let catalogReady = false;
let activeTool = null;
let controller = null;
let frameTimer;
let lastOpened = null;

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}
function homeURL() { return base.href; }
function detailURL(id) { const url = new URL(base); url.searchParams.set('tool', id); return url.href; }
function toolURL(tool) { return new URL(`tools/${tool.id}/index.html`, base).href; }
function tagList(tags) {
  const element = document.createElement('span'); element.className = 'tags';
  for (const tag of tags) element.append(textElement('span', 'tag', tag));
  return element;
}
function renderList() {
  list.replaceChildren();
  document.querySelector('#tool-count').textContent = String(catalog.length).padStart(2, '0');
  for (const [index, tool] of catalog.entries()) {
    const card = document.createElement('a');
    card.className = 'tool-card'; card.href = detailURL(tool.id); card.dataset.tool = tool.id;
    const art = document.createElement('span'); art.className = 'tool-art'; art.setAttribute('aria-hidden', 'true');
    const fallback = () => art.replaceChildren(textElement('pre', '', `[ ${String(index + 1).padStart(2, '0')} ]`));
    fallback();
    if (tool.cover) {
      const image = document.createElement('img');
      image.alt = ''; image.decoding = 'async';
      image.addEventListener('error', fallback, { once: true });
      image.src = new URL(`tools/${tool.id}/${tool.cover}`, base).href;
      art.replaceChildren(image);
    }
    const info = document.createElement('div');
    info.append(textElement('h3', '', tool.name), textElement('p', '', tool.description), tagList(tool.tags));
    const action = textElement('span', 'card-action', '打开工具'); action.append(textElement('span', 'arrow', '→'));
    card.append(art, info, action); list.append(card);
  }
}
function disposeFrame() {
  controller?.abort(); controller = null;
  clearTimeout(frameTimer);
  region.querySelector('iframe')?.remove();
}
async function loadTool(tool) {
  disposeFrame();
  const request = new AbortController(); controller = request;
  frameStatus.hidden = false; retryTool.hidden = true;
  document.querySelector('#frame-message').textContent = '正在打开工具…';
  const fail = () => {
    if (request.signal.aborted) return;
    clearTimeout(frameTimer);
    region.querySelector('iframe')?.remove();
    frameStatus.hidden = false; retryTool.hidden = false;
    document.querySelector('#frame-message').textContent = '工具暂时无法载入。可以重试，或在新窗口中独立打开。';
  };
  frameTimer = setTimeout(() => { fail(); request.abort(); }, 15000);
  try {
    const response = await fetch(toolURL(tool), { method: 'HEAD', signal: request.signal });
    if (!response.ok) throw new Error('tool unavailable');
    if (request.signal.aborted) return;
    const frame = document.createElement('iframe');
    frame.className = 'tool-frame'; frame.title = tool.name; frame.src = toolURL(tool);
    frame.addEventListener('load', () => {
      if (request.signal.aborted) return;
      clearTimeout(frameTimer); frameStatus.hidden = true;
    }, { once: true });
    frame.addEventListener('error', fail, { once: true });
    region.append(frame);
  } catch { if (!request.signal.aborted) fail(); }
}
function renderRoute({ focus = false } = {}) {
  if (!catalogReady) return;
  const id = new URL(location.href).searchParams.get('tool');
  const tool = catalog.find(item => item.id === id);
  disposeFrame(); activeTool = null;
  home.hidden = id !== null;
  detail.hidden = !tool;
  missing.hidden = id === null || Boolean(tool);
  if (id === null) {
    document.title = 'DPG — Design Playground';
    if (focus) {
      const card = [...list.querySelectorAll('a')].find(item => item.dataset.tool === lastOpened);
      (card || document.querySelector('#main')).focus({ preventScroll: true });
    }
    return;
  }
  if (!tool) {
    document.title = '工具未找到 · DPG';
    if (focus) document.querySelector('#error-title').focus();
    return;
  }
  activeTool = tool; lastOpened = tool.id;
  document.title = `${tool.name} · DPG`;
  document.querySelector('#detail-title').textContent = tool.name;
  document.querySelector('#detail-version').textContent = `v${tool.version}`;
  document.querySelector('#detail-description').textContent = tool.description;
  document.querySelector('#detail-tags').replaceChildren(...tagList(tool.tags).childNodes);
  document.querySelector('#open-tool').href = toolURL(tool);
  if (focus) document.querySelector('#detail-title').focus();
  loadTool(tool);
}
async function loadCatalog() {
  catalogReady = false; retryCatalog.hidden = true;
  catalogStatus.hidden = false; catalogStatus.textContent = '正在载入工具…';
  try {
    const response = await fetch(new URL('catalog.json', base), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('catalog unavailable');
    const data = await response.json();
    if (!Array.isArray(data.tools)) throw new Error('catalog invalid');
    const ids = new Set();
    for (const tool of data.tools) {
      if (typeof tool.id !== 'string' || !slugPattern.test(tool.id) || ids.has(tool.id) || tool.entry !== 'index.html' ||
          !['name', 'description', 'version'].every(key => typeof tool[key] === 'string') ||
          !Array.isArray(tool.tags) || !tool.tags.every(tag => typeof tag === 'string')) throw new Error('catalog invalid');
      if (tool.cover !== undefined && (typeof tool.cover !== 'string' || !/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(png|jpe?g|webp|svg|avif)$/i.test(tool.cover) || tool.cover.includes('..'))) throw new Error('cover invalid');
      ids.add(tool.id);
    }
    catalog = data.tools; catalogReady = true; renderList();
    catalogStatus.hidden = catalog.length > 0;
    catalogStatus.textContent = '工具正在准备中，过段时间再来看看。';
    renderRoute();
  } catch {
    home.hidden = false; detail.hidden = true; missing.hidden = true;
    catalogStatus.hidden = false; catalogStatus.textContent = '暂时无法加载工具列表，请重试。'; retryCatalog.hidden = false;
  }
}
for (const link of document.querySelectorAll('[data-home]')) link.href = homeURL();
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-home], a[data-tool]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (link.href === location.href) return;
  history.pushState({}, '', link.href);
  renderRoute({ focus: true }); window.scrollTo(0, 0);
});
window.addEventListener('popstate', () => renderRoute({ focus: true }));
retryCatalog.addEventListener('click', loadCatalog);
retryTool.addEventListener('click', () => { if (activeTool) loadTool(activeTool); });
loadCatalog();
