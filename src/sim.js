// ============================================================================
//  DUNGEON HEART  -  sim: the game's rules, ported from the SNES game
//  (ilovefree1s/dungeon-loot, snes/src/game.c + fast.inc) step for step.
//  It runs at 60 steps a second in the SNES's pixel space (a 16 x 11 map of
//  16-pixel cells, the play area from y = 32), so every number - speeds, hit
//  boxes, damage, loot - is the one the SNES game was tuned with. The 3D view
//  only draws this state. No DOM or three.js in here: node runs it for tests.
// ============================================================================
import * as D from './data.js';
const {
  MAP_W, MAP_H, PLAY_Y, MAXM, MAXI, MAXP, MAXB, MAXBN, MAXOBJ, BOSS_ROOM, LAST_FLOOR,
  T_FLOOR, T_WALL, T_PILLAR, T_DOOR, T_STAIRS, T_FLOOR2, T_DOORWAY, T_HAZARD, T_PIT, T_BRIDGE, T_OBJ, T_CRACK,
  TILE_SOLID, TILE_WALK, DIR_DOWN, DIR_UP, DIR_RIGHT, DIR_LEFT,
  M_NONE, M_SLIME, M_BAT, M_SKEL, M_SPIDER, M_GHOST, M_WIZARD, M_IMP, M_GOLEM, M_ARCHER, M_FIRESPRITE, M_VBAT,
  M_WISP, M_HELLCRAB, M_SLIMEKING, M_DEMON, M_WRAITH, M_INFERNO, NMON,
  FM_CALM, FM_FAST, FM_TOUGH, FM_FIERCE, FM_SWARM, FM_TREASURE,
  K_NONE, K_WEAPON, K_ARMOR, K_SHIELD, K_BOOTS, K_GLOVES, K_HELMET, K_TRINKET, K_POTION, K_GOLD, NGEAR, NGEAR_DROP,
  SP_NONE, SP_VAMPIRE, SP_CRIT, SP_QUICK, SP_REGEN, SP_THORNS, SP_BLOCK, BAG, RAR_RARE, RAR_EPIC, RAR_LEG, MAXPOT,
  RAR_LVL, KIND_LVL, FINE, FINE_SPD, LVL_MAX,
  HZ_NONE, HZ_SPIKES, HZ_THORNS, HZ_ICE, HZ_LAVA, HZ_BONES, HZ_SAND, HZ_CRYSTAL, HZ_DARK, HZ_BLOOD, HZ_STORM, HZ_PATCHES,
  SP_TREASURE, SP_SHRINE, SP_FOUNTAIN, SP_ARENA, SP_TRAP,
  OBJ_CHEST, OBJ_CHEST_OPEN, OBJ_SHRINE, OBJ_SHRINE_USED, OBJ_FOUNTAIN, OBJ_FOUNTAIN_DRY, OBJ_CRACK, OBJ_LAUNCHER,
  OBJ_ALCH_L, OBJ_ALCH_R, OBJ_GONE,
  EL_FRENZIED, EL_ARMORED, EL_SPLITTING, EL_VAMPIRIC, NTAL, TAL_MAX,
  BS_WALK, BS_WIND, BS_CHARGE, BS_STUN, BS_CAST, BS_LEAP, BF_WIZ, BF_RUN, BF_DRINK, BF_BRUTE, BF_TF,
  KING_WIZ_HP, KING_BRUTE_HP, ALCH_X, MV_CHARGE, MV_BURST, MV_SUMMON, MV_SLAM, MV_SPIRAL, MV_FAN, MV_LEAP, MV_BLINK,
  MV_WARD, BOSS_MOVES, DIR16_X, DIR16_Y, BDOOR_EASY, BDOOR_MED, BDOOR_HARD, DW_RIGHT, DW_TOP, DW_BOTTOM,
  PET_RATE, TAME_ZONE, COL_WHITE, COL_GOLD, COL_RED, WARDEN_MAX,
} = D;

export const PAD_A = 0x01, PAD_B = 0x02, PAD_SELECT = 0x04, PAD_START = 0x08, PAD_UP = 0x10, PAD_DOWN = 0x20,
  PAD_LEFT = 0x40, PAD_RIGHT = 0x80;

// ---------------------------------------------------------------- state
const u8 = n => new Uint8Array(n), u16 = n => new Uint16Array(n), i8 = n => new Int8Array(n);
export const G = {
  state: 'title',           // title / play / dead / rescue / win (menus are the UI's, over 'play')
  frame: 0, rng: 1,
  map: u8(MAP_W * MAP_H),
  // hero
  px: 16, py: PLAY_Y + 80, pdir: DIR_RIGHT, pdx: 1, pdy: 0, dacc: 0, pstep: 0, panim: 0, moving: 0,
  atk_timer: 0, inv_timer: 0, regen_timer: 0, hp: 20, maxhp: 20, lvl: 1, str: 2, xp: 0, xpnext: 12, gold: 0, kills: 0,
  floor_num: 1, deepest: 1, player_class: 0, potions: 1, sacc: 0, full_item: 0, last_stand_used: 0,
  roll_timer: 0, roll_cd: 0, roll_dx: 0, roll_dy: 0, slow_acc: 0,
  blink_cd: 0, cast_cd: 0, bolt_count: 0, anim_t: 0, shot_pend: 0,
  // gear: index kind - 1
  eq_val: u8(NGEAR), eq_rar: u8(NGEAR), eq_spec: u8(NGEAR), eq_tier: u8(NGEAR), eq_has: u8(NGEAR), eq_lvl: u8(NGEAR),
  b_kind: u8(BAG), b_rar: u8(BAG), b_tier: u8(BAG), b_val: u8(BAG), b_spec: u8(BAG), b_lvl: u8(BAG),
  // each item's stats: three [type, amount] pairs (ST_STR .. ST_DEF)
  b_st: u8(BAG * 6), eq_st: u8(NGEAR * 6), i_st: u8(MAXI * 6), sh_st: u8(4 * 6),
  tal: u8(NTAL), wt: u8(NTAL), mt: u8(NTAL), ht: u8(NTAL),
  // monsters
  m_type: u8(MAXM), m_x: u8(MAXM), m_y: u8(MAXM), m_atk: u8(MAXM), m_hp: u16(MAXM), m_mhp: u16(MAXM), m_xp: u8(MAXM),
  m_flash: u8(MAXM), m_kb: u8(MAXM), m_kdir: u8(MAXM), m_timer: u8(MAXM), m_dir: u8(MAXM), m_hit: u8(MAXM),
  m_wander: u8(MAXM), m_frz: u8(MAXM), m_slow: u8(MAXM), m_burn: u8(MAXM), m_risen: u8(MAXM), m_elite: u8(MAXM),
  any_elite: 0, elite_said: 0, mon_left: 0,
  // tower
  room_num: 1, theme: 0, fmod: 0, roster: u8(3), nroster: 1, door_open: 0, door_pos: 0, door_wall: 0,
  // projectiles (monsters' and bosses' shots)
  pr_x: u8(MAXP), pr_y: u8(MAXP), pr_t: u8(MAXP), pr_atk: u8(MAXP), pr_dx: i8(MAXP), pr_dy: i8(MAXP), pr_bnc: u8(MAXP), pr_src: u8(MAXP),
  // bolts and arrows
  bo_x: u8(MAXB), bo_y: u8(MAXB), bo_t: u8(MAXB), bo_dir: u8(MAXB), bo_pierce: u8(MAXB), bo_last: u8(MAXB), bo_big: u8(MAXB), bo_bnc: u8(MAXB), bo_dx: u8(MAXB), bo_dy: u8(MAXB),
  // floor items
  i_kind: u8(MAXI), i_x: u8(MAXI), i_y: u8(MAXI), i_rar: u8(MAXI), i_val: u8(MAXI), i_spec: u8(MAXI), i_tier: u8(MAXI), i_lvl: u8(MAXI),
  // hazards
  hz: HZ_NONE, hz_tiled: 0, hz_t: 0, hz_frame: 0, hz_atk: 0, hz_here: 0, hz_acc: 0, hz_tick: 0, hz_told: 0, ice_dx: 0, ice_dy: 0,
  bn_t: u8(MAXBN), bn_x: u8(MAXBN), bn_y: u8(MAXBN), bn_type: u8(MAXBN),
  st_phase: 0, st_t: 0, st_x: 0, st_y: 0, sw_on: 0, sw_x1: 0, sw_y1: 0, sw_x2: 0, sw_y2: 0,
  // special rooms
  sp_room: 0, sp_kind: 0, sp: 0, nobj: 0, ob_k: u8(MAXOBJ), ob_t: u8(MAXOBJ), arena_left: 0, mimic_chest: 0, mimic_n: 0,
  sp_told: 0, loot_min: 0, bless_atk: 0, bless_def: 0, bless_regen: 0,
  // the hunter's pet
  pet_type: 0, pet_x: 0, pet_y: 0, pet_down: 0, pet_cd: 0, pet_inv: 0, pet_regen: 0, pet_face: 0, pet_hp: 0,
  tame_n: 0, tame_pos: 0, tame_hits: 0, tame_laps: 0, tame_miss: 0,
  // boss
  boss_on: 0, bx: 0, by: 0, bstate: 0, btimer: 0, bflash: 0, bhit: 0, batk: 0, brole: 0, battacks: 0, boss_tier: 1,
  bmove: 0, blast: 255, bward: 0, bphase: 0, bintro: 0, bfx: 0, lx0: 0, ly0: 0, lx1: 0, ly1: 0, bspin: 0,
  bphase_hp: [0, 0], bform: BF_BRUTE, bhw: 0, bhh: 0, bdx: 0, bdy: 0, bhp: 0, bmaxhp: 0, boss_art: 0,
  // merchant
  vend_state: 0, vx: 0, vy: 0, vtimer: 0, vend_touch: 0,
  sh_kind: u8(4), sh_rar: u8(4), sh_val: u8(4), sh_spec: u8(4), sh_tier: u8(4), sh_sold: u8(4), sh_lvl: u8(4), sh_price: [0, 0, 0, 0],
  // rescue
  wx: 0, wy: 0, wface: 0, rescue_t: 0,
  // messages and events for the view / UI / sound
  msg: '', msg_color: COL_WHITE, msg_t: 0, msg_id: 0,
  ev: [],
  // scratch (generated gear)
  g_val: 0, g_spec: 0, g_lvl: 0, g_st: u8(6), hpgear: 0,
};
const g = G;

// ---------------------------------------------------------------- helpers
export function rnd() { // xorshift16, as the SNES game
  let s = g.rng;
  s ^= (s << 7) & 0xFFFF; s ^= s >> 9; s ^= (s << 8) & 0xFFFF;
  g.rng = s & 0xFFFF || 1;
  return (g.rng ^ (g.rng >> 8)) & 255;
}
export const DEPTH = () => (g.floor_num << 1) - 1;
const IS_WARRIOR = () => g.player_class === 0, IS_MAGE = () => g.player_class === 1, IS_HUNTER = () => g.player_class === 2;
const T = { // talent ranks by name (game.c's T_*, M_*, H_* macros)
  get MIGHT() { return g.tal[0]; }, get KEEN() { return g.tal[1]; },
  get BLOODLUST() { return g.wt[2]; }, get SLAYER() { return g.wt[3]; }, get EXECUTE() { return g.wt[4]; },
  get TOUGH() { return g.wt[5]; }, get IRON() { return g.wt[6]; }, get DEFLECT() { return g.wt[7]; },
  get WIND() { return g.wt[8]; }, get LASTSTAND() { return g.wt[9]; }, get FLEET() { return g.wt[10]; },
  get CHARGE() { return g.wt[11]; }, get RAGE() { return g.wt[12]; }, get BLOODBATH() { return g.wt[13]; }, get WHIRL() { return g.wt[14]; },
  get IGNITE() { return g.mt[2]; }, get FLAMEWAVE() { return g.mt[3]; }, get METEOR() { return g.mt[4]; },
  get ICEARMOR() { return g.mt[5]; }, get CHILL() { return g.mt[6]; }, get SHATTER() { return g.mt[7]; },
  get NOVA() { return g.mt[8]; }, get ICEBLOCK() { return g.mt[9]; }, get QCAST() { return g.mt[10]; },
  get QBLINK() { return g.mt[11]; }, get MIND() { return g.mt[12]; }, get ALCHEMY() { return g.mt[13]; }, get TWIN() { return g.mt[14]; },
  get PIERCE() { return g.ht[2]; }, get LONG() { return g.ht[3]; }, get MULTI() { return g.ht[4]; },
  get VITAL() { return g.ht[5]; }, get FERO() { return g.ht[6]; }, get MEND() { return g.ht[7]; },
  get KIN() { return g.ht[8]; }, get WRATH() { return g.ht[9]; }, get HFLEET() { return g.ht[10]; },
  get WHISPER() { return g.ht[11]; }, get TREASURE() { return g.ht[12]; }, get CAMO() { return g.ht[13]; }, get SCAV() { return g.ht[14]; },
};
export const TAL = T;
function sfx(n) { g.ev.push({ k: 'sfx', n }); }
function fx(k, o = {}) { o.k = k; g.ev.push(o); }
export function set_msg(text, color = COL_WHITE, t = 220) { g.msg = text; g.msg_color = color; g.msg_t = t; g.msg_id++; }
const abs = Math.abs;
const adiff = (a, b) => (a > b ? a - b : b - a);

// ---------------------------------------------------------------- map
function cell(x, y, table) {
  x &= 255; y &= 255;
  if (y < PLAY_Y) return 1;
  const r = (y - PLAY_Y) >> 4;
  if (r >= MAP_H) return 1;
  return table[g.map[(r << 4) | (x >> 4)]];
}
export const solid = (x, y) => cell(x, y, TILE_SOLID);
const wsolid = (x, y) => cell(x, y, TILE_WALK);
export function map_at(x, y) {
  x &= 255; y &= 255;
  if (y < PLAY_Y) return T_WALL;
  const r = (y - PLAY_Y) >> 4;
  if (r >= MAP_H) return T_WALL;
  return g.map[(r << 4) | (x >> 4)];
}
// a 16x16 actor at x, y: its lower body (x + 3 .. 12, y + 6 .. 15)
export function blocked(x, y) {
  return wsolid(x + 3, y + 6) || wsolid(x + 12, y + 6) || wsolid(x + 3, y + 15) || wsolid(x + 12, y + 15);
}
function blocked32(x, y) {
  return solid(x + 4, y + 10) || solid(x + 16, y + 10) || solid(x + 27, y + 10) || solid(x + 4, y + 31) || solid(x + 16, y + 31) || solid(x + 27, y + 31);
}

function place_hazards() {
  const dx = g.door_pos & 15, dy = g.door_pos >> 4;
  const n = HZ_PATCHES[g.hz] + (rnd() & 1);
  for (let k = 0; k < n; ++k) {
    let w = 1 + (rnd() & 1), h = 1 + (rnd() & 1);
    if (g.hz === HZ_ICE) { w += 2; h += 1; }
    const x = 2 + rnd() % (13 - w), y = 1 + rnd() % (10 - h);
    for (let ty = y; ty < y + h; ++ty) for (let tx = x; tx < x + w; ++tx) {
      if (tx <= 4 && ty >= 3 && ty <= 7) continue; // the way in
      if (adiff(tx, dx) <= 2 && adiff(ty, dy) <= 2) continue;
      const c = (ty << 4) + tx;
      if (g.map[c] !== T_FLOOR && g.map[c] !== T_FLOOR2) continue;
      g.map[c] = T_HAZARD;
    }
  }
}
function shape_set(x, y, t) {
  if (x < 2 || x > 13 || y < 2 || y > 8) return;
  if (x <= 4 && y >= 3 && y <= 7) return;
  g.map[(y << 4) + x] = t;
}
function shape_room(style) {
  let a, b, c, x, y, k;
  switch (style) {
    case 0:
      a = 6 + rnd() % 3;
      for (k = 0; k < 2; ++k) {
        b = 2 + rnd() % 6;
        for (y = 2; y <= 8; ++y) if (y !== b && y !== b + 1) shape_set(a, y, T_WALL);
        if (rnd() & 1) break;
        a += 3 + (rnd() & 1);
      }
      break;
    case 1:
      a = 3 + (rnd() & 1); b = a + 4;
      for (x = 5; x <= 12; ++x) { shape_set(x, a, T_WALL); shape_set(x, b, T_WALL); }
      c = 5 + rnd() % 7; shape_set(c, a, T_FLOOR); shape_set(c + 1, a, T_FLOOR);
      c = 5 + rnd() % 7; shape_set(c, b, T_FLOOR); shape_set(c + 1, b, T_FLOOR);
      break;
    case 2:
      k = rnd() & 3;
      if (k !== 1) for (y = 2; y <= 4; ++y) for (x = 9; x <= 13; ++x) shape_set(x, y, T_WALL);
      if (k !== 0) for (y = 6; y <= 8; ++y) for (x = 9; x <= 13; ++x) shape_set(x, y, T_WALL);
      if (k === 3) for (y = 2; y <= 3; ++y) for (x = 5; x <= 7; ++x) shape_set(x, y, T_WALL);
      break;
    case 3:
      a = 7 + rnd() % 3;
      for (y = 2; y <= 8; ++y) { shape_set(a, y, T_PIT); shape_set(a + 1, y, T_PIT); }
      b = 3 + rnd() % 5;
      shape_set(a, b, T_BRIDGE); shape_set(a + 1, b, T_BRIDGE);
      if (rnd() & 1) { c = b > 5 ? b - 3 : b + 3; shape_set(a, c, T_BRIDGE); shape_set(a + 1, c, T_BRIDGE); }
      break;
    default:
      b = 4 + rnd() % 3;
      for (x = 6; x <= 11; ++x) shape_set(x, b, T_PIT);
      shape_set(8 + (rnd() & 1), b, T_BRIDGE);
      for (k = 0; k < 3; ++k) {
        x = 6 + (rnd() % 4) * 2; y = b > 5 ? 2 + (rnd() & 1) : 7 + (rnd() & 1);
        shape_set(x, y, T_PIT);
        if (rnd() & 1) shape_set(x + 1, y, T_PIT);
      }
  }
}
function gen_layout() {
  for (let ty = 0; ty < MAP_H; ++ty) for (let tx = 0; tx < MAP_W; ++tx) {
    let t = T_FLOOR;
    if ((rnd() & 7) === 0) t = T_FLOOR2;
    if (tx === 0 || tx === MAP_W - 1 || ty === 0 || ty === MAP_H - 1) t = T_WALL;
    g.map[(ty << 4) + tx] = t;
  }
  g.door_wall = rnd() % 3;
  if (g.door_wall === DW_RIGHT) g.door_pos = ((2 + rnd() % 7) << 4) + (MAP_W - 1);
  else g.door_pos = (g.door_wall === DW_TOP ? 0 : (MAP_H - 1) << 4) + 4 + rnd() % 10;
  g.map[g.door_pos] = T_DOOR;
  g.door_open = 0;
  if (g.room_num === BOSS_ROOM) return;
  if (g.sp && g.sp !== SP_TRAP) { special_room(); return; }
  let s = rnd() % 10;
  if (s >= 5 && g.floor_num > 1) {
    shape_room(s - 5);
    if (g.hz < 10 && HZ_PATCHES[g.hz]) place_hazards();
    return;
  }
  s = s >= 5 ? s - 5 : s;
  for (let ty = 2; ty <= 8; ty += 2) for (let tx = 2; tx <= 12; tx += 2) {
    if (tx <= 4 && ty >= 4 && ty <= 6) continue;
    let p;
    switch (s) {
      // (fewer pillars than the SNES rooms: the 3D ones are bigger)
      case 0: p = rnd() < 28; break;
      case 1: p = (ty === 2 || ty === 8) && (tx & 2) === 2; break;
      case 2: p = (tx === 6 || tx === 10) && ty !== 4; break;
      case 3: p = ((tx + ty) & 7) === 0; break;
      default: p = tx >= 6 && tx <= 10 && ty >= 4 && ty <= 6;
    }
    if (p) g.map[(ty << 4) + tx] = T_PILLAR;
  }
  if (g.hz < 10 && HZ_PATCHES[g.hz]) place_hazards();
}
function gen_room() {
  g.nobj = 0;
  g.mimic_chest = 0;
  gen_layout();
  if (g.room_num === BOSS_ROOM) return;
  if (g.sp === SP_TRAP) trap_room();
  else if (!g.sp && g.room_num > 1 && rnd() < 51) secret_crack();
}

