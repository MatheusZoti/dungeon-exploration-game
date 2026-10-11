'use strict';
// The explorer: survival stats, body, injuries and inventory.

const BODY = ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg'];
const BODY_NAME = { head: 'head', torso: 'chest', rarm: 'right arm', larm: 'left arm', rleg: 'right leg', lleg: 'left leg' };
const MAX_SLOTS = 14;

function newPlayer() {
  return {
    x: 0, y: 0, dir: 'down',
    hp: 40, maxHp: 40, mind: 100, maxMind: 100, food: 85, maxFood: 100,
    lit: false, torch: 0,
    gold: 12, bank: 0, stash: [],
    inv: [{ id: 'bread', qty: 2 }, { id: 'torch', qty: 3 }, { id: 'bandage', qty: 1 }],
    weapon: 'shortsword', armor: 'rags',
    body: { head: 'ok', torso: 'ok', rarm: 'ok', larm: 'ok', rleg: 'ok', lleg: 'ok' },
    bleed: 0, infection: 0, poison: 0,
    steps: 0, kills: 0, deepest: 0, goldFound: 0, days: 1,
    seen: {}, cause: null,
  };
}

// ---------------------------------------------------------------- derived stats
function attackProfile(p) {
  const w = ITEMS[p.weapon];
  const r = p.body.rarm, l = p.body.larm;
  if (r === 'lost' && l === 'lost') {
    return { name: 'a kick', dmg: [1, 4], acc: -5, kind: 'blunt', mult: 1, sever: 0, kick: true };
  }
  let mult = 1, acc = w.acc;
  if (r === 'lost') { mult *= 0.65; acc -= 15; if (l === 'broken') mult *= 0.7; }
  else if (r === 'broken') { mult *= 0.7; acc -= 10; }
  if (w.twoHand && (r !== 'ok' || l !== 'ok')) { mult *= 0.6; acc -= 10; }
  if (p.mind < 30) acc -= 10;
  if (p.food === 0) mult *= 0.8;
  return { name: w.name, dmg: w.dmg, acc, kind: w.kind, mult, sever: w.sever || 0 };
}
function legPenalty(p) {
  let n = 0;
  for (const k of ['rleg', 'lleg']) n += p.body[k] === 'broken' ? 1 : p.body[k] === 'lost' ? 2.4 : 0;
  return n;
}
function moveDelay(p) {
  const lp = legPenalty(p);
  let d = 150 + lp * 70;
  if (p.body.rleg === 'lost' && p.body.lleg === 'lost') d = 560;
  if (p.food === 0) d += 40;
  return d;
}
function fleeChance(p) {
  let c = 58;
  c -= legPenalty(p) * 14;
  c += ITEMS[p.armor].flee || 0;
  c -= Math.min(16, Math.floor(p.gold / 150) * 2);
  return clamp(c, 5, 95);
}
function defense(p) { return ITEMS[p.armor].def || 0; }
function purseNoise(p) { return Math.min(4, Math.floor(p.gold / 300)); }

function hungerLabel(p) {
  const f = p.food;
  if (f > 70) return ['Sated', TCOL.v];
  if (f > 40) return ['Peckish', TCOL.w];
  if (f > 18) return ['Hungry', TCOL.o];
  if (f > 0) return ['Starving', TCOL.r];
  return ['Wasting away', TCOL.r];
}
function mindLabel(p) {
  const m = p.mind;
  if (m > 75) return 'Steady';
  if (m > 50) return 'Uneasy';
  if (m > 30) return 'Frightened';
  if (m > 15) return 'Terrified';
  return 'Breaking';
}

// ---------------------------------------------------------------- inventory
function invFind(p, id) { return p.inv.find(s => s.id === id); }
function hasItem(p, id, qty = 1) { const s = invFind(p, id); return !!s && s.qty >= qty; }
function addItem(p, id, qty = 1) {
  const it = ITEMS[id];
  let left = qty;
  if (it.stack) {
    for (const s of p.inv) {
      if (s.id !== id || s.qty >= it.stack) continue;
      const n = Math.min(left, it.stack - s.qty);
      s.qty += n; left -= n;
      if (!left) return qty;
    }
  }
  while (left > 0 && p.inv.length < MAX_SLOTS) {
    const n = it.stack ? Math.min(left, it.stack) : 1;
    p.inv.push({ id, qty: n });
    left -= n;
  }
  return qty - left;
}
function removeItem(p, id, qty = 1) {
  for (let i = p.inv.length - 1; i >= 0 && qty > 0; i--) {
    const s = p.inv[i];
    if (s.id !== id) continue;
    const n = Math.min(qty, s.qty);
    s.qty -= n; qty -= n;
    if (s.qty <= 0) p.inv.splice(i, 1);
  }
}
function itemCount(p, id) { return p.inv.reduce((n, s) => n + (s.id === id ? s.qty : 0), 0); }

