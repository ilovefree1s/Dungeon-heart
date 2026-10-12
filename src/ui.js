// ============================================================================
//  DUNGEON HEART  -  ui: the HUD, the numbers and banners, and every screen
//  (title, class, story, gear and bag, talents, merchant, trade, pause,
//  options, death, victory). Touch, mouse, keys and controllers all work.
// ============================================================================
import * as S from './sim.js';
import * as D from './data.js';
import { camera, V3 } from './engine.js';
import { sfx, startAudio, setMusic, setSfx, audioState } from './audio.js';
import { menuKeys, input } from './input.js';
const G = S.G;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const tc = s => s.toLowerCase().replace(/(^|\s|-)\S/g, m => m.toUpperCase());

export const UI = { modal: null, hooks: {}, toastT: 0, bannerT: 0, msgId: -1, lastHud: {}, sel: null, talSel: 0, marks: new Set(), sellArm: -1 };

// ---------------------------------------------------------------- item icons (SVG, colored by rarity)
export function itemIcon(kind, rar, cls = G.player_class) {
  const c = D.RAR_COLOR[rar] || '#d9dde3', s = '#1a1410';
  const st = `stroke="${s}" stroke-width="1.3" stroke-linejoin="round"`;
  let p = '';
  switch (kind) {
    case D.K_WEAPON:
      if (cls === 0) p = `<path d="M18 3h3v3L10 17l-3-3z" fill="${c}" ${st}/><path d="M5 13l6 6M7 17l-3 3 1 1 3-3" stroke="#a87a4a" stroke-width="2.4" stroke-linecap="round"/>`;
      else if (cls === 1) p = `<path d="M6 21L17 7" stroke="#8a5a30" stroke-width="2.6" stroke-linecap="round"/><circle cx="18" cy="5.5" r="3.6" fill="${c}" ${st}/>`;
      else p = `<path d="M6 3c9 3 12 9 9 18" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><path d="M6 3l9 18" stroke="#e8e0d0" stroke-width="1"/><path d="M4 12h12l-2-2m2 2l-2 2" stroke="#d8c8a8" stroke-width="1.4" fill="none"/>`;
      break;
    case D.K_ARMOR: p = `<path d="M7 4l5 2 5-2 3 4-3 2v10H7V10L4 8z" fill="${c}" ${st}/>`; break;
    case D.K_SHIELD:
      if (cls === 0) p = `<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" fill="${c}" ${st}/><path d="M12 7v10M8 11h8" stroke="${s}" stroke-width="1.2"/>`;
      else if (cls === 1) p = `<circle cx="12" cy="10" r="6.5" fill="${c}" ${st}/><circle cx="10" cy="8" r="2" fill="#fff" opacity=".7"/><path d="M8 18h8l-1 3H9z" fill="#a8a090" ${st}/>`;
      else p = `<path d="M8 5h7l1 16H9z" fill="#8a5a30" ${st}/><path d="M10 2l1 4M13 2l0 4M15.5 2.5l-1 3.5" stroke="${c}" stroke-width="2"/>`;
      break;
    case D.K_BOOTS: p = `<path d="M7 3h6v10l6 3v4H6z" fill="${c}" ${st}/>`; break;
    case D.K_GLOVES: p = `<path d="M7 21v-8L5 9l2-1 2 3V4h2v6V3h2v7V4h2v7l2-3h1l-1 6-2 7z" fill="${c}" ${st}/>`; break;
    case D.K_HELMET: p = `<path d="M4 15a8 8 0 0 1 16 0v3h-5v-4H9v4H4z" fill="${c}" ${st}/><path d="M12 4v-2" stroke="${c}" stroke-width="3"/>`; break;
    case D.K_TRINKET: p = `<path d="M7 3c0 4 10 4 10 0" fill="none" stroke="#e0b040" stroke-width="1.6"/><path d="M12 8l5 6-5 7-5-7z" fill="${c}" ${st}/>`; break;
    case D.K_POTION: p = `<path d="M10 3h4v4l4 6a5 5 0 0 1-12 0l4-6z" fill="#e2384a" ${st}/>`; break;
    case D.K_GOLD: p = `<circle cx="12" cy="12" r="8" fill="#f5c242" ${st}/>`; break;
    default: p = `<rect x="6" y="6" width="12" height="12" rx="3" fill="none" stroke="#3a332e" stroke-width="1.6" stroke-dasharray="3 3"/>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
}
const CLASS_ICON = [
  '<svg viewBox="0 0 24 24"><path d="M12 2l3 3-1 6h3l-1 3h-3l-1 8-1-8H8l-1-3h3L9 5z" fill="#ff6a55" stroke="#2a0a08" stroke-width="1"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M12 2l4 9H8z" fill="#b57cff" stroke="#1a0a2a" stroke-width="1"/><path d="M6 12h12M12 12v10" stroke="#b57cff" stroke-width="2"/><circle cx="12" cy="17" r="2.5" fill="#9ad8ff"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M6 3c9 3 12 9 9 18" fill="none" stroke="#86e34b" stroke-width="2.6"/><path d="M6 3l9 18M3 12h12" stroke="#e8e0d0" stroke-width="1.4"/></svg>'];

// ---------------------------------------------------------------- screens
const SCREENS = ['sTitle', 'sClass', 'sStory', 'sInv', 'sShop', 'sTrade', 'sPause', 'sOpt', 'sDead', 'sWin'];
export function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  UI.modal = id;
  const play = !id || id === null;
  $('hud').hidden = !(G.state === 'play' || G.state === 'rescue') || (id && id !== 'sInv' && id !== 'sShop' && id !== 'sTrade' && id !== 'sPause' && id !== 'sDead');
  $('touch').hidden = !!id || !(G.state === 'play');
  $('minimap').hidden = !!id || G.state !== 'play';
  if (id) {
    setTimeout(() => { const f = firstFocus(); if (f && input.lastDevice !== 'touch') f.focus({ preventScroll: true }); }, 30);
  }
  UI.hooks.onModal && UI.hooks.onModal(id);
}
function firstFocus() {
  const s = UI.modal && $(UI.modal);
  if (!s) return null;
  return s.querySelector('.sel,.btn:not([disabled]):not([hidden]),button.card') || s.querySelector('button:not([disabled])');
}
// arrow keys and the d-pad move the focus to the nearest button that way
function navigate(dir) {
  const s = $(UI.modal);
  if (!s) return;
  const els = [...s.querySelectorAll('button:not([disabled]),input')].filter(e => e.offsetParent !== null && !e.closest('[hidden]'));
  const cur = document.activeElement && s.contains(document.activeElement) ? document.activeElement : null;
  if (!cur) { (els[0] || {}).focus && els[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bd = 1e9;
  for (const e of els) {
    if (e === cur) continue;
    const q = e.getBoundingClientRect(), x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy;
    let main, side;
    if (dir === 'up') { main = -y; side = Math.abs(x); } else if (dir === 'down') { main = y; side = Math.abs(x); }
    else if (dir === 'left') { main = -x; side = Math.abs(y); } else { main = x; side = Math.abs(y); }
    if (main <= 4) continue;
    const d = main + side * 2.2;
    if (d < bd) { bd = d; best = e; }
  }
  if (best) { best.focus({ preventScroll: false }); if (best.dataset.focusSel) best.click(); }
  else if (cur.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) { cur.value = +cur.value + (dir === 'right' ? 1 : -1); cur.dispatchEvent(new Event('input')); }
}
export function menuStep() {
  const ks = menuKeys();
  for (const k of ks) {
    if (!UI.modal) {
      if (G.state !== 'play') continue;
      if (k === 'bag') openInv();
      else if (k === 'back' && input.lastDevice === 'kb' || k === 'pause') openPause();
      continue;
    }
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { navigate(k); continue; }
    if (k === 'ok') { const a = document.activeElement; if (a && $(UI.modal).contains(a)) { a.click(); } continue; }
    if (k === 'back' || (k === 'bag' && (UI.modal === 'sInv'))) { back(); continue; }
    if (k === 'lb' && UI.modal === 'sInv') { setTab(0); continue; }
    if (k === 'rb' && UI.modal === 'sInv') { setTab(1); continue; }
    if (k === 'pot' && UI.modal === 'sInv' && UI.sel && UI.sel.bag !== undefined) { sellSel(); continue; }
  }
}
function back() {
  switch (UI.modal) {
    case 'sClass': title(); break;
    case 'sInv': case 'sPause': closeModal(); break;
    case 'sShop': leaveShop(); break;
    case 'sTrade': openShopScreen(); break;
    case 'sOpt': show(UI.optBack || 'sTitle'); break;
    default: break;
  }
}
export function closeModal() { S.save_game(); show(null); }

// ---------------------------------------------------------------- title, class, story
export function title() {
  G.state = 'title';
  $('bCont').hidden = !S.has_save();
  show('sTitle');
  UI.hooks.title && UI.hooks.title();
}
$('bNew').onclick = () => { startAudio(); sfx('pickup'); show('sClass'); UI.hooks.classPreview && UI.hooks.classPreview(0); };
$('bCont').onclick = () => { startAudio(); sfx('door'); fadeThen(() => { if (S.load_game()) { show(null); } else title(); }); };
$('bOpt').onclick = () => { startAudio(); UI.optBack = 'sTitle'; openOptions(); };
for (const c of document.querySelectorAll('.card')) {
  c.onclick = () => { sfx('levelup'); UI.cls = +c.dataset.cls; show('sStory'); UI.hooks.story && UI.hooks.story(UI.cls); };
  c.onfocus = () => UI.hooks.classPreview && UI.hooks.classPreview(+c.dataset.cls);
  c.onmouseenter = () => UI.hooks.classPreview && UI.hooks.classPreview(+c.dataset.cls);
}
$('bClassBack').onclick = () => title();
$('bStory').onclick = () => { sfx('door'); fadeThen(() => { S.new_hero(UI.cls); S.start_room(); show(null); banner('FLOOR 1', 'STONE KEEP', 2.2); }); };

// ---------------------------------------------------------------- options
const qBtns = [...$('oQual').querySelectorAll('button')];
function openOptions() {
  $('oMusic').value = Math.round(audioState.music * 10); $('oSfx').value = Math.round(audioState.sfx * 10);
  $('oMusicV').textContent = $('oMusic').value; $('oSfxV').textContent = $('oSfx').value;
  qBtns.forEach(b => b.classList.toggle('on', +b.dataset.q === UI.quality));
  show('sOpt');
}
$('oMusic').oninput = () => { $('oMusicV').textContent = $('oMusic').value; setMusic($('oMusic').value / 10); UI.hooks.saveOpts && UI.hooks.saveOpts(); };
$('oSfx').oninput = () => { $('oSfxV').textContent = $('oSfx').value; setSfx($('oSfx').value / 10); sfx('pickup'); UI.hooks.saveOpts && UI.hooks.saveOpts(); };
qBtns.forEach(b => b.onclick = () => { UI.quality = +b.dataset.q; qBtns.forEach(x => x.classList.toggle('on', x === b)); UI.hooks.quality && UI.hooks.quality(UI.quality); UI.hooks.saveOpts && UI.hooks.saveOpts(); });
$('bOptBack').onclick = () => back();

// ---------------------------------------------------------------- pause
function openPause() { sfx('pickup'); show('sPause'); }
$('hPause').onclick = () => openPause();
$('bResume').onclick = () => closeModal();
$('bPauseBag').onclick = () => openInv();
$('bPauseOpt').onclick = () => { UI.optBack = 'sPause'; openOptions(); };
$('bQuit').onclick = () => { S.save_game(); title(); };

// ---------------------------------------------------------------- death, victory
export function dead() { $('deadWhere').textContent = 'on floor ' + G.floor_num; setTimeout(() => show('sDead'), 900); }
$('bRetry').onclick = () => { sfx('door'); fadeThen(() => { S.respawn(); show(null); }); };
export function win() {
  $('winStats').textContent = `Level ${G.lvl} · ${G.kills} monsters · ${G.gold} gold`;
  setTimeout(() => show('sWin'), 600);
}
$('bWin').onclick = () => { title(); };

// ---------------------------------------------------------------- the character screen
const GEAR_ORDER = [D.K_WEAPON, D.K_ARMOR, D.K_SHIELD, D.K_HELMET, D.K_GLOVES, D.K_BOOTS, D.K_TRINKET];
function slotLabel(kind) {
  if (kind === D.K_SHIELD) return ['SHIELD', 'ORB', 'QUIVER'][G.player_class];
  return D.KIND_NAME[kind];
}
export function openInv(tab = 0) {
  sfx('pickup');
  UI.sel = UI.sel || { bag: 0 };
  UI.sellArm = -1;
  show('sInv');
  setTab(tab);
}
$('hBag').onclick = () => openInv();
$('bInvClose').onclick = () => closeModal();
$('tabGear').onclick = () => setTab(0);
$('tabTal').onclick = () => setTab(1);
function setTab(t) {
  UI.tab = t;
  $('tabGear').classList.toggle('on', t === 0); $('tabTal').classList.toggle('on', t === 1);
  $('pGear').hidden = t !== 0; $('pTal').hidden = t !== 1;
  if (t === 0) drawInv(); else drawTal();
}
function isUpgrade(k) {
  const kind = G.b_kind[k];
  if (!kind) return false;
  if (kind === D.K_TRINKET) return !G.eq_has[6];
  return !G.eq_has[kind - 1] || G.b_lvl[k] > G.eq_lvl[kind - 1];
}
function drawInv() {
  $('invTitle').textContent = D.CLASS_NAME[G.player_class];
  $('invPor').innerHTML = CLASS_ICON[G.player_class];
  $('invName').textContent = `LEVEL ${G.lvl}  ·  FLOOR ${G.floor_num}`;
  $('invKv').innerHTML = `HP<b>${G.hp}/${G.maxhp}</b>ATK<b>${S.atk_fine()}</b>DEF<b>${S.total_def()}</b>SPD<b>${S.spd_fine()}</b>GOLD<b>${G.gold}</b>XP<b>${G.xp}/${G.xpnext}</b>POTIONS<b>${G.potions}</b>KILLS<b>${G.kills}</b>`;
  const gg = $('gearGrid');
  gg.innerHTML = '';
  for (const kind of GEAR_ORDER) {
    const i = kind - 1, has = G.eq_has[i];
    const b = document.createElement('button');
    b.className = 'slot' + (UI.sel && UI.sel.gear === i ? ' sel' : '');
    b.innerHTML = `<span class="k">${slotLabel(kind)}</span>${has ? itemIcon(kind, G.eq_rar[i]) : itemIcon(0)}${has && kind !== D.K_TRINKET ? `<span class="lv">${G.eq_lvl[i]}</span>` : ''}`;
    if (has) b.style.boxShadow = `inset 0 0 0 2px ${D.RAR_COLOR[G.eq_rar[i]]}55`;
    b.onclick = () => { if (UI.sel && UI.sel.gear === i && input.lastDevice !== 'touch') { unequipSel(); return; } UI.sel = { gear: i }; UI.sellArm = -1; drawInv(); focusSel(); };
    b.setAttribute('aria-label', slotLabel(kind));
    gg.appendChild(b);
  }
  const bg = $('bagGrid');
  bg.innerHTML = '';
  for (let k = 0; k < D.BAG; k++) {
    const kind = G.b_kind[k];
    const b = document.createElement('button');
    b.className = 'slot' + (UI.sel && UI.sel.bag === k ? ' sel' : '') + (isUpgrade(k) ? ' up' : '');
    b.innerHTML = kind ? itemIcon(kind, G.b_rar[k]) + (kind !== D.K_TRINKET ? `<span class="lv">${G.b_lvl[k]}</span>` : '') : '';
    if (kind) b.style.boxShadow = `inset 0 0 0 2px ${D.RAR_COLOR[G.b_rar[k]]}66`;
    b.onclick = () => { if (UI.sel && UI.sel.bag === k && input.lastDevice !== 'touch') { equipSel(); return; } UI.sel = { bag: k }; UI.sellArm = -1; drawInv(); focusSel(); };
    b.setAttribute('aria-label', kind ? S.item_name(kind, G.b_rar[k], G.b_tier[k]) : 'Empty');
    bg.appendChild(b);
  }
  drawInfo();
  // the talent tab's points
  const pts = S.tal_avail();
  $('talPts').textContent = pts ? pts : '';
}
function focusSel() { const s = $('sInv').querySelector('.slot.sel'); if (s && input.lastDevice !== 'touch') s.focus({ preventScroll: true }); }
function drawInfo() {
  const box = $('invInfo'), sel = UI.sel || {};
  let kind, rar, tier, lv, spec, val, worn = false;
  if (sel.gear !== undefined) {
    const i = sel.gear;
    if (!G.eq_has[i]) { box.innerHTML = `<h4>${slotLabel(i + 1)}</h4><p>Nothing equipped. Gear you find goes into your bag.</p>`; return; }
    kind = i + 1; rar = G.eq_rar[i]; tier = G.eq_tier[i]; lv = G.eq_lvl[i]; spec = G.eq_spec[i]; val = G.eq_val[i]; worn = true;
  } else if (sel.bag !== undefined) {
    const k = sel.bag;
    if (!G.b_kind[k]) { box.innerHTML = `<h4>Empty slot</h4><p>New loot lands here. Walk over items to pick them up.</p>`; return; }
    kind = G.b_kind[k]; rar = G.b_rar[k]; tier = G.b_tier[k]; lv = G.b_lvl[k]; spec = G.b_spec[k]; val = G.b_val[k];
  } else { box.innerHTML = ''; return; }
  const name = `${D.RAR_NAME[rar]} ${S.item_name(kind, rar, tier)}`;
  let lines = '';
  if (kind === D.K_TRINKET) {
    const tt = S.trinket_talents(spec, val);
    lines = tt.map(([t, c]) => `<p><b>+${c} ${D.TAL_NAME[G.player_class * D.NTAL + t]}</b> (talent ranks, even unspent)</p>`).join('');
  } else {
    const v = S.gear_fine(kind, lv), w = S.worn_fine(kind);
    const d = v - w;
    lines = `<p>Level <b>${lv}</b> · ${S.stat_name(kind)} <b>${v}</b>${worn ? ' · worn' : ` · <b style="color:${d >= 0 ? '#7dff86' : '#ff6a55'}">${d >= 0 ? '+' : ''}${d}</b> vs worn`}</p>`;
    lines += `<p>${spec ? `<b style="color:${D.RAR_COLOR[4]}">${D.SPEC_NAME[spec]}</b>: ${D.SPEC_DESC[spec]}` : 'No special power'}</p>`;
  }
  let acts = '';
  if (worn) acts = sel.gear ? `<button class="btn alt" id="aUnequip">Unequip</button>` : '';
  else acts = `<button class="btn" id="aEquip">Equip</button><button class="btn alt" id="aSell">${UI.sellArm === sel.bag ? 'Sure? Sell for ' : 'Sell '}${S.sell_price(kind, rar, val)}g</button>`;
  box.innerHTML = `<h4 style="color:${D.RAR_COLOR[rar]}">${esc(name)}</h4>${lines}<div class="acts">${acts}</div>`;
  if ($('aEquip')) $('aEquip').onclick = equipSel;
  if ($('aSell')) $('aSell').onclick = sellSel;
  if ($('aUnequip')) $('aUnequip').onclick = unequipSel;
}
function equipSel() { if (UI.sel && UI.sel.bag !== undefined) { S.bag_equip(UI.sel.bag); drawInv(); focusSel(); } }
function unequipSel() { if (UI.sel && UI.sel.gear !== undefined) { S.gear_unequip(UI.sel.gear); drawInv(); focusSel(); } }
function sellSel() {
  const k = UI.sel && UI.sel.bag;
  if (k === undefined || !G.b_kind[k]) return;
  if (UI.sellArm !== k) { UI.sellArm = k; sfx('nope'); drawInfo(); return; }
  S.bag_sell(k); UI.sellArm = -1; drawInv(); focusSel();
}
// talents
function drawTal() {
  const cls = G.player_class, wrap = $('trees');
  wrap.innerHTML = '';
  for (let tr = 0; tr < 3; tr++) {
    const col = D.TREE_COLOR[cls * 3 + tr];
    const div = document.createElement('div'); div.className = 'tree'; div.style.setProperty('--c', col);
    div.innerHTML = `<h4>${D.TREE_NAME[cls * 3 + tr]}</h4>`;
    const tl = document.createElement('div'); tl.className = 'tl';
    for (let r = 0; r < 5; r++) {
      const idx = tr * 5 + r, have = Math.min(D.TAL_MAX[idx], G.tal[idx] + S.trinket_bonus(idx));
      const b = document.createElement('button');
      b.className = 'tal' + (S.tal_unlocked(idx) ? '' : ' lock') + (UI.talSel === idx ? ' sel' : '') + (have >= D.TAL_MAX[idx] ? ' max' : '');
      b.innerHTML = `<b>${D.TAL_NAME[cls * D.NTAL + idx]}</b><span class="pips">${Array.from({ length: D.TAL_MAX[idx] }, (_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('')}</span>`;
      b.onclick = () => { if (UI.talSel === idx && input.lastDevice !== 'touch') { learn(); return; } UI.talSel = idx; drawTal(); const s = wrap.querySelector('.tal.sel'); if (s && input.lastDevice !== 'touch') s.focus({ preventScroll: true }); };
      tl.appendChild(b);
    }
    div.appendChild(tl); wrap.appendChild(div);
  }
  const idx = UI.talSel, r = G.tal[idx], tb = S.trinket_bonus(idx), pts = S.tal_avail();
  let state;
  if (!S.tal_unlocked(idx)) state = `Locked: spend ${(idx % 5) * 3} points in ${D.TREE_NAME[cls * 3 + Math.floor(idx / 5)]} first.`;
  else if (r >= D.TAL_MAX[idx]) state = 'Maxed out.';
  else if (pts) state = `${pts} point${pts > 1 ? 's' : ''} to spend.`;
  else state = 'No points left. Every second level gives one.';
  const cost = S.tal_cost() * 20;
  $('talInfo').innerHTML = `<h4>${D.TAL_NAME[cls * D.NTAL + idx]} <span style="color:var(--dim);font-size:15px">rank ${Math.min(D.TAL_MAX[idx], r + tb)}/${D.TAL_MAX[idx]}${tb ? ` (+${tb} from your trinket)` : ''}</span></h4>
    <p>${D.TAL_DESC[cls * D.NTAL + idx]}</p><p>${state}</p>
    <div class="acts"><button class="btn" id="aLearn" ${!S.tal_unlocked(idx) || r >= D.TAL_MAX[idx] || !pts ? 'disabled' : ''}>Learn</button>
    <button class="btn alt" id="aReset" ${!S.tal_cost() ? 'disabled' : ''}>${UI.resetArm ? 'Sure? ' : ''}Reset (${cost}g)</button></div>`;
  $('aLearn').onclick = learn;
  $('aReset').onclick = () => { if (!UI.resetArm) { UI.resetArm = 1; drawTal(); return; } UI.resetArm = 0; S.tal_reset(); drawTal(); };
  $('talPts').textContent = pts ? pts : '';
}
function learn() { if (S.tal_learn(UI.talSel)) { UI.resetArm = 0; drawTal(); const s = $('trees').querySelector('.tal.sel'); if (s && input.lastDevice !== 'touch') s.focus({ preventScroll: true }); } }

// ---------------------------------------------------------------- the merchant
export function openShop() { sfx('buy'); openShopScreen(); }
function openShopScreen() {
  $('shopSay').textContent = '';
  show('sShop');
  drawShop();
}
function drawShop() {
  $('shopGold').innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#f5c242" stroke="#8a5a00" stroke-width="2"/></svg>${G.gold}`;
  const list = $('shopList');
  list.innerHTML = '';
  for (let k = 0; k < 4; k++) {
    let ic, name, det, col = '#f6eee2';
    if (k === 0) { ic = itemIcon(D.K_POTION, 0); name = 'Health potion'; det = 'Restores all your health'; }
    else if (k === 3) { ic = `<svg viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="2" fill="#8a5a30" stroke="#1a1410"/><path d="M4 9a8 5 0 0 1 16 0" fill="#a8743a" stroke="#1a1410"/><text x="12" y="18" font-size="8" text-anchor="middle" fill="#ffc93c" font-family="sans-serif" font-weight="900">?</text></svg>`; name = 'Mystery chest'; det = 'Rare, epic or legendary gear'; }
    else {
      const kind = G.sh_kind[k], rar = G.sh_rar[k], lv = G.sh_lvl[k];
      ic = itemIcon(kind, rar); col = D.RAR_COLOR[rar];
      name = `${D.RAR_NAME[rar]} ${S.item_name(kind, rar, G.sh_tier[k])}${G.sh_spec[k] ? ' · ' + D.SPEC_NAME[G.sh_spec[k]] : ''}`;
      const v = S.gear_fine(kind, lv), d = v - S.worn_fine(kind);
      det = `Level ${lv} · ${S.stat_name(kind)} ${v} (${d >= 0 ? '+' : ''}${d} vs worn)`;
    }
    const b = document.createElement('button');
    b.className = 'ware' + (G.sh_sold[k] ? ' sold' : '');
    b.innerHTML = `<span class="ic">${ic}</span><span><b style="color:${col}">${esc(tc(name))}</b><span>${G.sh_sold[k] ? 'Sold out' : det}</span></span><span class="pr">${G.sh_price[k]}g</span>`;
    b.onclick = () => { const say = S.shop_buy(k); $('shopSay').textContent = say; drawShop(); const bs = list.querySelectorAll('.ware'); if (bs[k] && input.lastDevice !== 'touch') bs[k].focus(); };
    list.appendChild(b);
  }
}
$('bShopLeave').onclick = () => leaveShop();
function leaveShop() { S.shop_close(); show(null); }
$('bTrade').onclick = () => { UI.marks = new Set(); show('sTrade'); drawTrade(); };
$('bTradeBack').onclick = () => openShopScreen();
function drawTrade() {
  $('tradeGold').innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#f5c242" stroke="#8a5a00" stroke-width="2"/></svg>${G.gold}`;
  const grid = $('tradeGrid');
  grid.innerHTML = '';
  const marks = [...UI.marks];
  const rar = marks.length ? G.b_rar[marks[0]] : -1;
  const need = S.trade_need(marks.length, rar);
  for (let k = 0; k < D.BAG; k++) {
    const kind = G.b_kind[k];
    const b = document.createElement('button');
    b.className = 'slot' + (UI.marks.has(k) ? ' mark sel' : '');
    b.innerHTML = kind ? itemIcon(kind, G.b_rar[k]) + (kind !== D.K_TRINKET ? `<span class="lv">${G.b_lvl[k]}</span>` : '') : '';
    if (kind) b.style.boxShadow = `inset 0 0 0 2px ${D.RAR_COLOR[G.b_rar[k]]}66`;
    b.onclick = () => {
      if (!kind) { sfx('nope'); return; }
      if (UI.marks.has(k)) UI.marks.delete(k);
      else {
        if (kind === D.K_TRINKET) { $('tradeSay').textContent = "Trinkets can't be traded."; sfx('nope'); return; }
        if (UI.marks.size && G.b_rar[k] !== rar) { $('tradeSay').textContent = 'They must all be the same rarity.'; sfx('nope'); return; }
        if (UI.marks.size >= S.trade_need(UI.marks.size + 1, G.b_rar[k])) { sfx('nope'); return; }
        UI.marks.add(k);
      }
      sfx('pickup'); $('tradeSay').textContent = ''; drawTrade();
      const s = grid.querySelectorAll('.slot')[k]; if (s && input.lastDevice !== 'touch') s.focus();
    };
    grid.appendChild(b);
  }
  const ok = marks.length && marks.length === need;
  $('bTradeGo').disabled = !ok;
  if (marks.length) {
    const fee = rar >= D.RAR_EPIC ? Math.floor(G.gold / 5) : Math.floor(G.gold / 10);
    $('bTradeGo').textContent = ok ? `Trade (${fee}g)` : `Trade (${marks.length}/${need})`;
    $('tradeRule').textContent = rar === D.RAR_LEG ? `${need} legendaries make one better legendary (fee 20%). All of one slot: a better one of that slot.` : `${need} ${D.RAR_NAME[rar].toLowerCase()} items make one ${D.RAR_NAME[Math.min(4, rar + 1)].toLowerCase()} item (fee ${rar >= D.RAR_EPIC ? 20 : 10}%).`;
  } else { $('bTradeGo').textContent = 'Trade'; }
}
$('bTradeGo').onclick = () => {
  const r = S.trade([...UI.marks]);
  UI.marks = new Set();
  if (r) {
    const k = r.slot;
    $('tradeSay').innerHTML = `<span style="color:${D.RAR_COLOR[G.b_rar[k]]}">${esc(D.RAR_NAME[G.b_rar[k]])} ${esc(S.item_name(G.b_kind[k], G.b_rar[k], G.b_tier[k]))} LV${G.b_lvl[k]}!</span> Paid ${r.fee}g. It is in your bag.`;
  }
  drawTrade();
};

// ---------------------------------------------------------------- HUD, numbers, banners
const nums = [];
export function num(x, y, z, text, cls = '') {
  const el = document.createElement('div'); el.className = 'num ' + cls; el.textContent = text; $('nums').appendChild(el);
  nums.push({ el, x: x + (Math.random() - 0.5) * 0.8, y, z, t: 0 });
}
const tv = new V3();
function stepNums(dt) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.t += dt;
    if (n.t > 0.9) { n.el.remove(); nums.splice(i, 1); continue; }
    tv.set(n.x, n.y + n.t * 2.4, n.z).project(camera);
    n.el.style.left = ((tv.x + 1) / 2 * innerWidth) + 'px'; n.el.style.top = ((1 - tv.y) / 2 * innerHeight) + 'px';
    n.el.style.opacity = n.t < 0.6 ? 1 : 1 - (n.t - 0.6) / 0.3;
    const s = n.t < 0.12 ? 0.6 + n.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (n.t - 0.12));
    n.el.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
}
export function banner(title, sub, t = 2) { $('bTitle').textContent = title; $('bSub').textContent = sub; $('banner').classList.add('on'); UI.bannerT = t; }
export function hurt() { $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 160); }
let flashA = 0;
export function flash(col, a = 0.7) { $('flash').style.background = col; flashA = Math.max(flashA, a); }
export function lootCard(e) {
  const k = e.slot;
  if (k === undefined) return;
  const kind = G.b_kind[k], rar = G.b_rar[k];
  if (!kind) return;
  $('lootIc').innerHTML = itemIcon(kind, rar);
  $('lootT').textContent = tc(`${D.RAR_NAME[rar]} ${S.item_name(kind, rar, G.b_tier[k])}`);
  $('lootT').style.color = D.RAR_COLOR[rar];
  if (kind === D.K_TRINKET) $('lootS').textContent = S.trinket_talents(G.b_spec[k], G.b_val[k]).map(([t, c]) => `+${c} ${tc(D.TAL_NAME[G.player_class * D.NTAL + t])}`).join(', ');
  else $('lootS').textContent = `Level ${G.b_lvl[k]} · ${S.stat_name(kind)} ${S.gear_fine(kind, G.b_lvl[k])}${e.better ? ' · UPGRADE! Open your bag to equip' : ''}`;
  $('loot').style.boxShadow = `inset 0 0 0 2px ${D.RAR_COLOR[rar]}, 0 10px 24px rgba(0,0,0,.45)`;
  $('loot').classList.add('on');
  UI.toastT = 3.2;
  if (e.better) $('hBag').classList.add('alert');
}
export function roomStart() {
  if (G.room_num === 1) banner('FLOOR ' + G.floor_num, D.THEME_NAME[G.theme] + ' · ' + D.MOD_NAME[G.fmod], 2.2);
  else if (G.room_num === D.BOSS_ROOM) { /* bossIntro */ }
  else if (G.sp) banner(['', 'TREASURE ROOM', 'SHRINE', 'FOUNTAIN', 'THE ARENA', 'TRAPPED ROOM'][G.sp], 'ROOM ' + G.room_num + ' OF 5', 1.6);
  fadeIn();
  drawMinimap();
}
export function bossIntro() {
  if (G.floor_num === D.LAST_FLOOR) banner('THE TOWER KING', 'SHE IS MINE! TURN BACK!', 3);
  else banner(S.boss_name(), ['EASY', 'MEDIUM', 'HARD'][G.boss_tier] + ' · ' + D.BOSS_ART_NAME[G.boss_art], 2.2);
}
function fadeIn() { $('fade').style.opacity = 0; }
export function fadeThen(f) { $('fade').style.opacity = 1; setTimeout(() => { f(); setTimeout(fadeIn, 60); }, 300); }
function setText(id, v) { if (UI.lastHud[id] !== v) { UI.lastHud[id] = v; $(id).textContent = v; } }
function setW(id, v) { const w = Math.max(0, Math.min(100, v)).toFixed(1) + '%'; if (UI.lastHud[id] !== w) { UI.lastHud[id] = w; $(id).style.width = w; } }
export function drawMinimap() {
  const c = $('minimap'), x = c.getContext('2d'), w = c.width, h = c.height;
  x.clearRect(0, 0, w, h);
  const n = 6, bw = 34, gap = (w - 24 - n * bw) / (n - 1), y = h / 2;
  for (let i = 0; i < n; i++) {
    const bx = 12 + i * (bw + gap);
    if (i < n - 1) { x.fillStyle = 'rgba(255,240,220,.25)'; x.fillRect(bx + bw, y - 2, gap, 4); }
    const cur = i + 1 === G.room_num, done = i + 1 < G.room_num, boss = i === n - 1, sp = i + 1 === G.sp_room;
    x.fillStyle = cur ? '#ffc93c' : done ? 'rgba(255,240,220,.55)' : 'rgba(255,240,220,.14)';
    x.beginPath(); x.roundRect(bx, y - 15, bw, 30, 7); x.fill();
    x.font = '900 18px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (boss) { x.fillStyle = cur ? '#2a1600' : '#ff6a55'; x.fillText('☠', bx + bw / 2, y + 1); }
    else if (sp && !done) { x.fillStyle = cur ? '#2a1600' : '#ffc93c'; x.fillText('★', bx + bw / 2, y + 1); }
  }
}
export function frame(dt) {
  stepNums(dt);
  if (UI.bannerT > 0) { UI.bannerT -= dt; if (UI.bannerT <= 0) $('banner').classList.remove('on'); }
  if (UI.toastT > 0) { UI.toastT -= dt; if (UI.toastT <= 0) $('loot').classList.remove('on'); }
  if (flashA > 0) { flashA = Math.max(0, flashA - dt * 2.5); $('flash').style.opacity = flashA; }
  if (G.state !== 'play' && G.state !== 'rescue') return;
  // the HUD
  setText('hLvl', 'LV ' + G.lvl);
  setW('xpfill', G.xp / G.xpnext * 100);
  setText('hHp', G.hp + '/' + G.maxhp);
  setW('hpfill', G.hp / G.maxhp * 100);
  setText('hAtk', S.atk_fine()); setText('hDef', S.total_def());
  setText('hGold', G.gold); setText('hPots', G.potions);
  const wh = G.room_num === D.BOSS_ROOM ? 'BOSS' : 'ROOM ' + G.room_num;
  if (UI.lastHud.where !== G.floor_num + wh) {
    UI.lastHud.where = G.floor_num + wh;
    $('hWhere').innerHTML = `FLOOR ${G.floor_num}<small>${D.THEME_NAME[G.theme]} · ${wh}</small>`;
    drawMinimap();
  }
  // the class meter: blink cooldown (mage), roll (warrior / hunter with a pet)
  const cls = G.player_class;
  let mn, mv;
  if (cls === 1) { mn = 'BLINK'; mv = G.blink_cd ? 1 - G.blink_cd / (150 - S.TAL.QBLINK * 22) : 1; }
  else if (cls === 2 && !G.pet_type) { mn = 'TAME'; mv = 1; }
  else { mn = 'ROLL'; mv = G.roll_cd ? 1 - G.roll_cd / (G.eq_spec[3] === D.SP_QUICK ? 20 : 40) : 1; }
  setText('hMeterN', mn); setW('abfill', mv * 100);
  setText('tSpec', cls === 1 ? 'BLINK' : (cls === 2 && !G.pet_type ? 'TAME' : 'ROLL'));
  const pet = G.pet_type;
  $('hPet').hidden = !pet;
  if (pet) { setText('hPetN', G.pet_down ? 'PET DOWN' : D.PET_NAME[pet]); setW('petfill', G.pet_down ? 0 : G.pet_hp / S.pet_max() * 100); }
  // the boss bar
  const bb = $('bossbar');
  const showBar = G.boss_on && !G.bintro;
  bb.hidden = !showBar;
  if (showBar) {
    setW('bossfill', G.bhp / G.bmaxhp * 100);
    setText('bossname', S.boss_name() + (G.bform === D.BF_WIZ ? ' · SORCERER' : ''));
    bb.classList.toggle('ward', G.bward > 0);
  }
  // the message line
  if (UI.msgId !== G.msg_id) { UI.msgId = G.msg_id; $('msg').textContent = G.msg; $('msg').style.color = G.msg_color; }
  $('msg').style.opacity = G.msg ? 1 : 0;
  if (S.tal_avail() && !$('hBag').classList.contains('alert')) $('hBag').classList.add('alert');
}
$('hPot').onclick = () => { S.drink_potion(); };
$('hBag').addEventListener('click', () => $('hBag').classList.remove('alert'));