export function open_door() {
  g.map[g.door_pos] = T_DOORWAY;
  g.door_open = 1;
  sfx('door');
  fx('door');
  set_msg('ROOM CLEAR! THE DOOR IS OPEN');
  boss_doors_open();
}

// ---------------------------------------------------------------- monsters
export function set_monster(n, type, x, y) {
  const DP = DEPTH();
  g.m_type[n] = type; g.m_x[n] = x; g.m_y[n] = y;
  let v = (DP * DP) >> 1;
  if (v > 40) v = 40;
  v += D.MON_BASE_HP[type] + DP * 7 + g.room_num;
  v += v >> 3;
  if (type === M_GOLEM) v += v >> 1;
  if (g.fmod === FM_TOUGH) v += v >> 2;
  g.m_hp[n] = v; g.m_mhp[n] = v;
  v = D.MON_BASE_ATK[type] + DP + Math.floor(DP / 3) + Math.floor((DP * DP) / 200);
  if (g.fmod === FM_FIERCE) v += v >> 2;
  g.m_atk[n] = v > 250 ? 250 : v;
  g.m_xp[n] = D.MON_BASE_XP[type] + (DP >> 1);
  g.m_flash[n] = 0; g.m_kb[n] = 0; g.m_timer[n] = rnd(); g.m_dir[n] = 0; g.m_hit[n] = 0;
  g.m_wander[n] = 0; g.m_risen[n] = 0; g.m_elite[n] = 0; g.m_frz[n] = 0; g.m_slow[n] = 0; g.m_burn[n] = 0;
  fx('spawn', { n });
}
function spawn_monsters() {
  for (let i = 0; i < MAXM; ++i) g.m_type[i] = M_NONE;
  let count = 3 + Math.floor(DEPTH() / 15) + (g.room_num > 2 ? 1 : 0);
  if (g.fmod === FM_SWARM) count += 2;
  if (count > MAXM) count = MAXM;
  g.mon_left = 0;
  for (let n = 0; n < count; ++n) {
    let tx = 0, ty = 0, tries;
    for (tries = 0; tries < 30; ++tries) {
      tx = 5 + rnd() % 9; ty = 1 + rnd() % 9;
      const s = g.map[(ty << 4) + tx];
      if (s !== T_FLOOR && s !== T_FLOOR2 && s !== T_HAZARD) continue;
      break;
    }
    if (tries === 30) ty = 1;
    set_monster(n, g.roster[rnd() % g.nroster], tx << 4, PLAY_Y + (ty << 4));
    ++g.mon_left;
  }
  if (DEPTH() >= 3 && count && rnd() < 86) make_elite(rnd() % count, 1 + (rnd() & 3));
}
function mon_step(n, dx, dy) {
  let x = g.m_x[n], y = g.m_y[n];
  if (dx === 1) ++x; else if (dx === 2) --x;
  if (dy === 1) ++y; else if (dy === 2) --y;
  let moved = 0;
  if (x !== g.m_x[n] && !blocked(x, g.m_y[n])) { g.m_x[n] = x; moved = 1; }
  if (y !== g.m_y[n] && !blocked(g.m_x[n], y)) { g.m_y[n] = y; moved = 1; }
  return moved;
}
function mon_unstick(n, moved) {
  if (moved) return;
  g.m_wander[n] = 24;
  if (g.m_x[n] === g.px || (rnd() & 0x40)) g.m_dir[n] = (rnd() & 0x40) ? 1 : 2;
  else g.m_dir[n] = (rnd() & 0x40) ? 4 : 8;
}
const dir_to_x = n => (g.px > g.m_x[n] + 1 ? 1 : (g.px + 1 < g.m_x[n] ? 2 : 0));
const dir_to_y = n => (g.py > g.m_y[n] + 1 ? 1 : (g.py + 1 < g.m_y[n] ? 2 : 0));
export const faded = n => g.m_type[n] === M_GHOST && (g.m_timer[n] & 64);

// talents with a trinket's ranks
export function trinket_bonus(k) {
  if (!g.eq_has[K_TRINKET - 1]) return 0;
  ++k;
  let n = g.eq_spec[K_TRINKET - 1] === k ? 1 : 0;
  if ((g.eq_val[K_TRINKET - 1] & 15) === k) ++n;
  if ((g.eq_val[K_TRINKET - 1] >> 4) === k) ++n;
  return n;
}
export function tal_sync() {
  for (let k = 0; k < NTAL; ++k) {
    let r = g.tal[k] + trinket_bonus(k);
    if (r > TAL_MAX[k]) r = TAL_MAX[k];
    g.wt[k] = g.player_class === 0 ? r : 0;
    g.mt[k] = g.player_class === 1 ? r : 0;
    g.ht[k] = g.player_class === 2 ? r : 0;
  }
  fx('talents');
}
export function tameable(n) {
  const t = g.m_type[n];
  if (t !== M_SLIME && t !== M_BAT && t !== M_SPIDER) return 0;
  if (g.m_elite[n]) return 0;
  return g.m_hp[n] * 3 <= g.m_mhp[n] ? 1 : 0;
}
export function pet_max() {
  let v = g.pet_type === M_SLIME ? g.maxhp : (g.pet_type === M_BAT ? g.maxhp >> 1 : g.maxhp - (g.maxhp >> 2));
  v += Math.floor(v * T.VITAL / 5);
  return v;
}
function pet_revive() { g.pet_down = 0; g.pet_hp = pet_max(); }
const has_thorns = () => g.eq_spec[1] === SP_THORNS || g.eq_spec[2] === SP_THORNS || g.eq_spec[5] === SP_THORNS;

export function hurt_player(atk) {
  let s = (g.eq_spec[2] === SP_BLOCK ? 64 : 0) + T.DEFLECT * 20 + T.CAMO * 25;
  if (s && rnd() < s) {
    g.inv_timer = 30;
    sfx('block'); fx('block');
    return 0;
  }
  const q = atk * FINE + total_def(), p = atk * atk;
  let d = (Math.floor(p / q) * FINE + Math.floor(((p % q) * FINE) / q)) & 255;
  if (!d) d = 1;
  if (g.hp > d) g.hp -= d;
  else if ((T.LASTSTAND || T.ICEBLOCK) && !g.last_stand_used) {
    g.hp = 1;
    g.last_stand_used = 1;
    if (T.ICEBLOCK) {
      set_msg('ICE BLOCK!', COL_GOLD);
      g.inv_timer = 180;
      sfx('block'); fx('iceblock');
      return 1;
    }
    set_msg('LAST STAND!', COL_GOLD);
  } else g.hp = 0;
  if (d >= 10) sfx('slam');
  g.inv_timer = 60;
  sfx('hurt');
  fx('hurt', { d });
  return 1;
}

function fire(x, y, dx, dy, atk, src = 0) {
  for (let s = 0; s < MAXP; ++s) {
    if (g.pr_t[s]) continue;
    g.pr_x[s] = x; g.pr_y[s] = y; g.pr_dx[s] = dx; g.pr_dy[s] = dy; g.pr_atk[s] = atk; g.pr_bnc[s] = 0; g.pr_t[s] = 120; g.pr_src[s] = src;
    return;
  }
}
function fire_at_hero(x, y, atk, src = 0) {
  const dx = g.px + 4 - x, dy = g.py + 6 - y, adx = abs(dx), ady = abs(dy);
  let vx = 0, vy = 0;
  if (adx > (ady >> 1)) vx = dx > 0 ? 2 : -2;
  if (ady > (adx >> 1)) vy = dy > 0 ? 2 : -2;
  fire(x, y, vx, vy, atk, src);
}
// the shots move, die at walls (a CRYSTAL pillar throws one back once) and hurt the hero
function update_projectiles() {
  for (let x = MAXP - 1; x >= 0; --x) {
    if (!g.pr_t[x]) continue;
    --g.pr_t[x];
    g.pr_x[x] += g.pr_dx[x]; g.pr_y[x] += g.pr_dy[x];
    const X = g.pr_x[x], Y = g.pr_y[x];
    if (X < 8 || X >= 241) { g.pr_t[x] = 0; continue; }
    const yy = Y + 4 - 32;
    if (yy < 0 || yy >= 11 * 16) { g.pr_t[x] = 0; continue; }
    const c = g.map[(yy & 0xF0) | ((X + 4) >> 4)];
    if (TILE_SOLID[c]) {
      if (g.hz === HZ_CRYSTAL && c === T_PILLAR && !g.pr_bnc[x]) {
        g.pr_bnc[x] = 1; g.pr_dx[x] = -g.pr_dx[x]; g.pr_dy[x] = -g.pr_dy[x];
        hz_hint(); fx('crystal', { x: X, y: Y });
        continue;
      }
      g.pr_t[x] = 0; fx('shotwall', { x: X, y: Y, s: g.pr_src[x] });
      continue;
    }
    if (g.inv_timer || g.roll_timer || !g.hp) continue;
    const ax = (X - g.px + 3) & 255, ay = (Y - g.py + 2) & 255;
    if (ax < 14 && ay < 15) {
      g.pr_t[x] = 0;
      fx('shothero', { x: X, y: Y, s: g.pr_src[x] });
      hurt_player(g.pr_atk[x]);
    }
  }
}

function update_monsters() {
  const f = g.frame;
  for (let n = 0; n < MAXM; ++n) {
    if (!g.m_type[n]) continue;
    if (g.m_flash[n]) --g.m_flash[n];
    if (g.m_burn[n] && !(f & 31)) {
      --g.m_burn[n];
      const s = ((g.lvl + 1) >> 1) + T.IGNITE;
      fx('burn', { n, d: s });
      if (g.m_hp[n] <= s) { kill_monster(n); continue; }
      g.m_hp[n] -= s;
      g.m_flash[n] = 6;
    }
    if (g.m_frz[n]) { --g.m_frz[n]; continue; }
    g.m_timer[n]++;
    if (g.any_elite && g.m_elite[n] === EL_FRENZIED && (f & 1)) g.m_timer[n]++;
    if (g.m_slow[n]) --g.m_slow[n];
    const t = g.m_type[n];
    if (g.m_slow[n] && (f & 2)) {
      // CHILL: half speed
    } else if (g.m_kb[n]) {
      --g.m_kb[n];
      switch (g.m_kdir[n]) {
        case DIR_DOWN: mon_step(n, 0, 1); mon_step(n, 0, 1); break;
        case DIR_UP: mon_step(n, 0, 2); mon_step(n, 0, 2); break;
        case DIR_RIGHT: mon_step(n, 1, 0); mon_step(n, 1, 0); break;
        default: mon_step(n, 2, 0); mon_step(n, 2, 0);
      }
    } else if (g.m_wander[n] && t !== M_BAT) {
      --g.m_wander[n];
      if (f & 1) { if (!mon_step(n, g.m_dir[n] & 3, g.m_dir[n] >> 2)) g.m_wander[n] = 0; }
    } else {
      let s, s2, tx, ty;
      switch (t) {
        case M_SLIME:
          if ((g.m_timer[n] & 63) < 40 && (f & 1)) {
            s = dir_to_x(n); s2 = dir_to_y(n);
            if (s | s2) mon_unstick(n, mon_step(n, (g.m_timer[n] & 4) ? s : 0, (g.m_timer[n] & 4) ? 0 : s2) || mon_step(n, s, s2));
          }
          break;
        case M_BAT:
          if ((g.m_timer[n] & 31) === 0) {
            if (rnd() & 0x40) g.m_dir[n] = dir_to_x(n) | (dir_to_y(n) << 2);
            else g.m_dir[n] = (rnd() % 3) | ((rnd() % 3) << 2);
          }
          tx = g.m_x[n]; ty = g.m_y[n];
          s = g.m_dir[n] & 3; s2 = g.m_dir[n] >> 2;
          if (s === 1 && tx < 224) ++tx; else if (s === 2 && tx > 16) --tx;
          if (s2 === 1 && ty < PLAY_Y + 144) ++ty; else if (s2 === 2 && ty > PLAY_Y + 12) --ty;
          if (s === 1 && tx >= 224) g.m_dir[n] = (g.m_dir[n] & 12) | 2;
          if (s === 2 && tx <= 16) g.m_dir[n] = (g.m_dir[n] & 12) | 1;
          if (s2 === 1 && ty >= PLAY_Y + 144) g.m_dir[n] = (g.m_dir[n] & 3) | 8;
          if (s2 === 2 && ty <= PLAY_Y + 12) g.m_dir[n] = (g.m_dir[n] & 3) | 4;
          g.m_x[n] = tx; g.m_y[n] = ty;
          break;
        case M_SPIDER:
          s = g.m_timer[n] % 48;
          if (s === 0) g.m_dir[n] = dir_to_x(n) | (dir_to_y(n) << 2);
          if (s < 16) { mon_step(n, g.m_dir[n] & 3, g.m_dir[n] >> 2); mon_step(n, g.m_dir[n] & 3, g.m_dir[n] >> 2); }
          break;
        case M_GHOST:
          if (f & 1) {
            tx = g.m_x[n]; ty = g.m_y[n];
            s = dir_to_x(n); s2 = dir_to_y(n);
            if (s === 1 && tx < 224) ++tx; else if (s === 2 && tx > 16) --tx;
            if (s2 === 1 && ty < PLAY_Y + 144) ++ty; else if (s2 === 2 && ty > PLAY_Y + 8) --ty;
            g.m_x[n] = tx; g.m_y[n] = ty;
          }
          break;
        case M_WIZARD: {
          tx = adiff(g.px, g.m_x[n]); ty = adiff(g.py, g.m_y[n]);
          if (f & 1) {
            s = dir_to_x(n); s2 = dir_to_y(n);
            if (tx + ty < 56) mon_unstick(n, mon_step(n, s ? 3 - s : 0, s2 ? 3 - s2 : 0));
            else if (tx + ty > 110) mon_unstick(n, mon_step(n, s, s2));
          }
          s = g.m_timer[n] % 100;
          if (s === 50) { fire_at_hero(g.m_x[n] + 4, g.m_y[n] + 4, g.m_atk[n] - (g.m_atk[n] >> 2), 1); fx('cast', { n }); }
          break;
        }
        case M_SKEL:
          if ((f & 1) || DEPTH() >= 6) {
            s = dir_to_x(n); s2 = dir_to_y(n);
            if (s | s2) mon_unstick(n, mon_step(n, (f & 2) ? s : 0, (f & 2) ? 0 : s2) || mon_step(n, s, s2));
          }
          break;
      }
      // FAST FOES floors: everyone gets an extra step (ghosts ignore it; the deep monsters' own moves are in update_monsters_ex)
      if (g.fmod === FM_FAST && (f & 1) && t !== M_WIZARD && t !== M_GHOST) mon_step(n, dir_to_x(n), dir_to_y(n));
    }
    // touch damage (faded ghosts can't hurt or be hurt)
    if (faded(n)) continue;
    if (!g.inv_timer && !g.roll_timer && g.hp) {
      if (((g.m_x[n] - g.px + 8) & 255) <= 16 && ((g.m_y[n] - g.py + 8) & 255) <= 17) {
        if (hurt_player(g.m_atk[n])) {
          fx('bite', { n });
          if (g.any_elite && g.m_elite[n] === EL_VAMPIRIC) {
            g.m_hp[n] += g.m_mhp[n] >> 3;
            if (g.m_hp[n] > g.m_mhp[n]) g.m_hp[n] = g.m_mhp[n];
          }
          if (has_thorns()) {
            let s = fine_pts(total_def()) & 255;
            if (!s) s = 1;
            fx('thorns', { n, d: s });
            if (g.m_hp[n] <= s) kill_monster(n);
            else { g.m_hp[n] -= s; g.m_flash[n] = 14; }
          }
        }
      }
    }
  }
}

