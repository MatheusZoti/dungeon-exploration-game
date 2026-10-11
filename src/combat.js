'use strict';
// Turn-based, front-view combat with body-part targeting.

const BG_CACHE = {};
function combatBackground(theme) {
  if (BG_CACHE[theme]) return BG_CACHE[theme];
  const c = makeCanvas(VW, VH);
  const x = c.ctx;
  const ts = Tiles.get(theme === 'town' ? 'cathedral' : theme);
  const rng = new RNG(theme.length * 99);
  x.fillStyle = '#000'; x.fillRect(0, 0, VW, VH);
  // back wall
  for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 20; tx++) {
    x.drawImage(ts.face[(tx * 7 + ty * 3) % ts.face.length], tx * 16, ty * 16 - 8);
  }
  // pillars
  if (theme !== 'caves') {
    for (const cx of [36, 284]) {
      const g = x.createLinearGradient(cx - 14, 0, cx + 14, 0);
      g.addColorStop(0, '#000'); g.addColorStop(0.5, shade(ts.th.wall, 0.08)); g.addColorStop(1, '#000');
      x.fillStyle = g; x.fillRect(cx - 14, 0, 28, 124);
    }
  }
  // floor
  for (let ty = 0; ty < 9; ty++) for (let tx = 0; tx < 20; tx++) {
    x.drawImage(ts.floor[(tx + ty * 3 + rng.int(0, 3)) % 4], tx * 16, 112 + ty * 16);
  }
  const g = x.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.42, 'rgba(0,0,0,0.35)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.62, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0.9)');
  x.fillStyle = g; x.fillRect(0, 0, VW, VH);
  const v = x.createRadialGradient(VW / 2, 120, 40, VW / 2, 120, 220);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
  x.fillStyle = v; x.fillRect(0, 0, VW, VH);
  if (theme === 'hell') { x.fillStyle = 'rgba(120,20,0,0.18)'; x.fillRect(0, 0, VW, VH); }
  if (theme === 'caves') { x.fillStyle = 'rgba(40,20,0,0.15)'; x.fillRect(0, 0, VW, VH); }
  return (BG_CACHE[theme] = c);
}

function newFoe(id, depth) {
  const def = MONSTERS[id];
  const sc = monsterScale(id, depth);
  const parts = {};
  for (const k of PART_ORDER) {
    if (!def.parts[k]) continue;
    const m = Math.max(1, Math.round(def.parts[k] * sc));
    parts[k] = { hp: m, max: m, gone: false };
  }
  return { id, parts, bleed: 0, alive: true, sc };
}

const P_TARGET = [['torso', 32], ['head', 10], ['rarm', 14], ['larm', 14], ['rleg', 15], ['lleg', 15]];

class Combat {
  constructor(ent, ambush) {
    this.ent = ent;
    this.ambush = ambush;
    this.depth = G.depth;
    this.theme = themeForDepth(this.depth);
    if (!ent.cstate) ent.cstate = ent.mids.map(id => newFoe(id, this.depth));
    this.foes = ent.cstate.filter(f => f.alive && !f.fled).map(f => Object.assign(f, { view: { flash: 0, flashPart: null, shake: 0, lunge: 0, dying: 0 } }));
    this.state = 'busy';
    this.cmd = 0; this.tsel = 0; this.psel = 0; this.isel = 0; this.fsel = 0;
    this.log = [];
    this.particles = [];
    this.floaters = [];
    this.round = 0;
    this.guard = false;
    this.age = 0;
    this.pending = null;
    this.msg = null;
    this.redFlash = 0;
    this.slash = null;
    this.layout();
  }
  get p() { return G.p; }
  def(f) { return MONSTERS[f.id]; }
  sprite(f) { return monsterSprite(f.id); }
  living() { return this.foes.filter(f => f.alive && !f.fled); }

  layout() {
    const live = this.foes.filter(f => f.alive && !f.fled || f.view.dying > 0);
    const n = live.length;
    const slots = { 1: [160], 2: [104, 216], 3: [62, 160, 258], 4: [48, 122, 198, 272] }[Math.min(4, n)] || [160];
    live.forEach((f, i) => { f.view.tx = slots[Math.min(i, slots.length - 1)]; if (f.view.x == null) f.view.x = f.view.tx; });
  }

  // ---------------------------------------------------------------- flow
  async run() {
    Sound.setTheme('combat');
    await this.intro();
    if (this.ambush) {
      await this.say('{r}They are on you before you can react!{/}');
      await this.enemyTurn();
      if (isDead(this.p)) return this.lose();
      await this.endRound();
      if (isDead(this.p)) return this.lose();
    }
    for (;;) {
      if (!this.living().length) return this.victory();
      this.guard = false;
      const p = this.p;
      let acted = false;
      if (p.dazed) {
        p.dazed = false;
        await this.say('{d}You are too dazed to act.{/}');
        acted = true;
      } else if (p.mind < 20 && R.chance(0.2)) {
        await this.say('{p}Terror locks your limbs. You cannot make yourself move.{/}');
        acted = true;
      }
      if (!acted) {
        const act = await this.playerInput();
        const r = await this.doPlayer(act);
        if (r) return r;
        if (act.type === 'none') continue;
      }
      if (!this.living().length) return this.victory();
      await this.enemyTurn();
      if (isDead(this.p)) return this.lose();
      await this.endRound();
      if (isDead(this.p)) return this.lose();
    }
  }

