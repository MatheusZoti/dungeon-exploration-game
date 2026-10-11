'use strict';
// Procedural pixel art: tiles per theme, decals, map sprites for characters and objects.

const T = {
  VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3, DOOR_OPEN: 4, DOWN: 5, UP: 6,
  WATER: 7, LAVA: 8, ROAD: 9, TREE: 10, RUBBLE: 11, BRIDGE: 12,
  SURFACE: 13, ENTRANCE: 14, CRYPT: 15, FISSURE: 16, STONE: 17, FENCE: 18, PILLAR: 19,
};
const TINFO = [];
(function () {
  const def = (id, walk, opaque) => { TINFO[id] = { walk, opaque }; };
  def(T.VOID, false, true); def(T.FLOOR, true, false); def(T.WALL, false, true);
  def(T.DOOR, false, true); def(T.DOOR_OPEN, true, false); def(T.DOWN, true, false);
  def(T.UP, true, false); def(T.WATER, false, false); def(T.LAVA, false, false);
  def(T.ROAD, true, false); def(T.TREE, false, false); def(T.RUBBLE, false, false);
  def(T.BRIDGE, true, false); def(T.SURFACE, true, false); def(T.ENTRANCE, true, false);
  def(T.CRYPT, true, false); def(T.FISSURE, true, false); def(T.STONE, false, true);
  def(T.FENCE, false, false); def(T.PILLAR, false, true);
})();
// Tiles drawn as a vertical wall (face when floor is below them).
function wallLike(t) {
  return t === T.WALL || t === T.STONE || t === T.VOID || t === T.PILLAR ||
    t === T.DOOR || t === T.DOOR_OPEN || t === T.ENTRANCE;
}

const THEMES = {
  town: {
    title: 'Ruins of Tristram', floorStyle: 'grass', wallStyle: 'timber', ambient: 0.5,
    floor: '#3b3828', grout: '#29261b', grass: '#56562f', grassDark: '#3b3f22',
    wall: '#3c2c20', wallDark: '#1f1611', mortar: '#120c09', top: '#15100c', topRim: '#3b2f25',
    road: '#59544b', roadDark: '#2f2b26', water: '#172b36', waterLight: '#355767',
    stone: '#5e5a55', stoneDark: '#3a3733',
  },
  cathedral: {
    title: 'Cathedral', floorStyle: 'flag', wallStyle: 'brick', ambient: 0,
    floor: '#4f473d', grout: '#2b2620', wall: '#5f574b', wallDark: '#3d3730', mortar: '#28221c',
    top: '#141110', topRim: '#3b352d',
  },
  catacombs: {
    title: 'Catacombs', floorStyle: 'brick', wallStyle: 'block', ambient: 0,
    floor: '#47352a', grout: '#251912', wall: '#56412f', wallDark: '#36281d', mortar: '#1f150e',
    top: '#110c09', topRim: '#34261c', bone: '#d6cdb2',
  },
  caves: {
    title: 'Caves', floorStyle: 'dirt', wallStyle: 'rock', ambient: 0,
    floor: '#3f3529', grout: '#2a2219', wall: '#4f4537', wallDark: '#312a20', mortar: '#1b1711',
    top: '#100d0a', topRim: '#2f281f', water: '#14303a', waterLight: '#2f5d66',
    lava: '#c4401a', lavaLight: '#f8a434',
  },
  hell: {
    title: 'Hell', floorStyle: 'hell', wallStyle: 'hellbrick', ambient: 0.02,
    floor: '#3b1c18', grout: '#1d0b09', wall: '#4b2119', wallDark: '#2e120e', mortar: '#150706',
    top: '#0d0505', topRim: '#2f1310', glow: '#d4481c', lava: '#d0421b', lavaLight: '#ffb444',
  },
};
function themeForDepth(d) {
  if (d <= 0) return 'town';
  if (d <= 4) return 'cathedral';
  if (d <= 8) return 'catacombs';
  if (d <= 12) return 'caves';
  return 'hell';
}

// ---------------------------------------------------------------- tile painters
function tcan(seed, fn) {
  const c = makeCanvas(TILE, TILE);
  fn(c.ctx, new RNG(seed));
  return c;
}
function speckle(ctx, rng, n, base, amt) {
  for (let i = 0; i < n; i++) {
    px(ctx, rng.int(0, 15), rng.int(0, 15), shade(base, rng.range(-amt, amt)));
  }
}

