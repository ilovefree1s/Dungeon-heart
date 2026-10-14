// ============================================================================
//  DUNGEON HEART  -  seeded dungeons, after the SNES Zelda games (all our own rooms, items and names):
//  every one of the tower's 50 floors is a dungeon of screens on a grid, made from the run's seed.
//  The way through each is a chain of zones, each shut off from the last by a gate (a locked door, a
//  cracked wall for bombs, a shutter whose switch only the boomerang reaches, pegs only the hammer
//  pounds down, a chasm only the grapple chain crosses, a sealed door whose braziers only the fire
//  wand lights, the keeper's door). You find one item every ten floors (bombs on floor 1, then on
//  10, 20, 30 and 40) and every floor after that has gates that need it. Whatever opens a gate always
//  lies before it, so every floor can be beaten; checkDungeon() plays it through to make sure.
//  Plain data only (no drawing, no game state): sim.js builds each screen from it.
// ============================================================================

export const GW = 11, GH = 11;                     // the grid the rooms sit on
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]; // N E S W
export const OPP = [2, 3, 0, 1];
// door kinds
export const E_OPEN = 1, E_KEY = 2, E_BOMB = 3, E_BOOM = 4, E_BOSS = 5, E_HOOK = 6, E_PEG = 7, E_FIRE = 8;
// room kinds
export const R_START = 1, R_PLAIN = 2, R_FIGHT = 3, R_BLOCK = 4, R_SPIKES = 5, R_TREASURE = 6, R_CHEST = 7,
  R_BIG = 8, R_BOOMSW = 9, R_PREBOSS = 10, R_BOSS = 11, R_HIDDEN = 12, R_CHASM = 13, R_TORCH = 14;
export const ROOM_KIND_NAME = ['', 'ENTRANCE', 'HALL', 'GUARD ROOM', 'BLOCK PUZZLE', 'SPIKE HALL', 'TREASURE ROOM', 'VAULT',
  'GREAT VAULT', 'SWITCH ROOM', 'ANTECHAMBER', 'THE KEEPER', 'SECRET ROOM', 'CHASM', 'BRAZIER HALL'];
// what a room holds (in a chest, or appearing when its guards fall)
export const C_KEY = 1, C_BIGKEY = 2, C_BOMBS = 3, C_BOOMERANG = 4, C_MAP = 5, C_GOLD = 6, C_GEAR = 7, C_HOOK = 8, C_HAMMER = 9, C_FIRE = 10;
export const CONTENT_NAME = ['', 'SMALL KEY', 'BIG KEY', 'BLAST BOMBS', 'RETURN BLADE', 'DUNGEON MAP', 'GOLD', 'GEAR', 'GRAPPLE CHAIN', 'IRON HAMMER', 'EMBER WAND'];
// the items (bits of what you carry)
export const I_BOMBS = 1, I_BOOMERANG = 2, I_HOOK = 4, I_HAMMER = 8, I_FIRE = 16;
export const ITEMS = [I_BOMBS, I_BOOMERANG, I_HAMMER, I_HOOK, I_FIRE];
const NEEDS = { [E_BOMB]: I_BOMBS, [E_BOOM]: I_BOOMERANG, [E_HOOK]: I_HOOK, [E_PEG]: I_HAMMER, [E_FIRE]: I_FIRE };
const GATE_OF = { [I_BOMBS]: E_BOMB, [I_BOOMERANG]: E_BOOM, [I_HOOK]: E_HOOK, [I_HAMMER]: E_PEG, [I_FIRE]: E_FIRE };
export const ITEM_OF = { [C_BOMBS]: I_BOMBS, [C_BOOMERANG]: I_BOOMERANG, [C_HOOK]: I_HOOK, [C_HAMMER]: I_HAMMER, [C_FIRE]: I_FIRE };
// where each item is found: [floor, item, its chest's content]
export const ITEM_FLOOR = [[1, I_BOMBS, C_BOMBS], [10, I_BOOMERANG, C_BOOMERANG], [20, I_HAMMER, C_HAMMER], [30, I_HOOK, C_HOOK], [40, I_FIRE, C_FIRE]];
export const itemsBefore = f => ITEM_FLOOR.reduce((a, [ff, i]) => (ff < f ? a | i : a), 0);
export const foundOn = f => { const e = ITEM_FLOOR.find(([ff]) => ff === f); return e ? e[2] : 0; };
// rooms per floor: 10 on floors 1-10, then two more every ten floors, 20 on the last ten
export const roomsFor = f => (f <= 10 ? 10 : f <= 20 ? 12 : f <= 30 ? 14 : f <= 40 ? 16 : 20);
// a great vault's treasure (the big chest): the items and the big key
export const isGreat = c => !!ITEM_OF[c] || c === C_BIGKEY;
// the layout's version: saves from an older generator start their floor afresh
export const GEN = 3;

