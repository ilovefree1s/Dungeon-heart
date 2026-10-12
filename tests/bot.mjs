// A bot that plays the game's rules headless (no graphics): node tests/bot.mjs [class 0-2] [floors] [seed]
// It walks the rooms by the map (breadth-first over cells), fights, loots, equips upgrades,
// learns talents and picks the medium boss door. It checks the rules hold together: rooms
// clear and their doors open, floors advance, bosses die, nothing throws, nothing gets stuck.
import * as S from '../src/sim.js';
import * as D from '../src/data.js';
const G = S.G;
export function runBot(cls = 0, floors = 5, seed = 1, opts = {}) {
  const it = botSteps(cls, floors, seed, opts);
  let r;
  while (!(r = it.next()).done) S.tick(r.value[0], r.value[1]);
  return r.value;
}
// the bot, one game step at a time: yields [pad, padNew] for the caller to run
export function* botSteps(cls = 0, floors = 5, seed = 1, opts = {}) {
  if (!opts.noSetup) {
    S.seed(seed);
    S.new_hero(cls);
    S.start_room();
  }
  const log = [];
  let frames = 0, deaths = 0, stuckT = 0, lastKey = '', press = 0, lastFloor = 1, floorStart = 0;
  const floorTimes = [];
  const cache = { f: -99, p: null, key: '' }, skip = new Set(), chase = { k: null, t: 0 };
  const maxFrames = opts.maxFrames || floors * 60 * 60 * 12;
  const cellOf = (x, y) => [((x + 8) >> 4), ((y + 10 - D.PLAY_Y) >> 4)];
  const walk = c => !D.TILE_WALK[G.map[c]] || G.map[c] === D.T_DOORWAY || G.map[c] === D.T_STAIRS;
  function path(fromX, fromY, toCx, toCy) {
    const start = fromY * 16 + fromX, goal = toCy * 16 + toCx;
    const prev = new Int16Array(176).fill(-1), q = [start];
    prev[start] = start;
    while (q.length) {
      const c = q.shift();
      if (c === goal) break;
      const cx = c & 15, cy = c >> 4;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx > 15 || ny < 0 || ny > 10) continue;
        const n = ny * 16 + nx;
        if (prev[n] !== -1) continue;
        if (n !== goal && !walk(n)) continue;
        prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] === -1) return null;
    let c = goal, steps = [];
    while (c !== start) { steps.push(c); c = prev[c]; }
    return steps.reverse();
  }
  // the last stretch, pixel by pixel: hero positions around (x0, y0) until goal(px, py)
  function pixPath(goal, rad = 56) {
    const x0 = G.px, y0 = G.py, W = rad * 2 + 1, seen = new Int32Array(W * W).fill(-1);
    const q = [[x0, y0]];
    seen[rad * W + rad] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const [x, y] = q[qi];
      if (goal(x, y)) {
        let c = (y - y0 + rad) * W + (x - x0 + rad), steps = [];
        while (seen[c] !== c && seen[c] !== 0 || (steps.length === 0 && c !== rad * W + rad)) {
          const px = c % W - rad + x0, py = ((c / W) | 0) - rad + y0;
          steps.push([px, py]);
          if (c === rad * W + rad) break;
          c = seen[c] - 1;
          if (c < 0) break;
        }
        return steps.reverse();
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (Math.abs(nx - x0) > rad || Math.abs(ny - y0) > rad) continue;
        const c = (ny - y0 + rad) * W + (nx - x0 + rad);
        if (seen[c] !== -1) continue;
        if (nx < 0 || nx > 255 || S.blocked(nx, ny)) { seen[c] = -2; continue; }
        if (dx && dy && (S.blocked(x + dx, y) || S.blocked(x, y + dy))) { continue; }
        seen[c] = (y - y0 + rad) * W + (x - x0 + rad) + 1;
        q.push([nx, ny]);
      }
    }
    return null;
  }
  // the last stretch to an item, or to a spot lined up with a foe (re-planned every 8 frames)
  function nearPath(foe, ranged, tx, ty) {
    if (foe && !ranged) return null;
    const key = (foe ? 'f' : 'i') + tx + ',' + ty;
    if (cache.key === key && cache.f > frames - 8 && cache.p && cache.p.length > 1) { cache.p.shift(); return cache.p; }
    cache.f = frames; cache.key = key;
    cache.p = !foe ? pixPath((x, y) => x + 13 > tx + 4 && x + 2 < tx + 12 && y + 15 > ty + 6 && y + 4 < ty + 14, 64)
      : pixPath((x, y) => (Math.abs(x - tx) < 5 || Math.abs(y - ty) < 5) && Math.abs(x - tx) + Math.abs(y - ty) > 24 && clear(x + 8, y + 8, tx + 8, ty + 8), 64);
    return cache.p;
  }
  // nothing solid between two points (the shot's path)
  function clear(x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) >> 2;
    for (let i = 1; i < n; i++) if (S.solid(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }
  function manage() {
    // equip anything better in the bag, sell the rest when the bag fills, learn talents
    for (let k = 0; k < D.BAG; ++k) {
      const kind = G.b_kind[k];
      if (!kind) continue;
      if (kind === D.K_TRINKET) { if (!G.eq_has[6] || G.b_rar[k] > G.eq_rar[6]) S.bag_equip(k); continue; }
      if (!G.eq_has[kind - 1] || G.b_lvl[k] > G.eq_lvl[kind - 1]) S.bag_equip(k);
    }
    if (S.bag_free() >= D.BAG - 2) for (let k = 0; k < D.BAG; ++k) if (G.b_kind[k]) S.bag_sell(k);
    const order = cls === 0 ? [0, 1, 3, 5, 6, 2, 4, 7, 8, 9, 10, 11, 12, 13, 14] : cls === 1 ? [0, 1, 10, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    for (let guard = 0; guard < 20 && S.tal_avail(); ++guard) {
      const i = order.find(i => S.tal_unlocked(i) && G.tal[i] < D.TAL_MAX[i]);
      if (i === undefined) break;
      S.tal_learn(i);
    }
    if (G.hp < G.maxhp * 0.35 && G.potions) S.drink_potion();
  }
  while (frames < maxFrames) {
    frames++;
    if (!opts.keepEvents) G.ev.length = 0;
    if (G.state === 'dead') { deaths++; S.respawn(); continue; }
    if (G.state === 'rescue') { yield [0, 0]; continue; }
    if (G.state === 'win') { log.push('WIN'); break; }
    if (G.floor_num !== lastFloor) { floorTimes.push(((frames - floorStart) / 60) | 0); floorStart = frames; lastFloor = G.floor_num; }
    if (G.floor_num > floors) break;
    if (frames % 30 === 0) manage();
    // the target: nearest monster / the boss / an item / the door
    const [hx, hy] = cellOf(G.px, G.py);
    let tx = null, ty = null, foe = null, itemK = null;
    let bd = 1e9;
    for (let n = 0; n < D.MAXM; ++n) {
      if (!G.m_type[n]) continue;
      const d = Math.abs(G.m_x[n] - G.px) + Math.abs(G.m_y[n] - G.py);
      if (d < bd) { bd = d; foe = [G.m_x[n], G.m_y[n]]; }
    }
    if (!foe && G.boss_on) foe = [G.bx + 8, G.by + 10];
    if (!foe) {
      for (let i = 0; i < D.MAXI; ++i) if (G.i_kind[i] && G.full_item !== i + 1 && !skip.has(G.room_num * 1000 + i * 100 + G.i_x[i])) { tx = G.i_x[i] - 4; ty = G.i_y[i] - 6; itemK = G.room_num * 1000 + i * 100 + G.i_x[i]; break; }
      if (tx === null && G.door_open) {
        let dp = G.door_pos;
        const dc = dp & 15, dr = dp >> 4;
        // walk into it: a point just past the wall
        tx = dc * 16 + (dc === 15 ? 12 : 0); ty = D.PLAY_Y + dr * 16 + (dr === 0 ? -12 : dr === 10 ? 12 : 0);
      }
    } else { tx = foe[0]; ty = foe[1]; }
    let pad = 0, padNew = 0;
    if (tx !== null) {
      const dx = tx - G.px, dy = ty - G.py, dist = Math.abs(dx) + Math.abs(dy);
      const ranged = cls !== 0;
      let mx = 0, my = 0, pp = null;
      if (foe && !ranged && dist < 22) {
        // face it and swing
        G.pdir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? D.DIR_RIGHT : D.DIR_LEFT) : (dy > 0 ? D.DIR_DOWN : D.DIR_UP);
        if ((++press & 1)) padNew |= S.PAD_B;
        if (dist < 10) { mx = dx > 0 ? -1 : 1; } // back off a little
      } else if (foe && ranged && (Math.abs(dx) < 6 || Math.abs(dy) < 6) && dist < 120 && clear(G.px + 8, G.py + 8, tx + 8, ty + 8)) {
        G.pdir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? D.DIR_RIGHT : D.DIR_LEFT) : (dy > 0 ? D.DIR_DOWN : D.DIR_UP);
        if ((++press & 1)) padNew |= S.PAD_B;
        if (dist < 30) { if (Math.abs(dx) < 6) mx = (G.px < 120 ? 1 : -1); else my = (G.py < 110 ? 1 : -1); }
      } else if (Math.abs(dx) + Math.abs(dy) < 60 && (pp = nearPath(foe, ranged, tx, ty))) {
        const st = pp[Math.min(1, pp.length - 1)] || [G.px, G.py];
        if (st[0] > G.px) mx = 1; else if (st[0] < G.px) mx = -1;
        if (st[1] > G.py) my = 1; else if (st[1] < G.py) my = -1;
      } else {
        // the next cell on the path
        let gcx, gcy;
        if (foe && ranged) { // line up on the foe's row or column
          if (Math.abs(dx) < Math.abs(dy)) { gcx = (tx + 8) >> 4; gcy = hy; } else { gcx = hx; gcy = (ty + 10 - D.PLAY_Y) >> 4; }
        } else { gcx = Math.max(0, Math.min(15, (tx + 8) >> 4)); gcy = Math.max(0, Math.min(10, (ty + 10 - D.PLAY_Y) >> 4)); }
        const p = path(hx, hy, gcx, gcy);
        let wx = tx, wy = ty;
        if (p && p.length > 1) { const c = p[0]; wx = (c & 15) * 16; wy = D.PLAY_Y + (c >> 4) * 16 - 4; }
        else if (p && p.length === 1 && !foe) { wx = tx; wy = ty; }
        if (wx > G.px + 1) mx = 1; else if (wx < G.px - 1) mx = -1;
        if (wy > G.py + 1) my = 1; else if (wy < G.py - 1) my = -1;
      }
      if (mx > 0) pad |= S.PAD_RIGHT; if (mx < 0) pad |= S.PAD_LEFT;
      if (my > 0) pad |= S.PAD_DOWN; if (my < 0) pad |= S.PAD_UP;
    }
    // chasing the same item for 8 seconds: leave it
    if (itemK !== null) { if (itemK === chase.k) { if (++chase.t > 480) { skip.add(itemK); chase.t = 0; } } else { chase.k = itemK; chase.t = 0; } }
    // stuck: the same spot for 4 seconds - roll / wander
    const key = G.px + ',' + G.py + ',' + G.room_num;
    if (key === lastKey) { if (stuckT > 150 && itemK !== null) { skip.add(itemK); stuckT = 0; } if (++stuckT > 240) { pad = [S.PAD_UP, S.PAD_DOWN, S.PAD_LEFT, S.PAD_RIGHT][(frames >> 5) & 3]; if (stuckT > 400) stuckT = 0; } }
    else { stuckT = 0; lastKey = key; }
    yield [pad, padNew];
  }
  return { floor: G.floor_num, lvl: G.lvl, deaths, frames, minutes: +(frames / 3600).toFixed(1), floorTimes, gold: G.gold, kills: G.kills, state: G.state, log };
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('bot.mjs')) {
  const cls = +(process.argv[2] ?? 0), floors = +(process.argv[3] ?? 5), seed = +(process.argv[4] ?? 1);
  const t0 = Date.now();
  const r = runBot(cls, floors, seed);
  console.log(D.CLASS_NAME[cls], JSON.stringify(r), ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
