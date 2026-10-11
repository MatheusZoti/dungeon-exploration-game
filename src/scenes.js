'use strict';
// Title, intro and ending screens.

class TitleScene {
  constructor() {
    this.age = 0;
    this.sel = 0;
    this.embers = [];
    this.hasSave = Save.exists();
    this.sky = null;
  }
  options() {
    return [
      { label: 'Descend', act: 'new' },
      { label: 'Remember', act: 'load', disabled: !this.hasSave },
      { label: Sound.muted ? 'Sound: off' : 'Sound: on', act: 'sound' },
    ];
  }
  update(dt) {
    this.age += dt;
    for (const e of this.embers) { e.age += dt; e.x += e.vx * dt; e.y += e.vy * dt; }
    this.embers = this.embers.filter(e => e.age < e.life);
    if (this.embers.length < 60 && R.chance(dt * 0.05)) {
      this.embers.push({ x: R.range(40, 280), y: R.range(150, 200), vx: R.range(-0.004, 0.01), vy: R.range(-0.03, -0.012), age: 0, life: R.int(2000, 5000), col: R.pick(['#ff9a40', '#e86a20', '#ffd080']) });
    }
    if (UI.busy()) return;
    const opts = this.options();
    if (Input.nav('up')) { do { this.sel = (this.sel + opts.length - 1) % opts.length; } while (opts[this.sel].disabled); Sound.play('menu'); }
    if (Input.nav('down')) { do { this.sel = (this.sel + 1) % opts.length; } while (opts[this.sel].disabled); Sound.play('menu'); }
    if (Input.pressed('ok')) {
      Sound.init();
      Sound.setTheme('title');
      const o = opts[this.sel];
      if (o.disabled) return;
      Sound.play('ok');
      if (o.act === 'new') Game.newGame();
      else if (o.act === 'load') Game.loadGame();
      else if (o.act === 'sound') Sound.setMuted(!Sound.muted);
    }
  }
  buildSky() {
    const c = makeCanvas(VW, VH), x = c.ctx;
    const g = x.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#06040a'); g.addColorStop(0.45, '#1a0808'); g.addColorStop(0.68, '#5a1608'); g.addColorStop(0.75, '#2a0a06'); g.addColorStop(1, '#050304');
    x.fillStyle = g; x.fillRect(0, 0, VW, VH);
    const rng = new RNG(4);
    for (let i = 0; i < 70; i++) px(x, rng.int(0, VW), rng.int(0, 90), rgba('#d8d0c0', rng.range(0.15, 0.6)));
    // moon behind smoke
    P.circle(x, 248, 40, '#3a2a28');
    P.circle(x, 248, 38, '#5a4038');
    const sil = '#040203';
    // ground
    P.rect(x, 0, 176, VW, 64, sil);
    // town silhouette
    for (let i = 0; i < 9; i++) {
      const bx = rng.int(0, 300), bw = rng.int(18, 34), bh = rng.int(10, 22);
      P.rect(x, bx, 176 - bh, bw, bh, sil);
      P.poly(x, [[bx - 2, 176 - bh], [bx + bw / 2, 176 - bh - rng.int(6, 12)], [bx + bw + 2, 176 - bh]], sil);
    }
    // cathedral
    P.rect(x, 110, 96, 100, 80, sil);
    P.poly(x, [[104, 96], [160, 64], [216, 96]], sil);
    P.rect(x, 120, 50, 18, 60, sil); P.poly(x, [[118, 50], [129, 14], [140, 50]], sil);
    P.rect(x, 182, 58, 18, 52, sil); P.poly(x, [[180, 58], [191, 26], [202, 58]], sil);
    P.circle(x, 160, 106, 9, '#4a0c06');
    P.circle(x, 160, 106, 6, '#7a1608');
    P.rect(x, 152, 144, 16, 32, '#1a0604');
    // dead trees
    for (const tx of [22, 60, 268, 300]) {
      P.line(x, tx, 176, tx + 2, 140, 2, sil);
      P.line(x, tx + 1, 156, tx - 8, 146, 1, sil); P.line(x, tx + 2, 150, tx + 10, 140, 1, sil);
    }
    return c;
  }
  draw(lo) {
    const c = lo.ctx;
    if (!this.sky) this.sky = this.buildSky();
    c.drawImage(this.sky, 0, 0);
    const glow = 0.25 + Math.sin(this.age / 300) * 0.06 + Math.sin(this.age / 97) * 0.03;
    const g = c.createRadialGradient(160, 180, 10, 160, 180, 170);
    g.addColorStop(0, `rgba(255,90,20,${glow})`); g.addColorStop(1, 'rgba(255,60,10,0)');
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    for (const e of this.embers) px(c, e.x, e.y, rgba(e.col, 1 - e.age / e.life));
  }
  drawUI(ctx) {
    const a = Math.min(1, this.age / 1500);
    drawText(ctx, 'Beneath Tristram', UW / 2, 128, { size: 92, align: 'center', family: FONT_T, color: '#d8b98a', alpha: a });
    drawText(ctx, 'a greedy man\'s descent', UW / 2, 172, { size: 26, align: 'center', color: '#a08870', alpha: a, style: 'italic' });
    const opts = this.options();
    const y0 = 560;
    opts.forEach((o, i) => {
      const y = y0 + i * 44;
      if (i === this.sel) drawCursor(ctx, UW / 2 - 140, y - 30, 280, 40, this.age);
      drawText(ctx, o.label, UW / 2, y, { size: 28, align: 'center', color: o.disabled ? '#5a5048' : TCOL.w });
    });
    drawText(ctx, 'Arrows to move  ·  Z to act  ·  X for the menu', UW / 2, UH - 18, { size: 18, align: 'center', color: '#6a6056' });
  }
}

