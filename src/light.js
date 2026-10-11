'use strict';
// Field of view (recursive shadowcasting), static and torch light, dithered darkness.

const FOV_MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
];

function computeFOV(L, ox, oy, radius, mark) {
  mark(ox, oy, 0);
  for (let o = 0; o < 8; o++) {
    castLight(L, ox, oy, radius, 1, 1.0, 0.0, FOV_MULT[0][o], FOV_MULT[1][o], FOV_MULT[2][o], FOV_MULT[3][o], mark);
  }
}
function castLight(L, cx, cy, radius, row, start, end, xx, xy, yx, yy, mark) {
  if (start < end) return;
  const r2 = (radius + 0.5) * (radius + 0.5);
  let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1;
    const dy = -j;
    let blocked = false;
    while (dx <= 0) {
      dx++;
      const X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) mark(X, Y, Math.sqrt(d2));
      const op = L.opaque(X, Y);
      if (blocked) {
        if (op) { newStart = rSlope; continue; }
        blocked = false;
        start = newStart;
      } else if (op && j < radius) {
        blocked = true;
        castLight(L, cx, cy, radius, j + 1, start, lSlope, xx, xy, yx, yy, mark);
        newStart = rSlope;
      }
    }
    if (blocked) break;
  }
}

// Line of sight between two tiles (Bresenham through non-opaque tiles).
function hasLOS(L, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  while (!(x === x1 && y === y1)) {
    if ((x !== x0 || y !== y0) && L.opaque(x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return true;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const Light = {
  vis: null, pdist: null, bright: null, w: 0, h: 0,
  dark: null, darkImg: null,

  falloff(d, r) {
    const t = clamp(1 - d / r, 0, 1);
    return Math.min(1, t * 1.6) * (0.55 + 0.45 * t);
  },

  buildStatic(L) {
    const m = new Float32Array(L.w * L.h);
    for (const e of L.ents) {
      if (!e.light) continue;
      const ox = e.x, oy = e.kind === 'sconce' ? e.y + 1 : e.y;
      const r = e.light.r;
      if (e.kind === 'sconce') {
        const i = L.i(e.x, e.y);
        m[i] = Math.max(m[i], 0.9);
      }
      computeFOV(L, ox, oy, Math.ceil(r), (x, y, d) => {
        if (!L.inb(x, y)) return;
        const i = L.i(x, y);
        const v = this.falloff(d, r);
        if (v > m[i]) m[i] = v;
      });
    }
    L.staticLight = m;
  },

  // Recompute what the player can see and how bright each tile is.
  update(L, ppos, torchR) {
    const n = L.w * L.h;
    if (!this.vis || this.vis.length !== n) {
      this.vis = new Uint8Array(n);
      this.pdist = new Float32Array(n);
      this.bright = new Float32Array(n);
    }
    this.vis.fill(0);
    this.bright.fill(0);
    this.w = L.w; this.h = L.h;
    if (!L.staticLight) this.buildStatic(L);
    const sl = L.staticLight;
    const R = L.depth === 0 ? 20 : 15;
    computeFOV(L, ppos.x, ppos.y, R, (x, y, d) => {
      if (!L.inb(x, y)) return;
      const i = L.i(x, y);
      this.vis[i] = 1;
      this.pdist[i] = d;
      const pl = this.falloff(d, torchR);
      let b = Math.max(L.ambient * (1 - 0.55 * d / R), sl[i], pl);
      this.bright[i] = b;
      if (b > 0.1) L.explored[i] = 1;
    });
  },

  tileBright(L, x, y) {
    if (!L.inb(x, y) || !this.bright) return 0;
    return this.bright[L.i(x, y)];
  },
  visible(L, x, y, min = 0.12) {
    if (!L.inb(x, y) || !this.vis) return false;
    const i = L.i(x, y);
    return this.vis[i] === 1 && this.bright[i] > min;
  },

  // Dithered darkness overlay over the low-res world buffer.
  render(ctx, L, camX, camY, t, opt) {
    if (!this.dark) {
      this.dark = makeCanvas(VW, VH);
      this.darkImg = this.dark.ctx.createImageData(VW, VH);
    }
    const tx0 = Math.floor(camX / TILE) - 1, ty0 = Math.floor(camY / TILE) - 1;
    const gw = Math.ceil(VW / TILE) + 3, gh = Math.ceil(VH / TILE) + 3;
    const grid = new Float32Array(gw * gh);
    const wob = opt.wobble || 0;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const x = tx0 + i, y = ty0 + j;
      let b = 0;
      if (L.inb(x, y)) {
        const k = L.i(x, y);
        b = this.bright[k];
        if (b > 0) {
          b *= 0.95 + 0.05 * Math.sin(t / 140 + hash2(x, y) * 40);
          if (wob) b *= 1 - wob * (0.5 + 0.5 * Math.sin(t / 400 + hash2(y, x) * 20));
        }
      }
      grid[j * gw + i] = b;
    }
    const d = this.darkImg.data;
    const LEVELS = 6;
    const [dr, dg, db] = opt.tint || [6, 4, 9];
    let p = 0;
    for (let py = 0; py < VH; py++) {
      const wy = camY + py;
      const fy = wy / TILE - 0.5 - ty0;
      const j0 = Math.floor(fy), ty = fy - j0;
      const row0 = j0 * gw, row1 = row0 + gw;
      const by = (wy & 3) * 4;
      for (let pxx = 0; pxx < VW; pxx++) {
        const wx = camX + pxx;
        const fx = wx / TILE - 0.5 - tx0;
        const i0 = Math.floor(fx), tx = fx - i0;
        const a = grid[row0 + i0], b = grid[row0 + i0 + 1], c = grid[row1 + i0], e = grid[row1 + i0 + 1];
        const v = (a + (b - a) * tx) + ((c + (e - c) * tx) - (a + (b - a) * tx)) * ty;
        const q = Math.floor(v * LEVELS + BAYER4[by + (wx & 3)] / 16) / LEVELS;
        const alpha = q >= 1 ? 0 : (1 - q) * 255;
        d[p] = dr; d[p + 1] = dg; d[p + 2] = db; d[p + 3] = alpha;
        p += 4;
      }
    }
    this.dark.ctx.putImageData(this.darkImg, 0, 0);
    ctx.drawImage(this.dark, 0, 0);
  },
};