// a small fast generator of its own (the dungeon's shape must not depend on the game's other dice)
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// seeds people type: words or numbers both work
export function seedFrom(text) {
  const s = String(text).trim().toUpperCase();
  if (/^\d+$/.test(s)) return Number(s) >>> 0;
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const SEED_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomSeedText(rand = Math.random) { let s = ''; for (let i = 0; i < 6; i++) s += SEED_ABC[Math.floor(rand() * SEED_ABC.length)]; return s; }

export function generateDungeon(seed, floor = 1) {
  const rand = mulberry(seed);
  const o = { rooms: roomsFor(floor), have: itemsBefore(floor), find: foundOn(floor) };
  for (let attempt = 0; attempt < 400; attempt++) {
    const d = build(rand, seed, o);
    if (d && checkDungeon(d).ok) { d.floor = floor; return d; }
  }
  throw new Error('no dungeon for seed ' + seed + ' floor ' + floor);
}

function build(rand, seed, o) {
  const ri = n => Math.floor(rand() * n);
  const pick = a => a[ri(a.length)];
  const rooms = [], at = new Map();
  const key = (x, y) => x + ',' + y;
  const add = (x, y, zone, kind = 0) => {
    const r = { id: rooms.length, x, y, zone, kind, doors: [null, null, null, null], content: 0, seed: 0 };
    rooms.push(r); at.set(key(x, y), r); return r;
  };
  const free = (r, d) => { const x = r.x + DX[d], y = r.y + DY[d]; return x >= 0 && y >= 0 && x < GW && y < GH && !at.has(key(x, y)); };
  const link = (a, d, b, kind) => { a.doors[d] = { kind, to: b.id }; b.doors[OPP[d]] = { kind, to: a.id }; };
  // grow a new room off one of `from`, through a door of `kind`; prefers going up (the boss is at the top)
  const grow = (from, zone, kind, roomKind = 0, upBias = 0.35) => {
    const opts = [];
    for (const r of from) for (let d = 0; d < 4; d++) if (free(r, d)) opts.push([r, d]);
    if (!opts.length) return null;
    let o = opts[ri(opts.length)];
    if (rand() < upBias) { const up = opts.filter(([, d]) => d === 0); if (up.length) o = up[ri(up.length)]; }
    const [r, d] = o, n = add(r.x + DX[d], r.y + DY[d], zone, roomKind);
    link(r, d, n, kind);
    return n;
  };

  // the plan: zones chained by gates; a small key or this floor's new item lies in the zone before
  // the gate it opens (the gates of items you already carry need nothing placed); the big key last
  const T = o.rooms;
  const nG = T <= 10 ? 2 : T <= 14 ? 3 : 4;
  const owned = ITEMS.filter(i => o.have & i);
  const list = [];
  for (let i = owned.length; i > 0; i--) { const j = ri(i); [owned[i - 1], owned[j]] = [owned[j], owned[i - 1]]; } // (shuffled)
  const nOwned = Math.min(owned.length, nG - 1 - (o.find ? 1 : 0));
  for (let i = 0; i < nOwned; i++) list.push(GATE_OF[owned[i]]);
  while (list.length < nG - (o.find ? 1 : 0)) list.push(E_KEY);
  for (let i = list.length; i > 0; i--) { const j = ri(i); [list[i - 1], list[j]] = [list[j], list[i - 1]]; }
  // (the new item's gate comes after at least one other)
  if (o.find) list.splice(1 + ri(list.length), 0, GATE_OF[ITEM_OF[o.find]]);
  const gates = list;
  const holds = gates.map(e => (e === E_KEY ? C_KEY : (o.find && e === GATE_OF[ITEM_OF[o.find]]) ? o.find : 0)).concat([C_BIGKEY]);
  const NZ = holds.length;
  const bombsAt = (o.have & I_BOMBS) ? 0 : holds.indexOf(C_BOMBS); // (the first zone with bombs in hand)
  const big = T >= 16 ? 1 : 0;
  const sizes = holds.map(() => 1 + ri(2) + big);
  const SWITCH = { [E_BOOM]: R_BOOMSW, [E_HOOK]: R_CHASM, [E_FIRE]: R_TORCH };
  const start = add(GW >> 1, GH - 1, 0, R_START);
  const zones = [[start]];
  for (let z = 0; z < NZ; z++) {
    if (z > 0) {
      // the gate: from a room of the last zone (a switch, a chasm or braziers need a room of their own)
      const ge = gates[z - 1];
      let src = zones[z - 1].filter(r => r.kind !== R_START && !SWITCH_KIND.has(r.kind) && !r.gateOut);
      if (!SWITCH[ge]) src = src.concat(zones[z - 1].filter(r => r.kind === R_START));
      const n = grow(src.length ? src : zones[z - 1], z, ge);
      if (!n) return null;
      const g = rooms[n.doors.find(e => e).to]; // (the room the gate leads out of)
      g.gateOut = true;
      if (SWITCH[ge]) { if (g.kind === R_START || g.content) return null; g.kind = SWITCH[ge]; }
      zones.push([n]);
    }
    const zr = zones[z];
    while (zr.length < sizes[z] + (z === 0 ? 1 : 0)) { const n = grow(zr, z, E_OPEN); if (!n) return null; zr.push(n); }
  }
  // the keeper's room off the last zone, with an antechamber before it when there's room
  const last = zones[NZ - 1];
  let pre = last.find(r => r.kind === 0 && !r.gateOut) || null;
  const boss = grow(pre ? [pre] : last, NZ, E_BOSS, R_BOSS, 0.9);
  if (!boss) return null;
  const bossFrom = rooms[boss.doors.find(e => e).to];
  if (bossFrom.kind === 0) bossFrom.kind = R_PREBOSS;

  // what each zone holds, in a room of that zone that isn't the entrance or a switch room
  const special = r => r.kind === R_START || SWITCH_KIND.has(r.kind);
  for (let z = 0; z < NZ; z++) {
    if (!holds[z]) continue;
    const spots = zones[z].filter(r => !special(r) && r.kind !== R_PREBOSS && !r.content);
    const r = spots.length ? pick(spots) : null;
    if (!r) return null;
    r.content = holds[z];
    r.kind = isGreat(holds[z]) && holds[z] !== C_BIGKEY ? R_BIG : (holds[z] === C_KEY && rand() < 0.5 ? R_FIGHT : R_CHEST);
  }
  // extras up to the floor's size: secret rooms behind cracked walls (once you have bombs), treasure
  // rooms, and just more dungeon (halls, guard rooms, puzzles)
  let guard = 0;
  while (rooms.length < T && guard++ < 80) {
    const z = ri(NZ);
    const roll = rand(), secret = roll < 0.3 && bombsAt >= 0 && z >= bombsAt, plain = !secret && roll >= 0.55;
    const n = grow(zones[z], z, secret ? E_BOMB : E_OPEN, secret ? R_HIDDEN : plain ? 0 : R_TREASURE, 0);
    if (!n) continue;
    if (plain) { zones[z].push(n); continue; }
    n.content = rand() < 0.5 ? C_GEAR : C_GOLD;
    n.optional = true;
    if (!secret) zones[z].push(n);
  }
  if (rooms.length !== T) return null;
  // the map, early on (when there's a free room for it)
  {
    const spots = zones[0].concat(zones[1] || []).filter(r => !r.content && !special(r) && r.kind !== R_PREBOSS && !r.optional);
    if (spots.length) { const r = pick(spots); r.content = C_MAP; r.kind = R_CHEST; }
  }
  for (const zr of zones) for (const a of zr) for (let d = 0; d < 4; d++) {
    if (a.doors[d]) continue;
    const b = at.get(key(a.x + DX[d], a.y + DY[d]));
    if (b && b.zone === a.zone && !b.optional && !a.optional && b.kind !== R_BOSS && rand() < 0.3) link(a, d, b, E_OPEN);
  }
  // everything else: halls, guard rooms (the doors bar until they fall), block puzzles, spike halls
  for (const r of rooms) {
    if (!r.kind) r.kind = pick([R_PLAIN, R_FIGHT, R_FIGHT, R_BLOCK, R_SPIKES]);
    r.seed = (seed ^ Math.imul(r.id + 1, 0x9E3779B1)) >>> 0;
  }
  return { seed, rooms, start: start.id, boss: boss.id, w: GW, h: GH, have: o.have };
}
const SWITCH_KIND = new Set([R_BOOMSW, R_CHASM, R_TORCH]);

// play it through: from the entrance, take everything reachable, open what can be opened, and try
// every order of spending small keys; it's beatable if every order reaches the keeper with the big key
export function checkDungeon(d) {
  const N = d.rooms.length;
  const memo = new Map();
  const reach = (opened, items, bigkey) => {
    const seen = new Uint8Array(N), q = [d.start]; seen[d.start] = 1;
    while (q.length) {
      const r = d.rooms[q.shift()];
      for (let k = 0; k < 4; k++) {
        const e = r.doors[k]; if (!e || seen[e.to]) continue;
        let ok = false;
        if (e.kind === E_OPEN) ok = true;
        else if (e.kind === E_KEY) ok = opened.has(Math.min(r.id, e.to) + ':' + Math.max(r.id, e.to));
        else if (e.kind === E_BOSS) ok = bigkey;
        else ok = !!(items & NEEDS[e.kind]) && (e.kind !== E_BOOM || r.kind === R_BOOMSW || d.rooms[e.to].kind === R_BOOMSW);
        if (ok) { seen[e.to] = 1; q.push(e.to); }
      }
    }
    return seen;
  };
  let allRooms = new Uint8Array(N);
  const play = (opened) => {
    const id = [...opened].sort().join('|');
    if (memo.has(id)) return memo.get(id);
    // collect until nothing new (items open more of the map)
    let items = d.have || 0, big = false, keys = 0, seen;
    for (;;) {
      seen = reach(opened, items, big);
      let ni = d.have || 0, nb = false, nk = 0;
      for (let i = 0; i < N; i++) if (seen[i]) {
        const c = d.rooms[i].content;
        if (ITEM_OF[c]) ni |= ITEM_OF[c]; else if (c === C_BIGKEY) nb = true; else if (c === C_KEY) nk++;
      }
      keys = nk;
      if (ni === items && nb === big) break;
      items = ni; big = nb;
    }
    for (let i = 0; i < N; i++) if (seen[i]) allRooms[i] = 1;
    let res;
    if (seen[d.boss]) res = true;
    else {
      const free = keys - opened.size;
      const locks = [];
      if (free > 0) for (let i = 0; i < N; i++) if (seen[i]) d.rooms[i].doors.forEach(e => { if (e && e.kind === E_KEY && !seen[e.to]) locks.push(Math.min(i, e.to) + ':' + Math.max(i, e.to)); });
      // stuck (no key, or no lock to spend it on) = a dead end; every choice must win
      res = locks.length > 0 && locks.every(l => play(new Set([...opened, l])));
    }
    memo.set(id, res);
    return res;
  };
  const ok = play(new Set());
  return { ok, rooms: N, everyRoom: allRooms.every(v => v) };
}
