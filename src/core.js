'use strict';
// Core: constants, RNG, math helpers, frame clock and input.

const TILE = 16;
const VW = 320, VH = 240;   // low-res world buffer (pixel art space)
const UW = 960, UH = 720;   // logical UI space (text, windows)
const US = UW / VW;         // UI units per world pixel

// ---------------------------------------------------------------- RNG
class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  range(a, b) { return a + this.next() * (b - a); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(list) {
    let total = 0;
    for (const e of list) total += e[1];
    let r = this.next() * total;
    for (const e of list) { r -= e[1]; if (r < 0) return e[0]; }
    return list[list.length - 1][0];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Gameplay randomness. Its state is saved so reloads don't reroll fate.
let R = new RNG((Math.random() * 4294967296) >>> 0);

// Deterministic hash noise for per-tile variation.
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- math
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const ease = t => t * t * (3 - 2 * t);

const DIRS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const DIR_LIST = ['up', 'down', 'left', 'right'];

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function plural(n, word, many) { return n === 1 ? word : (many || word + 's'); }

// ---------------------------------------------------------------- clock
// Game time in ms. Waits resolve inside the frame loop so animations stay in sync.
const Clock = {
  t: 0,
  waits: [],
  tick(dt) {
    this.t += dt;
    for (let i = this.waits.length - 1; i >= 0; i--) {
      if (this.waits[i].at <= this.t) {
        const w = this.waits[i];
        this.waits.splice(i, 1);
        w.res();
      }
    }
  },
};
function wait(ms) {
  return new Promise(res => Clock.waits.push({ at: Clock.t + ms, res }));
}

// ---------------------------------------------------------------- input
const Input = {
  keymap: {
    ArrowUp: 'up', KeyW: 'up', Numpad8: 'up',
    ArrowDown: 'down', KeyS: 'down', Numpad2: 'down',
    ArrowLeft: 'left', KeyA: 'left', Numpad4: 'left',
    ArrowRight: 'right', KeyD: 'right', Numpad6: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok', NumpadEnter: 'ok', KeyE: 'ok',
    KeyX: 'cancel', Escape: 'cancel', Backspace: 'cancel', KeyQ: 'cancel',
    Tab: 'map', KeyM: 'map',
    KeyN: 'mute',
    ShiftLeft: 'fast', ShiftRight: 'fast',
  },
  sources: {},       // action -> Set of source ids currently holding it
  queue: [],
  now: new Set(),
  repeats: new Set(),
  holdTime: {},
  anyKey: false,

  isHeld(a) { const s = this.sources[a]; return !!(s && s.size); },

  press(a, src) {
    if (!this.sources[a]) this.sources[a] = new Set();
    if (!this.sources[a].has(src)) {
      if (!this.isHeld(a)) { this.queue.push(a); this.holdTime[a] = 0; }
      this.sources[a].add(src);
    }
    this.anyKey = true;
  },
  release(a, src) {
    const s = this.sources[a];
    if (s) s.delete(src);
  },
  releaseAll() {
    for (const a in this.sources) this.sources[a].clear();
  },

  update(dt) {
    this.now = new Set(this.queue);
    this.queue = [];
    this.repeats.clear();
    for (const a in this.sources) {
      if (!this.isHeld(a)) continue;
      const before = this.holdTime[a] || 0;
      const after = before + dt;
      this.holdTime[a] = after;
      const DELAY = 280, RATE = 85;
      if (after >= DELAY) {
        const n0 = before < DELAY ? -1 : Math.floor((before - DELAY) / RATE);
        const n1 = Math.floor((after - DELAY) / RATE);
        if (n1 > n0) this.repeats.add(a);
      }
    }
  },
  // Edge-triggered and consumed so one press is handled once.
  pressed(a) {
    if (this.now.has(a)) { this.now.delete(a); return true; }
    return false;
  },
  // Menu navigation: first press plus auto-repeat while held.
  nav(a) {
    if (this.pressed(a)) return true;
    if (this.repeats.has(a)) { this.repeats.delete(a); return true; }
    return false;
  },
  consumeAll() { this.now.clear(); this.repeats.clear(); },

  attach() {
    const prevent = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);
    window.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = this.keymap[e.code];
      if (prevent.has(e.code)) e.preventDefault();
      if (!a) return;
      if (e.repeat) return;
      this.press(a, 'k:' + e.code);
    });
    window.addEventListener('keyup', e => {
      const a = this.keymap[e.code];
      if (a) this.release(a, 'k:' + e.code);
    });
    window.addEventListener('blur', () => this.releaseAll());
  },
};
