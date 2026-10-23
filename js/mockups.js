/*
 * Product mockups drawn on a 1000 × 1000 logical canvas.
 * Each mockup exposes:
 *   area(o, state)        → where the customer's design goes {x,y,w,h,shape}
 *   render(ctx, args)     → draws the product with the design composited in
 *   effect?(canvas, o)    → optional post-processing of the flat design (ink tint, die-cut)
 */
import { SHIRT_COLORS, INK_COLORS, PRODUCTS } from './pricing.js';

export const W = 1000;

const hexOf = (list, v) => (list.find((s) => s.value === v) || list[0]).hex;

function backdrop(ctx, floorY = 900) {
  const g = ctx.createRadialGradient(500, 380, 60, 500, 500, 760);
  g.addColorStop(0, '#3a3546');
  g.addColorStop(1, '#141218');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  if (floorY) {
    const f = ctx.createLinearGradient(0, floorY - 120, 0, W);
    f.addColorStop(0, 'rgba(0,0,0,0)');
    f.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = f;
    ctx.fillRect(0, floorY - 120, W, W);
  }
}

function floorShadow(ctx, cx, cy, rx, ry, a = 0.45) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.setTransform(ctx.getTransform().scale(1, ry / rx));
  ctx.beginPath();
  ctx.arc(cx, cy * (rx / ry), rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDesignInto(ctx, design, area, clipFn, alpha = 1, op = 'source-over') {
  if (!design) return;
  ctx.save();
  if (clipFn) { clipFn(); ctx.clip(); }
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = op;
  ctx.drawImage(design, area.x, area.y, area.w, area.h);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/* ---------- design effects ---------- */

/** One-ink print: dark/colored areas become the ink color, light areas print nothing */
export function tint(canvas, hex) {
  const c = canvas.getContext('2d', { willReadFrequently: true });
  const id = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const cover = lum > 0.86 ? 0 : lum > 0.74 ? (0.86 - lum) / 0.12 : 1;
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
    d[i + 3] = Math.round(d[i + 3] * cover);
  }
  c.putImageData(id, 0, 0);
  return canvas;
}

/** White die-cut border around the design's shape */
export function dieCut(canvas, borderFrac = 0.035) {
  const pad = Math.round(canvas.width * borderFrac);
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const sil = document.createElement('canvas');
  sil.width = canvas.width;
  sil.height = canvas.height;
  const s = sil.getContext('2d');
  for (let a = 0; a < 360; a += 12) {
    const r = (a * Math.PI) / 180;
    s.drawImage(canvas, Math.cos(r) * pad, Math.sin(r) * pad);
  }
  s.drawImage(canvas, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#ffffff';
  s.fillRect(0, 0, sil.width, sil.height);
  const o = out.getContext('2d');
  o.drawImage(sil, 0, 0);
  o.drawImage(canvas, 0, 0);
  return out;
}

/* ---------- cups ---------- */

const cup = {
  geom(o) {
    const hMap = { 8: 430, 12: 490, 16: 545, 20: 590, 24: 620, 32: 665 };
    const h = hMap[o.size] || 545;
    const bottom = 875;
    const top = bottom - h;
    const tw = o.style === 'hot' ? 390 : 410;
    return { top, bottom, tw, bw: tw * 0.72, cx: 500, h };
  },
  widthAt(g, y) {
    return g.bw + ((g.tw - g.bw) * (g.bottom - y)) / g.h;
  },
  body(ctx, g) {
    const { cx, top, bottom, tw, bw } = g;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, top);
    ctx.lineTo(cx + tw / 2, top);
    ctx.lineTo(cx + bw / 2, bottom);
    ctx.quadraticCurveTo(cx, bottom + 16, cx - bw / 2, bottom);
    ctx.closePath();
  },
  area(o) {
    const g = this.geom(o);
    const yMid = g.top + g.h * 0.5;
    const h = g.h * 0.5;
    const w = this.widthAt(g, yMid) * 0.66;
    return { x: g.cx - w / 2, y: yMid - h / 2, w, h };
  },
  ink(o) {
    return o.colors === '1' ? hexOf(INK_COLORS, o.ink) : null;
  },
  render(ctx, { o, design, area }) {
    backdrop(ctx);
    const g = this.geom(o);
    const { cx, top, bottom, tw } = g;
    floorShadow(ctx, cx, bottom + 8, g.bw * 0.75, 26);
    const clip = () => this.body(ctx, g);

    if (o.style === 'cold') {
      // straw behind the dome
      ctx.fillStyle = '#121212';
      ctx.save();
      ctx.translate(cx + 40, top - 40);
      ctx.rotate(0.12);
      roundRect(ctx, -11, -230, 22, 420, 6);
      ctx.fill();
      ctx.restore();
      // iced drink
      ctx.save();
      clip();
      ctx.clip();
      const d = ctx.createLinearGradient(0, top, 0, bottom);
      d.addColorStop(0, '#ead2b3');
      d.addColorStop(0.08, '#d7a06a');
      d.addColorStop(1, '#8f5a2c');
      ctx.fillStyle = d;
      ctx.fillRect(0, top + 28, W, W);
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(0, top, W, 28);
      ctx.restore();
      drawDesignInto(ctx, design, area, clip, 0.97);
      // clear plastic shine
      ctx.save();
      clip();
      ctx.clip();
      const s = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
      s.addColorStop(0, 'rgba(255,255,255,.45)');
      s.addColorStop(0.12, 'rgba(255,255,255,.05)');
      s.addColorStop(0.68, 'rgba(255,255,255,0)');
      s.addColorStop(0.76, 'rgba(255,255,255,.28)');
      s.addColorStop(0.82, 'rgba(255,255,255,0)');
      s.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, W, W);
      ctx.restore();
      clip();
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // dome lid
      ctx.beginPath();
      ctx.ellipse(cx, top, tw / 2 + 10, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - tw / 2 + 8, top - 4);
      ctx.bezierCurveTo(cx - tw / 2 + 20, top - 150, cx + tw / 2 - 20, top - 150, cx + tw / 2 - 8, top - 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.stroke();
    } else {
      const paper = o.cupColor === 'kraft' ? '#b88a57' : '#f3f2ee';
      clip();
      ctx.fillStyle = paper;
      ctx.fill();
      drawDesignInto(ctx, design, area, clip, o.cupColor === 'kraft' ? 0.92 : 1, o.cupColor === 'kraft' ? 'multiply' : 'source-over');
      ctx.save();
      clip();
      ctx.clip();
      const s = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
      s.addColorStop(0, 'rgba(0,0,0,.32)');
      s.addColorStop(0.28, 'rgba(255,255,255,.22)');
      s.addColorStop(0.45, 'rgba(255,255,255,0)');
      s.addColorStop(1, 'rgba(0,0,0,.38)');
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, W, W);
      ctx.restore();
      // rolled rim + sip lid
      ctx.fillStyle = '#1b1b1b';
      roundRect(ctx, cx - tw / 2 - 12, top - 18, tw + 24, 30, 12);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - tw / 2 + 4, top - 14);
      ctx.lineTo(cx - tw / 2 + 34, top - 62);
      ctx.lineTo(cx + tw / 2 - 34, top - 62);
      ctx.lineTo(cx + tw / 2 - 4, top - 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      roundRect(ctx, cx - 70, top - 82, 140, 26, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(cx - tw / 2 + 40, top - 56, tw - 80, 6);
    }
  },
};

/* ---------- apparel ---------- */

const shirt = {
  path(ctx, garment, view) {
    const long = garment !== 'tee';
    const neckDip = view === 'back' ? 22 : 62;
    ctx.beginPath();
    ctx.moveTo(418, 128);
    ctx.lineTo(300, 168);
    if (long) {
      ctx.lineTo(190, 300);
      ctx.lineTo(132, 690);
      ctx.lineTo(206, 708);
      ctx.lineTo(262, 440);
      ctx.lineTo(312, 360);
    } else {
      ctx.lineTo(160, 300);
      ctx.lineTo(236, 392);
      ctx.lineTo(312, 340);
    }
    ctx.lineTo(306, 880);
    ctx.quadraticCurveTo(500, 900, 694, 880);
    ctx.lineTo(688, long ? 360 : 340);
    if (long) {
      ctx.lineTo(738, 440);
      ctx.lineTo(794, 708);
      ctx.lineTo(868, 690);
      ctx.lineTo(810, 300);
    } else {
      ctx.lineTo(764, 392);
      ctx.lineTo(840, 300);
    }
    ctx.lineTo(700, 168);
    ctx.lineTo(582, 128);
    ctx.quadraticCurveTo(500, 128 + neckDip * 1.6, 418, 128);
    ctx.closePath();
  },
  area(o, state) {
    const view = state?.view || 'front';
    if (o.garment === 'hoodie' && view === 'front') return { x: 375, y: 250, w: 250, h: 250 };
    return { x: 365, y: view === 'back' ? 220 : 240, w: 270, h: 330 };
  },
  render(ctx, { o, design, area, state }) {
    backdrop(ctx, 0);
    const view = state?.view || 'front';
    const color = hexOf(SHIRT_COLORS, o.color);
    const dark = ['black', 'navy', 'forest', 'purple', 'red'].includes(o.color);
    const clip = () => this.path(ctx, o.garment, view);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    if (o.garment === 'hoodie' && view === 'front') {
      // hood behind the collar
      ctx.beginPath();
      ctx.ellipse(500, 150, 135, 95, 0, Math.PI, 0);
      ctx.fillStyle = color;
      ctx.fill();
    }
    clip();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    if (o.garment === 'hoodie') {
      ctx.save();
      ctx.beginPath();
      if (view === 'front') ctx.ellipse(500, 158, 100, 70, 0, 0, Math.PI);
      else ctx.ellipse(500, 150, 140, 120, 0, Math.PI * 1.02, Math.PI * 1.98, true);
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fill();
      ctx.restore();
    }
    drawDesignInto(ctx, design, area, clip, 0.97);
    // fabric shading
    ctx.save();
    clip();
    ctx.clip();
    const s = ctx.createLinearGradient(300, 0, 700, 0);
    s.addColorStop(0, 'rgba(0,0,0,.28)');
    s.addColorStop(0.2, 'rgba(0,0,0,.04)');
    s.addColorStop(0.5, dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.12)');
    s.addColorStop(0.8, 'rgba(0,0,0,.04)');
    s.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.1)';
    ctx.lineWidth = 3;
    for (const [a, b, c, d] of [[318, 380, 360, 520], [682, 380, 640, 520], [330, 760, 380, 860], [670, 770, 630, 860]]) {
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.quadraticCurveTo((a + c) / 2 + 12, (b + d) / 2, c, d);
      ctx.stroke();
    }
    ctx.restore();
    // collar rib + hems
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.18)';
    ctx.lineWidth = 9;
    if (o.garment !== 'hoodie') {
      ctx.beginPath();
      const dip = view === 'back' ? 22 : 62;
      ctx.moveTo(420, 134);
      ctx.quadraticCurveTo(500, 134 + dip * 1.5, 580, 134);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(308, 858);
    ctx.quadraticCurveTo(500, 878, 692, 858);
    ctx.stroke();
    if (o.garment === 'hoodie' && view === 'front') {
      ctx.beginPath();
      ctx.moveTo(380, 860);
      ctx.lineTo(395, 640);
      ctx.lineTo(605, 640);
      ctx.lineTo(620, 860);
      ctx.stroke();
      ctx.strokeStyle = dark ? '#e9e9e9' : '#444';
      ctx.lineWidth = 6;
      for (const x of [470, 530]) {
        ctx.beginPath();
        ctx.moveTo(x, 215);
        ctx.quadraticCurveTo(x + (x < 500 ? -6 : 6), 280, x, 340);
        ctx.stroke();
      }
    }
  },
};

