'use strict';
// Monster definitions and their combat sprites, built from separate body-part layers
// so a severed arm simply stops being drawn.

const PART_INFO = {
  head: { name: 'head', kind: 'vital', hit: 48 },
  torso: { name: 'torso', kind: 'vital', hit: 86 },
  rarm: { name: 'right arm', kind: 'limb', hit: 70 },
  larm: { name: 'left arm', kind: 'limb', hit: 70 },
  legs: { name: 'legs', kind: 'move', hit: 74 },
  wings: { name: 'wings', kind: 'move', hit: 64 },
};
const PART_ORDER = ['head', 'torso', 'rarm', 'larm', 'legs', 'wings'];

// ---------------------------------------------------------------- builders
function newLayers(w, h, ids) {
  const L = {};
  for (const id of ids) L[id] = makeCanvas(w, h);
  return L;
}

function buildHumanoid(p) {
  const W = p.w || 72, H = p.h || 86;
  const gy = H - 3, cx = W / 2;
  const hgt = p.height || 60;
  const wd = p.width || 1;
  const headR = p.headR || hgt * 0.095;
  const hunch = p.hunch || 0;
  const headCY = gy - hgt + headR + hgt * 0.06 * hunch;
  const neckY = headCY + headR * 0.85;
  const shY = neckY + hgt * 0.045;
  const shW = hgt * 0.19 * wd;
  const hipY = gy - hgt * 0.43;
  const hipW = hgt * 0.12 * wd * (p.waist || 1);
  const legR = hgt * 0.058 * (p.limb || 1);
  const armR = hgt * 0.05 * (p.limb || 1);
  const ids = ['legs', 'torso', 'rarm', 'larm', 'head'];
  if (p.wings) ids.unshift('wings');
  if (p.cape) ids.unshift('back');
  const L = newLayers(W, H, ids);
  const skin = p.skin, skin2 = p.skin2 || shade(p.skin, -0.25);
  const cloth = p.cloth || skin, cloth2 = p.cloth2 || shade(cloth, -0.3);
  const legCol = p.legCol || cloth2;
  const joints = {};

  // wings
  if (p.wings) {
    const c = L.wings.ctx, wc = p.wingCol || shade(skin, -0.35);
    for (const s of [-1, 1]) {
      const bx = cx + s * shW * 0.4, by = shY + 3;
      const pts = [[bx, by]];
      const span = p.wingSpan || hgt * 0.55;
      pts.push([bx + s * span * 0.55, by - hgt * 0.3]);
      pts.push([bx + s * span, by - hgt * 0.18]);
      for (let i = 0; i < 4; i++) {
        pts.push([bx + s * span * (0.95 - i * 0.22), by + hgt * (0.08 + (i % 2) * 0.06)]);
      }
      pts.push([bx + s * 4, by + hgt * 0.22]);
      P.poly(c, pts, wc);
      for (let i = 0; i < 3; i++) P.line(c, bx, by, bx + s * span * (0.9 - i * 0.25), by - hgt * (0.2 - i * 0.1), 1.2, shade(wc, -0.4));
    }
    joints.wings = [cx, shY + 3];
  }

  // legs
  {
    const c = L.legs.ctx;
    const t = p.legs || 'normal';
    if (p.tail) {
      P.curve(c, [[cx + 4, hipY], [cx + hgt * 0.35, hipY + 8], [cx + hgt * 0.42, gy - 12]], 3, shade(skin, -0.15));
      P.poly(c, [[cx + hgt * 0.42 - 3, gy - 12], [cx + hgt * 0.42 + 3, gy - 12], [cx + hgt * 0.42, gy - 6]], shade(skin, -0.3));
    }
    for (const s of [-1, 1]) {
      const hx = cx + s * hipW * 0.55;
      if (t === 'robe') continue;
      if (t === 'goat') {
        const kx = cx + s * hipW * 1.15, ky = hipY + (gy - hipY) * 0.42;
        const ax = cx + s * hipW * 0.7, ay = gy - (gy - hipY) * 0.18;
        P.limb(c, hx, hipY, kx, ky, legR * 1.2, legR, legCol);
        P.limb(c, kx, ky, ax, ay, legR * 0.9, legR * 0.7, legCol);
        P.limb(c, ax, ay, ax + s, gy - 1, legR * 0.6, legR * 0.6, legCol);
        P.ellipse(c, ax + s, gy - 1, legR * 0.9, 1.6, '#1a1210');
      } else if (t === 'bones') {
        const kx = cx + s * hipW * 0.75, ky = hipY + (gy - hipY) * 0.5;
        P.limb(c, hx, hipY, kx, ky, legR * 0.45, legR * 0.4, legCol);
        P.circle(c, kx, ky, legR * 0.65, legCol);
        P.limb(c, kx, ky, kx + s * 1, gy - 2, legR * 0.4, legR * 0.4, legCol);
        P.ellipse(c, kx + s * 2, gy - 1, legR * 0.9, 1.3, legCol);
      } else {
        const fx = cx + s * hipW * 0.8;
        const kx = cx + s * hipW * 0.75, ky = hipY + (gy - hipY) * 0.5;
        P.limb(c, hx, hipY, kx, ky, legR * 1.1, legR * 0.9, legCol);
        P.limb(c, kx, ky, fx, gy - 2, legR * 0.9, legR * 0.75, legCol);
        P.ellipse(c, fx + s * 1.5, gy - 1.5, legR * 1.2, legR * 0.6, p.boot || '#241a12');
      }
    }
    if (t === 'robe') {
      P.poly(c, [[cx - hipW * 1.1, hipY], [cx + hipW * 1.1, hipY], [cx + hipW * 1.9, gy], [cx - hipW * 1.9, gy]], cloth);
      P.poly(c, [[cx - 1, hipY + 4], [cx + 1, hipY + 4], [cx + 2, gy], [cx - 2, gy]], cloth2);
    }
    joints.legs = [cx, hipY];
  }

  // torso
  {
    const c = L.torso.ctx;
    const t = p.body || 'normal';
    P.rect(c, cx - headR * 0.45, neckY - 2, headR * 0.9, shY - neckY + 4, t === 'bones' ? skin : skin2);
    if (t === 'bones') {
      P.rect(c, cx - 1.2, shY, 2.4, hipY - shY + 2, skin);
      for (let i = 0; i < 4; i++) {
        const y = shY + 3 + i * (hipY - shY - 6) / 4.2;
        const w = shW * (0.85 - i * 0.12);
        P.curve(c, [[cx - w, y + 3], [cx, y - 1], [cx + w, y + 3]], 1.6, skin);
      }
      P.ellipse(c, cx, hipY + 1, hipW * 1.1, 3, skin);
      P.line(c, cx - shW, shY + 1, cx + shW, shY + 1, 2, skin);
    } else if (t === 'fat') {
      P.poly(c, [[cx - shW, shY], [cx + shW, shY], [cx + shW * 1.05, shY + 8], [cx - shW * 1.05, shY + 8]], skin);
      P.ellipse(c, cx, (shY + hipY) / 2 + 4, shW * 1.18, (hipY - shY) * 0.62, skin);
      if (p.apron) {
        P.poly(c, [[cx - shW * 0.6, shY + 6], [cx + shW * 0.6, shY + 6], [cx + shW * 0.85, hipY + 6], [cx - shW * 0.85, hipY + 6]], p.apron);
      } else {
        P.rect(c, cx - shW * 1.05, hipY - 2, shW * 2.1, 4, cloth);
      }
    } else if (t === 'armor') {
      P.poly(c, [[cx - shW, shY], [cx + shW, shY], [cx + hipW * 1.1, hipY + 3], [cx - hipW * 1.1, hipY + 3]], cloth);
      P.rect(c, cx - hipW * 1.2, hipY - 1, hipW * 2.4, 6, cloth2);
      P.line(c, cx, shY + 2, cx, hipY - 2, 1.5, cloth2);
      P.line(c, cx - shW * 0.7, shY + (hipY - shY) * 0.45, cx + shW * 0.7, shY + (hipY - shY) * 0.45, 1.2, cloth2);
      P.ellipse(c, cx - shW, shY + 2, armR * 2, armR * 1.6, shade(cloth, 0.12));
      P.ellipse(c, cx + shW, shY + 2, armR * 2, armR * 1.6, shade(cloth, 0.12));
    } else if (t === 'robe') {
      P.poly(c, [[cx - shW, shY], [cx + shW, shY], [cx + hipW * 1.2, hipY + 2], [cx - hipW * 1.2, hipY + 2]], cloth);
      P.poly(c, [[cx - 2, shY], [cx + 2, shY], [cx + 1, hipY + 2], [cx - 1, hipY + 2]], cloth2);
      if (p.sash) P.rect(c, cx - hipW * 1.2, hipY - 3, hipW * 2.4, 3, p.sash);
    } else {
      const sw = t === 'thin' ? shW * 0.82 : shW;
      P.poly(c, [[cx - sw, shY], [cx + sw, shY], [cx + hipW, hipY + 3], [cx - hipW, hipY + 3]], cloth);
      if (p.bareChest) {
        P.poly(c, [[cx - sw * 0.7, shY + 1], [cx + sw * 0.7, shY + 1], [cx + hipW * 0.8, hipY - 1], [cx - hipW * 0.8, hipY - 1]], skin);
      }
      if (t === 'thin') for (let i = 0; i < 3; i++) P.line(c, cx - sw * 0.5, shY + 5 + i * 3, cx + sw * 0.5, shY + 5 + i * 3, 0.8, skin2);
      P.rect(c, cx - hipW * 1.05, hipY, hipW * 2.1, 3, p.belt || cloth2);
    }
    if (p.cape) {
      const b = L.back.ctx;
      P.poly(b, [[cx - shW * 0.9, shY - 1], [cx + shW * 0.9, shY - 1], [cx + shW * 1.6, gy - 4], [cx - shW * 1.6, gy - 4]], p.cape);
      P.poly(b, [[cx - shW * 1.6, gy - 4], [cx - shW * 0.8, gy - 8], [cx, gy - 3], [cx + shW * 0.8, gy - 8], [cx + shW * 1.6, gy - 4]], shade(p.cape, -0.3));
    }
    if (p.bareChest && (p.body || 'normal') === 'normal' && hgt > 70) {
      const dk = shade(p.skin, -0.28);
      P.curve(c, [[cx - shW * 0.75, shY + 7], [cx - shW * 0.35, shY + 14], [cx - 1, shY + 9]], 1.6, dk);
      P.curve(c, [[cx + shW * 0.75, shY + 7], [cx + shW * 0.35, shY + 14], [cx + 1, shY + 9]], 1.6, dk);
      P.line(c, cx, shY + 14, cx, hipY - 2, 1.2, dk);
      for (let i = 0; i < 3; i++) P.line(c, cx - hipW * 0.6, shY + 20 + i * 6, cx + hipW * 0.6, shY + 20 + i * 6, 1, dk);
    }
    if (p.spikes) {
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const bx = cx + s * (shW * 0.6 + i * 3), by = shY + 1 + i;
        P.poly(c, [[bx - 2, by], [bx + 2, by], [bx + s * 3, by - 7 - i * 2]], p.spikeCol || '#d8c8a0');
      }
    }
    joints.torso = [cx, (shY + hipY) / 2];
  }

  // arms
  for (const [id, s] of [['rarm', -1], ['larm', 1]]) {
    const c = L[id].ctx;
    const sx = cx + s * shW * 0.9, sy = shY + armR * 0.8;
    const armed = id === 'rarm' && p.weapon;
    const shielded = id === 'larm' && p.shield;
    let ex, ey, hx, hy;
    if (armed && p.weapon !== 'staff' && p.weapon !== 'spear') {
      ex = sx + s * armR * 2.6; ey = shY + (hipY - shY) * 0.55;
      hx = sx + s * armR * 1.2; hy = shY + (hipY - shY) * 0.72;
    } else if (shielded) {
      ex = sx + s * armR * 1.8; ey = shY + (hipY - shY) * 0.6;
      hx = sx - s * armR * 0.6; hy = shY + (hipY - shY) * 0.8;
    } else {
      ex = sx + s * armR * 1.6 * (p.armSpread || 1); ey = shY + (hipY - shY) * 0.55;
      hx = sx + s * armR * 1.0 * (p.armSpread || 1); hy = hipY + hgt * 0.06 * (p.armLen || 1);
    }
    const upper = p.sleeve || (p.body === 'bones' ? skin : p.body === 'armor' ? cloth : skin);
    const fore = p.body === 'armor' ? shade(cloth, -0.1) : (p.forearm || skin);
    const ar = p.body === 'bones' ? armR * 0.5 : armR;
    P.limb(c, sx, sy, ex, ey, ar * 1.15, ar, upper);
    P.limb(c, ex, ey, hx, hy, ar, ar * 0.85, fore);
    P.circle(c, hx, hy, ar * 1.05, p.hand || fore);
    if (p.claws) {
      for (let i = -1; i <= 1; i++) P.line(c, hx + i * 1.5, hy + ar, hx + i * 2.2 + s, hy + ar + 4, 1, p.clawCol || '#e0d8c0');
    }
    if (armed) drawWeapon(c, p.weapon, hx, hy, hgt, s, p);
    if (shielded) {
      P.ellipse(c, hx + s * 1, hy - 2, hgt * 0.12, hgt * 0.16, p.shield);
      P.ellipse(c, hx + s * 1, hy - 2, hgt * 0.06, hgt * 0.08, shade(p.shield, 0.2));
    }
    joints[id] = [sx, sy];
  }

  // head
  {
    const c = L.head.ctx;
    const t = p.head || 'round';
    const hc = p.headCol || skin;
    if (t === 'skull') {
      P.ellipse(c, cx, headCY, headR * 0.92, headR, hc);
      P.rect(c, cx - headR * 0.55, headCY + headR * 0.5, headR * 1.1, headR * 0.6, hc);
    } else if (t === 'goat') {
      P.ellipse(c, cx, headCY, headR * 0.85, headR * 1.05, hc);
      P.ellipse(c, cx, headCY + headR * 0.75, headR * 0.55, headR * 0.6, shade(hc, 0.1));
      for (const s of [-1, 1]) {
        P.curve(c, [[cx + s * headR * 0.4, headCY - headR * 0.7], [cx + s * headR * 2.0, headCY - headR * 1.6], [cx + s * headR * 1.6, headCY + headR * 0.2]], headR * 0.45, p.horn || '#cbbf9a');
        P.poly(c, [[cx + s * headR * 0.7, headCY - 1], [cx + s * headR * 1.6, headCY - 2], [cx + s * headR * 0.8, headCY + 2]], hc);
      }
    } else if (t === 'helm') {
      P.ellipse(c, cx, headCY, headR * 1.05, headR * 1.1, hc);
      P.rect(c, cx - headR * 1.05, headCY, headR * 2.1, headR * 0.9, hc);
      P.rect(c, cx - headR * 0.75, headCY - headR * 0.05, headR * 1.5, headR * 0.28, '#0a0606');
      if (p.crest) P.poly(c, [[cx - 1.5, headCY - headR * 1.0], [cx + 1.5, headCY - headR * 1.0], [cx, headCY - headR * 2.0]], p.crest);
    } else if (t === 'hood') {
      P.poly(c, [[cx - headR * 1.2, headCY + headR * 1.1], [cx - headR * 1.15, headCY - headR * 0.4], [cx, headCY - headR * 1.7], [cx + headR * 1.15, headCY - headR * 0.4], [cx + headR * 1.2, headCY + headR * 1.1]], hc);
      P.ellipse(c, cx, headCY + headR * 0.15, headR * 0.65, headR * 0.75, '#080506');
    } else {
      P.ellipse(c, cx, headCY, headR * 0.9, headR, hc);
      if (t === 'imp') {
        for (const s of [-1, 1]) {
          P.poly(c, [[cx + s * headR * 0.6, headCY - 2], [cx + s * headR * 2.0, headCY - headR * 0.9], [cx + s * headR * 0.8, headCY + 2]], hc);
          P.poly(c, [[cx + s * headR * 0.3, headCY - headR * 0.8], [cx + s * headR * 0.65, headCY - headR * 1.7], [cx + s * headR * 0.65, headCY - headR * 0.6]], p.horn || '#2a1a10');
        }
      }
      if (t === 'horned' || p.horns) {
        const big = p.horns === 'big';
        for (const s of [-1, 1]) {
          P.curve(c, [[cx + s * headR * 0.5, headCY - headR * 0.6], [cx + s * headR * (big ? 2.2 : 1.4), headCY - headR * (big ? 1.2 : 1.0)], [cx + s * headR * (big ? 1.6 : 1.0), headCY - headR * (big ? 2.6 : 1.9)]], headR * (big ? 0.5 : 0.35), p.horn || '#2a1a10');
        }
      }
      if (p.hair) {
        P.ellipse(c, cx, headCY - headR * 0.45, headR * 0.98, headR * 0.65, p.hair);
        P.rect(c, cx - headR * 1.0, headCY - headR * 0.4, headR * 0.45, headR * 2.2, p.hair);
        P.rect(c, cx + headR * 0.55, headCY - headR * 0.4, headR * 0.45, headR * 2.2, p.hair);
      }
    }
    if (p.crown) {
      P.rect(c, cx - headR * 0.85, headCY - headR * 1.15, headR * 1.7, headR * 0.45, p.crown);
      for (let i = -1; i <= 1; i++) P.poly(c, [[cx + i * headR * 0.6 - 1.5, headCY - headR * 1.1], [cx + i * headR * 0.6 + 1.5, headCY - headR * 1.1], [cx + i * headR * 0.6, headCY - headR * 1.7]], p.crown);
    }
    joints.head = [cx, neckY];
  }

  const pix = { outline: '#0a0606', seed: (p.seed || 3) };
  for (const id of ids) pixelize(L[id], Object.assign({}, pix, { seed: pix.seed + id.length }));

  // Post details: eyes, mouths, wounds.
  const hc = L.head.ctx;
  const ex = headR * 0.38, ey = headCY - headR * 0.05;
  const t = p.head || 'round';
  if (t === 'skull') {
    for (const s of [-1, 1]) {
      px(hc, cx + s * ex - 1, ey - 1, '#140a08', 2, 2);
      if (p.eye) px(hc, cx + s * ex - (s < 0 ? 0 : 1), ey - (s < 0 ? 0 : 1), p.eye);
    }
    for (let i = -2; i <= 1; i++) px(hc, cx + i * 1.4, headCY + headR * 0.75, '#2a2018');
  } else if (t === 'helm') {
    for (const s of [-1, 1]) px(hc, cx + s * ex - 0.5, headCY + headR * 0.05, p.eye || '#e03020');
  } else if (t === 'hood') {
    for (const s of [-1, 1]) px(hc, cx + s * headR * 0.28 - 0.5, headCY + headR * 0.1, p.eye || '#ff4030');
  } else if (t !== 'none') {
    for (const s of [-1, 1]) {
      px(hc, cx + s * ex - 0.5, ey, p.eye || '#e8d040');
      if (p.eyeBig) px(hc, cx + s * ex - 0.5 + (s < 0 ? -1 : 1), ey, p.eye || '#e8d040');
    }
    if (p.mouth) {
      const my = headCY + headR * (t === 'goat' ? 0.95 : 0.55);
      px(hc, cx - headR * 0.35, my, '#200808', headR * 0.7, 1.2);
      if (p.teeth) for (let i = 0; i < 3; i++) px(hc, cx - headR * 0.3 + i * headR * 0.3, my, p.teeth);
    }
  }
  if (p.wounds) {
    const tc = L.torso.ctx;
    const rng = new RNG(p.seed || 9);
    for (let i = 0; i < p.wounds; i++) {
      px(tc, cx + rng.range(-shW * 0.6, shW * 0.6), rng.range(shY + 3, hipY - 2), rng.pick(['#6a100a', '#8a1a10', '#3a0806']), 2, rng.int(1, 3));
    }
  }
  if (p.glowCracks) {
    const rng = new RNG(77);
    for (const id of ['torso', 'rarm', 'larm', 'legs']) {
      const cc = L[id].ctx;
      const b = opaqueBounds(L[id]);
      if (!b) continue;
      for (let i = 0; i < 6; i++) px(cc, b.x + 2 + rng.next() * (b.w - 4), b.y + 2 + rng.next() * (b.h - 4), rng.pick(['#ff9a30', '#ffd060', '#e05a18']), 1, rng.int(1, 3));
    }
  }
  if (p.blood) {
    const rng = new RNG(31);
    for (const id of ['torso', 'rarm']) {
      const cc = L[id].ctx, b = opaqueBounds(L[id]);
      if (!b) continue;
      for (let i = 0; i < p.blood; i++) px(cc, b.x + 2 + rng.next() * (b.w - 4), b.y + 2 + rng.next() * (b.h - 4), rng.pick(['#7a1410', '#5a0c08', '#9a2014']), rng.int(1, 3), rng.int(1, 4));
    }
  }

  const order = (p.cape ? ['back'] : []).concat(p.wings ? ['wings'] : []).concat(['legs', 'torso', 'larm', 'rarm', 'head']);
  return { w: W, h: H, layers: L, order, joints, drop: gy - hipY - 3, ground: gy };
}

