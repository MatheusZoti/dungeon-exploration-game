'use strict';
// The pause menu (items, gear, body), town services, and shops.

const Menu = {
  open() {
    return new Promise(res => UI.push(new MenuScreen(res)));
  },
};

class MenuScreen {
  constructor(res) {
    this.res = res;
    this.age = 0;
    this.tab = null;
    this.root = 0;
    this.sel = 0;
    this.sub = null;
    this.working = false;
  }
  get p() { return G.p; }
  rootItems() {
    return ['Items', 'Equipment', 'Body', 'Map', Sound.muted ? 'Sound: off' : 'Sound: on', 'Quit to title'];
  }
  close() { UI.pop(this); this.res(); }

  update(dt) {
    this.age += dt;
    if (this.working) return;
    if (this.sub) return this.updateSub();
    if (!this.tab) {
      const items = this.rootItems();
      if (Input.nav('up')) { this.root = (this.root + items.length - 1) % items.length; Sound.play('menu'); }
      if (Input.nav('down')) { this.root = (this.root + 1) % items.length; Sound.play('menu'); }
      if (Input.pressed('cancel') || Input.pressed('map') && false) { Sound.play('cancel'); this.close(); return; }
      if (Input.pressed('ok')) {
        Sound.play('ok');
        const r = this.root;
        if (r === 0) { this.tab = 'items'; this.sel = 0; }
        else if (r === 1) { this.tab = 'equip'; this.sel = 0; }
        else if (r === 2) { this.tab = 'body'; }
        else if (r === 3) { Game.world.showMap = true; this.close(); }
        else if (r === 4) { Sound.setMuted(!Sound.muted); }
        else if (r === 5) this.async(async () => {
          if (await UI.confirm('Quit to the title screen? Anything since your last save will be lost.', 'Quit', 'Stay')) { this.close(); Game.toTitle(); }
        });
      }
      return;
    }
    if (Input.pressed('cancel')) { Sound.play('cancel'); this.tab = null; return; }
    if (this.tab === 'items') {
      const n = this.p.inv.length;
      if (!n) return;
      if (Input.nav('up')) { this.sel = (this.sel + n - 1) % n; Sound.play('menu'); }
      if (Input.nav('down')) { this.sel = (this.sel + 1) % n; Sound.play('menu'); }
      if (Input.nav('left') && n > 7) { this.sel = (this.sel + n - 7) % n; Sound.play('menu'); }
      if (Input.nav('right') && n > 7) { this.sel = (this.sel + 7) % n; Sound.play('menu'); }
      if (Input.pressed('ok')) { Sound.play('ok'); this.openItemSub(); }
    } else if (this.tab === 'equip') {
      if (Input.nav('up') || Input.nav('down')) { this.sel = 1 - this.sel; Sound.play('menu'); }
      if (Input.pressed('ok')) {
        const type = this.sel === 0 ? 'weapon' : 'armor';
        const options = this.p.inv.filter(s => ITEMS[s.id].type === type);
        if (!options.length) { Sound.play('cancel'); return; }
        this.async(async () => {
          const c = await UI.choose(`Equip which ${type}?`, options.map(s => ITEMS[s.id].name + '  {d}' + gearStats(s.id) + '{/}').concat(['Cancel']), { cancel: options.length });
          if (c < options.length) await useItem(this.p, options[c].id, 'menu');
        });
      }
    }
  }

  async(fn) {
    this.working = true;
    Promise.resolve().then(fn).catch(e => console.error(e)).finally(() => { this.working = false; this.sel = Math.min(this.sel, Math.max(0, this.p.inv.length - 1)); });
  }

