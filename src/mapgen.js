'use strict';
// Levels: the ruined town and procedurally generated dungeon floors.

class Level {
  constructor(depth, w, h) {
    this.depth = depth;
    this.theme = themeForDepth(depth);
    this.w = w; this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.decal = new Uint8Array(w * h);
    this.explored = new Uint8Array(w * h);
    this.ents = [];
    this.nextId = 1;
    this.up = null; this.down = null; this.surface = null;
    this.ambient = THEMES[this.theme].ambient;
    this.townTrip = 0;
  }
  get name() {
    if (this.depth === 0) return 'The Ruins of Tristram';
    return `${THEMES[this.theme].title}, level ${this.depth}`;
  }
  i(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inb(x, y) ? this.tiles[y * this.w + x] : T.VOID; }
  set(x, y, t) { if (this.inb(x, y)) this.tiles[y * this.w + x] = t; }
  opaque(x, y) { return TINFO[this.get(x, y)].opaque; }
  add(e) { e.id = this.nextId++; this.ents.push(e); return e; }
  remove(e) { const i = this.ents.indexOf(e); if (i >= 0) this.ents.splice(i, 1); }
  entsAt(x, y) { return this.ents.filter(e => e.x === x && e.y === y); }
  blockerAt(x, y) { return this.ents.find(e => e.x === x && e.y === y && e.block); }
  passable(x, y) { return TINFO[this.get(x, y)].walk && !this.blockerAt(x, y); }
  isFloor(x, y) { const t = this.get(x, y); return t === T.FLOOR || t === T.ROAD; }
}

// ---------------------------------------------------------------- helpers
function bfs(L, sx, sy, passFn) {
  const d = new Int32Array(L.w * L.h).fill(-1);
  const q = [sx + sy * L.w];
  d[q[0]] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], x = c % L.w, y = (c / L.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!L.inb(nx, ny)) continue;
      const ni = nx + ny * L.w;
      if (d[ni] >= 0 || !passFn(nx, ny)) continue;
      d[ni] = d[c] + 1;
      q.push(ni);
    }
  }
  return d;
}
const walkTile = L => (x, y) => {
  const t = L.get(x, y);
  return TINFO[t].walk || t === T.DOOR;
};

function addLightEnt(L, kind, x, y, extra) {
  return L.add(Object.assign({ kind, x, y, block: false }, extra));
}