function paintFloor(ctx, rng, th, v) {
  const st = th.floorStyle;
  if (st === 'flag' || st === 'hell') {
    P.rect(ctx, 0, 0, 16, 16, th.grout);
    for (let row = 0; row < 2; row++) {
      const y0 = row * 8;
      let sx = -rng.int(0, 5);
      while (sx < 16) {
        const w = rng.int(5, 10);
        const col = shade(th.floor, rng.range(-0.13, 0.09));
        const x0 = Math.max(0, sx + 1), x1 = Math.min(16, sx + w);
        if (x1 > x0) {
          P.rect(ctx, x0, y0 + 1, x1 - x0, 7, col);
          P.rect(ctx, x0, y0 + 1, x1 - x0, 1, shade(col, 0.1));
          P.rect(ctx, x0, y0 + 7, x1 - x0, 1, shade(col, -0.16));
        }
        sx += w;
      }
    }
    speckle(ctx, rng, 14, th.floor, 0.22);
    if (v === 2) { // crack
      let x = rng.int(3, 12), y = rng.int(2, 6);
      for (let i = 0; i < 7; i++) { px(ctx, x, y, th.grout); x += rng.int(-1, 1); y += 1; }
    }
    if (st === 'hell' && v >= 2) {
      let x = rng.int(2, 13), y = rng.int(1, 4);
      for (let i = 0; i < 10; i++) {
        px(ctx, x, y, i % 3 ? th.glow : shade(th.glow, 0.3));
        x = clamp(x + rng.int(-1, 1), 0, 15); y = Math.min(15, y + 1);
      }
    }
  } else if (st === 'brick') {
    P.rect(ctx, 0, 0, 16, 16, th.grout);
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * 3;
      for (let bx = -off; bx < 16; bx += 6) {
        const col = shade(th.floor, rng.range(-0.15, 0.08));
        const x0 = Math.max(0, bx), x1 = Math.min(16, bx + 5);
        if (x1 > x0) {
          P.rect(ctx, x0, row * 4, x1 - x0, 3, col);
          P.rect(ctx, x0, row * 4, x1 - x0, 1, shade(col, 0.08));
        }
      }
    }
    speckle(ctx, rng, 10, th.floor, 0.25);
  } else if (st === 'dirt') {
    P.rect(ctx, 0, 0, 16, 16, th.floor);
    for (let i = 0; i < 26; i++) px(ctx, rng.int(0, 15), rng.int(0, 15), shade(th.floor, rng.range(-0.2, 0.12)), rng.int(1, 2), 1);
    for (let i = 0; i < (v === 1 ? 4 : 2); i++) {
      const x = rng.int(1, 13), y = rng.int(1, 13);
      px(ctx, x, y, shade(th.wall, 0.1), 2, 1);
      px(ctx, x, y + 1, shade(th.wall, -0.25), 2, 1);
    }
  } else if (st === 'grass') {
    P.rect(ctx, 0, 0, 16, 16, th.floor);
    for (let i = 0; i < 30; i++) px(ctx, rng.int(0, 15), rng.int(0, 15), shade(th.floor, rng.range(-0.18, 0.12)));
    const tufts = v === 0 ? 1 : v === 1 ? 4 : v === 2 ? 2 : 0;
    for (let i = 0; i < tufts; i++) {
      const x = rng.int(1, 13), y = rng.int(3, 14);
      px(ctx, x, y - 2, th.grass); px(ctx, x + 1, y - 3, th.grass);
      px(ctx, x + 2, y - 1, th.grassDark); px(ctx, x, y, th.grassDark, 3, 1);
    }
    if (v === 3) { // ash
      for (let i = 0; i < 8; i++) px(ctx, rng.int(0, 15), rng.int(0, 15), '#55524c');
    }
  }
}

