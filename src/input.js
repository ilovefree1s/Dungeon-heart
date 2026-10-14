// ============================================================================
//  DUNGEON HEART  -  input: keyboard, the touch stick and buttons, and PS5 /
//  Xbox controllers, turned into the SNES game's pad bits each step. In menus
//  the same keys move a focus and press buttons.
// ============================================================================
import { PAD_A, PAD_B, PAD_SELECT, PAD_START, PAD_UP, PAD_DOWN, PAD_LEFT, PAD_RIGHT, PAD_X, PAD_L, G } from './sim.js';
// (in a dungeon, once you carry an item: its own button)
const itemMode = () => G.mode === 'dungeon' && G.dg_items;

const keys = {};
const st = { stickX: 0, stickY: 0, stickId: null, tAtk: 0, tSpec: 0, tPot: 0, tItem: 0, tSwap: 0, edge: 0, menuEdge: [], dx: 0, dy: 0, gpPrev: {}, lastDevice: 'kb' };
export const input = st;
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'atk', KeyJ: 'atk', KeyZ: 'atk', ShiftLeft: 'spec', ShiftRight: 'spec', KeyK: 'spec', KeyX: 'spec', KeyL: 'spec',
  KeyQ: 'pot', KeyE: 'pot', KeyR: 'pot', KeyF: 'item', KeyC: 'item', KeyV: 'swap', KeyM: 'map', Tab: 'bag', KeyI: 'bag', KeyB: 'bag', Enter: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back', KeyP: 'pause' };
let onAny = () => { };
export function onFirstInput(f) { onAny = f; }
// the menu cursor is drawn by the game (html.padnav .pfocus), not left to the browser's focus ring,
// which Safari never shows for a controller
function navMode(on) { document.documentElement.classList.toggle('padnav', on); }
addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button === 0) navMode(false); }, true);
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (!k) return;
  if (e.target && e.target.tagName === 'INPUT' && (e.target.type === 'text' || k === 'left' || k === 'right')) return; // (typing a name)
  e.preventDefault();
  onAny();
  st.lastDevice = 'kb'; navMode(true);
  if (!keys[k]) { keys[k] = 1; st.menuEdge.push(k); press(k); }
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { keys[k] = 0; e.preventDefault(); } });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; st.stickX = st.stickY = 0; });
// edge latches: a tap shorter than a game step still counts
function press(k) {
  if (k === 'atk') st.edge |= PAD_B;
  else if (k === 'spec') st.edge |= PAD_A;
  else if (k === 'pot') st.edge |= PAD_SELECT;
  else if (k === 'item') st.edge |= PAD_X;
  else if (k === 'swap') st.edge |= PAD_L;
}

// touch: a stick on the left, buttons on the right
export function initTouch() {
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  const move = e => {
    const r = stick.getBoundingClientRect();
    let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    st.stickX = dx; st.stickY = dy; knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
  };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); onAny(); st.lastDevice = 'touch'; st.stickId = e.pointerId; stick.setPointerCapture(e.pointerId); move(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === st.stickId) move(e); });
  const end = e => { if (e.pointerId === st.stickId) { st.stickId = null; st.stickX = st.stickY = 0; knob.style.transform = ''; } };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end); stick.addEventListener('lostpointercapture', end);
  const btn = (id, bit, flag) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); onAny(); st.lastDevice = 'touch'; st.edge |= bit; st[flag] = 1; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (x) { } });
    const up = () => { st[flag] = 0; el.classList.remove('on'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  btn('tAtk', PAD_B, 'tAtk'); btn('tSpec', PAD_A, 'tSpec'); btn('tPot', PAD_SELECT, 'tPot'); btn('tItem', PAD_X, 'tItem'); btn('tSwap', PAD_L, 'tSwap');
}

// controllers (standard mapping, by where the button sits): left (X / square) attacks; bottom (A / cross) uses the
// dungeon item (attacks until you have one); top (Y / triangle) rolls, blinks or tames; right (B / circle) drinks
// a potion; LB / RB switch items, select potion (the map in a dungeon), start the bag; d-pad or left stick.
// In menus: bottom or left confirms, right goes back, top sells (in the bag).
let gp = null;
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  gp = null;
  for (const p of pads) if (p && p.connected) { gp = p; break; }
  if (!gp) return null;
  const b = gp.buttons, on = n => !!(b[n] && (b[n].pressed || b[n].value > 0.5));
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  const im = itemMode();
  const dgm = G.mode === 'dungeon';
  const up = on(12) || ay < -0.5, down = on(13) || ay > 0.5, left = on(14) || ax < -0.5, right = on(15) || ax > 0.5;
  // the game's buttons
  const now = { atk: on(2) || (on(0) && !im), item: on(0) && im, swap: (on(4) || on(5)) && im, spec: on(3), pot: on(1) || (on(8) && !dgm), up, down, left, right };
  // the menus' (one press, one key)
  const menu = { ok: on(0) || on(2), back: on(1), pot: on(3), map: on(8) && dgm, bag: on(9), up, down, left, right, lb: on(4), rb: on(5) };
  for (const k in now) if (now[k] && !st.gpPrev[k]) {
    onAny(); st.lastDevice = 'pad'; navMode(true);
    if (k === 'atk' || k === 'spec' || k === 'pot' || k === 'item' || k === 'swap') press(k);
  }
  const prevM = st.gpPrevM || {};
  for (const k in menu) if (menu[k] && !prevM[k]) { onAny(); st.lastDevice = 'pad'; navMode(true); st.menuEdge.push(k); }
  st.gpPrev = now; st.gpPrevM = menu;
  return { now, ax: Math.abs(ax) > 0.25 ? ax : 0, ay: Math.abs(ay) > 0.25 ? ay : 0 };
}

// one game step: the pad bits (held) and the ones pressed since the last step
export function readPad() {
  const p = pollPad();
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (p) { dx += (p.now.right ? 1 : 0) - (p.now.left ? 1 : 0) + p.ax; dy += (p.now.down ? 1 : 0) - (p.now.up ? 1 : 0) + p.ay; }
  dx += st.stickX; dy += st.stickY;
  const l = Math.hypot(dx, dy);
  st.dx = l > 0.3 ? dx / Math.max(1, l) : 0; st.dy = l > 0.3 ? dy / Math.max(1, l) : 0;
  let pad = 0;
  if (l > 0.3) {
    // 8 directions, as on the d-pad
    const a = Math.atan2(dy, dx), oct = Math.round(a / (Math.PI / 4));
    const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
    const i = ((oct % 8) + 8) % 8;
    if (DX[i] > 0) pad |= PAD_RIGHT; if (DX[i] < 0) pad |= PAD_LEFT;
    if (DY[i] > 0) pad |= PAD_DOWN; if (DY[i] < 0) pad |= PAD_UP;
  }
  if (keys.atk || st.tAtk || (p && p.now.atk)) pad |= PAD_B;
  if (keys.spec || st.tSpec || (p && p.now.spec)) pad |= PAD_A;
  const padNew = st.edge;
  st.edge = 0;
  return { pad, padNew };
}
// the menu keys pressed since the last call ('up', 'ok', 'back', 'bag', ...)
export function menuKeys() { pollPad(); const k = st.menuEdge; st.menuEdge = []; return k; }
export function clearEdges() { st.edge = 0; st.menuEdge = []; }
export const held = k => !!keys[k];