// ---------------------------------------------------------------- town
function buildTown() {
  const W = 52, H = 40;
  const L = new Level(0, W, H);
  const rng = new RNG(1337);
  L.tiles.fill(T.FLOOR);
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.set(x, y, t); };
  // border woods
  for (let x = 0; x < W; x++) { L.set(x, 0, T.TREE); L.set(x, H - 1, T.TREE); if (rng.chance(0.5)) L.set(x, 1, T.TREE); }
  for (let y = 0; y < H; y++) { L.set(0, y, T.TREE); L.set(W - 1, y, T.TREE); if (rng.chance(0.4)) L.set(1, y, T.TREE); }
  // river
  for (let y = 0; y < H; y++) {
    const off = Math.round(Math.sin(y / 5) * 0.7);
    L.set(43 + off, y, T.WATER); L.set(44 + off, y, T.WATER);
    if (y > 1 && y < H - 1) L.set(45 + off, y, T.FLOOR);
  }
  // roads
  rect(3, 19, 46, 20, T.ROAD);
  rect(25, 8, 26, H - 1, T.ROAD);
  rect(10, 8, 40, 8, T.ROAD);
  for (let y = 19; y <= 20; y++) for (let x = 41; x <= 46; x++) if (L.get(x, y) === T.WATER) L.set(x, y, T.BRIDGE);
  // cathedral
  rect(17, 1, 34, 7, T.STONE);
  L.set(25, 7, T.ENTRANCE); L.set(26, 7, T.ENTRANCE);
  // ruined buildings
  const ruin = (x0, y0, x1, y1, gaps) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (!edge) { if (rng.chance(0.3)) L.decal[L.i(x, y)] = DECAL.ASH; continue; }
      L.set(x, y, rng.chance(0.18) ? T.RUBBLE : T.WALL);
    }
    for (const [gx, gy] of gaps) L.set(gx, gy, T.FLOOR);
  };
  ruin(4, 22, 14, 28, [[14, 24], [14, 25], [9, 22]]);          // the Rising Sun tavern: your camp
  ruin(4, 10, 10, 14, [[10, 12], [7, 14]]);                    // Griswold's smithy
  ruin(32, 10, 38, 14, [[35, 14], [32, 12]]);                  // Pepin's house
  ruin(31, 24, 39, 29, [[31, 26], [35, 24]]);                  // Ogden's stable
  ruin(13, 11, 19, 15, [[16, 15]]);                            // Gillian's home
  ruin(46, 11, 50, 15, [[48, 15]]);                            // Adria's hut
  // graveyard
  for (let x = 3; x <= 17; x++) { L.set(x, 31, T.FENCE); L.set(x, 38, T.FENCE); }
  for (let y = 31; y <= 38; y++) { L.set(3, y, T.FENCE); L.set(17, y, T.FENCE); }
  L.set(17, 34, T.FLOOR); L.set(17, 35, T.FLOOR);
  L.set(9, 33, T.CRYPT);
  // fissure
  L.set(40, 35, T.FISSURE);
  // scattered trees and rubble
  for (let i = 0; i < 40; i++) {
    const x = rng.int(2, W - 3), y = rng.int(2, H - 3);
    if (L.get(x, y) === T.FLOOR && !L.decal[L.i(x, y)] && Math.abs(x - 25.5) > 3 && Math.abs(y - 19.5) > 2) L.set(x, y, rng.chance(0.7) ? T.TREE : T.RUBBLE);
  }
  for (let i = 0; i < 60; i++) {
    const x = rng.int(2, W - 3), y = rng.int(2, H - 3);
    if (L.get(x, y) === T.FLOOR) L.decal[L.i(x, y)] = rng.pick([DECAL.ASH, DECAL.ASH, DECAL.BLOOD1, DECAL.GRIME]);
  }
  // keep key spots clear
  const clear = [[9, 25], [10, 26], [8, 26], [22, 22], [21, 22], [47, 17], [49, 17], [35, 32], [9, 34], [40, 36], [26, 37], [6, 12], [29, 17], [20, 21]];
  for (const [x, y] of clear) if (L.get(x, y) === T.TREE || L.get(x, y) === T.RUBBLE) L.set(x, y, T.FLOOR);
  for (let y = 21; y <= 30; y++) for (let x = 11; x <= 30; x++) if (L.get(x, y) === T.TREE) L.set(x, y, T.FLOOR);

  // camp
  L.add({ kind: 'campfire', x: 9, y: 25, block: true, light: { r: 6.5, flicker: 1 } });
  L.add({ kind: 'bedroll', x: 8, y: 26, block: false });
  L.add({ kind: 'well', x: 22, y: 22, block: true });
  L.add({ kind: 'npc', npc: 'cain', x: 21, y: 23, block: true });
  L.add({ kind: 'npc', npc: 'wirt', x: 35, y: 32, block: true });
  L.add({ kind: 'npc', npc: 'adria', x: 47, y: 17, block: true });
  L.add({ kind: 'decor', sprite: 'cauldron', x: 49, y: 17, block: true, light: { r: 2.5, flicker: 1, color: 'green' } });
  L.add({ kind: 'rack', x: 6, y: 12, block: true, taken: false });
  L.add({ kind: 'decor', sprite: 'stake', x: 29, y: 17, block: true });
  L.add({ kind: 'decor', sprite: 'cart', x: 20, y: 21, block: true });
  L.add({ kind: 'sign', x: 27, y: 37, block: true });
  // graves
  for (let gy = 33; gy <= 37; gy += 2) for (let gx = 5; gx <= 15; gx += 3) {
    if ((gx === 8 || gx === 11) && gy === 33) continue;
    L.add({ kind: 'decor', sprite: rng.chance(0.5) ? 'graveCross' : 'graveStone', x: gx, y: gy, block: true });
  }
  // corpses
  for (const [x, y, v] of [[23, 12, 1], [29, 21, 1], [12, 18, 0], [37, 18, 2], [33, 31, 1], [19, 27, 1], [45, 24, 0]]) {
    if (L.get(x, y) !== T.FLOOR && L.get(x, y) !== T.ROAD) L.set(x, y, T.FLOOR);
    L.add({ kind: 'corpse', x, y, variant: v, looted: false, block: false, town: true });
  }
  // embers in the ruins give the town its light
  for (const [x, y] of [[7, 12], [35, 12], [35, 27], [16, 13], [48, 13], [12, 27], [33, 28], [5, 24]]) {
    if (L.get(x, y) !== T.FLOOR) continue;
    L.decal[L.i(x, y)] = DECAL.ASH;
    addLightEnt(L, 'ember', x, y, { light: { r: 3, flicker: 1 } });
  }
  // crows
  for (const [x, y] of [[24, 15], [30, 23], [8, 30], [38, 21], [14, 35]]) {
    if (TINFO[L.get(x, y)].walk) L.add({ kind: 'crow', x, y, block: false });
  }
  L.start = { x: 10, y: 26 };
  L.up = null;
  L.down = { x: 25, y: 7 };
  return L;
}