// ---------------------------------------------------------------- harm
function hurt(p, n, cause) {
  if (n <= 0) return;
  p.hp = Math.max(0, p.hp - n);
  p.cause = cause;
}
function shakeMind(p, n, cause) {
  if (n <= 0) return;
  p.mind = Math.max(0, p.mind - n);
  if (p.mind === 0) p.cause = 'madness';
  else if (cause && p.hp > 0) p.mindCause = cause;
}
function heal(p, n) { p.hp = Math.min(p.maxHp, p.hp + n); }
function calm(p, n) { p.mind = Math.min(p.maxMind, p.mind + n); }
function isDead(p) { return p.hp <= 0 || p.mind <= 0; }

// Apply an injury from an attack to a body part. Returns message fragments.
function injure(p, part, a, monsterName) {
  const msgs = [];
  const def = defense(p);
  const resist = 1 - def * 0.08;
  const limb = part === 'rarm' || part === 'larm' || part === 'rleg' || part === 'lleg';
  if (a.sever && limb && p.body[part] !== 'lost') {
    const ch = a.sever * resist * (p.body[part] === 'broken' ? 1.5 : 1);
    if (R.chance(ch)) {
      p.body[part] = 'lost';
      p.bleed = Math.min(3, p.bleed + 2);
      shakeMind(p, 18);
      msgs.push(`{r}Your ${BODY_NAME[part]} is gone.{/} You stare at the stump.`);
      if (part === 'rarm' && ITEMS[p.weapon].twoHand) msgs.push('You can barely lift your weapon now.');
      return msgs;
    }
  }
  if (a.brk && limb && p.body[part] === 'ok' && R.chance(a.brk * resist)) {
    p.body[part] = 'broken';
    shakeMind(p, 4);
    msgs.push(`{o}Something cracks.{/} Your ${BODY_NAME[part]} is broken.`);
  }
  if (a.bleed && R.chance(a.bleed * resist)) {
    const before = p.bleed;
    p.bleed = Math.min(3, p.bleed + 1);
    if (p.bleed > before) msgs.push(p.bleed === 1 ? '{r}You are bleeding.{/}' : '{r}You are bleeding badly.{/}');
  }
  if (a.infect && R.chance(a.infect * resist)) {
    if (!p.infection) msgs.push('{v}The wound feels hot and wrong.{/}');
    p.infection = Math.min(4, p.infection + 1);
  }
  if (a.poison) {
    p.poison += a.poison;
    msgs.push('{v}The acid eats into you.{/}');
  }
  if (a.burn) {
    p.food = Math.max(0, p.food - 2);
    msgs.push('{o}Your skin blisters and smokes.{/}');
  }
  if (part === 'head' && !a.noPart && R.chance(0.3)) {
    shakeMind(p, 4);
    p.dazed = true;
    msgs.push('{d}Your head rings. The world tilts.{/}');
  }
  return msgs;
}

// Per-step survival upkeep. Returns notices to show.
function survivalStep(p, depth) {
  const out = [];
  p.steps++;
  const s = p.steps;
  if (s % 9 === 0 && p.food > 0) {
    const was = hungerLabel(p)[0];
    p.food -= 1;
    const now = hungerLabel(p)[0];
    if (now !== was) out.push(p.food === 0 ? '{r}You are starving. Your body has started eating itself.{/}' : `You are ${now.toLowerCase()}.`);
  }
  if (p.food === 0 && s % 7 === 0) { hurt(p, 1, 'starved'); shakeMind(p, 1); }
  if (p.lit && depth > 0) {
    p.torch -= 1;
    if (p.torch === 40) out.push('{o}Your torch is burning low.{/}');
    if (p.torch <= 0) { p.lit = false; p.torch = 0; out.push('torch-out'); }
  }
  if (p.bleed > 0 && s % [0, 9, 6, 3][p.bleed] === 0) hurt(p, 1, 'bled');
  if (p.poison > 0) { p.poison -= 1; if (s % 5 === 0) hurt(p, 1, 'poison'); }
  if (p.infection > 0) {
    if (s % 110 === 0) {
      if (p.infection === 1 && R.chance(0.4)) { p.infection = 0; out.push('{v}The fever breaks. The wound is clean again.{/}'); }
      else if (p.infection < 4) { p.infection++; out.push('{v}The infection is spreading.{/}'); }
    }
    if (s % Math.max(10, 44 - p.infection * 8) === 0) hurt(p, 1, 'infection');
    if (s % 50 === 0) shakeMind(p, 1);
  }
  if (p.food > 35 && !p.bleed && !p.poison && !p.infection && s % 22 === 0) heal(p, 1);
  if (depth >= 5 && s % Math.max(24, 76 - depth * 3) === 0) shakeMind(p, 1);
  return out;
}