function paintFace(ctx, rng, th, v) {
  const st = th.wallStyle;
  if (st === 'brick' || st === 'hellbrick') {
    P.rect(ctx, 0, 0, 16, 16, th.mortar);
    P.rect(ctx, 0, 0, 16, 2, shade(th.wall, 0.12));
    P.rect(ctx, 0, 1, 16, 1, shade(th.wall, -0.1));
    for (let row = 0; row < 3; row++) {
      const y = 2 + row * 4;
      const off = (row % 2) * 4;
      for (let bx = -off; bx < 16; bx += 8) {
        if (v === 2 && row === 1 && bx === 4) continue; // missing brick
        const col = shade(th.wall, rng.range(-0.14, 0.08));
        const x0 = Math.max(0, bx), x1 = Math.min(16, bx + 7);
        if (x1 <= x0) continue;
        P.rect(ctx, x0, y, x1 - x0, 3, col);
        P.rect(ctx, x0, y, x1 - x0, 1, shade(col, 0.12));
      }
    }
    P.rect(ctx, 0, 14, 16, 2, th.wallDark);
    P.rect(ctx, 0, 15, 16, 1, shade(th.wallDark, -0.4));
    speckle(ctx, rng, 8, th.wall, 0.2);
    if (st === 'hellbrick' && v === 1) {
      for (let y = 3; y < 14; y += 4) px(ctx, rng.int(0, 15), y + 3, th.glow, 2, 1);
    }
  } else if (st === 'block') {
    P.rect(ctx, 0, 0, 16, 16, th.mortar);
    P.rect(ctx, 0, 0, 16, 2, shade(th.wall, 0.08));
    for (let row = 0; row < 2; row++) {
      const y = 2 + row * 6;
      const off = row ? 4 : 0;
      for (let bx = -off; bx < 16; bx += 8) {
        const col = shade(th.wall, rng.range(-0.12, 0.07));
        const x0 = Math.max(0, bx), x1 = Math.min(16, bx + 7);
        if (x1 <= x0) continue;
        P.rect(ctx, x0, y, x1 - x0, 5, col);
        P.rect(ctx, x0, y, x1 - x0, 1, shade(col, 0.12));
      }
    }
    if (v === 1 || v === 2) { // skull niche
      P.rect(ctx, 5, 4, 6, 6, '#0a0705');
      px(ctx, 6, 6, th.bone, 4, 3); px(ctx, 7, 9, th.bone, 2, 1);
      px(ctx, 7, 7, '#0a0705'); px(ctx, 9, 7, '#0a0705');
    }
    P.rect(ctx, 0, 14, 16, 2, th.wallDark);
    speckle(ctx, rng, 8, th.wall, 0.2);
  } else if (st === 'rock') {
    P.rect(ctx, 0, 0, 16, 16, th.wallDark);
    for (let i = 0; i < 6; i++) {
      const x = rng.int(-2, 13), y = rng.int(-1, 11), w = rng.int(4, 8), h = rng.int(3, 6);
      const col = shade(th.wall, rng.range(-0.15, 0.1));
      P.rect(ctx, x, y, w, h, col);
      P.rect(ctx, x, y, w, 1, shade(col, 0.15));
      P.rect(ctx, x, y + h - 1, w, 1, shade(col, -0.25));
    }
    P.rect(ctx, 0, 15, 16, 1, shade(th.wallDark, -0.4));
    speckle(ctx, rng, 10, th.wall, 0.25);
  } else if (st === 'timber') {
    P.rect(ctx, 0, 0, 16, 16, th.wallDark);
    for (let x = 0; x < 16; x += 4) {
      const col = shade(th.wall, rng.range(-0.25, 0.1));
      P.rect(ctx, x, 0, 3, 16, col);
      P.rect(ctx, x, 0, 1, 16, shade(col, 0.12));
      if (rng.chance(0.4)) P.rect(ctx, x, rng.int(0, 12), 3, rng.int(2, 5), '#0e0a08');
    }
    P.rect(ctx, 0, 5, 16, 2, shade(th.wall, -0.2));
    if (v === 1) for (let i = 0; i < 3; i++) px(ctx, rng.int(0, 15), rng.int(2, 14), rng.pick(['#e0782c', '#b84a1c']));
    P.rect(ctx, 0, 15, 16, 1, '#0a0806');
  } else if (st === 'stone') {
    th = Object.assign({ stone: th.wall, stoneDark: th.wallDark }, th);
    P.rect(ctx, 0, 0, 16, 16, th.stoneDark);
    for (let row = 0; row < 2; row++) {
      for (let bx = row ? -4 : 0; bx < 16; bx += 8) {
        const col = shade(th.stone, rng.range(-0.12, 0.08));
        const x0 = Math.max(0, bx), x1 = Math.min(16, bx + 7);
        if (x1 <= x0) continue;
        P.rect(ctx, x0, row * 8 + 1, x1 - x0, 6, col);
        P.rect(ctx, x0, row * 8 + 1, x1 - x0, 1, shade(col, 0.14));
      }
    }
    if (v === 1) { // lancet window
      P.rect(ctx, 6, 3, 4, 11, '#0b0a0c');
      px(ctx, 7, 2, '#0b0a0c', 2, 1);
      px(ctx, 7, 6, '#5a1a10', 2, 5);
    }
    speckle(ctx, rng, 8, th.stone, 0.2);
  }
}