// ---------------------------------------------------------------- dungeon generation
function genRooms(L, rng, o, specials) {
  L.tiles.fill(T.WALL);
  const rooms = [];
  for (const sp of specials) {
    for (let tries = 0; tries < 400; tries++) {
      const x = rng.int(3, L.w - sp.w - 4), y = rng.int(3, L.h - sp.h - 4);
      if (rooms.some(r => x < r.x + r.w + 3 && x + sp.w + 3 > r.x && y < r.y + r.h + 3 && y + sp.h + 3 > r.y)) continue;
      rooms.push({ x, y, w: sp.w, h: sp.h, special: sp.id });
      break;
    }
  }
  for (let tries = 0; tries < o.tries && rooms.length < o.maxRooms; tries++) {
    const w = rng.int(o.minW, o.maxW), h = rng.int(o.minH, o.maxH);
    const x = rng.int(2, L.w - w - 3), y = rng.int(2, L.h - h - 3);
    if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h });
  }
  for (const r of rooms) {
    r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) L.set(x, y, T.FLOOR);
  }
  // Prim's MST over normal room centers, plus some loops. Special rooms get one corridor.
  const normal = rooms.filter(r => !r.special);
  const inTree = new Set([0]);
  while (inTree.size < normal.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < normal.length; b++) {
      if (inTree.has(b)) continue;
      const d = Math.abs(normal[a].cx - normal[b].cx) + Math.abs(normal[a].cy - normal[b].cy);
      if (!best || d < best.d) best = { a, b, d };
    }
    inTree.add(best.b);
    carveCorridor(L, rng, normal[best.a], normal[best.b], o.corrW);
  }
  for (let i = 0; i < normal.length * o.loops; i++) {
    const a = rng.int(0, normal.length - 1), b = rng.int(0, normal.length - 1);
    if (a !== b) carveCorridor(L, rng, normal[a], normal[b], o.corrW);
  }
  for (const sp of rooms.filter(r => r.special)) {
    let best = null;
    for (const r of normal) {
      const d = Math.abs(r.cx - sp.cx) + Math.abs(r.cy - sp.cy) * 1.5;
      if (!best || d < best.d) best = { r, d };
    }
    if (best) carveCorridor(L, rng, sp, best.r, 1, true);
  }
  // Pillars in big rooms.
  if (o.pillars) for (const r of rooms) {
    if (r.special || r.w < 8 || r.h < 7) continue;
    for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) {
      L.set(x, r.y + 1, T.PILLAR);
      L.set(x, r.y + r.h - 2, T.PILLAR);
    }
  }
  // Re-open any pillar sitting in a corridor's path.
  for (const r of rooms) for (let x = r.x; x < r.x + r.w; x++) {
    for (const y of [r.y + 1, r.y + r.h - 2]) {
      if (L.get(x, y) !== T.PILLAR) continue;
      const out = L.get(x, y === r.y + 1 ? y - 2 : y + 2);
      if (out === T.FLOOR) L.set(x, y, T.FLOOR);
    }
  }
  // Doors where a vertical corridor meets a room edge.
  const inRoom = (x, y) => rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) {
    if (L.get(x, y) !== T.FLOOR || inRoom(x, y)) continue;
    if (L.get(x - 1, y) !== T.WALL || L.get(x + 1, y) !== T.WALL) continue;
    if (L.get(x, y - 1) !== T.FLOOR || L.get(x, y + 1) !== T.FLOOR) continue;
    const ra = inRoom(x, y - 1) || inRoom(x, y + 1);
    if (!ra) continue;
    if (ra.special || rng.chance(o.doors)) L.set(x, y, T.DOOR);
  }
  return rooms;
}