class IntroScene {
  constructor(lines, after) {
    this.lines = lines; this.after = after;
    this.i = 0; this.age = 0; this.done = false;
  }
  update(dt) {
    this.age += dt;
    if (this.done || UI.busy()) return;
    if (Input.pressed('ok') || this.age > 5200 + this.lines[this.i].length * 25) {
      if (this.age < 400) return;
      this.i++; this.age = 0;
      Sound.play('menu');
      if (this.i >= this.lines.length) { this.done = true; this.after(); }
    }
    if (Input.pressed('cancel')) { this.done = true; this.after(); }
  }
  draw(lo) { lo.ctx.fillStyle = '#000'; lo.ctx.fillRect(0, 0, VW, VH); }
  drawUI(ctx) {
    if (this.done) return;
    const line = this.lines[Math.min(this.i, this.lines.length - 1)];
    const a = Math.min(1, this.age / 900);
    const lay = layoutRich(ctx, line, 700, 32, FONT, '#d8cbb4');
    const h = lay.lines.length * 46;
    ctx.save();
    lay.lines.forEach((ln, j) => {
      const w = ln.length ? ln[ln.length - 1].x + ln[ln.length - 1].w : 0;
      drawRich(ctx, { lines: [ln], size: 32, family: FONT }, (UW - w) / 2, UH / 2 - h / 2 + j * 46 + 30, 46, Infinity, a);
    });
    ctx.restore();
    drawText(ctx, 'Press Z to continue  ·  X to skip', UW / 2, UH - 30, { size: 18, align: 'center', color: '#4a4440' });
  }
}

class EndScene {
  constructor(kind, title, lines, stats) {
    this.kind = kind; this.title = title; this.lines = lines; this.stats = stats;
    this.age = 0; this.sel = 0;
    this.hasSave = Save.exists();
  }
  options() {
    const o = [];
    if (this.kind === 'death' && this.hasSave) o.push({ label: 'Return to your last memory', act: 'load' });
    o.push({ label: 'Begin again', act: 'new' });
    o.push({ label: 'Title', act: 'title' });
    return o;
  }
  update(dt) {
    this.age += dt;
    if (UI.busy() || this.age < 1800) return;
    const opts = this.options();
    if (Input.nav('up')) { this.sel = (this.sel + opts.length - 1) % opts.length; Sound.play('menu'); }
    if (Input.nav('down')) { this.sel = (this.sel + 1) % opts.length; Sound.play('menu'); }
    if (Input.pressed('ok')) {
      Sound.play('ok');
      const a = opts[this.sel].act;
      if (a === 'load') Game.loadGame();
      else if (a === 'new') Game.newGame();
      else Game.toTitle();
    }
  }
  draw(lo) {
    const c = lo.ctx;
    c.fillStyle = this.kind === 'death' ? '#0a0203' : '#050404';
    c.fillRect(0, 0, VW, VH);
    if (this.kind === 'death') {
      const g = c.createRadialGradient(160, 120, 20, 160, 120, 200);
      g.addColorStop(0, `rgba(90,0,0,${0.25 + Math.sin(this.age / 700) * 0.08})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    }
  }
  drawUI(ctx) {
    const a = Math.min(1, this.age / 1500);
    drawText(ctx, this.title, UW / 2, 140, { size: 80, align: 'center', family: FONT_T, color: this.kind === 'death' ? '#b02a1a' : '#c8b48a', alpha: a });
    let y = 220;
    for (const l of this.lines) {
      const lay = layoutRich(ctx, l, 760, 26, FONT, '#cfc2aa');
      lay.lines.forEach(ln => {
        const w = ln.length ? ln[ln.length - 1].x + ln[ln.length - 1].w : 0;
        drawRich(ctx, { lines: [ln], size: 26, family: FONT }, (UW - w) / 2, y, 34, Infinity, a);
        y += 34;
      });
      y += 10;
    }
    y += 10;
    const opts = this.options();
    const y0 = UH - 40 - opts.length * 44;
    if (y + this.stats.length * 28 < y0 - 30) {
      for (const [k, v] of this.stats) {
        drawText(ctx, k, UW / 2 - 16, y, { size: 21, align: 'right', color: TCOL.d, alpha: a });
        drawText(ctx, v, UW / 2 + 16, y, { size: 21, color: '#d8c8a8', alpha: a });
        y += 28;
      }
    } else {
      drawText(ctx, this.stats.map(([k, v]) => `${k}: ${v}`).join('   ·   '), UW / 2, y + 8, { size: 18, align: 'center', color: TCOL.d, alpha: a });
    }
    if (this.age < 1800) return;
    opts.forEach((o, i) => {
      const yy = y0 + i * 44;
      if (i === this.sel) drawCursor(ctx, UW / 2 - 200, yy - 30, 400, 40, this.age);
      drawText(ctx, o.label, UW / 2, yy, { size: 26, align: 'center' });
    });
  }
}
