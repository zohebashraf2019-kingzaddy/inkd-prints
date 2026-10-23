import {
  PRODUCTS, PRODUCT_ORDER, INK_COLORS, SHIRT_COLORS, choiceAllowed, defaultOptions, normalizeOptions, quote, money, fmtInt,
} from './pricing.js';
import { MOCKUPS, W, tint } from './mockups.js';
import { cart } from './store.js';
import { toast, updateCartBadge } from './site.js';

const RES = 1.25; // canvas backing-store scale over the 1000-unit logical space
const FONTS = ['Anton', 'Archivo Black', 'Archivo', 'Bungee', 'Permanent Marker', 'Pacifico', 'Rubik Wet Paint'];
const MAX_UPLOAD_BYTES = 3.2 * 1024 * 1024; // what we send to the server per file

const $ = (s, el = document) => el.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};

const params = new URLSearchParams(location.search);
const state = {
  productId: PRODUCTS[params.get('p')] ? params.get('p') : 'cups',
  opts: null,
  view: 'front',
  layers: { front: [], back: [] },
  selected: null,
  placement: {},
};
state.opts = defaultOptions(state.productId);

const canvas = $('#stage');
canvas.width = W * RES;
canvas.height = W * RES;
const ctx = canvas.getContext('2d');

const product = () => PRODUCTS[state.productId];
const mockup = () => MOCKUPS[product().mockup];

function viewsFor() {
  const o = state.opts;
  if (state.productId === 'apparel') return o.side === 'both' ? ['front', 'back'] : [o.side];
  if (state.productId === 'paper') return o.sides === '2' ? ['front', 'back'] : ['front'];
  return ['front'];
}
function currentLayers() {
  const views = viewsFor();
  if (!views.includes(state.view)) state.view = views[0];
  const list = state.layers[state.view];
  if (!list.length && state.view !== 'front' && state.layers.front.length && !state.layers[`${state.view}Touched`]) {
    state.layers[state.view] = state.layers.front.map((l) => ({ ...l, id: uid() }));
  }
  return state.layers[state.view];
}
const uid = () => Math.random().toString(36).slice(2, 9);
const area = () => mockup().area(state.opts, state);

/* ---------------- images ---------------- */

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('That file could not be opened as an image.'));
    i.src = src;
  });
}

