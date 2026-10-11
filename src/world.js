'use strict';
// Exploration: movement, monsters on the map, interactions, level changes and rendering.

const PORTAL_TOWN = { x: 24, y: 24 };

class World {
  constructor() {
    this.L = null;
    this.busy = false;
    this.move = null;
    this.rx = 0; this.ry = 0;
    this.walkFrame = 0; this.walkT = 0;
    this.dirOrder = [];
    this.showMap = false;
    this.darkSteps = 0;
    this.particles = [];
    this.flash = 0;
    this.shake = 0;
    this.whisperT = 0;
    this.eyes = [];
    this.torchR = 1.7;
  }
  get p() { return G.p; }

  // ---------------------------------------------------------------- level entry
  enter(L, x, y) {
    this.L = L;
    const p = this.p;
    p.x = x; p.y = y;
    this.rx = x * TILE; this.ry = y * TILE;
    this.move = null;
    L.staticLight = null;
    Light.buildStatic(L);
    for (const e of L.ents) if (e.kind === 'monster') { e.timer = 600 + R.int(0, 900); e.state = e.dormant ? 'dormant' : 'idle'; }
    this.particles = [];
    this.updateLight();
    Sound.setTheme(L.theme);
  }

  updateLight() {
    const p = this.p;
    const lit = p.lit && this.L.depth > 0;
    const base = lit ? 5.4 : (this.L.depth === 0 ? 2.5 : 1.7);
    const fl = lit ? Math.sin(Clock.t / 90) * 0.18 + Math.sin(Clock.t / 37) * 0.08 : 0;
    this.torchR = base + fl;
    Light.update(this.L, p, this.torchR);
  }

  run(fn) {
    if (this.busy) return;
    this.busy = true;
    Promise.resolve().then(fn).catch(err => console.error(err)).finally(() => {
      this.busy = false;
      Game.checkDeath();
    });
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const p = this.p, L = this.L;
    this.updateLight();
    this.updateParticles(dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 400);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt / 300);

    if (this.move) {
      const m = this.move;
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      this.rx = lerp(m.fx, m.tx, k) * TILE;
      this.ry = lerp(m.fy, m.ty, k) * TILE;
      this.walkT += dt;
      if (this.walkT > m.dur / 2) { this.walkT = 0; this.walkFrame = (this.walkFrame + 1) % 4; }
      if (k >= 1) { this.move = null; this.onStep(); }
    } else {
      this.rx = p.x * TILE; this.ry = p.y * TILE;
    }

    const pressedDirs = DIR_LIST.filter(d => Input.now.has(d));
    for (const d of pressedDirs) { this.dirOrder = this.dirOrder.filter(x => x !== d); this.dirOrder.push(d); }
    if (this.move && pressedDirs.length) this.queuedDir = pressedDirs[pressedDirs.length - 1];

