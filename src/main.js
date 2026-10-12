// ============================================================================
//  DUNGEON HEART  -  main: ties the rules (sim.js), the 3D view, the screens,
//  input and sound together. The rules run at 60 steps a second, as on the
//  SNES; the drawing runs at whatever the screen does.
// ============================================================================
import * as S from './sim.js';
import * as D from './data.js';
import { resize, render, setQuality } from './engine.js';
import * as view from './view.js';
import * as ui from './ui.js';
import { UI } from './ui.js';
import { readPad, initTouch, onFirstInput, input, clearEdges } from './input.js';
import { startAudio, sfx, setSfx, audioState } from './audio.js';
const G = S.G;

// ---------------------------------------------------------------- saving
const OPT_KEY = 'dungeonheart.opts.v1';
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
};
let backdrop = false; // (the title screen's room is never saved)
S.storage.get = () => ls.get(S.SAVE_KEY);
S.storage.set = v => { if (!backdrop && G.state !== 'title') ls.set(S.SAVE_KEY, v); };

// ---------------------------------------------------------------- options
function loadOpts() {
  let o = null;
  try { o = JSON.parse(ls.get(OPT_KEY)); } catch (e) { }
  o = o || {};
  audioState.music = typeof o.music === 'number' ? o.music : 0.45;
  audioState.sfx = typeof o.sfx === 'number' ? o.sfx : 0.8;
  UI.quality = typeof o.quality === 'number' ? o.quality : (matchMedia('(pointer:coarse)').matches ? 1 : 2);
  UI.autoQ = o.quality === undefined;
}
function saveOpts() { ls.set(OPT_KEY, JSON.stringify({ music: audioState.music, sfx: audioState.sfx, quality: UI.autoQ ? undefined : UI.quality })); }
loadOpts();
setSfx(audioState.sfx);
UI.hooks.saveOpts = saveOpts;
UI.hooks.quality = q => { UI.autoQ = false; setQuality(q); };

// ---------------------------------------------------------------- the title screen's room
// A floor-1 room with the chosen hero standing in it, no monsters, never saved.
function showBackdrop(cls) {
  backdrop = true;
  S.seed(1234 + cls);
  S.new_hero(cls);
  S.start_room();
  for (let i = 0; i < G.m_type.length; i++) G.m_type[i] = 0;
  // (an open room for the heroes to stand in: no pillars, inner walls or hazards)
  for (let c = 0; c < 176; c++) { const cx = c & 15, cy = c >> 4; if (cx > 0 && cx < 15 && cy > 0 && cy < 10 && G.map[c] !== D.T_FLOOR) G.map[c] = D.T_FLOOR; }
  G.nobj = 0;
  G.state = 'title';
  G.msg = '';
  drainEvents();
  backdrop = false;
}
UI.hooks.title = () => showBackdrop(UI.cls || 0);
UI.hooks.classPreview = cls => { if (G.player_class !== cls) showBackdrop(cls); };
UI.hooks.story = cls => { if (G.player_class !== cls) showBackdrop(cls); };

// ---------------------------------------------------------------- events
function drainEvents() {
  if (!G.ev.length) return;
  const ev = G.ev.splice(0);
  for (const e of ev) if (e.k === 'sfx') sfx(e.n);
  view.onEvents(ev, backdrop ? quietUi : ui);
}
// (the title screen's room shows no banners)
const quietUi = { ...ui, roomStart() { }, banner() { }, bossIntro() { } };

// ---------------------------------------------------------------- the loop
const STEP = 1000 / 60;
let acc = 0, last = performance.now();
let fpsT = 0, fpsN = 0, slow = 0, fast = 0;
function stepGame() {
  const { pad, padNew } = readPad();
  S.tick(pad, padNew);
}
function running() { return !UI.modal && (G.state === 'play' || G.state === 'rescue'); }
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (running()) {
    acc += dt * 1000;
    let n = 0;
    while (acc >= STEP && n < 6) { stepGame(); acc -= STEP; n++; drainEvents(); }
    if (n === 6) acc = 0;
  } else { acc = 0; readPad(); drainEvents(); }
  ui.menuStep();
  view.update(dt, input);
  ui.frame(dt);
  render();
  adapt(dt);
}
// adaptive quality: step down when the frame rate stays low (only if the player has not picked)
function adapt(dt) {
  fpsT += dt; fpsN++;
  if (fpsT < 2) return;
  const fps = fpsN / fpsT;
  fpsT = 0; fpsN = 0;
  if (!UI.autoQ || document.hidden) return;
  if (fps < 40) { slow++; fast = 0; } else if (fps > 57) { fast++; slow = 0; } else { slow = fast = 0; }
  if (slow >= 2 && UI.quality > 0) { UI.quality--; setQuality(UI.quality); slow = 0; }
}

// ---------------------------------------------------------------- start
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (G.state === 'play' && !UI.modal) S.save_game(); }
  last = performance.now();
});
addEventListener('pagehide', () => { if (G.state === 'play') S.save_game(); });
initTouch();
onFirstInput(startAudio);
setQuality(UI.quality);
resize();
ui.title();
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
document.getElementById('boot')?.remove();

// a hook for testing: run game steps quickly
window.__dh = { G, S, UI, V: view.V, drain: drainEvents, step(n = 60, pad = 0) { for (let i = 0; i < n; i++) { S.tick(pad, 0); drainEvents(); } }, clearEdges };