function paintTop(ctx, rng, th) {
  P.rect(ctx, 0, 0, 16, 16, th.top);
  for (let i = 0; i < 10; i++) px(ctx, rng.int(0, 15), rng.int(0, 15), shade(th.top, rng.range(0.05, 0.35)));
}

function buildTileset(themeId) {
  const th = THEMES[themeId];
  const base = themeId.length * 977;
  const ts = { th };
  ts.floor = [0, 1, 2, 3].map(v => tcan(base + v * 13, (c, r) => paintFloor(c, r, th, v)));
  const faceTheme = themeId === 'town' ? th : th;
  ts.face = [0, 1, 2].map(v => tcan(base + 100 + v * 7, (c, r) => paintFace(c, r, faceTheme, v)));
  ts.top = tcan(base + 200, (c, r) => paintTop(c, r, th));
  if (themeId === 'town') {
    const st = Object.assign({}, th, { wallStyle: 'stone' });
    ts.stoneFace = [0, 1].map(v => tcan(base + 300 + v, (c, r) => paintFace(c, r, st, v)));
    ts.road = [0, 1].map(v => tcan(base + 400 + v, (c, r) => {
      P.rect(c, 0, 0, 16, 16, th.roadDark);
      for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? -2 : 0; x < 16; x += 4) {
        const col = shade(th.road, r.range(-0.18, 0.1));
        P.rect(c, x + 0.5, y + 0.5, 3, 3, col);
        px(c, x + 1, y + 1, shade(col, 0.15));
      }
      if (v) for (let i = 0; i < 5; i++) px(c, r.int(0, 15), r.int(0, 15), '#2a2622', 2, 1);
    }));
  }
  // Doors (face style)
  ts.door = tcan(base + 500, (c, r) => {
    paintFace(c, r, th, 0);
    P.rect(c, 3, 2, 10, 14, '#0c0806');
    P.rect(c, 4, 3, 8, 13, '#5a3a1e');
    for (let x = 4; x < 12; x += 2) P.rect(c, x, 3, 1, 13, '#3e2612');
    P.rect(c, 4, 6, 8, 1, '#2c2c30'); P.rect(c, 4, 12, 8, 1, '#2c2c30');
    px(c, 10, 9, '#a08a50');
    P.rect(c, 5, 2, 6, 1, '#0c0806');
  });
  ts.doorOpen = tcan(base + 501, (c, r) => {
    paintFace(c, r, th, 0);
    P.rect(c, 3, 2, 10, 14, '#050304');
    P.rect(c, 3, 2, 2, 14, '#5a3a1e');
    P.rect(c, 3, 2, 1, 14, '#3e2612');
    P.rect(c, 5, 13, 8, 3, shade(th.floor, -0.45));
  });
  ts.down = tcan(base + 600, (c, r) => {
    paintFloor(c, r, th, 0);
    P.rect(c, 1, 1, 14, 14, '#0a0806');
    for (let i = 0; i < 5; i++) {
      const col = shade(th.floor, -0.15 - i * 0.16);
      P.rect(c, 2, 2 + i * 3, 12, 2, col);
      P.rect(c, 2, 2 + i * 3, 12, 1, shade(col, 0.15));
    }
  });
  ts.up = tcan(base + 601, (c, r) => {
    paintFloor(c, r, th, 0);
    for (let i = 0; i < 5; i++) {
      const col = shade(th.floor, 0.22 - i * 0.1);
      P.rect(c, 2, 13 - i * 3, 12, 3, col);
      P.rect(c, 2, 13 - i * 3, 12, 1, shade(col, 0.2));
      P.rect(c, 2, 15 - i * 3, 12, 1, shade(col, -0.35));
    }
    P.rect(c, 1, 0, 1, 16, '#0a0806'); P.rect(c, 14, 0, 1, 16, '#0a0806');
  });
  const liquid = (col, light, frame, lava) => tcan(base + 700 + frame + (lava ? 10 : 0), (c, r) => {
    P.rect(c, 0, 0, 16, 16, col);
    for (let i = 0; i < 18; i++) px(c, r.int(0, 15), r.int(0, 15), shade(col, r.range(-0.15, 0.1)));
    for (let y = 2; y < 16; y += 5) {
      const x0 = (frame * 3 + y * 2) % 16;
      px(c, x0, y, light, 4, 1);
      px(c, (x0 + 9) % 16, y + 2, shade(light, -0.2), 3, 1);
    }
    if (lava) {
      for (let i = 0; i < 4; i++) px(c, r.int(0, 14), r.int(0, 14), '#40140a', 2, 2);
      px(c, (frame * 5 + 3) % 15, (frame * 7 + 4) % 15, '#ffe890', 2, 1);
    }
  });
  const wcol = th.water || '#16303a', wl = th.waterLight || '#2f5d66';
  ts.water = [0, 1, 2].map(f => liquid(wcol, wl, f, false));
  const lc = th.lava || '#c4401a', ll = th.lavaLight || '#f8a434';
  ts.lava = [0, 1, 2].map(f => liquid(lc, ll, f, true));
  ts.rubble = [0, 1].map(v => tcan(base + 800 + v, (c, r) => {
    paintFloor(c, r, th, 3);
    for (let i = 0; i < 7; i++) {
      const x = r.int(0, 11), y = r.int(3, 12), w = r.int(3, 6), h = r.int(2, 4);
      const col = shade(themeId === 'town' ? '#4a4038' : th.wall, r.range(-0.2, 0.1));
      P.rect(c, x, y, w, h, col);
      P.rect(c, x, y, w, 1, shade(col, 0.2));
      P.rect(c, x, y + h, w, 1, '#0a0806');
    }
    if (themeId === 'town') { P.rect(c, 2, 6, 12, 2, '#1e140e'); P.rect(c, 2, 6, 12, 1, '#3a2a1c'); }
  }));
  ts.bridge = tcan(base + 900, (c, r) => {
    P.rect(c, 0, 0, 16, 16, '#3a2818');
    for (let y = 0; y < 16; y += 4) {
      const col = shade('#6a4a2c', r.range(-0.15, 0.1));
      P.rect(c, 0, y, 16, 3, col);
      P.rect(c, 0, y, 16, 1, shade(col, 0.15));
      px(c, r.int(1, 14), y + 1, '#2a1a10');
    }
  });
  ts.fence = tcan(base + 901, (c, r) => {
    paintFloor(c, r, th, 0);
    P.rect(c, 2, 4, 2, 11, '#3e2c1c'); P.rect(c, 12, 6, 2, 9, '#3e2c1c');
    P.rect(c, 0, 7, 16, 2, '#4e3824'); P.rect(c, 0, 11, 9, 2, '#4e3824');
    P.rect(c, 0, 7, 16, 1, '#6a4c30');
  });
  ts.fissure = tcan(base + 902, (c, r) => {
    paintFloor(c, r, th, 0);
    P.poly(c, [[2, 8], [6, 3], [10, 5], [14, 2], [13, 9], [9, 13], [4, 12]], '#050304');
    P.poly(c, [[5, 8], [7, 5], [11, 7], [9, 11]], '#000');
  });
  ts.crypt = tcan(base + 903, (c, r) => {
    P.rect(c, 0, 0, 16, 16, '#2e2c2a');
    P.rect(c, 1, 1, 14, 15, '#4a4744');
    P.rect(c, 3, 4, 10, 12, '#070506');
    for (let i = 0; i < 4; i++) P.rect(c, 3, 6 + i * 3, 10, 1, shade('#4a4744', -0.3 - i * 0.1));
    P.rect(c, 7, 0, 2, 4, '#6a6762'); P.rect(c, 5, 1, 6, 1, '#6a6762');
  });
  ts.cryptBarred = tcan(base + 904, (c, r) => {
    c.drawImage(ts.crypt, 0, 0);
    for (let x = 4; x < 13; x += 2) P.rect(c, x, 4, 1, 12, '#5a5a62');
    P.rect(c, 3, 8, 10, 1, '#5a5a62');
  });
  ts.entrance = tcan(base + 905, (c, r) => {
    const st = Object.assign({}, th, { wallStyle: 'stone' });
    paintFace(c, r, st, 0);
    P.rect(c, 2, 2, 12, 14, '#050304');
    P.rect(c, 4, 1, 8, 1, '#050304');
    P.rect(c, 2, 2, 1, 14, '#2e2a26'); P.rect(c, 13, 2, 1, 14, '#2e2a26');
    px(c, 6, 10, '#5a1408', 4, 6);
    P.rect(c, 0, 4, 2, 12, '#3a2414'); // torn door leaf
  });
  ts.surface = tcan(base + 906, (c, r) => {
    c.drawImage(ts.up, 0, 0);
    P.rect(c, 4, 0, 8, 2, '#8a8070');
  });
  return ts;
}