  async intro() {
    const p = this.p;
    const lead = this.def(this.foes[0]);
    const names = {};
    for (const f of this.foes) names[f.id] = (names[f.id] || 0) + 1;
    let horror = 0;
    for (const id in names) if (!p.seen[id]) { p.seen[id] = 1; horror += MONSTERS[id].horror; }
    if (this.ent.introDone) {
      await this.say(this.foeListText() + ' blocks your way.');
    } else if (lead.unique || horror) {
      await this.say(lead.intro, 1800);
    } else {
      await this.say(this.foeListText() + (this.foes.length > 1 ? ' attack!' : ' attacks!'));
    }
    this.ent.introDone = true;
    if (horror) {
      shakeMind(p, horror);
      await this.say(`{p}The sight of it shakes you to the core.{/} {b}(-${horror} mind){/}`);
    }
  }
  foeListText() {
    const names = {};
    for (const f of this.living()) { const n = this.def(f).name; names[n] = (names[n] || 0) + 1; }
    const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
    const parts = Object.keys(names).map(n => {
      if (names[n] > 1) return `${NUM[names[n]] || names[n]} ${n.endsWith('s') ? n : n.replace(/Demon$/, 'Demons').replace(/(?<!Demons)$/, 's')}`;
      if (/^The /.test(n) || / the /.test(n) || n === 'Diablo') return n;
      return (/^[AEIOU]/.test(n) ? 'an ' : 'a ') + n;
    });
    const s = joinList(parts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  say(text, ms = 1100) {
    this.log.push({ text, age: 0 });
    if (this.log.length > 3) this.log.shift();
    return new Promise(res => { this.msg = { res, t: ms, min: 160 }; });
  }

  playerInput() {
    this.state = 'command';
    return new Promise(res => { this.pending = res; });
  }
  submit(act) {
    const r = this.pending;
    this.pending = null;
    this.state = 'busy';
    Sound.play('ok');
    r(act);
  }

  async doPlayer(act) {
    const p = this.p;
    if (act.type === 'attack') return this.attack(act.foe, act.part);
    if (act.type === 'guard') {
      this.guard = true;
      await this.say('You raise your guard and brace yourself.');
      return null;
    }
    if (act.type === 'item') {
      const used = await useItem(p, act.id, 'combat');
      if (!used) act.type = 'none';
      return null;
    }
    if (act.type === 'flee') return this.flee(act.purse);
    return null;
  }

  // ---------------------------------------------------------------- player attack
  hitChance(f, k) {
    const def = this.def(f), prof = attackProfile(this.p);
    let c = PART_INFO[k].hit + prof.acc;
    if (k === 'head' && def.headMod) c += def.headMod;
    const mobile = mobileFoe(f);
    let ev = def.evade + (f.faded ? 30 : 0) + (f.blink ? 40 : 0);
    if (mobile) c -= ev; else c += 15;
    if (f.grabbing) c += 10;
    return clamp(Math.round(c), 5, 95);
  }

  async attack(f, k) {
    const p = this.p, def = this.def(f), prof = attackProfile(p);
    const part = f.parts[k];
    const chance = this.hitChance(f, k);
    const pname = PART_INFO[k].name;
    this.slash = { f, age: 0 };
    await wait(140);
    if (!R.chance(chance / 100)) {
      Sound.play('miss');
      await this.say(`You ${prof.kick ? 'kick' : 'swing'} at ${the(def)}'s ${pname}, but it ${f.faded ? 'is not where you thought' : 'twists away'}.`, 900);
      return null;
    }
    let dmg = R.int(prof.dmg[0], prof.dmg[1]) * prof.mult;
    const limb = k === 'rarm' || k === 'larm' || k === 'legs' || k === 'wings';
    if (prof.kind === 'slash' && limb) dmg *= 1.25;
    if (prof.kind === 'blunt' && k === 'head') dmg *= 1.3;
    if (prof.kind === 'pierce' && k === 'torso') dmg *= 1.2;
    if (def.skeletal) dmg *= prof.kind === 'blunt' ? 1.5 : prof.kind === 'slash' ? 0.8 : 0.6;
    const crit = R.chance(0.08);
    if (crit) dmg *= 1.8;
    dmg = Math.max(1, Math.round(dmg - def.def));
    let severed = false;
    if (limb && prof.kind === 'slash' && prof.sever && R.chance(prof.sever / 100)) { dmg = Math.max(dmg, part.hp); severed = true; }
    part.hp -= dmg;
    f.view.flash = 1; f.view.flashPart = k; f.view.shake = 1;
    this.bleedFx(f, k, crit ? 26 : 12);
    this.floater(f, k, String(dmg), crit ? '#ffd060' : '#ffffff');
    Sound.play(crit ? 'heavy' : 'hit');
    let txt = `${crit ? '{y}A brutal blow!{/} ' : ''}You ${prof.kick ? 'kick' : 'hit'} ${the(def)}'s ${pname}. {w}${dmg} damage.{/}`;
    if (part.hp <= 0) {
      await this.say(txt, 700);
      await this.destroyPart(f, k, severed);
    } else {
      await this.say(txt, 900);
    }
    return null;
  }

  async destroyPart(f, k, severed) {
    const def = this.def(f), part = f.parts[k];
    part.gone = true; part.hp = 0;
    if (k === 'head' || k === 'torso') {
      Sound.play('sever');
      this.bleedFx(f, k, 40);
      const how = k === 'head'
        ? (def.skeletal ? `${The(def)}'s skull shatters.` : `{r}You take ${the(def)}'s head off.{/}`)
        : `{r}You open ${the(def)} up.{/}`;
      await this.say(how, 900);
      await this.kill(f);
      return;
    }
    Sound.play('sever');
    this.bleedFx(f, k, 30);
    if (!def.bloodless) f.bleed += 2;
    if (k === 'legs') { await this.say(`{o}${The(def)}'s legs give out.{/} It collapses to the floor.`); }
    else if (k === 'wings') { await this.say(`{o}You tear through ${the(def)}'s wings.{/} It crashes to the ground.`); }
    else {
      const verb = severed || ITEMS[this.p.weapon].kind === 'slash' ? 'sever' : 'shatter';
      await this.say(`{o}You ${verb} ${the(def)}'s ${PART_INFO[k].name}!{/}${def.bloodless ? '' : ' It bleeds heavily.'}`);
      if (f.grabbing && k === 'larm') { f.grabbing = false; await this.say('Its grip on you goes slack. You are free.'); }
    }
  }

  async kill(f, quiet) {
    const def = this.def(f);
    f.alive = false;
    f.view.dying = 0.001;
    this.p.kills++;
    if (def.id === 'butcher') G.flags.butcherDead = true;
    if (def.id === 'leoric') G.flags.leoricDead = true;
    if (def.id === 'diablo') G.flags.diabloDead = true;
    if (!quiet) await this.say(def.dies, 1000);
    for (const o of this.living()) {
      const od = this.def(o);
      if (od.special === 'cowardly' && R.chance(0.55)) {
        o.fled = true;
        o.view.dying = 0.001; o.view.fleeing = true;
        await this.say(`${The(od)} shrieks in panic and scurries off into the dark!`, 900);
      }
    }
  }

  // ---------------------------------------------------------------- enemies
  async enemyTurn() {
    this.round++;
    for (const f of this.living()) {
      if (isDead(this.p)) return;
      if (!f.alive || f.fled) continue;
      const def = this.def(f);
      f.blink = false;
      if (def.special === 'fade') {
        const was = f.faded;
        f.faded = R.chance(0.45);
        if (f.faded && !was) await this.say(`${The(def)} flickers and fades out of sight.`, 800);
      }
      if (def.special === 'blink' && R.chance(0.3)) {
        f.blink = true;
        await this.say(`${The(def)} folds through the air and reappears to one side.`, 800);
        continue;
      }
      if (def.special === 'raise' && this.round % 3 === 0 && this.living().length < 4) {
        const n = newFoe('skeleton', this.depth);
        n.view = { flash: 1, flashPart: 'torso', shake: 0, lunge: 0, dying: 0 };
        this.foes.push(n);
        this.ent.cstate.push(n);
        this.ent.mids.push('skeleton');
        this.layout();
        Sound.play('growl');
        await this.say(`${The(def)} raises his hand. {r}Bones rattle together and stand up.{/}`);
        continue;
      }
      if (f.grabbing) {
        f.grabbing = false;
        await this.execute(f);
        continue;
      }
      const avail = def.attacks.filter(a => !f.parts[a.uses] || !f.parts[a.uses].gone);
      if (!avail.length) {
        await this.say(`${The(def)} thrashes, but it has nothing left to hurt you with.`, 800);
        continue;
      }
      await this.enemyAttack(f, R.pick(avail));
    }
  }

  // The Butcher's execution: a coin flip for your life.
  async execute(f) {
    const p = this.p, def = this.def(f);
    await this.say(`{r}${The(def)} raises the cleaver over you.{/}`, 900);
    const ok = await UI.coinFlip('He lifts you by the throat', 'You twist free', 'The cleaver falls');
    if (ok) { await this.say('You kick, twist and tear free. The cleaver bites into the floor where your neck was.'); return; }
    const dmg = R.int(14, 22);
    hurt(p, dmg, 'killed by ' + def.name);
    this.hurtFx();
    const limbs = BODY.filter(b => b !== 'head' && b !== 'torso' && p.body[b] !== 'lost');
    let extra = '';
    if (limbs.length && R.chance(0.5)) {
      const k = R.pick(limbs);
      p.body[k] = 'lost'; p.bleed = 3; shakeMind(p, 18);
      extra = ` {r}He takes your ${BODY_NAME[k]} off at the joint.{/}`;
    }
    Sound.play('sever');
    await this.say(`The cleaver comes down. {r}${dmg} damage.{/}${extra}`, 1400);
  }

  async enemyAttack(f, a) {
    const p = this.p, def = this.def(f);
    f.view.lunge = 1;
    await wait(220);
    let chance = a.hit - 4 - (this.guard ? 22 : 0);
    if (!R.chance(chance / 100)) {
      Sound.play('miss');
      await this.say(a.noPart ? `${The(def)} tries something, but you shut it out.` : `${The(def)} lunges at you, but you twist away.`, 800);
      return;
    }
    const dscale = 1 + (f.sc - 1) * 0.6;
    if (a.noPart) {
      const dmg = a.dmg[1] ? Math.round(R.int(a.dmg[0], a.dmg[1]) * dscale) : 0;
      if (dmg) { hurt(p, dmg, 'killed by ' + def.name); this.hurtFx(); }
      shakeMind(p, a.mind || 0, def.name);
      Sound.play('shriek');
      await this.say(`${a.text} {b}(-${a.mind} mind){/}${dmg ? ` {r}${dmg} damage.{/}` : ''}`, 1300);
      return;
    }
    const alive = P_TARGET.filter(([k]) => p.body[k] !== 'lost');
    const part = R.weighted(alive);
    let dmg = Math.round(R.int(a.dmg[0], a.dmg[1]) * dscale) - defense(p);
    dmg = Math.max(1, dmg);
    if (this.guard) dmg = Math.ceil(dmg / 2);
    hurt(p, dmg, 'killed by ' + def.name);
    this.hurtFx();
    const eff = this.guard ? Object.assign({}, a, { sever: (a.sever || 0) / 2, brk: (a.brk || 0) / 2, bleed: (a.bleed || 0) * 0.6 }) : a;
    const msgs = injure(p, part, eff, def.name);
    if (a.mind) shakeMind(p, a.mind, def.name);
    if (a.grab) { f.grabbing = true; msgs.push('{r}He lifts you off your feet by the throat.{/}'); }
    Sound.play(msgs.some(m => m.includes('gone')) ? 'sever' : 'hurt');
    await this.say(`${The(def)} ${a.verb} your ${BODY_NAME[part]}! {r}${dmg} damage.{/}${a.mind ? ` {b}(-${a.mind} mind){/}` : ''} ${msgs.join(' ')}`, 1300);
  }

  async endRound() {
    const p = this.p;
    for (const f of this.living()) {
      if (!f.bleed) continue;
      const tor = f.parts.torso;
      tor.hp -= f.bleed;
      if (tor.hp <= 0) {
        tor.hp = 0;
        await this.say(`${The(this.def(f))} bleeds out.`, 800);
        await this.kill(f, true);
      }
    }
    if (p.bleed && this.round % 2 === 0) { hurt(p, p.bleed, 'bled'); await this.say(`{r}You lose blood. (${p.bleed}){/}`, 700); }
    if (p.poison > 0) { p.poison = Math.max(0, p.poison - 4); hurt(p, 1, 'poison'); }
  }

  // ---------------------------------------------------------------- endings
  fleeOdds() {
    const p = this.p;
    if (this.living().some(f => f.grabbing)) return 0;
    const live = this.living();
    const canChase = live.filter(mobileFoe);
    if (!canChase.length) return 100;
    let c = fleeChance(p);
    if (canChase.some(f => this.def(f).speed < 450)) c -= 10;
    if (canChase.some(f => this.def(f).unique)) c -= 10;
    return clamp(c, 5, 95);
  }

  async flee(purse) {
    const p = this.p;
    if (this.living().some(f => f.grabbing)) {
      await this.say('{r}You cannot run. He has you by the throat.{/}');
      return null;
    }
    if (purse) {
      const dropped = p.gold;
      p.gold = 0;
      Sound.play('coin');
      await this.say(`You hurl your purse away. {g}${dropped} gold{/} scatters across the floor, and you run.`);
      return this.finish({ outcome: 'purse', dropped, crippled: this.allCrippled() });
    }
    const odds = this.fleeOdds();
    if (R.chance(odds / 100)) {
      Sound.play('miss');
      await this.say('You turn and run.', 700);
      return this.finish({ outcome: 'fled', crippled: this.allCrippled() });
    }
    await this.say('{r}You try to run, but they cut you off.{/}');
    return null;
  }
  allCrippled() { return this.living().every(f => !mobileFoe(f)); }

  async victory() {
    const p = this.p;
    let gold = 0;
    const items = [];
    let carve = null, soulstone = false;
    for (const f of this.foes) {
      if (f.alive || f.fled) continue;
      const def = this.def(f);
      gold += Math.round(R.int(def.gold[0], def.gold[1]) * (1 + this.depth * 0.15));
      if (def.drop) items.push(...def.drop);
      if (!def.unique && R.chance(0.2)) items.push(R.weighted(LOOT.common));
      if (!def.unique && R.chance(0.06)) items.push(R.weighted(LOOT.treasure[this.theme] || LOOT.treasure.cathedral));
      if (def.carve === 'meat') carve = 'meat';
      else if (def.carve === 'flesh' && !carve) carve = 'flesh';
      if (def.id === 'diablo') soulstone = true;
    }
    await wait(500);
    return this.finish({ outcome: 'win', gold, items, carve, soulstone });
  }
  async lose() {
    await wait(600);
    return this.finish({ outcome: 'dead' });
  }
  finish(r) {
    // Keep the survivors' wounds on the map entity.
    this.ent.cstate = this.ent.cstate.filter(f => f.alive && !f.fled);
    this.ent.mids = this.ent.cstate.map(f => f.id);
    for (const f of this.ent.cstate) delete f.view;
    return r;
  }

  // ---------------------------------------------------------------- effects
  hurtFx() { this.redFlash = 1; Game.shake = 1; }
  partCenter(f, k) {
    const s = this.sprite(f);
    const b = s.bounds[k] || s.bounds.torso;
    const base = this.baseXY(f, s);
    return [base[0] + b.cx, base[1] + b.cy];
  }
  baseXY(f, s) {
    const v = f.view;
    let x = v.x - s.w / 2, y = 152 - s.ground;
    const grounded = s.flyer ? (f.parts.wings && f.parts.wings.gone) : (f.parts.legs && f.parts.legs.gone);
    if (grounded) y += s.drop;
    else if (s.flyer) y += Math.sin(this.age / 300 + v.x) * 3 - 6;
    else y += Math.sin(this.age / 600 + v.x) > 0.3 ? -1 : 0;
    y += v.lunge * 7;
    if (v.shake) x += Math.round(R.range(-2, 2) * v.shake);
    return [Math.round(x), Math.round(y)];
  }
  bleedFx(f, k, n) {
    if (this.def(f).bloodless && k !== 'head') n = Math.floor(n / 3);
    const [cx, cy] = this.partCenter(f, k);
    const bone = this.def(f).bloodless;
    for (let i = 0; i < n; i++) {
      this.particles.push({ x: cx + R.range(-3, 3), y: cy + R.range(-3, 3), vx: R.range(-0.08, 0.08), vy: R.range(-0.12, 0.02), life: R.int(400, 900), age: 0, col: bone ? R.pick(['#d8d0b8', '#8a8270']) : R.pick(['#8a1410', '#b01c14', '#5a0a08']) });
    }
  }
  floater(f, k, text, col) {
    const [cx, cy] = this.partCenter(f, k);
    this.floaters.push({ x: cx * US, y: cy * US, text, col, age: 0 });
  }

  // ---------------------------------------------------------------- update / input
  update(dt) {
    this.age += dt;
    for (const q of this.particles) { q.age += dt; q.vy += 0.0004 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    this.particles = this.particles.filter(q => q.age < q.life && q.y < 200);
    for (const fl of this.floaters) fl.age += dt;
    this.floaters = this.floaters.filter(fl => fl.age < 1000);
    for (const l of this.log) l.age += dt;
    if (this.redFlash > 0) this.redFlash = Math.max(0, this.redFlash - dt / 350);
    if (this.slash) { this.slash.age += dt; if (this.slash.age > 260) this.slash = null; }
    for (const f of this.foes) {
      const v = f.view;
      if (!v) continue;
      if (v.flash > 0) v.flash = Math.max(0, v.flash - dt / 260);
      if (v.shake > 0) v.shake = Math.max(0, v.shake - dt / 250);
      if (v.lunge > 0) v.lunge = Math.max(0, v.lunge - dt / 380);
      if (v.dying > 0 && v.dying < 1) v.dying = Math.min(1, v.dying + dt / 900);
      if (v.tx != null) v.x += (v.tx - v.x) * Math.min(1, dt / 200);
    }
    // blood drips from stumps
    if (R.chance(dt * 0.01)) {
      for (const f of this.living()) {
        const def = this.def(f);
        if (def.bloodless) continue;
        for (const k of ['rarm', 'larm']) if (f.parts[k] && f.parts[k].gone) {
          const s = this.sprite(f), j = s.joints[k], b = this.baseXY(f, s);
          this.particles.push({ x: b[0] + j[0], y: b[1] + j[1] + 1, vx: 0, vy: 0.01, life: 900, age: 0, col: '#8a1410' });
        }
      }
    }
    if (this.msg) {
      this.msg.t -= dt * (Input.isHeld('fast') ? 3 : 1);
      this.msg.min -= dt;
      if (this.msg.t <= 0 || (this.msg.min <= 0 && Input.pressed('ok'))) { const r = this.msg.res; this.msg = null; r(); }
      return;
    }
    if (UI.busy() || !this.pending) return;
    this.handleInput();
  }

  usableItems() {
    const out = [];
    for (const s of this.p.inv) {
      const it = ITEMS[s.id];
      if (['food', 'potion', 'medicine', 'light'].includes(it.type) && !out.some(o => o.id === s.id)) out.push({ id: s.id, qty: itemCount(this.p, s.id) });
    }
    return out;
  }
  partsOf(f) { return PART_ORDER.filter(k => f.parts[k] && !f.parts[k].gone); }

  handleInput() {
    const st = this.state;
    const live = this.living();
    if (st === 'command') {
      if (Input.nav('up')) { this.cmd = (this.cmd + 3) % 4; Sound.play('menu'); }
      if (Input.nav('down')) { this.cmd = (this.cmd + 1) % 4; Sound.play('menu'); }
      if (Input.pressed('ok')) {
        Sound.play('ok');
        if (this.cmd === 0) { this.state = 'target'; this.tsel = Math.min(this.tsel, live.length - 1); }
        else if (this.cmd === 1) { if (this.usableItems().length) { this.state = 'item'; this.isel = 0; } else Sound.play('cancel'); }
        else if (this.cmd === 2) this.submit({ type: 'guard' });
        else { this.state = 'flee'; this.fsel = 0; }
      }
    } else if (st === 'target') {
      if (Input.nav('left')) { this.tsel = (this.tsel + live.length - 1) % live.length; Sound.play('menu'); }
      if (Input.nav('right')) { this.tsel = (this.tsel + 1) % live.length; Sound.play('menu'); }
      if (Input.pressed('ok')) {
        Sound.play('ok');
        this.state = 'part';
        const parts = this.partsOf(live[this.tsel]);
        this.psel = Math.max(0, parts.indexOf('torso'));
      }
      if (Input.pressed('cancel')) { this.state = 'command'; Sound.play('cancel'); }
    } else if (st === 'part') {
      const f = live[this.tsel];
      const parts = this.partsOf(f);
      if (Input.nav('up')) { this.psel = (this.psel + parts.length - 1) % parts.length; Sound.play('menu'); }
      if (Input.nav('down')) { this.psel = (this.psel + 1) % parts.length; Sound.play('menu'); }
      if (Input.pressed('ok')) this.submit({ type: 'attack', foe: f, part: parts[this.psel] });
      if (Input.pressed('cancel')) { this.state = 'target'; Sound.play('cancel'); }
    } else if (st === 'item') {
      const items = this.usableItems();
      if (Input.nav('up')) { this.isel = (this.isel + items.length - 1) % items.length; Sound.play('menu'); }
      if (Input.nav('down')) { this.isel = (this.isel + 1) % items.length; Sound.play('menu'); }
      if (Input.pressed('ok')) this.submit({ type: 'item', id: items[this.isel].id });
      if (Input.pressed('cancel')) { this.state = 'command'; Sound.play('cancel'); }
    } else if (st === 'flee') {
      const opts = this.fleeOptions();
      if (Input.nav('up')) { this.fsel = (this.fsel + opts.length - 1) % opts.length; Sound.play('menu'); }
      if (Input.nav('down')) { this.fsel = (this.fsel + 1) % opts.length; Sound.play('menu'); }
      if (Input.pressed('ok')) {
        const o = opts[this.fsel];
        if (o.back) { this.state = 'command'; Sound.play('cancel'); }
        else this.submit({ type: 'flee', purse: o.purse });
      }
      if (Input.pressed('cancel')) { this.state = 'command'; Sound.play('cancel'); }
    }
  }
  fleeOptions() {
    const p = this.p;
    const o = [{ label: `Run for it  {d}(${this.fleeOdds()}%){/}` }];
    if (p.gold > 0) o.push({ label: `Throw your purse and run  {g}(${p.gold} gold){/}`, purse: true });
    o.push({ label: 'Stand and fight', back: true });
    return o;
  }

  // ---------------------------------------------------------------- drawing
  draw(lo, ctx) {
    const c = lo.ctx;
    c.drawImage(combatBackground(this.theme), 0, 0);
    const fl = 0.08 + Math.sin(this.age / 120) * 0.03 + Math.sin(this.age / 47) * 0.02;
    c.fillStyle = `rgba(255,140,40,${fl * 0.4})`;
    c.fillRect(0, 0, VW, VH);
    const live = this.living();
    const selFoe = (this.state === 'target' || this.state === 'part') ? live[this.tsel] : null;
    const selPart = this.state === 'part' && selFoe ? this.partsOf(selFoe)[this.psel] : null;
    for (const f of this.foes) {
      const v = f.view;
      if (!v || (!f.alive && !(v.dying > 0 && v.dying < 1)) || (f.fled && !(v.dying > 0 && v.dying < 1))) continue;
      const s = this.sprite(f), def = this.def(f);
      const [bx, by] = this.baseXY(f, s);
      c.save();
      // shadow
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.beginPath(); c.ellipse(v.x, 153, s.w * 0.28, 4, 0, 0, Math.PI * 2); c.fill();
      let alpha = 1;
      if (f.faded) alpha = 0.3 + Math.sin(this.age / 80) * 0.08;
      if (v.dying > 0) {
        if (v.fleeing) { alpha = 1 - v.dying; }
        else {
          alpha = 1 - v.dying * 0.9;
          c.beginPath(); c.rect(bx, by, s.w, s.h * (1 - v.dying * 0.7) + (1 - v.dying) * 4); c.clip();
        }
      }
      c.globalAlpha = alpha;
      const dy = v.dying > 0 && !v.fleeing ? Math.round(v.dying * s.h * 0.5) : 0;
      const dx = v.fleeing ? Math.round(v.dying * 60) : 0;
      for (const k of s.order) {
        const pt = f.parts[k];
        if (pt && pt.gone) continue;
        c.drawImage(s.layers[k], bx + dx, by + dy);
        if (pt && pt.hp < pt.max && s.wounds[k]) {
          const dmg = 1 - pt.hp / pt.max;
          c.globalAlpha = alpha * Math.min(1, 0.25 + dmg);
          c.drawImage(s.wounds[k], bx + dx, by + dy);
          c.globalAlpha = alpha;
        }
      }
      // stumps
      for (const k of ['rarm', 'larm', 'head']) {
        if (!f.parts[k] || !f.parts[k].gone) continue;
        const j = s.joints[k];
        px(c, bx + j[0] - 1, by + j[1] - 1 + dy, def.bloodless ? '#c8c0a8' : '#7a0c08', 3, 3);
        px(c, bx + j[0], by + j[1] + dy, def.bloodless ? '#e8e0c8' : '#c02018');
      }
      if (v.flash > 0 && v.flashPart && s.white[v.flashPart]) {
        c.globalAlpha = v.flash * 0.85;
        c.drawImage(s.white[v.flashPart], bx + dx, by + dy);
      }
      if (selPart && f === selFoe && s.ring[selPart]) {
        c.globalAlpha = 0.55 + Math.sin(this.age / 110) * 0.45;
        c.drawImage(s.ring[selPart], bx, by);
      }
      c.restore();
    }
    for (const q of this.particles) px(c, q.x, q.y, q.col);
    if (this.slash) {
      const [cx, cy] = [this.slash.f.view.x, 100];
      const k = this.slash.age / 260;
      c.strokeStyle = `rgba(255,255,255,${1 - k})`;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx - 30 + k * 10, cy - 30 + k * 10); c.lineTo(cx + 30 - k * 10, cy + 30 - k * 10); c.stroke();
    }
    if (this.redFlash > 0) { c.fillStyle = `rgba(180,10,0,${this.redFlash * 0.4})`; c.fillRect(0, 0, VW, VH); }
  }

  drawUI(ctx) {
    const p = this.p;
    const live = this.living();
    // log: newest message in full, older ones fill the remaining lines
    if (this.log.length) {
      const MAXL = 4;
      const rows = [];
      for (let i = this.log.length - 1; i >= 0 && rows.length < MAXL; i--) {
        const lay = layoutRich(ctx, this.log[i].text, UW - 100, 22);
        const a = i === this.log.length - 1 ? 1 : 0.5;
        const lines = lay.lines.slice(0, MAXL - rows.length);
        for (let j = lines.length - 1; j >= 0; j--) rows.unshift({ ln: lines[j], a });
      }
      drawWindow(ctx, 20, 14, UW - 40, 30 + rows.length * 29, 0.84);
      rows.forEach((r, i) => drawRich(ctx, { lines: [r.ln], size: 22, family: FONT }, 44, 46 + i * 29, 29, Infinity, r.a));
    }
    // floaters
    for (const fl of this.floaters) {
      const k = fl.age / 1000;
      drawText(ctx, fl.text, fl.x, fl.y - 30 - k * 50, { size: 34, align: 'center', color: fl.col, alpha: 1 - k * k, family: FONT_T });
    }
    // target cursor and names
    if (this.state === 'target' || this.state === 'part') {
      const f = live[this.tsel];
      if (f) {
        const s = this.sprite(f);
        const b = this.baseXY(f, s);
        const top = (b[1] + (s.bounds.head ? s.bounds.head.y : 10)) * US - 26;
        const x = f.view.x * US;
        const bob = Math.sin(this.age / 150) * 5;
        ctx.fillStyle = '#e8d8b0';
        ctx.beginPath(); ctx.moveTo(x - 12, top - 22 + bob); ctx.lineTo(x + 12, top - 22 + bob); ctx.lineTo(x, top - 6 + bob); ctx.fill();
        drawText(ctx, this.def(f).name, x, top - 32 + bob, { size: 24, align: 'center', color: '#e8d8b0', family: FONT_T });
      }
    }
    // bottom panels
    const y0 = 504;
    drawWindow(ctx, 20, y0, 300, 200, 0.9);
    const cmds = ['Attack', 'Use item', 'Guard', 'Flee'];
    cmds.forEach((cname, i) => {
      const yy = y0 + 22 + i * 42;
      if (i === this.cmd && this.state !== 'busy') drawCursor(ctx, 36, yy, 268, 38, this.age);
      drawText(ctx, cname, 56, yy + 28, { size: 27, color: this.state === 'busy' ? TCOL.d : TCOL.w });
    });
    this.drawStatus(ctx, 330, y0, UW - 350, 200);
    // sub-windows
    if (this.state === 'part') this.drawPartWindow(ctx, live[this.tsel]);
    if (this.state === 'item') this.drawItemWindow(ctx);
    if (this.state === 'flee') this.drawFleeWindow(ctx);
    if (this.state === 'target') drawText(ctx, '◀ ▶ choose a target', UW / 2, 486, { size: 20, align: 'center', color: TCOL.d });
  }

  drawStatus(ctx, x, y, w, h) {
    const p = this.p;
    drawWindow(ctx, x, y, w, h, 0.9);
    drawText(ctx, 'You', x + 28, y + 42, { size: 28, family: FONT_T, color: '#d8c8a8' });
    const bx = x + 28;
    drawText(ctx, 'Life', bx, y + 82, { size: 20, color: TCOL.d });
    drawBar(ctx, bx + 64, y + 68, 190, 14, p.hp / p.maxHp, '#b8301e');
    drawText(ctx, `${p.hp}/${p.maxHp}`, bx + 266, y + 82, { size: 20 });
    drawText(ctx, 'Mind', bx, y + 114, { size: 20, color: TCOL.d });
    drawBar(ctx, bx + 64, y + 100, 190, 14, p.mind / p.maxMind, '#4a6ac8');
    drawText(ctx, `${p.mind}`, bx + 266, y + 114, { size: 20 });
    const [hl, hc] = hungerLabel(p);
    drawText(ctx, hl, bx, y + 148, { size: 20, color: hc });
    const prof = attackProfile(p);
    drawText(ctx, prof.kick ? 'No arms: kicking' : prof.name, bx, y + 178, { size: 19, color: TCOL.d, style: 'italic' });
    const cond = [];
    if (p.bleed) cond.push('{r}Bleeding{/}');
    if (p.infection) cond.push('{v}Infected{/}');
    if (p.poison) cond.push('{v}Poisoned{/}');
    if (this.guard) cond.push('Guarding');
    const lay = layoutRich(ctx, cond.join('   '), w - 290, 19);
    drawRich(ctx, { lines: [lay.lines[0] || []], size: 19, family: FONT }, bx + 110, y + 148, 22);
    // body doll
    const dx = x + w - 120, dy = y + 22;
    const col = k => p.body[k] === 'lost' ? 'rgba(80,10,10,0.6)' : p.body[k] === 'broken' ? '#d07a30' : '#9a9080';
    const draw = (k, rx, ry, rw, rh, round) => {
      ctx.fillStyle = col(k);
      if (round) { ctx.beginPath(); ctx.arc(dx + rx + rw / 2, dy + ry + rh / 2, rw / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(dx + rx, dy + ry, rw, rh);
      if (p.body[k] === 'lost') { ctx.strokeStyle = '#c02818'; ctx.lineWidth = 2; ctx.strokeRect(dx + rx, dy + ry, rw, rh); }
    };
    draw('head', 38, 0, 26, 26, true);
    draw('torso', 32, 30, 38, 58);
    draw('rarm', 14, 32, 14, 54);
    draw('larm', 74, 32, 14, 54);
    draw('rleg', 34, 92, 15, 62);
    draw('lleg', 53, 92, 15, 62);
    if (p.bleed) { ctx.fillStyle = '#c02010'; for (let i = 0; i < p.bleed; i++) ctx.fillRect(dx + 46 + i * 6, dy + 60 + (this.age / 8 + i * 9) % 30, 3, 5); }
  }

  drawPartWindow(ctx, f) {
    if (!f) return;
    const parts = this.partsOf(f);
    const w = 470, h = 40 + parts.length * 44;
    const x = UW - w - 24, y = 504 - h - 12;
    drawWindow(ctx, x, y, w, h, 0.94);
    parts.forEach((k, i) => {
      const yy = y + 20 + i * 44;
      if (i === this.psel) drawCursor(ctx, x + 14, yy, w - 28, 40, this.age);
      const part = f.parts[k];
      drawText(ctx, cap(PART_INFO[k].name), x + 30, yy + 28, { size: 24 });
      const frac = part.hp / part.max;
      drawBar(ctx, x + 160, yy + 14, 90, 10, frac, frac > 0.6 ? '#9a8a6a' : frac > 0.3 ? '#c87a30' : '#c02818');
      const role = PART_INFO[k].kind === 'vital' ? 'kills' : k === 'legs' ? 'cripples' : k === 'wings' ? 'grounds' : 'disarms';
      drawText(ctx, role, x + 270, yy + 28, { size: 19, color: TCOL.d, style: 'italic' });
      drawText(ctx, this.hitChance(f, k) + '%', x + w - 34, yy + 28, { size: 24, align: 'right', color: TCOL.y });
    });
  }
  drawItemWindow(ctx) {
    const items = this.usableItems();
    const w = 470, h = 40 + items.length * 40;
    const x = UW - w - 24, y = Math.max(80, 504 - h - 12);
    drawWindow(ctx, x, y, w, h, 0.94);
    items.forEach((it, i) => {
      const yy = y + 20 + i * 40;
      if (i === this.isel) drawCursor(ctx, x + 14, yy, w - 28, 36, this.age);
      drawText(ctx, ITEMS[it.id].name, x + 30, yy + 26, { size: 23 });
      drawText(ctx, '×' + it.qty, x + w - 34, yy + 26, { size: 22, align: 'right', color: TCOL.d });
    });
  }
  drawFleeWindow(ctx) {
    const opts = this.fleeOptions();
    const w = 520, h = 40 + opts.length * 44;
    const x = UW - w - 24, y = 504 - h - 12;
    drawWindow(ctx, x, y, w, h, 0.94);
    opts.forEach((o, i) => {
      const yy = y + 20 + i * 44;
      if (i === this.fsel) drawCursor(ctx, x + 14, yy, w - 28, 40, this.age);
      drawRich(ctx, layoutRich(ctx, o.label, w - 60, 24), x + 30, yy + 28, 28);
    });
  }
}

// Monster names in running text: "the Zombie", "the Butcher", "Diablo".
function the(def) {
  const n = def.name;
  if (/^The /.test(n)) return 'the ' + n.slice(4);
  if (def.unique) return n;
  return 'the ' + n;
}
function The(def) { const s = the(def); return s.charAt(0).toUpperCase() + s.slice(1); }

// A foe can chase you while it has legs or wings left.
function mobileFoe(f) {
  const L = f.parts.legs, W = f.parts.wings;
  if (!L && !W) return true;
  return (L && !L.gone) || (W && !W.gone);
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
