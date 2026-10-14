// node tests/dgmech.mjs: each dungeon mechanic, played through the rules (sim.js) step by step, each on a floor
// that has it (bombs on floor 1, the boomerang's switch on 10, pegs on 20, a chasm on 30, braziers on 40)
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

// floor f of the first test seed whose floor f has a room like `want`
function floorWith(f, want = () => true) {
  for (let i = 1; i < 200; i++) {
    S.new_hero(0); S.dg_start('TEST' + i, f);
    G.maxhp = G.hp = 250; // (a deep floor's monsters would kill a new hero in one hit)
    if (G.dg.rooms.some(want)) return;
  }
  throw new Error('no floor ' + f + ' has that');
}
floorWith(1);
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
  ok([...Array(G.nobj).keys()].some(i => G.ob_t[i] === D.OBJ_CHEST_OPEN || G.ob_t[i] === D.OBJ_BIGCHEST_OPEN), 'the chest stays open on a second visit');
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
floorWith(10, r => r.kind === DG.R_BOOMSW);
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
floorWith(5, r => r.kind === DG.R_BLOCK);
{
  const pr = findRoom(r => r.kind === DG.R_BLOCK) || null;
  if (!pr) ok(true, '(no block puzzle in this seed)');
  else {
    goTo(pr.id);
    ok(/PUSH THE BLOCK/.test(G.msg), 'walking in, it says the block opens the doors (not the guard)');
    killAll();
    ok(G.dg_dk.some(k => k === D.DK_SHUT), 'the puzzle room bars its doors');
    ok(/STAY SHUT. PUSH THE BLOCK/.test(G.msg), 'the guard gone, it says the doors still wait on the block');
    const kb = [...Array(G.nobj).keys()].find(i => G.ob_t[i] === D.OBJ_BLOCK), kp = [...Array(G.nobj).keys()].find(i => G.ob_t[i] === D.OBJ_PLATE);
    const bc = G.ob_k[kb], pc = G.ob_k[kp], dir = (pc & 15) > (bc & 15) ? 1 : -1;
    G.px = ((bc & 15) - dir) * 16; G.py = D.PLAY_Y + (bc >> 4) * 16 - 4;
    for (let i = 0; i < 200 && !(G.dg_flags[G.dg_room] & 8); i++) step(1, dir > 0 ? S.PAD_RIGHT : S.PAD_LEFT);
    ok(G.dg_flags[G.dg_room] & 8, 'pushing the block onto the plate solves it');
    ok(!G.dg_dk.some(k => k === D.DK_SHUT), 'and the doors open');
  }
}
// a hunter tames a guard room's last monster: that clears the room as a kill would
{
  const seed = G.dg_seed_text, no = G.dg_no;
  S.new_hero(2); S.dg_start(seed, no); G.maxhp = G.hp = 250;
  const fr = findRoom(r => r.kind === DG.R_FIGHT);
  S.dg_enter(fr.id, -1);
  const t = [...Array(D.MAXM).keys()].find(n => G.m_type[n]);
  for (let n = 0; n < D.MAXM; n++) if (G.m_type[n] && n !== t) { G.m_type[n] = 0; G.mon_left--; }
  G.m_type[t] = D.M_SLIME; G.m_elite[t] = 0; G.m_mhp[t] = 40; G.m_hp[t] = 8; G.m_frz[t] = 3000; G.m_x[t] = 120; G.m_y[t] = D.PLAY_Y + 80;
  G.px = 104; G.py = D.PLAY_Y + 80;
  ok(G.dg_dk.some(k => k === D.DK_SHUT), 'a guard room, one weak slime left, doors shut');
  step(1, 0, S.PAD_A);
  for (let k = 0; k < 3000 && G.tame_n; k++) { const d = G.tame_pos < 64 ? G.tame_pos : 128 - G.tame_pos; step(1, 0, d <= 2 ? S.PAD_A : 0); }
  ok(G.pet_type === D.M_SLIME && !G.dg_dk.some(k => k === D.DK_SHUT), 'tamed: it\'s your pet and the doors open');
}
floorWith(30, r => r.kind === DG.R_CHASM && G.dg.rooms.filter(q => q.kind === DG.R_FIGHT).length >= 2);
// a chasm: only the grapple chain crosses it (both ways), pulling you to the post across the pit
{
  const cr = findRoom(r => r.kind === DG.R_CHASM);
  ok(!!cr, 'the dungeon has a chasm room');
  goTo(cr.id); killAll(); goTo(cr.id);
  const d = S.chasm_side(cr), C = S.CHASM[d], beyond = cr.doors[d].to;
  ok(G.map.some(t => t === D.T_PIT) && G.nobj >= 2, 'the chasm is cut and the posts stand');
  const cellOf = () => [(G.px + 8) >> 4, (G.py + 10 - D.PLAY_Y) >> 4];
  const far = () => { const [x, y] = cellOf(); return [y < 3, x > 12, y > 7, x < 3][d]; };
  ok(!far(), 'you come in on the near side');
  // no chain: walking at the door gets you nowhere
  const pads = [S.PAD_UP, S.PAD_RIGHT, S.PAD_DOWN, S.PAD_LEFT];
  G.dg_items = DG.I_BOMBS | DG.I_BOOMERANG; G.dg_item = DG.I_BOOMERANG;
  step(200, pads[d]);
  ok(G.dg_room === cr.id && !far(), 'without the chain the pit stops you');
  // with it: line up under the far post and fire
  G.dg_items |= DG.I_HOOK; G.dg_item = DG.I_HOOK;
  const vert = d === 0 || d === 2;
  const sx = vert ? C.far[0] : 8, sy = vert ? (d === 0 ? 7 : 3) : C.far[1];
  G.px = sx * 16; G.py = D.PLAY_Y + sy * 16 - 2; S.faceDir([D.DIR_UP, D.DIR_RIGHT, D.DIR_DOWN, D.DIR_LEFT][d]);
  step(1, 0, S.PAD_X); step(60);
  ok(far() && !G.hk_t, `the chain pulls you over the pit (now at cell ${cellOf()})`);
  for (let i = 0; i < 300 && G.dg_room === cr.id; i++) {
    // (along the far side to the door's line, then through it)
    const off = vert ? G.px - 112 : G.py - (D.PLAY_Y + 80);
    step(1, Math.abs(off) > 1 ? (vert ? (off > 0 ? S.PAD_LEFT : S.PAD_RIGHT) : (off > 0 ? S.PAD_UP : S.PAD_DOWN)) : pads[d]);
  }
  ok(G.dg_room === beyond, 'and on through the door beyond');
  // and back again from that side, to the near post
  S.dg_enter(cr.id, DG.OPP[DG.OPP[d]]);
  ok(far(), 'coming back you arrive on the far side');
  const bx = vert ? C.near[0] : C.far[0], by = vert ? C.far[1] : C.near[1];
  G.px = bx * 16; G.py = D.PLAY_Y + by * 16 - 2; S.faceDir([D.DIR_DOWN, D.DIR_LEFT, D.DIR_UP, D.DIR_RIGHT][d]);
  step(1, 0, S.PAD_X); step(60);
  ok(!far() && !G.hk_t, `and the near post pulls you back (cell ${cellOf()})`);
  // fired at a wall it just comes back
  G.px = 112; G.py = D.PLAY_Y + 80; S.faceDir(vert ? D.DIR_LEFT : D.DIR_UP);
  const was = [G.px, G.py];
  step(1, 0, S.PAD_X); step(60);
  ok(!G.hk_t && G.px === was[0] && G.py === was[1], 'at a bare wall it reels back in and you stay put');
}
// the chain stuns a monster in its way
{
  const fr = findRoom(r => r.kind === DG.R_FIGHT && !(G.dg_flags[r.id] & 2));
  goTo(fr.id);
  const n = [...Array(D.MAXM).keys()].find(i => G.m_type[i] && D.MON_NAME[G.m_type[i]] !== 'GHOST');
  G.dg_item = DG.I_HOOK;
  for (let i = 0; i < D.MAXM; i++) if (i !== n) G.m_type[i] = 0;
  G.m_x[n] = 160; G.m_y[n] = D.PLAY_Y + 80; G.px = 100; G.py = D.PLAY_Y + 78; S.faceDir(D.DIR_RIGHT);
  let stunned = false; step(1, 0, S.PAD_X);
  for (let i = 0; i < 30 && !stunned; i++) { G.m_x[n] = 160; G.m_y[n] = D.PLAY_Y + 80; step(1); stunned = G.m_frz[n] > 0; }
  if (!stunned) console.log('   ', D.MON_NAME[G.m_type[n]], 'hk', G.hk_t, G.hk_st, G.hk_x, G.hk_y, 'hero', G.px, G.py, 'items', G.dg_items, 'map', G.map.slice(80, 96).join(''));
  ok(stunned, 'the chain stuns a monster it hits');
}
// the hammer pounds down the pegs in a doorway
floorWith(20, r => r.doors.some(e => e && e.kind === DG.E_PEG) && G.dg.rooms.filter(q => q.kind === DG.R_FIGHT).length >= 1);
{
  const pr = findRoom(r => r.doors.some(e => e && e.kind === DG.E_PEG) && G.dg.rooms[r.doors.find(e => e && e.kind === DG.E_PEG).to].zone > r.zone);
  goTo(pr.id); killAll();
  const d = pr.doors.findIndex(e => e && e.kind === DG.E_PEG);
  ok(G.dg_dk[d] === D.DK_PEGS && G.map[[7, 95, 167, 80][d]] === D.T_DOOR, 'pegs block the doorway');
  const pads = [S.PAD_UP, S.PAD_RIGHT, S.PAD_DOWN, S.PAD_LEFT];
  const pos = [[112, D.PLAY_Y + 14], [222, D.PLAY_Y + 78], [112, D.PLAY_Y + 142], [18, D.PLAY_Y + 78]];
  G.dg_items = DG.I_BOMBS | DG.I_BOOMERANG; G.dg_item = DG.I_BOMBS;
  G.px = pos[d][0]; G.py = pos[d][1]; step(30, pads[d]);
  ok(G.dg_dk[d] === D.DK_PEGS && G.dg_room === pr.id, 'without the hammer they hold');
  G.dg_items |= DG.I_HAMMER; G.dg_item = DG.I_HAMMER;
  G.px = pos[d][0]; G.py = pos[d][1]; S.faceDir([D.DIR_UP, D.DIR_RIGHT, D.DIR_DOWN, D.DIR_LEFT][d]);
  step(1, 0, S.PAD_X); step(30);
  ok(G.dg_dk[d] === D.DK_OPEN && G.map[[7, 95, 167, 80][d]] === D.T_DOORWAY, 'the hammer pounds them down');
  const to = pr.doors[d].to;
  step(60, pads[d]);
  ok(G.dg_room === to, 'and you walk on through');
  // it hits hard, too
  const fr = findRoom(r => r.kind === DG.R_FIGHT && !(G.dg_flags[r.id] & 2));
  goTo(fr.id);
  const n = [...Array(D.MAXM).keys()].find(i => G.m_type[i] && D.MON_NAME[G.m_type[i]] !== 'GHOST');
  G.m_hp[n] = 200; G.m_x[n] = 120; G.m_y[n] = D.PLAY_Y + 80; G.px = 102; G.py = D.PLAY_Y + 78; S.faceDir(D.DIR_RIGHT);
  const hp0 = G.m_hp[n]; step(1, 0, S.PAD_X);
  let hit = false; for (let i = 0; i < 20; i++) { G.m_x[n] = 120; G.m_y[n] = D.PLAY_Y + 80; step(1); hit ||= G.m_hp[n] < hp0; }
  ok(hit, 'the hammer crushes a monster in front of you');
}
// the ember wand lights the braziers, and the seal breaks
floorWith(40, r => r.kind === DG.R_TORCH);
{
  const tr = findRoom(r => r.kind === DG.R_TORCH);
  goTo(tr.id); killAll(); goTo(tr.id);
  const d = tr.doors.findIndex(e => e && e.kind === DG.E_FIRE);
  const braz = () => [...Array(G.nobj).keys()].filter(i => G.ob_t[i] === D.OBJ_BRAZIER || G.ob_t[i] === D.OBJ_BRAZIER_LIT);
  ok(braz().length === 2 && G.dg_dk[d] === D.DK_SHUT, 'two cold braziers and a sealed door');
  G.dg_items |= DG.I_FIRE; G.dg_item = DG.I_FIRE;
  for (const k of braz()) {
    // stand two cells below (or above) it and shoot at it
    const c = G.ob_k[k], cx = c & 15, cy = c >> 4, below = cy < 5;
    G.px = cx * 16; G.py = D.PLAY_Y + (below ? cy + 3 : cy - 3) * 16; S.faceDir(below ? D.DIR_UP : D.DIR_DOWN);
    step(1, 0, S.PAD_X); step(40);
    ok(G.ob_t[k] === D.OBJ_BRAZIER_LIT, `a fireball lights the brazier at ${cx},${cy}`);
  }
  ok(G.dg_dk[d] === D.DK_OPEN, 'both lit: the sealed door opens');
  goTo(tr.id);
  ok(braz().every(k => G.ob_t[k] === D.OBJ_BRAZIER_LIT) && G.dg_dk[d] === D.DK_OPEN, 'and they stay lit');
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
  ok(G.dg_no === no + 1 && room().kind === DG.R_START, 'the stairs lead to the next floor');
  ok((G.dg_items & DG.itemsBefore(G.dg_no)) === DG.itemsBefore(G.dg_no), 'carrying everything that floor can ask for');
}
// floor 50: the Tower King; beating him frees her
floorWith(50);
{
  goTo(G.dg.boss);
  ok(G.boss_on && S.boss_name() === 'TOWER KING', 'floor 50\'s keeper is the Tower King');
  for (let i = 0; i < 6000 && G.state === 'play'; i++) {
    G.bintro = 0;
    if (G.boss_on) { G.bhp = 1; G.px = Math.max(16, Math.min(208, G.bx - 14)); G.py = Math.max(D.PLAY_Y + 16, Math.min(D.PLAY_Y + 136, G.by + 10)); S.faceDir(D.DIR_RIGHT); G.swing_cd = 0; G.atk_timer = 0; }
    step(1, S.PAD_B, S.PAD_B); step(3);
  }
  ok(G.state === 'rescue' || G.state === 'win', 'beaten: the rescue (state ' + G.state + ')');
}
floorWith(3);
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