/** Working copy (max 2400px) + whether it already has transparency + whether its border is white */
async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth || 1200, h = img.naturalHeight || 1200;
    const isSvg = file.type === 'image/svg+xml';
    const max = 2400;
    const s = isSvg ? max / Math.max(w, h) : Math.min(1, max / Math.max(w, h));
    w = Math.round(w * s);
    h = Math.round(h * s);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, w, h);
    const d = cx.getImageData(0, 0, w, h).data;
    let transparent = false, borderWhite = 0, borderN = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 250) { transparent = true; break; }
    const step = Math.max(1, Math.floor((w + h) / 400));
    const sample = (x, y) => {
      const i = (y * w + x) * 4;
      borderN++;
      if (d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232 && d[i + 3] > 200) borderWhite++;
    };
    for (let x = 0; x < w; x += step) { sample(x, 0); sample(x, h - 1); }
    for (let y = 0; y < h; y += step) { sample(0, y); sample(w - 1, y); }
    return { canvas: c, transparent, whiteBorder: borderWhite / borderN > 0.85 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Remove white background connected to the image edges (keeps white inside the logo) */
function knockout(src) {
  const w = src.width, h = src.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(src, 0, 0);
  const id = cx.getImageData(0, 0, w, h);
  const d = id.data;
  const seen = new Uint8Array(w * h);
  const q = new Int32Array(w * h);
  let head = 0, tail = 0;
  const isBg = (p) => d[p * 4] > 218 && d[p * 4 + 1] > 218 && d[p * 4 + 2] > 218;
  const push = (p) => { if (!seen[p] && isBg(p)) { seen[p] = 1; q[tail++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const p = q[head++];
    const x = p % w;
    d[p * 4 + 3] = 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  cx.putImageData(id, 0, 0);
  return c;
}

function layerSource(l) {
  if (l.type !== 'image') return null;
  if (l.knockout) return (l._ko ||= knockout(l.canvas));
  return l.canvas;
}

async function addImageFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(file.type)) {
    toast('Preview works with PNG, JPG, SVG or WebP. Have an AI, EPS or PDF? Order with a PNG and send the vector file through the contact form.', 'error');
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    toast('That file is over 25 MB. Export a smaller PNG or JPG and try again.', 'error');
    return;
  }
  setBusy(true, 'Loading your design…');
  try {
    const p = await prepareImage(file);
    const l = {
      id: uid(), type: 'image', name: file.name, file, canvas: p.canvas,
      knockout: !p.transparent && p.whiteBorder, hadAlpha: p.transparent, x: 0.5, y: 0.5, w: 0.8, rot: 0, auto: true,
    };
    currentLayers().push(l);
    arrange(currentLayers());
    state.selected = l.id;
    refresh();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    setBusy(false);
  }
}

function addText() {
  const dark = isDarkSurface();
  const l = { id: uid(), type: 'text', name: 'Text', text: 'Your text', font: 'Anton', color: dark ? '#ffffff' : '#111111', autoColor: true, size: 0.18, x: 0.5, y: 0.5, rot: 0, auto: true };
  const list = currentLayers();
  list.push(l);
  arrange(list);
  state.selected = l.id;
  document.fonts.load(`40px "${l.font}"`).then(draw);
  refresh();
  setTimeout(() => $('#layer-text')?.select(), 30);
}

function isDarkSurface() {
  const o = state.opts;
  if (state.productId === 'apparel') return ['black', 'navy', 'forest', 'purple', 'red'].includes(o.color);
  if (o.bg) return ['black', 'purple', 'red', 'blue'].includes(o.bg);
  return false; // cups: 1-color prints are re-inked anyway, 2-color reads best dark on the drink
}

/** Fit an image layer inside the print area (leaves room underneath when there's text) */
function fitLayer(l, roomForText = false) {
  if (l.type !== 'image') return;
  const a = area();
  const ar = l.canvas.height / l.canvas.width;
  const maxH = roomForText ? 0.6 : 0.82;
  l.w = Math.min(0.82, (maxH * a.h) / (ar * a.w));
  l.x = 0.5;
  l.y = roomForText ? 0.38 : 0.5;
}

/** Re-lay out untouched layers for the current print area and surface color */
function arrange(list) {
  const texts = list.filter((l) => l.type === 'text');
  const imgs = list.filter((l) => l.type === 'image');
  for (const l of imgs) if (l.auto) fitLayer(l, texts.length > 0);
  if (imgs.length) texts.forEach((t, i) => { if (t.auto) { t.x = 0.5; t.y = 0.84 - (texts.length - 1 - i) * 0.12; } });
  const dark = isDarkSurface();
  for (const t of texts) if (t.autoColor) t.color = dark ? '#ffffff' : '#111111';
}

/* ---------------- design rendering ---------------- */

function layerBox(l, a, cw = a.w, ch = a.h, c = ctx) {
  // size in px of the given surface
  if (l.type === 'image') {
    const w = l.w * cw;
    return { w, h: (w * l.canvas.height) / l.canvas.width };
  }
  const fs = l.size * Math.min(cw, ch);
  c.save();
  c.font = `${fs}px "${l.font}"`;
  const lines = String(l.text || ' ').split('\n');
  const w = Math.max(...lines.map((t) => c.measureText(t).width), fs * 0.3);
  c.restore();
  return { w, h: fs * 1.15 * lines.length };
}

function drawLayer(c, l, cw, ch) {
  c.save();
  c.translate(l.x * cw, l.y * ch);
  c.rotate((l.rot * Math.PI) / 180);
  if (l.type === 'image') {
    const { w, h } = layerBox(l, null, cw, ch, c);
    c.drawImage(layerSource(l), -w / 2, -h / 2, w, h);
  } else {
    const fs = l.size * Math.min(cw, ch);
    c.font = `${fs}px "${l.font}"`;
    c.fillStyle = l.color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const lines = String(l.text || '').split('\n');
    lines.forEach((t, i) => c.fillText(t, 0, (i - (lines.length - 1) / 2) * fs * 1.15));
  }
  c.restore();
}

/** Flat design for the print area (with product effects: ink tint, die-cut) */
function renderDesign(view, targetW) {
  const layers = view === state.view ? currentLayers() : state.layers[view];
  if (!layers.length) return null;
  const a = area();
  const k = (targetW || a.w * RES) / a.w;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(a.w * k));
  c.height = Math.max(1, Math.round(a.h * k));
  const cx = c.getContext('2d');
  const ink = mockup().ink?.(state.opts);
  for (const l of layers) {
    if (!ink) { drawLayer(cx, l, c.width, c.height); continue; }
    // one-ink print: each layer is re-inked on its own
    const t = document.createElement('canvas');
    t.width = c.width;
    t.height = c.height;
    const tc = t.getContext('2d');
    drawLayer(tc, l, c.width, c.height);
    if (l.type === 'image' && !l.hadAlpha) tint(t, ink);
    else { tc.globalCompositeOperation = 'source-in'; tc.fillStyle = ink; tc.fillRect(0, 0, t.width, t.height); }
    cx.drawImage(t, 0, 0);
  }
  return mockup().effect ? mockup().effect(c, state.opts) : c;
}

function renderScene(c2d, { guides = true, view = state.view } = {}) {
  c2d.setTransform(RES, 0, 0, RES, 0, 0);
  c2d.clearRect(0, 0, W, W);
  const prevView = state.view;
  state.view = view;
  const a = area();
  const design = renderDesign(view);
  mockup().render(c2d, { o: state.opts, design, area: a, state });
  if (guides) drawGuides(c2d, a);
  state.view = prevView;
}

function drawGuides(c, a) {
  c.save();
  c.setLineDash([10, 8]);
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(255, 214, 10, .85)';
  c.beginPath();
  if (a.shape === 'circle') c.arc(a.x + a.w / 2, a.y + a.h / 2, a.w / 2, 0, Math.PI * 2);
  else c.rect(a.x, a.y, a.w, a.h);
  c.stroke();
  c.setLineDash([]);
  if (state.productId === 'decals') {
    const o = state.opts;
    c.fillStyle = 'rgba(255, 214, 10, .95)';
    c.font = '600 22px Archivo, sans-serif';
    c.textAlign = 'center';
    c.fillText(`${o.size.w}" × ${o.size.h}"`, a.x + a.w / 2, a.y - 12);
  }
  const l = currentLayers().find((x) => x.id === state.selected);
  if (l) {
    const b = layerBox(l, a);
    c.translate(a.x + l.x * a.w, a.y + l.y * a.h);
    c.rotate((l.rot * Math.PI) / 180);
    c.strokeStyle = '#00c2ff';
    c.lineWidth = 2;
    c.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    c.fillStyle = '#ffffff';
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      c.beginPath();
      c.rect((sx * b.w) / 2 - 9, (sy * b.h) / 2 - 9, 18, 18);
      c.fill();
      c.stroke();
    }
  }
  c.restore();
}