function drawWeapon(c, w, hx, hy, hgt, s, p) {
  const steel = p.steel || '#a8aab4', wood = '#5a3a20';
  if (w === 'axe') {
    const tx = hx + s * 3, ty = hy - hgt * 0.36;
    P.line(c, hx, hy + 3, tx, ty, 2, wood);
    P.poly(c, [[tx, ty - 1], [tx + s * 9, ty - 5], [tx + s * 10, ty + 5], [tx, ty + 5]], steel);
  } else if (w === 'sword' || w === 'greatsword') {
    const len = hgt * (w === 'greatsword' ? 0.62 : 0.45), wd = w === 'greatsword' ? 4 : 2.6;
    const tx = hx + s * 4, ty = hy - len;
    P.limb(c, hx, hy - 3, tx, ty, wd / 2, wd / 3, steel);
    P.line(c, hx - 4, hy - 2, hx + 4, hy - 1, 2, '#6a5a3a');
    P.line(c, hx, hy - 2, hx - s, hy + 3, 2, '#3a2a1a');
  } else if (w === 'spear') {
    P.line(c, hx - s * 2, hy + hgt * 0.25, hx + s * 2, hy - hgt * 0.5, 1.6, wood);
    P.poly(c, [[hx + s * 2 - 2, hy - hgt * 0.5], [hx + s * 2 + 2, hy - hgt * 0.5], [hx + s * 2.5, hy - hgt * 0.5 - 7]], steel);
  } else if (w === 'cleaver') {
    const tx = hx + s * 2, ty = hy - hgt * 0.12;
    P.line(c, hx, hy + 2, tx, ty, 2.4, wood);
    P.poly(c, [[tx - 4, ty], [tx + s * 14, ty - 6], [tx + s * 16, ty - 24], [tx - 2, ty - 18]], '#8a8a90');
    P.poly(c, [[tx + s * 4, ty - 6], [tx + s * 12, ty - 12], [tx + s * 10, ty - 4]], '#6a1410');
  } else if (w === 'staff') {
    P.line(c, hx, hy + hgt * 0.4, hx + s, hy - hgt * 0.45, 1.8, '#3a2a1a');
    P.circle(c, hx + s, hy - hgt * 0.47, 3, p.orb || '#c04020');
  } else if (w === 'club') {
    P.limb(c, hx, hy + 2, hx + s * 6, hy - hgt * 0.32, 2, 4.5, '#4a3424');
  }
}