const Tiles = {
  sets: {},
  get(theme) { return this.sets[theme] || (this.sets[theme] = buildTileset(theme)); },
};

// ---------------------------------------------------------------- decals
const DECAL = { NONE: 0, BLOOD1: 1, BLOOD2: 2, BLOOD3: 3, BONES1: 4, BONES2: 5, CRACK: 6, GRIME: 7, ASH: 8, PENTA: 9, SKULL: 10 };
const Decals = {
  list: null,
  build() {
    const mk = (seed, fn) => {
      const c = makeCanvas(16, 16);
      fn(c.ctx, new RNG(seed));
      return c;
    };
    const blood = (seed, n, big) => mk(seed, (c, r) => {
      for (let i = 0; i < n; i++) {
        const x = r.int(2, 13), y = r.int(3, 13);
        const rr = r.range(1, big ? 3.2 : 2);
        P.ellipse(c, x, y, rr * 1.4, rr, r.chance(0.5) ? '#5a0e0a' : '#741812');
      }
      for (let i = 0; i < n * 2; i++) px(c, r.int(0, 15), r.int(0, 15), '#4a0a08');
      Decals.harden(c);
    });
    const bones = (seed, skull) => mk(seed, (c, r) => {
      for (let i = 0; i < 3; i++) {
        const x = r.int(2, 11), y = r.int(4, 13), dx = r.int(-4, 4), dy = r.int(-2, 2);
        P.line(c, x, y, x + dx, y + dy, 1.2, '#cfc5a8');
        px(c, x - 1, y, '#cfc5a8', 2, 2); px(c, x + dx, y + dy, '#cfc5a8', 2, 2);
      }
      if (skull) {
        P.ellipse(c, 9, 8, 3, 2.6, '#ddd4b8');
        px(c, 7, 8, '#1a1210'); px(c, 10, 8, '#1a1210'); px(c, 8, 10, '#ddd4b8', 3, 1);
      }
      Decals.harden(c);
    });
    this.list = [];
    this.list[DECAL.BLOOD1] = blood(11, 2, false);
    this.list[DECAL.BLOOD2] = blood(12, 4, true);
    this.list[DECAL.BLOOD3] = blood(13, 6, true);
    this.list[DECAL.BONES1] = bones(14, false);
    this.list[DECAL.BONES2] = bones(15, true);
    this.list[DECAL.CRACK] = mk(16, (c, r) => {
      let x = 3, y = 4;
      for (let i = 0; i < 12; i++) { px(c, x, y, 'rgba(0,0,0,0.6)'); x += r.int(0, 1); y += r.chance(0.6) ? 1 : 0; }
    });
    this.list[DECAL.GRIME] = mk(17, (c, r) => {
      for (let i = 0; i < 5; i++) P.ellipse(c, r.int(2, 13), r.int(2, 13), r.range(1.5, 3), r.range(1, 2), 'rgba(20,30,10,0.35)');
    });
    this.list[DECAL.ASH] = mk(18, (c, r) => {
      for (let i = 0; i < 14; i++) px(c, r.int(0, 15), r.int(0, 15), r.pick(['#5a5650', '#3a3632', '#6a645c']));
      px(c, r.int(2, 13), r.int(2, 13), '#c05a20');
    });
    this.list[DECAL.PENTA] = mk(19, (c, r) => {
      c.strokeStyle = 'rgba(200,40,20,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 4 / 5);
        const x = 8 + Math.cos(a) * 6, y = 8 + Math.sin(a) * 6;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      Decals.harden(c);
    });
    this.list[DECAL.SKULL] = bones(20, true);
  },
  harden(ctx) {
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 90 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
  },
  get(id) { if (!this.list) this.build(); return this.list[id]; },
};