let raf = 0;
function draw() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => renderScene(ctx));
}

/* ---------------- pointer interaction ---------------- */

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * W };
}
function toLocal(l, a, p) {
  const cx = a.x + l.x * a.w, cy = a.y + l.y * a.h;
  const t = (-l.rot * Math.PI) / 180;
  const dx = p.x - cx, dy = p.y - cy;
  return { x: dx * Math.cos(t) - dy * Math.sin(t), y: dx * Math.sin(t) + dy * Math.cos(t), cx, cy };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = toLogical(e);
  const a = area();
  const layers = currentLayers();
  const sel = layers.find((l) => l.id === state.selected);
  if (sel) {
    const b = layerBox(sel, a);
    const q = toLocal(sel, a, p);
    if (Math.abs(Math.abs(q.x) - b.w / 2) < 18 && Math.abs(Math.abs(q.y) - b.h / 2) < 18) {
      drag = { mode: 'scale', l: sel, start: Math.hypot(q.x, q.y), w: sel.w, size: sel.size };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
  }
  if (state.productId === 'decals' && p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h) {
    const m = MOCKUPS.vehicle;
    const cur = m.toInches(state.opts, a.x + a.w / 2, a.y + a.h / 2);
    const start = m.toInches(state.opts, p.x, p.y);
    drag = { mode: 'decal', cur, start };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const b = layerBox(l, a);
    const q = toLocal(l, a, p);
    if (Math.abs(q.x) <= b.w / 2 && Math.abs(q.y) <= b.h / 2) {
      state.selected = l.id;
      drag = { mode: 'move', l, dx: p.x - q.cx, dy: p.y - q.cy };
      canvas.setPointerCapture(e.pointerId);
      renderLayerPanel();
      draw();
      return;
    }
  }
  state.selected = null;
  renderLayerPanel();
  draw();
});
canvas.addEventListener('pointermove', (e) => {
  const p = toLogical(e);
  if (!drag) {
    canvas.style.cursor = hoverCursor(p);
    return;
  }
  const a = area();
  const l = drag.l;
  if (drag.mode === 'move') {
    l.x = clamp((p.x - drag.dx - a.x) / a.w, -0.2, 1.2);
    l.y = clamp((p.y - drag.dy - a.y) / a.h, -0.2, 1.2);
    l.auto = false;
  } else if (drag.mode === 'scale') {
    const q = toLocal(l, a, p);
    const f = Math.hypot(q.x, q.y) / drag.start;
    if (l.type === 'image') l.w = clamp(drag.w * f, 0.03, 3);
    else l.size = clamp(drag.size * f, 0.02, 1.5);
    l.auto = false;
    syncLayerControls();
  } else if (drag.mode === 'decal') {
    const m = MOCKUPS.vehicle;
    const now = m.toInches(state.opts, p.x, p.y);
    state.placement[state.opts.vehicle] = [drag.cur[0] + now[0] - drag.start[0], drag.cur[1] + now[1] - drag.start[1]];
  }
  draw();
});
const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function hoverCursor(p) {
  const a = area();
  if (state.productId === 'decals' && p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h) return 'move';
  for (const l of currentLayers()) {
    const b = layerBox(l, a);
    const q = toLocal(l, a, p);
    if (l.id === state.selected && Math.abs(Math.abs(q.x) - b.w / 2) < 18 && Math.abs(Math.abs(q.y) - b.h / 2) < 18) return 'nwse-resize';
    if (Math.abs(q.x) <= b.w / 2 && Math.abs(q.y) <= b.h / 2) return 'grab';
  }
  return 'default';
}

