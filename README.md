# Dungeon Heart

A 3D dungeon-crawling loot RPG for the browser. Climb 50 floors of the Tower King's
tower as a warrior, mage or hunter: clear rooms of monsters, grab gear that glows by
rarity, pick a boss door (easy, medium or hard) at the end of every floor, and save
your wife from the King on floor 50.

**Play:** https://ilovefree1s.github.io/Dungeon-heart/

## Status
Floor 1, room 1 as a playable preview of the look: the warrior, slimes, torches,
loot and the exit door. The rest of the game comes over from the SNES version
(`ilovefree1s/dungeon-loot`, folder `snes/`), which holds the full design and the
tuned numbers.

## How to play
- Move with WASD / arrow keys, the on-screen stick on phones, or a controller (PS5, Xbox).
- Space (or B on the screen / controller) swings the sword.
- Leave it alone for a few seconds and the warrior plays by himself.

## How it works
- Rendering: three.js (WebGL) with ACES tone mapping, soft shadows, environment
  lighting and bloom, in the style of Pest Panic (`ilovefree1s/pest-panic`).
- Every model, texture and sound is made in code; there are no image or sound files.
- `index.html` is the whole game.
