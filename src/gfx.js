'use strict';
// Graphics helpers: canvases, colors, pixel-art post-processing, text and windows.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.ctx = c.getContext('2d', { willReadFrequently: false });
  c.ctx.imageSmoothingEnabled = false;
  return c;
}

// ---------------------------------------------------------------- colors
function hexRgb(h) {
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex(r, g, b) {
  const c = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
// f > 0 lightens toward white, f < 0 darkens toward black.
function shade(hex, f) {
  const [r, g, b] = hexRgb(hex);
  if (f >= 0) return rgbHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
  return rgbHex(r * (1 + f), g * (1 + f), b * (1 + f));
}
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
function rgba(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------- ascii sprites
// rows: array of strings, '.' or ' ' = transparent; pal maps chars to hex colors.
function spriteFromRows(rows, pal) {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const c = makeCanvas(w, h);
  const img = c.ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      const [r, g, b] = hexRgb(col);
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  c.ctx.putImageData(img, 0, 0);
  return c;
}
// Build a symmetric sprite from left-half rows.
function mirrorRows(half) {
  return half.map(r => r + r.split('').reverse().join(''));
}
function flipH(src) {
  const c = makeCanvas(src.width, src.height);
  c.ctx.translate(src.width, 0);
  c.ctx.scale(-1, 1);
  c.ctx.drawImage(src, 0, 0);
  return c;
}
// Solid-color silhouette of a sprite (hit flashes, outlines).
function silhouette(src, color) {
  const c = makeCanvas(src.width, src.height);
  c.ctx.drawImage(src, 0, 0);
  c.ctx.globalCompositeOperation = 'source-in';
  c.ctx.fillStyle = color;
  c.ctx.fillRect(0, 0, src.width, src.height);
  return c;
}
// One-pixel outline ring around opaque pixels (used for target highlight).
function outlineOnly(src, color) {
  const w = src.width, h = src.height;
  const s = src.ctx.getImageData(0, 0, w, h).data;
  const c = makeCanvas(w, h);
  const img = c.ctx.createImageData(w, h);
  const [r, g, b] = hexRgb(color);
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && s[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (op(x, y)) continue;
    if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) {
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  c.ctx.putImageData(img, 0, 0);
  return c;
}
function opaqueBounds(src) {
  const w = src.width, h = src.height;
  const d = src.ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 0) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// Turn an anti-aliased vector drawing into crisp pixel art:
// hard alpha, top-left light, bottom-right shadow, grain, dark outline.
function pixelize(c, opt = {}) {
  const o = Object.assign({ outline: '#0c0808', light: 0.16, dark: 0.3, noise: 0.07, seed: 1, rim: true }, opt);
  const w = c.width, h = c.height;
  const img = c.ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const op = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] >= 120) { op[i] = 1; d[i * 4 + 3] = 255; }
    else { d[i * 4 + 3] = 0; }
  }
  const src = new Uint8ClampedArray(d);
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h) ? op[y * w + x] : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!op[i]) continue;
    let f = 0;
    if (o.rim) {
      if (!at(x, y - 1) || !at(x - 1, y)) f += o.light;
      else if (!at(x, y + 1) || !at(x + 1, y)) f -= o.dark;
      else if (!at(x + 1, y + 2) || !at(x + 2, y + 1)) f -= o.dark * 0.45;
    }
    f += (hash2(x, y, o.seed) - 0.5) * o.noise * 2;
    const k = i * 4;
    for (let ch = 0; ch < 3; ch++) {
      const v = src[k + ch];
      d[k + ch] = f >= 0 ? v + (255 - v) * f * 0.6 : v * (1 + f);
    }
  }
  if (o.outline) {
    const [r, g, b] = hexRgb(o.outline);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (op[i]) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
        const k = i * 4;
        d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
      }
    }
  }
  c.ctx.putImageData(img, 0, 0);
  return c;
}

// Set individual pixels after pixelize (glowing eyes, teeth, sparkles).
function px(ctx, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// ---------------------------------------------------------------- vector painter (pre-pixelize)
const P = {
  ellipse(ctx, cx, cy, rx, ry, color, rot = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
    ctx.fill();
  },
  circle(ctx, cx, cy, r, color) { P.ellipse(ctx, cx, cy, r, r, color); },
  rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); },
  poly(ctx, pts, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  },
  // Tapered capsule from (x0,y0) radius r0 to (x1,y1) radius r1.
  limb(ctx, x0, y0, x1, y1, r0, r1, color) {
    const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
    const c = Math.cos(a), s = Math.sin(a);
    P.poly(ctx, [
      [x0 + c * r0, y0 + s * r0], [x1 + c * r1, y1 + s * r1],
      [x1 - c * r1, y1 - s * r1], [x0 - c * r0, y0 - s * r0],
    ], color);
    P.circle(ctx, x0, y0, r0, color);
    P.circle(ctx, x1, y1, r1, color);
  },
  line(ctx, x0, y0, x1, y1, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  },
  curve(ctx, pts, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  },
};

