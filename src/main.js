'use strict';
// Boot, main loop, scene switching, death and endings.

const G = { p: null, levels: {}, depth: 0, seed: 0, flags: {}, townTrips: 0 };

const Game = {
  canvas: null, ctx: null, lo: null,
  scene: null, world: null, combatScene: null,
  shake: 0, last: 0, vignette: null,

  boot(hot) {
    this.canvas = document.getElementById('screen');
    this.ctx = this.canvas.getContext('2d');
    this.lo = makeCanvas(VW, VH);
    Input.attach();
    Touch.attach();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    const unlock = () => Sound.init();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    this.world = new World();
    if (hot && hot.state) { deserializeGame(hot.state); this.enterLoaded(); }
    else this.scene = new TitleScene();
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      window.claude.hot.snapshot(() => (this.scene === this.world && !this.world.busy ? { state: serializeGame() } : {}));
    }
    requestAnimationFrame(t => { this.last = t; this.loop(t); });
  },

  resize() {
    const pad = document.getElementById('pad');
    const padH = pad && !pad.hidden && window.innerHeight > window.innerWidth ? pad.offsetHeight : 0;
    const dpr = window.devicePixelRatio || 1;
    const aw = Math.max(160, window.innerWidth) * dpr, ah = Math.max(120, window.innerHeight - padH) * dpr;
    let s = Math.min(aw / VW, ah / VH);
    if (s >= 2) s = Math.floor(s);
    const cw = Math.round(VW * s), ch = Math.round(VH * s);
    this.canvas.width = cw; this.canvas.height = ch;
    this.canvas.style.width = cw / dpr + 'px';
    this.canvas.style.height = ch / dpr + 'px';
    this.ctx.imageSmoothingEnabled = false;
    document.getElementById('app').style.paddingBottom = padH ? padH + 'px' : '';
  },

  loop(t) {
    const dt = Math.min(50, t - this.last);
    this.last = t;
    try {
      Input.update(dt);
      Clock.tick(dt);
      UI.update(dt);
      if (this.scene) this.scene.update(dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt / 300);
      this.render();
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(tt => this.loop(tt));
  },

  render() {
    const ctx = this.ctx, cv = this.canvas;
    const k = cv.width / UW;
    if (this.scene) this.scene.draw(this.lo, ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cv.width, cv.height);
    let ox = 0, oy = 0;
    if (this.shake > 0) { const m = cv.width / VW; ox = Math.round(R.range(-2, 2) * this.shake) * m; oy = Math.round(R.range(-2, 2) * this.shake) * m; }
    ctx.drawImage(this.lo, ox, oy, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    this.drawVignette(ctx);
    if (this.scene === this.world) this.world.drawHUD(ctx);
    else if (this.scene && this.scene.drawUI) this.scene.drawUI(ctx);
    UI.draw(ctx);
  },

  drawVignette(ctx) {
    if (!this.vignette) {
      const c = makeCanvas(UW / 4, UH / 4);
      const g = c.ctx.createRadialGradient(UW / 8, UH / 8, UW / 14, UW / 8, UH / 8, UW / 6.2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
      c.ctx.fillStyle = g; c.ctx.fillRect(0, 0, UW / 4, UH / 4);
      this.vignette = c;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.vignette, 0, 0, UW, UH);
    const p = G.p;
    if (p && (this.scene === this.world || this.scene === this.combatScene) && p.mind < 35) {
      const a = (35 - p.mind) / 35 * (0.25 + Math.sin(Clock.t / 500) * 0.1);
      ctx.fillStyle = `rgba(60,0,40,${a})`;
      ctx.fillRect(0, 0, UW, UH);
    }
    if (p && this.scene === this.world && p.hp / p.maxHp < 0.3) {
      const beat = Math.max(0, Math.sin(Clock.t / 160)) ** 8;
      ctx.fillStyle = `rgba(120,0,0,${0.12 + beat * 0.15})`;
      ctx.fillRect(0, 0, UW, UH);
      if (beat > 0.95 && !this.beatPlayed) { Sound.play('heart'); this.beatPlayed = true; }
      if (beat < 0.5) this.beatPlayed = false;
    }
  },

  // ---------------------------------------------------------------- flow
  toTitle() {
    UI.stack = [];
    this.scene = new TitleScene();
    Sound.setTheme('title');
  },

  newGame() {
    UI.stack = [];
    G.p = newPlayer();
    G.levels = {};
    G.depth = 0;
    G.seed = (Math.random() * 4294967296) >>> 0;
    G.flags = {};
    G.townTrips = 0;
    R = new RNG(G.seed ^ 0x5bd1e995);
    this.scene = new IntroScene(LORE.intro, () => this.startWorld());
    Sound.setTheme('silent');
  },

  async startWorld() {
    const town = buildTown();
    G.levels[0] = town;
    await UI.fadeTo(1, 10);
    this.scene = this.world;
    this.world.enter(town, town.start.x, town.start.y);
    G.p.dir = 'right';
    await UI.fadeTo(0, 1200);
    UI.showBanner('The Ruins of Tristram', 'What is left of it');
    this.world.run(async () => {
      await UI.say('Smoke still rises from the ruins. The cathedral looms to the north, doors torn open.');
      await UI.say('{d}Arrow keys or WASD to move. Z to act. X for your pack. Tab for the map.{/}');
    });
  },

  loadGame() {
    const data = Save.read();
    if (!data) return;
    UI.stack = [];
    deserializeGame(data);
    this.enterLoaded();
    UI.toast('{d}You remember...{/}');
  },
  enterLoaded() {
    const L = G.levels[G.depth];
    this.scene = this.world;
    this.world.busy = false;
    this.world.enter(L, G.p.x, G.p.y);
    UI.fade = 1; UI.fadeTo(0, 900);
  },

  save() { return Save.write(); },

  async combat(ent, ambush) {
    const W = this.world;
    W.move = null;
    Sound.play('growl');
    this.shake = 0.8;
    await UI.fadeTo(1, 220);
    const cs = new Combat(ent, ambush);
    this.combatScene = cs;
    this.scene = cs;
    await UI.fadeTo(0, 220);
    const res = await cs.run();
    if (res.outcome === 'dead') return res;
    await UI.fadeTo(1, 260);
    this.combatScene = null;
    this.scene = W;
    Sound.setTheme(W.L.theme);
    await UI.fadeTo(0, 260);
    return res;
  },

  checkDeath() {
    if (G.p && isDead(G.p) && !(this.scene instanceof EndScene)) this.gameOver();
  },

  gameOver() {
    const p = G.p;
    UI.stack = [];
    UI.fade = 0; UI.fadeTarget = 0;
    this.combatScene = null;
    Sound.play('death');
    Sound.setTheme('silent');
    const L = G.levels[G.depth];
    const where = G.depth === 0 ? 'in the ruins of Tristram' : `on the ${ordinal(G.depth)} level of the ${THEMES[L.theme].title.toLowerCase()}`;
    let cause;
    if (p.mind <= 0) cause = LORE.epitaph.madness;
    else if (p.cause && p.cause.startsWith('killed by ')) {
      const n = p.cause.slice(10);
      cause = `You were killed by ${/^(The |Diablo|Gharbad)/.test(n) ? n.replace(/^The /, 'the ') : (/^[AEIOU]/.test(n) ? 'an ' : 'a ') + n}`;
    } else cause = LORE.epitaph[p.cause] || 'You died';
    const lines = [`${cause} ${where}.`];
    if (p.gold > 0) lines.push(`{g}${p.gold} gold{/} spills from your purse. Someone else will pick it up.`);
    const hoard = Town.hoardValue();
    if (hoard > 0) lines.push(`Your hoard under the well, worth {g}${hoard} gold{/}, will never be found.`);
    this.scene = new EndScene('death', 'You Died', lines, this.stats());
  },

  stats() {
    const p = G.p;
    return [
      ['Deepest level', String(p.deepest)],
      ['Days survived', String(p.days)],
      ['Steps taken', String(p.steps)],
      ['Things killed', String(p.kills)],
      ['Gold found', String(p.goldFound)],
    ];
  },

  async leaveEnding() {
    const p = G.p;
    await UI.fadeTo(1, 1500);
    UI.stack = [];
    const total = p.gold + Town.hoardValue();
    let verdict;
    if (total < 200) verdict = 'You leave with almost nothing. The dark kept everything you came for.';
    else if (total < 1000) verdict = 'It is a small fortune, for a man like you. It never feels like enough.';
    else if (total < 3000) verdict = 'You are rich. You buy a house in Westmarch. You never sleep with the lights out again.';
    else verdict = 'You are richer than kings. Every night you dream of the gold that is still down there, waiting for you.';
    Sound.setTheme('title');
    this.scene = new EndScene('leave', 'You Left Tristram', [`You walk out of Tristram with {g}${total} gold{/}.`, verdict], this.stats());
    UI.fadeTo(0, 1500);
  },

  async soulstoneEnding() {
    const p = G.p;
    await UI.say('Among the ashes of the Lord of Terror lies a gem. It is red, and it pulses gently, like a heart.');
    await UI.say('It is the most beautiful thing you have ever seen. It would be worth more than everything else in this place put together.');
    const c = await UI.choose('Take the soulstone?', ['Take it', 'Leave it where it lies'], { cancel: 1 });
    if (c === 1) {
      await UI.say('You step back from it. It takes everything you have. {d}Somewhere far above, the way home is very long.{/}');
      return;
    }
    await UI.fadeTo(1, 2500);
    UI.stack = [];
    Sound.setTheme('silent');
    Sound.play('curse');
    this.scene = new EndScene('stone', 'It Was Never Yours', [
      'You close your hand around the stone. It is warm.',
      'You walk back up through the caves, the catacombs, the cathedral. Nothing touches you. Nothing dares.',
      'In Tristram you stand by the well for a long time. Then you start walking east, towards the desert.',
      'You do not remember deciding to go there. {r}You are not the one deciding anymore.{/}',
    ], this.stats());
    UI.fadeTo(0, 2000);
  },
};

// ---------------------------------------------------------------- touch controls
const Touch = {
  attach() {
    const pad = document.getElementById('pad');
    if (!pad) return;
    const show = () => {
      if (!pad.hidden) return;
      pad.hidden = false;
      Game.resize();
    };
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) show();
    window.addEventListener('touchstart', show, { passive: true });
    const active = new Map(); // pointerId -> action
    const actionAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el && el.dataset && el.dataset.k ? el.dataset.k : null;
    };
    const set = (id, a) => {
      const prev = active.get(id);
      if (prev === a) return;
      if (prev) Input.release(prev, 'p' + id);
      if (a) Input.press(a, 'p' + id);
      active.set(id, a);
    };
    pad.addEventListener('pointerdown', e => {
      e.preventDefault();
      Sound.init();
      pad.setPointerCapture && pad.setPointerCapture(e.pointerId);
      set(e.pointerId, actionAt(e.clientX, e.clientY));
    });
    pad.addEventListener('pointermove', e => {
      if (!active.has(e.pointerId)) return;
      const a = actionAt(e.clientX, e.clientY);
      const prev = active.get(e.pointerId);
      // only slide between direction buttons
      if (a && prev && DIR_LIST.includes(a) && DIR_LIST.includes(prev)) set(e.pointerId, a);
    });
    const end = e => { set(e.pointerId, null); active.delete(e.pointerId); };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  },
};

function start(data) {
  const go = () => Game.boot(data);
  if (document.fonts && document.fonts.load) {
    Promise.race([
      Promise.all([document.fonts.load('26px "IM Fell English"'), document.fonts.load('26px "Pirata One"')]),
      new Promise(r => setTimeout(r, 2500)),
    ]).then(go, go);
  } else go();
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start);
else start((hot && hot.data) || {});