    if (!this.busy && !UI.busy()) {
      this.updateMonsters(dt);
      this.updateCrows();
      this.updateAmbience(dt);
      if (Input.pressed('map')) { this.showMap = !this.showMap; Sound.play('menu'); }
      if (Input.pressed('mute')) { Sound.setMuted(!Sound.muted); UI.toast(Sound.muted ? 'Sound off' : 'Sound on', TCOL.d); }
      if (!this.move) {
        const held = this.dirOrder.filter(d => Input.isHeld(d));
        for (const d of DIR_LIST) if (Input.isHeld(d) && !held.includes(d)) held.unshift(d);
        this.dirOrder = held;
        const dir = held[held.length - 1] || pressedDirs[pressedDirs.length - 1] || this.queuedDir;
        this.queuedDir = null;
        for (const d of DIR_LIST) Input.now.delete(d);
        if (Input.pressed('cancel')) { this.run(() => Menu.open()); return; }
        if (Input.pressed('ok')) { this.run(() => this.interactFacing()); return; }
        if (dir) this.tryMove(dir);
        else this.walkFrame = 0;
      }
    }
    for (const d of DIR_LIST) Input.now.delete(d);
  }

  tryMove(dir) {
    const p = this.p, L = this.L;
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = p.x + dx, ny = p.y + dy;
    const t = L.get(nx, ny);
    const mon = L.ents.find(e => e.kind === 'monster' && e.x === nx && e.y === ny);
    if (mon) { this.run(() => this.fight(mon, false)); return; }
    if (t === T.DOOR) { this.openDoor(nx, ny); return; }
    if (t === T.CRYPT && !G.flags.crypt) { this.run(() => UI.say('Iron bars seal the crypt. The lock is rusted shut from the inside. There must be another way in, from below.')); return; }
    if (t === T.FISSURE && !G.flags.fissure) { this.run(() => UI.say('A crack in the earth, breathing warm air. It is far too narrow to climb down from here.')); return; }
    const blocker = L.blockerAt(nx, ny);
    if (blocker) {
      if (blocker.kind === 'gharbad') this.run(() => this.interact(blocker));
      return;
    }
    if (!TINFO[t].walk) return;
    p.x = nx; p.y = ny;
    this.move = { fx: nx - dx, fy: ny - dy, tx: nx, ty: ny, t: 0, dur: moveDelay(p) };
  }

  openDoor(x, y) {
    this.L.set(x, y, T.DOOR_OPEN);
    Sound.play('door');
    Light.buildStatic(this.L);
    for (const e of this.L.ents) {
      if (e.kind === 'monster' && e.dormant && e.room && Math.abs(x - (e.room.x + e.room.w / 2)) < e.room.w / 2 + 2 && Math.abs(y - (e.room.y + e.room.h / 2)) < e.room.h / 2 + 2) {
        this.wake(e);
      }
    }
  }

  wake(e) {
    if (!e.dormant) return;
    e.dormant = false;
    e.state = 'chase';
    e.timer = 500;
    Sound.play('growl');
    const id = e.mids[0];
    if (id === 'butcher') { UI.toast('{r}"Ah... fresh meat!"{/}'); this.shake = 1; }
    else if (id === 'leoric') UI.toast('{r}A cold voice: "The warmth of life has entered my tomb..."{/}');
    else if (id === 'diablo') { UI.toast('{r}The Lord of Terror turns to look at you.{/}'); shakeMind(this.p, 10); this.shake = 1.5; }
  }

  // ---------------------------------------------------------------- stepping
  onStep() {
    const p = this.p, L = this.L;
    const notices = survivalStep(p, L.depth);
    if (p.steps % 2 === 0) Sound.play('step');
    for (const n of notices) {
      if (n === 'torch-out') {
        if (hasItem(p, 'torch')) {
          this.run(async () => {
            await UI.say('{o}Your torch gutters and goes out.{/} The dark rushes in.');
            if (await UI.confirm('Light another torch?')) await useItem(p, 'torch');
          });
        } else UI.toast('{r}Your last torch dies. You are alone in the dark.{/}');
      } else UI.toast(n);
    }
    // darkness eats the mind
    if (L.depth > 0) {
      const b = Light.tileBright(L, p.x, p.y);
      if (b < 0.32) {
        this.darkSteps++;
        if (this.darkSteps % 4 === 0) shakeMind(p, 1);
        if (this.darkSteps % 40 === 1) UI.toast('{d}' + R.pick(LORE.darkness) + '{/}');
      } else this.darkSteps = 0;
    }
    // gold is picked up on sight: you cannot help yourself
    for (const e of L.entsAt(p.x, p.y)) {
      if (e.kind === 'gold') {
        p.gold += e.amount; p.goldFound += e.amount;
        L.remove(e);
        Sound.play('coin');
        UI.toast(`{g}+${e.amount} gold{/}`);
        const before = purseNoise(Object.assign({}, p, { gold: p.gold - e.amount }));
        if (purseNoise(p) > before) UI.toast('{d}Your purse is heavy. It jingles with every step.{/}');
      }
      if (e.kind === 'portal') { this.run(() => this.usePortal(e)); return; }
    }
    const t = L.get(p.x, p.y);
    if (t === T.DOWN) { this.run(() => this.changeLevel(L.depth + 1, 'down')); return; }
    if (t === T.UP) { this.run(() => this.changeLevel(L.depth - 1, 'up')); return; }
    if (t === T.SURFACE) { this.run(() => this.changeLevel(0, 'surface')); return; }
    if (t === T.ENTRANCE) { this.run(() => this.changeLevel(1, 'down')); return; }
    if (t === T.CRYPT) { this.run(() => this.changeLevel(5, 'shortcut')); return; }
    if (t === T.FISSURE) { this.run(() => this.changeLevel(9, 'shortcut')); return; }
    if (L.depth === 0 && p.y >= L.h - 2 && (t === T.ROAD)) { this.run(() => this.leaveTown()); return; }
    // ambush checks
    for (const e of L.ents) {
      if (e.kind === 'monster' && e.dormant && e.room) {
        const r = e.room;
        if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) this.wake(e);
        else if (dist(p.x, p.y, e.x, e.y) < 4.5 && hasLOS(L, p.x, p.y, e.x, e.y)) this.wake(e);
      }
    }
    if (isDead(p)) Game.checkDeath();
  }

  // ---------------------------------------------------------------- monsters
  updateMonsters(dt) {
    const p = this.p, L = this.L;
    for (const e of L.ents.slice()) {
      if (e.kind !== 'monster' || e.dormant) continue;
      if (!e.mids.length || !MONSTERS[e.mids[0]]) { L.remove(e); continue; }
      if (e.phantom) { this.updatePhantom(e, dt); continue; }
      e.timer = (e.timer || 0) - dt;
      if (e.stunUntil && Clock.t < e.stunUntil) continue;
      if (e.timer > 0) continue;
      const def = MONSTERS[e.mids[0]];
      const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      const pb = Light.tileBright(L, p.x, p.y);
      let sight = def.sight + purseNoise(p) + (p.lit ? 1 : 0);
      if (pb < 0.3) sight = Math.min(sight, 3);
      const sees = d <= sight && hasLOS(L, e.x, e.y, p.x, p.y);
      if (sees) { e.state = 'chase'; e.lastX = p.x; e.lastY = p.y; e.lost = 0; }
      const crippled = e.crippled;
      let speed = def.speed * (crippled ? 3 : 1);
      if (e.state === 'chase') {
        if (d === 1 && !this.move) { this.run(() => this.fight(e, true)); return; }
        if (d === 1) { e.timer = 120; continue; }
        if (!sees) {
          e.lost = (e.lost || 0) + 1;
          if (e.lost > 10) e.state = 'idle';
        }
        const step = this.pathStep(e, e.lastX, e.lastY);
        if (step) this.moveMonster(e, step[0], step[1]);
        else if (!sees) e.state = 'idle';
        e.timer = speed * (0.85 + R.next() * 0.3);
      } else {
        if (R.chance(0.45)) {
          const dir = R.pick(DIR_LIST);
          const [dx, dy] = DIRS[dir];
          const nx = e.x + dx, ny = e.y + dy;
          if (Math.abs(nx - e.homeX) + Math.abs(ny - e.homeY) <= 6 && this.monsterCanStep(e, nx, ny)) this.moveMonster(e, nx, ny);
        }
        e.timer = speed * 2.4 * (0.7 + R.next() * 0.6);
      }
    }
  }
  monsterCanStep(e, x, y) {
    const L = this.L, t = L.get(x, y);
    if (!(TINFO[t].walk || t === T.DOOR)) return false;
    if (t === T.UP || t === T.DOWN || t === T.SURFACE) return false;
    if (x === this.p.x && y === this.p.y) return false;
    return !L.ents.some(o => o !== e && o.x === x && o.y === y && (o.block || o.kind === 'monster'));
  }
  moveMonster(e, x, y) {
    if (this.L.get(x, y) === T.DOOR) { this.L.set(x, y, T.DOOR_OPEN); Light.buildStatic(this.L); Sound.play('door'); }
    e.face = x < e.x ? -1 : x > e.x ? 1 : e.face;
    e.x = x; e.y = y;
    e.animT = Clock.t;
  }
  pathStep(e, tx, ty) {
    const L = this.L;
    if (tx == null) return null;
    const W = L.w;
    const prev = new Int32Array(L.w * L.h).fill(-1);
    const start = e.x + e.y * W, goal = tx + ty * W;
    const q = [start];
    prev[start] = start;
    let found = false;
    for (let qi = 0; qi < q.length && qi < 1600; qi++) {
      const c = q[qi];
      if (c === goal) { found = true; break; }
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        const ni = nx + ny * W;
        if (!L.inb(nx, ny) || prev[ni] >= 0) continue;
        if (ni !== goal && !this.monsterCanStep(e, nx, ny)) continue;
        if (ni === goal && !(TINFO[L.get(nx, ny)].walk || L.get(nx, ny) === T.DOOR)) continue;
        prev[ni] = c;
        q.push(ni);
      }
    }
    if (!found) return null;
    let c = goal;
    while (prev[c] !== start) c = prev[c];
    const sx = c % W, sy = (c / W) | 0;
    if (sx === this.p.x && sy === this.p.y) return null;
    if (!this.monsterCanStep(e, sx, sy)) return null;
    return [sx, sy];
  }

  updateCrows() {
    const p = this.p;
    for (const e of this.L.ents.slice()) {
      if (e.kind !== 'crow') continue;
      if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 2) {
        this.L.remove(e);
        Sound.play('crow');
        for (let i = 0; i < 6; i++) this.particles.push({ x: e.x * TILE + 8, y: e.y * TILE + 10, vx: R.range(-0.05, 0.05), vy: R.range(-0.09, -0.04), life: 900, age: 0, col: '#151216', size: 2, above: true });
      }
    }
  }

  // Hallucinations when the mind frays.
  updateAmbience(dt) {
    const p = this.p, L = this.L;
    if (L.depth === 0) return;
    this.whisperT += dt;
    if (p.mind < 45 && this.whisperT > 9000 + p.mind * 300) {
      this.whisperT = 0;
      if (R.chance(0.6)) { UI.toast('{p}' + R.pick(LORE.whispers) + '{/}'); Sound.play('whisper'); }
      else if (p.mind < 35) this.spawnPhantom();
    }
    if (p.mind < 50) {
      if (this.eyes.length < Math.floor((50 - p.mind) / 8) && R.chance(0.02)) {
        const a = R.range(0, Math.PI * 2), r = R.range(4, 8);
        this.eyes.push({ x: p.x + Math.round(Math.cos(a) * r), y: p.y + Math.round(Math.sin(a) * r), age: 0, life: R.int(2000, 5000) });
      }
    }
    for (const e of this.eyes) e.age += dt;
    this.eyes = this.eyes.filter(e => e.age < e.life);
  }
  spawnPhantom() {
    const p = this.p, L = this.L;
    const pool = monsterPool(Math.max(1, L.depth));
    for (let t = 0; t < 30; t++) {
      const x = p.x + R.int(-6, 6), y = p.y + R.int(-6, 6);
      if (Math.abs(x - p.x) + Math.abs(y - p.y) < 4) continue;
      if (!this.monsterCanStep({}, x, y) || !L.passable(x, y)) continue;
      L.add(newMonsterEnt([R.weighted(pool)], x, y, { phantom: true, born: Clock.t, timer: 300, block: false }));
      return;
    }
  }
  updatePhantom(e, dt) {
    const p = this.p;
    e.timer -= dt;
    const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    if (d <= 1 || Clock.t - e.born > 7000) {
      this.L.remove(e);
      if (d <= 1) { UI.toast('{p}It lunges, and there is nothing there.{/}'); shakeMind(p, 3); Sound.play('whisper'); }
      return;
    }
    if (e.timer <= 0) {
      e.timer = 380;
      const dx = Math.sign(p.x - e.x), dy = Math.sign(p.y - e.y);
      const nx = e.x + (dx && R.chance(0.5) ? dx : 0), ny = e.y + (nx === e.x ? dy : 0);
      if (this.L.passable(nx, ny)) { e.x = nx; e.y = ny; }
    }
  }

  // ---------------------------------------------------------------- combat hook
  async fight(e, ambush) {
    if (e.phantom) { this.L.remove(e); UI.toast('{p}You swing at nothing. It was never there.{/}'); shakeMind(this.p, 2); return; }
    this.move = null;
    const res = await Game.combat(e, ambush);
    const p = this.p, L = this.L;
    if (res.outcome === 'win') {
      L.remove(e);
      for (let i = 0; i < 2; i++) {
        const x = e.x + R.int(-1, 1), y = e.y + R.int(-1, 1);
        if (L.isFloor(x, y)) L.decal[L.i(x, y)] = R.pick([DECAL.BLOOD2, DECAL.BLOOD3]);
      }
      L.decal[L.i(e.x, e.y)] = DECAL.BLOOD3;
      await this.afterVictory(e, res);
    } else if (!e.mids.length) {
      L.remove(e);
    } else if (res.outcome === 'fled' || res.outcome === 'purse') {
      e.stunUntil = Clock.t + (res.outcome === 'purse' ? 4500 : 3000);
      e.crippled = res.crippled;
      e.state = 'chase';
      if (res.outcome === 'purse' && res.dropped > 0) {
        L.add({ kind: 'gold', x: p.x, y: p.y, amount: res.dropped, block: false, dropped: true });
      }
      // put a little distance between you
      const away = DIR_LIST.map(d => DIRS[d]).filter(([dx, dy]) => L.passable(p.x + dx, p.y + dy) && !(p.x + dx === e.x && p.y + dy === e.y))
        .sort((a, b) => dist(p.x + b[0], p.y + b[1], e.x, e.y) - dist(p.x + a[0], p.y + a[1], e.x, e.y))[0];
      if (away) { p.x += away[0]; p.y += away[1]; this.rx = p.x * TILE; this.ry = p.y * TILE; }
    }
  }

  async afterVictory(e, res) {
    const p = this.p;
    const gold = res.gold || 0;
    const items = res.items || [];
    if (gold || items.length) await this.giveLoot(items, gold, 'Among the remains');
    const carve = res.carve;
    if (carve) {
      const human = carve === 'flesh';
      const prompt = human ? 'The body is still warm. You could carve it for meat. You would have to live with that.' : 'You could carve the carcass for meat.';
      if (await UI.confirm(prompt, 'Carve it', 'Leave it')) {
        const n = R.int(1, 2);
        const got = addItem(p, human ? 'flesh' : 'rawmeat', n);
        if (human) shakeMind(p, 4);
        await UI.say(got ? `You carve off ${got === 1 ? 'a slab' : 'two slabs'} of ${human ? 'strange flesh' : 'raw meat'}.` + (human ? ' {r}Your hands will not stop shaking.{/}' : '') : 'Your pack is full.');
      }
    }
    if (res.soulstone) {
      this.L.add({ kind: 'sack', x: e.x, y: e.y, items: ['soulstone'], block: false, soulstone: true });
    }
  }

  // ---------------------------------------------------------------- interaction
  async interactFacing() {
    const p = this.p, L = this.L;
    const [dx, dy] = DIRS[p.dir];
    const fx = p.x + dx, fy = p.y + dy;
    const here = L.entsAt(p.x, p.y).filter(e => ['sack', 'note', 'corpse', 'bones', 'bedroll', 'portal'].includes(e.kind));
    const front = L.ents.filter(e => e.x === fx && e.y === fy && e.kind !== 'ember' && e.kind !== 'glow');
    const target = front.find(e => e.kind !== 'gold') || here[0];
    if (target) return this.interact(target);
    const t = L.get(fx, fy);
    if (t === T.DOOR) return this.openDoor(fx, fy);
    if (t === T.WATER) return UI.say(L.depth === 0 ? 'The river is black with ash. Things float in it.' : 'Black water. Something pale drifts just under the surface.');
    if (t === T.LAVA) return UI.say('Molten rock. The heat makes your eyes water.');
  }

  async interact(e) {
    const p = this.p, L = this.L;
    switch (e.kind) {
      case 'chest': return this.openChest(e);
      case 'barrel': return this.smashBarrel(e);
      case 'corpse': return this.searchCorpse(e);
      case 'bones': return this.searchBones(e);
      case 'sack': {
        if (e.soulstone) return Game.soulstoneEnding();
        const left = [];
        const got = [];
        for (const id of e.items) (addItem(p, id) ? got : left).push(id);
        if (got.length) { Sound.play('ok'); await UI.say(e.mushrooms ? 'You pick the pale mushrooms growing from a corpse\'s ribs.' : `You pick up ${listItems(got)}.`); }
        if (left.length) { e.items = left; await UI.say('Your pack is full.'); } else L.remove(e);
        return;
      }
      case 'gold': p.gold += e.amount; p.goldFound += e.amount; L.remove(e); Sound.play('coin'); UI.toast(`{g}+${e.amount} gold{/}`); return;
      case 'shrine': return this.useShrine(e);
      case 'altar': return this.useAltar(e);
      case 'note': {
        const n = LORE.notes[e.note];
        Sound.play('menu');
        await UI.say(`{g}${n.title}{/}\n${n.text}`);
        return;
      }
      case 'sarc': return this.openSarc(e);
      case 'decor': {
        const lines = LORE.examine[e.sprite];
        if (lines) await UI.say(lines[(e.id || 0) % lines.length]);
        return;
      }
      case 'crow': return UI.say('A crow, fat from the dead. It watches you with one eye.');
      case 'npc': return Town.talk(e.npc);
      case 'campfire': case 'bedroll': return Town.camp();
      case 'well': return Town.stash();
      case 'rack': {
        if (e.taken) return UI.say('Griswold\'s rack. Nothing usable is left.');
        if (addItem(p, 'axe')) {
          e.taken = true;
          return UI.say('Griswold\'s weapon rack, half melted. One hand axe survived the fire. You take it. {d}(Equip it from the menu.){/}');
        }
        return UI.say('Your pack is full.');
      }
      case 'sign': return this.leaveTown();
      case 'portal': return this.usePortal(e);
      case 'gharbad': return this.gharbad(e);
      case 'monster': return this.fight(e, false);
    }
  }

  async giveLoot(items, gold, intro) {
    const p = this.p;
    const got = [], left = [];
    for (const id of items) (addItem(p, id) ? got : left).push(id);
    if (gold > 0) { p.gold += gold; p.goldFound += gold; Sound.play('coin'); }
    const parts = [];
    if (gold > 0) parts.push(`{g}${gold} gold{/}`);
    if (got.length) parts.push(listItems(got));
    if (!parts.length && !left.length) { await UI.say(`${intro}: nothing worth taking.`); return; }
    if (parts.length) await UI.say(`${intro}: ${joinList(parts)}.`);
    if (got.some(id => ITEMS[id].type === 'treasure')) Sound.play('coin');
    if (left.length) {
      this.L.add({ kind: 'sack', x: p.x, y: p.y, items: left, block: false });
      await UI.say(`Your pack is full. You leave ${listItems(left)} on the floor.`);
    }
  }

  async openChest(e) {
    const p = this.p;
    if (e.open) return UI.say('The chest is empty.');
    if (e.trapped) {
      await UI.say(e.ornate ? 'An ornate chest, sealed with old wards. Something inside it is worth protecting.' : 'There is a fine wire running from the lid into the lock.');
      const c = await UI.choose('Force it open anyway?', ['Force the lid', 'Leave it'], { cancel: 1 });
      if (c === 1) return;
      const safe = await UI.coinFlip('You pry at the lid', 'It opens clean', 'The trap fires');
      if (!safe) {
        Sound.play('hurt'); this.flash = 1;
        const dmg = 4 + Math.floor(this.L.depth * 0.8);
        hurt(p, dmg, 'trap');
        if (R.chance(0.5)) { p.poison += 25; await UI.say(`{r}A needle jabs into your hand.{/} (${dmg} damage, poisoned)`); }
        else { p.bleed = Math.min(3, p.bleed + 1); await UI.say(`{r}A blade snaps out of the lock and opens your palm.{/} (${dmg} damage, bleeding)`); }
        if (isDead(p)) return;
      }
    }
    e.open = true;
    Sound.play('chest');
    await this.giveLoot(e.items || [], e.gold || 0, 'Inside the chest');
  }

  async smashBarrel(e) {
    const p = this.p, L = this.L;
    if (e.broken) return;
    if (R.chance(0.12)) {
      await UI.say('{o}You hear a hiss from inside the barrel. Something is burning.{/}');
      const dodge = await UI.coinFlip('Throw yourself clear', 'You dive away', 'It goes off');
      Sound.play('explode'); this.shake = 1.4; this.flash = 1;
      e.broken = true; e.block = false;
      L.decal[L.i(e.x, e.y)] = DECAL.CRACK;
      if (!dodge) {
        const dmg = R.int(6, 12) + Math.floor(L.depth / 2);
        hurt(p, dmg, 'barrel');
        p.bleed = Math.min(3, p.bleed + 1);
        await UI.say(`{r}The barrel explodes in your face.{/} (${dmg} damage, bleeding)`);
      } else await UI.say('The blast throws splinters and fire past you. You are alive.');
      return;
    }
    e.broken = true; e.block = false;
    Sound.play('barrel');
    const r = R.next();
    if (r < 0.45) return UI.say('You smash the barrel. Nothing but rotten straw.');
    if (r < 0.75) return this.giveLoot([], R.int(3, 12) + L.depth * 2, 'In the barrel');
    return this.giveLoot([R.weighted(LOOT.common)], 0, 'In the barrel');
  }

  async searchCorpse(e) {
    const p = this.p;
    if (e.looted) return UI.say(e.town ? 'You already went through this one\'s pockets.' : 'You have already searched this body.');
    e.looted = true;
    if (e.town) {
      const pool = [['bread', 3], ['apple', 3], ['bandage', 2], ['wine', 1], [null, 3]];
      const id = R.weighted(pool);
      const gold = R.int(0, 6);
      const name = ['A villager', 'A woman in a nightgown', 'An old farmer', 'One of the town guard'][e.id % 4];
      if (!id && !gold) return UI.say(`${name}, burned and trampled. Nothing on them.`);
      return this.giveLoot(id ? [id] : [], gold, `${name}, burned and trampled. You search them`);
    }
    await this.giveLoot(e.items || [], e.gold || 0, 'You search the body');
    if (R.chance(0.35)) {
      const c = await UI.choose('Something glints deep inside the body\'s ribcage. Reach in?', ['Reach in', 'Leave it'], { cancel: 1 });
      if (c === 0) {
        const ok = await UI.coinFlip('You push your hand into the cold cavity', 'Treasure', 'Something bites');
        if (ok) await this.giveLoot([R.weighted(LOOT.treasure[this.L.theme] || LOOT.treasure.cathedral)], 0, 'Your fingers close on it');
        else {
          Sound.play('hurt'); hurt(p, 3, 'infection'); p.infection = Math.min(4, p.infection + 1); p.bleed = Math.min(3, p.bleed + 1); shakeMind(p, 5);
          await UI.say('{r}Teeth.{/} Something small was nesting in there. It bites deep before you tear your hand free. {v}The bite feels dirty.{/}');
        }
      }
    }
  }

  async searchBones(e) {
    if (e.searched) return UI.say('Just bones.');
    e.searched = true;
    if (R.chance(0.4)) return this.giveLoot(R.chance(0.5) ? [] : [R.weighted(LOOT.common)], R.int(2, 10), 'You sift through the bones');
    return UI.say('You sift through the bones. Whoever this was, they died with nothing.');
  }

  async openSarc(e) {
    if (e.open) return UI.say('An open sarcophagus. The bones inside are gone.');
    if (!(await UI.confirm('A stone sarcophagus. Slide the lid off?', 'Slide it off', 'Leave it'))) return;
    e.open = true;
    Sound.play('chest');
    if (R.chance(0.35)) {
      await UI.say('{r}A hand shoots out of the dark inside and grabs your wrist.{/}');
      const mids = ['skeleton'];
      if (this.L.depth >= 3 && R.chance(0.5)) mids.push('skeleton');
      const ent = this.L.add(newMonsterEnt(mids, e.x, e.y + 1 <= this.L.h - 1 && this.L.passable(e.x, e.y + 1) ? e.y + 1 : e.y, { block: false }));
      ent.x = e.x; ent.y = e.y;
      const res = await Game.combat(ent, true);
      this.L.remove(ent);
      if (res.outcome === 'win' && (res.gold || res.items.length)) await this.giveLoot(res.items, res.gold, 'Among the bones');
      if (res.outcome === 'dead') return;
    }
    await this.giveLoot(e.items || [], e.gold || 0, 'Inside the sarcophagus');
  }

  async useShrine(e) {
    const p = this.p;
    const s = LORE.shrines[e.shrine];
    if (e.used) return UI.say(`The ${s.name} is silent now.`);
    await UI.say(`{p}${s.name}{/}. Old stone, older than the church. Something is still listening.`);
    if (!(await UI.confirm('Pray at the shrine?', 'Pray', 'Leave'))) return;
    e.used = true;
    const heads = await UI.coinFlip(`You kneel at the ${s.name}`, 'A blessing', 'A curse');
    const eff = heads ? s.heads : s.tails;
    Sound.play(heads ? 'shrine' : 'curse');
    const L = this.L;
    switch (eff) {
      case 'gift': { const id = R.weighted(LOOT.deep); addItem(p, id); return UI.say(`A ${ITEMS[id].name} is lying on the stone where there was nothing a moment ago.`); }
      case 'mind': calm(p, 30); return UI.say('{b}A cool calm washes over you.{/} (+30 mind)');
      case 'heal': heal(p, 999); p.bleed = 0; return UI.say('{r}Your wounds close.{/}');
      case 'restore': heal(p, 999); calm(p, 40); p.bleed = 0; p.infection = 0; p.poison = 0; return UI.say('{v}You are whole again, body and mind.{/}');
      case 'vigor': p.maxHp += 4; heal(p, 4); return UI.say('{v}You feel stronger.{/} (+4 max health)');
      case 'gold': { const n = 40 + L.depth * 25; p.gold += n; p.goldFound += n; Sound.play('coin'); return UI.say(`Gold coins spill from a crack in the stone. {g}+${n} gold{/}`); }
      case 'drain': hurt(p, 6, 'trap'); p.food = Math.max(0, p.food - 15); return UI.say('{r}The shrine drinks from you.{/} You feel hollow and starved. (-6 health, hunger)');
      case 'curse': shakeMind(p, 18); return UI.say('{r}A voice laughs inside your head and does not stop for a long time.{/} (-18 mind)');
      case 'bleed': p.bleed = Math.min(3, p.bleed + 2); return UI.say('{r}Blood runs from your nose, your ears, your eyes.{/} You are bleeding.');
      case 'terror': {
        shakeMind(p, 8);
        await UI.say('{r}The shrine screams.{/} Something answers it from nearby.');
        const pool = monsterPool(L.depth);
        for (let t = 0; t < 40; t++) {
          const x = p.x + R.int(-5, 5), y = p.y + R.int(-5, 5);
          if (Math.abs(x - p.x) + Math.abs(y - p.y) < 3 || !L.passable(x, y)) continue;
          const m = L.add(newMonsterEnt([R.weighted(pool)], x, y));
          m.state = 'chase'; m.lastX = p.x; m.lastY = p.y; m.timer = 800;
          break;
        }
        return;
      }
      default: return UI.say('Nothing happens. Nothing at all.');
    }
  }

  async useAltar(e) {
    const p = this.p;
    const cost = 20 + this.L.depth * 10;
    await UI.say('A stone altar, black with old blood. Coins are pressed into the stains. {d}Leave an offering, and the dark will remember you as you are now.{/}');
    if (p.gold < cost) return UI.say(`It wants ${cost} gold. You do not have enough.`);
    if (!(await UI.confirm(`Offer ${cost} gold to be remembered? {d}(Saves the game){/}`, `Offer ${cost} gold`, 'Keep your gold'))) return;
    p.gold -= cost;
    Sound.play('shrine');
    Game.save();
    await UI.say('The coins sink into the stone. You will be remembered. {d}(Game saved){/}');
  }

  async gharbad(e) {
    const p = this.p;
    if (e.stage === 0) {
      await UI.say('{y}"Pleeeease, no hurt! No kill! Keep alive and next time good bring to you!"{/}', { speaker: 'Gharbad the Weak' });
      const c = await UI.choose('A small, sickly goatman cowers in front of you, clutching a sack.', ['Spare him', 'Kill him'], { cancel: 0 });
      if (c === 0) {
        e.stage = 1;
        await UI.say('{y}"Gharbad remember! Gharbad make something for you. Come back! Come back later!"{/}', { speaker: 'Gharbad the Weak' });
        e.wakeStep = p.steps + 120;
        return;
      }
      return this.fightGharbad(e);
    }
    if (e.stage === 1) {
      if (p.steps < e.wakeStep) return UI.say('{y}"Not ready! Not ready! Gharbad working!"{/}', { speaker: 'Gharbad the Weak' });
      e.stage = 2;
      await UI.say('{y}"Here! Here! Gharbad keeps promise!"{/} He pushes a potion into your hands. {y}"Come back again, Gharbad has something BIG for you."{/}', { speaker: 'Gharbad the Weak' });
      addItem(p, 'rpot');
      e.wakeStep = p.steps + 150;
      return;
    }
    if (e.stage === 2) {
      if (p.steps < e.wakeStep) return UI.say('{y}"Soon! Soon!"{/}', { speaker: 'Gharbad the Weak' });
      await UI.say('{y}"This too good for you. Very powerful! You want - you take!"{/} He pulls a crude club from his sack and lunges at you.', { speaker: 'Gharbad the Weak' });
      return this.fightGharbad(e);
    }
  }
  async fightGharbad(e) {
    const L = this.L;
    const ent = L.add(newMonsterEnt(['gharbad'], e.x, e.y, { block: false }));
    L.remove(e);
    const res = await Game.combat(ent, false);
    if (res.outcome === 'win') {
      L.remove(ent);
      await this.giveLoot(['mace', 'ruby'], res.gold, 'Gharbad\'s sack holds');
    } else if (res.outcome !== 'dead') {
      L.remove(ent);
      await UI.say('Gharbad scrambles off into the dark, whimpering.');
    }
  }

  async usePortal(e) {
    const f = G.flags.portal;
    if (!f) { this.L.remove(e); return; }
    Sound.play('portal');
    if (this.L.depth === 0) {
      await this.changeLevel(f.depth, 'portal');
    } else {
      await this.changeLevel(0, 'portal');
    }
  }
  async castPortal() {
    const p = this.p;
    if (this.L.depth === 0) { await UI.say('You are already in Tristram.'); return false; }
    removeItem(p, 'tp');
    if (G.flags.portal) {
      const old = G.levels[G.flags.portal.depth];
      if (old) old.ents = old.ents.filter(x => x.kind !== 'portal');
    }
    G.flags.portal = { depth: this.L.depth, x: p.x, y: p.y };
    this.L.add({ kind: 'portal', x: p.x, y: p.y, block: false });
    Sound.play('portal');
    await UI.say('The scroll burns away in your hands. A red gate tears open in the air.');
    await this.changeLevel(0, 'portal');
    return true;
  }

  async leaveTown() {
    const p = this.p;
    const hoard = Town.hoardValue();
    await UI.say(`The road out of Tristram. You could leave now. Take your ${p.gold} gold and the ${hoard} hidden under the well, and never look back.`);
    const c = await UI.choose('Leave Tristram forever?', ['Stay. There is more gold below.', 'Leave Tristram'], { cancel: 0 });
    if (c === 1) await Game.leaveEnding();
    else if (p.y >= this.L.h - 2) { p.y -= 1; this.ry = p.y * TILE; }
  }

  // ---------------------------------------------------------------- level changes
  async changeLevel(depth, how) {
    const p = this.p;
    Sound.play('stairs');
    await UI.fadeTo(1, 380);
    const from = this.L.depth;
    let L = G.levels[depth];
    const first = !L;
    if (!L) {
      L = depth === 0 ? buildTown() : buildDungeon(depth, (G.seed + depth * 7919) >>> 0);
      G.levels[depth] = L;
    }
    let x, y;
    if (how === 'portal') {
      if (depth === 0) {
        x = PORTAL_TOWN.x; y = PORTAL_TOWN.y;
        if (!L.ents.some(e => e.kind === 'portal')) L.add({ kind: 'portal', x, y, block: false });
        y += 1;
      } else {
        const f = G.flags.portal;
        x = f.x; y = f.y;
        L.ents = L.ents.filter(e => e.kind !== 'portal');
        G.levels[0].ents = G.levels[0].ents.filter(e => e.kind !== 'portal');
        G.flags.portal = null;
      }
    } else if (depth === 0) {
      if (how === 'surface') {
        if (from === 5) { x = 9; y = 34; G.flags.crypt = true; }
        else { x = 40; y = 36; G.flags.fissure = true; }
      } else { x = 25; y = 8; }
    } else if (how === 'shortcut') {
      x = L.surface.x; y = L.surface.y;
    } else if (how === 'down') {
      x = L.up.x; y = L.up.y;
    } else {
      x = L.down.x; y = L.down.y;
    }
    if (depth > p.deepest) p.deepest = depth;
    if (depth === 5 && L.surface && how !== 'shortcut') G.flags.crypt = true;
    if (depth === 9 && L.surface && how !== 'shortcut') G.flags.fissure = true;
    if (depth > 0 && !first && L.townTrip < G.townTrips) this.respawn(L, x, y);
    L.townTrip = G.townTrips;
    G.depth = depth;
    this.enter(L, x, y);
    await UI.fadeTo(0, 380);
    UI.showBanner(L.name, depth === 0 ? 'What is left of it' : first ? 'You have not been this deep before' : null);
    if (first && LORE.depthLines[depth]) await UI.say(LORE.depthLines[depth]);
    if (depth === 5 && first && L.surface) UI.toast('{d}Somewhere on this level, a stair leads up to the graveyard crypt.{/}');
    if (depth > 0 && !p.lit) {
      if (hasItem(p, 'torch')) {
        if (await UI.confirm('It is pitch black. Light a torch?')) await useItem(p, 'torch');
      } else await UI.say('{r}It is pitch black, and you have no torches.{/}');
    }
  }

  respawn(L, px, py) {
    const pool = monsterPool(L.depth);
    const n = R.int(1, 3);
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 200; t++) {
        const x = R.int(1, L.w - 2), y = R.int(1, L.h - 2);
        if (L.get(x, y) !== T.FLOOR || L.ents.some(e => e.x === x && e.y === y)) continue;
        if (Math.abs(x - px) + Math.abs(y - py) < 12) continue;
        const lead = R.weighted(pool);
        const mids = [lead];
        if (R.chance(0.4)) mids.push(R.weighted(pool));
        L.add(newMonsterEnt(mids, x, y));
        break;
      }
    }
  }

  // ---------------------------------------------------------------- particles
  updateParticles(dt) {
    const L = this.L;
    for (const q of this.particles) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    this.particles = this.particles.filter(q => q.age < q.life);
    if (L.depth === 0 && this.particles.length < 70 && R.chance(dt * 0.02)) {
      const cx = this.rx, cy = this.ry;
      const ember = R.chance(0.3);
      this.particles.push({ x: cx + R.range(-180, 180), y: cy + R.range(-140, 60), vx: R.range(-0.006, 0.012), vy: ember ? R.range(-0.02, -0.01) : R.range(0.008, 0.016), life: R.int(2500, 5000), age: 0, col: ember ? R.pick(['#e8803a', '#ffb050']) : R.pick(['#8a8478', '#6a655c']), size: 1, above: true, glow: ember });
    } else if (L.depth > 0 && this.particles.length < 24 && R.chance(dt * 0.004)) {
      this.particles.push({ x: this.rx + R.range(-60, 76), y: this.ry + R.range(-60, 76), vx: R.range(-0.004, 0.004), vy: R.range(-0.004, 0.003), life: R.int(2000, 4000), age: 0, col: '#c8b898', size: 1, dust: true });
    }
  }

  // ---------------------------------------------------------------- rendering
  draw(lo, ctx) {
    const L = this.L, p = this.p;
    const c = lo.ctx;
    c.fillStyle = '#000';
    c.fillRect(0, 0, VW, VH);
    let camX = Math.round(this.rx + 8 - VW / 2), camY = Math.round(this.ry + 8 - VH / 2);
    if (this.shake > 0) { camX += Math.round(R.range(-2, 2) * this.shake); camY += Math.round(R.range(-2, 2) * this.shake); }
    this.camX = camX; this.camY = camY;
    const ts = Tiles.get(L.theme);
    const tx0 = Math.floor(camX / TILE) - 1, ty0 = Math.floor(camY / TILE) - 1;
    const tw = Math.ceil(VW / TILE) + 3, th = Math.ceil(VH / TILE) + 3;
    const t = Clock.t;
    const frame3 = Math.floor(t / 420) % 3;
    const drawables = [];

    for (let ty = ty0; ty < ty0 + th; ty++) {
      for (let tx = tx0; tx < tx0 + tw; tx++) {
        if (!L.inb(tx, ty)) continue;
        const i = L.i(tx, ty);
        if (!Light.vis[i] && !L.explored[i]) continue;
        const sx = tx * TILE - camX, sy = ty * TILE - camY;
        const tile = L.tiles[i];
        this.drawTile(c, L, ts, tile, tx, ty, sx, sy, frame3);
        const dcl = L.decal[i];
        if (dcl && !wallLike(tile)) c.drawImage(Decals.get(dcl), sx, sy);
        if (tile === T.TREE) drawables.push({ y: ty * TILE + 15, fn: () => c.drawImage(ObjSprites.get('tree'), sx - 2, sy - 14) });
      }
    }

    // entities
    for (const e of L.ents) {
      if (e.x < tx0 - 1 || e.x > tx0 + tw || e.y < ty0 - 1 || e.y > ty0 + th + 1) continue;
      const i = L.i(e.x, e.y);
      if (!Light.vis[i] && !(L.explored[i] && !['monster', 'crow', 'npc'].includes(e.kind))) continue;
      if (e.kind === 'monster' && (!MONSTERS[e.mids[0]] || !this.monsterVisible(e))) continue;
      const sx = e.x * TILE - camX, sy = e.y * TILE - camY;
      drawables.push({ y: e.y * TILE + (e.kind === 'sconce' ? -20 : e.block || e.kind === 'monster' || e.kind === 'npc' ? 14 : 1), fn: () => this.drawEntity(c, e, sx, sy, t) });
    }
    // player
    const psx = Math.round(this.rx) - camX, psy = Math.round(this.ry) - camY;
    drawables.push({ y: this.ry + 14, fn: () => {
      const spr = CharSprites.player(p.dir, this.move ? this.walkFrame : 0);
      c.drawImage(spr, psx + 2, psy - 1);
    } });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    for (const q of this.particles) if (q.dust) { px(c, q.x - camX, q.y - camY, rgba(q.col, 0.5 * (1 - q.age / q.life))); }

    // darkness
    const wob = p.mind < 40 ? (40 - p.mind) / 80 : 0;
    Light.render(c, L, camX, camY, t, { wobble: wob, tint: L.depth === 0 ? [8, 8, 16] : L.theme === 'hell' ? [14, 3, 3] : [6, 4, 9] });

    // things that shine through the dark
    for (const e of L.ents) {
      if (e.x < tx0 - 1 || e.x > tx0 + tw || e.y < ty0 - 1 || e.y > ty0 + th + 1) continue;
      const i = L.i(e.x, e.y);
      const sx = e.x * TILE - camX, sy = e.y * TILE - camY;
      const visible = Light.vis[i];
      if (e.kind === 'sconce' && visible) drawFlame(c, sx + 8, sy + 6, t, 1, e.id);
      else if (e.kind === 'decor' && e.sprite === 'candelabra' && visible) { drawFlame(c, sx + 5, sy - 1, t, 0.6, e.id); drawFlame(c, sx + 8, sy - 2, t, 0.6, e.id + 1); drawFlame(c, sx + 11, sy - 1, t, 0.6, e.id + 2); }
      else if (e.kind === 'decor' && e.sprite === 'brazier' && visible) drawFlame(c, sx + 8, sy + 4, t, 1.4, e.id);
      else if (e.kind === 'campfire' && visible) { drawFlame(c, sx + 6, sy + 11, t, 1.5, 1); drawFlame(c, sx + 10, sy + 11, t, 1.3, 2); drawFlame(c, sx + 8, sy + 10, t, 1.8, 3); }
      else if (e.kind === 'ember' && visible) { if (Math.sin(t / 300 + e.id) > 0) px(c, sx + 7, sy + 10, '#ff9a40'); drawFlame(c, sx + 8, sy + 12, t, 0.5, e.id); }
      else if (e.kind === 'portal' && visible) this.drawPortal(c, sx, sy, t);
      else if ((e.kind === 'gold' || (e.kind === 'chest' && !e.open)) && visible && Light.pdist[i] < 11) {
        const tw2 = (Math.sin(t / 260 + e.id * 1.7) + 1) / 2;
        if (tw2 > 0.7) { const gx = sx + 5 + (e.id * 3) % 6, gy = sy + 9; px(c, gx, gy, '#fff4c0'); if (tw2 > 0.88) { px(c, gx - 1, gy, '#e8c060'); px(c, gx + 1, gy, '#e8c060'); px(c, gx, gy - 1, '#e8c060'); px(c, gx, gy + 1, '#e8c060'); } }
      }
    }
    for (const e of this.eyes) {
      const i = L.inb(e.x, e.y) ? L.i(e.x, e.y) : -1;
      if (i < 0 || Light.bright[i] > 0.25) continue;
      const blink = e.age % 1600 < 120;
      if (blink) continue;
      const sx = e.x * TILE - camX + 5, sy = e.y * TILE - camY + 6;
      const a = Math.min(1, e.age / 600, (e.life - e.age) / 600);
      px(c, sx, sy, rgba('#d02010', a)); px(c, sx + 4, sy, rgba('#d02010', a));
    }
    // the player's torch
    if (p.lit && L.depth > 0) {
      const off = { down: [12, 7], up: [3, 6], left: [3, 8], right: [12, 8] }[p.dir];
      const fx = psx + off[0], fy = psy + off[1];
      if (p.dir !== 'up') { px(c, fx, fy, '#5a3a20', 1, 4); }
      drawFlame(c, fx + 0.5, fy, t, 0.9, 7);
    }
    for (const q of this.particles) {
      if (!q.above) continue;
      const a = 1 - q.age / q.life;
      px(c, q.x - camX, q.y - camY, q.glow ? rgba(q.col, a) : rgba(q.col, a * 0.8), q.size, q.size);
    }
    if (this.flash > 0) { c.fillStyle = `rgba(200,30,20,${this.flash * 0.35})`; c.fillRect(0, 0, VW, VH); }
  }

  monsterVisible(e) {
    const L = this.L, p = this.p;
    if (!Light.visible(L, e.x, e.y, 0.14)) return false;
    const def = MONSTERS[e.mids[0]];
    if (def.stealth && !e.phantom) return Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 2;
    return true;
  }

  drawTile(c, L, ts, tile, tx, ty, sx, sy, f3) {
    const v = Math.floor(hash2(tx, ty, L.depth) * 4);
    if (wallLike(tile)) {
      if (tile === T.VOID) { c.fillStyle = '#000'; c.fillRect(sx, sy, TILE, TILE); return; }
      const below = L.get(tx, ty + 1);
      if (tile === T.DOOR) return c.drawImage(ts.door, sx, sy);
      if (tile === T.DOOR_OPEN) return c.drawImage(ts.doorOpen, sx, sy);
      if (tile === T.ENTRANCE) return c.drawImage(ts.entrance, sx, sy);
      if (!wallLike(below)) {
        const faces = tile === T.STONE && ts.stoneFace ? ts.stoneFace : ts.face;
        c.drawImage(faces[v % faces.length], sx, sy);
      } else {
        c.drawImage(ts.top, sx, sy);
        c.fillStyle = ts.th.topRim;
        if (!wallLike(L.get(tx - 1, ty))) c.fillRect(sx, sy, 1, TILE);
        if (!wallLike(L.get(tx + 1, ty))) c.fillRect(sx + TILE - 1, sy, 1, TILE);
        if (!wallLike(L.get(tx, ty - 1))) c.fillRect(sx, sy, TILE, 1);
      }
      return;
    }
    switch (tile) {
      case T.WATER: c.drawImage(ts.water[(f3 + tx) % 3], sx, sy); break;
      case T.LAVA: c.drawImage(ts.lava[(f3 + tx + ty) % 3], sx, sy); break;
      case T.ROAD: c.drawImage(ts.road ? ts.road[v % 2] : ts.floor[v], sx, sy); break;
      case T.DOWN: c.drawImage(ts.down, sx, sy); break;
      case T.UP: c.drawImage(ts.up, sx, sy); break;
      case T.SURFACE: c.drawImage(ts.surface, sx, sy); break;
      case T.RUBBLE: c.drawImage(ts.rubble[v % 2], sx, sy); break;
      case T.BRIDGE: c.drawImage(ts.bridge, sx, sy); break;
      case T.FENCE: c.drawImage(ts.fence, sx, sy); break;
      case T.CRYPT: c.drawImage(G.flags.crypt ? ts.crypt : ts.cryptBarred, sx, sy); break;
      case T.FISSURE: c.drawImage(ts.fissure, sx, sy); break;
      default: c.drawImage(ts.floor[v], sx, sy);
    }
    if (tile !== T.WATER && tile !== T.LAVA) {
      if (wallLike(L.get(tx, ty - 1)) && L.get(tx, ty - 1) !== T.DOOR_OPEN) {
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(sx, sy, TILE, 3);
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(sx, sy + 3, TILE, 2);
      }
      if (wallLike(L.get(tx - 1, ty))) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(sx, sy, 2, TILE); }
    }
  }

  drawEntity(c, e, sx, sy, t) {
    const bottom = (spr, dy = 0) => c.drawImage(spr, Math.round(sx + 8 - spr.width / 2), Math.round(sy + 16 - spr.height + dy));
    switch (e.kind) {
      case 'chest': { const s = ObjSprites.get(e.open ? 'chestOpen' : 'chest'); bottom(s, -1); if (e.ornate && !e.open) { px(c, sx + 4, sy + 6, '#e8c060', 8, 1); } break; }
      case 'barrel': bottom(ObjSprites.get(e.broken ? 'barrelBroken' : 'barrel'), -1); break;
      case 'corpse': bottom(ObjSprites.get('corpse' + (e.variant || 0)), -2); break;
      case 'bones': bottom(ObjSprites.get('bones'), -2); break;
      case 'gold': bottom(ObjSprites.get(e.amount >= 40 ? 'goldLarge' : 'goldSmall'), -3); break;
      case 'sack': bottom(ObjSprites.get(e.mushrooms ? 'mushrooms' : e.soulstone ? 'soulstone' : 'sack'), -2); break;
      case 'shrine': bottom(ObjSprites.get('shrine')); if (!e.used) px(c, sx + 7, sy - 1 + Math.sin(t / 300) * 1, '#a070e0', 2, 2); break;
      case 'altar': bottom(ObjSprites.get('altar')); break;
      case 'note': bottom(ObjSprites.get('note'), -3); break;
      case 'sarc': bottom(ObjSprites.get(e.open ? 'sarcophagusOpen' : 'sarcophagus')); break;
      case 'decor': { const s = ObjSprites.get(e.sprite); if (s) bottom(s, e.sprite === 'hanging' ? -4 : 0); break; }
      case 'sconce': c.drawImage(ObjSprites.get('sconce'), sx + 4, sy + 4); break;
      case 'campfire': {
        c.fillStyle = '#3a3634'; for (const [ox, oy] of [[2, 12], [6, 14], [10, 14], [13, 12], [4, 10], [12, 9]]) c.fillRect(sx + ox, sy + oy, 2, 2);
        c.fillStyle = '#4a2e18'; c.fillRect(sx + 4, sy + 11, 9, 2); c.fillStyle = '#3a2210'; c.fillRect(sx + 5, sy + 9, 2, 5); c.fillRect(sx + 9, sy + 9, 2, 5);
        break;
      }
      case 'bedroll': bottom(ObjSprites.get('bedroll'), -2); break;
      case 'well': bottom(ObjSprites.get('well')); break;
      case 'npc': bottom(CharSprites.npc(e.npc), Math.sin(t / 700 + e.id) > 0.6 ? -1 : 0); break;
      case 'rack': bottom(ObjSprites.get('rack')); break;
      case 'sign': bottom(ObjSprites.get('sign')); break;
      case 'crow': c.drawImage(ObjSprites.get('crow'), sx + 4, sy + 9 - (Math.sin(t / 400 + e.id * 2) > 0.8 ? 1 : 0)); break;
      case 'gharbad': { const fr = CharSprites.monster('humanoid', 'gharbad', MONSTERS.gharbad.map.pal); bottom(fr[0], Math.floor(t / 300) % 2); break; }
      case 'monster': {
        const def = MONSTERS[e.mids[0]];
        const fr = CharSprites.monster(def.map.family, def.id, def.map.pal);
        const flap = Math.floor(t / 180) % 2;
        let spr = def.map.family === 'flyer' ? fr[flap] : fr[0];
        const bob = (Clock.t - (e.animT || 0) < 150) ? -1 : (Math.floor(t / 500 + e.id) % 2 ? 0 : -1);
        if (def.map.family === 'beast' && e.face === 1) spr = CharSprites.flipped(spr);
        let alpha = 1;
        if (e.phantom) alpha = 0.45 + Math.sin(t / 90) * 0.15;
        if (def.stealth) alpha = 0.55;
        c.globalAlpha = alpha;
        bottom(spr, bob + (def.map.family === 'flyer' ? -4 + Math.round(Math.sin(t / 200)) : 0));
        c.globalAlpha = 1;
        if (e.stunUntil && Clock.t < e.stunUntil) px(c, sx + 6 + Math.sin(t / 100) * 3, sy - 4, '#e8e0a0');
        break;
      }
    }
  }

  drawPortal(c, sx, sy, t) {
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + t / 300;
      const r = 5 + Math.sin(t / 200 + i) * 1;
      px(c, sx + 8 + Math.cos(a) * r * 0.7, sy + 6 + Math.sin(a) * r, i % 2 ? '#ff4030' : '#ff9a60');
    }
    c.fillStyle = 'rgba(120,10,10,0.6)';
    c.fillRect(sx + 6, sy + 2, 4, 9);
  }

  // HUD in UI space.
  drawHUD(ctx) {
    const p = this.p, L = this.L;
    const x = 16, y = 16;
    ctx.fillStyle = 'rgba(6,4,6,0.6)';
    ctx.fillRect(x, y, 268, p.lit && L.depth > 0 ? 92 : 74);
    const bar = (yy, label, frac, col, txt) => {
      drawText(ctx, label, x + 10, yy + 12, { size: 17, color: TCOL.d });
      drawBar(ctx, x + 62, yy, 130, 10, frac, col);
      if (txt) drawText(ctx, txt, x + 200, yy + 12, { size: 17, color: TCOL.d });
    };
    bar(y + 10, 'Life', p.hp / p.maxHp, '#b8301e', `${p.hp}`);
    bar(y + 28, 'Mind', p.mind / p.maxMind, '#4a6ac8', `${p.mind}`);
    const [hl, hc] = hungerLabel(p);
    bar(y + 46, 'Food', p.food / p.maxFood, '#a07a3a', hl);
    if (p.lit && L.depth > 0) bar(y + 64, 'Torch', p.torch / 240, '#e0a040', '');
    // conditions
    const cond = [];
    if (p.bleed) cond.push(['Bleeding' + (p.bleed > 1 ? ' ×' + p.bleed : ''), TCOL.r]);
    if (p.infection) cond.push(['Infected', TCOL.v]);
    if (p.poison) cond.push(['Poisoned', TCOL.v]);
    for (const k of BODY) if (p.body[k] === 'broken') cond.push([`Broken ${BODY_NAME[k]}`, TCOL.o]);
    for (const k of BODY) if (p.body[k] === 'lost') cond.push([`No ${BODY_NAME[k]}`, TCOL.r]);
    if (!p.lit && L.depth > 0) cond.push(['In the dark', TCOL.d]);
    let cx = x;
    const cy = y + (p.lit && L.depth > 0 ? 112 : 94);
    for (const [txt, col] of cond) {
      setFont(ctx, 17);
      const w = ctx.measureText(txt).width + 16;
      if (cx + w > UW - 200) break;
      ctx.fillStyle = 'rgba(6,4,6,0.6)'; ctx.fillRect(cx, cy, w, 24);
      drawText(ctx, txt, cx + 8, cy + 18, { size: 17, color: col });
      cx += w + 6;
    }
    // location and purse
    ctx.fillStyle = 'rgba(6,4,6,0.6)';
    ctx.fillRect(UW - 276, 16, 260, 56);
    drawText(ctx, L.depth === 0 ? 'Tristram' : `${THEMES[L.theme].title} ${L.depth}`, UW - 26, 40, { size: 20, align: 'right', color: '#cdbfa6', family: FONT_T });
    drawText(ctx, `${p.gold} gold`, UW - 26, 63, { size: 18, align: 'right', color: TCOL.g });
    if (this.showMap) this.drawAutomap(ctx);
  }

  drawAutomap(ctx) {
    const L = this.L, p = this.p;
    const S = 10;
    const ox = UW / 2 - (this.rx / TILE + 0.5) * S, oy = UH / 2 - (this.ry / TILE + 0.5) * S;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, UW, UH);
    ctx.strokeStyle = 'rgba(200,170,120,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = L.i(x, y);
      if (!L.explored[i]) continue;
      const t = L.tiles[i];
      if (wallLike(t) && t !== T.DOOR && t !== T.DOOR_OPEN && t !== T.ENTRANCE) continue;
      const X = ox + x * S, Y = oy + y * S;
      if (X < -S || Y < -S || X > UW + S || Y > UH + S) continue;
      if (wallLike(L.get(x - 1, y))) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + S); }
      if (wallLike(L.get(x + 1, y))) { ctx.moveTo(X + S, Y); ctx.lineTo(X + S, Y + S); }
      if (wallLike(L.get(x, y - 1))) { ctx.moveTo(X, Y); ctx.lineTo(X + S, Y); }
      if (wallLike(L.get(x, y + 1))) { ctx.moveTo(X, Y + S); ctx.lineTo(X + S, Y + S); }
    }
    ctx.stroke();
    const mark = (x, y, col, r = 3) => { ctx.fillStyle = col; ctx.fillRect(ox + x * S + S / 2 - r, oy + y * S + S / 2 - r, r * 2, r * 2); };
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = L.i(x, y);
      if (!L.explored[i]) continue;
      const t = L.tiles[i];
      if (t === T.DOWN) mark(x, y, '#e04030', 4);
      else if (t === T.UP || t === T.SURFACE) mark(x, y, '#50a0e0', 4);
      else if (t === T.DOOR || t === T.DOOR_OPEN) mark(x, y, '#a06030', 2);
      else if (t === T.WATER) mark(x, y, 'rgba(60,110,140,0.6)', 3);
      else if (t === T.LAVA) mark(x, y, 'rgba(220,90,30,0.7)', 3);
      else if (t === T.ENTRANCE || t === T.CRYPT || t === T.FISSURE) mark(x, y, '#e04030', 4);
    }
    for (const e of L.ents) {
      if (!L.explored[L.i(e.x, e.y)]) continue;
      if (e.kind === 'altar' || e.kind === 'campfire') mark(e.x, e.y, '#e8c060', 3);
      else if (e.kind === 'shrine' && !e.used) mark(e.x, e.y, '#a070e0', 3);
      else if (e.kind === 'npc' || e.kind === 'well') mark(e.x, e.y, '#c8c0a0', 3);
      else if (e.kind === 'portal') mark(e.x, e.y, '#ff4030', 4);
    }
    if (Math.floor(Clock.t / 300) % 2) mark(p.x, p.y, '#ffffff', 3);
    drawText(ctx, L.name, UW / 2, UH - 28, { size: 22, align: 'center', color: '#cdbfa6' });
  }
}

function listItems(ids) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  return joinList(Object.keys(counts).map(id => {
    const it = ITEMS[id];
    const name = counts[id] > 1 ? `${counts[id]} × ${it.name}` : it.name;
    return it.type === 'treasure' ? `{g}${name}{/}` : it.unique ? `{o}${name}{/}` : name;
  }));
}
function joinList(a) {
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
