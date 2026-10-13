// node tests/dgmech.mjs: each dungeon mechanic, played through the rules (sim.js) step by step
import * as S from '../src/sim.js';
import * as DG from '../src/dungeon.js';
import * as D from '../src/data.js';
const G = S.G;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const step = (n, pad = 0, padNew = 0) => { for (let i = 0; i < n; i++) { S.tick(pad, i === 0 ? padNew : 0); G.ev.length = 0; G.inv_timer = Math.min(G.inv_timer, 2); G.hp = G.maxhp; } };
const kill = () => { for (let n = 0; n < D.MAXM; n++) if (G.m_type[n]) { G.m_hp[n] = 1; } };
const killAll = () => { for (let i = 0; i < 400 && G.mon_left; i++) { for (let n = 0; n < D.MAXM; n++) if (G.m_type[n]) { G.px = G.m_x[n] - 14; G.py = G.m_y[n]; S.faceDir(D.DIR_RIGHT); G.m_hp[n] = 1; G.swing_cd = 0; G.atk_timer = 0; break; } step(1, S.PAD_B, S.PAD_B); step(20); } };
const room = () => G.dg.rooms[G.dg_room];
const goTo = id => S.dg_enter(id, -1);
const findRoom = f => G.dg.rooms.find(f);

S.new_hero(0);
S.dg_start('TEST1');
ok(G.mode === 'dungeon' && room().kind === DG.R_START, 'starts in the entrance');
ok(G.dg_dk.some(k => k === D.DK_OPEN), 'the entrance has an open door');
// walk through the first open door
{
  const r = room(), d = [0, 1, 2, 3].find(i => G.dg_dk[i] === D.DK_OPEN);
  const to = r.doors[d].to;
  const pads = [S.PAD_UP, S.PAD_RIGHT, S.PAD_DOWN, S.PAD_LEFT];
  const pos = [[112, D.PLAY_Y + 30], [200, D.PLAY_Y + 80], [112, D.PLAY_Y + 130], [30, D.PLAY_Y + 80]];
  G.px = pos[d][0] + 5; G.py = pos[d][1]; // (a little off the door's line: the nudge lines you up)
  let moved = false;
  for (let i = 0; i < 200 && !moved; i++) { step(1, pads[d]); moved = G.dg_room === to; }
  ok(moved, `walked through the ${'NESW'[d]} door into room ${to}`);
  // you arrive just inside the matching door of the new room (walk north: at its south door)
  const near = [[112, D.PLAY_Y + 16], [224, D.PLAY_Y + 80], [112, D.PLAY_Y + 144], [16, D.PLAY_Y + 80]][DG.OPP[d]];
  ok(Math.abs(G.px - near[0]) <= 4 && Math.abs(G.py - near[1]) <= 4, `arrived by the ${'NESW'[DG.OPP[d]]} door (at ${G.px},${G.py})`);
  ok(G.dg_flags[to] & 1, 'the new room is marked seen (for the map)');
}
// a small key opens a locked door
{
  const lockRoom = G.dg.rooms.find(r => r.doors.some(e => e && e.kind === DG.E_KEY) && r.zone === 0);
  goTo(lockRoom.id); kill(); killAll();
  const d = lockRoom.doors.findIndex(e => e && e.kind === DG.E_KEY);
  ok(G.dg_dk[d] === D.DK_LOCK, 'the locked door shows locked');
  const pads = [S.PAD_UP, S.PAD_RIGHT, S.PAD_DOWN, S.PAD_LEFT];
  const pos = [[112, D.PLAY_Y + 18], [220, D.PLAY_Y + 80], [112, D.PLAY_Y + 142], [18, D.PLAY_Y + 80]];
  G.dg_keys = 0; G.px = pos[d][0]; G.py = pos[d][1]; step(10, pads[d]);
  ok(G.dg_dk[d] === D.DK_LOCK && /SMALL KEY/.test(G.msg), 'no key: it stays locked and says so');
  G.dg_keys = 1; G.px = pos[d][0]; G.py = pos[d][1]; step(10, pads[d]);
  ok(G.dg_dk[d] === D.DK_OPEN && G.dg_keys === 0, 'with a key it opens and the key is spent');
  const other = lockRoom.doors[d].to;
  goTo(other); killAll();
  ok(G.dg_flags[other] & (16 << DG.OPP[d]) && G.dg_dk[DG.OPP[d]] !== D.DK_LOCK, 'and it stays unlocked from the other side');
}
// chests give the room's treasure
{
  const kr = findRoom(r => r.content === DG.C_BOMBS);
  goTo(kr.id); killAll();
  const k = [...Array(G.nobj).keys()].find(i => G.ob_t[i] === D.OBJ_CHEST || G.ob_t[i] === D.OBJ_BIGCHEST);
  ok(k !== undefined, 'the bombs room has a chest');
  const c = G.ob_k[k]; G.px = (c & 15) * 16; G.py = D.PLAY_Y + (c >> 4) * 16 + 18; step(3);
  ok(G.dg_items & DG.I_BOMBS && G.dg_bombs >= 10 && G.dg_item === DG.I_BOMBS, 'opening it gives the bombs (and selects them)');
  goTo(kr.id);
  ok([...Array(G.nobj).keys()].some(i => G.ob_t[i] === D.OBJ_CHEST_OPEN), 'the chest stays open on a second visit');
}
// a bomb opens a cracked wall
{
  const br = findRoom(r => r.doors.some(e => e && e.kind === DG.E_BOMB) && !r.optional && r.kind !== DG.R_HIDDEN);
  goTo(br.id); killAll();
  const d = br.doors.findIndex(e => e && e.kind === DG.E_BOMB);
  ok(G.dg_dk[d] === D.DK_CRACK, 'the cracked wall shows as cracked');
  // sword hits don't open it
  const pos = [[112, D.PLAY_Y + 18], [220, D.PLAY_Y + 80], [112, D.PLAY_Y + 142], [18, D.PLAY_Y + 80]];
  const dirs = [D.DIR_UP, D.DIR_RIGHT, D.DIR_DOWN, D.DIR_LEFT];
  G.px = pos[d][0]; G.py = pos[d][1]; S.faceDir(dirs[d]); G.swing_cd = 0; step(1, S.PAD_B, S.PAD_B); step(30);
  ok(G.dg_dk[d] === D.DK_CRACK, 'the sword does not open it');
  G.dg_item = DG.I_BOMBS; G.dg_items |= DG.I_BOMBS; G.dg_bombs = 5;
  S.faceDir(dirs[d]); step(1, 0, S.PAD_X);
  ok(G.dg_bombs === 4, 'a bomb is set down');
  G.px = 112; G.py = D.PLAY_Y + 80; step(130);
  ok(G.dg_dk[d] === D.DK_OPEN, 'the blast opens the wall');
}
// the boomerang trips the crystal switch across the pit
{
  const sr = findRoom(r => r.kind === DG.R_BOOMSW);
  goTo(sr.id); killAll();
  const d = sr.doors.findIndex(e => e && e.kind === DG.E_BOOM);
  ok(G.dg_dk[d] === D.DK_SHUT, 'the switch room\'s door is shut');
  const k = [...Array(G.nobj).keys()].find(i => G.ob_t[i] === D.OBJ_CRYSTAL);
  const c = G.ob_k[k], cx = (c & 15) * 16, cy = D.PLAY_Y + (c >> 4) * 16;
  // stand level with it, two cells beyond the pit, facing it
  const left = (c & 15) < 8;
  G.px = left ? cx + 40 : cx - 40; G.py = cy; S.faceDir(left ? D.DIR_LEFT : D.DIR_RIGHT);
  G.dg_items |= DG.I_BOOMERANG; G.dg_item = DG.I_BOOMERANG;
  // a sword or an arrow won't do
  G.swing_cd = 0; step(1, S.PAD_B, S.PAD_B); step(30);
  ok(G.dg_dk[d] === D.DK_SHUT, 'the sword can\'t reach it');
  step(1, 0, S.PAD_X); step(60);
  ok(G.dg_dk[d] === D.DK_OPEN && G.ob_t[k] === D.OBJ_CRYSTAL_ON, 'the boomerang trips it and the door opens');
  ok(!G.bm_t, 'and the boomerang comes home');
}
// the block puzzle
{
  const pr = findRoom(r => r.kind === DG.R_BLOCK) || null;
  if (!pr) ok(true, '(no block puzzle in this seed)');
  else {
    goTo(pr.id); killAll();
    ok(G.dg_dk.some(k => k === D.DK_SHUT), 'the puzzle room bars its doors');
    const kb = [...Array(G.nobj).keys()].find(i => G.ob_t[i] === D.OBJ_BLOCK), kp = [...Array(G.nobj).keys()].find(i => G.ob_t[i] === D.OBJ_PLATE);
    const bc = G.ob_k[kb], pc = G.ob_k[kp], dir = (pc & 15) > (bc & 15) ? 1 : -1;
    G.px = ((bc & 15) - dir) * 16; G.py = D.PLAY_Y + (bc >> 4) * 16 - 4;
    for (let i = 0; i < 200 && !(G.dg_flags[G.dg_room] & 8); i++) step(1, dir > 0 ? S.PAD_RIGHT : S.PAD_LEFT);
    ok(G.dg_flags[G.dg_room] & 8, 'pushing the block onto the plate solves it');
    ok(!G.dg_dk.some(k => k === D.DK_SHUT), 'and the doors open');
  }
}
// the keeper: the boomerang glances off (no stun); beaten, stairs lead to the next dungeon
{
  const kr = G.dg.rooms[G.dg.boss];
  goTo(kr.id);
  ok(G.boss_on, 'the keeper is there');
  G.px = G.bx - 30; G.py = G.by + 8; S.faceDir(D.DIR_RIGHT); G.dg_item = DG.I_BOOMERANG;
  step(1, 0, S.PAD_X);
  let stunned = false, glanced = false; for (let i = 0; i < 40; i++) { const b = G.bstate; step(1); stunned ||= G.bstate === D.BS_STUN && b !== D.BS_STUN && G.btimer < 0; glanced ||= G.msg === 'THE BLADE GLANCES OFF!'; }
  ok(glanced && !stunned, 'the boomerang glances off the keeper');
  G.bhp = 1; G.px = G.bx - 14; G.py = G.by + 10; S.faceDir(D.DIR_RIGHT);
  for (let i = 0; i < 60 && G.boss_on; i++) { G.swing_cd = 0; G.atk_timer = 0; step(1, S.PAD_B, S.PAD_B); step(14); }
  ok(!G.boss_on && G.map[G.door_pos] === D.T_STAIRS, 'beaten: stairs appear');
  const c = G.door_pos; G.px = 112; G.py = c < 16 ? D.PLAY_Y + 20 : D.PLAY_Y + 140;
  const no = G.dg_no;
  for (let i = 0; i < 100 && G.dg_no === no; i++) step(1, c < 16 ? S.PAD_UP : S.PAD_DOWN);
  ok(G.dg_no === no + 1 && room().kind === DG.R_START, 'the stairs lead to dungeon 2');
}
// saving and loading a dungeon run
{
  let store = null;
  S.storage.get = () => store; S.storage.set = v => { store = v; };
  G.dg_keys = 2; S.save_game();
  const seed = G.dg_seed_text, no = G.dg_no, rooms = G.dg.rooms.length;
  S.new_hero(1);
  ok(S.load_game() && G.mode === 'dungeon' && G.dg_seed_text === seed && G.dg_no === no && G.dg.rooms.length === rooms && G.dg_keys === 2, 'a saved dungeon run loads back');
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
