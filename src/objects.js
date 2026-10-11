'use strict';
// Map object sprites (chests, corpses, shrines...) painted as vectors, then pixelized.

const ObjSprites = {
  cache: {},
  get(key) {
    if (this.cache[key]) return this.cache[key];
    const fn = OBJ_PAINT[key];
    if (!fn) return null;
    return (this.cache[key] = fn());
  },
};

function objCanvas(w, h, fn, opt) {
  const c = makeCanvas(w, h);
  fn(c.ctx, new RNG(w * 31 + h * 7 + (opt && opt.seed || 0)));
  return pixelize(c, opt);
}

const OBJ_PAINT = {
  chest: () => objCanvas(16, 14, c => {
    P.rect(c, 2, 5, 12, 8, '#6a4222');
    P.rect(c, 2, 2, 12, 4, '#8a5a30');
    P.rect(c, 2, 5, 12, 1, '#3a2412');
    P.rect(c, 4, 2, 1, 11, '#55555c'); P.rect(c, 11, 2, 1, 11, '#55555c');
    P.rect(c, 7, 5, 2, 3, '#d0a440');
  }),
  chestOpen: () => objCanvas(16, 14, c => {
    P.rect(c, 2, 1, 12, 4, '#4a2c16');
    P.rect(c, 2, 5, 12, 8, '#6a4222');
    P.rect(c, 3, 5, 10, 2, '#140c08');
    P.rect(c, 4, 1, 1, 12, '#55555c'); P.rect(c, 11, 1, 1, 12, '#55555c');
  }, { rim: false }),
  barrel: () => objCanvas(14, 16, c => {
    P.ellipse(c, 7, 9, 5.5, 6.5, '#6e4a2c');
    P.rect(c, 2, 4, 10, 10, '#6e4a2c');
    P.ellipse(c, 7, 3.5, 5, 1.8, '#4a3018');
    P.rect(c, 1.5, 6, 11, 1.4, '#4c4c52'); P.rect(c, 1.5, 11, 11, 1.4, '#4c4c52');
    P.rect(c, 6, 4, 1, 10, '#5a3a20');
  }),
  barrelBroken: () => objCanvas(16, 12, c => {
    P.poly(c, [[2, 10], [4, 5], [6, 9], [8, 4], [10, 8], [13, 5], [14, 10]], '#5a3a20');
    P.rect(c, 3, 9, 10, 2, '#4c4c52');
    P.line(c, 1, 11, 6, 9, 1.5, '#6e4a2c');
  }),
  corpse0: () => objCanvas(18, 12, c => { // adventurer, chainmail
    P.limb(c, 4, 6, 12, 7, 3, 3, '#5a5a62');
    P.circle(c, 14.5, 6.5, 2.4, '#b08a70');
    P.limb(c, 6, 5, 9, 1.5, 1.2, 1, '#5a5a62');
    P.limb(c, 6, 8, 10, 10.5, 1.2, 1, '#5a5a62');
    P.limb(c, 4, 6, 0.8, 4, 1.4, 1.2, '#3a3028');
    P.limb(c, 4, 7, 1.2, 9.5, 1.4, 1.2, '#3a3028');
    P.ellipse(c, 9, 9, 3, 1.4, '#6a120c');
  }),
  corpse1: () => objCanvas(18, 12, c => { // villager
    P.limb(c, 4, 6, 12, 6, 3.2, 3, '#6a5034');
    P.circle(c, 14.5, 6, 2.4, '#c09a7a');
    P.ellipse(c, 15, 4.5, 2, 1.2, '#4a3020');
    P.limb(c, 7, 4, 10, 1, 1.1, 1, '#c09a7a');
    P.limb(c, 4, 5, 0.8, 3.5, 1.3, 1.1, '#3e3a34');
    P.limb(c, 4, 7, 0.8, 9.5, 1.3, 1.1, '#3e3a34');
    P.ellipse(c, 7, 8.5, 3.5, 1.6, '#5a0e0a');
  }),
  corpse2: () => objCanvas(18, 12, c => { // monk / cultist
    P.limb(c, 3, 6, 12, 6.5, 3.5, 3, '#3a2a40');
    P.circle(c, 14.5, 6.5, 2.4, '#a88a70');
    P.limb(c, 7, 8, 11, 10.5, 1.1, 1, '#a88a70');
    P.ellipse(c, 10, 4, 3, 1.3, '#5a0e0a');
  }),
  bones: () => objCanvas(16, 12, c => {
    P.ellipse(c, 9, 7, 3.4, 3, '#d8cfb4');
    P.line(c, 2, 9, 9, 10, 1.6, '#cfc5a8');
    P.line(c, 4, 4, 13, 8, 1.4, '#c4b998');
    P.line(c, 11, 10, 15, 6, 1.4, '#cfc5a8');
  }, { light: 0.1 }),
  goldSmall: () => objCanvas(12, 8, c => {
    P.ellipse(c, 6, 5, 4, 2.2, '#b8862a');
    P.ellipse(c, 5, 4, 2, 1.3, '#e8b84a');
    P.ellipse(c, 8, 4.5, 1.5, 1, '#e8b84a');
  }, { outline: '#2a1a08', light: 0.35 }),
  goldLarge: () => objCanvas(16, 11, c => {
    P.ellipse(c, 8, 7, 6.5, 3.4, '#a87a24');
    P.ellipse(c, 8, 5.5, 4.5, 2.6, '#d8a83c');
    P.ellipse(c, 7, 4, 2.4, 1.6, '#f0c85a');
    P.ellipse(c, 11, 6, 1.6, 1.1, '#f0c85a');
    P.ellipse(c, 4, 6.5, 1.5, 1, '#f0c85a');
  }, { outline: '#2a1a08', light: 0.35 }),
  sack: () => objCanvas(12, 12, c => {
    P.ellipse(c, 6, 8, 4.5, 3.6, '#8a7450');
    P.poly(c, [[4, 5], [8, 5], [7, 2], [5, 2]], '#8a7450');
    P.rect(c, 4, 4, 4, 1.2, '#4a3a22');
  }),
  shrine: () => objCanvas(16, 22, c => {
    P.rect(c, 3, 17, 10, 4, '#4a4640');
    P.poly(c, [[5, 17], [11, 17], [10, 4], [8, 1], [6, 4]], '#6a6660');
    P.rect(c, 7, 7, 2, 6, '#2a2830');
  }),
  altar: () => objCanvas(18, 14, c => {
    P.rect(c, 1, 5, 16, 8, '#5a5450');
    P.rect(c, 1, 3, 16, 3, '#6e6862');
    P.rect(c, 3, 3, 12, 2, '#7a140e');
    P.rect(c, 5, 8, 8, 3, '#3a3634');
  }),
  note: () => objCanvas(12, 9, c => {
    P.poly(c, [[1, 3], [10, 1], [11, 7], [2, 8]], '#d4c8a4');
    P.line(c, 3, 4, 9, 3, 0.8, '#6a5a44');
    P.line(c, 3, 6, 8, 5, 0.8, '#6a5a44');
  }, { light: 0.05 }),
  sarcophagus: () => objCanvas(16, 18, c => {
    P.rect(c, 2, 2, 12, 15, '#5e5a52');
    P.ellipse(c, 8, 3, 6, 2, '#5e5a52');
    P.rect(c, 3, 3, 10, 13, '#6e6a62');
    P.rect(c, 7, 5, 2, 9, '#4a4640'); P.rect(c, 5, 7, 6, 2, '#4a4640');
  }),
  sarcophagusOpen: () => objCanvas(16, 18, c => {
    P.rect(c, 2, 2, 12, 15, '#5e5a52');
    P.ellipse(c, 8, 3, 6, 2, '#5e5a52');
    P.rect(c, 4, 4, 8, 11, '#120e0c');
    P.poly(c, [[10, 9], [16, 7], [16, 18], [12, 18]], '#6e6a62');
  }, { rim: false }),
  bedroll: () => objCanvas(18, 10, c => {
    P.rect(c, 1, 2, 16, 7, '#5a3a2a');
    P.rect(c, 1, 2, 5, 7, '#8a7a60');
    P.rect(c, 7, 3, 9, 1, '#6a4a34');
  }),
  well: () => objCanvas(18, 18, c => {
    P.ellipse(c, 9, 11, 8, 5.5, '#5a5650');
    P.ellipse(c, 9, 10, 5.5, 3.2, '#0a0808');
    P.rect(c, 1, 2, 2, 9, '#4a3420'); P.rect(c, 15, 2, 2, 9, '#4a3420');
    P.rect(c, 1, 1, 16, 2, '#5a4028');
  }),
  pew: () => objCanvas(16, 10, c => {
    P.rect(c, 0, 1, 16, 4, '#4e3420');
    P.rect(c, 0, 5, 16, 3, '#3a2616');
    P.rect(c, 1, 7, 2, 3, '#2e1e10'); P.rect(c, 13, 7, 2, 3, '#2e1e10');
  }),
  candelabra: () => objCanvas(10, 18, c => {
    P.rect(c, 4, 5, 2, 12, '#7a6a40');
    P.rect(c, 2, 16, 6, 2, '#7a6a40');
    P.rect(c, 1, 5, 8, 1.4, '#7a6a40');
    P.rect(c, 1, 2, 1.4, 3, '#e8e0c8'); P.rect(c, 4.3, 1, 1.4, 4, '#e8e0c8'); P.rect(c, 7.6, 2, 1.4, 3, '#e8e0c8');
  }, { light: 0.25 }),
  sconce: () => objCanvas(8, 10, c => {
    P.rect(c, 3, 3, 2, 6, '#5a4028');
    P.rect(c, 1, 8, 6, 1.5, '#3a3a40');
    P.rect(c, 2, 2, 4, 2, '#2a1a10');
  }),
  brazier: () => objCanvas(14, 14, c => {
    P.poly(c, [[1, 4], [13, 4], [10, 9], [4, 9]], '#3a3434');
    P.rect(c, 6, 9, 2, 4, '#3a3434');
    P.rect(c, 3, 12, 8, 2, '#3a3434');
    P.rect(c, 2, 3, 10, 2, '#6a2a14');
  }),
  hanging: () => objCanvas(12, 24, c => {
    P.rect(c, 5.5, 0, 1, 5, '#55555c');
    P.limb(c, 6, 6, 6, 15, 2.8, 2.4, '#b88878');
    P.circle(c, 6, 5, 2.4, '#b88878');
    P.limb(c, 5, 15, 4, 22, 1.2, 1, '#b88878');
    P.limb(c, 7, 15, 8, 22, 1.2, 1, '#b88878');
    P.ellipse(c, 6, 11, 2.4, 3.5, '#7a1810');
  }),
  graveCross: () => objCanvas(12, 16, c => {
    P.rect(c, 5, 2, 2.2, 13, '#4e3c2a');
    P.rect(c, 2, 5, 8, 2, '#4e3c2a');
    P.ellipse(c, 6, 14.5, 5, 1.5, '#3a3020');
  }),
  graveStone: () => objCanvas(12, 14, c => {
    P.rect(c, 2, 4, 8, 9, '#6a6662');
    P.ellipse(c, 6, 4.5, 4, 3, '#6a6662');
    P.rect(c, 4, 6, 4, 1, '#3a3836');
  }),
  cauldron: () => objCanvas(16, 14, c => {
    P.ellipse(c, 8, 8, 6.5, 5, '#2a2a2e');
    P.ellipse(c, 8, 4.5, 6, 1.8, '#3a6a2a');
    P.rect(c, 3, 12, 2, 2, '#2a2a2e'); P.rect(c, 11, 12, 2, 2, '#2a2a2e');
  }),
  crow: () => objCanvas(8, 6, c => {
    P.ellipse(c, 4, 3.5, 2.6, 1.8, '#151216');
    P.circle(c, 6.4, 2.3, 1.3, '#151216');
    P.rect(c, 7.3, 2.2, 1, 0.8, '#5a4a30');
    P.line(c, 1.5, 3, 0, 2, 1, '#151216');
  }, { outline: null, light: 0.2 }),
  tree: () => objCanvas(20, 30, (c, r) => {
    P.limb(c, 10, 29, 10, 10, 2.4, 1.4, '#2a1e16');
    P.limb(c, 10, 16, 3, 7, 1, 0.5, '#2a1e16');
    P.limb(c, 10, 13, 17, 5, 1, 0.5, '#2a1e16');
    P.limb(c, 10, 11, 8, 2, 0.8, 0.4, '#2a1e16');
    P.limb(c, 5, 10, 2, 11, 0.6, 0.3, '#2a1e16');
    P.limb(c, 14, 9, 18, 10, 0.6, 0.3, '#2a1e16');
  }, { outline: '#080605', light: 0.12 }),
  bookshelf: () => objCanvas(16, 20, (c, r) => {
    P.rect(c, 1, 1, 14, 19, '#3a2616');
    for (let y = 3; y < 18; y += 5) {
      for (let x = 2; x < 14; x += 2) {
        P.rect(c, x, y, 1.6, 4, r.pick(['#5a1a14', '#2a3a5a', '#4a3a1a', '#3a4a2a', '#6a5a3a']));
      }
      P.rect(c, 1, y + 4, 14, 1, '#24160c');
    }
  }),
  rack: () => objCanvas(16, 18, c => {
    P.rect(c, 1, 14, 14, 2, '#3a2616');
    P.rect(c, 2, 2, 1.5, 13, '#3a2616'); P.rect(c, 12.5, 2, 1.5, 13, '#3a2616');
    P.rect(c, 2, 4, 12, 1.4, '#3a2616');
    P.line(c, 6, 3, 6, 14, 1.2, '#8a8a92');
    P.line(c, 9, 3, 10, 14, 1.2, '#8a8a92');
  }),
  sign: () => objCanvas(14, 16, c => {
    P.rect(c, 6, 4, 2, 12, '#4a3420');
    P.rect(c, 1, 3, 12, 5, '#6a4c30');
    P.line(c, 3, 5.5, 11, 5.5, 0.8, '#2a1a10');
  }),
  cart: () => objCanvas(22, 16, c => {
    P.poly(c, [[2, 6], [18, 4], [19, 10], [3, 11]], '#4a3420');
    P.circle(c, 6, 12, 3, '#2e2016');
    P.circle(c, 6, 12, 1, '#4a3420');
    P.line(c, 18, 8, 22, 15, 1.2, '#3a2616');
  }),
  mushrooms: () => objCanvas(14, 10, c => {
    P.rect(c, 3, 5, 1.5, 4, '#d8d0c0'); P.ellipse(c, 3.7, 4.5, 3, 1.8, '#c8c0b0');
    P.rect(c, 9, 4, 1.5, 5, '#d8d0c0'); P.ellipse(c, 9.7, 3.5, 3.4, 2, '#b8b0a8');
    P.ellipse(c, 6.5, 8, 2, 1.2, '#a8a098');
  }, { light: 0.25 }),
  soulstone: () => objCanvas(10, 12, c => {
    P.poly(c, [[5, 1], [9, 5], [5, 11], [1, 5]], '#c02818');
    P.poly(c, [[5, 2], [7, 5], [5, 8], [3, 5]], '#f05a40');
  }, { outline: '#200404', light: 0.4 }),
  stake: () => objCanvas(12, 22, c => {
    P.rect(c, 5, 2, 2, 19, '#2e2016');
    P.ellipse(c, 6, 20, 5, 2, '#1e1610');
    P.limb(c, 6, 8, 6, 15, 2.2, 2, '#3a2a22');
    P.circle(c, 6, 6.5, 2, '#3a2a22');
  }),
};

// Animated flame, drawn above the darkness layer.
function drawFlame(ctx, x, y, t, size = 1, seed = 0) {
  const f = Math.sin(t / 70 + seed * 3.1) + Math.sin(t / 113 + seed);
  const h = Math.round((2.5 + f * 0.6) * size);
  const cols = ['#fff4b0', '#ffc840', '#f07a20', '#b8341a'];
  for (let i = 0; i < h + 2; i++) {
    const w = Math.max(1, Math.round((h + 2 - i) * 0.55 * size));
    const sway = Math.round(Math.sin(t / 90 + i + seed) * 0.6 * (i / (h + 1)));
    const col = cols[Math.min(3, Math.floor(i / (h + 2) * 3.2 + (i === 0 ? 0 : 0.4)))];
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x - w / 2 + sway), Math.round(y - i), w, 1);
  }
}
