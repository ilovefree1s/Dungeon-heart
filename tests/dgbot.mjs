// node tests/dgbot.mjs [seeds] [first]: a bot plays whole seeded dungeons through the rules (sim.js), with no
// browser: it fights, opens chests, unlocks doors, bombs cracked walls, throws the boomerang at switches,
// pushes blocks and beats the keeper. Every seed must reach the stairs. (The hero can't die here: this
// checks that the rooms can be done, not how hard they are.)
import * as S from '../src/sim.js';
import * as DG from '../src/dungeon.js';
import * as D from '../src/data.js';
const G = S.G;
const { PLAY_Y } = D;
const PADS = { up: S.PAD_UP, down: S.PAD_DOWN, left: S.PAD_LEFT, right: S.PAD_RIGHT };
const DOOR_C = [7, (5 << 4) + 15, (10 << 4) + 7, 5 << 4];
const walkable = c => { const t = G.map[c]; return D.TILE_WALK[t] === 0; };
const cellOf = (x, y) => [((x + 8) >> 4), ((y + 11 - PLAY_Y) >> 4)];
// shortest cell path (4-way) from the hero to any goal cell
function path(goals) {
  const [sx, sy] = cellOf(G.px, G.py), start = (sy << 4) | sx;
  const prev = new Int16Array(176).fill(-2); prev[start] = -1;
  const q = [start];
  const isGoal = new Set(goals);
  while (q.length) {
    const c = q.shift();
    if (isGoal.has(c)) { const p = []; for (let k = c; k !== -1; k = prev[k]) p.unshift(k); return p; }
    const x = c & 15, y = c >> 4;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || nx > 15 || ny < 0 || ny > 10) continue;
      const n = (ny << 4) | nx; if (prev[n] !== -2) continue;
      if (!walkable(n) && !isGoal.has(n)) continue;
      prev[n] = c; q.push(n);
    }
  }
  return null;
}
// a pad that walks toward a cell's standing spot
function steer(c) {
  const tx = (c & 15) << 4, ty = PLAY_Y + ((c >> 4) << 4);
  let pad = 0;
  // (exactly: a pixel off and your feet catch the next row's chest or pit)
  if (G.px < tx) pad |= PADS.right; else if (G.px > tx) pad |= PADS.left;
  if (G.py < ty) pad |= PADS.down; else if (G.py > ty) pad |= PADS.up;
  return pad;
}
const near = c => { const tx = (c & 15) << 4, ty = PLAY_Y + ((c >> 4) << 4); return Math.abs(G.px - tx) <= 1 && Math.abs(G.py - ty) <= 1; };
const room = () => G.dg.rooms[G.dg_room];
// which room to head for next (by the doors you could get through now), and through which door
function plan() {
  const d = G.dg, N = d.rooms.length;
  const want = r => {
    const f = G.dg_flags[r.id];
    if (r.content && !(f & 4)) return true;
    if (r.kind === DG.R_BOOMSW && (G.dg_items & DG.I_BOOMERANG) && r.doors.some((e, k) => e && e.kind === DG.E_BOOM && !(f & (16 << k)))) return true;
    if (r.kind === DG.R_BOSS) return G.dg_big;
    return false;
  };
  const can = (r, k) => {
    const e = r.doors[k]; if (!e) return false;
    const f = G.dg_flags[r.id];
    if (e.kind === DG.E_OPEN || (f & (16 << k))) return true;
    if (e.kind === DG.E_KEY) return G.dg_keys > 0;
    if (e.kind === DG.E_BOMB) return (G.dg_items & DG.I_BOMBS) && G.dg_bombs > 0;
    if (e.kind === DG.E_BOSS) return G.dg_big;
    return false;
  };
  const prev = new Int16Array(N).fill(-2), via = new Int8Array(N); prev[G.dg_room] = -1;
  const q = [G.dg_room];
  while (q.length) {
    const id = q.shift(), r = d.rooms[id];
    if (id !== G.dg_room && want(r)) { let c = id; while (prev[c] !== G.dg_room) c = prev[c]; return { target: id, door: via[c] }; }
    for (let k = 0; k < 4; k++) if (can(r, k)) { const to = r.doors[k].to; if (prev[to] === -2) { prev[to] = id; via[to] = k; q.push(to); } }
  }
  return null;
}
function face(dir) { S.faceDir(dir); }
export function playDungeon(seedText, cls = 0, maxFrames = 60 * 60 * 30) {
  S.new_hero(cls);
  S.dg_start(seedText);
  let frames = 0, last = -1, sameRoom = 0;
  const log = [];
  while (frames < maxFrames) {
    frames++;
    G.ev.length = 0;
    G.hp = G.maxhp;
    if (G.dg_no > 1) return { ok: true, frames, log };
    if (G.state !== 'play') return { ok: false, frames, why: 'state ' + G.state, log };
    if (G.dg_room !== last) { last = G.dg_room; sameRoom = 0; log.push(G.dg_room); } else if (++sameRoom > 60 * 90) return { ok: false, frames, why: 'stuck in room ' + G.dg_room + ' kind ' + room().kind, log };
    let pad = 0, padNew = 0;
    const r = room(), f = G.dg_flags[G.dg_room];
    // 1. fight: the keeper, or anything here (the barred doors need it; it's quicker anyway)
    const foes = [];
    for (let n = 0; n < D.MAXM; n++) if (G.m_type[n] && !S.faded(n)) foes.push([G.m_x[n], G.m_y[n]]);
    if (G.boss_on) foes.unshift([G.bx + 8, G.by + 12]);
    if (foes.length) {
      const [mx, my] = foes.sort((a, b) => Math.hypot(a[0] - G.px, a[1] - G.py) - Math.hypot(b[0] - G.px, b[1] - G.py))[0];
      const dx = mx - G.px, dy = my - G.py, dist = Math.abs(dx) + Math.abs(dy);
      if (G.boss_on && (G.dg_items & DG.I_BOOMERANG) && G.bstate !== D.BS_STUN && !G.bm_t && dist < 120 && (Math.abs(dy) < 10 || Math.abs(dx) < 10)) {
        G.dg_item = DG.I_BOOMERANG; face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? D.DIR_RIGHT : D.DIR_LEFT) : (dy > 0 ? D.DIR_DOWN : D.DIR_UP)); padNew |= S.PAD_X;
      } else if (!G.boss_on && dist < 9) {
        // right on top of it: the swing goes over its head; step back first
        // (toward the middle of the room if a wall is behind you)
        const ax = dx >= 0 ? -1 : 1, ay = dy >= 0 ? -1 : 1;
        const bx = S.blocked(G.px + ax * 2, G.py) ? (G.px < 112 ? 1 : -1) : ax, by = S.blocked(G.px, G.py + ay * 2) ? (G.py < PLAY_Y + 80 ? 1 : -1) : ay;
        pad |= bx > 0 ? PADS.right : PADS.left; pad |= by > 0 ? PADS.down : PADS.up;
        // (pinned in a corner: roll or blink out toward the middle, as a player would)
        if (G.pet_type === 0 && (frames & 63) === 0) padNew |= S.PAD_A;
      } else if (dist < (G.boss_on ? 30 : 20)) {
        face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? D.DIR_RIGHT : D.DIR_LEFT) : (dy > 0 ? D.DIR_DOWN : D.DIR_UP));
        if (!G.atk_timer && !G.swing_cd) padNew |= S.PAD_B;
      } else {
        const [cx, cy] = cellOf(mx, my), p = path([(cy << 4) | cx]);
        if (p && p.length > 1) pad = steer(p[1]); else { if (dx > 2) pad |= PADS.right; else if (dx < -2) pad |= PADS.left; if (dy > 2) pad |= PADS.down; else if (dy < -2) pad |= PADS.up; }
      }
      S.tick(pad, padNew); continue;
    }
    // 2. what this room asks: its chest, its block, its crystal
    let goal = null, act = null;
    const objs = [...Array(G.nobj).keys()];
    const chest = objs.find(k => G.ob_t[k] === D.OBJ_CHEST || G.ob_t[k] === D.OBJ_BIGCHEST);
    const block = objs.find(k => G.ob_t[k] === D.OBJ_BLOCK), plate = objs.find(k => G.ob_t[k] === D.OBJ_PLATE);
    const crystal = objs.find(k => G.ob_t[k] === D.OBJ_CRYSTAL);
    if (chest !== undefined) { const c = G.ob_k[chest]; goal = [c + 16, c - 16, c + 1, c - 1].filter(walkable); }
    else if (block !== undefined && plate !== undefined) {
      const bc = G.ob_k[block], pc = G.ob_k[plate], dir = (pc & 15) > (bc & 15) ? 1 : -1;
      const stand = bc - dir;
      // lined up on the block's row, on its near side: lean on it
      goal = [stand]; act = () => { const ty = PLAY_Y + ((bc >> 4) << 4), bx = (bc & 15) << 4; if (G.py === ty && (dir > 0 ? G.px < bx && G.px >= bx - 20 : G.px > bx && G.px <= bx + 20)) { pad = dir > 0 ? PADS.right : PADS.left; return true; } return false; };
    } else if (crystal !== undefined && (G.dg_items & DG.I_BOOMERANG)) {
      const c = G.ob_k[crystal], cx = c & 15, cy = c >> 4;
      const spots = [];
      for (const [dx, dy, dir] of [[1, 0, D.DIR_LEFT], [-1, 0, D.DIR_RIGHT], [0, 1, D.DIR_UP], [0, -1, D.DIR_DOWN]])
        for (let k = 2; k <= 5; k++) { const x = cx + dx * k, y = cy + dy * k; if (x > 0 && x < 15 && y > 0 && y < 10 && walkable((y << 4) | x)) spots.push([(y << 4) | x, dir]); }
      goal = spots.map(s => s[0]);
      act = () => { const s = spots.find(s => near(s[0])); if (s && !G.bm_t) { face(s[1]); G.dg_item = DG.I_BOOMERANG; padNew |= S.PAD_X; return true; } return false; };
    }
    // the keeper beaten: down the stairs
    if (!goal && room().kind === DG.R_BOSS && !G.boss_on && G.door_open) {
      const c = G.door_pos, inside = c < 16 ? c + 16 : c - 16, dirPad = c < 16 ? PADS.up : PADS.down;
      goal = [inside]; act = () => { if (Math.abs(G.px - ((inside & 15) << 4)) <= 3 && Math.abs(G.py - (PLAY_Y + ((inside >> 4) << 4))) <= 20) { pad = dirPad; return true; } return false; };
    }
    // 3. otherwise the next door on the way
    if (!goal) {
      const pl = plan();
      if (!pl) return { ok: false, frames, why: 'no plan in room ' + G.dg_room, log };
      const k = pl.door, dc = DOOR_C[k], dk = G.dg_dk[k];
      const inside = [dc + 16, dc - 1, dc - 16, dc + 1][k], dirPad = [PADS.up, PADS.right, PADS.down, PADS.left][k];
      if (dk === D.DK_CRACK) {
        goal = [inside];
        act = () => { if (near(inside) && !G.bb_t.some(Boolean)) { face([D.DIR_UP, D.DIR_RIGHT, D.DIR_DOWN, D.DIR_LEFT][k]); G.dg_item = DG.I_BOMBS; padNew |= S.PAD_X; G.bot_bomb = 140; return true; } return false; };
        if (G.bot_bomb > 0) { G.bot_bomb--; const away = [inside + 48, inside - 3, inside - 48, inside + 3][k]; const p = path([away]); pad = p && p.length > 1 ? steer(p[1]) : 0; S.tick(pad, 0); continue; }
      } else {
        goal = [inside];
        // lined up with the door and close: keep walking through it
        const lined = () => { const tx = (inside & 15) << 4, ty = PLAY_Y + ((inside >> 4) << 4); return k & 1 ? Math.abs(G.py - ty) <= 3 && Math.abs(G.px - tx) <= 20 : Math.abs(G.px - tx) <= 3 && Math.abs(G.py - ty) <= 20; };
        act = () => { if (lined()) { pad = dirPad; return true; } return false; };
      }
    }
    if (act && act()) { S.tick(pad, padNew); continue; }
    const p = path(goal);
    if (p && p.length > 1) pad = steer(p[1]);
    else if (p && p.length === 1) pad = steer(p[0]);
    S.tick(pad, padNew);
  }
  return { ok: false, frames, why: 'out of time', log };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 50), first = +(process.argv[3] || 1);
  let bad = 0, tot = 0;
  const t0 = Date.now();
  for (let i = first; i < first + n; i++) {
    const seed = 'S' + i;
    const r = playDungeon(seed, i % 3);
    tot += r.frames;
    if (!r.ok) {
      bad++; console.log('FAIL', seed, 'class', i % 3, r.why, 'rooms', r.log.join('>').slice(-80));
      if (process.env.DEBUG) {
        const hx = (G.px + 8) >> 4, hy = (G.py + 11 - PLAY_Y) >> 4;
        for (let y = 0; y < 11; y++) { let s = ''; for (let x = 0; x < 16; x++) { const c = (y << 4) | x; s += x === hx && y === hy ? '@' : '.#PDS,=^ ~O%'[G.map[c]] || '?'; } console.log('   ' + s); }
        for (let n = 0; n < D.MAXM; n++) if (G.m_type[n]) console.log('   mon', D.MON_NAME[G.m_type[n]], G.m_x[n], G.m_y[n], 'hp', G.m_hp[n], 'frz', G.m_frz[n], 'kb', G.m_kb[n], 'hero', G.px, G.py);
      }
    }
  }
  console.log(`${n} dungeons played: ${n - bad} beaten, ${bad} not; avg ${(tot / n / 3600).toFixed(1)} min of play each (${Date.now() - t0} ms)`);
  process.exit(bad ? 1 : 0);
}