function carveCorridor(L, rng, a, b, wdt, vertFirst) {
  let x = a.cx, y = a.cy;
  const horizFirst = vertFirst ? false : rng.chance(0.5);
  const carve = (cx, cy) => {
    for (let i = 0; i < wdt; i++) for (let j = 0; j < wdt; j++) {
      const tx = cx + i, ty = cy + j;
      if (tx > 0 && ty > 0 && tx < L.w - 1 && ty < L.h - 1 && L.get(tx, ty) === T.WALL) L.set(tx, ty, T.FLOOR);
    }
  };
  const stepX = () => { while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); } };
  const stepY = () => { while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); } };
  if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  carve(x, y);
}

function genCaves(L, rng, lava) {
  for (let attempt = 0; attempt < 20; attempt++) {
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const edge = x < 2 || y < 2 || x >= L.w - 2 || y >= L.h - 2;
      L.set(x, y, edge || rng.chance(0.45) ? T.WALL : T.FLOOR);
    }
    for (let it = 0; it < 5; it++) {
      const next = new Uint8Array(L.tiles);
      for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && L.get(x + dx, y + dy) === T.WALL) n++;
        next[L.i(x, y)] = n >= 5 || (it < 2 && n <= 1) ? T.WALL : T.FLOOR;
      }
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (x < 2 || y < 2 || x >= L.w - 2 || y >= L.h - 2) next[L.i(x, y)] = T.WALL;
      L.tiles = next;
    }
    // Keep the largest region.
    const seen = new Uint8Array(L.w * L.h);
    let best = null;
    for (let i = 0; i < L.w * L.h; i++) {
      if (L.tiles[i] !== T.FLOOR || seen[i]) continue;
      const d = bfs(L, i % L.w, (i / L.w) | 0, (x, y) => L.get(x, y) === T.FLOOR);
      const cells = [];
      for (let j = 0; j < d.length; j++) if (d[j] >= 0) { seen[j] = 1; cells.push(j); }
      if (!best || cells.length > best.length) best = cells;
    }
    if (!best || best.length < L.w * L.h * 0.33) continue;
    const keep = new Uint8Array(L.w * L.h);
    for (const c of best) keep[c] = 1;
    for (let i = 0; i < L.w * L.h; i++) if (L.tiles[i] === T.FLOOR && !keep[i]) L.tiles[i] = T.WALL;
    break;
  }
  // Liquid pools that do not cut the cave apart.
  const countFloor = () => { let n = 0; for (const t of L.tiles) if (t === T.FLOOR) n++; return n; };
  const pools = rng.int(3, 6);
  for (let p = 0; p < pools; p++) {
    const liquid = lava || rng.chance(0.25) ? T.LAVA : T.WATER;
    let cx, cy;
    for (let t = 0; t < 100; t++) { cx = rng.int(4, L.w - 5); cy = rng.int(4, L.h - 5); if (L.get(cx, cy) === T.FLOOR) break; }
    const r = rng.range(1.5, 3.2);
    const changed = [];
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
      if (L.get(x, y) !== T.FLOOR) continue;
      if (Math.hypot(x - cx, (y - cy) * 1.2) + rng.range(-0.6, 0.6) < r) { changed.push(L.i(x, y)); L.tiles[L.i(x, y)] = liquid; }
    }
    // revert if it disconnected the cave
    const total = countFloor();
    let start = -1;
    for (let i = 0; i < L.tiles.length; i++) if (L.tiles[i] === T.FLOOR) { start = i; break; }
    const d = bfs(L, start % L.w, (start / L.w) | 0, (x, y) => L.get(x, y) === T.FLOOR);
    let reach = 0;
    for (const v of d) if (v >= 0) reach++;
    if (reach < total) for (const c of changed) L.tiles[c] = T.FLOOR;
  }
  return [];
}