canvas.addEventListener('keydown', (e) => {
  const l = currentLayers().find((x) => x.id === state.selected);
  if (!l) return;
  const step = e.shiftKey ? 0.05 : 0.01;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    l.x += moves[e.key][0];
    l.y += moves[e.key][1];
    l.auto = false;
    draw();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    removeLayer(l.id);
  }
});

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- panels ---------------- */

function renderTabs() {
  const nav = $('#product-tabs');
  nav.replaceChildren(...PRODUCT_ORDER.map((id) => el('button', {
    type: 'button', class: 'tab', 'aria-pressed': String(id === state.productId),
    onclick: () => switchProduct(id),
  }, PRODUCTS[id].nav)));
}

function switchProduct(id) {
  if (id === state.productId) return;
  state.productId = id;
  state.opts = defaultOptions(id);
  for (const v of ['front', 'back']) arrange(state.layers[v]);
  history.replaceState(null, '', `?p=${id}`);
  refresh(true);
}

function renderHeader() {
  const p = product();
  $('#product-title').textContent = p.name;
  $('#product-blurb').textContent = p.blurb;
  document.title = `Design ${p.nav.toLowerCase()} — INK'D Prints Reno`;
  const views = viewsFor();
  const vt = $('#view-toggle');
  vt.hidden = views.length < 2;
  vt.replaceChildren(...views.map((v) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(v === state.view),
    onclick: () => { state.view = v; state.layers[`${v}Touched`] = true; state.selected = null; refresh(); },
  }, v === 'front' ? 'Front' : 'Back')));
  $('#view-label').textContent = views.length > 1 ? `Editing the ${state.view}` : '';
}