function buildBeast(p) {
  const W = p.w || 84, H = p.h || 58;
  const gy = H - 3;
  const len = p.len || 52, hgt = p.height || 28;
  const legH = hgt * 0.42;
  const bodyRx = len * 0.38, bodyRy = hgt * 0.32;
  const cx = W / 2 + 6, bodyCY = gy - legH - bodyRy * 0.55;
  const L = newLayers(W, H, ['legs', 'torso', 'head']);
  const col = p.skin, col2 = p.skin2 || shade(col, -0.3);
  const joints = {};
  // legs (far pair darker)
  {
    const c = L.legs.ctx;
    const lr = hgt * 0.07;
    for (const [bx, far] of [[-0.45, true], [0.55, true], [-0.6, false], [0.4, false]]) {
      const x = cx + bodyRx * bx + (far ? 3 : 0), y = bodyCY + bodyRy * 0.4;
      const colL = far ? col2 : col;
      const kx = x + (bx > 0 ? 2 : -1), ky = y + legH * 0.5;
      P.limb(c, x, y, kx, ky, lr * 1.3, lr, colL);
      P.limb(c, kx, ky, x - 1, gy - 1, lr, lr * 0.8, colL);
      P.ellipse(c, x - 2, gy - 1, lr * 1.4, lr * 0.7, colL);
    }
    joints.legs = [cx, bodyCY + bodyRy * 0.6];
  }
  // torso
  {
    const c = L.torso.ctx;
    if (p.tail !== false) P.curve(c, [[cx + bodyRx * 0.8, bodyCY - 2], [cx + bodyRx * 1.4, bodyCY - hgt * 0.3], [cx + bodyRx * 1.6, bodyCY + 4]], hgt * 0.08, col);
    P.ellipse(c, cx, bodyCY, bodyRx, bodyRy, col);
    P.ellipse(c, cx - 2, bodyCY + bodyRy * 0.45, bodyRx * 0.75, bodyRy * 0.45, p.belly || shade(col, 0.15));
    if (p.spikes) {
      for (let i = 0; i < 6; i++) {
        const x = cx - bodyRx * 0.6 + i * bodyRx * 0.26, y = bodyCY - bodyRy * (0.85 - Math.abs(i - 2.5) * 0.04);
        P.poly(c, [[x - 2.5, y + 2], [x + 2.5, y + 2], [x + 1, y - 6 - (i % 2) * 3]], p.spikeCol || '#c8bc98');
      }
    }
    joints.torso = [cx, bodyCY];
  }
  // head
  const headR = hgt * 0.3;
  const hx = cx - bodyRx - headR * 0.35, hy = bodyCY - bodyRy * 0.35;
  {
    const c = L.head.ctx;
    P.limb(c, cx - bodyRx * 0.7, bodyCY - 2, hx, hy, bodyRy * 0.7, headR * 0.7, col);
    P.ellipse(c, hx, hy, headR, headR * 0.85, col);
    P.ellipse(c, hx - headR * 0.95, hy + headR * 0.25, headR * 0.75, headR * 0.45, shade(col, 0.08));
    P.ellipse(c, hx - headR * 0.8, hy + headR * 0.7, headR * 0.6, headR * 0.25, '#2a0e0a');
    P.poly(c, [[hx + headR * 0.2, hy - headR * 0.6], [hx + headR * 0.7, hy - headR * 1.4], [hx + headR * 0.75, hy - headR * 0.3]], col2);
    if (p.horn) P.curve(c, [[hx - headR * 0.6, hy - headR * 0.3], [hx - headR * 1.6, hy - headR * 1.0], [hx - headR * 1.3, hy - headR * 2.0]], headR * 0.45, p.horn);
    joints.head = [cx - bodyRx * 0.8, bodyCY - 2];
  }
  for (const id of ['legs', 'torso', 'head']) pixelize(L[id], { outline: '#0a0606', seed: (p.seed || 5) + id.length });
  const hc = L.head.ctx;
  px(hc, hx - headR * 0.35, hy - headR * 0.2, p.eye || '#e8d040', 2, 1);
  for (let i = 0; i < 4; i++) px(hc, hx - headR * 1.5 + i * headR * 0.3, hy + headR * 0.55, '#e8e0c8');
  return { w: W, h: H, layers: L, order: ['legs', 'torso', 'head'], joints, drop: legH - 2, ground: gy };
}