// ---------------------------------------------------------------- population
function randomFloor(L, rng, ok, tries = 400) {
  for (let t = 0; t < tries; t++) {
    const x = rng.int(1, L.w - 2), y = rng.int(1, L.h - 2);
    if (L.get(x, y) !== T.FLOOR) continue;
    if (L.ents.some(e => e.x === x && e.y === y)) continue;
    if (ok && !ok(x, y)) continue;
    return [x, y];
  }
  return null;
}
function nearWall(L, x, y) {
  return wallLike(L.get(x - 1, y)) || wallLike(L.get(x + 1, y)) || wallLike(L.get(x, y - 1)) || wallLike(L.get(x, y + 1));
}
// Count tiles reachable from the up stairs, around blocking objects.
function reachable(L) {
  const blocked = new Set();
  for (const e of L.ents) if (e.block && e.kind !== 'monster') blocked.add(e.x + e.y * L.w);
  const d = bfs(L, L.up.x, L.up.y, (px, py) => {
    const t = L.get(px, py);
    return (TINFO[t].walk || t === T.DOOR) && !blocked.has(px + py * L.w);
  });
  let n = 0;
  for (const v of d) if (v >= 0) n++;
  return n;
}
// Blocking objects must not cut off any part of the level.
function placeBlocking(L, x, y, ent) {
  L.add(Object.assign(ent, { x, y, block: true }));
  const n = reachable(L);
  if (n < L.reach - 1) { L.remove(ent); return false; }
  L.reach = n;
  return true;
}