// the deep tower's monsters (floor 8 on: imp and later)
const IMP_OX = [40, -40, 0, 0], IMP_OY = [0, 0, 40, -40];
const BURST_DX = [2, -2, 0, 0, 2, -2, 2, -2], BURST_DY = [0, 0, 2, -2, 2, 2, -2, -2];
function ex_step(n, dx, dy) {
  let x = g.m_x[n], y = g.m_y[n];
  if (dx === 1) ++x; else if (dx === 2) --x;
  if (dy === 1) ++y; else if (dy === 2) --y;
  if (x !== g.m_x[n] && !blocked(x, g.m_y[n])) g.m_x[n] = x;
  if (y !== g.m_y[n] && !blocked(g.m_x[n], y)) g.m_y[n] = y;
}
function ex_float(n, dx, dy) {
  if (dx === 1 && g.m_x[n] < 224) ++g.m_x[n]; else if (dx === 2 && g.m_x[n] > 16) --g.m_x[n];
  if (dy === 1 && g.m_y[n] < PLAY_Y + 144) ++g.m_y[n]; else if (dy === 2 && g.m_y[n] > PLAY_Y + 8) --g.m_y[n];
}
function update_monsters_ex() {
  const f = g.frame;
  for (let n = 0; n < MAXM; ++n) {
    if (g.m_type[n] < M_IMP) continue;
    if (g.m_frz[n] || g.m_kb[n] || (g.m_slow[n] && (f & 2))) continue;
    const mx = g.m_x[n], my = g.m_y[n];
    const adx = adiff(g.px, mx), ady = adiff(g.py, my);
    const dx = adx > 1 ? (g.px > mx ? 1 : 2) : 0, dy = ady > 1 ? (g.py > my ? 1 : 2) : 0;
    let k, x, y;
    switch (g.m_type[n]) {
      case M_IMP:
        if ((g.m_timer[n] & 127) === 64) {
          k = rnd() & 3; x = g.px + IMP_OX[k]; y = g.py + IMP_OY[k];
          if (x >= 16 && x <= 224 && y >= PLAY_Y + 12 && y <= PLAY_Y + 144 && !blocked(x, y)) {
            fx('puff', { x: mx, y: my }); fx('blink', { x: mx, y: my, c: '#ff5a3a' });
            g.m_x[n] = x; g.m_y[n] = y;
          }
        } else ex_step(n, dx, (f & 1) ? dy : 0);
        break;
      case M_GOLEM:
        if (!(g.m_timer[n] & 3)) ex_step(n, dx, dy);
        break;
      case M_ARCHER:
        if (f & 1) {
          if (adx + ady > 100) ex_step(n, dx, dy);
          else if (adx + ady < 50) ex_step(n, dx ? 3 - dx : 0, dy ? 3 - dy : 0);
          else if (adx < ady) ex_step(n, dx, 0);
          else ex_step(n, 0, dy);
        }
        if (!(g.m_timer[n] & 63)) {
          if (adx < 6) { fire(mx + 4, my + 4, 0, g.py > my ? 3 : -3, g.m_atk[n], 2); fx('shoot', { n }); }
          else if (ady < 6) { fire(mx + 4, my + 4, g.px > mx ? 3 : -3, 0, g.m_atk[n], 2); fx('shoot', { n }); }
        }
        break;
      case M_VBAT:
        k = g.m_timer[n] & 63;
        if (!k) g.m_dir[n] = dx | (dy << 2);
        if (k < 20) { ex_step(n, g.m_dir[n] & 3, g.m_dir[n] >> 2); ex_step(n, g.m_dir[n] & 3, g.m_dir[n] >> 2); }
        else if (f & 1) ex_step(n, (rnd() & 1) ? dx : 0, (rnd() & 1) ? dy : 0);
        break;
      case M_WISP:
        k = (g.m_timer[n] & 32) ? 1 : 2;
        ex_float(n, dx, (f & 1) ? dy : ((g.m_timer[n] & 3) ? 0 : k));
        break;
      case M_HELLCRAB:
        if ((g.m_timer[n] & 31) < 24) {
          ex_step(n, dx, 0);
          if (f & 1) ex_step(n, dx, 0);
          if (!(g.m_timer[n] & 3)) ex_step(n, 0, dy);
        }
        break;
      case M_SLIMEKING:
        if ((g.m_timer[n] & 63) < 24) ex_step(n, dx, dy);
        if ((g.m_timer[n] & 127) === 100) {
          for (k = 0; k < 4; ++k) fire(mx + 4, my + 4, BURST_DX[k], BURST_DY[k], g.m_atk[n], 3);
          sfx('slam'); fx('stomp', { n });
        }
        break;
      case M_DEMON:
        k = g.m_timer[n] & 127;
        if (k < 20) { if (k === 19) g.m_dir[n] = dx | (dy << 2); }
        else if (k < 44) { for (let j = 0; j < 3; ++j) ex_step(n, g.m_dir[n] & 3, g.m_dir[n] >> 2); }
        else if (f & 1) ex_step(n, dx, dy);
        break;
      case M_WRAITH:
        k = g.m_timer[n] & 127;
        if (k === 32) {
          k = rnd() & 3; x = g.px + IMP_OX[k]; y = g.py + IMP_OY[k];
          if (x >= 16 && x <= 224 && y >= PLAY_Y + 12 && y <= PLAY_Y + 144 && !blocked(x, y)) {
            fx('puff', { x: mx, y: my }); fx('blink', { x: mx, y: my, c: '#8a5cff' });
            g.m_x[n] = x; g.m_y[n] = y;
          }
        } else if (k === 80) {
          fire(mx + 4, my + 4, adx * 2 >= ady ? (g.px > mx ? 2 : -2) : 0, ady * 2 >= adx ? (g.py > my ? 2 : -2) : 0, g.m_atk[n], 4);
          fx('cast', { n });
        } else if (!(g.m_timer[n] & 3)) ex_step(n, dx, dy);
        break;
      case M_INFERNO:
        if (f & 1) {
          if (adx + ady > 80) ex_step(n, dx, dy);
          else if (adx + ady < 40) ex_step(n, dx ? 3 - dx : 0, dy ? 3 - dy : 0);
        }
        if ((g.m_timer[n] & 127) === 64) {
          if (adx >= ady) {
            k = g.px > mx ? 2 : -2;
            fire(mx + 4, my + 4, k, 0, g.m_atk[n], 1); fire(mx + 4, my + 4, k, 1, g.m_atk[n], 1); fire(mx + 4, my + 4, k, -1, g.m_atk[n], 1);
          } else {
            k = g.py > my ? 2 : -2;
            fire(mx + 4, my + 4, 0, k, g.m_atk[n], 1); fire(mx + 4, my + 4, 1, k, g.m_atk[n], 1); fire(mx + 4, my + 4, -1, k, g.m_atk[n], 1);
          }
          sfx('slam'); fx('cast', { n });
        }
        break;
      default: // M_FIRESPRITE: rushes you; once close it flashes and bursts
        if (g.m_dir[n]) {
          if (--g.m_dir[n]) break;
          for (k = 0; k < 8; ++k) fire(mx + 4, my + 4, BURST_DX[k], BURST_DY[k], g.m_atk[n], 1);
          fx('explode', { x: mx, y: my }); sfx('slam');
          g.m_type[n] = M_NONE; g.m_frz[n] = 0; g.m_slow[n] = 0; g.m_burn[n] = 0;
          if (!g.boss_on && !--g.mon_left) room_cleared();
          break;
        }
        ex_step(n, dx, dy);
        if (adx < 20 && ady < 20) g.m_dir[n] = 40;
    }
  }
}

// ---------------------------------------------------------------- loot
export function tal_avail() {
  let n = 0;
  for (let k = 0; k < NTAL; ++k) n += g.tal[k];
  const k = g.lvl >> 1;
  return k > n ? k - n : 0;
}
export function gear_fine(kind, lvl) {
  const e = lvl + KIND_LVL[kind - 1];
  switch (kind) {
    case K_WEAPON: return 6 + ((e * 9) >> 1);
    case K_ARMOR: return 6 + ((e * 9) >> 2);
    case K_SHIELD: return IS_WARRIOR() ? 6 + Math.floor(e * 6 / 5) : 6 + e;
    case K_BOOTS: return 8 + e;
  }
  return 6 + e;
}
export const worn_fine = kind => (g.eq_has[kind - 1] ? gear_fine(kind, g.eq_lvl[kind - 1]) : 0);
export function atk_fine() {
  const main = D.MAIN_STAT[g.player_class];
  let off = 0;
  for (let t = 1; t <= 3; ++t) if (t !== main) off += gear_stat(t);
  // the main stat is damage; the other two help a third as much
  let v = ((T.MIGHT << 1) + g.bless_atk) * FINE + main_lvl() + gear_stat(main) + Math.floor(off / 3) + worn_fine(K_WEAPON) + worn_fine(K_GLOVES);
  if (IS_WARRIOR()) return v;
  v += worn_fine(K_SHIELD);
  return v + (IS_MAGE() ? Math.floor(v / 5) : (v * 7) >> 4);
}
export function total_def() {
  return worn_fine(K_ARMOR) + (IS_WARRIOR() ? worn_fine(K_SHIELD) : 0) + worn_fine(K_HELMET) + gear_stat(D.ST_DEF) +
    ((T.IRON << 1) + T.ICEARMOR + g.bless_def) * FINE;
}
export function spd_fine() {
  let k = worn_fine(K_BOOTS);
  if (k > 8 * FINE_SPD) k = 8 * FINE_SPD;
  k += ((T.FLEET + T.HFLEET) << 1) * FINE_SPD;
  if (k > 12 * FINE_SPD) k = 12 * FINE_SPD;
  if (IS_HUNTER()) k += 4 * FINE_SPD;
  return k;
}
export const fine_pts = v => Math.floor(v / FINE) + ((rnd() % FINE) < v % FINE ? 1 : 0);
function rand_tal() { const s = rnd() % 12; return s + Math.floor(s / 4) + 1; }
function roll_trinket(rar) {
  const a = rand_tal(), b = rar >= RAR_EPIC ? rand_tal() : 0;
  g.g_spec = a; g.g_val = b;
  if (rar === RAR_LEG) g.g_val |= (5 + (rnd() % 3) * 5) << 4;
}
// ---------------------------------------------------------------- gear stats
export const cpst = (d, di, src, si) => { for (let j = 0; j < 6; ++j) d[di * 6 + j] = src ? src[si * 6 + j] : 0; };
const STAT_K = [8, 11, 14, 16, 21];
// up to three stats by rarity; the first is mostly the class's main stat
function roll_stats(rar, lvl) {
  const st = g.g_st;
  st.fill(0);
  const n = rar === 0 ? (rnd() & 1) : rar === 1 ? 1 : rar === 2 ? 2 : rar === 3 ? 2 + (rnd() & 1) : 3;
  const main = D.MAIN_STAT[g.player_class];
  const base = Math.max(1, Math.floor((lvl + 6) * STAT_K[rar] / 64));
  for (let i = 0; i < n; ++i) {
    let t;
    if (i === 0) t = rnd() < 192 ? main : 1 + rnd() % 3;
    else t = [D.ST_STA, D.ST_DEF, D.ST_STA, D.ST_DEF, D.ST_DEX, main, 1 + rnd() % 3, D.ST_STA][rnd() & 7];
    let v = Math.floor(base * (80 + rnd() % 41) / 100);
    if (t === D.ST_DEF) v <<= 1;
    if (i === 0 && rar === RAR_LEG) v = Math.floor(v * 3 / 2);
    v = Math.max(1, Math.min(255, v));
    let j = 0;
    while (j < i && st[j * 2] !== t) ++j;
    if (j < i) st[j * 2 + 1] = Math.min(255, st[j * 2 + 1] + v); // (the same stat twice: added up)
    else { st[i * 2] = t; st[i * 2 + 1] = v; }
  }
}
// a stat summed over the worn gear
export function gear_stat(t) {
  let v = 0;
  for (let i = 0; i < NGEAR; ++i) if (g.eq_has[i]) for (let j = 0; j < 3; ++j) if (g.eq_st[i * 6 + j * 2] === t) v += g.eq_st[i * 6 + j * 2 + 1];
  return v;
}
// the main stat from levels: 12, +3 a level (as the old strength grew)
export const main_lvl = () => 12 + 3 * (g.lvl - 1);
export function stat_total(t) {
  if (t === D.MAIN_STAT[g.player_class]) return main_lvl() + gear_stat(t);
  if (t === D.ST_STA) return (g.lvl - 1) + gear_stat(t);
  if (t === D.ST_DEF) return total_def();
  return gear_stat(t);
}
// stamina on gear is max health: keep maxhp in step with what is worn
function sta_sync() {
  const s = gear_stat(D.ST_STA);
  if (s !== g.hpgear) { g.maxhp += s - g.hpgear; g.hpgear = s; if (g.hp > g.maxhp) g.hp = g.maxhp; if (g.hp < 1) g.hp = 1; }
}
export function roll_gear(kind, rar, tier) {
  const s = rnd() % (rar + 1);
  const DP = DEPTH();
  const e = DP + KIND_LVL[kind - 1] + RAR_LVL[rar] + (s << 1) + (tier > Math.floor(DP / 13) ? 2 : 0);
  gear_stats(kind, rar, e);
}
function gear_stats(kind, rar, e) {
  const s2 = rnd() & 0x40;
  g.g_lvl = (e - KIND_LVL[kind - 1]) & 255;
  roll_stats(rar, g.g_lvl);
  if (kind === K_TRINKET) { roll_trinket(rar); return; }
  switch (kind) {
    case K_WEAPON: g.g_val = 1 + ((e * 3) >> 2); g.g_spec = s2 ? SP_VAMPIRE : SP_CRIT; break;
    case K_ARMOR: g.g_val = 1 + ((e * 3) >> 3); g.g_spec = s2 ? SP_REGEN : SP_THORNS; break;
    case K_SHIELD:
      if (IS_WARRIOR()) { g.g_val = 1 + Math.floor(e / 5); g.g_spec = s2 ? SP_BLOCK : SP_THORNS; }
      else { g.g_val = 1 + Math.floor(e / 6); g.g_spec = s2 ? SP_VAMPIRE : SP_CRIT; }
      break;
    case K_BOOTS: g.g_val = 1 + (e >> 3); g.g_spec = SP_QUICK; break;
    case K_GLOVES: g.g_val = 1 + Math.floor(e / 6); g.g_spec = s2 ? SP_VAMPIRE : SP_CRIT; break;
    default: g.g_val = 1 + Math.floor(e / 6); g.g_spec = s2 ? SP_REGEN : SP_THORNS;
  }
  g.g_val &= 255;
  if (rar !== RAR_LEG) g.g_spec = SP_NONE;
}
export function rand_gear_kind() {
  const s = rnd();
  if (s < 52) return K_WEAPON;
  if (s < 104) return K_ARMOR;
  if (s < 142) return K_SHIELD;
  if (s < 180) return K_BOOTS;
  if (s < 218) return K_GLOVES;
  return K_HELMET;
}
export function best_tier() { const s = Math.floor(DEPTH() / 13) + 1; return s > 7 ? 7 : s; }
export function equip(kind, rar, tier, val, spec, lv, st = null, si = 0) {
  const k = kind - 1;
  g.eq_lvl[k] = lv; g.eq_val[k] = val; g.eq_rar[k] = rar; g.eq_spec[k] = spec; g.eq_tier[k] = tier; g.eq_has[k] = 1;
  cpst(g.eq_st, k, st, si);
  tal_sync(); sta_sync();
  fx('gear');
}
export function bag_free() {
  for (let s = 0; s < BAG; ++s) if (!g.b_kind[s]) return s;
  return BAG;
}
const free_slot = () => { for (let s = 0; s < MAXI; ++s) if (!g.i_kind[s]) return s; return MAXI; };
function needed_kind() {
  let best = 0, bk = 0;
  const DP = DEPTH();
  for (let k = 0; k < NGEAR_DROP; ++k) {
    let need;
    if (!g.eq_has[k]) need = 250;
    else need = g.eq_lvl[k] >= DP + 8 ? 0 : DP + 8 - g.eq_lvl[k];
    if (need > 246) need = 246;
    need += rnd() & 3;
    if (need >= best) { best = need; bk = k; }
  }
  return bk + 1;
}
function slide_open(x, y) {
  if (wsolid(x + 4, y + 4)) {
    for (let tries = 16; tries < 64; tries += 16) {
      if (!wsolid(x + 4 + tries, y + 4)) { x += tries; break; }
      if (!wsolid(x + 4 - tries, y + 4)) { x -= tries; break; }
      if (!wsolid(x + 4, y + 4 + tries)) { y += tries; break; }
      if (!wsolid(x + 4, y + 4 - tries)) { y -= tries; break; }
    }
  }
  return [x & 255, y & 255];
}
export function drop_loot(x, y) {
  let slot;
  for (slot = 0; slot < MAXI; ++slot) if (!g.i_kind[slot]) break;
  if (slot === MAXI) return;
  let r = rnd();
  if (g.fmod === FM_TREASURE) r = 128 + (r >> 1);
  if (g.loot_min) r = 255;
  if (r < 145 && !(T.SCAV && r < 32)) return;
  [x, y] = slide_open(x, y);
  g.i_x[slot] = x; g.i_y[slot] = y; g.i_spec[slot] = SP_NONE; g.i_rar[slot] = 0; g.i_tier[slot] = 0; g.i_lvl[slot] = 0;
  if (r < 177) { g.i_kind[slot] = K_POTION; fx('drop', { s: slot }); return; }
  if (r < 233) {
    g.i_kind[slot] = K_GOLD;
    let v = 2 + (DEPTH() << 1) + (rnd() & 3);
    if (g.fmod === FM_TREASURE) v = v > 127 ? 255 : v << 1;
    g.i_val[slot] = v;
    fx('drop', { s: slot });
    return;
  }
  g.i_kind[slot] = rnd() < 192 ? needed_kind() : rand_gear_kind();
  r = rnd();
  let s;
  if (r < 77) s = 0; else if (r < 174) s = 1; else if (r < 230) s = 2; else if (r < 251) s = 3; else s = 4;
  if (g.loot_min && s < g.loot_min - 1) s = g.loot_min - 1;
  g.i_rar[slot] = s;
  let tier = Math.floor(DEPTH() / 13) + ((rnd() & 0x40) ? 1 : 0);
  if (tier > 7) tier = 7;
  g.i_tier[slot] = tier;
  const k = g.i_kind[slot] - 1, fl = g.floor_num;
  for (let tries = 0; tries < 3; ++tries) {
    roll_gear(g.i_kind[slot], g.i_rar[slot], tier);
    if (!g.eq_has[k]) break;
    if (g.g_lvl > g.eq_lvl[k]) break;
    if (tries === 2) break;
    g.floor_num += 2;
  }
  g.floor_num = fl;
  g.i_lvl[slot] = g.g_lvl; g.i_val[slot] = g.g_val; g.i_spec[slot] = g.g_spec; cpst(g.i_st, slot, g.g_st, 0);
  fx('drop', { s: slot });
}
function drop_trinket(x, y) {
  const k = free_slot();
  if (k === MAXI) return;
  let r = rnd();
  r = r < 102 ? 1 : (r < 192 ? 2 : (r < 238 ? 3 : 4));
  roll_gear(K_TRINKET, r, 0);
  g.i_kind[k] = K_TRINKET; g.i_rar[k] = r; g.i_tier[k] = (g.g_val + g.g_spec) & 3; g.i_val[k] = g.g_val; g.i_spec[k] = g.g_spec; g.i_lvl[k] = g.g_lvl; cpst(g.i_st, k, g.g_st, 0); // (a trinket's tier only picks its look)
  if (wsolid(x + 4, y + 4)) {
    if (!wsolid(x + 20, y + 4)) x += 16;
    else if (!wsolid(x - 12, y + 4)) x -= 16;
    else if (!wsolid(x + 4, y + 20)) y += 16;
    else y -= 16;
  }
  g.i_x[k] = x; g.i_y[k] = y;
  fx('drop', { s: k });
}
function drop_gear(x, y, rar) { g.loot_min = rar + 1; drop_loot(x, y); g.loot_min = 0; }

