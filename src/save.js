'use strict';
// Save games live in localStorage. Saving only happens at the campfire or an altar.

const SAVE_KEY = 'beneath-tristram-save-v1';
const TRANSIENT = new Set(['timer', 'animT', 'stunUntil', 'view', 'lost', 'staticLight', 'dazed', 'born']);

function bytesToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBytes(str) {
  const s = atob(str);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

function serializeLevel(L) {
  return {
    depth: L.depth, w: L.w, h: L.h,
    tiles: bytesToB64(L.tiles), decal: bytesToB64(L.decal), explored: bytesToB64(L.explored),
    ents: L.ents, nextId: L.nextId, up: L.up, down: L.down, surface: L.surface,
    townTrip: L.townTrip, start: L.start,
  };
}
function deserializeLevel(o) {
  const L = new Level(o.depth, o.w, o.h);
  L.tiles = b64ToBytes(o.tiles);
  L.decal = b64ToBytes(o.decal);
  L.explored = b64ToBytes(o.explored);
  L.ents = o.ents;
  L.nextId = o.nextId;
  L.up = o.up; L.down = o.down; L.surface = o.surface;
  L.townTrip = o.townTrip || 0;
  L.start = o.start;
  return L;
}

function serializeGame() {
  const levels = {};
  for (const d in G.levels) levels[d] = serializeLevel(G.levels[d]);
  const data = { v: 1, p: G.p, depth: G.depth, seed: G.seed, flags: G.flags, townTrips: G.townTrips, rng: R.s, levels };
  return JSON.parse(JSON.stringify(data, (k, v) => TRANSIENT.has(k) ? undefined : v));
}
function deserializeGame(data) {
  G.p = data.p;
  G.depth = data.depth;
  G.seed = data.seed;
  G.flags = data.flags || {};
  G.townTrips = data.townTrips || 0;
  R = new RNG(data.rng || 1);
  G.levels = {};
  for (const d in data.levels) G.levels[d] = deserializeLevel(data.levels[d]);
}

const Save = {
  write() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serializeGame()));
      return true;
    } catch (e) { return false; }
  },
  read() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  },
  exists() { return !!this.read(); },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ } },
};