// ---------------------------------------------------------------- character sprites (ascii)
const PLAYER_PAL = {
  o: '#140e0a', H: '#5c4029', h: '#3e2a1b', s: '#d2a684', S: '#a07458', e: '#1a1010',
  C: '#6e5942', c: '#4c3c2b', k: '#2f251b', b: '#22180f', g: '#d4a640', p: '#3b3531', f: '#22180f',
  B: '#6a4a2a',
};
const PLAYER_ROWS = {
  down: mirrorRows([
    '....oo', '...oHH', '..oHHH', '..oHhs', '..ohes', '..ohss', '...okS', '..oCcc',
    '.oCccc', '.osbbg', '.oSccc', '..okcc', '..okpp', '..oppo', '..offo', '...oo.',
  ]),
  up: mirrorRows([
    '....oo', '...oHH', '..oHHH', '..oHHH', '..ohHH', '..ohhH', '...okk', '..oCcc',
    '.oCcBB', '.osbBB', '.oSccc', '..okcc', '..okpp', '..oppo', '..offo', '...oo.',
  ]),
  right: [
    '....oooo....', '...oHHHHo...', '..oHHHHHHo..', '..oHHHhsso..', '..oHHhsseo..',
    '..ohhhssso..', '...okkSSo...', '..oCcccco...', '..oBCcccso..', '..oBbbbgo...',
    '..oBCccco...', '..okcccko...', '...okppo....', '...oppo.....', '...offo.....', '....oo......',
  ],
};
// Leg rows for walk frames (rows 12-15).
const PLAYER_WALK = {
  down: [
    null,
    ['..okppppko..', '..oppo.oppo.', '..offo.offo.', '...oo...oo..'],
    null,
    ['..okppppko..', '.oppo.oppo..', '.offo.offo..', '..oo...oo...'],
  ],
  right: [
    null,
    ['...okppo....', '..oppoopo...', '.offo.offo..', '.oo....oo...'],
    null,
    ['...okppo....', '...oppo.....', '...offo.....', '....oo......'],
  ],
};