function level_check() {
  while (g.xp >= g.xpnext) {
    g.xp -= g.xpnext;
    ++g.lvl;
    g.xpnext = 8 + g.lvl * 8 + Math.floor((g.lvl * g.lvl) / 4);
    g.maxhp += IS_WARRIOR() ? 4 : 3;
    g.hp = g.maxhp;
    set_msg(`LEVEL ${g.lvl}! ${g.lvl & 1 ? 'STRONGER!' : '+1 TALENT POINT'}`, COL_GOLD);
    sfx('levelup');
    fx('levelup', { lvl: g.lvl });
  }
}

export function item_name(kind, rar, tier, cls = g.player_class) {
  switch (kind) {
    case K_WEAPON: return (rar === 4 ? D.LEG_WEAPON_NAME : D.WEAPON_NAME)[(cls << 3) + tier];
    case K_ARMOR: return (rar === 4 ? D.LEG_ARMOR_NAME : D.ARMOR_NAME)[(cls << 3) + tier];
    case K_SHIELD: return (rar === 4 ? D.LEG_SHIELD_NAME : D.SHIELD_NAME)[(cls << 3) + tier];
    case K_BOOTS: return (rar === 4 ? D.LEG_BOOTS_NAME : D.BOOTS_NAME)[tier];
    case K_GLOVES: return (rar === 4 ? D.LEG_GLOVES_NAME : D.GLOVES_NAME)[tier];
    case K_TRINKET: return rar === 4 ? D.LEG_TRINKET_NAME[tier & 3] : D.TRINKET_NAME[rar];
    case K_POTION: return 'POTION';
    case K_GOLD: return 'GOLD';
  }
  return (rar === 4 ? D.LEG_HELMET_NAME : D.HELMET_NAME)[tier];
}
export const stat_name = kind => (kind === K_SHIELD && g.player_class ? 'ATK' : ['ATK', 'DEF', 'DEF', 'SPD', 'ATK', 'DEF', ''][kind - 1]);
// a trinket's talents: [[talent index, ranks], ...]
export function trinket_talents(spec, val) {
  const t = [spec, val & 15, val >> 4], out = [];
  for (let k = 0; k < 3; ++k) {
    if (!t[k]) continue;
    const at = out.find(o => o[0] === t[k] - 1);
    if (at) at[1]++; else out.push([t[k] - 1, 1]);
  }
  return out;
}
export const sell_price = (kind, rar, val) => (kind === K_TRINKET ? 10 + rar * 20 : (val >> 1) + 1);

function pickup(n) {
  const kind = g.i_kind[n], rar = g.i_rar[n];
  g.i_kind[n] = K_NONE;
  if (kind === K_POTION) {
    if (g.potions < MAXPOT) { ++g.potions; set_msg('POTION!', COL_RED); }
    else {
      const s = g.maxhp >> 1;
      g.hp = Math.min(g.maxhp, g.hp + s);
      set_msg(`POTION BELT FULL. GULP! +${s}`, COL_RED);
    }
    sfx('pickup'); fx('pickup', { s: n, kind });
    return 1;
  }
  if (kind === K_GOLD) {
    const v = g.i_val[n] + Math.floor(g.i_val[n] * T.TREASURE / 5);
    g.gold += v;
    set_msg(`+${v} GOLD`, COL_GOLD);
    sfx('coin'); fx('pickup', { s: n, kind, v });
    return 1;
  }
  const better = !g.eq_has[kind - 1] || g.i_lvl[n] > g.eq_lvl[kind - 1];
  const slot = bag_free();
  if (slot < BAG) {
    g.b_kind[slot] = kind; g.b_rar[slot] = rar; g.b_tier[slot] = g.i_tier[n];
    g.b_val[slot] = g.i_val[n]; g.b_spec[slot] = g.i_spec[n]; g.b_lvl[slot] = g.i_lvl[n]; cpst(g.b_st, slot, g.i_st, n);
    if (kind === K_TRINKET) {
      const tt = trinket_talents(g.i_spec[n], g.i_val[n]).map(([k, c]) => `+${c} ${D.TAL_NAME[g.player_class * NTAL + k]}`).join(', ');
      set_msg(`${D.RAR_NAME[rar]} ${item_name(kind, rar, 0)}! ${tt}`, D.RAR_COLOR[rar]);
    } else {
      let s = `${D.RAR_NAME[rar]} ${item_name(kind, rar, g.i_tier[n])} LV${g.i_lvl[n]} ${stat_name(kind)} ${gear_fine(kind, g.i_lvl[n])}`;
      if (rar === RAR_LEG) s += ' ' + D.SPEC_NAME[g.i_spec[n]];
      if (better) s += ' UP!';
      set_msg(s, D.RAR_COLOR[rar]);
    }
    fx('pickup', { s: n, kind, rar, better, slot });
  } else {
    g.i_kind[n] = kind;
    set_msg('BAG FULL! OPEN YOUR BAG TO SELL', D.RAR_COLOR[rar]);
    sfx('nope');
    return 0;
  }
  if (rar === RAR_LEG) sfx('legend'); else if (rar >= RAR_RARE) sfx('rare'); else sfx('pickup');
  return 1;
}

export function drink_potion() {
  if (g.state !== 'play') return;
  if (!g.potions) { set_msg('NO POTIONS LEFT', COL_RED); sfx('nope'); return; }
  if (g.hp >= g.maxhp && g.pet_type && (g.pet_down || g.pet_hp < pet_max())) {
    --g.potions;
    set_msg(g.pet_down ? 'YOUR PET IS BACK!' : 'YOUR PET IS HEALED!', COL_RED);
    if (g.pet_down) { g.pet_x = g.px; g.pet_y = g.py; g.pet_inv = 60; }
    pet_revive();
    sfx('drink'); fx('drink', { pet: 1 });
    return;
  }
  if (g.hp >= g.maxhp) { set_msg('ALREADY AT FULL HEALTH', COL_RED); sfx('nope'); return; }
  --g.potions;
  let s = g.maxhp >> 1;
  s += (s * T.ALCHEMY) >> 2;
  g.hp = Math.min(g.maxhp, g.hp + s);
  set_msg(`GLUG! +${s} HP`, COL_RED);
  sfx('drink'); fx('drink', { v: s });
}

// ---------------------------------------------------------------- boss
export function boss_name() {
  if (g.floor_num === LAST_FLOOR) return 'TOWER KING';
  return D.THEME_WORD[g.theme] + ' ' + D.BOSS_ROLE[g.brole];
}
function spawn_boss() {
  let s = rnd() % 3;
  if (s === g.brole) s = (s + 1 + (rnd() & 1)) % 3;
  g.brole = s;
  g.battacks = 0; g.boss_on = 1; g.bx = 176; g.by = PLAY_Y + 64;
  const DP = DEPTH();
  let h = (DP * DP) << 1;
  if (h > 300) h = 300;
  h += 60 + DP * 45;
  h += h >> 3;
  if (g.floor_num === LAST_FLOOR) h = KING_BRUTE_HP;
  if (g.fmod === FM_TOUGH) h += h >> 1;
  let a = 6 + DP + (DP >> 1);
  if (g.floor_num !== LAST_FLOOR) {
    if (!g.boss_tier) { h -= (h >> 2) + (h >> 3); a -= a >> 2; }
    else if (g.boss_tier === 2) { h = (h << 1) + (h >> 2); a += a >> 1; }
  }
  g.bmaxhp = h; g.bhp = h; g.batk = a & 255;
  g.bstate = BS_WALK; g.btimer = 0; g.bflash = 0; g.bhit = 0; g.blast = 255; g.bward = 0; g.bphase = 0; g.bfx = 0;
  g.bintro = g.floor_num === LAST_FLOOR ? 150 : 0;
  g.bform = BF_BRUTE;
  // the art: brute = demon ogre (odd floors) / spider demon, shaman = flame lord, warden = shadow wraith (odd) / slime king
  if (g.floor_num === LAST_FLOOR) g.boss_art = 5;
  else if (!g.brole) g.boss_art = (g.floor_num & 1) ? 0 : 1;
  else if (g.brole === 1) g.boss_art = 2;
  else g.boss_art = (g.floor_num & 1) ? 3 : 4;
  g.bhw = D.BOSS_HIT_W[g.boss_art]; g.bhh = D.BOSS_HIT_H[g.boss_art];
  if (g.floor_num === LAST_FLOOR) { g.bform = BF_WIZ; g.bmaxhp = g.bhp = KING_WIZ_HP; g.bx = 112; g.bhw = 0; g.bhh = 0; }
  g.bphase_hp[1] = Math.floor(g.bmaxhp / 3);
  g.bphase_hp[0] = g.bphase_hp[1] << 1;
  g.mon_left = 1;
  fx('boss');
}
function boss_try_move(nx, ny) {
  nx &= 255; ny &= 255;
  if (!blocked32(nx, g.by)) g.bx = nx;
  if (!blocked32(g.bx, ny)) g.by = ny;
}
export function kill_boss() {
  g.boss_on = 0;
  for (let j = 0; j < MAXM; ++j) if (g.m_type[j]) { fx('die', { n: j, t: g.m_type[j], x: g.m_x[j], y: g.m_y[j] }); g.m_type[j] = M_NONE; }
  for (let j = 0; j < MAXP; ++j) g.pr_t[j] = 0;
  fx('bossdie', { x: g.bx, y: g.by });
  if (g.floor_num === LAST_FLOOR) {
    g.state = 'rescue';
    sfx('levelup');
    rescue_start();
    return;
  }
  const DP = DEPTH();
  let s2 = 20 + (DP << 1);
  if (!g.boss_tier) s2 -= s2 >> 2;
  g.xp += s2 << 1;
  if (g.boss_tier === 2) g.xp += s2 << 1;
  ++g.kills;
  sfx('legend');
  for (let k2 = 0; k2 <= (g.boss_tier >> 1); ++k2) {
    const k = free_slot();
    if (k >= MAXI) break;
    g.i_kind[k] = rand_gear_kind();
    const s = rnd();
    switch (g.boss_tier - k2) {
      case 0: g.i_rar[k] = s < 64 ? RAR_EPIC : RAR_RARE; break;
      case 2: g.i_rar[k] = s < 128 ? RAR_LEG : RAR_EPIC; break;
      default: g.i_rar[k] = s < 51 ? RAR_LEG : (s < 166 ? RAR_EPIC : RAR_RARE);
    }
    g.i_tier[k] = best_tier();
    roll_gear(g.i_kind[k], g.i_rar[k], g.i_tier[k]);
    g.i_lvl[k] = g.g_lvl; g.i_val[k] = g.g_val; g.i_spec[k] = g.g_spec; cpst(g.i_st, k, g.g_st, 0);
    g.i_x[k] = g.bx + 6 + (k2 << 3); g.i_y[k] = g.by + 14 - (k2 << 4);
    fx('drop', { s: k });
  }
  for (let k2 = 0; k2 <= (g.boss_tier >> 1); ++k2) {
    const k = free_slot();
    if (k >= MAXI) break;
    g.i_kind[k] = K_GOLD;
    let v = DP > 80 ? 250 : 10 + DP * 3;
    if (!g.boss_tier) v >>= 1;
    g.i_val[k] = v; g.i_rar[k] = 0;
    g.i_x[k] = g.bx + 20; g.i_y[k] = g.by + 18 - (k2 << 4);
    fx('drop', { s: k });
  }
  g.mon_left = 0;
  level_check();
  g.map[g.door_pos] = T_STAIRS;
  g.door_open = 1;
  fx('door');
  set_msg(boss_name() + ' DEFEATED!', COL_GOLD);
  vendor_arrive();
}
function king_flee() {
  g.bform = BF_RUN; g.bstate = BS_WALK; g.btimer = 0; g.bward = 0;
  for (let j = 0; j < MAXP; ++j) g.pr_t[j] = 0;
  set_msg('KING: YOU WILL PAY FOR THAT!', COL_RED, 0);
  sfx('roar'); fx('kingflee');
}
export function hit_boss(dmg, crit = 0) {
  g.bhit = 1;
  if (g.bstate === BS_LEAP || g.bintro || g.bform === BF_RUN || g.bform === BF_DRINK || g.bform === BF_TF) return;
  if (g.bform === BF_WIZ && dmg >= g.bhp) {
    g.bhp = 1; g.bflash = 10;
    fx('bosshit', { d: dmg, crit });
    king_flee();
    return;
  }
  if (g.bstate === BS_STUN) dmg <<= 1;
  if (g.bward) { dmg = (dmg + 3) >> 2; sfx('block'); }
  fx('bosshit', { d: dmg, crit, ward: g.bward ? 1 : 0 });
  if (g.bhp <= dmg) { kill_boss(); return; }
  g.bhp -= dmg;
  g.bflash = 10;
}
const boss_hard = () => (g.boss_tier === 2 && g.floor_num !== LAST_FLOOR) || g.bphase === 2;
function boss_pick() {
  let n, base;
  if (g.bform === BF_WIZ) { base = 18; n = 4; }
  else if (g.floor_num === LAST_FLOOR) { base = 9 + g.bphase * 3; n = 3; }
  else { base = g.brole * 3; const DP = DEPTH(); n = DP >= 25 ? 3 : (DP >= 10 ? 2 : 1); }
  let k = rnd() % n;
  if (n > 1 && BOSS_MOVES[base + k] === g.blast) k = (k + 1) % n;
  return BOSS_MOVES[base + k];
}
function boss_aim() {
  const dx = g.px + 4 - g.bx - 16, dy = g.py + 8 - g.by - 16;
  let best = -1e9, b = 0;
  for (let k = 0; k < 16; ++k) {
    let d = dx * DIR16_X[k] + dy * DIR16_Y[k];
    if (k & 1) d = Math.trunc(d * 9 / 10);
    if (d > best) { best = d; b = k; }
  }
  return b;
}
const boss_shot = d => fire(g.bx + 12, g.by + 14, DIR16_X[d & 15], DIR16_Y[d & 15], g.batk, 5);
function boss_ring(odd) { for (let k = odd; k < 16; k += 2) boss_shot(k); fx('ring', { x: g.bx, y: g.by }); }
export function boss_minions() { let n = 0; for (let k = 0; k < MAXM; ++k) if (g.m_type[k]) ++n; return n; }
function boss_call(n, most, e) {
  let c = boss_minions();
  for (let k = 0; k < MAXM && n && c < most; ++k) {
    if (g.m_type[k]) continue;
    set_monster(k, g.roster[0], (n & 1) ? (g.bx < 164 ? g.bx + 52 : 16) : (g.bx > 56 ? g.bx - 40 : 216), g.by + 8);
    if (e) make_elite(k, e);
    fx('summon', { n: k });
    --n; ++c;
  }
  g.elite_said = 0;
}
function boss_stun(t) { g.bstate = BS_STUN; g.btimer = t; }
function king_phase(ph) {
  g.bphase = ph;
  for (let j = 0; j < MAXP; ++j) g.pr_t[j] = 0;
  g.bintro = 90; g.bstate = BS_WALK; g.btimer = 0; g.bward = 0; g.bfx = 12;
  sfx('roar'); fx('flash', { c: '#ffffff' }); fx('kingphase', { ph });
  set_msg('KING: ' + D.KING_SAYS[ph], COL_RED, 0);
  if (ph === 1) boss_call(2, 2, EL_ARMORED);
}
function boss_attack() {
  let k;
  g.bmove = boss_pick();
  g.blast = g.bmove;
  ++g.battacks;
  fx('bmove', { m: g.bmove });
  switch (g.bmove) {
    case MV_BURST:
      for (k = 0; k < 16; k += 2) if (k !== 10 || boss_hard()) boss_shot(k);
      fire_at_hero(g.bx + 12, g.by + 12, g.batk, 5);
      sfx('roar'); boss_stun(15);
      return;
    case MV_SUMMON:
      boss_call(2, boss_hard() ? WARDEN_MAX + 1 : WARDEN_MAX, 0);
      sfx('roar'); boss_stun(15);
      return;
    case MV_SLAM:
      boss_ring(0); sfx('slam'); fx('slam', { x: g.bx, y: g.by });
      g.bstate = BS_CAST; g.btimer = 0;
      return;
    case MV_SPIRAL:
      g.bspin = boss_aim(); sfx('cast');
      g.bstate = BS_CAST; g.btimer = 0;
      return;
    case MV_FAN:
      k = boss_aim();
      boss_shot(k - 2); boss_shot(k - 1); boss_shot(k); boss_shot(k + 1); boss_shot(k + 2);
      sfx('shoot'); boss_stun(15);
      return;
    case MV_WARD:
      g.bward = 240; boss_call(1, WARDEN_MAX, 0);
      sfx('levelup'); boss_stun(10);
      return;
    case MV_BLINK: {
      g.lx1 = g.bx; g.ly1 = g.by;
      for (k = 0; k < 16; ++k) {
        const tx = 24 + rnd() % 184, ty = PLAY_Y + 16 + rnd() % 112;
        if (blocked32(tx, ty)) continue;
        if (((tx - g.px + 56) & 255) < 112 && ((ty - g.py + 48) & 255) < 96) continue;
        g.lx1 = tx; g.ly1 = ty;
        break;
      }
      fx('blink', { x: g.bx + 8, y: g.by + 8, c: '#b07cff', big: 1 });
      g.bx = g.lx1; g.by = g.ly1;
      g.bflash = 16;
      fx('blink', { x: g.bx + 8, y: g.by + 8, c: '#b07cff', big: 1 });
      k = boss_aim();
      boss_shot(k - 1); boss_shot(k); boss_shot(k + 1);
      sfx('blink'); boss_stun(10);
      return;
    }
    case MV_LEAP:
      g.lx0 = g.bx; g.ly0 = g.by;
      g.lx1 = g.px < 8 ? 0 : g.px - 8;
      g.ly1 = g.py < PLAY_Y + 10 ? PLAY_Y : g.py - 10;
      if (g.lx1 > 208) g.lx1 = 208;
      if (blocked32(g.lx1, g.ly1)) { g.lx1 = g.bx; g.ly1 = g.by; }
      sfx('roar');
      g.bstate = BS_LEAP; g.btimer = 0;
      return;
  }
  // CHARGE
  const dx = g.px - g.bx - 8, dy = g.py - g.by - 8, adx = abs(dx), ady = abs(dy);
  const s = boss_hard() ? 4 : 3;
  g.bdx = 0; g.bdy = 0;
  if (adx > (ady >> 1)) g.bdx = dx > 0 ? s : -s;
  if (ady > (adx >> 1)) g.bdy = dy > 0 ? s : -s;
  if (g.bdx && g.bdy) { g.bdx = g.bdx > 0 ? s - 1 : 1 - s; g.bdy = g.bdy > 0 ? s - 1 : 1 - s; }
  g.bstate = BS_CHARGE; g.btimer = 0;
}
function king_transform() {
  g.bform = BF_BRUTE;
  g.bhw = D.BOSS_HIT_W[5]; g.bhh = D.BOSS_HIT_H[5];
  g.bmaxhp = g.bhp = KING_BRUTE_HP;
  g.bphase_hp[1] = Math.floor(g.bmaxhp / 3);
  g.bphase_hp[0] = g.bphase_hp[1] << 1;
  fx('kingtf');
  king_phase(0);
}
const TF_FRAME = 12;
function update_king_wiz() {
  ++g.btimer;
  if (g.bform === BF_RUN) {
    const gx = ALCH_X << 4, gy = PLAY_Y + 36;
    let tx = g.bx, ty = g.by;
    for (let j = 0; j < 2; ++j) {
      if (tx < gx) ++tx; else if (tx > gx) --tx;
      if (ty < gy) ++ty; else if (ty > gy) --ty;
    }
    boss_try_move(tx, ty);
    if ((g.bx === gx && g.by === gy) || g.btimer > 150) {
      if (g.bx !== gx || g.by !== gy) { fx('blink', { x: g.bx + 8, y: g.by + 8, c: '#b07cff' }); g.bx = gx; g.by = gy; sfx('blink'); }
      g.bform = BF_DRINK; g.btimer = 0;
      sfx('drink'); fx('kingdrink');
    }
    return;
  }
  if (g.bform === BF_DRINK) {
    if (g.btimer === 40) sfx('drink');
    if (g.btimer >= 80) { g.bform = BF_TF; g.btimer = 0; g.bfx = 10; fx('flash', { c: '#c9a2ff' }); sfx('levelup'); fx('kingchange'); }
    return;
  }
  if (g.bform === BF_TF) {
    if (g.btimer === TF_FRAME * 2) sfx('roar');
    if (g.btimer === TF_FRAME * 5) king_transform();
    return;
  }
  switch (g.bstate) {
    case BS_WALK:
      if (g.frame & 1) {
        const s = adiff(g.px, g.bx + 8), s2 = adiff(g.py, g.by + 8);
        let tx = g.bx, ty = g.by;
        if (s + s2 < 56) { if (g.px > g.bx + 8) --tx; else ++tx; if (g.py > g.by + 8) --ty; else ++ty; }
        else if (s + s2 > 96) { if (g.px > g.bx + 8) ++tx; else --tx; if (g.py > g.by + 8) ++ty; else --ty; }
        if (tx < 16) tx = 16;
        if (tx > 208) tx = 208;
        boss_try_move(tx, ty);
      }
      if (g.btimer >= (g.bhp < (g.bmaxhp >> 1) ? 60 : 90)) { g.bstate = BS_WIND; g.btimer = 0; sfx('cast'); }
      break;
    case BS_WIND:
      if (g.btimer >= 24) boss_attack();
      break;
    case BS_CAST:
      if (!(g.btimer & 3)) { boss_shot(g.bspin); ++g.bspin; }
      if (g.btimer >= 48) boss_stun(15);
      break;
    default:
      if (g.btimer >= 45) { g.bstate = BS_WALK; g.btimer = 0; }
  }
  if (!g.inv_timer && !g.roll_timer && g.hp && g.px + 12 > g.bx + 8 && g.px + 3 < g.bx + 24 && g.py + 14 > g.by + 4 && g.py + 4 < g.by + 30)
    hurt_player(g.batk >> 1);
}
const LEAP_T = 40;
function update_boss() {
  if (!g.boss_on) return;
  if (g.bflash) --g.bflash;
  if (g.bward) --g.bward;
  if (g.bfx) --g.bfx;
  if (g.floor_num === LAST_FLOOR && g.bform === BF_BRUTE && g.bphase === 1) g.bward = boss_minions() ? 2 : 0;
  if (g.bintro) { --g.bintro; return; }
  if (g.bform !== BF_BRUTE) { update_king_wiz(); return; }
  if (g.floor_num === LAST_FLOOR && g.bphase < 2 && g.bhp < g.bphase_hp[g.bphase]) king_phase(g.bphase + 1);
  if (g.bintro) return;
  ++g.btimer;
  const angry = g.bhp < (g.bmaxhp >> 1), hard = boss_hard();
  switch (g.bstate) {
    case BS_WALK:
      if ((g.frame & 1) || angry || hard) {
        let tx = g.bx, ty = g.by;
        if (g.px > g.bx + 9) ++tx; else if (g.px + 7 < g.bx) --tx;
        if (g.py > g.by + 9) ++ty; else if (g.py + 7 < g.by) --ty;
        boss_try_move(tx, ty);
      }
      if (g.btimer >= (hard ? (angry ? 50 : 80) : (angry ? 70 : 110))) { g.bstate = BS_WIND; g.btimer = 0; sfx('roar'); fx('bwind'); }
      break;
    case BS_WIND:
      if (g.btimer >= (hard ? (angry ? 16 : 24) : (angry ? 24 : 36))) boss_attack();
      break;
    case BS_CAST:
      if (g.bmove === MV_SLAM) {
        if (g.btimer === 18) { boss_ring(1); sfx('slam'); fx('slam', { x: g.bx, y: g.by }); boss_stun(20); }
      } else {
        if (!(g.btimer % (hard ? 3 : 4))) { boss_shot(g.bspin); if (hard) boss_shot(g.bspin + 8); ++g.bspin; }
        if (g.btimer >= (hard ? 36 : 48)) boss_stun(15);
      }
      break;
    case BS_LEAP:
      g.bx = (g.lx0 + Math.trunc((g.lx1 - g.lx0) * g.btimer / LEAP_T)) & 255;
      g.by = (g.ly0 + Math.trunc((g.ly1 - g.ly0) * g.btimer / LEAP_T)) & 255;
      if (g.btimer >= LEAP_T) {
        g.bx = g.lx1; g.by = g.ly1;
        boss_ring(g.battacks & 1);
        sfx('slam'); fx('slam', { x: g.bx, y: g.by, big: 1 });
        boss_stun(25);
      }
      break;
    case BS_CHARGE: {
      const tx = (g.bx + g.bdx) & 255, ty = (g.by + g.bdy) & 255;
      let s = 0;
      if (g.bdx) { if (blocked32(tx, g.by)) s = 1; else g.bx = tx; }
      if (g.bdy) { if (blocked32(g.bx, ty)) s = 1; else g.by = ty; }
      if (s) { boss_stun(0); sfx('slam'); fx('slam', { x: g.bx, y: g.by, wall: 1 }); }
      else if (g.btimer >= 45) boss_stun(20);
      break;
    }
    default:
      if (g.btimer >= (hard ? 40 : 60)) { g.bstate = BS_WALK; g.btimer = 0; }
  }
  if (g.bstate !== BS_LEAP && !g.inv_timer && !g.roll_timer && g.hp) {
    if (g.px + 12 > g.bx + 5 && g.px + 3 < g.bx + 27 && g.py + 14 > g.by + 6 && g.py + 4 < g.by + 30) {
      if (hurt_player(g.bstate === BS_CHARGE ? g.batk + (g.batk >> 1) : g.batk) && has_thorns()) {
        const s = fine_pts(total_def()) & 255;
        hit_boss(s ? s : 1);
        g.bhit = 0;
      }
    }
  }
}