function renderOptions() {
  const p = product();
  const o = state.opts;
  const wrap = $('#options');
  wrap.replaceChildren();
  for (const opt of p.options) {
    const field = el('fieldset', { class: 'opt' }, el('legend', {}, opt.label));
    if (opt.type === 'choice') {
      const row = el('div', { class: 'choices' });
      for (const c of opt.choices) {
        if (!choiceAllowed(c, o)) continue;
        row.append(el('button', {
          type: 'button', class: 'choice', 'aria-pressed': String(o[opt.key] === c.value),
          onclick: () => { o[opt.key] = c.value; normalizeOptions(state.productId, o); refresh(); },
        }, el('span', {}, c.label), c.note ? el('small', {}, c.note) : null));
      }
      field.append(row);
    } else if (opt.type === 'swatch') {
      if (opt.key === 'ink' && o.colors === '2') continue;
      const row = el('div', { class: 'swatches' });
      for (const s of opt.swatches) {
        row.append(el('button', {
          type: 'button', class: 'swatch', title: s.label, 'aria-label': s.label, 'aria-pressed': String(o[opt.key] === s.value),
          style: `--c:${s.hex}`, onclick: () => { o[opt.key] = s.value; refresh(); },
        }));
      }
      field.append(row, el('p', { class: 'opt-value' }, opt.swatches.find((s) => s.value === o[opt.key])?.label || ''));
    } else if (opt.type === 'number') {
      const input = el('input', { type: 'number', inputmode: 'numeric', min: opt.min, step: opt.step, value: o[opt.key], 'aria-label': opt.label, id: `opt-${opt.key}` });
      const set = (v) => { o[opt.key] = Math.max(opt.min, Math.round(v)); input.value = o[opt.key]; refreshPrice(); };
      input.addEventListener('input', () => { o[opt.key] = Math.floor(Number(input.value)) || 0; refreshPrice(); });
      input.addEventListener('change', () => set(Number(input.value) || opt.min));
      field.append(el('div', { class: 'stepper' },
        el('button', { type: 'button', 'aria-label': `Fewer`, onclick: () => set(o[opt.key] - opt.step) }, '−'),
        input,
        el('button', { type: 'button', 'aria-label': `More`, onclick: () => set(o[opt.key] + opt.step) }, '+')));
    } else if (opt.type === 'sizes') {
      const grid = el('div', { class: 'sizes' });
      for (const s of opt.sizes) {
        const input = el('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: o.sizes[s] || 0, id: `size-${s}` });
        input.addEventListener('input', () => { o.sizes[s] = Math.max(0, Math.floor(Number(input.value)) || 0); refreshPrice(); });
        grid.append(el('label', { for: `size-${s}` }, el('span', {}, s), input));
      }
      field.append(grid);
    } else if (opt.type === 'dims') {
      const wIn = el('input', { type: 'number', min: opt.min, max: opt.max, step: 0.25, value: o.size.w, id: 'dim-w' });
      const hIn = el('input', { type: 'number', min: opt.min, max: opt.max, step: 0.25, value: o.size.h, id: 'dim-h' });
      const upd = () => {
        o.size = { w: clamp(Number(wIn.value) || opt.min, opt.min, opt.max), h: clamp(Number(hIn.value) || opt.min, opt.min, opt.max) };
        arrange(currentLayers());
        refreshPrice();
        draw();
      };
      wIn.addEventListener('input', upd);
      hIn.addEventListener('input', upd);
      const match = el('button', { type: 'button', class: 'link-btn', onclick: () => {
        const img = currentLayers().find((l) => l.type === 'image');
        if (!img) return toast('Upload your artwork first, then match its shape.');
        hIn.value = Math.round((Number(wIn.value) * img.canvas.height) / img.canvas.width * 4) / 4;
        fitLayer(img);
        img.auto = true;
        upd();
      } }, 'Match my artwork’s shape');
      field.append(el('div', { class: 'dims' },
        el('label', { for: 'dim-w' }, el('span', {}, 'Width'), wIn),
        el('span', { class: 'times', 'aria-hidden': 'true' }, '×'),
        el('label', { for: 'dim-h' }, el('span', {}, 'Height'), hIn)), match);
    }
    if (opt.hint) field.append(el('p', { class: 'hint' }, opt.hint));
    wrap.append(field);
  }
  if (state.productId === 'decals') {
    wrap.append(el('p', { class: 'hint' }, 'Drag the decal to place it on the vehicle. Need a full or partial wrap? ',
      el('a', { href: '/#contact' }, 'Ask for a wrap quote'), '.'));
  }
}

function refreshPrice() {
  const box = $('#price');
  const btn = $('#add-to-cart');
  try {
    const q = quote(state.productId, state.opts);
    box.querySelector('.total').textContent = money(q.total);
    box.querySelector('.unit').textContent = q.unitLabel || '';
    box.querySelector('.err').textContent = '';
    $('#summary').textContent = q.description;
    btn.disabled = false;
  } catch (e) {
    box.querySelector('.total').textContent = '—';
    box.querySelector('.unit').textContent = '';
    box.querySelector('.err').textContent = e.message;
    btn.disabled = true;
  }
}

function renderLayers() {
  const list = $('#layers');
  const layers = currentLayers();
  $('#layers-empty').hidden = layers.length > 0;
  list.replaceChildren(...[...layers].reverse().map((l) => el('li', { class: l.id === state.selected ? 'on' : '' },
    el('button', { type: 'button', class: 'layer-pick', onclick: () => { state.selected = l.id; renderLayerPanel(); draw(); } },
      l.type === 'image' ? thumbOf(l) : el('span', { class: 'layer-t', 'aria-hidden': 'true' }, 'T'),
      el('span', { class: 'layer-name' }, l.type === 'image' ? l.name : (l.text || 'Text').split('\n')[0])),
    el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove ${l.type === 'image' ? l.name : 'text'}`, onclick: () => removeLayer(l.id) }, '×'))));
}
function thumbOf(l) {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 40;
  c.className = 'layer-thumb';
  const x = c.getContext('2d');
  const s = Math.min(40 / l.canvas.width, 40 / l.canvas.height);
  x.drawImage(layerSource(l), (40 - l.canvas.width * s) / 2, (40 - l.canvas.height * s) / 2, l.canvas.width * s, l.canvas.height * s);
  return c;
}

function removeLayer(id) {
  state.layers[state.view] = currentLayers().filter((l) => l.id !== id);
  if (state.selected === id) state.selected = null;
  refresh();
}

function renderLayerPanel() {
  renderLayers();
  const box = $('#layer-controls');
  const l = currentLayers().find((x) => x.id === state.selected);
  box.hidden = !l;
  if (!l) return;
  box.replaceChildren();
  if (l.type === 'text') {
    const ta = el('textarea', { id: 'layer-text', rows: 2, 'aria-label': 'Text' });
    ta.value = l.text;
    ta.addEventListener('input', () => { l.text = ta.value; renderLayers(); draw(); });
    const font = el('select', { id: 'layer-font', 'aria-label': 'Font' }, FONTS.map((f) => el('option', { value: f, selected: f === l.font, style: `font-family:"${f}"` }, f)));
    font.addEventListener('change', () => { l.font = font.value; document.fonts.load(`40px "${l.font}"`).then(draw); });
    const presets = ['#111111', '#ffffff', '#ffd60a', '#ff2e88', '#00c2ff', '#7b2cbf', '#d7262f', '#1e9a4a'];
    const color = el('input', { type: 'color', value: l.color, 'aria-label': 'Custom text color' });
    color.addEventListener('input', () => { l.color = color.value; l.autoColor = false; draw(); });
    box.append(
      el('label', { class: 'ctl', for: 'layer-text' }, el('span', {}, 'Text'), ta),
      el('label', { class: 'ctl', for: 'layer-font' }, el('span', {}, 'Font'), font),
      el('div', { class: 'ctl' }, el('span', {}, 'Color'), el('div', { class: 'swatches small' },
        presets.map((c) => el('button', { type: 'button', class: 'swatch', style: `--c:${c}`, 'aria-label': c, onclick: () => { l.color = c; l.autoColor = false; color.value = c; draw(); } })), color)),
    );
  }
  const size = el('input', { type: 'range', id: 'layer-size', min: 5, max: 200, value: Math.round((l.type === 'image' ? l.w : l.size * 5) * 100) });
  size.addEventListener('input', () => {
    const v = Number(size.value) / 100;
    if (l.type === 'image') l.w = v;
    else l.size = v / 5;
    l.auto = false;
    draw();
  });
  const rot = el('input', { type: 'range', id: 'layer-rot', min: -180, max: 180, value: l.rot });
  rot.addEventListener('input', () => { l.rot = Number(rot.value); draw(); });
  box.append(
    el('label', { class: 'ctl', for: 'layer-size' }, el('span', {}, 'Size'), size),
    el('label', { class: 'ctl', for: 'layer-rot' }, el('span', {}, 'Rotate'), rot),
  );
  if (l.type === 'image') {
    const ko = el('input', { type: 'checkbox', id: 'layer-ko', checked: l.knockout });
    ko.addEventListener('change', () => { l.knockout = ko.checked; renderLayers(); draw(); });
    box.append(el('label', { class: 'check', for: 'layer-ko' }, ko, el('span', {}, 'Remove white background')));
  }
  box.append(el('div', { class: 'ctl-row' },
    el('button', { type: 'button', class: 'btn ghost sm', onclick: () => { if (l.type === 'image') { fitLayer(l); } else { l.x = 0.5; l.y = 0.5; } l.rot = 0; renderLayerPanel(); draw(); } }, l.type === 'image' ? 'Fit to print area' : 'Center'),
    el('button', { type: 'button', class: 'btn ghost sm', onclick: () => {
      const list = currentLayers();
      const i = list.indexOf(l);
      if (i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, l); refresh(); }
    } }, 'Bring forward'),
    el('button', { type: 'button', class: 'btn ghost sm', onclick: () => {
      const copy = { ...l, id: uid(), x: l.x + 0.06, y: l.y + 0.06 };
      currentLayers().push(copy);
      state.selected = copy.id;
      refresh();
    } }, 'Duplicate')));
}
function syncLayerControls() {
  const l = currentLayers().find((x) => x.id === state.selected);
  const s = $('#layer-size');
  if (l && s) s.value = Math.round((l.type === 'image' ? l.w : l.size * 5) * 100);
}

function refresh(full = false) {
  const dark = isDarkSurface();
  for (const l of currentLayers()) if (l.type === 'text' && l.autoColor) l.color = dark ? '#ffffff' : '#111111';
  if (full) renderTabs();
  renderHeader();
  renderOptions();
  renderLayerPanel();
  refreshPrice();
  draw();
}

/* ---------------- add to cart ---------------- */

const toBlob = (c, type = 'image/png', q) => new Promise((r) => c.toBlob(r, type, q));

async function shrinkToFit(canvas, preferPng) {
  let c = canvas;
  for (let i = 0; i < 6; i++) {
    const b = preferPng ? await toBlob(c, 'image/png') : await toBlob(c, 'image/jpeg', 0.9);
    if (b && b.size <= MAX_UPLOAD_BYTES) return b;
    const n = document.createElement('canvas');
    n.width = Math.round(c.width * 0.75);
    n.height = Math.round(c.height * 0.75);
    n.getContext('2d').drawImage(c, 0, 0, n.width, n.height);
    c = n;
  }
  return toBlob(c, 'image/jpeg', 0.8);
}

async function addToCart() {
  let q;
  try {
    q = quote(state.productId, state.opts);
  } catch (e) {
    return toast(e.message, 'error');
  }
  const views = viewsFor();
  const missing = views.filter((v) => !(v === state.view ? currentLayers() : state.layers[v]).length);
  if (missing.length === views.length) return toast('Add your logo or some text first — upload a file or tap “Add text”.', 'error');
  if (missing.length) return toast(`The ${missing[0]} is empty. Add a design there or switch the print location.`, 'error');

  setBusy(true, 'Saving your design…');
  try {
    const files = [];
    let thumb = '';
    for (const v of views) {
      const off = document.createElement('canvas');
      off.width = W * RES;
      off.height = W * RES;
      renderScene(off.getContext('2d'), { guides: false, view: v });
      files.push({ label: `Mockup (${v})`, name: `mockup-${v}.jpg`, blob: await toBlob(off, 'image/jpeg', 0.86) });
      if (!thumb) {
        const t = document.createElement('canvas');
        t.width = 320;
        t.height = 320;
        t.getContext('2d').drawImage(off, 0, 0, 320, 320);
        thumb = t.toDataURL('image/jpeg', 0.8);
      }
      const prevView = state.view;
      state.view = v;
      const proof = renderDesign(v, 1800);
      state.view = prevView;
      if (proof) files.push({ label: `Print proof (${v})`, name: `proof-${v}.png`, blob: await shrinkToFit(proof, true) });
    }
    const seen = new Set();
    for (const v of views) {
      for (const l of state.layers[v]) {
        if (l.type !== 'image' || seen.has(l.file)) continue;
        seen.add(l.file);
        const blob = l.file.size <= MAX_UPLOAD_BYTES ? l.file : await shrinkToFit(l.canvas, true);
        files.push({ label: 'Original artwork', name: l.file.size <= MAX_UPLOAD_BYTES ? l.name : l.name.replace(/\.\w+$/, '') + '.png', blob });
      }
    }
    const texts = views.flatMap((v) => state.layers[v].filter((l) => l.type === 'text').map((l) => `${v}: "${l.text}" (${l.font}, ${l.color})`));
    await cart.add({
      productId: state.productId,
      options: structuredClone(state.opts),
      notes: $('#notes').value.trim(),
      thumb,
      texts,
      placement: state.productId === 'decals' ? state.placement[state.opts.vehicle] || null : null,
    }, files);
    updateCartBadge();
    $('#notes').value = '';
    toast(el('span', {}, `Added to cart — ${money(q.total)}. `, el('a', { href: '/cart.html' }, 'View cart')), 'ok');
  } catch (e) {
    console.error(e);
    toast('Your design could not be saved. Try again, or send it through the contact form.', 'error');
  } finally {
    setBusy(false);
  }
}

function setBusy(on, msg = '') {
  $('#stage-wrap').classList.toggle('busy', on);
  $('#busy-msg').textContent = msg;
  $('#add-to-cart').disabled = on;
}

/* ---------------- wire up ---------------- */

const fileInput = $('#upload');
fileInput.addEventListener('change', () => { [...fileInput.files].forEach(addImageFile); fileInput.value = ''; });
$('#add-text').addEventListener('click', addText);
$('#add-to-cart').addEventListener('click', addToCart);

const dz = $('#stage-wrap');
['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('drop'); }));
['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove('drop'); }));
dz.addEventListener('drop', (e) => [...(e.dataTransfer?.files || [])].forEach(addImageFile));
document.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files || [])][0];
  if (f) addImageFile(f);
});

document.fonts.ready.then(draw);
refresh(true);