const CharSprites = {
  cache: {},
  player(dir, frame) {
    const key = dir + frame;
    if (this.cache[key]) return this.cache[key];
    const base = dir === 'left' ? 'right' : dir;
    let rows = PLAYER_ROWS[base].slice();
    const walkSet = PLAYER_WALK[base === 'up' ? 'down' : base];
    const legs = walkSet && walkSet[frame % 4];
    if (legs) for (let i = 0; i < 4; i++) rows[12 + i] = legs[i];
    let c = spriteFromRows(rows, PLAYER_PAL);
    if (dir === 'left') c = flipH(c);
    return (this.cache[key] = c);
  },
  npc(id) {
    if (this.cache['npc' + id]) return this.cache['npc' + id];
    const d = NPC_SPRITES[id];
    return (this.cache['npc' + id] = spriteFromRows(d.rows, d.pal));
  },
  flipped(spr) {
    if (!this.flipCache) this.flipCache = new Map();
    let f = this.flipCache.get(spr);
    if (!f) { f = flipH(spr); this.flipCache.set(spr, f); }
    return f;
  },
  monster(family, palKey, pal) {
    const key = 'm' + family + palKey;
    if (this.cache[key]) return this.cache[key];
    const rows = MONSTER_MAP_ROWS[family];
    const full = Object.assign({ o: '#0e0a08' }, pal);
    const frames = [spriteFromRows(rows, full)];
    if (family === 'flyer') frames.push(spriteFromRows(MONSTER_MAP_ROWS.flyer2, full));
    else frames.push(frames[0]);
    return (this.cache[key] = frames);
  },
};