// ---------------------------------------------------------------- merchant
export function stock_shop() {
  for (let k = 0; k < 4; ++k) g.sh_sold[k] = 0;
  const DP = DEPTH();
  g.sh_price[0] = 10 + DP * 3;
  // (what the merchant stocks grows with the floor: plain and green gear early, legendaries only deep)
  g.sh_kind[1] = K_WEAPON;
  g.sh_kind[2] = K_ARMOR + (rnd() & 3);
  for (let k = 1; k < 3; ++k) {
    const s = rnd();
    g.sh_rar[k] = shop_rar(s);
    g.sh_tier[k] = best_tier();
    roll_gear(g.sh_kind[k], g.sh_rar[k], g.sh_tier[k]);
    g.sh_lvl[k] = g.g_lvl; g.sh_val[k] = g.g_val; g.sh_spec[k] = g.g_spec; cpst(g.sh_st, k, g.g_st, 0);
    g.sh_price[k] = g.g_val * (g.sh_kind[k] === K_WEAPON ? 8 : (g.sh_kind[k] === K_ARMOR ? 10 : 16)) + g.sh_rar[k] * 20;
  }
  g.sh_price[3] = 40 + (DP << 3);
}
// a rarity for the merchant's wares (s: a random byte), and for his mystery chest
const SHOP_ODDS = [ // [floor from, chance out of 256 for common, uncommon, rare, epic, legendary]
  [1, [90, 115, 51, 0, 0]], [5, [0, 102, 115, 39, 0]], [10, [0, 0, 128, 103, 25]], [20, [0, 0, 128, 90, 38]]];
const CHEST_ODDS = [
  [1, [0, 128, 115, 13, 0]], [5, [0, 0, 154, 89, 13]], [10, [0, 0, 102, 115, 39]], [20, [0, 0, 77, 102, 77]]];
function odds_pick(table, s) {
  let row = table[0][1];
  for (const [f, r] of table) if (g.floor_num >= f) row = r;
  for (let i = 0, acc = 0; i < 5; ++i) { acc += row[i]; if (s < acc) return i; }
  return RAR_RARE;
}
export const shop_rar = s => odds_pick(SHOP_ODDS, s);
export const chest_rar = s => odds_pick(CHEST_ODDS, s);
function vendor_arrive() {
  g.vend_state = 1; g.vtimer = 40;
  g.vx = (g.door_pos & 15) << 4;
  g.vy = PLAY_Y + ((g.door_pos >> 4) << 4);
  g.vend_touch = 0;
  stock_shop();
}
function update_vendor() {
  switch (g.vend_state) {
    case 1: if (--g.vtimer === 0) { g.vend_state = 2; g.vtimer = 56; } break;
    case 2:
      if (g.door_wall === DW_RIGHT) --g.vx; else if (g.door_wall === DW_TOP) ++g.vy; else --g.vy;
      if (--g.vtimer === 0) { g.vend_state = 3; set_msg('A MERCHANT WANTS TO TRADE!', COL_GOLD); }
      break;
    case 3:
      if (g.px + 12 > g.vx + 2 && g.px + 3 < g.vx + 14 && g.py + 14 > g.vy + 2 && g.py + 2 < g.vy + 15) {
        if (!g.vend_touch) { g.vend_touch = 1; fx('shop'); }
      } else g.vend_touch = 0;
  }
}
// the shop, as the UI uses it
export function shop_buy(k) {
  if (g.sh_sold[k]) { sfx('nope'); return 'That one is sold out.'; }
  if (g.gold < g.sh_price[k]) { sfx('nope'); return 'Not enough gold, friend.'; }
  if (k && bag_free() === BAG) { sfx('nope'); return 'Your bag is full!'; }
  g.gold -= g.sh_price[k];
  g.sh_sold[k] = 1;
  sfx('buy');
  if (k === 0) { g.hp = g.maxhp; return 'Full health! Drink up.'; }
  const b = bag_free();
  if (k < 3) {
    g.b_kind[b] = g.sh_kind[k]; g.b_rar[b] = g.sh_rar[k]; g.b_tier[b] = g.sh_tier[k];
    g.b_val[b] = g.sh_val[k]; g.b_spec[b] = g.sh_spec[k]; g.b_lvl[b] = g.sh_lvl[k]; cpst(g.b_st, b, g.sh_st, k);
    return "It's in your bag. Enjoy!";
  }
  const kind = rand_gear_kind(), s = rnd();
  const rar = chest_rar(s);
  let tier = best_tier();
  if (tier < 7 && (rnd() & 0x40)) ++tier;
  roll_gear(kind, rar, tier);
  g.b_kind[b] = kind; g.b_rar[b] = rar; g.b_tier[b] = tier; g.b_val[b] = g.g_val; g.b_spec[b] = g.g_spec; g.b_lvl[b] = g.g_lvl; cpst(g.b_st, b, g.g_st, 0);
  if (rar === RAR_LEG) sfx('legend');
  return `${D.RAR_NAME[rar]} ${item_name(kind, rar, tier)} LV${g.g_lvl}!`;
}
export function shop_close() { save_game(); set_msg('COME BACK ANY TIME!', COL_GOLD); }

// ---------------------------------------------------------------- the bag and gear (character screen)
export function bag_equip(k) {
  if (!g.b_kind[k]) { sfx('nope'); return; }
  const kind = g.b_kind[k], i = kind - 1;
  const was = { has: g.eq_has[i], rar: g.eq_rar[i], tier: g.eq_tier[i], val: g.eq_val[i], spec: g.eq_spec[i], lvl: g.eq_lvl[i], st: g.eq_st.slice(i * 6, i * 6 + 6) };
  equip(kind, g.b_rar[k], g.b_tier[k], g.b_val[k], g.b_spec[k], g.b_lvl[k], g.b_st, k);
  if (was.has) { g.b_rar[k] = was.rar; g.b_tier[k] = was.tier; g.b_val[k] = was.val; g.b_spec[k] = was.spec; g.b_lvl[k] = was.lvl; cpst(g.b_st, k, was.st, 0); }
  else g.b_kind[k] = K_NONE;
  sfx('buy');
}
export function gear_unequip(i) { // i = kind - 1 (not the weapon)
  if (!i || !g.eq_has[i]) { sfx('nope'); return 0; }
  const s = bag_free();
  if (s === BAG) { sfx('nope'); return 0; }
  g.b_kind[s] = i + 1; g.b_rar[s] = g.eq_rar[i]; g.b_tier[s] = g.eq_tier[i]; g.b_val[s] = g.eq_val[i]; g.b_spec[s] = g.eq_spec[i]; g.b_lvl[s] = g.eq_lvl[i]; cpst(g.b_st, s, g.eq_st, i);
  g.eq_has[i] = 0; g.eq_val[i] = 0; g.eq_spec[i] = 0; g.eq_rar[i] = 0; cpst(g.eq_st, i, null, 0);
  tal_sync(); sta_sync(); fx('gear');
  sfx('pickup');
  return 1;
}
export function bag_sell(k) {
  if (!g.b_kind[k]) { sfx('nope'); return 0; }
  const v = sell_price(g.b_kind[k], g.b_rar[k], g.b_val[k]);
  g.gold += v;
  g.b_kind[k] = K_NONE;
  sfx('coin');
  return v;
}
// talents
export const tal_spent = tree => { let n = 0; for (let k = 0; k < 5; ++k) n += g.tal[tree * 5 + k]; return n; };
export const tal_unlocked = idx => tal_spent(Math.floor(idx / 5)) >= (idx % 5) * 3;
export const tal_cost = () => tal_spent(0) + tal_spent(1) + tal_spent(2);
export function tal_learn(idx) {
  if (!tal_unlocked(idx) || g.tal[idx] >= TAL_MAX[idx] || tal_avail() === 0) { sfx('nope'); return 0; }
  ++g.tal[idx];
  if (idx === 5 && IS_WARRIOR()) { g.maxhp += 5; g.hp += 5; }
  tal_sync();
  sfx('levelup');
  return 1;
}
export function tal_reset() {
  if (!tal_cost() || g.gold < tal_cost() * 20) { sfx('nope'); return 0; }
  g.gold -= tal_cost() * 20;
  g.maxhp -= T.TOUGH * 5;
  if (g.hp > g.maxhp) g.hp = g.maxhp;
  for (let i = 0; i < NTAL; ++i) g.tal[i] = 0;
  tal_sync();
  sfx('buy');
  return 1;
}
// the magic merchant: 3 of a rarity for 1 of the next (fee 10% of your gold); 5 epics for a
// legendary, 5 legendaries for a better legendary (fee 20%)
export const trade_need = (count, rar) => (count && rar >= RAR_EPIC ? 5 : 3);
function trade_upgrade(kind, min) {
  roll_gear(kind, RAR_LEG, best_tier());
  if (g.g_lvl > min || min >= LVL_MAX) return;
  let e = min + 1 + rnd() % 3;
  if (e > LVL_MAX) e = LVL_MAX;
  gear_stats(kind, RAR_LEG, e + KIND_LVL[kind - 1]);
}
export function trade(marks) { // marks: bag slots
  if (!marks.length) return null;
  const rar = g.b_rar[marks[0]];
  if (marks.length !== trade_need(marks.length, rar)) return null;
  const fee = rar >= RAR_EPIC ? Math.floor(g.gold / 5) : Math.floor(g.gold / 10);
  g.gold -= fee;
  let kind = 0, up = 0;
  for (const k of marks) { if (!kind) kind = g.b_kind[k]; else if (kind !== g.b_kind[k]) kind = 0xFF; }
  if (rar !== RAR_LEG || kind === 0xFF) kind = rand_gear_kind();
  for (const k of marks) { if (g.b_kind[k] === kind && g.b_lvl[k] > up) up = g.b_lvl[k]; g.b_kind[k] = K_NONE; }
  if (g.eq_has[kind - 1] && g.eq_lvl[kind - 1] > up) up = g.eq_lvl[kind - 1];
  const tier = best_tier();
  let nr;
  if (rar === RAR_LEG) { nr = RAR_LEG; trade_upgrade(kind, up); }
  else { nr = rar + 1; roll_gear(kind, nr, tier); }
  const b = bag_free();
  g.b_kind[b] = kind; g.b_rar[b] = nr; g.b_tier[b] = tier; g.b_val[b] = g.g_val; g.b_spec[b] = g.g_spec; g.b_lvl[b] = g.g_lvl; cpst(g.b_st, b, g.g_st, 0);
  sfx('legend');
  save_game();
  return { slot: b, fee, up: rar === RAR_LEG ? up : 0 };
}