/* ---------- banners & signs ---------- */

function fitRect(wIn, hIn, maxW, maxH, cx, cy) {
  const s = Math.min(maxW / wIn, maxH / hIn);
  const w = wIn * s, h = hIn * s;
  return { x: cx - w / 2, y: cy - h / 2, w, h, ppi: s };
}

const sign = {
  rect(o) {
    const [w, h] = PRODUCTS.signs.dims[o.type];
    if (o.type === 'retract') return fitRect(w, h, 400, 720, 500, 450);
    if (o.type === 'yard') return fitRect(w, h, 620, 470, 500, 390);
    return fitRect(w, h, 880, 560, 500, 470);
  },
  area(o) {
    const r = this.rect(o);
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  },
  render(ctx, { o, design, area }) {
    backdrop(ctx, o.type === 'yard' ? 0 : 900);
    const r = this.rect(o);
    const bg = hexOf(PRODUCTS.signs.options[1].swatches, o.bg);
    if (o.type === 'yard') {
      const gg = ctx.createLinearGradient(0, 760, 0, W);
      gg.addColorStop(0, '#24452a');
      gg.addColorStop(1, '#10200f');
      ctx.fillStyle = gg;
      ctx.fillRect(0, 780, W, 220);
      ctx.strokeStyle = '#8c8f93';
      ctx.lineWidth = 7;
      for (const x of [r.x + r.w * 0.3, r.x + r.w * 0.7]) {
        ctx.beginPath();
        ctx.moveTo(x, r.y + r.h - 10);
        ctx.lineTo(x, 860);
        ctx.stroke();
      }
    } else if (o.type === 'retract') {
      ctx.fillStyle = '#b9bcc2';
      roundRect(ctx, r.x - 28, r.y + r.h - 4, r.w + 56, 40, 10);
      ctx.fill();
      ctx.fillStyle = '#6d7076';
      ctx.fillRect(r.x - 28, r.y + r.h + 30, r.w + 56, 6);
      floorShadow(ctx, 500, r.y + r.h + 46, r.w * 0.8, 18);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 2;
      for (const x of [r.x + 8, r.x + r.w - 8]) {
        ctx.beginPath();
        ctx.moveTo(x, r.y + 8);
        ctx.lineTo(x + (x < 500 ? -30 : 30), 0);
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = bg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    drawDesignInto(ctx, design, area, () => { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); });
    // material sheen
    const s = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    s.addColorStop(0, 'rgba(255,255,255,.1)');
    s.addColorStop(0.5, 'rgba(255,255,255,0)');
    s.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = s;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (o.type === 'yard') {
      ctx.strokeStyle = 'rgba(0,0,0,.05)';
      ctx.lineWidth = 1;
      for (let x = r.x + 4; x < r.x + r.w; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, r.y);
        ctx.lineTo(x, r.y + r.h);
        ctx.stroke();
      }
    }
    if (!['retract', 'yard'].includes(o.type)) {
      // hem + grommets every ~2 ft
      const inch = r.ppi;
      ctx.strokeStyle = 'rgba(0,0,0,.12)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + inch, r.y + inch, r.w - 2 * inch, r.h - 2 * inch);
      const [wIn, hIn] = PRODUCTS.signs.dims[o.type];
      const pts = [];
      const nx = Math.max(1, Math.round(wIn / 24)), ny = Math.max(1, Math.round(hIn / 24));
      for (let i = 0; i <= nx; i++) pts.push([i / nx, 0], [i / nx, 1]);
      for (let j = 1; j < ny; j++) pts.push([0, j / ny], [1, j / ny]);
      const g = Math.max(5, inch * 0.9);
      for (const [u, v] of pts) {
        const x = r.x + g * 1.4 + u * (r.w - g * 2.8);
        const y = r.y + g * 1.4 + v * (r.h - g * 2.8);
        ctx.beginPath();
        ctx.arc(x, y, g * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = '#c9ccd1';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, g * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a2a';
        ctx.fill();
      }
    }
  },
};

/* ---------- flyers & business cards ---------- */

const paper = {
  rect(o) {
    const [w, h] = PRODUCTS.paper.dims[o.type];
    return fitRect(w, h, o.type === 'card' ? 720 : 640, 700, 500, 480);
  },
  area(o) {
    const r = this.rect(o);
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  },
  render(ctx, { o, design, area }) {
    backdrop(ctx, 0);
    const r = this.rect(o);
    const bg = hexOf(PRODUCTS.paper.options[2].swatches, o.bg);
    for (const [rot, dx, dy] of [[-0.07, -26, 22], [0.05, 22, 12]]) {
      ctx.save();
      ctx.translate(500 + dx, 480 + dy);
      ctx.rotate(rot);
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = bg;
      ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = bg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    drawDesignInto(ctx, design, area, () => { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); });
    const s = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    s.addColorStop(0, 'rgba(255,255,255,.08)');
    s.addColorStop(1, 'rgba(0,0,0,.08)');
    ctx.fillStyle = s;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  },
};

/* ---------- die-cut stickers ---------- */

function holoFill(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  ['#ff5ec4', '#ffd84d', '#5effc1', '#4dc3ff', '#b35cff', '#ff5ec4'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

const sticker = {
  area() {
    return { x: 220, y: 200, w: 560, h: 560 };
  },
  effect(canvas) {
    return dieCut(canvas);
  },
  render(ctx, { o, design, area }) {
    backdrop(ctx, 0);
    if (!design) return;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 16;
    ctx.drawImage(design, area.x, area.y, area.w, area.h);
    ctx.restore();
    // finish layer, masked to the sticker shape
    const m = document.createElement('canvas');
    m.width = design.width;
    m.height = design.height;
    const mc = m.getContext('2d');
    if (o.finish === 'holo') {
      holoFill(mc, 0, 0, m.width, m.height);
      mc.globalCompositeOperation = 'destination-in';
      mc.drawImage(design, 0, 0);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(m, area.x, area.y, area.w, area.h);
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(m, area.x, area.y, area.w, area.h);
      ctx.restore();
    } else if (o.finish === 'gloss') {
      const g = mc.createLinearGradient(0, 0, m.width, m.height);
      g.addColorStop(0.3, 'rgba(255,255,255,0)');
      g.addColorStop(0.42, 'rgba(255,255,255,.35)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      mc.fillStyle = g;
      mc.fillRect(0, 0, m.width, m.height);
      mc.globalCompositeOperation = 'destination-in';
      mc.drawImage(design, 0, 0);
      ctx.drawImage(m, area.x, area.y, area.w, area.h);
    }
  },
};

/* ---------- roll labels ---------- */

const label = {
  area() {
    return { x: 350, y: 300, w: 440, h: 440, shape: 'circle' };
  },
  render(ctx, { o, design, area }) {
    backdrop(ctx, 0);
    const bg = hexOf(PRODUCTS.labels.options[1].swatches, o.bg);
    const cy = area.y + area.h / 2;
    // liner strip
    ctx.fillStyle = '#efe9dc';
    ctx.fillRect(130, cy - 250, W, 500);
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.fillRect(130, cy - 250, W, 6);
    // roll
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(110, cy, 250, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e1d0';
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.08)';
    for (let r = 240; r > 80; r -= 9) {
      ctx.beginPath();
      ctx.arc(110, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(110, cy, 75, 0, Math.PI * 2);
    ctx.fillStyle = '#8a6a43';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(110, cy, 58, 0, Math.PI * 2);
    ctx.fillStyle = '#1a171d';
    ctx.fill();
    // labels: main + next one on the strip
    for (const dx of [0, area.w + 40]) {
      const a = { ...area, x: area.x + dx };
      const circ = () => { ctx.beginPath(); ctx.arc(a.x + a.w / 2, cy, a.w / 2, 0, Math.PI * 2); };
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.25)';
      ctx.shadowBlur = 8;
      circ();
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.restore();
      drawDesignInto(ctx, design, a, circ);
      if (o.finish === 'gloss') {
        ctx.save();
        circ();
        ctx.clip();
        const g = ctx.createLinearGradient(a.x, a.y, a.x + a.w, a.y + a.h);
        g.addColorStop(0.25, 'rgba(255,255,255,0)');
        g.addColorStop(0.38, 'rgba(255,255,255,.3)');
        g.addColorStop(0.5, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(a.x, a.y, a.w, a.h);
        ctx.restore();
      }
    }
  },
};

/* ---------- vehicle decals (drawn to real scale) ---------- */

// Side profiles in inches, facing left. y = height above ground.
const VEHICLES = {
  van: {
    len: 236, ht: 102, wheels: [[44, 16], [188, 16]], spot: [150, 58],
    body: [[4, 14], [0, 28], [2, 46], [30, 56], [52, 66], [80, 96], [94, 101], [232, 101], [236, 96], [236, 16]],
    windows: [[[58, 66], [80, 92], [102, 92], [102, 66]]],
    seams: [[106, 14, 106, 96], [168, 14, 168, 96]],
  },
  truck: {
    len: 230, ht: 76, wheels: [[42, 16], [182, 16]], spot: [104, 40],
    body: [[3, 14], [0, 26], [2, 46], [62, 50], [90, 75], [140, 76], [142, 50], [230, 50], [230, 14]],
    windows: [[[94, 52], [112, 72], [136, 72], [136, 52]]],
    seams: [[90, 14, 90, 52], [140, 14, 140, 76]],
  },
  car: {
    len: 190, ht: 57, wheels: [[36, 13], [152, 13]], spot: [96, 28],
    body: [[3, 12], [0, 24], [4, 34], [50, 38], [72, 55], [126, 56], [150, 40], [188, 36], [190, 12]],
    windows: [[[76, 40], [92, 53], [124, 53], [140, 40]]],
    seams: [[100, 12, 100, 40], [72, 14, 72, 38]],
  },
};

const vehicle = {
  frame(o) {
    const v = VEHICLES[o.vehicle] || VEHICLES.van;
    const s = 880 / v.len;
    const ground = 720;
    return { v, s, x0: 60, ground, X: (x) => 60 + x * s, Y: (y) => ground - y * s };
  },
  area(o, state) {
    const f = this.frame(o);
    const p = state?.placement?.[o.vehicle] || f.v.spot;
    const w = o.size.w * f.s, h = o.size.h * f.s;
    return { x: f.X(p[0]) - w / 2, y: f.Y(p[1]) - h / 2, w, h };
  },
  /** Convert a canvas point to vehicle inches (for dragging the decal) */
  toInches(o, x, y) {
    const f = this.frame(o);
    return [(x - f.x0) / f.s, (f.ground - y) / f.s];
  },
  render(ctx, { o, design, area }) {
    backdrop(ctx, 0);
    const { v, s, X, Y, ground } = this.frame(o);
    ctx.fillStyle = '#1d1b22';
    ctx.fillRect(0, ground, W, W - ground);
    floorShadow(ctx, X(v.len / 2), ground, (v.len * s) / 2 + 20, 18, 0.6);
    const bodyPath = () => {
      ctx.beginPath();
      v.body.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      // bottom edge with wheel arches
      const [w1, w2] = v.wheels;
      const ar = w2[1] + 4;
      ctx.lineTo(X(w2[0] + ar), Y(14));
      ctx.arc(X(w2[0]), Y(w2[1]), ar * s, 0, Math.PI, true);
      ctx.lineTo(X(w1[0] + ar), Y(14));
      ctx.arc(X(w1[0]), Y(w1[1]), ar * s, 0, Math.PI, true);
      ctx.closePath();
    };
    bodyPath();
    const b = ctx.createLinearGradient(0, Y(v.ht), 0, ground);
    b.addColorStop(0, '#fbfbfb');
    b.addColorStop(0.6, '#e4e5e8');
    b.addColorStop(1, '#b9bbc0');
    ctx.fillStyle = b;
    ctx.fill();
    ctx.strokeStyle = '#8d9096';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const win of v.windows) {
      ctx.beginPath();
      win.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.closePath();
      const g = ctx.createLinearGradient(X(win[0][0]), Y(win[1][1]), X(win[3][0]), Y(win[0][1]));
      g.addColorStop(0, '#2d3a4a');
      g.addColorStop(1, '#0f151d');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 2;
    for (const [x1, y1, x2, y2] of v.seams) {
      ctx.beginPath();
      ctx.moveTo(X(x1), Y(y1));
      ctx.lineTo(X(x2), Y(y2));
      ctx.stroke();
    }
    // headlight + mirror
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(X(1), Y(42), 7, 12);
    // decal (clipped to the body so it wraps realistically)
    drawDesignInto(ctx, design, area, bodyPath, o.material === 'perf' ? 0.88 : 1);
    for (const [x, y] of v.wheels) {
      ctx.beginPath();
      ctx.arc(X(x), Y(y), y * s, 0, Math.PI * 2);
      ctx.fillStyle = '#121212';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(X(x), Y(y), y * s * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#9da1a8';
      ctx.fill();
    }
  },
};

export const MOCKUPS = { cup, shirt, sign, paper, sticker, label, vehicle };
