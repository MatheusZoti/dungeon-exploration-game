'use strict';
// Modal UI widgets. Each returns a Promise and takes input while on top of the stack.

const UI = {
  stack: [],
  toasts: [],
  fade: 0, fadeTarget: 0, fadeRes: null, fadeSpeed: 0.004,
  banner: null,

  top() { return this.stack[this.stack.length - 1]; },
  push(m) { this.stack.push(m); return m; },
  pop(m) { const i = this.stack.indexOf(m); if (i >= 0) this.stack.splice(i, 1); },
  busy() { return this.stack.length > 0; },

  update(dt) {
    const m = this.top();
    if (m) m.update(dt);
    for (const s of this.stack) if (s !== m && s.passive) s.update(dt);
    for (const t of this.toasts) t.age += dt;
    this.toasts = this.toasts.filter(t => t.age < t.life);
    if (this.fade !== this.fadeTarget) {
      const d = this.fadeSpeed * dt;
      this.fade = this.fade < this.fadeTarget ? Math.min(this.fadeTarget, this.fade + d) : Math.max(this.fadeTarget, this.fade - d);
      if (this.fade === this.fadeTarget && this.fadeRes) { const r = this.fadeRes; this.fadeRes = null; r(); }
    }
    if (this.banner) { this.banner.age += dt; if (this.banner.age > this.banner.life) this.banner = null; }
  },

  draw(ctx) {
    for (const m of this.stack) m.draw(ctx);
    this.drawToasts(ctx);
    if (this.banner) this.drawBanner(ctx);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
      ctx.fillRect(0, 0, UW, UH);
    }
  },

  // ---- fades and banners
  fadeTo(v, ms = 350) {
    this.fadeTarget = v;
    this.fadeSpeed = 1 / ms;
    if (this.fade === v) return Promise.resolve();
    return new Promise(res => { this.fadeRes = res; });
  },
  showBanner(title, sub) { this.banner = { title, sub, age: 0, life: 3600 }; },
  drawBanner(ctx) {
    const b = this.banner;
    const a = b.age < 600 ? b.age / 600 : b.age > b.life - 900 ? (b.life - b.age) / 900 : 1;
    ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
    ctx.fillRect(0, 248, UW, 120);
    drawText(ctx, b.title, UW / 2, 312, { size: 48, family: FONT_T, align: 'center', color: '#d8c8a8', alpha: a });
    if (b.sub) drawText(ctx, b.sub, UW / 2, 350, { size: 22, align: 'center', color: TCOL.d, alpha: a, style: 'italic' });
  },

  // ---- toasts (non-blocking notices)
  toast(text, color) {
    this.toasts.push({ text, color: color || TCOL.w, age: 0, life: 3200 });
    if (this.toasts.length > 5) this.toasts.shift();
  },
  drawToasts(ctx) {
    let y = 172;
    for (const t of this.toasts) {
      const a = t.age < 200 ? t.age / 200 : t.age > t.life - 600 ? (t.life - t.age) / 600 : 1;
      setFont(ctx, 22);
      const w = ctx.measureText(stripTags(t.text)).width + 32;
      ctx.fillStyle = `rgba(8,5,7,${0.78 * a})`;
      ctx.fillRect(16, y - 24, w, 34);
      const lay = layoutRich(ctx, t.text, 900, 22, FONT, t.color);
      drawRich(ctx, lay, 32, y, 26, Infinity, a);
      y += 40;
    }
  },

  // ---- message box
  say(text, opt = {}) {
    return new Promise(res => this.push(new MessageBox(text, opt, res)));
  },
  async sayAll(lines, opt) { for (const l of lines) await this.say(l, opt); },

  choose(prompt, options, opt = {}) {
    return new Promise(res => this.push(new ChoiceBox(prompt, options, opt, res)));
  },
  async confirm(prompt, yes = 'Yes', no = 'No') {
    return (await this.choose(prompt, [yes, no], { cancel: 1 })) === 0;
  },
  coinFlip(title, heads, tails) {
    return new Promise(res => this.push(new CoinFlip(title, heads, tails, res)));
  },
  number(prompt, max, step) {
    return new Promise(res => this.push(new NumberBox(prompt, max, step, res)));
  },
};