// ---------------------------------------------------------------- the hero
function puff(x, y, c) { fx('puff', { x, y, c }); }
export function kill_monster(n) {
  const t = g.m_type[n];
  g.m_type[n] = M_NONE;
  g.m_frz[n] = 0; g.m_slow[n] = 0; g.m_burn[n] = 0;
  fx('die', { n, t, x: g.m_x[n], y: g.m_y[n], e: g.m_elite[n] });
  g.xp += g.m_xp[n] << 1;
  ++g.kills;
  sfx('kill');
  if (T.BLOODBATH) g.hp = Math.min(g.maxhp, g.hp + 3 * T.BLOODBATH);
  if (g.mimic_n === n + 1) { g.mimic_n = 0; drop_gear(g.m_x[n] + 4, g.m_y[n] + 6, 2); }
  else if (g.m_elite[n]) {
    if (rnd() < 102) drop_trinket(g.m_x[n] + 4, g.m_y[n] + 6);
    else drop_gear(g.m_x[n] + 4, g.m_y[n] + 6, 2);
  } else if (!g.m_risen[n]) drop_loot(g.m_x[n] + 4, g.m_y[n] + 6);
  level_check();
  if (g.boss_on) return;
  if (g.m_elite[n] === EL_SPLITTING && split_monster(n, t)) return;
  if (g.hz === HZ_BONES && !g.m_risen[n] && bones_add(n, t)) return;
  --g.mon_left;
  if (!g.mon_left) room_cleared();
}
function roll_damage() {
  let dmg = fine_pts(atk_fine() + ((rnd() & 0x40) ? FINE : 0));
  if (T.RAGE && g.hp < (g.maxhp >> 1)) dmg += Math.floor(dmg * T.RAGE / 10);
  const s = (g.eq_spec[0] === SP_CRIT || g.eq_spec[4] === SP_CRIT || g.eq_spec[2] === SP_CRIT ? 64 : 0) + T.KEEN * 15 + Math.min(64, Math.floor(gear_stat(D.ST_DEX) * 256 / 1000));
  let crit = 0;
  if (s && rnd() < s) { dmg <<= 1; crit = 1; sfx('crit'); } else sfx('hit');
  if (g.hp < g.maxhp && (g.eq_spec[0] === SP_VAMPIRE || g.eq_spec[4] === SP_VAMPIRE || g.eq_spec[2] === SP_VAMPIRE || (T.BLOODLUST && rnd() < T.BLOODLUST * 51))) ++g.hp;
  roll_damage.crit = crit;
  return dmg;
}
export const roll_damage_test = roll_damage;
function hit_monster(n, dmg, dir, crit = 0) {
  g.m_hit[n] = 1;
  if (g.any_elite && g.m_elite[n] === EL_ARMORED) dmg = (dmg + 1) >> 1;
  if (g.m_hp[n] <= dmg || (T.EXECUTE && rnd() < 38)) {
    fx('hit', { n, d: dmg, crit, x: g.m_x[n], y: g.m_y[n], kill: 1 });
    kill_monster(n);
  } else {
    const was = tameable(n);
    g.m_hp[n] -= dmg;
    g.m_flash[n] = 14; g.m_kb[n] = 6; g.m_kdir[n] = dir;
    fx('hit', { n, d: dmg, crit, x: g.m_x[n], y: g.m_y[n] });
    if (IS_HUNTER() && !g.pet_type && !was && tameable(n)) set_msg('WEAK! STAND CLOSE AND PRESS TAME', COL_GOLD);
  }
}
// the warrior's slash: the blade's box where it is each frame of the swing
const SLASH_START = [6, 2, 0, 0];
const WHIRL_STEP = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 8];
const SB_X1 = [45, 51, 67, 67, 67, 67, 67, 51, 77, 77, 77, 77, 58, 42, 36, 42, 67, 67, 77, 67, 67, 51, 36, 51];
const SB_X2 = [75, 75, 75, 91, 97, 91, 75, 75, 85, 101, 107, 101, 66, 66, 66, 66, 75, 91, 107, 91, 75, 75, 66, 75];
const SB_Y1 = [67, 67, 67, 67, 46, 30, 24, 30, 40, 46, 62, 62, 40, 46, 62, 62, 24, 30, 62, 67, 67, 67, 62, 30];
const SB_Y2 = [75, 91, 97, 91, 54, 54, 54, 54, 70, 70, 70, 86, 70, 70, 70, 86, 54, 54, 70, 91, 97, 91, 70, 54];
export function slash_index() {
  const st = g.atk_timer >= 13 ? 0 : 13 - g.atk_timer;
  if (T.WHIRL) return 16 + ((SLASH_START[g.pdir] + WHIRL_STEP[st]) & 7);
  return (g.pdir << 2) + (st < 2 ? 0 : (st < 4 ? 1 : (st < 7 ? 2 : 3)));
}
function sword_hits() {
  const n0 = slash_index();
  const cl = v => (v < 64 ? 0 : (v > 319 ? 255 : v - 64));
  let x1 = cl(g.px + SB_X1[n0]), x2 = cl(g.px + SB_X2[n0]), y1 = cl(g.py + SB_Y1[n0]), y2 = cl(g.py + SB_Y2[n0]);
  if (g.pdx && g.pdy && !T.WHIRL) { // a diagonal swing: the square off that corner
    const cx = g.px + 8 + g.pdx * 19, cy = g.py + 9 + g.pdy * 19, r = 15 + (13 - Math.min(13, g.atk_timer) > 3 ? 1 : 0);
    x1 = cl(cx - r + 64); x2 = cl(cx + r + 64); y1 = cl(cy - r + 64); y2 = cl(cy + r + 64);
  }
  g.sw_on = 1; g.sw_x1 = x1; g.sw_y1 = y1; g.sw_x2 = x2; g.sw_y2 = y2;
  for (let n = 0; n < MAXM; ++n) {
    const t = g.m_type[n];
    if (!t || g.m_hit[n] || faded(n)) continue;
    const w = D.MON_HIT_W[t], h = D.MON_HIT_H[t];
    if (x2 < g.m_x[n] + 2 - w || x1 > g.m_x[n] + 13 + w || y2 < g.m_y[n] + 2 - h || y1 > g.m_y[n] + 13) continue;
    const d = roll_damage();
    hit_monster(n, d, g.pdir, roll_damage.crit);
  }
  for (let n = 0; n < MAXP; ++n) {
    if (!g.pr_t[n]) continue;
    if (x2 < g.pr_x[n] || x1 > g.pr_x[n] + 7 || y2 < g.pr_y[n] || y1 > g.pr_y[n] + 7) continue;
    g.pr_t[n] = 0;
    fx('deflect', { x: g.pr_x[n], y: g.pr_y[n] });
  }
  if (g.boss_on && !g.bhit) {
    if (x2 < g.bx + 3 - g.bhw || x1 > g.bx + 28 + g.bhw) return;
    if (y2 < g.by + 4 - g.bhh || y1 > g.by + 30) return;
    let dmg = roll_damage();
    dmg += (dmg * T.SLAYER) >> 2;
    hit_boss(dmg, roll_damage.crit);
  }
}
// facing: pdx / pdy are -1, 0 or 1 (eight ways); pdir keeps the nearest of the four for
// knockback and the like (left / right win on a diagonal)
const sgn = c => (c === 1 ? 1 : c === 2 ? -1 : 0), code = v => (v > 0 ? 1 : v < 0 ? 2 : 0);
export function face(dx, dy) {
  if (!dx && !dy) return;
  g.pdx = dx; g.pdy = dy;
  g.pdir = dx > 0 ? DIR_RIGHT : dx < 0 ? DIR_LEFT : dy < 0 ? DIR_UP : DIR_DOWN;
}
export const faceDir = dir => face(dir === DIR_RIGHT ? 1 : dir === DIR_LEFT ? -1 : 0, dir === DIR_DOWN ? 1 : dir === DIR_UP ? -1 : 0);
function hero_step(dx, dy) {
  if (dx === 1) { if (!blocked(g.px + 1, g.py)) ++g.px; }
  else if (dx === 2) { if (!blocked(g.px - 1, g.py)) --g.px; }
  if (dy === 1) { if (!blocked(g.px, g.py + 1)) ++g.py; }
  else if (dy === 2) { if (!blocked(g.px, g.py - 1)) --g.py; }
}
function spawn_bolt(x, y, big) {
  for (let k = 0; k < MAXB; ++k) {
    if (g.bo_t[k]) continue;
    g.bo_x[k] = x; g.bo_y[k] = y; g.bo_dir[k] = g.pdir; g.bo_dx[k] = code(g.pdx); g.bo_dy[k] = code(g.pdy);
    g.bo_t[k] = IS_HUNTER() ? 38 + T.LONG * 12 : 44;
    g.bo_pierce[k] = T.FLAMEWAVE + T.PIERCE; g.bo_last[k] = 0; g.bo_big[k] = big; g.bo_bnc[k] = 0;
    fx('bolt', { b: k });
    return;
  }
}
export const ANIM_LEN = 13, ANIM_SHOT = 9;
function cast_start() {
  if (g.shot_pend) cast_bolt();
  g.cast_cd = 16 - T.QCAST - (T.QCAST >> 1);
  g.atk_timer = 8; g.slow_acc = 0; g.anim_t = ANIM_LEN; g.shot_pend = 1;
  fx('caststart');
}
function cast_bolt() {
  g.shot_pend = 0;
  g.bolt_count = (g.bolt_count + 1) & 255;
  const big = T.METEOR && !(g.bolt_count & 3) ? 1 : 0;
  const dx = g.pdx, dy = g.pdy, diag = dx && dy;
  let x = (g.px + 4 + dx * (diag ? 6 : 8)) & 255, y = (g.py + 4 + dy * (diag ? 6 : 8)) & 255;
  // side by side, across the way it flies
  const side = (n, b) => { const q = diag ? Math.round(n * 0.7) : n; spawn_bolt((x - dy * q) & 255, (y + dx * q) & 255, b); };
  if (T.TWIN) { side(-5, big); side(5, 0); } else spawn_bolt(x, y, big);
  if (T.MULTI) { side(-8, 0); side(8, 0); }
  g.rng = (g.rng + g.frame) & 0xFFFF || 1;
  sfx(IS_HUNTER() ? 'shoot' : 'cast');
}
function do_blink(mx, my) {
  if (!(mx | my)) { mx = code(g.pdx); my = code(g.pdy); }
  const ox = g.px, oy = g.py;
  fx('blink', { x: g.px, y: g.py, c: '#9ad8ff', hero: 1 });
  for (let k = 0; k < 48; ++k) hero_step(mx, my);
  fx('blinkto', { x: g.px, y: g.py });
  g.blink_cd = 150 - T.QBLINK * 22;
  g.inv_timer = 20; g.atk_timer = 0;
  sfx('blink');
  if (T.NOVA) {
    const r = 24 + (T.NOVA << 3);
    fx('nova', { x: ox, y: oy, r });
    for (let k = 0; k < MAXM; ++k) {
      if (!g.m_type[k]) continue;
      if (adiff(g.m_x[k], ox) < r && adiff(g.m_y[k], oy) < r) { g.m_frz[k] = 60 + T.NOVA * 45; g.m_kb[k] = 0; }
    }
  }
}
function bolt_hit(b, n) {
  let dmg = roll_damage();
  const crit = roll_damage.crit;
  dmg += (dmg * T.LONG * 5) >> 5;
  if (T.SHATTER && (g.m_frz[n] || g.m_slow[n])) dmg += (dmg * T.SHATTER) >> 2;
  if (T.IGNITE && rnd() < T.IGNITE * 64) g.m_burn[n] = 4;
  if (T.CHILL && rnd() < T.CHILL * 72) g.m_slow[n] = 150;
  g.bo_last[b] = n + 1;
  if (g.bo_big[b]) {
    fx('meteor', { x: g.m_x[n], y: g.m_y[n] });
    sfx('slam');
    for (let k = 0; k < MAXM; ++k) {
      if (k === n || !g.m_type[k]) continue;
      if (adiff(g.m_x[k], g.m_x[n]) < 30 && adiff(g.m_y[k], g.m_y[n]) < 30) hit_monster(k, dmg >> 1, g.bo_dir[b]);
    }
    dmg += dmg >> 1;
  }
  fx('bolthit', { b, x: g.bo_x[b], y: g.bo_y[b] });
  hit_monster(n, dmg, g.bo_dir[b], crit);
  if (g.bo_pierce[b]) --g.bo_pierce[b]; else g.bo_t[b] = 0;
}
function bolt_target(x, y, last) {
  for (let n = 0; n < MAXM; ++n) {
    const t = g.m_type[n];
    if (!t || n === last - 1 || faded(n)) continue;
    const w = D.MON_HIT_W[t], h = D.MON_HIT_H[t];
    const dx = x - g.m_x[n], dy = y - g.m_y[n];
    if (dx >= -5 - w && dx <= 13 + w && dy >= -5 - h && dy <= 13) return n + 1;
  }
  return 0;
}
function update_bolts() {
  const k = IS_HUNTER() ? 4 : 3;
  for (let b = 0; b < MAXB; ++b) {
    if (!g.bo_t[b]) continue;
    --g.bo_t[b];
    // (on a diagonal a step less on each axis: about the same speed)
    const ddx = sgn(g.bo_dx[b]), ddy = sgn(g.bo_dy[b]), kk = ddx && ddy ? k - 1 : k;
    g.bo_x[b] = (g.bo_x[b] + ddx * kk) & 255; g.bo_y[b] = (g.bo_y[b] + ddy * kk) & 255;
    if (g.bo_x[b] < 8 || g.bo_x[b] > 240 || solid(g.bo_x[b] + 4, g.bo_y[b] + 4)) {
      if (g.hz === HZ_CRYSTAL && map_at(g.bo_x[b] + 4, g.bo_y[b] + 4) === T_PILLAR && !g.bo_bnc[b] && g.bo_x[b] >= 8 && g.bo_x[b] <= 240) {
        g.bo_bnc[b] = 1; g.bo_dir[b] ^= 1; g.bo_dx[b] = code(-sgn(g.bo_dx[b])); g.bo_dy[b] = code(-sgn(g.bo_dy[b])); g.bo_last[b] = 0;
        hz_hint(); fx('crystal', { x: g.bo_x[b], y: g.bo_y[b] });
        continue;
      }
      g.bo_t[b] = 0;
      fx('boltwall', { b, x: g.bo_x[b], y: g.bo_y[b] });
      continue;
    }
    const n = bolt_target(g.bo_x[b], g.bo_y[b], g.bo_last[b]);
    if (n) bolt_hit(b, n - 1);
    if (g.bo_t[b] && g.boss_on) {
      if (g.bo_x[b] + 7 < g.bx + 3 - g.bhw || g.bo_x[b] > g.bx + 28 + g.bhw) continue;
      if (g.bo_y[b] + 7 < g.by + 4 - g.bhh || g.bo_y[b] > g.by + 30) continue;
      let dmg = roll_damage();
      const crit = roll_damage.crit;
      dmg += (dmg * T.LONG * 5) >> 5;
      if (g.bo_big[b]) { dmg += dmg >> 1; fx('meteor', { x: g.bx + 8, y: g.by + 8 }); }
      fx('bolthit', { b, x: g.bo_x[b], y: g.bo_y[b] });
      g.bo_t[b] = 0;
      hit_boss(dmg, crit);
    }
  }
}

