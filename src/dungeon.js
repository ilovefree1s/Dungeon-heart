// ============================================================================
//  DUNGEON HEART  -  seeded dungeons, after the SNES Zelda games (all our own rooms, items and names):
//  a seed makes a grid of 12-20 screens. The way through is a chain of zones, each shut off from
//  the last by a gate (a locked door, a cracked wall for bombs, a shutter whose switch only the
//  boomerang can reach, a chasm only the grapple chain crosses, the boss door), and whatever opens a gate always lies in the zones before
//  it, so every seed can be beaten. checkDungeon() plays it through to make sure.
//  Plain data only (no drawing, no game state): sim.js builds each screen from it.
// ============================================================================

export const GW = 11, GH = 11;                       // the grid the rooms sit on
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]; // N E S W
export const OPP = [2, 3, 0, 1];
// door kinds
export const E_OPEN = 1, E_KEY = 2, E_BOMB = 3, E_BOOM = 4, E_BOSS = 5, E_HOOK = 6;
// room kinds
export const R_START = 1, R_PLAIN = 2, R_FIGHT = 3, R_BLOCK = 4, R_SPIKES = 5, R_TREASURE = 6, R_CHEST = 7,
  R_BIG = 8, R_BOOMSW = 9, R_PREBOSS = 10, R_BOSS = 11, R_HIDDEN = 12, R_CHASM = 13;
export const ROOM_KIND_NAME = ['', 'ENTRANCE', 'HALL', 'GUARD ROOM', 'BLOCK PUZZLE', 'SPIKE HALL', 'TREASURE ROOM', 'VAULT',
  'GREAT VAULT', 'SWITCH ROOM', 'ANTECHAMBER', 'THE KEEPER', 'SECRET ROOM', 'CHASM'];
// what a room holds (in a chest, or appearing when its guards fall)
export const C_KEY = 1, C_BIGKEY = 2, C_BOMBS = 3, C_BOOMERANG = 4, C_MAP = 5, C_GOLD = 6, C_GEAR = 7, C_HOOK = 8;
export const CONTENT_NAME = ['', 'SMALL KEY', 'BIG KEY', 'BLAST BOMBS', 'RETURN BLADE', 'DUNGEON MAP', 'GOLD', 'GEAR', 'GRAPPLE CHAIN'];
// items a gate can need
export const I_BOMBS = 1, I_BOOMERANG = 2, I_HOOK = 4;
const NEEDS = { [E_BOMB]: I_BOMBS, [E_BOOM]: I_BOOMERANG, [E_HOOK]: I_HOOK };
const ITEM_OF = { [C_BOMBS]: I_BOMBS, [C_BOOMERANG]: I_BOOMERANG, [C_HOOK]: I_HOOK };
// a great vault's treasure (the big chest)
export const isGreat = c => c === C_BOOMERANG || c === C_HOOK || c === C_BIGKEY;
// the layout's version: saves from an older generator start their dungeon afresh
export const GEN = 2;

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

export function generateDungeon(seed) {
  const rand = mulberry(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const d = build(rand, seed);
    if (d && checkDungeon(d).ok) return d;
  }
  throw new Error('no dungeon for seed ' + seed);
}

function build(rand, seed) {
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

  // the plan: seven zones, chained by gates; each gate's key or item lies in the zone before it
  //   zone 0 (with the small key)  -KEY->  zone 1 (bombs)  -BOMB->  zone 2 (a small key)  -KEY->
  //   zone 3 (the boomerang, in a great vault)  -BOOM->  zone 4 (a small key)  -KEY->
  //   zone 5 (the grapple chain, in a great vault)  -CHASM->  zone 6 (the big key)  -BOSS->  the keeper
  const gates = [E_KEY, E_BOMB, E_KEY, E_BOOM, E_KEY, E_HOOK];
  const holds = [C_KEY, C_BOMBS, C_KEY, C_BOOMERANG, C_KEY, C_HOOK, C_BIGKEY];
  const NZ = holds.length;
  const sizes = holds.map((_, z) => (z === 2 || z === 4 ? 1 : 2) + ri(2));
  const start = add(GW >> 1, GH - 1, 0, R_START);
  const zones = [[start]];
  for (let z = 0; z < NZ; z++) {
    if (z > 0) {
      // the gate: from a room of the last zone (the boomerang's switch needs a room of its own)
      let src = zones[z - 1].filter(r => r.kind !== R_START && r.kind !== R_BOOMSW && !r.gateOut);
      if (gates[z - 1] === E_KEY) src = src.concat(zones[z - 1].filter(r => r.kind === R_START));
      const n = grow(src.length ? src : zones[z - 1], z, gates[z - 1]);
      if (!n) return null;
      const g = rooms[n.doors.find(e => e).to]; // (the room the gate leads out of)
      g.gateOut = true;
      if (gates[z - 1] === E_BOOM || gates[z - 1] === E_HOOK) { if (g.kind === R_START) return null; g.kind = gates[z - 1] === E_BOOM ? R_BOOMSW : R_CHASM; }
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
  const special = r => r.kind === R_START || r.kind === R_BOOMSW || r.kind === R_CHASM;
  for (let z = 0; z < NZ; z++) {
    const spots = zones[z].filter(r => !special(r) && r.kind !== R_PREBOSS && !r.content);
    const r = spots.length ? pick(spots) : null;
    if (!r) return null;
    r.content = holds[z];
    r.kind = holds[z] === C_BOOMERANG || holds[z] === C_HOOK ? R_BIG : (holds[z] === C_KEY && rand() < 0.5 ? R_FIGHT : R_CHEST);
  }
  // the map, early on
  {
    const spots = zones[0].concat(zones[1]).filter(r => !r.content && !special(r));
    if (spots.length) { const r = pick(spots); r.content = C_MAP; r.kind = R_CHEST; }
  }
  // extras: secret rooms behind cracked walls (bombs), treasure rooms, loops inside a zone
  const total = () => rooms.length;
  const want = 20 + ri(9);
  let guard = 0;
  while (total() < want && guard++ < 60) {
    const z = 1 + ri(NZ - 1); // (not zone 0: the bombs come in zone 1)
    // (a secret room, a treasure room, or just more dungeon: halls, guard rooms, puzzles)
    const roll = rand(), secret = roll < 0.35, plain = roll >= 0.65;
    const n = grow(zones[z], z, secret ? E_BOMB : E_OPEN, secret ? R_HIDDEN : plain ? 0 : R_TREASURE, 0);
    if (!n) continue;
    if (plain) { zones[z].push(n); continue; }
    n.content = rand() < 0.5 ? C_GEAR : C_GOLD;
    n.optional = true;
    if (!secret) zones[z].push(n);
  }
  if (total() < 20 || total() > 28) return null;
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
  return { seed, rooms, start: start.id, boss: boss.id, w: GW, h: GH };
}

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
    let items = 0, big = false, keys = 0, seen;
    for (;;) {
      seen = reach(opened, items, big);
      let ni = 0, nb = false, nk = 0;
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