// ---------------------------------------------------------------- using items
// Returns true if the item was consumed or used.
async function useItem(p, id, where) {
  const it = ITEMS[id];
  const inCombat = where === 'combat';
  switch (it.type) {
    case 'food': {
      if (id === 'mushroom') {
        removeItem(p, id);
        p.food = Math.min(p.maxFood, p.food + it.food);
        Sound.play('eat');
        const good = await UI.coinFlip('You eat the pale mushroom', 'Clarity', 'Poison');
        if (good) { calm(p, 14); await UI.say('Your head clears. For a moment the dark seems smaller. {b}(+14 mind){/}'); }
        else { p.poison += 20; shakeMind(p, 6); await UI.say('{v}The walls start to breathe. Your stomach knots.{/} You are poisoned.'); }
        return true;
      }
      removeItem(p, id);
      p.food = Math.min(p.maxFood, p.food + it.food);
      Sound.play('eat');
      let msg = `You eat the ${it.name.toLowerCase()}.`;
      if (it.mind > 0) { calm(p, it.mind); msg += ` {b}(+${it.mind} mind){/}`; }
      if (it.mind < 0) { shakeMind(p, -it.mind); msg += ` {r}You try not to think about it. (${it.mind} mind){/}`; }
      if (it.raw && R.chance(0.35)) { p.poison += 12; msg += ' {v}Your stomach turns. Raw meat was a mistake.{/}'; }
      await UI.say(msg);
      return true;
    }
    case 'potion': {
      removeItem(p, id);
      Sound.play('drink');
      const parts = [];
      if (it.maxHp) { p.maxHp += it.maxHp; parts.push(`{v}Your body hardens. (+${it.maxHp} max health){/}`); }
      if (it.hp) { const before = p.hp; heal(p, it.hp); parts.push(`{r}+${p.hp - before} health{/}`); }
      if (it.mind) { const before = p.mind; calm(p, it.mind); parts.push(`{b}+${p.mind - before} mind{/}`); }
      if (it.stopBleed && p.bleed) { p.bleed = 0; parts.push('the bleeding stops'); }
      await UI.say(`You drink the ${it.name.toLowerCase()}. ` + parts.join(', ') + '.');
      return true;
    }
    case 'medicine': {
      if (it.stopBleed) {
        if (!p.bleed) { await UI.say('You are not bleeding.'); return false; }
        removeItem(p, id); p.bleed = 0;
        await UI.say('You bind the wound tight. The bleeding stops.');
        return true;
      }
      if (it.setBone) {
        const broken = BODY.filter(k => p.body[k] === 'broken');
        if (!broken.length) { await UI.say('Nothing of yours is broken. Yet.'); return false; }
        const k = broken.length === 1 ? broken[0] : broken[await UI.choose('Which limb?', broken.map(b => BODY_NAME[b]))];
        removeItem(p, id); p.body[k] = 'ok'; hurt(p, 2, 'bled'); shakeMind(p, 3);
        await UI.say(`You set your ${BODY_NAME[k]} and bite down on your sleeve so you do not scream. It will hold.`);
        return true;
      }
      if (it.cure) {
        if (!p.infection && !p.poison) { await UI.say('You have no infection or poison to draw out.'); return false; }
        removeItem(p, id); p.infection = 0; p.poison = 0;
        await UI.say('The salve burns, then cools. The rot and the poison drain out of you.');
        return true;
      }
      return false;
    }
    case 'light': {
      if (p.lit && p.torch > 60) {
        if (!(await UI.confirm(`Your torch still has some life in it. Light a fresh one anyway?`))) return false;
      }
      removeItem(p, id);
      p.lit = true; p.torch = it.fuel;
      Sound.play('torch');
      if (!inCombat) await UI.say('You light a fresh torch. The dark backs away, a little.');
      return true;
    }
    case 'scroll': {
      if (inCombat) { await UI.say('There is no time to read a scroll now.'); return false; }
      return 'portal';
    }
    case 'weapon': case 'armor': {
      if (inCombat) { await UI.say('There is no time to change gear now.'); return false; }
      const slot = it.type;
      const old = p[slot];
      removeItem(p, id);
      p[slot] = id;
      if (old && old !== 'rags') addItem(p, old);
      Sound.play('ok');
      let note = '';
      if (it.twoHand && (p.body.rarm !== 'ok' || p.body.larm !== 'ok')) note = ' {o}With your arm the way it is, you can barely swing it.{/}';
      await UI.say(`You ${slot === 'weapon' ? 'take up' : 'put on'} the ${it.name}.${note}`);
      return true;
    }
    case 'treasure': {
      await UI.say(`{g}${it.name}{/}. ${it.desc} {d}Worth about ${it.value} gold.{/}`);
      return false;
    }
  }
  return false;
}