// ---------------------------------------------------------------- taming and the pet
function try_tame() {
  for (let k = 0; k < MAXM; ++k) {
    if (!g.m_type[k] || !tameable(k)) continue;
    if (adiff(g.m_x[k], g.px) < 26 && adiff(g.m_y[k], g.py) < 26) {
      g.tame_n = k + 1; g.tame_pos = 64; g.tame_hits = 0; g.tame_laps = 0; g.tame_miss = 0;
      set_msg('PRESS TAME IN THE GOLD ZONE', COL_GOLD);
      sfx('blink'); fx('tame');
      return;
    }
  }
  set_msg('WEAKEN A SLIME, BAT OR SPIDER FIRST', COL_WHITE);
  sfx('nope');
}
export const tame_zone = () => TAME_ZONE + (T.WHISPER << 2);
function update_tame(padNew) {
  const n = g.tame_n - 1;
  g.tame_pos += 2;
  let miss = 0;
  if (g.tame_pos >= 128) { g.tame_pos -= 128; if (++g.tame_laps >= 3) miss = 1; }
  if (!miss) {
    if (!(padNew & PAD_A)) return;
    const d = g.tame_pos < 64 ? g.tame_pos : 128 - g.tame_pos;
    if (d > tame_zone()) miss = 1;
  }
  if (!miss) {
    ++g.tame_hits; g.tame_laps = 0; g.tame_pos = 64;
    if (g.tame_hits < 3) { set_msg(`GOOD! ${g.tame_hits} OF 3`, COL_GOLD); sfx('pickup'); fx('tamehit'); return; }
    g.tame_n = 0;
    g.pet_type = g.m_type[n];
    g.pet_x = g.m_x[n]; g.pet_y = g.m_y[n]; g.pet_cd = 30; g.pet_inv = 60;
    pet_revive();
    g.m_type[n] = M_NONE; g.m_frz[n] = 0; g.m_slow[n] = 0; g.m_burn[n] = 0;
    g.xp += g.m_xp[n] << 1;
    fx('tamed', { x: g.m_x[n], y: g.m_y[n] });
    sfx('legend');
    set_msg('TAMED! YOUR PET: ' + D.PET_NAME[g.pet_type], COL_GOLD);
    level_check();
    if (!g.boss_on && !--g.mon_left) room_cleared();
    return;
  }
  g.tame_pos = 64; g.tame_laps = 0;
  if (++g.tame_miss < 3) { set_msg(`MISSED! TRIES LEFT: ${3 - g.tame_miss}`, COL_RED); sfx('nope'); return; }
  g.tame_n = 0;
  g.m_kb[n] = 8; g.m_kdir[n] = g.pdir; g.inv_timer = 30;
  set_msg('IT SLIPPED AWAY! TRY AGAIN', COL_RED);
  sfx('roar');
}
function pet_step(gx, gy) {
  let nx = g.pet_x, ny = g.pet_y;
  if (gx > nx + 1) { ++nx; g.pet_face = 0; } else if (gx + 1 < nx) { --nx; g.pet_face = 1; }
  if (gy > ny + 1) ++ny; else if (gy + 1 < ny) --ny;
  if (g.pet_type === M_BAT) {
    if (nx >= 16 && nx <= 224) g.pet_x = nx;
    if (ny >= PLAY_Y + 8 && ny <= PLAY_Y + 144) g.pet_y = ny;
    return;
  }
  if (!blocked(nx, g.pet_y)) g.pet_x = nx;
  if (!blocked(g.pet_x, ny)) g.pet_y = ny;
}
function pet_hurt(atk) {
  if (g.pet_type === M_SLIME) atk >>= 1;
  const def = Math.floor(total_def() / (FINE * 2));
  const d = atk > def ? atk - def : 1;
  g.pet_inv = 40;
  sfx('hurt'); fx('pethurt', { d });
  if (g.pet_hp > d) { g.pet_hp -= d; return; }
  g.pet_hp = 0; g.pet_down = 1;
  puff(g.pet_x, g.pet_y);
  set_msg('PET DOWN! BACK NEXT FLOOR', COL_RED);
}
function update_pet() {
  if (g.pet_cd) --g.pet_cd;
  if (g.pet_inv) --g.pet_inv;
  if (T.MEND && g.pet_hp < pet_max()) { g.pet_regen += T.MEND; if (g.pet_regen >= 40) { g.pet_regen = 0; ++g.pet_hp; } }
  let best = 0, bd = 255, gx, gy;
  for (let k = 0; k < MAXM; ++k) {
    if (!g.m_type[k] || faded(k)) continue;
    const d = (adiff(g.m_x[k], g.pet_x) >> 1) + (adiff(g.m_y[k], g.pet_y) >> 1);
    if (d < bd) { bd = d; best = k + 1; }
  }
  if (best) { gx = g.m_x[best - 1]; gy = g.m_y[best - 1]; }
  else if (g.boss_on) { best = 0xFF; gx = g.bx + 8; gy = g.by + 8; }
  else { gx = g.px; gy = g.py; }
  let steps = g.pet_type === M_BAT ? 1 + (g.frame & 1) : (g.pet_type === M_SLIME ? (g.frame & 1) : 1);
  if (!best && adiff(gx, g.pet_x) < 20 && adiff(gy, g.pet_y) < 20) steps = 0;
  while (steps--) pet_step(gx, gy);
  if (best && !g.pet_cd && adiff(gx, g.pet_x) < 12 && adiff(gy, g.pet_y) < 12) {
    let dmg = ((g.lvl + 1 + g.eq_val[0]) * (g.pet_type === M_BAT ? 3 : 4)) >> 3;
    dmg += Math.floor(dmg * T.FERO / 5);
    if (!dmg) dmg = 1;
    let dir;
    if (adiff(gx, g.pet_x) > adiff(gy, g.pet_y)) dir = gx > g.pet_x ? DIR_RIGHT : DIR_LEFT;
    else dir = gy > g.pet_y ? DIR_DOWN : DIR_UP;
    g.pet_cd = PET_RATE[g.pet_type] >> T.WRATH;
    if (g.pet_type === M_SPIDER && best !== 0xFF) g.m_slow[best - 1] = 120;
    if (T.KIN && g.hp < g.maxhp && rnd() < T.KIN * 64) ++g.hp;
    sfx('bite'); fx('petbite');
    if (best === 0xFF) { if (g.boss_on) hit_boss(dmg); }
    else if (g.m_type[best - 1]) hit_monster(best - 1, dmg, dir);
  }
  if (g.pet_inv) return;
  for (let k = 0; k < MAXM; ++k) {
    if (!g.m_type[k] || g.m_frz[k] || faded(k)) continue;
    if (adiff(g.m_x[k], g.pet_x) < 12 && adiff(g.m_y[k], g.pet_y) < 12) {
      if (g.pet_type === M_SLIME) { g.m_kb[k] = 8; g.m_kdir[k] = g.m_x[k] > g.pet_x ? DIR_RIGHT : DIR_LEFT; }
      pet_hurt(g.m_atk[k]);
      return;
    }
  }
  if (g.boss_on && g.pet_x + 12 > g.bx + 5 && g.pet_x + 3 < g.bx + 27 && g.pet_y + 14 > g.by + 6 && g.pet_y + 4 < g.by + 30) pet_hurt(g.batk);
}

// ---------------------------------------------------------------- hazards
export function hz_hint() {
  if (g.hz_told || g.hz >= 10) return;
  g.hz_told = 1;
  if (D.HZ_TEXT[g.hz]) set_msg(D.HZ_TEXT[g.hz], COL_GOLD);
}
function hz_player() {
  if (g.hz === HZ_SAND && !g.roll_timer && !(g.frame & 3)) {
    const x = (g.px + 8) & 0xF0;
    let y = (g.py + 12 - PLAY_Y) & 0xF0;
    y += PLAY_Y - 4;
    hero_step(g.px < x ? 1 : (g.px > x ? 2 : 0), g.py < y ? 1 : (g.py > y ? 2 : 0));
    hz_hint();
  }
  if (g.roll_timer || g.inv_timer || !g.hp) return;
  switch (g.hz) {
    case HZ_SPIKES: if (!g.hz_frame) return; break;
    case HZ_LAVA: break;
    case HZ_THORNS:
      if (++g.hz_tick < 30) return;
      g.hz_tick = 0; hz_hint();
      hurt_player((g.hz_atk >> 1) + 1);
      return;
    default: return;
  }
  hz_hint();
  hurt_player(g.hz_atk);
}
function bones_add(n, t) {
  if (t === M_GHOST) return 0;
  for (let k = 0; k < MAXBN; ++k) {
    if (g.bn_t[k]) continue;
    g.bn_t[k] = 160; g.bn_x[k] = g.m_x[n]; g.bn_y[k] = g.m_y[n]; g.bn_type[k] = t;
    hz_hint();
    return 1;
  }
  return 0;
}
function bones_gone(k) { g.bn_t[k] = 0; if (!--g.mon_left) room_cleared(); }
function update_bones() {
  for (let k = 0; k < MAXBN; ++k) {
    if (!g.bn_t[k]) continue;
    const x = g.bn_x[k], y = g.bn_y[k];
    let n = g.px + 13 > x + 2 && g.px + 2 < x + 13 && g.py + 15 > y + 4 && g.py + 4 < y + 15;
    if (!n && g.sw_on) n = g.sw_x2 >= x + 2 && g.sw_x1 <= x + 13 && g.sw_y2 >= y + 4 && g.sw_y1 <= y + 15;
    for (let b = 0; !n && b < MAXB; ++b) {
      if (!g.bo_t[b]) continue;
      if (g.bo_x[b] + 7 >= x + 2 && g.bo_x[b] <= x + 13 && g.bo_y[b] + 7 >= y + 4 && g.bo_y[b] <= y + 15) { n = true; if (!g.bo_pierce[b]) g.bo_t[b] = 0; }
    }
    if (n) { puff(x, y, '#e6dccb'); fx('bonesmash', { x, y }); sfx('hit'); bones_gone(k); continue; }
    if (--g.bn_t[k]) continue;
    let s;
    for (s = 0; s < MAXM && g.m_type[s]; ++s) { }
    if (s === MAXM) { bones_gone(k); continue; }
    set_monster(s, g.bn_type[k], x, y);
    g.m_hp[s] = (g.m_mhp[s] >> 1) + 1; g.m_xp[s] >>= 1; g.m_risen[s] = 1; g.m_flash[s] = 20;
    puff(x, y, '#e6dccb'); fx('rise', { n: s });
    sfx('roar');
  }
}
function update_storm() {
  if (g.st_t) --g.st_t;
  if (g.st_t) return;
  switch (g.st_phase) {
    case 0:
      if (!g.mon_left) return;
      g.st_phase = 1; g.st_t = 70; g.st_x = (g.px + 8) & 255; g.st_y = (g.py + 12) & 255;
      hz_hint();
      break;
    case 1: {
      g.st_phase = 2; g.st_t = 8;
      fx('lightning', { x: g.st_x, y: g.st_y }); sfx('slam');
      if (!g.roll_timer && !g.inv_timer && g.hp && ((g.px + 8 - g.st_x + 13) & 255) <= 26 && ((g.py + 12 - g.st_y + 10) & 255) <= 20)
        hurt_player(g.hz_atk + (g.hz_atk >> 1));
      const d = g.hz_atk << 1;
      for (let n = 0; n < MAXM; ++n) {
        if (!g.m_type[n]) continue;
        if (((g.m_x[n] + 8 - g.st_x + 14) & 255) > 28 || ((g.m_y[n] + 12 - g.st_y + 12) & 255) > 24) continue;
        if (g.m_hp[n] <= d) kill_monster(n); else { g.m_hp[n] -= d; g.m_flash[n] = 14; }
      }
      break;
    }
    default: g.st_phase = 0; g.st_t = 90 + (rnd() & 127);
  }
}
const HZ_ANIM_SHIFT = [0, 5, 5, 4, 0, 3, 0, 0, 5, 0];
function update_hazards() {
  g.hz_t = (g.hz_t + 1) & 255;
  if (HZ_PATCHES[g.hz]) g.hz_frame = g.hz === HZ_SPIKES ? ((g.hz_t & 127) >= 96 ? 1 : 0) : (g.hz_t >> HZ_ANIM_SHIFT[g.hz]) & 1;
  switch (g.hz) {
    case HZ_BONES: update_bones(); break;
    case HZ_STORM: update_storm(); break;
    case HZ_BLOOD:
      if (g.hz_t & 15) break;
      for (let n = 0; n < MAXM; ++n) {
        if (!g.m_type[n] || g.m_hp[n] >= g.m_mhp[n]) continue;
        if (map_at(g.m_x[n] + 8, g.m_y[n] + 12) !== T_HAZARD) continue;
        g.m_hp[n] = Math.min(g.m_mhp[n], g.m_hp[n] + (g.m_mhp[n] >> 4) + 1);
        fx('heal', { n });
        hz_hint();
      }
      break;
  }
}

// ---------------------------------------------------------------- elites
export function make_elite(n, e) {
  g.m_elite[n] = e;
  g.any_elite = 1;
  let v = g.m_mhp[n] << 1;
  if (e === EL_ARMORED) v += v >> 2;
  g.m_mhp[n] = v; g.m_hp[n] = v;
  v = g.m_xp[n] * 3;
  g.m_xp[n] = v > 255 ? 255 : v;
  if (e === EL_FRENZIED) { v = g.m_atk[n] + (g.m_atk[n] >> 2); g.m_atk[n] = v > 250 ? 250 : v; }
  g.elite_said = n + 1;
  fx('elite', { n });
}
function split_monster(n, t) {
  const x = g.m_x[n], y = g.m_y[n];
  let c = 0;
  for (let k = 0; k < 2; ++k) {
    let s;
    for (s = 0; s < MAXM && g.m_type[s]; ++s) { }
    if (s === MAXM) break;
    set_monster(s, t, x, y);
    g.m_mhp[s] >>= 1; g.m_hp[s] = g.m_mhp[s]; g.m_xp[s] >>= 1;
    g.m_kb[s] = 8; g.m_kdir[s] = k ? DIR_RIGHT : DIR_LEFT; g.m_flash[s] = 10;
    ++c;
  }
  if (!c) return 0;
  g.mon_left += c - 1;
  fx('split', { x, y });
  return 1;
}

// ---------------------------------------------------------------- special rooms
function obj_add(x, y, t) {
  if (g.nobj >= MAXOBJ) return;
  g.ob_k[g.nobj] = (y << 4) + x;
  g.ob_t[g.nobj] = t;
  ++g.nobj;
  if (t < OBJ_CRACK || t >= OBJ_ALCH_L) g.map[(y << 4) + x] = T_OBJ;
  else if (t === OBJ_CRACK) g.map[(y << 4) + x] = T_CRACK;
}
function special_room() {
  switch (g.sp) {
    case SP_TREASURE:
      obj_add(6, 5, OBJ_CHEST); obj_add(10, 5, OBJ_CHEST);
      if (DEPTH() >= 10) obj_add(8, 3, OBJ_CHEST);
      if (DEPTH() >= 4 && rnd() < 86) g.mimic_chest = 1 + rnd() % g.nobj;
      return;
    case SP_SHRINE: case SP_FOUNTAIN:
      g.map[(3 << 4) + 6] = T_PILLAR; g.map[(3 << 4) + 10] = T_PILLAR;
      g.map[(7 << 4) + 6] = T_PILLAR; g.map[(7 << 4) + 10] = T_PILLAR;
      obj_add(8, 5, g.sp === SP_SHRINE ? OBJ_SHRINE : OBJ_FOUNTAIN);
      break;
    default:
      g.arena_left = 2;
  }
  if (g.hz < 10 && HZ_PATCHES[g.hz]) place_hazards();
}
function trap_room() {
  for (let k = 0; k < 3; ++k) {
    const x = 3 + k * 4 + (rnd() & 1);
    if (g.map[x - 1] === T_WALL && g.map[x] === T_WALL && g.map[x + 1] === T_WALL) obj_add(x, 0, OBJ_LAUNCHER);
  }
  if (g.hz < 10 && HZ_PATCHES[g.hz]) place_hazards();
}
function secret_crack() {
  for (let k = 0; k < 20; ++k) {
    const x = 2 + rnd() % 12, y = 2 + rnd() % 7, c = (y << 4) + x;
    if (g.map[c] === T_PILLAR || g.map[c] === T_WALL) { obj_add(x, y, OBJ_CRACK); return; }
  }
}
function drop_gold(x, y, v) {
  for (let k = 0; k < MAXI; ++k) {
    if (g.i_kind[k]) continue;
    g.i_kind[k] = K_GOLD; g.i_val[k] = v & 255; g.i_x[k] = x; g.i_y[k] = y; g.i_rar[k] = 0;
    fx('drop', { s: k });
    return;
  }
}
function mimic_type() {
  for (let k = 0; k < g.nroster; ++k) {
    const t = g.roster[k];
    if (t !== M_GHOST && t !== M_BAT && t !== M_VBAT && t !== M_WISP && t !== M_WRAITH) return t;
  }
  return M_SPIDER;
}
function obj_use(k, cx, cy) {
  const c = g.ob_k[k];
  switch (g.ob_t[k]) {
    case OBJ_CHEST:
      if (g.mimic_chest === k + 1) {
        g.mimic_chest = 0; g.ob_t[k] = OBJ_GONE; g.map[c] = T_FLOOR;
        fx('obj', { k });
        let n;
        for (n = 0; n < MAXM && g.m_type[n]; ++n) { }
        if (n < MAXM) {
          set_monster(n, mimic_type(), cx, cy);
          make_elite(n, 1 + (rnd() & 3));
          g.m_flash[n] = 8; g.inv_timer = 30; g.mimic_n = n + 1; ++g.mon_left;
        }
        set_msg('A MIMIC! THE CHEST BITES!', COL_RED);
        sfx('roar'); fx('mimic', { x: cx, y: cy });
        return;
      }
      g.ob_t[k] = OBJ_CHEST_OPEN; fx('obj', { k });
      drop_gear(cx + 4, cy + 20, 1);
      drop_gold(cx + 4, cy - 12, 5 + DEPTH());
      set_msg('TREASURE!', COL_GOLD);
      sfx('rare');
      return;
    case OBJ_SHRINE: {
      let cost = Math.floor(g.gold / 5);
      if (cost < 10) cost = 10;
      if (g.gold < cost) {
        if (g.sp_told) return;
        g.sp_told = 1;
        set_msg('THE SHRINE ASKS FOR 10 GOLD', COL_WHITE);
        return;
      }
      g.gold -= cost;
      g.ob_t[k] = OBJ_SHRINE_USED; fx('obj', { k });
      switch (rnd() % 3) {
        case 0: g.bless_atk = 2 + Math.floor(DEPTH() / 4); set_msg('BLESSING OF MIGHT: ATK +' + g.bless_atk, COL_GOLD); break;
        case 1: g.bless_def = 2 + Math.floor(DEPTH() / 5); set_msg('BLESSING OF WARDING: DEF +' + g.bless_def, COL_GOLD); break;
        default: g.bless_regen = 4; g.hp = Math.min(g.maxhp, g.hp + (g.maxhp >> 2)); set_msg('BLESSING OF VIGOR: REGEN', COL_GOLD);
      }
      sfx('legend'); fx('bless');
      return;
    }
    case OBJ_FOUNTAIN:
      g.hp = g.maxhp;
      if (g.potions < MAXPOT) ++g.potions;
      g.ob_t[k] = OBJ_FOUNTAIN_DRY; fx('obj', { k });
      set_msg('THE FOUNTAIN RESTORES YOU', COL_GOLD);
      sfx('drink'); fx('drink', { v: g.maxhp });
  }
}
function crack_break(k, cx, cy) {
  const c = g.ob_k[k];
  g.ob_t[k] = OBJ_GONE; g.map[c] = T_FLOOR;
  fx('obj', { k }); fx('crack', { x: cx, y: cy });
  sfx('slam');
  if (rnd() < 96) drop_gear(cx + 4, cy + 4, 1);
  else drop_gold(cx + 4, cy + 4, 10 + (DEPTH() << 1));
  set_msg('A SECRET! THE WALL GIVES WAY', COL_GOLD);
}
function update_specials() {
  for (let k = 0; k < g.nobj; ++k) {
    const cx = (g.ob_k[k] & 15) << 4, cy = PLAY_Y + ((g.ob_k[k] >> 4) << 4);
    switch (g.ob_t[k]) {
      case OBJ_CHEST: case OBJ_SHRINE: case OBJ_FOUNTAIN:
        if (((g.px - cx + 20) & 255) > 40 || ((g.py - cy + 20) & 255) > 40) { if (g.ob_t[k] === OBJ_SHRINE) g.sp_told = 0; break; }
        obj_use(k, cx, cy);
        break;
      case OBJ_CRACK: {
        let hit = g.sw_on && g.sw_x2 >= cx && g.sw_x1 <= cx + 15 && g.sw_y2 >= cy && g.sw_y1 <= cy + 15;
        for (let b = 0; !hit && b < MAXB; ++b) {
          if (!g.bo_t[b]) continue;
          if (g.bo_x[b] + 7 >= cx && g.bo_x[b] <= cx + 15 && g.bo_y[b] + 7 >= cy && g.bo_y[b] <= cy + 15) { hit = true; g.bo_t[b] = 0; }
        }
        if (hit) crack_break(k, cx, cy);
        break;
      }
      case OBJ_LAUNCHER:
        if (g.mon_left && !(((g.frame + (k << 5)) & 255) & 127)) { fire(cx + 4, PLAY_Y + 14, 0, 3, g.hz_atk, 2); fx('launch', { k }); }
        break;
    }
  }
}
function room_cleared() {
  if (g.door_open) return;
  if (g.arena_left) {
    --g.arena_left;
    spawn_monsters();
    g.inv_timer = 60;
    set_msg(`WAVE ${3 - g.arena_left} OF 3!`, COL_RED);
    sfx('roar'); fx('wave');
    return;
  }
  if (g.sp === SP_ARENA) drop_gear(120, PLAY_Y + 76, 2);
  open_door();
}