function buildDungeon(depth, seed) {
  const rng = new RNG(seed);
  const theme = themeForDepth(depth);
  const sizes = { cathedral: [56, 44], catacombs: [60, 46], caves: [58, 46], hell: [60, 48] };
  const [W, H] = sizes[theme];
  const L = new Level(depth, W, H);
  const specials = [];
  if (depth === 2) specials.push({ id: 'butcher', w: 7, h: 6 });
  if (depth === 3) specials.push({ id: 'leoric', w: 11, h: 8 });
  if (depth === 16) specials.push({ id: 'diablo', w: 15, h: 11 });
  let rooms;
  if (theme === 'caves') {
    rooms = genCaves(L, rng, depth >= 11);
  } else {
    const o = {
      cathedral: { tries: 300, maxRooms: 14, minW: 5, maxW: 11, minH: 4, maxH: 8, corrW: 1, loops: 0.25, doors: 0.6, pillars: true },
      catacombs: { tries: 400, maxRooms: 20, minW: 4, maxW: 8, minH: 3, maxH: 6, corrW: 1, loops: 0.35, doors: 0.75, pillars: false },
      hell: { tries: 300, maxRooms: 13, minW: 6, maxW: 12, minH: 5, maxH: 9, corrW: 2, loops: 0.3, doors: 0.2, pillars: true },
    }[theme];
    rooms = genRooms(L, rng, o, specials);
  }
  L.rooms = rooms;

  // stairs
  const normalRooms = rooms.filter(r => !r.special);
  let up;
  if (normalRooms.length) {
    const r = rng.pick(normalRooms);
    up = { x: r.cx, y: r.cy };
  } else {
    const p = randomFloor(L, rng);
    up = { x: p[0], y: p[1] };
  }
  L.set(up.x, up.y, T.UP);
  L.up = up;
  let dist = bfs(L, up.x, up.y, walkTile(L));
  const inSpecial = (x, y) => rooms.some(r => r.special && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
  const far = [];
  for (let i = 0; i < dist.length; i++) {
    const x = i % W, y = (i / W) | 0;
    if (dist[i] > 0 && L.get(x, y) === T.FLOOR && !inSpecial(x, y)) far.push([dist[i], x, y]);
  }
  far.sort((a, b) => b[0] - a[0]);
  if (depth < 16) {
    const pick = far[rng.int(0, Math.min(8, far.length - 1))];
    L.set(pick[1], pick[2], T.DOWN);
    L.down = { x: pick[1], y: pick[2] };
  }
  if (depth === 5 || depth === 9) {
    const mid = far.filter(f => f[0] > far[0][0] * 0.35 && f[0] < far[0][0] * 0.7 && L.get(f[1], f[2]) === T.FLOOR);
    const pick = mid.length ? rng.pick(mid) : far[Math.floor(far.length / 2)];
    L.set(pick[1], pick[2], T.SURFACE);
    L.surface = { x: pick[1], y: pick[2] };
  }
  // Lava pools in Hell's larger rooms, kept only where they cut nothing off.
  if (theme === 'hell') {
    const count = () => { let n = 0; for (const v of bfs(L, up.x, up.y, walkTile(L))) if (v >= 0) n++; return n; };
    let total = count();
    for (const r of rooms) {
      if (r.special || r.w < 8 || r.h < 7 || !rng.chance(0.5)) continue;
      const cells = [];
      for (let y = r.cy - 1; y <= r.cy + 1; y++) for (let x = r.cx - 1; x <= r.cx + 1; x++) if (L.get(x, y) === T.FLOOR) cells.push([x, y]);
      for (const [x, y] of cells) L.set(x, y, T.LAVA);
      const n = count();
      if (n < total - cells.length) { for (const [x, y] of cells) L.set(x, y, T.FLOOR); continue; }
      total = n;
      addLightEnt(L, 'glow', r.cx, r.cy, { light: { r: 4.5, flicker: 0.5 } });
    }
  }
  dist = bfs(L, up.x, up.y, walkTile(L));
  const okFar = minD => (x, y) => dist[L.i(x, y)] >= minD && !inSpecial(x, y);

  // Decals
  for (let i = 0; i < W * H * 0.06; i++) {
    const p = randomFloor(L, rng);
    if (!p) continue;
    const pool = theme === 'hell' ? [DECAL.BLOOD1, DECAL.BLOOD2, DECAL.BONES1, DECAL.PENTA, DECAL.CRACK, DECAL.SKULL]
      : theme === 'caves' ? [DECAL.BONES1, DECAL.CRACK, DECAL.GRIME, DECAL.BLOOD1]
        : [DECAL.BLOOD1, DECAL.BLOOD2, DECAL.BONES1, DECAL.BONES2, DECAL.CRACK, DECAL.GRIME, DECAL.SKULL];
    L.decal[L.i(p[0], p[1])] = rng.pick(pool);
  }

  // Lights: sconces on wall faces, fewer the deeper you go.
  const sconceRate = { cathedral: 0.09 - (depth - 1) * 0.018, catacombs: 0.03 - (depth - 5) * 0.006, caves: 0, hell: 0.02 }[theme];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (L.get(x, y) !== T.WALL || L.get(x, y + 1) !== T.FLOOR) continue;
    if (rng.chance(Math.max(0, sconceRate))) addLightEnt(L, 'sconce', x, y, { light: { r: 4, flicker: 1 } });
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (L.get(x, y) === T.LAVA && rng.chance(0.5)) addLightEnt(L, 'glow', x, y, { light: { r: 2.6, flicker: 0.5 } });
  }

  // Special rooms
  for (const r of rooms.filter(r => r.special)) populateSpecial(L, rng, r);
  L.reach = reachable(L);

  // Monsters
  const pool = monsterPool(depth);
  const nGroups = 4 + Math.floor(depth * 0.55) + rng.int(0, 2);
  for (let g = 0; g < nGroups; g++) {
    const p = randomFloor(L, rng, okFar(9));
    if (!p) continue;
    const lead = rng.weighted(pool);
    const def = MONSTERS[lead];
    const n = rng.int(def.group[0], def.group[1]);
    const mids = [lead];
    for (let i = 1; i < n; i++) mids.push(rng.chance(0.75) ? lead : rng.weighted(pool));
    L.add(newMonsterEnt(mids, p[0], p[1]));
  }

  // Loot and objects
  const gearTheme = theme;
  const lootFor = (richness) => {
    const items = [];
    const n = rng.int(1, 2 + richness);
    for (let i = 0; i < n; i++) {
      const roll = rng.next();
      if (roll < 0.55) items.push(rng.weighted(LOOT.common));
      else if (roll < 0.78) items.push(rng.weighted(LOOT.treasure[gearTheme]));
      else if (roll < 0.9) items.push(rng.weighted(LOOT.gear[gearTheme]));
      else items.push(depth >= 4 ? rng.weighted(LOOT.deep) : rng.weighted(LOOT.common));
    }
    return items;
  };
  const goldAmt = (a, b) => Math.round(rng.int(a, b) * (1 + depth * 0.35));

  const nChests = rng.int(2, 4);
  for (let i = 0; i < nChests; i++) {
    const p = randomFloor(L, rng, (x, y) => okFar(5)(x, y) && nearWall(L, x, y));
    if (p) placeBlocking(L, p[0], p[1], { kind: 'chest', open: false, trapped: rng.chance(0.15 + depth * 0.02), items: lootFor(1), gold: goldAmt(5, 30) });
  }
  const nBarrels = { cathedral: rng.int(5, 9), catacombs: rng.int(4, 8), caves: rng.int(1, 3), hell: rng.int(0, 2) }[theme];
  for (let i = 0; i < nBarrels; i++) {
    const p = randomFloor(L, rng, (x, y) => okFar(3)(x, y) && nearWall(L, x, y));
    if (p) placeBlocking(L, p[0], p[1], { kind: 'barrel', broken: false });
  }
  const nCorpses = rng.int(2, 4);
  for (let i = 0; i < nCorpses; i++) {
    const p = randomFloor(L, rng, okFar(4));
    if (p) L.add({ kind: 'corpse', x: p[0], y: p[1], variant: rng.int(0, 2), looted: false, block: false, items: lootFor(0), gold: goldAmt(0, 15) });
  }
  const nGold = rng.int(4, 7);
  for (let i = 0; i < nGold; i++) {
    const p = randomFloor(L, rng, okFar(4));
    if (p) L.add({ kind: 'gold', x: p[0], y: p[1], amount: goldAmt(8, 26), block: false });
  }
  const nSacks = rng.int(1, 2);
  for (let i = 0; i < nSacks; i++) {
    const p = randomFloor(L, rng, okFar(3));
    if (p) L.add({ kind: 'sack', x: p[0], y: p[1], items: [rng.weighted(LOOT.common)], block: false });
  }
  const nBones = rng.int(2, 4);
  for (let i = 0; i < nBones; i++) {
    const p = randomFloor(L, rng, okFar(3));
    if (p) L.add({ kind: 'bones', x: p[0], y: p[1], searched: false, block: false });
  }
  if (rng.chance(0.55)) {
    const p = randomFloor(L, rng, (x, y) => okFar(6)(x, y) && nearWall(L, x, y));
    if (p) placeBlocking(L, p[0], p[1], { kind: 'shrine', used: false, shrine: rng.int(0, LORE.shrines.length - 1) });
  }
  if (depth % 2 === 1 || rng.chance(0.35)) {
    const p = randomFloor(L, rng, (x, y) => okFar(4)(x, y) && nearWall(L, x, y));
    if (p) placeBlocking(L, p[0], p[1], { kind: 'altar' });
  }
  const nNotes = rng.int(1, 2);
  for (let i = 0; i < nNotes; i++) {
    const p = randomFloor(L, rng, okFar(3));
    if (p) L.add({ kind: 'note', x: p[0], y: p[1], note: rng.int(0, LORE.notes.length - 1), block: false });
  }
  if (theme === 'catacombs' || theme === 'cathedral') {
    const n = theme === 'catacombs' ? rng.int(3, 6) : rng.int(0, 2);
    for (let i = 0; i < n; i++) {
      const p = randomFloor(L, rng, (x, y) => okFar(5)(x, y) && nearWall(L, x, y));
      if (p) placeBlocking(L, p[0], p[1], { kind: 'sarc', open: false, items: lootFor(1), gold: goldAmt(5, 25) });
    }
    const nShelves = rng.int(1, 3);
    for (let i = 0; i < nShelves; i++) {
      const p = randomFloor(L, rng, (x, y) => okFar(2)(x, y) && wallLike(L.get(x, y - 1)) && !wallLike(L.get(x, y + 1)));
      if (p) placeBlocking(L, p[0], p[1], { kind: 'decor', sprite: 'bookshelf' });
    }
  }
  if (theme === 'cathedral') {
    for (const r of rooms) {
      if (r.special || r.w < 6 || r.h < 5 || !rng.chance(0.5)) continue;
      for (let y = r.y + 2; y < r.y + r.h - 1; y += 2) {
        for (const x of [r.cx - 2, r.cx + 2]) {
          if (L.get(x, y) === T.FLOOR && !L.ents.some(e => e.x === x && e.y === y)) placeBlocking(L, x, y, { kind: 'decor', sprite: 'pew' });
        }
      }
      if (rng.chance(0.6)) {
        const x = r.cx, y = r.y + 1;
        if (L.get(x, y) === T.FLOOR && !L.ents.some(e => e.x === x && e.y === y)) placeBlocking(L, x, y, { kind: 'decor', sprite: 'candelabra', light: { r: 3.5, flicker: 1 } });
      }
    }
  }
  if (theme === 'hell') {
    for (const r of rooms) {
      if (r.special || !rng.chance(0.55)) continue;
      const corners = [[r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]];
      for (const [x, y] of corners) if (L.get(x, y) === T.FLOOR && rng.chance(0.6)) placeBlocking(L, x, y, { kind: 'decor', sprite: 'brazier', light: { r: 4, flicker: 1 } });
    }
  }
  if (theme === 'caves') {
    const n = rng.int(3, 6);
    for (let i = 0; i < n; i++) {
      const p = randomFloor(L, rng, okFar(3));
      if (p) L.add({ kind: 'sack', x: p[0], y: p[1], items: ['mushroom'], mushrooms: true, block: false });
    }
  }
  if (depth === 4) {
    for (const minD of [14, 10, 6, 2]) {
      const p = randomFloor(L, rng, okFar(minD));
      if (p && placeBlocking(L, p[0], p[1], { kind: 'gharbad', stage: 0 })) break;
    }
  }
  if (depth === 7 || depth === 11) {
    const p = randomFloor(L, rng, okFar(14));
    if (p) placeBlocking(L, p[0], p[1], { kind: 'chest', open: false, trapped: true, items: [depth === 7 ? 'arkaine' : 'elixir', 'horadric'], gold: goldAmt(40, 80), ornate: true });
  }
  return L;
}