function buildFlyer(p) {
  const W = p.w || 88, H = p.h || 74;
  const cx = W / 2, cy = H * 0.42;
  const r = p.bodyR || 9;
  const ids = ['wings', 'torso', 'head'];
  if (p.arms) ids.push('rarm', 'larm');
  const L = newLayers(W, H, ids);
  const col = p.skin, wc = p.wingCol || shade(col, -0.25);
  const joints = {};
  {
    const c = L.wings.ctx;
    const span = p.span || 38;
    for (const s of [-1, 1]) {
      const pts = [[cx + s * r * 0.4, cy - r * 0.6], [cx + s * span * 0.45, cy - r * 2.4], [cx + s * span, cy - r * 1.4]];
      const n = 4;
      for (let i = 0; i < n; i++) pts.push([cx + s * span * (1 - (i + 0.6) / n), cy + r * (0.6 + (i % 2) * 0.9)]);
      pts.push([cx + s * r * 0.4, cy + r * 0.6]);
      P.poly(c, pts, wc);
      for (let i = 0; i < 3; i++) P.line(c, cx + s * r * 0.4, cy - r * 0.4, cx + s * span * (0.95 - i * 0.28), cy - r * (1.4 - i * 0.7), 1.3, shade(wc, -0.45));
    }
    joints.wings = [cx, cy - r * 0.3];
  }
  {
    const c = L.torso.ctx;
    P.ellipse(c, cx, cy + r * 0.3, r * 0.9, r * 1.3, col);
    P.limb(c, cx - r * 0.4, cy + r * 1.4, cx - r * 0.6, cy + r * 2.6, 1.6, 1.2, shade(col, -0.2));
    P.limb(c, cx + r * 0.4, cy + r * 1.4, cx + r * 0.6, cy + r * 2.6, 1.6, 1.2, shade(col, -0.2));
    joints.torso = [cx, cy];
  }
  const hy = cy - r * 1.2, hr = p.headR || r * 0.75;
  {
    const c = L.head.ctx;
    P.ellipse(c, cx, hy, hr, hr * 0.9, col);
    for (const s of [-1, 1]) {
      P.poly(c, [[cx + s * hr * 0.3, hy - hr * 0.6], [cx + s * hr * (p.horns ? 0.9 : 1.1), hy - hr * (p.horns ? 2.0 : 1.6)], [cx + s * hr * 0.9, hy - hr * 0.2]], p.horns ? (p.horn || '#2a2a2a') : col);
    }
    joints.head = [cx, hy + hr * 0.7];
  }
  if (p.arms) {
    for (const [id, s] of [['rarm', -1], ['larm', 1]]) {
      const c = L[id].ctx;
      const sx = cx + s * r * 0.8, sy = cy - r * 0.3;
      const ex = sx + s * r * 0.9, ey = cy + r * 0.8, hx2 = sx + s * r * 0.3, hy2 = cy + r * 1.7;
      P.limb(c, sx, sy, ex, ey, 2.4, 2, col);
      P.limb(c, ex, ey, hx2, hy2, 2, 1.7, col);
      for (let i = -1; i <= 1; i++) P.line(c, hx2 + i * 1.4, hy2 + 1, hx2 + i * 2 + s, hy2 + 5, 1, '#d8d0b8');
      joints[id] = [sx, sy];
    }
  }
  for (const id of ids) pixelize(L[id], { outline: '#0a0606', seed: (p.seed || 7) + id.length });
  const hc = L.head.ctx;
  for (const s of [-1, 1]) px(hc, cx + s * hr * 0.38 - 0.5, hy, p.eye || '#ff3020');
  px(hc, cx - 2, hy + hr * 0.5, '#e0d8c0'); px(hc, cx + 1, hy + hr * 0.5, '#e0d8c0');
  const order = ['wings', 'torso'].concat(p.arms ? ['larm', 'rarm'] : []).concat(['head']);
  return { w: W, h: H, layers: L, order, joints, drop: H - 3 - (cy + r * 2.6), ground: H - 3, flyer: true };
}

