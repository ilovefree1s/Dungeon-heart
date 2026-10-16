# Dungeon Heart

A 3D dungeon-crawling loot RPG for the browser. Climb 50 floors of the Tower King's
tower as a warrior, mage or hunter. Every floor is a seeded dungeon in the style of the
SNES Zelda games (keys, locks, puzzles, a keeper at the end), you find a new item every
ten floors, and you save your wife from the King on floor 50.

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

## The floors: seeded dungeons
**New Game** rolls a random seed; **Seeded Run** lets you type one (same seed, same 50 floors: share it).
- Every floor is a dungeon of screens on a grid, entered through doors in the middle of each wall:
  10 rooms on floors 1-10, 12 on 11-20, 14 on 21-30, 16 on 31-40 and 20 on 41-50. The map fills in
  as you explore (a map chest shows it all).
- Small keys open locked doors, a big key opens the keeper's door; secret rooms hide behind cracked walls.
  Beat the keeper and the stairs lead up to the next floor (the merchant comes by first).
- One item every ten floors, each in a great chest, and every floor after it has gates that need it:
  | Floor | Item | Opens |
  |---|---|---|
  | 1 | **Blast Bombs** | cracked walls (and secret rooms) |
  | 10 | **Return Blade** (a boomerang: stuns, fetches loot) | crystal switches across pits |
  | 20 | **Iron Hammer** (a heavy swing that crushes) | wooden pegs blocking a doorway |
  | 30 | **Grapple Chain** (catches on posts and chests, stuns, fetches loot) | chasms: it pulls you over the pit |
  | 40 | **Ember Wand** (fireballs that burn monsters) | sealed doors: light both braziers |
  Keepers are too strong for the Blade and the Chain: they glance off.
- Guard rooms bar their doors until they're clear; block puzzles, spike halls, treasure rooms. Monsters get
  tougher floor by floor; floor 50's keeper is the Tower King.

How every floor stays beatable: `src/dungeon.js` builds each floor as a chain of zones shut off by gates
(locks, and gates for the items you carry or find on that floor), and each gate's key or item is always
placed before it. `node tests/dungeons.mjs 200` checks every floor of 200 seeds (every order of spending
keys); `node tests/dgbot.mjs 100` plays 100 whole runs, all 50 floors and the King, through the game's
rules with a bot; `node tests/dgmech.mjs` checks each mechanic and item on a floor that has it.

## Controls
| | Keyboard | Controller | Phone |
|---|---|---|---|
| Move | WASD / arrows | left stick / d-pad | the stick |
| Attack | Space, J, Z | A / ✕ (and X / ▢ until you carry a dungeon item) | ATTACK |
| Roll / blink / tame | Shift, K, X, L | B / ○ | the blue button |
| Potion | Q, E, R | Y / △, Select | POTION |
| Dungeon item (use / switch) | F or C / V | X / ▢ / LB back, RB on | the green button / the ◀ ▶ arrows under the room |
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