function newMonsterEnt(mids, x, y, extra) {
  return Object.assign({ kind: 'monster', mids, x, y, homeX: x, homeY: y, block: true, state: 'idle' }, extra || {});
}

function populateSpecial(L, rng, r) {
  const fill = (fn) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) fn(x, y); };
  if (r.special === 'butcher') {
    fill((x, y) => { L.decal[L.i(x, y)] = rng.pick([DECAL.BLOOD2, DECAL.BLOOD3, DECAL.BLOOD3, DECAL.BLOOD1]); });
    const spots = [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x + 2, r.y], [r.x + r.w - 3, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]];
    for (const [x, y] of spots) L.add({ kind: 'decor', sprite: 'hanging', x, y, block: true });
    L.add(newMonsterEnt(['butcher'], r.cx, r.cy, { dormant: true, room: { x: r.x, y: r.y, w: r.w, h: r.h } }));
    L.add({ kind: 'gold', x: r.cx + 1, y: r.cy + 1, amount: 120, block: false });
    L.add({ kind: 'corpse', x: r.cx - 2, y: r.cy + 1, variant: 0, looted: false, block: false, items: ['hpot', 'bandage', 'ring'], gold: 30 });
  } else if (r.special === 'leoric') {
    fill((x, y) => { if (rng.chance(0.2)) L.decal[L.i(x, y)] = DECAL.BONES2; });
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 2) {
      L.add({ kind: 'decor', sprite: 'candelabra', x: r.x, y, block: true, light: { r: 3.5, flicker: 1 } });
      L.add({ kind: 'decor', sprite: 'candelabra', x: r.x + r.w - 1, y, block: true, light: { r: 3.5, flicker: 1 } });
    }
    L.add(newMonsterEnt(['leoric', 'skeleton', 'skeleton'], r.cx, r.y + 2, { dormant: true, room: { x: r.x, y: r.y, w: r.w, h: r.h } }));
    L.add({ kind: 'sarc', x: r.cx - 2, y: r.y + 1, open: false, items: ['icon', 'hpot'], gold: 60, block: true });
    L.add({ kind: 'sarc', x: r.cx + 2, y: r.y + 1, open: false, items: ['reliquary'], gold: 40, block: true });
  } else if (r.special === 'diablo') {
    fill((x, y) => { L.decal[L.i(x, y)] = rng.chance(0.35) ? DECAL.PENTA : 0; });
    for (const [x, y] of [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]]) {
      L.add({ kind: 'decor', sprite: 'brazier', x, y, block: true, light: { r: 5, flicker: 1 } });
    }
    L.add(newMonsterEnt(['diablo'], r.cx, r.cy - 2, { dormant: true, room: { x: r.x, y: r.y, w: r.w, h: r.h } }));
  }
}