// ---------------------------------------------------------------- the hero each step
function update_player(pad, padNew) {
  let moved = 0, mx = 0, my = 0, k;
  g.hz_here = g.hz_tiled && map_at(g.px + 8, g.py + 12) === T_HAZARD ? 1 : 0;
  if (g.roll_cd) --g.roll_cd;
  if (g.blink_cd) --g.blink_cd;
  if (g.cast_cd) --g.cast_cd;
  if (g.anim_t) { --g.anim_t; if (g.shot_pend && g.anim_t <= ANIM_SHOT) cast_bolt(); }
  if (g.roll_timer) {
    --g.roll_timer;
    k = 2 + (g.frame & 1);
    while (k--) hero_step(g.roll_dx, g.roll_dy);
    moved = 1;
    if (T.CHARGE) {
      for (k = 0; k < MAXM; ++k) {
        const t = g.m_type[k];
        if (!t || g.m_hit[k]) continue;
        if (g.px + 14 > g.m_x[k] + 2 - D.MON_HIT_W[t] && g.px + 2 < g.m_x[k] + 14 + D.MON_HIT_W[t] && g.py + 14 > g.m_y[k] + 2 - D.MON_HIT_H[t] && g.py + 2 < g.m_y[k] + 14)
          hit_monster(k, ((g.lvl + 1 + g.eq_val[0]) * T.CHARGE) >> 1, g.pdir);
      }
    }
  } else {
    let spd = 1;
    k = spd_fine();
    if (k) { g.sacc += (k * 10) >> 3; if (g.sacc >= 128) { g.sacc -= 128; spd = 2; } }
    if (g.atk_timer) {
      --g.atk_timer;
      if (g.atk_timer > 3 && g.atk_timer < 13 && IS_WARRIOR()) sword_hits();
      g.slow_acc += 3;
      if (g.slow_acc >= 5) g.slow_acc -= 5; else spd = 0;
    }
    if (g.hz_here) {
      if (g.hz === HZ_THORNS) { if (g.frame & 1) spd = 0; }
      else if (g.hz === HZ_SAND) { if (++g.hz_acc >= 3) g.hz_acc = 0; else spd = 0; }
    }
    if (pad & PAD_LEFT) mx = 2; else if (pad & PAD_RIGHT) mx = 1;
    if (pad & PAD_UP) my = 2; else if (pad & PAD_DOWN) my = 1;
    if (!g.atk_timer) face(sgn(mx), sgn(my));
    if (mx && my && spd) { g.dacc += 181; if (g.dacc >= 256) g.dacc -= 256; else --spd; } // (a diagonal is no faster than straight)
    if (mx | my) { moved = 1; for (k = 0; k < spd; ++k) hero_step(mx, my); }
    if (g.hz === HZ_ICE) {
      if (!g.hz_here) { g.ice_dx = 0; g.ice_dy = 0; }
      if (mx | my) { g.ice_dx = mx; g.ice_dy = my; }
      else if (g.hz_here && (g.ice_dx | g.ice_dy)) { hero_step(g.ice_dx, g.ice_dy); hero_step(g.ice_dx, g.ice_dy); moved = 1; hz_hint(); }
    }
    if ((padNew & PAD_A) && IS_MAGE()) {
      if (!g.blink_cd) do_blink(mx, my); else sfx('nope');
    } else if ((padNew & PAD_A) && IS_HUNTER() && !g.pet_type) {
      try_tame();
    } else if ((padNew & PAD_B) && !IS_WARRIOR()) {
      if (!g.cast_cd) cast_start();
    } else if ((padNew & PAD_A) && !g.roll_cd) {
      if (!(mx | my)) { mx = code(g.pdx); my = code(g.pdy); }
      g.roll_dx = mx; g.roll_dy = my; g.roll_timer = 16;
      g.roll_cd = g.eq_spec[3] === SP_QUICK ? 20 : 40;
      for (k = 0; k < MAXM; ++k) g.m_hit[k] = 0;
      g.atk_timer = 0;
      sfx('roll'); fx('roll');
    } else if ((padNew & PAD_B) && !g.atk_timer && IS_WARRIOR()) {
      g.atk_timer = 14; g.slow_acc = 0;
      g.rng = (g.rng + g.frame) & 0xFFFF || 1;
      for (let i = 0; i < MAXM; ++i) g.m_hit[i] = 0;
      g.bhit = 0;
      sfx('swing'); fx('swing');
    }
  }
  g.moving = moved;
  if (moved) { if (++g.panim >= 8) { g.panim = 0; g.pstep = (g.pstep + 1) & 3; } }
  if (g.inv_timer) --g.inv_timer;
  if (g.hz_here) hz_player();
  const s = (g.eq_spec[1] === SP_REGEN ? 2 : 0) + (g.eq_spec[5] === SP_REGEN ? 2 : 0) + T.WIND + T.MIND + g.bless_regen;
  if (s && g.hp && g.hp < g.maxhp) { g.regen_timer += s; if (g.regen_timer >= 180) { g.regen_timer = 0; ++g.hp; } }
  // loot pickup
  for (let i = 0; i < MAXI; ++i) {
    if (!g.i_kind[i]) continue;
    if (g.px + 13 > g.i_x[i] && g.px + 2 < g.i_x[i] + 8 && g.py + 15 > g.i_y[i] && g.py + 4 < g.i_y[i] + 8) {
      if (g.full_item === i + 1) continue;
      if (!pickup(i)) g.full_item = i + 1;
    } else if (g.full_item === i + 1) g.full_item = 0;
  }
  // walk into the open door / stairs
  if (g.door_open) {
    const x1 = (g.door_pos & 15) << 4, y1 = PLAY_Y + ((g.door_pos >> 4) << 4);
    let go = false;
    switch (g.door_wall) {
      case DW_RIGHT: go = g.px >= 226 && g.py + 8 >= y1 && g.py <= y1 + 8; break;
      case DW_TOP: {
        const c = (g.px + 8) >> 4;
        go = g.py <= PLAY_Y + 11 && (c === (g.door_pos & 15) || g.map[c] === T_DOORWAY);
        if (go) g.boss_tier = c === BDOOR_EASY ? 0 : ((c === BDOOR_HARD && g.map[BDOOR_EASY] === T_DOORWAY) ? 2 : 1);
        break;
      }
      default: go = g.py >= PLAY_Y + 143 && g.px + 8 >= x1 && g.px <= x1 + 8;
    }
    if (go) {
      if (g.room_num === BOSS_ROOM) next_floor(); else next_room();
    }
  }
}

// ---------------------------------------------------------------- floors and rooms
export function pick_roster() {
  let k = 0;
  const DP = DEPTH();
  for (let s = 1; s <= NMON; ++s) if (DP >= D.MON_UNLOCK[s]) k = s;
  // the newest monster always; up to two older ones join it (as the SNES game's monster sets)
  const r = [k];
  if (k >= 2) {
    const older = [];
    for (let s = 1; s < k; ++s) older.push(s);
    while (r.length < 3 && older.length) r.push(older.splice(rnd() % older.length, 1)[0]);
  }
  g.nroster = r.length;
  for (let i = 0; i < 3; ++i) g.roster[i] = r[i] || 0;
}
function boss_doors() {
  if (g.room_num !== BOSS_ROOM - 1 || g.floor_num === LAST_FLOOR) return;
  g.map[g.door_pos] = T_WALL;
  g.door_wall = DW_TOP;
  g.door_pos = BDOOR_MED;
  g.map[BDOOR_EASY] = T_DOOR; g.map[BDOOR_MED] = T_DOOR; g.map[BDOOR_HARD] = T_DOOR;
}
function boss_doors_open() {
  if (g.map[BDOOR_EASY] !== T_DOOR) return;
  g.map[BDOOR_EASY] = T_DOORWAY; g.map[BDOOR_HARD] = T_DOORWAY;
  set_msg('PICK A BOSS: EASY - MEDIUM - HARD', COL_GOLD);
}
export function setup_floor() {
  const f = g.floor_num;
  g.theme = ((f - 1) + Math.floor((f - 1) / 10) * 3) % 10;
  g.fmod = f === 1 ? FM_CALM : (f * 5 + 3) % 6;
  pick_roster();
  g.room_num = 1;
  g.hz_told = 0;
  g.sp_room = f > 1 ? 2 + rnd() % 3 : 0;
  g.sp_kind = 1 + rnd() % 5;
  g.bless_atk = 0; g.bless_def = 0; g.bless_regen = 0;
}
export function start_room() {
  for (let i = 0; i < MAXI; ++i) g.i_kind[i] = K_NONE;
  for (let i = 0; i < MAXP; ++i) g.pr_t[i] = 0;
  for (let i = 0; i < MAXB; ++i) g.bo_t[i] = 0;
  for (let i = 0; i < MAXM; ++i) { g.m_frz[i] = 0; g.m_slow[i] = 0; g.m_burn[i] = 0; g.m_type[i] = 0; }
  g.full_item = 0; g.last_stand_used = 0; g.tame_n = 0;
  g.hz = (g.floor_num > 1 && g.room_num !== BOSS_ROOM) ? g.theme : HZ_NONE;
  g.hz_tiled = g.hz < 10 && HZ_PATCHES[g.hz] ? 1 : 0;
  const DP = DEPTH();
  g.hz_atk = (3 + DP + Math.floor(DP / 3)) & 255;
  g.hz_t = 0; g.hz_tick = 0; g.hz_acc = 0; g.ice_dx = 0; g.ice_dy = 0; g.sw_on = 0; g.hz_frame = 0;
  g.sp = g.room_num === g.sp_room ? g.sp_kind : 0;
  g.sp_told = 0; g.mimic_n = 0; g.arena_left = 0; g.elite_said = 0; g.any_elite = 0;
  g.st_phase = 0; g.st_t = 120;
  for (let i = 0; i < MAXBN; ++i) g.bn_t[i] = 0;
  gen_room();
  boss_doors();
  g.boss_on = 0; g.vend_state = 0; g.roll_timer = 0; g.roll_cd = 0;
  if (g.room_num === BOSS_ROOM) {
    spawn_boss();
    if (g.floor_num === LAST_FLOOR) {
      for (let i = 0; i < 2; ++i) { g.map[(2 << 4) + ALCH_X + i] = T_FLOOR; g.map[(3 << 4) + ALCH_X + i] = T_FLOOR; }
      obj_add(ALCH_X, 1, OBJ_ALCH_L);
      obj_add(ALCH_X + 1, 1, OBJ_ALCH_R);
    }
  } else {
    spawn_monsters();
    if (g.sp === SP_TREASURE) {
      for (let i = 0; i < MAXM; ++i) g.m_type[i] = M_NONE;
      g.mon_left = 0; g.elite_said = 0; g.any_elite = 0;
      g.map[g.door_pos] = T_DOORWAY;
      g.door_open = 1;
    }
  }
  g.px = 16; g.py = PLAY_Y + 5 * 16; g.pdir = DIR_RIGHT; g.pdx = 1; g.pdy = 0;
  g.pet_x = 16; g.pet_y = PLAY_Y + 6 * 16; g.pet_cd = 30; g.pet_inv = 0;
  g.atk_timer = 0; g.anim_t = 0; g.shot_pend = 0; g.inv_timer = 60;
  if (g.floor_num > g.deepest) g.deepest = g.floor_num;
  if (g.boss_on) {
    if (g.bintro) set_msg('KING: SHE IS MINE! TURN BACK!', COL_RED, 0);
    else set_msg(boss_name(), COL_RED, 160);
    sfx('roar');
  } else {
    let s;
    if (g.room_num === 1) s = D.THEME_NAME[g.theme] + ' - ' + D.MOD_NAME[g.fmod];
    else if (g.sp) s = D.SP_TEXT[g.sp];
    else s = `ROOM ${g.room_num} OF 5`;
    if (g.elite_said) s = 'ELITE: ' + D.ELITE_NAME[g.m_elite[g.elite_said - 1]] + ' ' + D.MON_NAME[g.m_type[g.elite_said - 1]];
    set_msg(s, COL_WHITE);
  }
  g.state = 'play';
  save_game();
  fx('room');
}
function next_room() { ++g.room_num; start_room(); }
function next_floor() {
  ++g.floor_num;
  g.hp = Math.min(g.maxhp, g.hp + (g.maxhp >> 3));
  if (g.pet_type) pet_revive();
  setup_floor();
  start_room();
  fx('floor');
}
export function new_hero(cls) {
  g.player_class = cls;
  g.lvl = 1; g.xp = 0; g.xpnext = 12;
  g.maxhp = cls === 0 ? 20 : (cls === 1 ? 15 : 18);
  g.hp = g.maxhp; g.str = 2; g.gold = 0; g.kills = 0;
  for (let i = 0; i < NGEAR; ++i) { g.eq_val[i] = 0; g.eq_rar[i] = 0; g.eq_spec[i] = 0; g.eq_tier[i] = 0; g.eq_has[i] = 0; g.eq_lvl[i] = 0; }
  g.eq_st.fill(0); g.b_st.fill(0); g.hpgear = 0;
  equip(K_WEAPON, 0, 0, 1, SP_NONE, 1);
  equip(K_ARMOR, 0, 0, 0, SP_NONE, 1);
  for (let i = 0; i < BAG; ++i) g.b_kind[i] = K_NONE;
  for (let i = 0; i < NTAL; ++i) g.tal[i] = 0;
  tal_sync();
  g.blink_cd = 0; g.pet_type = 0; g.pet_down = 0; g.potions = 1;
  g.floor_num = 1; g.deepest = 1; g.brole = 0; g.boss_tier = 1;
  setup_floor();
}
// after death: room 1 of the floor, half the gold
export function respawn() {
  g.room_num = 1;
  g.hp = g.maxhp;
  if (g.pet_type) pet_revive();
  g.gold >>= 1;
  start_room();
}
function rescue_start() {
  g.wx = (BDOOR_MED & 15) << 4; g.wy = PLAY_Y + 8; g.wface = 0; g.rescue_t = 0; g.inv_timer = 0;
  set_msg('YOU FOUND HER!', COL_GOLD, 0);
  fx('rescue');
}
function update_rescue() {
  const tx = g.px > 200 ? g.px - 18 : g.px + 18, ty = g.py;
  let moving = 0;
  if (!(g.frame & 1)) {
    if (g.wx < tx) { ++g.wx; moving = 1; g.wface = 0; } else if (g.wx > tx) { --g.wx; moving = 1; g.wface = 1; }
    if (g.wy < ty) { ++g.wy; moving |= 2; } else if (g.wy > ty) { --g.wy; moving |= 2; }
  }
  g.wmoving = moving;
  if (!moving && g.wx === tx && g.wy === ty) {
    if (++g.rescue_t > 100) { g.state = 'win'; sfx('legend'); fx('win'); }
  }
}

// ---------------------------------------------------------------- one step (1/60 s)
export function tick(pad = 0, padNew = 0) {
  g.frame = (g.frame + 1) & 255;
  if (g.msg_t && !--g.msg_t) g.msg = '';
  if (g.state === 'rescue') { update_rescue(); return; }
  if (g.state !== 'play') return;
  if (g.boss_on && (g.bform === BF_DRINK || g.bform === BF_TF)) padNew &= ~(PAD_A | PAD_B | PAD_START);
  if (g.tame_n) { update_tame(padNew); return; }
  if (padNew & PAD_SELECT) drink_potion();
  update_player(pad, padNew);
  if (g.state !== 'play') return;
  update_monsters();
  update_monsters_ex();
  if (g.pet_type && !g.pet_down) update_pet();
  update_projectiles();
  update_bolts();
  if (g.hz < 10) update_hazards();
  if (g.nobj) update_specials();
  g.sw_on = 0;
  update_boss();
  update_vendor();
  if (g.state !== 'play') return;
  if (!g.hp) { g.state = 'dead'; sfx('death'); fx('dead'); save_game(); }
}

// ---------------------------------------------------------------- saving (the browser's storage)
export const SAVE_KEY = 'dungeonheart.save.v1';
const SAVE_FIELDS = ['lvl', 'xp', 'xpnext', 'hp', 'maxhp', 'hpgear', 'str', 'gold', 'kills', 'floor_num', 'deepest', 'player_class',
  'potions', 'pet_type', 'brole'];
const SAVE_ARRAYS = ['eq_val', 'eq_rar', 'eq_spec', 'eq_tier', 'eq_has', 'eq_lvl', 'b_kind', 'b_rar', 'b_tier', 'b_val', 'b_spec', 'b_lvl', 'tal', 'eq_st', 'b_st'];
export const storage = { get: () => null, set: () => { } }; // (main.js plugs in localStorage)
export function save_data() {
  const o = { v: 1 };
  for (const k of SAVE_FIELDS) o[k] = g[k];
  for (const k of SAVE_ARRAYS) o[k] = Array.from(g[k]);
  return o;
}
export function save_game() { try { storage.set(JSON.stringify(save_data())); } catch (e) { } }
export function has_save() { try { const s = storage.get(); return !!(s && JSON.parse(s).v); } catch (e) { return false; } }
export function load_game() {
  let o;
  try { o = JSON.parse(storage.get()); } catch (e) { return false; }
  if (!o || !o.v) return false;
  g.eq_st.fill(0); g.b_st.fill(0); g.hpgear = 0; // (older saves have no gear stats)
  for (const k of SAVE_FIELDS) if (k in o) g[k] = o[k];
  for (const k of SAVE_ARRAYS) if (o[k]) g[k].set(o[k].slice(0, g[k].length));
  g.str = 2 + ((g.lvl - 1) >> 1);
  g.pet_down = 0;
  tal_sync(); sta_sync();
  if (g.pet_type) pet_revive();
  g.hp = g.maxhp;
  setup_floor();
  start_room();
  return true;
}
export function seed(n) { g.rng = (n & 0xFFFF) || 1; }
