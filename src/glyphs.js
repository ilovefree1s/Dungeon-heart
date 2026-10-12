// ============================================================================
//  DUNGEON HEART  -  glyphs: the white pictures on the talent medallions.
// ============================================================================
const W = 'fill="#fff" stroke="#1c2136" stroke-width="1.2" stroke-linejoin="round"';
const L = 'fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
const G = {
  sword: `<path d="M18 3h3v3L11 16l-3-3z" ${W}/><path d="M6 13l5 5M8 17l-4 4" ${L}/>`,
  star: `<path d="M12 2l2.6 6.6L21 9l-5 4.6L17.5 21 12 17.3 6.5 21 8 13.6 3 9l6.4-.4z" ${W}/>`,
  drop: `<path d="M12 3c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" ${W}/>`,
  crown: `<path d="M3 18l1-11 5 5 3-7 3 7 5-5 1 11z" ${W}/><path d="M3 21h18" ${L}/>`,
  skull: `<path d="M12 3a8 8 0 0 0-8 8c0 3 2 4.5 3 5v3h10v-3c1-.5 3-2 3-5a8 8 0 0 0-8-8z" ${W}/><circle cx="9" cy="11" r="2" fill="#1c2136"/><circle cx="15" cy="11" r="2" fill="#1c2136"/>`,
  heart: `<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z" ${W}/>`,
  shield: `<path d="M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z" ${W}/>`,
  bounce: `<path d="M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z" ${W}/><path d="M7 15l5-5 3 3" fill="none" stroke="#1c2136" stroke-width="2"/>`,
  wind: `<path d="M3 8h11a3 3 0 1 0-3-3M3 13h16a3 3 0 1 1-3 3M3 18h8" ${L}/>`,
  flag: `<path d="M5 21V3" ${L}/><path d="M6 4h12l-3 4 3 4H6z" ${W}/>`,
  boot: `<path d="M7 3h6v10l6 3v4H6z" ${W}/>`,
  arrow: `<path d="M3 12h15" ${L}/><path d="M14 6l7 6-7 6z" ${W}/>`,
  flame: `<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" ${W}/>`,
  spin: `<path d="M12 4a8 8 0 1 1-8 8M12 8a4 4 0 1 1-4 4" ${L}/><path d="M2 9l2 3 3-2" ${L}/>`,
  spark: `<path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z" ${W}/>`,
  wave: `<path d="M2 15c3-6 5-6 7 0s4 6 7 0 4-6 6-2" ${L}/><path d="M2 20c3-4 5-4 7 0s4 4 7 0" ${L}/>`,
  meteor: `<circle cx="15" cy="15" r="6" ${W}/><path d="M3 3l7 7M7 2l5 5M2 7l5 5" ${L}/>`,
  snow: `<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10" ${L}/><path d="M9 3l3 3 3-3M9 21l3-3 3 3" ${L}/>`,
  shards: `<path d="M4 4l6 2-2 6zM20 4l-2 7-5-3zM6 20l3-7 5 4zM20 20l-7-1 4-5z" ${W}/>`,
  ring: `<circle cx="12" cy="12" r="8" ${L}/><circle cx="12" cy="12" r="3" ${W}/>`,
  cube: `<path d="M12 2l9 5v10l-9 5-9-5V7z" ${W}/><path d="M3 7l9 5 9-5M12 12v10" fill="none" stroke="#1c2136" stroke-width="1.4"/>`,
  clock: `<circle cx="12" cy="12" r="9" ${W}/><path d="M12 7v5l4 2" fill="none" stroke="#1c2136" stroke-width="2.2" stroke-linecap="round"/>`,
  sparkle: `<path d="M9 2l1.5 5.5L16 9l-5.5 1.5L9 16l-1.5-5.5L2 9l5.5-1.5z" ${W}/><path d="M18 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" ${W}/>`,
  eye: `<path d="M2 12c3-5 6-7 10-7s7 2 10 7c-3 5-6 7-10 7s-7-2-10-7z" ${W}/><circle cx="12" cy="12" r="3.5" fill="#1c2136"/>`,
  potion: `<path d="M10 3h4v4l4 6a5 5 0 0 1-12 0l4-6z" ${W}/>`,
  orbs: `<circle cx="8" cy="14" r="5" ${W}/><circle cx="16" cy="9" r="5" ${W}/>`,
  target: `<circle cx="12" cy="12" r="9" ${W}/><circle cx="12" cy="12" r="5" fill="none" stroke="#1c2136" stroke-width="2"/><circle cx="12" cy="12" r="1.6" fill="#1c2136"/>`,
  pierce: `<path d="M2 12h17" ${L}/><path d="M16 7l6 5-6 5z" ${W}/><rect x="9" y="5" width="3" height="14" rx="1" fill="#fff" opacity=".6"/>`,
  multi: `<path d="M3 12h13M3 6l12 3M3 18l12-3" ${L}/><path d="M15 9l6 3-6 3z" ${W}/>`,
  claw: `<path d="M5 3c4 4 5 9 4 18M11 3c3 4 4 9 3 18M17 3c3 4 3 9 2 18" ${L}/>`,
  plus: `<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" ${W}/>`,
  paw: `<ellipse cx="12" cy="16" rx="5" ry="4" ${W}/><circle cx="6" cy="10" r="2.2" ${W}/><circle cx="10" cy="6" r="2.2" ${W}/><circle cx="14" cy="6" r="2.2" ${W}/><circle cx="18" cy="10" r="2.2" ${W}/>`,
  bolt: `<path d="M13 2L4 14h7l-2 8 10-13h-7z" ${W}/>`,
  coin: `<circle cx="12" cy="12" r="9" ${W}/><path d="M12 7v10M9 9.5c0-1.5 6-1.5 6 0s-6 1.5-6 3 6 1.5 6 3" fill="none" stroke="#1c2136" stroke-width="1.8"/>`,
  leaf: `<path d="M4 20C4 9 10 4 21 3c0 11-6 17-17 17z" ${W}/><path d="M4 20L14 10" fill="none" stroke="#1c2136" stroke-width="1.6"/>`,
  bag: `<path d="M6 8h12l2 13H4z" ${W}/><path d="M9 8a3 3 0 0 1 6 0" ${L}/>`,
};
// per class, per tree, the five talents in order
const MAP = [
  'sword', 'star', 'drop', 'crown', 'skull', 'heart', 'shield', 'bounce', 'wind', 'flag', 'boot', 'arrow', 'flame', 'drop', 'spin',
  'flame', 'spark', 'spark', 'wave', 'meteor', 'shield', 'snow', 'shards', 'ring', 'cube', 'clock', 'sparkle', 'eye', 'potion', 'orbs',
  'arrow', 'target', 'pierce', 'arrow', 'multi', 'heart', 'claw', 'plus', 'paw', 'bolt', 'boot', 'paw', 'coin', 'leaf', 'bag'];
export const talGlyph = i => `<svg viewBox="0 0 24 24" aria-hidden="true">${G[MAP[i]] || G.star}</svg>`;
