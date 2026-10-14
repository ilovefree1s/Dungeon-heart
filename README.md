# Dungeon Heart

A 3D dungeon-crawling loot RPG for the browser. Climb 50 floors of the Tower King's
tower as a warrior, mage or hunter: clear rooms of monsters, grab gear that glows by
rarity, pick a boss door (easy, medium or hard) at the end of every floor, and save
your wife from the King on floor 50.

**Play:** https://ilovefree1s.github.io/Dungeon-heart/

## What's in it
The whole SNES game (`ilovefree1s/dungeon-loot`, folder `snes/`), rebuilt in 3D:
- 50 floors in 10 themes (Stone Keep, Mossy Halls, Frost Tomb, Ember Depths, Bone Crypt,
  Sand Vault, Crystal Cave, Shadow Halls, Blood Spire, Storm Tower), each with its own
  hazard: spike traps, thorns, slippery ice, lava, the dead rising, quicksand, crystals
  that throw shots back, darkness, blood pools that heal monsters, lightning.
- 17 monsters, elites with special powers, floor modifiers, and special rooms
  (treasure, shrine, fountain, arena, trapped room).
- A boss every floor behind the door you choose, and the Tower King on floor 50.
- Gear in 7 slots and 5 rarities, trinkets, the traveling merchant and trade-ups,
  3 talent trees per class, the hunter's pets (named when tamed, set free from the talents screen).
- Gear stats: every piece rolls up to three of Strength, Dexterity, Intelligence, Stamina and
  Defense (more on rarer gear, mostly your class's main stat). Strength is the warrior's damage,
  Dexterity the hunter's (and crit chance on gear), Intelligence the mage's; the other two help a
  third as much. Stamina is max health, Defense means less damage taken. Each level raises your main
  stat and Stamina.
- Saves in the browser after every room; Continue on the title screen.

## Dungeon Run (seeded)
Pick **Dungeon** on the title screen, type a seed or roll one, and pick a class. Every seed makes its own
dungeon, the same one every time (share a seed with a friend):
- 20-28 screens on an 11x11 grid, entered through doors in the middle of each wall; the map fills in as you
  explore (a map chest shows it all).
- Small keys open locked doors, a big key opens the keeper's door; secret rooms hide behind cracked walls.
- Items, each found in a chest: **Blast Bombs** (blow open cracked walls) and the **Return Blade** (a
  boomerang: stuns enemies, fetches loot, trips crystal switches across pits) and the **Grapple Chain**
  (fires straight ahead, catches on grapple posts and chests and pulls you over pits; it stuns and fetches
  loot too). The keeper is too strong for either: they glance off.
- Chasm rooms: a pit cuts off one door, with a grapple post on each side, so only the chain crosses it.
- Guard rooms bar their doors until they're clear; block puzzles, spike halls, treasure rooms.
- Beat the keeper and the stairs lead to the next dungeon.

How every seed stays beatable: `src/dungeon.js` builds the dungeon as a chain of zones shut off by gates
(a locked door, a cracked wall, a crystal-switch shutter, a chasm, the keeper's door), and each gate's key or item is
always placed before it. `node tests/dungeons.mjs 10000` checks the plans (every order of spending keys);
`node tests/dgbot.mjs 1000` plays whole dungeons through the game's rules with a bot (fighting, keys, bombs,
the boomerang, the grapple chain, block puzzles, the keeper); `node tests/dgmech.mjs` checks each mechanic.

## Controls
| | Keyboard | Controller | Phone |
|---|---|---|---|
| Move | WASD / arrows | left stick / d-pad | the stick |
| Attack | Space, J, Z | X / ▢ (and A / ✕ until you carry a dungeon item) | ATTACK |
| Roll / blink / tame | Shift, K, X, L | Y / △ | the blue button |
| Potion | Q, E, R | B / ○, Select | POTION |
| Dungeon item (use / switch) | F or C / V | A / ✕ / LB, RB | the green button / the small arrows |
| Dungeon map | M | Select (in a dungeon) | the map button |
| Bag & talents | Tab, I, B | Start (in menus: A / ✕ picks, B / ○ backs out, Y / △ sells) | START (or the bag button) |
| Pause | Esc, P | | SELECT (or the pause button) |

## How it works
- `src/sim.js` holds the game's rules, ported from the SNES game. It runs 60 steps a
  second and knows nothing about drawing.
- `src/engine.js`, `src/models.js` and `src/view.js` draw it with three.js: ACES tone
  mapping, soft shadows, environment lighting and bloom, in the style of Pest Panic
  (`ilovefree1s/pest-panic`). Every model and texture is made in code.
- `src/ui.js` (screens and HUD), `src/input.js` (keyboard, touch, controllers),
  `src/audio.js` (sound effects made in code; the music is `music/dungeon_echoes.mp3`).
- `src/head.html` is the page; `python3 build.py` writes `index.html` from it.
- `node tests/bot.mjs <class 0-2> <floors> <seed>` plays the rules with a bot, with no
  browser, to check balance and catch crashes. (The dungeon tests are above.)
- Graphics quality (Fast / Good / Best) is in Options; on slow devices it steps down by
  itself until you pick one.
