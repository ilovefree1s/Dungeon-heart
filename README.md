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
  3 talent trees per class, the hunter's pets.
- Gear stats: every piece rolls up to three of Strength, Dexterity, Intelligence, Stamina and
  Defense (more on rarer gear, mostly your class's main stat). Strength is the warrior's damage,
  Dexterity the hunter's (and crit chance on gear), Intelligence the mage's; the other two help a
  third as much. Stamina is max health, Defense means less damage taken. Each level raises your main
  stat and Stamina.
- Saves in the browser after every room; Continue on the title screen.

## Controls
| | Keyboard | Controller | Phone |
|---|---|---|---|
| Move | WASD / arrows | left stick / d-pad | the stick |
| Attack | Space, J, Z | A / ✕, X / ▢ | ATTACK |
| Roll / blink / tame | Shift, K, X, L | B / ○ | the blue button |
| Potion | Q, E, R | Y / △, Select | POTION |
| Bag & talents | Tab, I, B | Start | SELECT (or the bag button) |
| Pause | Esc, P | | START (or the pause button) |

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
  browser, to check balance and catch crashes.
- Graphics quality (Fast / Good / Best) is in Options; on slow devices it steps down by
  itself until you pick one.