// Gashes and cracks that show through as a body part takes damage.
function woundLayer(src, bloodless, seed) {
  const w = src.width, h = src.height;
  const d = src.ctx.getImageData(0, 0, w, h).data;
  const c = makeCanvas(w, h);
  const rng = new RNG(seed);
  const b = opaqueBounds(src);
  if (!b) return c;
  const n = Math.max(3, Math.round(b.w * b.h / 90));
  const cols = bloodless ? ['#2a2620', '#5a5244', '#141210'] : ['#6a0c08', '#9a1810', '#3a0604', '#c02a1a'];
  for (let i = 0; i < n; i++) {
    let x = Math.round(b.x + 1 + rng.next() * (b.w - 2)), y = Math.round(b.y + 1 + rng.next() * (b.h - 2));
    const len = rng.int(2, 4), dx = rng.pick([-1, 0, 1]), dy = rng.pick([1, 1, 0]);
    for (let j = 0; j < len; j++) {
      const k = (y * w + x) * 4;
      if (x >= 0 && y >= 0 && x < w && y < h && d[k + 3] > 0 && !(d[k] < 24 && d[k + 1] < 24 && d[k + 2] < 24)) px(c.ctx, x, y, rng.pick(cols));
      x += dx; y += dy;
    }
  }
  return c;
}

const SpriteCache = {};
function monsterSprite(id) {
  if (SpriteCache[id]) return SpriteCache[id];
  const d = MONSTERS[id];
  const sp = d.sprite;
  let s;
  if (sp.type === 'beast') s = buildBeast(sp);
  else if (sp.type === 'flyer') s = buildFlyer(sp);
  else s = buildHumanoid(sp);
  s.white = {}; s.ring = {}; s.bounds = {}; s.wounds = {};
  for (const k of s.order) {
    s.white[k] = silhouette(s.layers[k], '#ffffff');
    s.ring[k] = outlineOnly(s.layers[k], '#ffffff');
    s.bounds[k] = opaqueBounds(s.layers[k]);
    s.wounds[k] = woundLayer(s.layers[k], d.bloodless, id.length * 13 + k.length);
  }
  return (SpriteCache[id] = s);
}