// ---------------------------------------------------------------- text
const FONT = '"IM Fell English", "Iowan Old Style", "Palatino Linotype", Georgia, serif';
const FONT_T = '"Pirata One", "IM Fell English", Georgia, serif';
const TCOL = {
  w: '#e9e0cf', r: '#e0503e', g: '#e6b94c', b: '#86a8ee', d: '#8e8576',
  p: '#c08ae6', v: '#8cc475', o: '#e88c44', y: '#f0e090',
};

function setFont(ctx, size, family = FONT, style = '') {
  ctx.font = `${style} ${size}px ${family}`.trim();
}

function drawText(ctx, s, x, y, o = {}) {
  const size = o.size || 26;
  setFont(ctx, size, o.family || FONT, o.style || '');
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'alphabetic';
  const a = o.alpha == null ? 1 : o.alpha;
  if (o.shadow !== false) {
    ctx.fillStyle = `rgba(0,0,0,${0.85 * a})`;
    ctx.fillText(s, x + 2, y + 2);
  }
  ctx.globalAlpha = a;
  ctx.fillStyle = o.color || TCOL.w;
  ctx.fillText(s, x, y);
  ctx.globalAlpha = 1;
}

// Rich text: {r}red{/} style color tags. Returns lines of positioned runs.
function parseRich(str, defColor) {
  const out = [];
  let color = defColor;
  const re = /\{(\w|\/)\}/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push({ t: str.slice(last, m.index), c: color });
    color = m[1] === '/' ? defColor : (TCOL[m[1]] || defColor);
    last = re.lastIndex;
  }
  if (last < str.length) out.push({ t: str.slice(last), c: color });
  return out;
}
function layoutRich(ctx, str, maxW, size = 26, family = FONT, defColor = TCOL.w) {
  setFont(ctx, size, family);
  const runs = parseRich(str, defColor);
  // Split into word tokens, keeping color and explicit newlines.
  const tokens = [];
  for (const r of runs) {
    const parts = r.t.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      if (p.includes('\n')) {
        const n = p.split('\n').length - 1;
        for (let i = 0; i < n; i++) tokens.push({ nl: true });
        continue;
      }
      tokens.push({ t: p, c: r.c, space: /^\s+$/.test(p) });
    }
  }
  const lines = [[]];
  let x = 0, count = 0;
  for (const tk of tokens) {
    if (tk.nl) { lines.push([]); x = 0; continue; }
    const w = ctx.measureText(tk.t).width;
    if (tk.space) {
      if (x === 0) continue;
      lines[lines.length - 1].push({ t: tk.t, c: tk.c, x, w });
      x += w; count += tk.t.length;
      continue;
    }
    if (x + w > maxW && x > 0) {
      const cur = lines[lines.length - 1];
      while (cur.length && /^\s+$/.test(cur[cur.length - 1].t)) { count -= cur.pop().t.length; }
      lines.push([]);
      x = 0;
    }
    lines[lines.length - 1].push({ t: tk.t, c: tk.c, x, w });
    x += w; count += tk.t.length;
  }
  return { lines, count, size, family };
}
function drawRich(ctx, lay, x, y, lineH, limit = Infinity, alpha = 1) {
  setFont(ctx, lay.size, lay.family);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let shown = 0;
  for (let li = 0; li < lay.lines.length; li++) {
    const ly = y + li * lineH;
    for (const run of lay.lines[li]) {
      if (shown >= limit) return;
      let t = run.t;
      if (shown + t.length > limit) t = t.slice(0, limit - shown);
      shown += run.t.length;
      ctx.fillStyle = `rgba(0,0,0,${0.85 * alpha})`;
      ctx.fillText(t, x + run.x + 2, ly + 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = run.c;
      ctx.fillText(t, x + run.x, ly);
      ctx.globalAlpha = 1;
    }
  }
}
function stripTags(s) { return s.replace(/\{(\w|\/)\}/g, ''); }

// ---------------------------------------------------------------- windows
function drawWindow(ctx, x, y, w, h, alpha = 0.9) {
  ctx.fillStyle = `rgba(9,6,8,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = '#7a6d5e';
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = '#a89580';
  for (const [cx, cy] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) {
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  }
}
function drawCursor(ctx, x, y, w, h, t) {
  const a = 0.28 + Math.sin(t / 180) * 0.1;
  ctx.fillStyle = `rgba(150,52,40,${a})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `rgba(230,150,120,${a + 0.25})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}
function drawBar(ctx, x, y, w, h, frac, color, back = '#1a1214') {
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * clamp(frac, 0, 1));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, fw, Math.max(1, Math.floor(h / 3)));
}