const NPC_SPRITES = {
  cain: {
    pal: { o: '#120e0c', R: '#4c4a62', r: '#2f2e40', s: '#d0a888', S: '#a07a60', w: '#e2ddd2', W: '#a8a398', e: '#1a1010', t: '#6a4a2a', T: '#8a6a3a' },
    rows: [
      '.....oooo.....', '....osssso....', '...osSssSso...', '...osessesot..', '...owssssWot..',
      '...owwwwwwoT..', '..oRwwwwwwRoT.', '.oRRrwwwwrRoT.', '.oRRrRwWRrRsT.', '.oRRrRRRRrRoT.',
      '.osRrRRRRrRot.', '..oRrRRRRrRot.', '..oRrRRRRrRot.', '..orrRRRRrrot.', '..orRRRRRRrot.', '...oooooooooo.',
    ],
  },
  wirt: {
    pal: { o: '#120e0c', h: '#8a5a2a', H: '#6a4220', s: '#d6ac88', S: '#a67c5c', e: '#1a1010', g: '#3e6a3a', G: '#2a4a28', p: '#4a3a30', w: '#8a6a40', f: '#2a1e14' },
    rows: [
      '....oooooo....', '...ohhhhhho...', '...ohHhhHho...', '...osesseso...', '...osssssso...',
      '....oSSSSo....', '...ogggggg o..', '..oggGggGggo..', '..osgGggGgso..', '...ogggggggo..',
      '...oppppppo...', '...opp.oppo...', '...opp..ow....', '...opp..ow....', '...off..ow....', '...ooo..oo....',
    ],
  },
  adria: {
    pal: { o: '#120e0c', h: '#1e1a1e', H: '#38303a', s: '#c8a088', e: '#2a0e0e', R: '#5a2a4a', r: '#3a1830', g: '#c8a040' },
    rows: [
      '....oooooo....', '...ohhhhhho...', '..ohhHhhHhho..', '..ohsesseshho.', '..ohssssssho..',
      '..ohhsssshho..', '..oRhhgghhRo..', '.oRRRRRRRRRRo.', '.osRrRRRRrRso.', '..oRrRRRRrRo..',
      '..oRrRRRRrRo..', '..oRrRRRRrRo..', '.oRRrRRRRrRRo.', '.orRrRRRRrRro.', '.orrRRRRRRrro.', '..oooooooooo..',
    ],
  },
};

// Monster map sprites: generic silhouettes recolored per monster.
// Palette keys: 1 main, 2 main dark, 3 accent, 4 accent dark, e eye, w weapon.
const MONSTER_MAP_ROWS = {
  humanoid: mirrorRows([
    '....oo', '...o11', '..o111', '..o1e1', '..o211', '...o22', '..o333', '.o3333',
    '.o2343', '.o2444', '.o1333', '..o344', '..o344', '..o22o', '..o22o', '...oo.',
  ]),
  small: [
    '............', '....o..o....', '...o1oo1o...', '...o1111o...', '...o1e1eo..w',
    '....o111o..w', '...o3333o.ow', '..o13333o1ow', '...o3333o.o.', '....o22o....',
    '....o2o2o...', '....oo.oo...',
  ],
  skeleton: mirrorRows([
    '....oo', '...o11', '..o1e1', '..o111', '...o12', '....o1', '..oo11', '.o1o21',
    '.o1o11', '.o1o21', '.o.o11', '..o1o1', '..o1oo', '..o1o.', '..o1o.', '..oo..',
  ]),
  beast: [
    '................', '................', '................', '..oo.......oo...',
    '.o11o....oo11o..', 'o1e11oooo11111o.', 'o111111111111111o'.slice(0, 16), 'o3311111111112o.',
    '.o3o111111112o..', '..o.o22oo22o2o..', '....o2o..o2oo2o.', '....oo....oo.oo.',
  ],
  flyer: [
    '................', 'o..............o', 'oo....o..o....oo', 'o1o..o1oo1o..o1o',
    'o11o.o1ee1o.o11o', 'o111o111111o111o', 'o1111o1111o1111o', '.o111o2112o111o.',
    '..o1o.o22o.o1o..', '...o..o22o..o...', '.......oo.......',
  ],
  flyer2: [
    '................', '................', '......o..o......', '.....o1oo1o.....',
    '.oo..o1ee1o..oo.', 'o11oo111111oo11o', 'o1111o1111o1111o', 'o111oo2112oo111o',
    'o11o..o22o..o11o', '.oo...o22o...oo.', '.......oo.......',
  ],
  hulk: mirrorRows([
    '.....oo', '....o11', '...o1e1', '...o111', '..oo222', '.o33333', 'o333333',
    'o133333', 'o134444', 'o133333', 'o.o3333', '..o3344', '..o2222', '..o22oo', '..o22o.', '..ooo..',
  ]),
  robed: mirrorRows([
    '....oo', '...o11', '..o111', '..o1ee', '..o211', '...o11', '..o333', '.o3333',
    '.o3343', '.ow333', '.o3343', '..o333', '..o334', '.o3334', '.o3344', '.ooooo',
  ]),
  demon: mirrorRows([
    '.o....o', '.o1..o1', '..o1o11', '...o1e1', '...o111', '..oo222', '.o33333',
    'o333333', 'o133433', 'o133333', 'o.o3333', '..o3344', '..o2222', '..o22oo', '.o222o.', '.oooo..',
  ]),
};
