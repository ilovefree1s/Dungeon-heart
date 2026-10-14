// node tests/dungeons.mjs [seeds]: makes every floor (1-50) of that many seeded runs and checks each one:
// its size (10 rooms on floors 1-10, then 12, 14, 16, 20), every key before its lock, the floor's new item
// before the gate that needs it, gates only for items you have by then, the keeper reachable
import * as DG from '../src/dungeon.js';
const n = +(process.argv[2] || 200);
let bad = 0, count = 0;
const gatesSeen = {};
const t0 = Date.now();
for (let i = 0; i < n; i++) for (let f = 1; f <= 50; f++) {
  const s = (i * 2654435761 + f * 40503) >>> 0;
  let d;
  try { d = DG.generateDungeon(s, f); } catch (e) { bad++; console.log('FAIL gen', s, f, e.message); continue; }
  count++;
  const r = DG.checkDungeon(d);
  const cnt = c => d.rooms.filter(x => x.content === c).length;
  const doors = k => d.rooms.reduce((a, x) => a + x.doors.filter(e => e && e.kind === k).length, 0) / 2;
  const have = DG.itemsBefore(f), find = DG.foundOn(f);
  const itemGate = { [DG.I_BOMBS]: DG.E_BOMB, [DG.I_BOOMERANG]: DG.E_BOOM, [DG.I_HOOK]: DG.E_HOOK, [DG.I_HAMMER]: DG.E_PEG, [DG.I_FIRE]: DG.E_FIRE };
  let ok = d.rooms.length === DG.roomsFor(f) && cnt(DG.C_KEY) === doors(DG.E_KEY) && cnt(DG.C_BIGKEY) === 1 && doors(DG.E_BOSS) === 1;
  // the new item is here once, and its gate too
  if (find) ok = ok && cnt(find) === 1 && doors(itemGate[DG.ITEM_OF[find]]) >= 1;
  // no gate for an item you can't have yet (secret walls need bombs too)
  for (const [i, e] of Object.entries(itemGate)) if (!((have | DG.ITEM_OF[find]) & i) && doors(e)) ok = false;
  for (const [, e] of Object.entries(itemGate)) gatesSeen[e] = (gatesSeen[e] || 0) + (doors(e) ? 1 : 0);
  if (!r.ok || !r.everyRoom || !ok) { bad++; if (bad < 6) console.log('BAD seed', s, 'floor', f, r, d.rooms.length, 'keys', cnt(DG.C_KEY), doors(DG.E_KEY)); }
}
console.log(`${count} floors in ${Date.now() - t0} ms: ${bad} bad. Floors with each gate:`, Object.entries(gatesSeen).map(([e, c]) => ['', '', '', 'bomb', 'boomerang', '', 'chasm', 'pegs', 'braziers'][e] + ' ' + c).join(', '));
console.log('same seed, same floor:', JSON.stringify(DG.generateDungeon(DG.seedFrom('HEART1'), 7)) === JSON.stringify(DG.generateDungeon(DG.seedFrom('heart1'), 7)));
process.exit(bad ? 1 : 0);
