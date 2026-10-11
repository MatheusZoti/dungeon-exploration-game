'use strict';
// Procedural sound: ambient drones, a sparse plucked-string town theme, and effects.

const Sound = {
  ctx: null, master: null, sfxBus: null, ambBus: null, verb: null,
  muted: false, theme: null, noiseBuf: null, plucks: {},
  layers: {}, timers: [], musicStep: 0,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.55; this.ambBus.connect(this.master);
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(2.8, 2.4);
    const verbGain = c.createGain(); verbGain.gain.value = 0.5;
    this.verb.connect(verbGain); verbGain.connect(this.master);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.buildLayers();
    if (this.theme) { const t = this.theme; this.theme = null; this.setTheme(t); }
  },

  impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  },

  // ---------------------------------------------------------------- ambience
  buildLayers() {
    const c = this.ctx;
    const mkGain = (v, dest) => { const g = c.createGain(); g.gain.value = v; g.connect(dest); return g; };
    // wind
    const wind = c.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.6;
    const wg = mkGain(0, this.ambBus);
    const wlfo = c.createOscillator(); wlfo.frequency.value = 0.07;
    const wlg = c.createGain(); wlg.gain.value = 180;
    wlfo.connect(wlg); wlg.connect(wf.frequency);
    wind.connect(wf); wf.connect(wg); wind.start(); wlfo.start();
    // drone
    const dg = mkGain(0, this.ambBus);
    const dfl = c.createBiquadFilter(); dfl.type = 'lowpass'; dfl.frequency.value = 240; dfl.Q.value = 2;
    dfl.connect(dg);
    const oscs = [];
    for (const det of [0, 7, -5]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55; o.detune.value = det;
      o.connect(dfl); o.start(); oscs.push(o);
    }
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 77.8;
    const o2g = c.createGain(); o2g.gain.value = 0.35; o2.connect(o2g); o2g.connect(dfl); o2.start();
    const dlfo = c.createOscillator(); dlfo.frequency.value = 0.05;
    const dlg = c.createGain(); dlg.gain.value = 90; dlfo.connect(dlg); dlg.connect(dfl.frequency); dlfo.start();
    // combat pulse bus
    const cg = mkGain(0, this.ambBus);
    this.layers = { windGain: wg, droneGain: dg, oscs, o2, droneFilter: dfl, combatGain: cg };
    // random events
    this.timers.push(setInterval(() => this.ambientEvent(), 1700));
    this.timers.push(setInterval(() => this.musicTick(), 520));
  },

  setTheme(theme) {
    if (this.theme === theme) return;
    this.theme = theme;
    if (!this.ctx) return;
    const now = this.ctx.currentTime, Lr = this.layers;
    const cfg = {
      town: { wind: 0.22, drone: 0.0, f: 55, f2: 82.4 },
      cathedral: { wind: 0.05, drone: 0.11, f: 55, f2: 82.4 },
      catacombs: { wind: 0.03, drone: 0.13, f: 49, f2: 73.4 },
      caves: { wind: 0.08, drone: 0.12, f: 41.2, f2: 61.7 },
      hell: { wind: 0.1, drone: 0.17, f: 36.7, f2: 51.9 },
      combat: { wind: 0.02, drone: 0.16, f: 46.2, f2: 65.4 },
      title: { wind: 0.16, drone: 0.06, f: 55, f2: 82.4 },
      silent: { wind: 0, drone: 0, f: 55, f2: 82.4 },
    }[theme] || { wind: 0, drone: 0.1, f: 55, f2: 82.4 };
    Lr.windGain.gain.setTargetAtTime(cfg.wind, now, 1.2);
    Lr.droneGain.gain.setTargetAtTime(cfg.drone, now, 1.5);
    for (const o of Lr.oscs) o.frequency.setTargetAtTime(cfg.f, now, 2);
    Lr.o2.frequency.setTargetAtTime(cfg.f2, now, 2);
  },

  ambientEvent() {
    if (!this.ctx || this.muted || document.hidden) return;
    const th = this.theme;
    if (th === 'town' || th === 'title') {
      if (Math.random() < 0.18) this.play('crow');
      if (Math.random() < 0.5) this.play('crackle');
    } else if (th === 'cathedral' || th === 'catacombs' || th === 'caves' || th === 'hell') {
      const r = Math.random();
      if (r < 0.2) this.play('drip');
      else if (r < 0.27) this.play('moan');
      else if (r < 0.31) this.play('chain');
      if (th === 'hell' && Math.random() < 0.15) this.play('rumble');
    } else if (th === 'combat') {
      // handled by music tick
    }
  },

  // ---------------------------------------------------------------- music
  pluck(freq) {
    const key = Math.round(freq);
    if (this.plucks[key]) return this.plucks[key];
    const c = this.ctx, sr = c.sampleRate, n = Math.floor(sr * 2.2);
    const buf = c.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.floor(sr / freq));
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let i = N; i < n; i++) d[i] = 0.5 * (d[i - N] + d[i - N - 1]) * 0.9965;
    return (this.plucks[key] = buf);
  },
  playPluck(freq, when, gain = 0.22) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.pluck(freq);
    const g = c.createGain(); g.gain.value = gain;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    s.connect(f); f.connect(g); g.connect(this.ambBus); g.connect(this.verb);
    s.start(when);
  },
  musicTick() {
    if (!this.ctx || this.muted || document.hidden) return;
    const th = this.theme;
    const now = this.ctx.currentTime;
    this.musicStep++;
    if (th === 'town' || th === 'title') {
      // Slow arpeggios in D minor: Dm, Bb, Gm, A.
      const chords = [[146.8, 220, 293.7, 349.2], [116.5, 174.6, 233.1, 293.7], [98, 146.8, 196, 233.1], [110, 164.8, 220, 277.2]];
      const bar = Math.floor(this.musicStep / 8) % 4;
      const step = this.musicStep % 8;
      const ch = chords[bar];
      if (step === 0) this.playPluck(ch[0] / 2, now, 0.2);
      if (Math.random() < 0.55) {
        const pat = [1, 2, 3, 2, 1, 2, 3, 1];
        this.playPluck(ch[pat[step]] * (Math.random() < 0.15 ? 2 : 1), now + 0.02, 0.13);
      }
    } else if (th === 'combat') {
      const pat = [1, 0, 0, 1, 0, 1, 0, 0];
      if (pat[this.musicStep % 8]) this.drum(now, 70, 0.32);
      if (this.musicStep % 16 === 12) this.drum(now, 52, 0.22);
    }
  },
  drum(when, f, g) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.8, when);
    o.frequency.exponentialRampToValueAtTime(f, when + 0.12);
    const gg = c.createGain();
    gg.gain.setValueAtTime(g, when);
    gg.gain.exponentialRampToValueAtTime(0.001, when + 0.45);
    o.connect(gg); gg.connect(this.ambBus); gg.connect(this.verb);
    o.start(when); o.stop(when + 0.5);
  },

  // ---------------------------------------------------------------- effects
  noise(when, dur, { type = 'bandpass', f = 1000, f2, q = 1, gain = 0.2, attack = 0.003, dest } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, when); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, when + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfxBus);
    s.start(when, Math.random() * 1.5); s.stop(when + dur + 0.05);
    return g;
  },
  tone(when, dur, { type = 'sine', f = 440, f2, gain = 0.2, attack = 0.005, verb = false, dest } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, when);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, when + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(dest || this.sfxBus);
    if (verb) g.connect(this.verb);
    o.start(when); o.stop(when + dur + 0.05);
    return o;
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const r = Math.random;
    switch (name) {
      case 'step': this.noise(t, 0.05, { f: 700 + r() * 500, q: 1.5, gain: 0.035 }); break;
      case 'menu': this.tone(t, 0.04, { f: 980, gain: 0.05, type: 'triangle' }); break;
      case 'ok': this.tone(t, 0.08, { f: 520, f2: 780, gain: 0.07, type: 'triangle' }); break;
      case 'cancel': this.tone(t, 0.08, { f: 480, f2: 330, gain: 0.07, type: 'triangle' }); break;
      case 'text': this.tone(t, 0.02, { f: 300 + r() * 60, gain: 0.025, type: 'square' }); break;
      case 'hit':
        this.noise(t, 0.12, { type: 'lowpass', f: 1600, gain: 0.35 });
        this.tone(t, 0.16, { f: 110, f2: 45, gain: 0.4 });
        break;
      case 'heavy':
        this.noise(t, 0.25, { type: 'lowpass', f: 900, gain: 0.5 });
        this.tone(t, 0.3, { f: 80, f2: 32, gain: 0.6 });
        break;
      case 'sever':
        this.noise(t, 0.35, { f: 2400, f2: 260, q: 2, gain: 0.45 });
        this.tone(t, 0.25, { f: 90, f2: 40, gain: 0.5 });
        this.noise(t + 0.08, 0.4, { type: 'lowpass', f: 500, gain: 0.2 });
        break;
      case 'miss': this.noise(t, 0.16, { f: 500, f2: 1900, q: 3, gain: 0.12 }); break;
      case 'hurt':
        this.tone(t, 0.25, { f: 140, f2: 60, gain: 0.45, type: 'triangle' });
        this.noise(t, 0.18, { type: 'lowpass', f: 1200, gain: 0.3 });
        break;
      case 'coin':
        this.tone(t, 0.12, { f: 2100 + r() * 300, gain: 0.07, type: 'triangle', verb: true });
        this.tone(t + 0.05, 0.16, { f: 2700 + r() * 300, gain: 0.06, type: 'triangle', verb: true });
        break;
      case 'flip':
        for (let i = 0; i < 6; i++) this.tone(t + i * 0.09, 0.05, { f: 3000 + i * 120, gain: 0.03, type: 'triangle' });
        break;
      case 'land':
        for (const f of [1230, 2710, 4150]) this.tone(t, 0.9, { f, gain: 0.07, type: 'sine', verb: true });
        this.noise(t, 0.04, { f: 3000, gain: 0.1 });
        break;
      case 'door':
        this.tone(t, 0.45, { f: 110, f2: 170, gain: 0.08, type: 'sawtooth' });
        this.noise(t, 0.4, { f: 600, q: 6, gain: 0.05 });
        this.tone(t + 0.42, 0.12, { f: 70, f2: 40, gain: 0.25 });
        break;
      case 'chest':
        this.tone(t, 0.12, { f: 90, f2: 50, gain: 0.3 });
        this.tone(t + 0.05, 0.35, { f: 200, f2: 260, gain: 0.05, type: 'sawtooth' });
        break;
      case 'barrel':
        this.noise(t, 0.2, { type: 'lowpass', f: 1400, gain: 0.4 });
        for (let i = 0; i < 4; i++) this.noise(t + 0.05 + i * 0.04, 0.05, { f: 1200 + r() * 1500, gain: 0.12 });
        break;
      case 'explode':
        this.noise(t, 1.2, { type: 'lowpass', f: 1800, f2: 120, gain: 0.8, attack: 0.01 });
        this.tone(t, 0.8, { f: 70, f2: 25, gain: 0.8 });
        break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise(t + i * 0.12, 0.07, { f: 1800 + r() * 800, q: 2, gain: 0.12 }); break;
      case 'drink': for (let i = 0; i < 3; i++) this.tone(t + i * 0.16, 0.1, { f: 220 + r() * 50, f2: 340, gain: 0.12 }); break;
      case 'torch':
        this.noise(t, 0.6, { type: 'lowpass', f: 300, f2: 2400, gain: 0.25, attack: 0.08 });
        break;
      case 'stairs':
        for (let i = 0; i < 6; i++) this.noise(t + i * 0.18, 0.06, { f: 500 + r() * 300, gain: 0.08 - i * 0.01 });
        this.tone(t, 1.6, { f: 50, f2: 38, gain: 0.25, attack: 0.3 });
        break;
      case 'growl':
        this.tone(t, 0.7, { f: 72, f2: 58, gain: 0.25, type: 'sawtooth', attack: 0.06 });
        this.noise(t, 0.6, { f: 300, q: 3, gain: 0.12, attack: 0.08 });
        break;
      case 'shriek': this.tone(t, 0.5, { f: 1400, f2: 2400, gain: 0.08, type: 'sawtooth', verb: true }); break;
      case 'shrine': for (const f of [220, 261.6, 329.6, 440]) this.tone(t, 2.4, { f, gain: 0.05, attack: 0.5, verb: true }); break;
      case 'curse': for (const f of [233, 247, 311]) this.tone(t, 2.0, { f, f2: f * 0.8, gain: 0.05, attack: 0.3, type: 'sawtooth', verb: true }); break;
      case 'portal': this.tone(t, 1.4, { f: 300, f2: 1400, gain: 0.08, type: 'triangle', verb: true, attack: 0.2 }); break;
      case 'heart':
        this.tone(t, 0.12, { f: 60, f2: 40, gain: 0.35 });
        this.tone(t + 0.2, 0.12, { f: 55, f2: 38, gain: 0.25 });
        break;
      case 'death':
        this.tone(t, 3.5, { f: 110, f2: 30, gain: 0.4, type: 'sawtooth', attack: 0.05, verb: true });
        this.noise(t, 3, { type: 'lowpass', f: 800, f2: 80, gain: 0.3, attack: 0.5 });
        break;
      case 'crow':
        for (let i = 0; i < 2; i++) this.noise(t + i * 0.25, 0.18, { f: 1100, f2: 700, q: 4, gain: 0.05, dest: this.ambBus });
        break;
      case 'crackle': for (let i = 0; i < 3; i++) this.noise(t + r() * 0.8, 0.02, { f: 2500 + r() * 2000, gain: 0.03, dest: this.ambBus }); break;
      case 'drip': this.tone(t, 0.25, { f: 1500 + r() * 600, f2: 700, gain: 0.04, verb: true, dest: this.ambBus }); break;
      case 'moan': this.tone(t, 2.6, { f: 160 + r() * 60, f2: 110, gain: 0.03, attack: 0.8, type: 'triangle', verb: true, dest: this.ambBus }); break;
      case 'chain': for (let i = 0; i < 4; i++) this.noise(t + i * 0.07, 0.05, { f: 4000, q: 8, gain: 0.03, dest: this.ambBus }); break;
      case 'rumble': this.noise(t, 2.5, { type: 'lowpass', f: 120, gain: 0.25, attack: 0.6, dest: this.ambBus }); break;
      case 'whisper': this.noise(t, 1.4, { f: 2600, f2: 1800, q: 5, gain: 0.04, attack: 0.3, dest: this.ambBus }); break;
    }
  },
};