  openItemSub() {
    const s = this.p.inv[this.sel];
    if (!s) return;
    const it = ITEMS[s.id];
    const verb = { food: 'Eat', potion: 'Drink', medicine: 'Apply', light: 'Light', scroll: 'Read', weapon: 'Equip', armor: 'Wear', treasure: 'Examine' }[it.type] || 'Use';
    this.sub = { id: s.id, opts: [verb, 'Drop', 'Back'], sel: 0 };
  }
  updateSub() {
    const sub = this.sub;
    if (Input.nav('up')) { sub.sel = (sub.sel + sub.opts.length - 1) % sub.opts.length; Sound.play('menu'); }
    if (Input.nav('down')) { sub.sel = (sub.sel + 1) % sub.opts.length; Sound.play('menu'); }
    if (Input.pressed('cancel')) { Sound.play('cancel'); this.sub = null; return; }
    if (!Input.pressed('ok')) return;
    Sound.play('ok');
    const id = sub.id;
    this.sub = null;
    if (sub.sel === 0) {
      this.async(async () => {
        const r = await useItem(this.p, id, 'menu');
        if (r === 'portal') { this.close(); await Game.world.castPortal(); }
      });
    } else if (sub.sel === 1) {
      this.async(async () => {
        const it = ITEMS[id];
        if (it.type === 'treasure' && !(await UI.confirm(`Leave the ${it.name} behind?`, 'Drop it', 'Keep it'))) return;
        const qty = itemCount(this.p, id);
        const n = it.stack && qty > 1 ? 1 : 1;
        removeItem(this.p, id, n);
        const W = Game.world, L = W.L;
        const sack = L.entsAt(this.p.x, this.p.y).find(e => e.kind === 'sack' && !e.soulstone && !e.mushrooms);
        if (sack) sack.items.push(id); else L.add({ kind: 'sack', x: this.p.x, y: this.p.y, items: [id], block: false });
        Sound.play('cancel');
      });
    }
  }

  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, UW, UH);
    const p = this.p;
    // root column
    drawWindow(ctx, 20, 20, 250, 300, 0.94);
    this.rootItems().forEach((t, i) => {
      const y = 40 + i * 44;
      if (i === this.root) drawCursor(ctx, 34, y, 222, 40, this.tab ? 0 : this.age);
      drawText(ctx, t, 52, y + 29, { size: 26, color: this.tab && i !== this.root ? TCOL.d : TCOL.w });
    });
    // summary column
    drawWindow(ctx, 20, 330, 250, 370, 0.94);
    const L = Game.world.L;
    let y = 372;
    const line = (a, b, col) => { drawText(ctx, a, 40, y, { size: 20, color: TCOL.d }); drawText(ctx, b, 250, y, { size: 20, align: 'right', color: col || TCOL.w }); y += 32; };
    line('Life', `${p.hp} / ${p.maxHp}`, '#e07060');
    line('Mind', `${p.mind} (${mindLabel(p)})`, '#8aa8ee');
    const [hl, hc] = hungerLabel(p);
    line('Hunger', hl, hc);
    line('Torch', L.depth > 0 ? (p.lit ? `${p.torch} steps` : 'Unlit') : '-', p.lit ? TCOL.y : TCOL.d);
    line('Purse', `${p.gold} gold`, TCOL.g);
    line('Hoard', `${Town.hoardValue()} gold`, TCOL.g);
    line('Depth', L.depth === 0 ? 'Tristram' : `Level ${L.depth}`);
    line('Deepest', `Level ${p.deepest}`);
    line('Steps', `${p.steps}`);
    line('Kills', `${p.kills}`);

    const x0 = 290, w = UW - 310;
    if (this.tab === 'items') this.drawItems(ctx, x0, w);
    else if (this.tab === 'equip') this.drawEquip(ctx, x0, w);
    else if (this.tab === 'body') this.drawBody(ctx, x0, w);
    else {
      drawWindow(ctx, x0, 20, w, 680, 0.9);
      drawText(ctx, 'Beneath Tristram', x0 + w / 2, 140, { size: 52, align: 'center', family: FONT_T, color: '#c8b48a' });
      const lay = layoutRich(ctx, 'Arrow keys or WASD to move. Z, Space or Enter to act. X or Esc for this menu. Tab or M for the map. Hold Shift to hurry text along. N toggles sound.\n\nYou cannot save just anywhere. Sleep by the campfire in Tristram, or leave an offering at a bloodstained altar below.\n\nThe coin decides more than you would like.', w - 100, 22, FONT, TCOL.d);
      drawRich(ctx, lay, x0 + 50, 220, 32);
    }
  }

  drawItems(ctx, x0, w) {
    const p = this.p;
    drawWindow(ctx, x0, 20, w, 500, 0.92);
    drawText(ctx, `Pack  ${p.inv.length}/${MAX_SLOTS}`, x0 + 30, 60, { size: 24, family: FONT_T, color: '#c8b48a' });
    const colW = (w - 60) / 2;
    p.inv.forEach((s, i) => {
      const col = Math.floor(i / 7), row = i % 7;
      const x = x0 + 22 + col * colW, y = 80 + row * 58;
      if (i === this.sel) drawCursor(ctx, x, y, colW - 8, 52, this.age);
      const it = ITEMS[s.id];
      const color = it.type === 'treasure' ? TCOL.g : it.unique ? TCOL.o : TCOL.w;
      drawText(ctx, it.name, x + 16, y + 34, { size: 22, color });
      if (s.qty > 1) drawText(ctx, '×' + s.qty, x + colW - 26, y + 34, { size: 20, align: 'right', color: TCOL.d });
    });
    if (!p.inv.length) drawText(ctx, 'Your pack is empty.', x0 + 30, 120, { size: 22, color: TCOL.d });
    drawWindow(ctx, x0, 530, w, 170, 0.92);
    const s = p.inv[this.sel];
    if (s) {
      const it = ITEMS[s.id];
      drawText(ctx, it.name, x0 + 30, 572, { size: 26, family: FONT_T, color: it.type === 'treasure' ? TCOL.g : '#d8c8a8' });
      const extra = it.type === 'treasure' ? `  {g}Worth ${it.value} gold.{/}` : (it.type === 'weapon' || it.type === 'armor') ? `  {d}${gearStats(s.id)}{/}` : '';
      drawRich(ctx, layoutRich(ctx, it.desc + extra, w - 60, 22), x0 + 30, 610, 30);
    }
    if (this.sub) {
      const sw = 220, sh = this.sub.opts.length * 42 + 30;
      const sx = x0 + w - sw - 30, sy = 80;
      drawWindow(ctx, sx, sy, sw, sh, 0.97);
      this.sub.opts.forEach((o, i) => {
        const yy = sy + 15 + i * 42;
        if (i === this.sub.sel) drawCursor(ctx, sx + 12, yy, sw - 24, 38, this.age);
        drawText(ctx, o, sx + 32, yy + 28, { size: 24 });
      });
    }
  }

  drawEquip(ctx, x0, w) {
    const p = this.p;
    drawWindow(ctx, x0, 20, w, 680, 0.92);
    drawText(ctx, 'Equipment', x0 + 30, 64, { size: 28, family: FONT_T, color: '#c8b48a' });
    const rows = [['Weapon', p.weapon], ['Armor', p.armor]];
    rows.forEach(([label, id], i) => {
      const y = 90 + i * 110;
      if (i === this.sel) drawCursor(ctx, x0 + 20, y, w - 40, 96, this.age);
      drawText(ctx, label, x0 + 40, y + 32, { size: 20, color: TCOL.d });
      drawText(ctx, ITEMS[id].name, x0 + 40, y + 66, { size: 28, color: ITEMS[id].unique ? TCOL.o : TCOL.w });
      drawText(ctx, gearStats(id), x0 + w - 40, y + 66, { size: 20, align: 'right', color: TCOL.d });
    });
    const prof = attackProfile(p);
    let notes = [];
    if (prof.kick) notes.push('{r}You have no arms. You can only kick.{/}');
    else if (prof.mult < 1) notes.push(`{o}Your injuries weaken your blows (×${prof.mult.toFixed(2)} damage).{/}`);
    notes.push(`Chance to escape a fight: about ${fleeChance(p)}%.` + (p.gold >= 150 ? ' {g}Your heavy purse slows you down.{/}' : ''));
    notes.push('Slashing weapons take limbs. Blunt ones crush skulls and shatter skeletons. Piercing ones find the heart.');
    drawRich(ctx, layoutRich(ctx, notes.join('\n\n'), w - 80, 22, FONT, TCOL.d), x0 + 40, 360, 32);
    drawText(ctx, 'Confirm to change', x0 + w / 2, 680, { size: 18, align: 'center', color: TCOL.d });
  }

  drawBody(ctx, x0, w) {
    const p = this.p;
    drawWindow(ctx, x0, 20, w, 680, 0.92);
    drawText(ctx, 'Body', x0 + 30, 64, { size: 28, family: FONT_T, color: '#c8b48a' });
    const dx = x0 + 70, dy = 110, S = 2.2;
    const col = k => p.body[k] === 'lost' ? 'rgba(90,10,10,0.5)' : p.body[k] === 'broken' ? '#d07a30' : '#a89c88';
    const part = (k, rx, ry, rw, rh, round) => {
      ctx.fillStyle = col(k);
      if (round) { ctx.beginPath(); ctx.arc(dx + (rx + rw / 2) * S, dy + (ry + rh / 2) * S, rw / 2 * S, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(dx + rx * S, dy + ry * S, rw * S, rh * S);
    };
    part('head', 38, 0, 26, 26, true); part('torso', 32, 30, 38, 58);
    part('rarm', 14, 32, 14, 54); part('larm', 74, 32, 14, 54);
    part('rleg', 34, 92, 15, 62); part('lleg', 53, 92, 15, 62);
    const lines = [];
    for (const k of BODY) {
      const st = p.body[k];
      if (st === 'broken') lines.push(`{o}Broken ${BODY_NAME[k]}.{/} ${k.includes('arm') ? 'Your blows are weaker.' : 'You limp, and running is harder.'} A splint will set it.`);
      if (st === 'lost') lines.push(`{r}Your ${BODY_NAME[k]} is gone.{/} ${k.includes('arm') ? (k === 'rarm' ? 'You fight with your off hand.' : 'Two-handed weapons are hard to swing.') : 'You crawl more than walk.'}`);
    }
    if (p.bleed) lines.push(`{r}Bleeding (${p.bleed}).{/} You lose blood as you move and fight. Bind it with a bandage.`);
    if (p.infection) lines.push(`{v}Infected (${p.infection}).{/} The wound is rotting. It will get worse. Adria's salve draws it out.`);
    if (p.poison) lines.push(`{v}Poisoned.{/} It will pass, if it does not kill you first. Salve cures it.`);
    if (p.food <= 18) lines.push('{r}You are starving.{/} Eat something, anything.');
    if (p.mind <= 30) lines.push('{p}Your mind is fraying.{/} You see things in the dark. Blue potions, wine and sleep help.');
    if (!lines.length) lines.push('You are, against all odds, intact.');
    drawRich(ctx, layoutRich(ctx, lines.join('\n\n'), w - 340, 22), x0 + 300, 130, 30);
  }
}

function gearStats(id) {
  const it = ITEMS[id];
  if (it.type === 'weapon') {
    const kind = { slash: 'slash', blunt: 'crush', pierce: 'pierce' }[it.kind];
    return `${it.dmg[0]}-${it.dmg[1]} ${kind}${it.acc ? `, ${it.acc > 0 ? '+' : ''}${it.acc}% aim` : ''}${it.twoHand ? ', two hands' : ''}`;
  }
  if (it.type === 'armor') return `${it.def} armor${it.flee ? `, ${it.flee}% escape` : ''}`;
  return '';
}

// ---------------------------------------------------------------- town services
const WIRT_STOCK = ['bread', 'jerky', 'apple', 'torch', 'bandage', 'splint', 'dagger', 'club', 'axe', 'mace', 'leather', 'studded'];
const ADRIA_STOCK = ['hpot', 'mpot', 'rpot', 'salve', 'tp', 'wine'];

const Town = {
  hoardValue() {
    const p = G.p;
    return p.bank + p.stash.reduce((n, id) => n + ITEMS[id].value, 0);
  },

  async talk(npc) {
    const p = G.p;
    if (npc === 'cain') {
      if (!G.flags.cainMet) {
        G.flags.cainMet = true;
        await UI.sayAll(LORE.cain.first, { speaker: 'Deckard Cain' });
        addItem(p, 'hpot');
        await UI.say('{d}You receive a Potion of Healing.{/}');
        return;
      }
      await UI.say(R.pick(LORE.cain.again), { speaker: 'Deckard Cain' });
      for (;;) {
        const opts = LORE.cain.topics.map(t => t[0]).concat(['Farewell']);
        const c = await UI.choose('', opts, { cancel: opts.length - 1 });
        if (c === opts.length - 1) return;
        await UI.say(LORE.cain.topics[c][1], { speaker: 'Deckard Cain' });
      }
    }
    if (npc === 'wirt') {
      await UI.say(R.pick(LORE.wirt.greet), { speaker: 'Wirt' });
      return this.shop('Wirt', this.wirtStock(), true);
    }
    if (npc === 'adria') {
      await UI.say(R.pick(LORE.adria.greet), { speaker: 'Adria' });
      const stock = ADRIA_STOCK.slice();
      if (p.deepest >= 6) stock.push('elixir', 'fhpot');
      return this.shop('Adria', stock, false);
    }
  },
  wirtStock() {
    const p = G.p, s = WIRT_STOCK.slice();
    if (p.deepest >= 5) s.push('falchion');
    if (p.deepest >= 7) s.push('chain', 'morningstar');
    if (p.deepest >= 10) s.push('bastard', 'warhammer');
    return s;
  },
  shop(name, stock, buys) {
    return new Promise(res => UI.push(new ShopScreen(name, stock, buys, res)));
  },

  async camp() {
    const p = G.p;
    const raw = p.inv.filter(s => ITEMS[s.id].cook);
    const opts = ['Sleep by the fire', raw.length ? 'Cook your raw meat' : '{d}Cook (nothing raw){/}', 'Leave'];
    const c = await UI.choose('The campfire in the ruins of the Rising Sun. Your bedroll is still here.', opts, { cancel: 2, disabled: [false, !raw.length, false] });
    if (c === 1) {
      let n = 0;
      for (const s of raw.slice()) {
        const cooked = ITEMS[s.id].cook;
        const q = s.qty;
        removeItem(p, s.id, q);
        addItem(p, cooked, q);
        n += q;
      }
      Sound.play('torch');
      return UI.say(`You cook ${n} ${n === 1 ? 'piece' : 'pieces'} of meat over the fire. The smell makes your stomach ache.`);
    }
    if (c !== 0) return;
    if (!(await UI.confirm('Sleep until morning? {d}(The dead below will stir again. The game will be saved.){/}', 'Sleep', 'Not yet'))) return;
    await UI.fadeTo(1, 900);
    const hpGain = Math.round(p.maxHp * (p.bleed ? 0.3 : 0.7));
    heal(p, hpGain);
    calm(p, 30);
    p.food = Math.max(0, p.food - 14);
    if (p.bleed) p.bleed = Math.max(0, p.bleed - 1);
    p.days++;
    G.townTrips++;
    await wait(500);
    await UI.fadeTo(0, 900);
    const dreams = [
      'You dream of gold. Rivers of it, running downhill, into the dark.',
      'You dream of a red light under the cathedral, pulsing like a heart.',
      'You dream that you never came to Tristram. You wake up disappointed.',
      'You dream of the faces of the dead you have searched. They are counting their coins.',
    ];
    await UI.say(R.pick(dreams) + ` {d}(Day ${p.days}. +${hpGain} life, +30 mind){/}`);
    Game.save();
    UI.toast('{d}Game saved.{/}');
  },

  async stash() {
    const p = G.p;
    await UI.say('The old well in the square. Halfway down, a loose stone hides your hoard.');
    for (;;) {
      const treasures = p.inv.filter(s => ITEMS[s.id].type === 'treasure');
      const opts = [
        `Hide gold  {d}(carrying ${p.gold}){/}`,
        `Take gold  {d}(${p.bank} hidden){/}`,
        `Hide treasure  {d}(${treasures.length} in pack){/}`,
        `Take treasure  {d}(${p.stash.length} hidden){/}`,
        `Count the hoard`,
        'Leave',
      ];
      const c = await UI.choose('', opts, { cancel: 5, disabled: [!p.gold, !p.bank, !treasures.length, !p.stash.length, false, false] });
      if (c === 5) return;
      if (c === 0) { const n = await UI.number('Hide how much?', p.gold, 10); if (n) { p.gold -= n; p.bank += n; Sound.play('coin'); } }
      if (c === 1) { const n = await UI.number('Take how much?', p.bank, 10); if (n) { p.bank -= n; p.gold += n; Sound.play('coin'); } }
      if (c === 2) {
        const k = await UI.choose('Hide which?', treasures.map(s => ITEMS[s.id].name).concat(['Cancel']), { cancel: treasures.length });
        if (k < treasures.length) { removeItem(p, treasures[k].id); p.stash.push(treasures[k].id); Sound.play('coin'); }
      }
      if (c === 3) {
        const k = await UI.choose('Take which?', p.stash.map(id => ITEMS[id].name).concat(['Cancel']), { cancel: p.stash.length });
        if (k < p.stash.length) {
          if (addItem(p, p.stash[k])) p.stash.splice(k, 1);
          else await UI.say('Your pack is full.');
        }
      }
      if (c === 4) {
        const v = this.hoardValue();
        await UI.say(v ? `You count it twice. ${p.bank} gold, and treasure worth ${v - p.bank}. {g}${v} gold in all.{/} It is not enough. It is never enough.` : 'There is nothing hidden here yet. Only cold water and the smell of smoke.');
      }
    }
  },
};

class ShopScreen {
  constructor(name, stock, buys, res) {
    this.name = name; this.stock = stock; this.buys = buys; this.res = res;
    this.tab = 0; this.sel = 0; this.age = 0; this.note = null; this.noteT = 0;
  }
  get p() { return G.p; }
  sellable() {
    return this.p.inv.filter(s => {
      const it = ITEMS[s.id];
      return it.type === 'treasure' && s.id !== 'soulstone' || ((it.type === 'weapon' || it.type === 'armor') && it.price);
    });
  }
  sellPrice(id) {
    const it = ITEMS[id];
    return it.type === 'treasure' ? Math.floor(it.value / 2) : Math.floor(it.price * 0.3);
  }
  list() { return this.tab === 0 ? this.stock : this.sellable().map(s => s.id); }
  update(dt) {
    this.age += dt;
    if (this.noteT > 0) this.noteT -= dt;
    const list = this.list();
    if (this.buys && (Input.nav('left') || Input.nav('right'))) { this.tab = 1 - this.tab; this.sel = 0; Sound.play('menu'); return; }
    if (list.length) {
      if (Input.nav('up')) { this.sel = (this.sel + list.length - 1) % list.length; Sound.play('menu'); }
      if (Input.nav('down')) { this.sel = (this.sel + 1) % list.length; Sound.play('menu'); }
    }
    if (Input.pressed('cancel')) { Sound.play('cancel'); UI.pop(this); this.res(); return; }
    if (Input.pressed('ok') && list.length) {
      const id = list[Math.min(this.sel, list.length - 1)];
      const p = this.p;
      if (this.tab === 0) {
        const price = ITEMS[id].price;
        if (p.gold < price) return this.say('You cannot afford that.', TCOL.r);
        if (!addItem(p, id)) return this.say('Your pack is full.', TCOL.r);
        p.gold -= price;
        Sound.play('coin');
        this.say(`Bought ${ITEMS[id].name}.`, TCOL.v);
      } else {
        const price = this.sellPrice(id);
        removeItem(p, id);
        p.gold += price;
        Sound.play('coin');
        this.say(`Sold ${ITEMS[id].name} for ${price} gold.`, TCOL.g);
        this.sel = Math.min(this.sel, Math.max(0, this.list().length - 1));
      }
    }
  }
  say(t, c) { this.note = [t, c]; this.noteT = 1800; if (c === TCOL.r) Sound.play('cancel'); }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, UW, UH);
    const x = 60, y = 30, w = UW - 120, h = 500;
    drawWindow(ctx, x, y, w, h, 0.95);
    drawText(ctx, this.name, x + 30, y + 46, { size: 32, family: FONT_T, color: '#d8c8a8' });
    if (this.buys) {
      drawText(ctx, 'Buy', x + 300, y + 44, { size: 24, color: this.tab === 0 ? TCOL.w : TCOL.d });
      drawText(ctx, 'Sell', x + 380, y + 44, { size: 24, color: this.tab === 1 ? TCOL.w : TCOL.d });
      ctx.fillStyle = '#a89580'; ctx.fillRect(x + (this.tab === 0 ? 300 : 380), y + 52, 44, 2);
      drawText(ctx, '◀ ▶', x + 450, y + 44, { size: 18, color: TCOL.d });
    }
    drawText(ctx, `${this.p.gold} gold`, x + w - 30, y + 46, { size: 24, align: 'right', color: TCOL.g });
    const list = this.list();
    const rowH = 34;
    const maxRows = 12;
    const start = Math.max(0, Math.min(this.sel - 6, list.length - maxRows));
    list.slice(start, start + maxRows).forEach((id, j) => {
      const i = start + j;
      const yy = y + 70 + j * rowH;
      if (i === this.sel) drawCursor(ctx, x + 20, yy, w - 40, rowH - 2, this.age);
      const it = ITEMS[id];
      const price = this.tab === 0 ? it.price : this.sellPrice(id);
      drawText(ctx, it.name, x + 40, yy + 24, { size: 22, color: it.type === 'treasure' ? TCOL.g : TCOL.w });
      if (this.tab === 0) drawText(ctx, `have ${itemCount(this.p, id)}`, x + w - 170, yy + 24, { size: 18, align: 'right', color: TCOL.d });
      drawText(ctx, price + ' g', x + w - 40, yy + 24, { size: 22, align: 'right', color: this.tab === 0 && price > this.p.gold ? TCOL.r : TCOL.g });
    });
    if (!list.length) drawText(ctx, this.tab === 1 ? '"You got nothing I want."' : 'Nothing for sale.', x + 40, y + 100, { size: 22, color: TCOL.d, style: 'italic' });
    drawWindow(ctx, x, y + h + 10, w, 150, 0.95);
    const id = list[this.sel];
    if (id) {
      const it = ITEMS[id];
      const stats = gearStats(id);
      drawRich(ctx, layoutRich(ctx, it.desc + (stats ? `  {d}${stats}{/}` : ''), w - 60, 22), x + 30, y + h + 50, 30);
    }
    if (this.note && this.noteT > 0) drawText(ctx, this.note[0], x + w / 2, y + h + 140, { size: 22, align: 'center', color: this.note[1] });
    drawText(ctx, `Pack ${this.p.inv.length}/${MAX_SLOTS}`, x + 30, y + h + 140, { size: 18, color: TCOL.d });
  }
}