class MessageBox {
  constructor(text, opt, res) {
    this.opt = opt; this.res = res;
    this.speaker = opt.speaker;
    this.text = text;
    this.lay = null;
    this.shown = 0;
    this.age = 0;
    this.speed = opt.speed || 0.06; // chars per ms
  }
  update(dt) {
    this.age += dt;
    if (!this.lay) return;
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.lay.count, this.shown + dt * this.speed * (Input.isHeld('fast') ? 4 : 1));
    if (Math.floor(this.shown) !== before && before % 3 === 0 && this.shown < this.lay.count) Sound.play('text');
    if (Input.pressed('ok') || Input.pressed('cancel')) {
      if (this.shown < this.lay.count) { this.shown = this.lay.count; return; }
      UI.pop(this);
      Sound.play('menu');
      this.res();
    }
  }
  draw(ctx) {
    const x = 24, w = UW - 48, h = 196, y = UH - h - 20;
    if (!this.lay) this.lay = layoutRich(ctx, this.text, w - 72, 27);
    drawWindow(ctx, x, y, w, h, 0.92);
    let ty = y + 50;
    if (this.speaker) {
      drawText(ctx, this.speaker, x + 34, y + 44, { size: 26, color: TCOL.g, family: FONT_T });
      ty += 32;
    }
    drawRich(ctx, this.lay, x + 36, ty, 33, Math.floor(this.shown));
    if (this.shown >= this.lay.count) {
      const bob = Math.sin(this.age / 160) * 3;
      ctx.fillStyle = TCOL.d;
      ctx.beginPath();
      ctx.moveTo(x + w - 46, y + h - 34 + bob); ctx.lineTo(x + w - 30, y + h - 34 + bob); ctx.lineTo(x + w - 38, y + h - 24 + bob);
      ctx.fill();
    }
  }
}

class ChoiceBox {
  constructor(prompt, options, opt, res) {
    this.prompt = prompt; this.options = options; this.opt = opt; this.res = res;
    this.sel = opt.start || 0; this.age = 0; this.lay = null;
    this.disabled = opt.disabled || [];
  }
  update(dt) {
    this.age += dt;
    const n = this.options.length;
    if (Input.nav('up')) { this.sel = (this.sel + n - 1) % n; Sound.play('menu'); }
    if (Input.nav('down')) { this.sel = (this.sel + 1) % n; Sound.play('menu'); }
    if (Input.pressed('ok')) {
      if (this.disabled[this.sel]) { Sound.play('cancel'); return; }
      Sound.play('ok'); UI.pop(this); this.res(this.sel);
    } else if (Input.pressed('cancel') && this.opt.cancel != null) {
      Sound.play('cancel'); UI.pop(this); this.res(this.opt.cancel);
    }
  }
  draw(ctx) {
    const lineH = 40;
    if (this.prompt) {
      const x = 24, w = UW - 48, h = 196, y = UH - h - 20;
      if (!this.lay) this.lay = layoutRich(ctx, this.prompt, w - 72, 27);
      drawWindow(ctx, x, y, w, h, 0.92);
      let ty = y + 50;
      if (this.opt.speaker) { drawText(ctx, this.opt.speaker, x + 34, y + 44, { size: 26, color: TCOL.g, family: FONT_T }); ty += 32; }
      drawRich(ctx, this.lay, x + 36, ty, 33);
    }
    setFont(ctx, 26);
    let maxW = 200;
    for (const o of this.options) maxW = Math.max(maxW, ctx.measureText(stripTags(o)).width);
    const w = Math.min(UW - 60, maxW + 80);
    const h = this.options.length * lineH + 36;
    const x = this.opt.x != null ? this.opt.x : UW - w - 30;
    const y = this.opt.y != null ? this.opt.y : (this.prompt ? UH - 196 - 20 - h - 8 : (UH - h) / 2);
    drawWindow(ctx, x, y, w, h, 0.94);
    this.options.forEach((o, i) => {
      const oy = y + 18 + i * lineH;
      if (i === this.sel) drawCursor(ctx, x + 14, oy, w - 28, lineH - 4, this.age);
      const lay = layoutRich(ctx, o, w - 60, 26, FONT, this.disabled[i] ? TCOL.d : TCOL.w);
      drawRich(ctx, lay, x + 30, oy + 28, 30);
    });
  }
}