// ---------------------------------------------------------------- definitions
// parts: max HP per body part. attacks: uses = part that must be intact.
const MONSTERS = {
  zombie: {
    name: 'Zombie', depths: [1, 5], weight: 10, group: [1, 2], speed: 950, sight: 5,
    parts: { head: 8, torso: 20, rarm: 8, larm: 8, legs: 10 },
    evade: 0, def: 0, bloodless: true, undead: true, horror: 5, gold: [0, 8], carve: null,
    attacks: [
      { uses: 'rarm', verb: 'rakes its broken nails across', dmg: [2, 5], hit: 60, bleed: 0.2 },
      { uses: 'larm', verb: 'claws at', dmg: [2, 5], hit: 60, bleed: 0.2 },
      { uses: 'head', verb: 'sinks its rotten teeth into', dmg: [3, 6], hit: 50, infect: 0.3 },
    ],
    map: { family: 'humanoid', pal: { 1: '#7c8a6a', 2: '#55604a', 3: '#4a3e34', 4: '#2e261e', e: '#d8d050' } },
    sprite: { height: 60, skin: '#7c8a6a', cloth: '#4a3e34', legCol: '#3a342c', head: 'round', hunch: 0.5, mouth: true, teeth: '#c8c0a0', wounds: 7, eye: '#d8d050', seed: 11, armSpread: 1.3 },
    intro: 'Something that used to be a man shambles out of the dark. Its jaw hangs by a strip of skin.',
    dies: 'The Zombie folds in on itself and is still.',
  },
  fallen: {
    name: 'Fallen One', depths: [1, 4], weight: 12, group: [1, 3], speed: 430, sight: 6,
    parts: { head: 5, torso: 11, rarm: 5, larm: 5, legs: 6 },
    evade: 18, def: 0, horror: 3, gold: [2, 10], carve: 'flesh', special: 'cowardly',
    attacks: [
      { uses: 'rarm', verb: 'jabs its crooked spear into', dmg: [2, 4], hit: 66, bleed: 0.25 },
      { uses: 'larm', verb: 'scratches at', dmg: [1, 3], hit: 70, bleed: 0.15 },
      { uses: 'head', verb: 'bites', dmg: [2, 3], hit: 60, infect: 0.15 },
    ],
    map: { family: 'small', pal: { 1: '#b04a30', 2: '#7a2e1c', 3: '#3a2a1c', e: '#ffe040', w: '#8a8a90' } },
    sprite: { height: 40, w: 60, h: 60, skin: '#b04a30', cloth: '#3a2a1c', bareChest: true, head: 'imp', weapon: 'spear', eye: '#ffe040', eyeBig: true, mouth: true, teeth: '#e8e0c0', legs: 'goat', legCol: '#8a3a24', seed: 21 },
    intro: 'A Fallen One, small and red and giggling, waves its spear at you.',
    dies: 'The Fallen One squeals and dies.',
  },
  skeleton: {
    name: 'Skeleton', depths: [1, 8], weight: 10, group: [1, 3], speed: 650, sight: 6,
    parts: { head: 6, torso: 15, rarm: 6, larm: 6, legs: 8 },
    evade: 8, def: 0, bloodless: true, undead: true, skeletal: true, horror: 4, gold: [0, 12], carve: null,
    attacks: [
      { uses: 'rarm', verb: 'chops its notched axe into', dmg: [3, 6], hit: 66, bleed: 0.3, sever: 0.03 },
      { uses: 'larm', verb: 'strikes with a bony fist at', dmg: [2, 4], hit: 72, brk: 0.12 },
    ],
    map: { family: 'skeleton', pal: { 1: '#d8d0b8', 2: '#8a8270', e: '#e04020' } },
    sprite: { height: 60, skin: '#d8d0b8', body: 'bones', legs: 'bones', legCol: '#d8d0b8', head: 'skull', weapon: 'axe', eye: '#ff4020', seed: 31 },
    intro: 'A Skeleton rattles upright. There is nothing behind its eyes but a red ember.',
    dies: 'The Skeleton comes apart in a clatter of bones.',
  },
  scavenger: {
    name: 'Scavenger', depths: [1, 6], weight: 8, group: [1, 3], speed: 380, sight: 7,
    parts: { head: 7, torso: 14, legs: 9 },
    evade: 20, def: 0, horror: 3, gold: [0, 0], carve: 'meat',
    attacks: [
      { uses: 'head', verb: 'tears at', dmg: [2, 5], hit: 68, bleed: 0.3, infect: 0.15 },
      { uses: 'legs', verb: 'rakes its hind claws across', dmg: [2, 4], hit: 64, bleed: 0.2 },
    ],
    map: { family: 'beast', pal: { 1: '#6a5848', 2: '#4a3c30', 3: '#c8bc98', e: '#e8d040' } },
    sprite: { type: 'beast', len: 48, height: 26, skin: '#6a5848', spikes: true, eye: '#ffd040', seed: 41 },
    intro: 'A Scavenger lifts its head from a corpse. Its spines rise.',
    dies: 'The Scavenger yelps once and lies still.',
  },
  fiend: {
    name: 'Fiend', depths: [2, 7], weight: 7, group: [1, 3], speed: 480, sight: 7,
    parts: { head: 5, torso: 9, wings: 6 },
    evade: 30, def: 0, horror: 4, gold: [0, 4], carve: 'meat',
    attacks: [
      { uses: 'head', verb: 'bites', dmg: [2, 5], hit: 70, bleed: 0.3 },
      { uses: 'head', verb: 'shrieks right into', dmg: [0, 0], hit: 85, mind: 6, noPart: true, text: 'The Fiend shrieks. The sound goes straight into your skull.' },
    ],
    map: { family: 'flyer', pal: { 1: '#4a3a3c', 2: '#2e2224', e: '#ff3020' } },
    sprite: { type: 'flyer', skin: '#4e3c3c', wingCol: '#34262a', eye: '#ff3020', span: 34, bodyR: 8, seed: 51 },
    intro: 'Leathery wings snap open above you. A Fiend.',
    dies: 'The Fiend falls and twitches.',
  },
  goatman: {
    name: 'Goatman', depths: [5, 10], weight: 12, group: [2, 3], speed: 520, sight: 7,
    parts: { head: 10, torso: 24, rarm: 9, larm: 9, legs: 12 },
    evade: 12, def: 1, horror: 5, gold: [4, 20], carve: 'meat',
    attacks: [
      { uses: 'rarm', verb: 'hacks its axe into', dmg: [5, 9], hit: 72, bleed: 0.35, sever: 0.05 },
      { uses: 'head', verb: 'butts its horns into', dmg: [4, 7], hit: 66, brk: 0.25 },
      { uses: 'larm', verb: 'shoves', dmg: [2, 4], hit: 76 },
    ],
    map: { family: 'humanoid', pal: { 1: '#6a5040', 2: '#4a3628', 3: '#3a2c20', 4: '#241a12', e: '#e8e040' } },
    sprite: { height: 64, skin: '#6a5040', cloth: '#3a2c20', head: 'goat', legs: 'goat', legCol: '#5a4434', weapon: 'axe', eye: '#f0e040', bareChest: true, mouth: true, seed: 61 },
    intro: 'A Goatman snorts and grinds its hooves. Clan markings are cut into its chest.',
    dies: 'The Goatman bleats and falls.',
  },
  hidden: {
    name: 'Hidden', depths: [5, 11], weight: 7, group: [1, 2], speed: 470, sight: 7,
    parts: { head: 8, torso: 18, rarm: 8, larm: 8, legs: 10 },
    evade: 32, def: 0, horror: 9, gold: [0, 10], carve: 'flesh', special: 'fade', stealth: true,
    attacks: [
      { uses: 'rarm', verb: 'opens up', dmg: [5, 8], hit: 75, bleed: 0.45 },
      { uses: 'larm', verb: 'slashes', dmg: [5, 8], hit: 75, bleed: 0.45 },
    ],
    map: { family: 'humanoid', pal: { 1: '#a8a0b0', 2: '#706878', 3: '#58506a', 4: '#383046', e: '#ffffff' } },
    sprite: { height: 66, skin: '#a8a0b0', cloth: '#58506a', body: 'thin', head: 'round', claws: true, clawCol: '#f0f0f0', eye: '#ffffff', armLen: 1.5, mouth: true, seed: 71, armSpread: 1.4 },
    intro: 'The air in front of you bends, and then it has a shape. A Hidden.',
    dies: 'The Hidden flickers and is gone for good.',
  },
  gargoyle: {
    name: 'Gargoyle', depths: [6, 11], weight: 6, group: [1, 2], speed: 560, sight: 6,
    parts: { head: 10, torso: 24, wings: 12, rarm: 9, larm: 9 },
    evade: 18, def: 2, horror: 6, gold: [0, 15], carve: null,
    attacks: [
      { uses: 'rarm', verb: 'rakes stone claws across', dmg: [5, 10], hit: 70, bleed: 0.3 },
      { uses: 'larm', verb: 'claws', dmg: [5, 10], hit: 70, bleed: 0.3 },
      { uses: 'head', verb: 'bites down on', dmg: [6, 9], hit: 62, brk: 0.2 },
    ],
    map: { family: 'flyer', pal: { 1: '#6a6a66', 2: '#46463f', e: '#ff6030' } },
    sprite: { type: 'flyer', skin: '#6c6a64', wingCol: '#4a4844', eye: '#ff7030', span: 40, bodyR: 10, arms: true, horns: true, horn: '#3a3a36', seed: 81 },
    intro: 'What you took for a statue unfolds its wings. A Gargoyle.',
    dies: 'The Gargoyle cracks apart like a dropped urn.',
  },
  horned: {
    name: 'Horned Demon', depths: [6, 12], weight: 6, group: [1, 1], speed: 440, sight: 7,
    parts: { head: 14, torso: 28, legs: 14 },
    evade: 8, def: 1, horror: 6, gold: [0, 0], carve: 'meat',
    attacks: [
      { uses: 'head', verb: 'charges and rams its horn into', dmg: [7, 12], hit: 64, brk: 0.45 },
      { uses: 'head', verb: 'gores', dmg: [6, 10], hit: 70, bleed: 0.4 },
      { uses: 'legs', verb: 'tramples', dmg: [4, 8], hit: 70, brk: 0.2 },
    ],
    map: { family: 'beast', pal: { 1: '#5c4a5a', 2: '#3e3040', 3: '#e0d4b0', e: '#ff6030' } },
    sprite: { type: 'beast', len: 58, height: 32, skin: '#5c4a5a', horn: '#e0d4b0', eye: '#ff6030', seed: 91 },
    intro: 'A Horned Demon lowers its head. It has already decided to charge.',
    dies: 'The Horned Demon crashes down and does not rise.',
  },
  acidbeast: {
    name: 'Acid Beast', depths: [9, 13], weight: 8, group: [1, 2], speed: 520, sight: 6,
    parts: { head: 12, torso: 30, legs: 14 },
    evade: 10, def: 1, horror: 7, gold: [0, 0], carve: 'meat',
    attacks: [
      { uses: 'head', verb: 'spits a gout of acid onto', dmg: [5, 9], hit: 72, poison: 25 },
      { uses: 'head', verb: 'bites into', dmg: [6, 10], hit: 68, bleed: 0.3, infect: 0.25 },
      { uses: 'legs', verb: 'claws', dmg: [4, 7], hit: 70 },
    ],
    map: { family: 'beast', pal: { 1: '#5a7a3a', 2: '#3e5426', 3: '#d0e070', e: '#e8f040' } },
    sprite: { type: 'beast', len: 60, height: 30, skin: '#5a7a3a', spikes: true, spikeCol: '#c8d870', eye: '#f0ff40', seed: 101 },
    intro: 'An Acid Beast drools a hissing puddle onto the stone.',
    dies: 'The Acid Beast dissolves into its own spittle.',
  },
  overlord: {
    name: 'Overlord', depths: [9, 14], weight: 6, group: [1, 1], speed: 780, sight: 6,
    parts: { head: 16, torso: 48, rarm: 16, larm: 16, legs: 20 },
    evade: 0, def: 2, horror: 8, gold: [10, 40], carve: 'flesh',
    attacks: [
      { uses: 'rarm', verb: 'brings its club down on', dmg: [9, 15], hit: 64, brk: 0.45 },
      { uses: 'larm', verb: 'pounds its fist into', dmg: [6, 10], hit: 70, brk: 0.3 },
    ],
    map: { family: 'hulk', pal: { 1: '#8a6a5a', 2: '#5a4438', 3: '#6a5446', 4: '#3a2c24', e: '#ffd040' } },
    sprite: { height: 76, w: 90, h: 96, width: 1.5, skin: '#8a6a5a', cloth: '#3a2c24', body: 'fat', head: 'round', headR: 6, weapon: 'club', eye: '#ffd040', mouth: true, teeth: '#e0d8b0', seed: 111 },
    intro: 'An Overlord heaves itself up, its belly swinging.',
    dies: 'The Overlord topples like a felled tree.',
  },
  magma: {
    name: 'Magma Demon', depths: [10, 14], weight: 7, group: [1, 2], speed: 560, sight: 7,
    parts: { head: 12, torso: 34, rarm: 12, larm: 12, legs: 14 },
    evade: 10, def: 1, horror: 8, gold: [5, 25], carve: null,
    attacks: [
      { uses: 'rarm', verb: 'hurls a ball of molten rock at', dmg: [8, 13], hit: 70, burn: true },
      { uses: 'larm', verb: 'claws', dmg: [6, 10], hit: 70, bleed: 0.3 },
    ],
    map: { family: 'humanoid', pal: { 1: '#3a2018', 2: '#24120c', 3: '#5a2a14', 4: '#ff8a20', e: '#ffb030' } },
    sprite: { height: 66, skin: '#3e2219', cloth: '#3e2219', head: 'horned', horn: '#1a0a06', eye: '#ffc030', glowCracks: true, claws: true, clawCol: '#ff9a30', tail: true, seed: 121 },
    intro: 'Heat rolls off the thing before you. A Magma Demon, cracked and glowing.',
    dies: 'The Magma Demon cools and crumbles.',
  },
  knight: {
    name: 'Black Knight', depths: [13, 16], weight: 8, group: [1, 2], speed: 600, sight: 7,
    parts: { head: 16, torso: 52, rarm: 16, larm: 16, legs: 20 },
    evade: 8, def: 4, horror: 9, gold: [20, 60], carve: null, headMod: -12,
    attacks: [
      { uses: 'rarm', verb: 'drives its sword into', dmg: [10, 16], hit: 74, bleed: 0.4, sever: 0.1 },
      { uses: 'larm', verb: 'smashes its shield into', dmg: [6, 10], hit: 72, brk: 0.35 },
    ],
    map: { family: 'humanoid', pal: { 1: '#3a3c44', 2: '#24262c', 3: '#3a3c44', 4: '#24262c', e: '#e03020' } },
    sprite: { height: 70, w: 80, h: 92, skin: '#3a3c44', cloth: '#3e4048', cloth2: '#26282e', body: 'armor', head: 'helm', headCol: '#4a4c56', crest: '#7a1410', weapon: 'sword', shield: '#2e3038', eye: '#ff3020', legCol: '#2e3036', seed: 131 },
    intro: 'A Black Knight steps forward. Its armor is the color of a moonless night.',
    dies: 'The Black Knight falls with a sound like a dropped bell.',
  },
  succubus: {
    name: 'Succubus', depths: [13, 16], weight: 6, group: [1, 2], speed: 480, sight: 8,
    parts: { head: 12, torso: 30, rarm: 10, larm: 10, wings: 12 },
    evade: 24, def: 0, horror: 10, gold: [10, 50], carve: null,
    attacks: [
      { uses: 'rarm', verb: 'flings a blood star at', dmg: [8, 13], hit: 72, mind: 6 },
      { uses: 'head', verb: 'whispers to', dmg: [0, 0], hit: 80, mind: 16, noPart: true, text: 'The Succubus whispers something in your mother\'s voice.' },
      { uses: 'larm', verb: 'claws', dmg: [6, 9], hit: 70, bleed: 0.35 },
    ],
    map: { family: 'humanoid', pal: { 1: '#9a3a4a', 2: '#6a2432', 3: '#2a1a24', 4: '#140a10', e: '#ffd0d0' } },
    sprite: { height: 64, skin: '#9a3a4a', cloth: '#2a1a24', body: 'normal', legs: 'robe', head: 'horned', hair: '#1a0e14', wings: true, wingCol: '#4a1a24', eye: '#ffe0e0', claws: true, seed: 141 },
    intro: 'A Succubus descends on slow wings, smiling with too many teeth.',
    dies: 'The Succubus shrieks and burns away.',
  },
  advocate: {
    name: 'Advocate', depths: [13, 16], weight: 6, group: [1, 1], speed: 560, sight: 8,
    parts: { head: 12, torso: 32, rarm: 12, larm: 12, legs: 12 },
    evade: 18, def: 0, horror: 10, gold: [20, 70], carve: 'flesh', special: 'blink',
    attacks: [
      { uses: 'rarm', verb: 'sends a wave of fire over', dmg: [10, 16], hit: 70, burn: true },
      { uses: 'head', verb: 'reaches into the mind of', dmg: [4, 8], hit: 75, mind: 14, noPart: true, text: 'The Advocate speaks a word. Your thoughts come apart.' },
    ],
    map: { family: 'robed', pal: { 1: '#4a2a5a', 2: '#2e1a3a', 3: '#4a2a5a', 4: '#2e1a3a', e: '#ff4040', w: '#6a4a2a' } },
    sprite: { height: 68, skin: '#c8a090', cloth: '#4a2a5a', cloth2: '#2e1a3a', body: 'robe', legs: 'robe', head: 'hood', headCol: '#3e2250', weapon: 'staff', orb: '#ff5020', eye: '#ff4040', sleeve: '#4a2a5a', sash: '#c8a040', seed: 151 },
    intro: 'An Advocate of the Black Path regards you from under its hood.',
    dies: 'The Advocate\'s robes collapse, empty.',
  },
  balrog: {
    name: 'Balrog', depths: [14, 16], weight: 5, group: [1, 1], speed: 620, sight: 7,
    parts: { head: 20, torso: 70, rarm: 22, larm: 22, legs: 26, wings: 20 },
    evade: 5, def: 3, horror: 14, gold: [30, 90], carve: null,
    attacks: [
      { uses: 'rarm', verb: 'engulfs you in flame. It hits your', dmg: [14, 22], hit: 68, burn: true },
      { uses: 'larm', verb: 'tears into', dmg: [10, 16], hit: 70, bleed: 0.45, sever: 0.08 },
      { uses: 'legs', verb: 'stamps on', dmg: [8, 12], hit: 66, brk: 0.3 },
    ],
    map: { family: 'demon', pal: { 1: '#5a2018', 2: '#3a120c', 3: '#5a2018', 4: '#3a120c', e: '#ffd040' } },
    sprite: { height: 84, w: 110, h: 104, width: 1.35, waist: 0.75, skin: '#5a2018', cloth: '#3a120c', head: 'horned', horns: 'big', horn: '#1a0806', wings: true, wingCol: '#3a0e0a', wingSpan: 52, claws: true, tail: true, eye: '#ffd040', spikes: true, spikeCol: '#2a0a06', bareChest: true, seed: 161 },
    intro: 'The heat arrives before the Balrog does.',
    dies: 'The Balrog roars and burns down to cinders.',
  },
  // ---- uniques
  butcher: {
    name: 'The Butcher', unique: true, depths: [2, 2], group: [1, 1], speed: 420, sight: 6,
    parts: { head: 26, torso: 80, rarm: 28, larm: 28, legs: 34 },
    evade: 0, def: 1, horror: 22, gold: [250, 400], carve: null, special: 'grab', drop: ['cleaver'],
    attacks: [
      { uses: 'rarm', verb: 'brings his cleaver down on', dmg: [9, 16], hit: 72, bleed: 0.6, sever: 0.22 },
      { uses: 'larm', verb: 'hooks his fingers into', dmg: [4, 8], hit: 76, grab: true },
    ],
    map: { family: 'hulk', pal: { 1: '#c89080', 2: '#9a6a5a', 3: '#d0c8b8', 4: '#8a1a10', e: '#ff3020' } },
    sprite: { height: 78, w: 96, h: 100, width: 1.6, skin: '#c89080', cloth: '#5a4a3a', body: 'fat', apron: '#cfc6b4', head: 'round', headR: 6.2, weapon: 'cleaver', eye: '#ff3020', mouth: true, teeth: '#e8e0c8', blood: 22, seed: 171 },
    intro: '{r}"Ah... fresh meat!"{/}',
    dies: 'The Butcher crashes down among his own hooks. The room is very quiet.',
  },
  leoric: {
    name: 'The Skeleton King', unique: true, depths: [3, 3], group: [1, 1], speed: 700, sight: 7,
    parts: { head: 22, torso: 50, rarm: 22, larm: 22, legs: 28 },
    evade: 5, def: 1, bloodless: true, undead: true, skeletal: true, horror: 15, gold: [150, 250], carve: null,
    special: 'raise', drop: ['crown'],
    attacks: [
      { uses: 'rarm', verb: 'cleaves his great sword through', dmg: [8, 14], hit: 70, bleed: 0.4, sever: 0.12 },
      { uses: 'larm', verb: 'crushes', dmg: [4, 8], hit: 72, brk: 0.3 },
    ],
    map: { family: 'skeleton', pal: { 1: '#e0d8c0', 2: '#9a9078', e: '#ff3020' } },
    sprite: { height: 76, w: 84, h: 98, width: 1.25, skin: '#ddd4bc', body: 'bones', legs: 'bones', legCol: '#ddd4bc', head: 'skull', weapon: 'greatsword', crown: '#d8a83a', cape: '#6a1410', eye: '#ff3020', seed: 181 },
    intro: '{r}"The warmth of life has entered my tomb. Prepare yourself, mortal, to serve my master for eternity!"{/}',
    dies: 'King Leoric crumbles. His crown rolls across the floor and stops at your feet.',
  },
  gharbad: {
    name: 'Gharbad the Weak', unique: true, depths: [4, 4], group: [1, 1], speed: 600, sight: 5,
    parts: { head: 7, torso: 16, rarm: 6, larm: 6, legs: 8 },
    evade: 10, def: 0, horror: 0, gold: [60, 90], carve: 'meat', drop: [],
    attacks: [
      { uses: 'rarm', verb: 'swings a little club at', dmg: [3, 6], hit: 68, brk: 0.1 },
    ],
    map: { family: 'humanoid', pal: { 1: '#7a6050', 2: '#54402e', 3: '#4a3a28', 4: '#2a1e14', e: '#d0d040' } },
    sprite: { height: 52, skin: '#7a6050', cloth: '#4a3a28', head: 'goat', legs: 'goat', legCol: '#5a4434', weapon: 'club', eye: '#e0e040', bareChest: true, mouth: true, seed: 191 },
    intro: '{y}"Pleeeease, no hurt! No kill! Keep alive and next time good bring to you!"{/}',
    dies: 'Gharbad gurgles and dies.',
  },
  diablo: {
    name: 'Diablo', unique: true, depths: [16, 16], group: [1, 1], speed: 520, sight: 8,
    parts: { head: 45, torso: 220, rarm: 45, larm: 45, legs: 60 },
    evade: 10, def: 4, horror: 40, gold: [0, 0], carve: null, special: 'lord',
    attacks: [
      { uses: 'head', verb: 'calls down the Apocalypse on', dmg: [16, 26], hit: 80, mind: 15, burn: true },
      { uses: 'rarm', verb: 'rips into', dmg: [18, 28], hit: 72, bleed: 0.6, sever: 0.25 },
      { uses: 'larm', verb: 'tears at', dmg: [18, 28], hit: 72, bleed: 0.6, sever: 0.25 },
      { uses: 'head', verb: 'looks at', dmg: [0, 0], hit: 90, mind: 25, noPart: true, text: 'Diablo looks at you. You remember every sin you ever committed, and some you have not yet.' },
    ],
    map: { family: 'demon', pal: { 1: '#9a2418', 2: '#6a140c', 3: '#9a2418', 4: '#6a140c', e: '#ffe060' } },
    sprite: { height: 106, w: 130, h: 124, width: 1.45, waist: 0.68, skin: '#9a2418', cloth: '#6a140c', head: 'horned', horns: 'big', horn: '#2a0e08', tail: true, claws: true, spikes: true, spikeCol: '#e8d8b0', eye: '#ffe060', mouth: true, teeth: '#f0e8d0', bareChest: true, seed: 201 },
    intro: '{r}You have found the Lord of Terror.{/} You are not a hero. You were never meant to be here.',
    dies: 'Diablo falls. The red light in the chamber dies with him.',
  },
};

for (const id in MONSTERS) MONSTERS[id].id = id;

// Monsters that can appear in a dungeon at a given depth (weighted).
function monsterPool(depth) {
  const out = [];
  for (const id in MONSTERS) {
    const m = MONSTERS[id];
    if (m.unique) continue;
    if (depth >= m.depths[0] && depth <= m.depths[1]) out.push([id, m.weight]);
  }
  return out;
}
function monsterScale(id, depth) {
  const m = MONSTERS[id];
  return 1 + 0.08 * Math.max(0, depth - m.depths[0]);
}
