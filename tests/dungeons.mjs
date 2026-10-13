// node tests/dungeons.mjs [count]: makes that many seeded dungeons and checks each one
// (20-28 rooms, every key before its lock, every item before what needs it, the keeper reachable)
import { generateDungeon, checkDungeon, seedFrom, C_KEY, C_BOMBS, C_BOOMERANG, C_HOOK, C_BIGKEY, E_KEY, E_BOMB, E_BOOM, E_BOSS, E_HOOK, R_CHASM } from '../src/dungeon.js';
const n = +(process.argv[2] || 2000);
let bad = 0, minR = 99, maxR = 0, sumR = 0, secret = 0;
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const s = (i * 2654435761) >>> 0;
  let d;
  try { d = generateDungeon(s); } catch (e) { bad++; console.log('FAIL gen', s, e.message); continue; }
  const r = checkDungeon(d);
  const cnt = c => d.rooms.filter(x => x.content === c).length;
  const doors = k => d.rooms.reduce((a, x) => a + x.doors.filter(e => e && e.kind === k).length, 0) / 2;
  const okShape = d.rooms.length >= 20 && d.rooms.length <= 28 && cnt(C_KEY) === doors(E_KEY) && cnt(C_BOMBS) === 1 && cnt(C_BOOMERANG) === 1 && cnt(C_BIGKEY) === 1 && doors(E_BOSS) === 1 && doors(E_BOOM) === 1 && cnt(C_HOOK) === 1 && doors(E_HOOK) === 1 &&
    d.rooms.every(x => x.doors.some(e => e && e.kind === E_HOOK) === (x.kind === R_CHASM || d.rooms[x.doors.find(e => e && e.kind === E_HOOK)?.to]?.kind === R_CHASM));
  if (!r.ok || !r.everyRoom || !okShape) { bad++; if (bad < 5) console.log('BAD', s, r, d.rooms.length, cnt(C_KEY), doors(E_KEY)); }
  minR = Math.min(minR, d.rooms.length); maxR = Math.max(maxR, d.rooms.length); sumR += d.rooms.length;
  secret += d.rooms.filter(x => x.optional && x.doors.some(e => e && e.kind === E_BOMB)).length;
}
console.log(`${n} dungeons in ${Date.now() - t0} ms: ${bad} bad; rooms ${minR}-${maxR} (avg ${(sumR / n).toFixed(1)}); secret rooms ${(secret / n).toFixed(2)} per dungeon`);
console.log('same seed, same dungeon:', JSON.stringify(generateDungeon(seedFrom('HEART1'))) === JSON.stringify(generateDungeon(seedFrom('heart1'))));
process.exit(bad ? 1 : 0);