class NumberBox {
  constructor(prompt, max, step, res) {
    this.prompt = prompt; this.max = max; this.step = step || 10; this.res = res;
    this.v = max; this.age = 0;
  }
  update(dt) {
    this.age += dt;
    if (Input.nav('up') || Input.nav('right')) { this.v = Math.min(this.max, this.v + this.step); Sound.play('menu'); }
    if (Input.nav('down') || Input.nav('left')) { this.v = Math.max(0, this.v - this.step); Sound.play('menu'); }
    if (Input.pressed('ok')) { Sound.play('ok'); UI.pop(this); this.res(this.v); }
    else if (Input.pressed('cancel')) { Sound.play('cancel'); UI.pop(this); this.res(0); }
  }
  draw(ctx) {
    const w = 520, h = 170, x = (UW - w) / 2, y = (UH - h) / 2;
    drawWindow(ctx, x, y, w, h, 0.95);
    drawText(ctx, this.prompt, x + w / 2, y + 52, { size: 26, align: 'center' });
    drawText(ctx, '◀  ' + this.v + ' gold  ▶', x + w / 2, y + 106, { size: 34, align: 'center', color: TCOL.g });
    drawText(ctx, 'Arrows to change, confirm to accept', x + w / 2, y + 144, { size: 18, align: 'center', color: TCOL.d });
  }
}

// The Fear & Hunger coin: heads you live, tails you pay.
class CoinFlip {
  constructor(title, heads, tails, res) {
    this.title = title; this.heads = heads; this.tails = tails; this.res = res;
    this.age = 0; this.phase = 'ready';
    this.result = R.chance(0.5);
    this.spin = 0;
  }
  update(dt) {
    this.age += dt;
    if (this.phase === 'ready') {
      if (Input.pressed('ok') || this.age > 1400) { this.phase = 'spin'; this.age = 0; Sound.play('flip'); }
    } else if (this.phase === 'spin') {
      this.spin += dt * (0.03 * Math.max(0.15, 1 - this.age / 1500));
      if (this.age > 1500) { this.phase = 'land'; this.age = 0; Sound.play('land'); }
    } else if (this.phase === 'land') {
      if ((Input.pressed('ok') || Input.pressed('cancel')) && this.age > 500) { UI.pop(this); this.res(this.result); }
      if (this.age > 2600) { UI.pop(this); this.res(this.result); }
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, UW, UH);
    drawText(ctx, this.title, UW / 2, 130, { size: 34, align: 'center', family: FONT_T, color: '#d8c8a8' });
    drawText(ctx, 'Heads: ' + stripTags(this.heads), UW / 2 - 200, 600, { size: 22, align: 'center', color: TCOL.v });
    drawText(ctx, 'Tails: ' + stripTags(this.tails), UW / 2 + 200, 600, { size: 22, align: 'center', color: TCOL.r });
    const cx = UW / 2;
    let cy = 340;
    let face;
    let sx;
    if (this.phase === 'ready') { sx = 1; face = null; cy += Math.sin(this.age / 200) * 4; }
    else if (this.phase === 'spin') {
      sx = Math.cos(this.spin * 6);
      face = sx >= 0;
      cy -= Math.sin(Math.min(1, this.age / 1500) * Math.PI) * 120;
    } else { sx = 1; face = this.result; }
    const r = 86;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.06, Math.abs(sx)), 1);
    ctx.fillStyle = '#6a4a14';
    ctx.beginPath(); ctx.arc(0, 6, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c99a3a';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, r - 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7a5418';
    if (face === true || face === null) {
      // a skull-crowned king (heads)
      ctx.beginPath(); ctx.arc(0, 4, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c99a3a';
      ctx.fillRect(-14, -2, 9, 10); ctx.fillRect(5, -2, 9, 10);
      ctx.fillStyle = '#7a5418';
      ctx.beginPath(); ctx.moveTo(-26, -24); ctx.lineTo(-18, -44); ctx.lineTo(-8, -30); ctx.lineTo(0, -48); ctx.lineTo(8, -30); ctx.lineTo(18, -44); ctx.lineTo(26, -24); ctx.fill();
    } else {
      // the eye of the abyss (tails)
      ctx.beginPath(); ctx.ellipse(0, 0, 44, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c99a3a';
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2408';
      ctx.fillRect(-3, -12, 6, 24);
    }
    ctx.restore();
    if (this.phase === 'land') {
      const a = Math.min(1, this.age / 300);
      drawText(ctx, this.result ? 'HEADS' : 'TAILS', UW / 2, 500, { size: 54, align: 'center', family: FONT_T, color: this.result ? TCOL.v : TCOL.r, alpha: a });
    } else if (this.phase === 'ready') {
      drawText(ctx, 'Flip the coin', UW / 2, 500, { size: 24, align: 'center', color: TCOL.d });
    }
  }
}
