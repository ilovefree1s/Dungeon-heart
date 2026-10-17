// ============================================================================
//  DUNGEON HEART  -  ui: the HUD, the numbers and banners, and every screen
//  (title, class, story, gear and bag, talents, merchant, trade, pause,
//  options, death, victory). Touch, mouse, keys and controllers all work.
// ============================================================================
import * as S from './sim.js';
import * as D from './data.js';
import { camera, V3, wz } from './engine.js';
import { sfx, startAudio, setMusic, setSfx, audioState } from './audio.js';
import { menuKeys, input } from './input.js';
import { itemPic, heroPic, merchantPic, petPic } from './icons.js';
import { PET_NAMES } from './pets.js';
import * as DG from './dungeon.js';
import { talGlyph } from './glyphs.js';
const G = S.G;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const tc = s => s.toLowerCase().replace(/(^|\s|-)\S/g, m => m.toUpperCase());

export const UI = { modal: null, hooks: {}, toastT: 0, bannerT: 0, msgId: -1, lastHud: {}, sel: null, talSel: 0, marks: new Set(), sellArm: -1 };

// ---------------------------------------------------------------- screens
const SCREENS = ['sTitle', 'sSeed', 'sMap', 'sClass', 'sStory', 'sInv', 'sTal', 'sName', 'sShop', 'sTrade', 'sPause', 'sOpt', 'sDead', 'sWin'];
export function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  UI.modal = id;
  if (id) { $('banner').classList.remove('on'); UI.bannerT = 0; }
  const play = !id || id === null;
  $('hud').hidden = !(G.state === 'play' || G.state === 'rescue') || (id && id !== 'sInv' && id !== 'sTal' && id !== 'sShop' && id !== 'sTrade' && id !== 'sPause' && id !== 'sDead');
  $('touch').hidden = !!id || !(G.state === 'play');
  $('minimap').hidden = !!id || G.state !== 'play';
  $('padHelp').hidden = !!id || G.state !== 'play';
  $('itemBox').hidden = !!id || G.state !== 'play' || !(G.mode === 'dungeon' && G.dg_items);
  if (id) {
    setTimeout(() => { const f = firstFocus(); if (f && input.lastDevice !== 'touch') { setCur(f, false); if (f.dataset.focusSel && !f.classList.contains('sel') && input.lastDevice === 'pad') f.click(); } }, 30);
  }
  UI.hooks.onModal && UI.hooks.onModal(id);
}
// the menu cursor: an element of the open screen, marked .pfocus (and given the browser focus too)
function setCur(el, scroll = true) {
  if (!el) return;
  if (UI.cur && UI.cur !== el) UI.cur.classList.remove('pfocus');
  UI.cur = el; el.classList.add('pfocus');
  try { el.focus({ preventScroll: true }); } catch (e) { }
  if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function curEl() {
  const s = UI.modal && $(UI.modal);
  if (!s) return null;
  for (const c of [UI.cur, document.activeElement]) if (c && s.contains(c) && c.offsetParent !== null && !c.closest('[hidden]')) return c;
  return null;
}
function firstFocus() {
  const s = UI.modal && $(UI.modal);
  if (!s) return null;
  for (const q of ['.sel', '.slot:not(.ghost)[data-focus-sel]', '.tal[data-focus-sel]', '.btn:not([disabled]):not([hidden]),button.card', 'button:not([disabled])']) { const e = s.querySelector(q); if (e) return e; }
  return null;
}
// arrow keys and the d-pad move the focus to the nearest button that way
function navigate(dir) {
  const s = $(UI.modal);
  if (!s) return;
  const els = [...s.querySelectorAll('button:not([disabled]),input')].filter(e => e.offsetParent !== null && !e.closest('[hidden]'));
  const cur = curEl();
  if (!cur) { setCur(firstFocus() || els[0]); return; }
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
  if (best) { setCur(best); if (best.dataset.focusSel && !best.classList.contains('sel')) best.click(); }
  else if (cur.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) { cur.value = +cur.value + (dir === 'right' ? 1 : -1); cur.dispatchEvent(new Event('input')); }
}
export function menuStep() {
  const ks = menuKeys();
  for (const k of ks) {
    if (!UI.modal) {
      if (G.state !== 'play') continue;
      if (k === 'bag') openInv();
      else if (k === 'map') openMap();
      else if (k === 'back' && input.lastDevice === 'kb' || k === 'pause') openPause();
      continue;
    }
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { navigate(k); continue; }
    if (k === 'ok') { const a = curEl(); if (a) a.click(); else setCur(firstFocus()); continue; }
    if (k === 'back' || (k === 'bag' && (UI.modal === 'sInv' || UI.modal === 'sTal'))) { back(); continue; }
    if (k === 'lb' && UI.modal === 'sTal') { $('bTalGear').click(); continue; }
    if (k === 'rb' && UI.modal === 'sInv') { openTal(); continue; }
    if (k === 'pot' && UI.modal === 'sInv' && UI.sel && UI.sel.bag !== undefined) { sellSel(); continue; }
  }
}
function back() {
  switch (UI.modal) {
    case 'sClass': title(); break;
    case 'sInv': case 'sTal': case 'sPause': closeModal(); break;
    case 'sShop': leaveShop(); break;
    case 'sTrade': openShopScreen(); break;
    case 'sOpt': show(UI.optBack || 'sTitle'); break;
    case 'sMap': closeModal(); break;
    default: break;
  }
}
export function closeModal() { S.save_game(); show(null); }
export function openMap() {
  if (G.mode !== 'dungeon' || !G.dg) return;
  sfx('pickup'); show('sMap');
  $('mapTitle').textContent = 'FLOOR ' + G.dg_no + ' · ' + G.dg_seed_text;
  drawDungeonMap($('mapBig'), true);
  $('mapLegend').textContent = (G.dg_map ? 'You have the map: every room is shown. ' : 'Rooms appear as you find them (a map is hidden in a chest). ') + '▲ entrance · ■ chest · ◆ great chest · ☠ the keeper';
}
$('bMapClose').onclick = () => closeModal();
$('hMap').onclick = () => openMap();

// ---------------------------------------------------------------- title, class, story
export function title() {
  G.state = 'title';
  $('bCont').hidden = !S.has_save();
  show('sTitle');
  UI.hooks.title && UI.hooks.title();
}
const CLASS_TIP = ['Warrior: swings hit everything in front of you, and you can roll out of danger.',
  'Mage: fire, frost or arcane bolts from afar, and a blink through danger. Fragile!',
  'Hunter: the hardest-hitting arrows. Shoot a weak slime, bat or spider, then tame it as a pet.'];
function classTip(c) { $('classTip').textContent = CLASS_TIP[c]; }
// the dungeon run: a seed, then the class
$('bDungeon').onclick = () => { startAudio(); sfx('pickup'); $('seedIn').value = DG.randomSeedText(); show('sSeed'); };
$('bSeedRnd').onclick = () => { sfx('pickup'); $('seedIn').value = DG.randomSeedText(); };
$('bSeedBack').onclick = () => title();
$('bSeedGo').onclick = () => {
  const v = $('seedIn').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || DG.randomSeedText();
  UI.dgSeed = v; sfx('pickup');
  for (const im of document.querySelectorAll('[data-hero]')) if (!im.src) im.src = heroPic(+im.dataset.hero);
  show('sClass'); classTip(0); UI.hooks.classPreview && UI.hooks.classPreview(0);
};
$('seedIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('bSeedGo').click(); } });
$('bNew').onclick = () => {
  UI.dgSeed = null;
  startAudio(); sfx('pickup');
  for (const im of document.querySelectorAll('[data-hero]')) if (!im.src) im.src = heroPic(+im.dataset.hero);
  show('sClass'); classTip(0); UI.hooks.classPreview && UI.hooks.classPreview(0);
};
$('bCont').onclick = () => { startAudio(); sfx('door'); fadeThen(() => { if (S.load_game()) { show(null); } else title(); }); };
$('bOpt').onclick = () => { startAudio(); UI.optBack = 'sTitle'; openOptions(); };
for (const c of document.querySelectorAll('.card')) {
  c.onclick = () => {
    sfx('levelup'); UI.cls = +c.dataset.cls;
    if (UI.dgSeed) { const seed = UI.dgSeed; sfx('door'); fadeThen(() => { S.new_hero(UI.cls); S.dg_start(seed); show(null); }); return; }
    show('sStory'); UI.hooks.story && UI.hooks.story(UI.cls);
  };
  c.onfocus = c.onmouseenter = () => { classTip(+c.dataset.cls); UI.hooks.classPreview && UI.hooks.classPreview(+c.dataset.cls); };
}
$('bClassBack').onclick = () => (UI.dgSeed ? show('sSeed') : title());
$('bStory').onclick = () => { sfx('door'); fadeThen(() => { S.new_hero(UI.cls); S.dg_start(DG.randomSeedText(), 1); show(null); }); };

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
function openPause() { sfx('pickup'); $('bUnstuck').hidden = G.mode !== 'dungeon'; show('sPause'); }
// stuck somewhere? back to this floor's entrance (keys, items, opened doors and chests all kept)
$('bUnstuck').onclick = () => { sfx('door'); fadeThen(() => { S.dg_to_entrance(); show(null); }); };
$('hPause').onclick = () => openPause();
$('bResume').onclick = () => closeModal();
$('bPauseBag').onclick = () => openInv();
$('bPauseOpt').onclick = () => { UI.optBack = 'sPause'; openOptions(); };
$('bQuit').onclick = () => { S.save_game(); title(); };

// ---------------------------------------------------------------- death, victory
export function dead() { $('deadWhere').textContent = G.mode === 'dungeon' ? `on floor ${G.dg_no} (seed ${G.dg_seed_text}): back to its entrance, keys and items kept` : 'on floor ' + G.floor_num; setTimeout(() => show('sDead'), 900); }
$('bRetry').onclick = () => { sfx('door'); fadeThen(() => { S.respawn(); show(null); }); };
export function win() {
  $('winStats').textContent = `Level ${G.lvl} · ${G.kills} monsters · ${G.gold} gold`;
  setTimeout(() => show('sWin'), 600);
}
$('bWin').onclick = () => { title(); };

// ---------------------------------------------------------------- the character screen (as on the SNES)
// gear around the hero: helmet, gloves / armor, boots / weapon, trinket, shield
const DOLL = [[D.K_HELMET, 1, 1], [D.K_GLOVES, 3, 1], [D.K_ARMOR, 1, 2], [D.K_BOOTS, 3, 2], [D.K_WEAPON, 1, 3], [D.K_TRINKET, 2, 3], [D.K_SHIELD, 3, 3]];
function slotLabel(kind) {
  if (kind === D.K_SHIELD) return ['SHIELD', 'ORB', 'QUIVER'][G.player_class];
  return D.KIND_NAME[kind];
}
const pic = (kind, rar, tier = 0) => itemPic(kind, rar, G.player_class, tier);
// an item's stats as colored chips: +7 STR +5 STA (arr: b_st / eq_st / sh_st / i_st, k: slot)
export function statHTML(arr, k) {
  let h = '';
  for (let j = 0; j < 3; ++j) { const t = arr[k * 6 + j * 2], v = arr[k * 6 + j * 2 + 1]; if (t) h += `<b style="color:${D.STAT_COLOR[t]}">+${v} ${D.STAT_NAME[t]}</b>`; }
  return h ? `<div class="sts">${h}</div>` : '';
}
export function statText(arr, k) {
  const o = [];
  for (let j = 0; j < 3; ++j) { const t = arr[k * 6 + j * 2]; if (t) o.push(`+${arr[k * 6 + j * 2 + 1]} ${D.STAT_NAME[t]}`); }
  return o.join(' ');
}
const coinTxt = n => `<span class="coin"></span>${n}`;
function slotHTML(kind, rar, lv, ghost, tier = 0) {
  return `<img alt="" src="${pic(kind, ghost ? 0 : rar, ghost ? 0 : tier)}">${!ghost && kind !== D.K_TRINKET && lv ? `<span class="lv">${lv}</span>` : ''}`;
}
function styleSlot(b, rar, full) { b.style.setProperty('--rc', full ? D.RAR_COLOR[rar] : '#8a6428'); b.classList.toggle('full', !!full); }
export function openInv() {
  sfx('pickup');
  UI.sel = UI.sel || { bag: 0 };
  UI.sellArm = -1;
  show('sInv');
  drawInv();
  focusSel();
}
$('hBag').onclick = () => openInv();
$('bInvClose').onclick = () => closeModal();
$('bTalents').onclick = () => openTal();
const isUpgrade = k => S.bag_better(k); // (level and stats together, weighed for your class)
function drawInv() {
  $('invName').textContent = `${D.CLASS_NAME[G.player_class]} LV ${G.lvl}`;
  $('invXp').style.width = `calc(${Math.min(100, G.xp / G.xpnext * 100)}% - 4px)`;
  $('invHp').textContent = `HP ${G.hp}/${G.maxhp}`;
  $('invHpBar').style.width = `calc(${G.hp / G.maxhp * 100}% - 4px)`;
  $('invGold').innerHTML = coinTxt(G.gold);
  $('invPots').innerHTML = `<img alt="" src="${pic(D.K_POTION, 0)}" style="width:22px;height:22px;vertical-align:-5px">${G.potions}`;
  const spd = S.spd_fine();
  $('invSpd').textContent = `SPD ${spd >= 0 ? '+' : ''}${spd}`;
  $('invAtk').innerHTML = `ATK ${S.atk_fine()} &nbsp; DEF ${S.total_def()}`;
  const main = D.MAIN_STAT[G.player_class];
  const tip = ['', 'warrior damage', 'hunter damage · crit on gear', 'mage damage', 'max health', 'less damage taken'];
  const [dlo, dhi] = S.dmg_range();
  $('invStats').innerHTML = `<span class="dmg" style="--c:#ffd75a" title="Damage of a normal hit (critical hits double it)">DMG<b>${dlo}-${dhi}</b></span>` + [1, 2, 3, 4, 5].map(t => `<span class="${t === main ? 'main' : ''}" style="--c:${D.STAT_COLOR[t]}" title="${D.STAT_LONG[t]}: ${tip[t]}">${D.STAT_NAME[t]}<b>${S.stat_total(t)}</b></span>`).join('');
  // the doll
  const dl = $('doll');
  dl.innerHTML = '';
  const al = document.createElement('div'); al.className = 'alcove'; al.innerHTML = `<img alt="" src="${heroPic(G.player_class)}">`;
  dl.appendChild(al);
  for (const [kind, cx, cy] of DOLL) {
    const i = kind - 1, has = G.eq_has[i];
    const b = document.createElement('button');
    b.className = 'slot' + (has ? '' : ' ghost') + (UI.sel && UI.sel.gear === i ? ' sel' : '');
    b.style.gridColumn = cx; b.style.gridRow = cy;
    b.innerHTML = slotHTML(kind, G.eq_rar[i], G.eq_lvl[i], !has, G.eq_tier[i]);
    styleSlot(b, G.eq_rar[i], has);
    b.onclick = () => { if (UI.sel && UI.sel.gear === i && input.lastDevice !== 'touch') { unequipSel(); return; } UI.sel = { gear: i }; UI.sellArm = -1; drawInv(); focusSel(); };
    b.setAttribute('aria-label', slotLabel(kind)); b.dataset.focusSel = '1';
    dl.appendChild(b);
  }
  // the bag
  const bg = $('bagGrid');
  bg.innerHTML = '';
  let n = 0;
  for (let k = 0; k < D.BAG; k++) {
    const kind = G.b_kind[k];
    if (kind) n++;
    const b = document.createElement('button');
    b.className = 'slot' + (UI.sel && UI.sel.bag === k ? ' sel' : '') + (isUpgrade(k) ? ' up' : '');
    if (kind) b.innerHTML = slotHTML(kind, G.b_rar[k], G.b_lvl[k], false, G.b_tier[k]);
    styleSlot(b, G.b_rar[k], kind);
    b.onclick = () => { if (UI.sel && UI.sel.bag === k && input.lastDevice !== 'touch') { equipSel(); return; } UI.sel = { bag: k }; UI.sellArm = -1; drawInv(); focusSel(); };
    b.setAttribute('aria-label', kind ? S.item_name(kind, G.b_rar[k], G.b_tier[k]) : 'Empty'); b.dataset.focusSel = '1';
    bg.appendChild(b);
  }
  $('bagTitle').textContent = `BAG ${n}/${D.BAG}`;
  const pts = S.tal_avail();
  $('talPts').textContent = pts ? pts : '';
  drawInfo();
}
function focusSel() { setTimeout(() => { const s = $(UI.modal || 'sInv').querySelector('.sel'); if (s && input.lastDevice !== 'touch') setCur(s, false); }, 0); }
// the box under the screen: what the picked item is, and what you can do with it
// what the picked item gives, each number set against the piece worn in the same slot (when it's in the bag)
const statOf = (arr, k, t) => { let v = 0; for (let j = 0; j < 3; ++j) if (arr[k * 6 + j * 2] === t) v += arr[k * 6 + j * 2 + 1]; return v; };
function chip(name, col, v, d) {
  const dd = d === null ? '' : `<i style="color:${d > 0 ? '#7dff86' : d < 0 ? '#ff6a55' : '#8a92b0'}">${d > 0 ? '+' : ''}${d}</i>`;
  return `<span class="chip" style="--c:${col}">${name} <b>${v}</b>${dd}</span>`;
}
function itemLines(kind, rar, lv, spec, val, worn, sa, sk) {
  const i = kind - 1, has = G.eq_has[i], cmp = !worn; // (a bag item is compared with what's worn there)
  let chips = '';
  if (kind !== D.K_TRINKET) { const v = S.gear_fine(kind, lv); chips += chip(S.stat_name(kind), '#ffd75a', v, cmp ? v - S.worn_fine(kind) : null); }
  for (let t = 1; t <= 5; t++) {
    const v = statOf(sa, sk, t), w = has ? statOf(G.eq_st, i, t) : 0;
    if (v || (cmp && w)) chips += chip(D.STAT_NAME[t], D.STAT_COLOR[t], v, cmp ? v - w : null);
  }
  let extra;
  if (kind === D.K_TRINKET) extra = S.trinket_talents(spec, val).map(([t, c]) => `+${c} ${D.TAL_NAME[G.player_class * D.NTAL + t]}`).join(' · ') + ' (talent ranks)';
  else extra = spec ? `<b style="color:${D.RAR_COLOR[4]}">${D.SPEC_NAME[spec]}</b>: ${D.SPEC_DESC[spec]}` : 'No special power';
  return `<div class="chips">${chips}</div><p class="spec">${extra}</p>`;
}
function itemTitle(kind, rar, tier, lv) {
  return `<h3 style="color:${D.RAR_COLOR[rar]}">${esc(D.RAR_NAME[rar])} ${esc(S.item_name(kind, rar, tier))}${kind !== D.K_TRINKET ? ' LV' + lv : ''}</h3>`;
}
function drawInfo() {
  const box = $('invInfo'), sel = UI.sel || {};
  let kind, rar, tier, lv, spec, val, worn = false, sa, sk;
  if (sel.gear !== undefined) {
    const i = sel.gear;
    if (!G.eq_has[i]) { box.innerHTML = `<h3>${slotLabel(i + 1)}</h3><p>Nothing worn here. Pick something from your bag to wear it.</p>`; return; }
    kind = i + 1; rar = G.eq_rar[i]; tier = G.eq_tier[i]; lv = G.eq_lvl[i]; spec = G.eq_spec[i]; val = G.eq_val[i]; worn = true; sa = G.eq_st; sk = i;
  } else if (sel.bag !== undefined) {
    const k = sel.bag;
    if (!G.b_kind[k]) { box.innerHTML = `<h3>Empty</h3><p>Loot you pick up lands in your bag.</p>`; return; }
    kind = G.b_kind[k]; rar = G.b_rar[k]; tier = G.b_tier[k]; lv = G.b_lvl[k]; spec = G.b_spec[k]; val = G.b_val[k]; sa = G.b_st; sk = k;
  } else { box.innerHTML = ''; return; }
  let acts = '';
  if (worn) acts = sel.gear ? `<button class="mbtn" id="aUnequip">Unequip</button>` : '';
  else acts = `<button class="mbtn go" id="aEquip">Equip</button><button class="mbtn${UI.sellArm === sel.bag ? ' warn' : ''}" id="aSell">${UI.sellArm === sel.bag ? 'Tap again to sell for ' : 'Sell for '}<span class="coin"></span>${S.sell_price(kind, rar, val)}</button>`;
  const verdict = worn ? '<span class="vd" style="color:#8a92b0">Worn</span>' : S.bag_better(sel.bag) ? '<span class="vd" style="color:#7dff86">&#x25B2; Better for you</span>' : '<span class="vd" style="color:#8a92b0">Not better than worn</span>';
  box.innerHTML = itemTitle(kind, rar, tier, lv) + itemLines(kind, rar, lv, spec, val, worn, sa, sk) + `<div class="acts">${verdict}${acts}</div>`;
  if ($('aEquip')) $('aEquip').onclick = equipSel;
  if ($('aSell')) $('aSell').onclick = sellSel;
  if ($('aUnequip')) $('aUnequip').onclick = unequipSel;
}
function equipSel() { if (UI.sel && UI.sel.bag !== undefined && G.b_kind[UI.sel.bag]) { S.bag_equip(UI.sel.bag); sfx('pickup'); drawInv(); focusSel(); } }
function unequipSel() { if (UI.sel && UI.sel.gear !== undefined) { S.gear_unequip(UI.sel.gear); drawInv(); focusSel(); } }
function sellSel() {
  const k = UI.sel && UI.sel.bag;
  if (k === undefined || !G.b_kind[k]) return;
  if (UI.sellArm !== k) { UI.sellArm = k; sfx('nope'); drawInfo(); return; }
  S.bag_sell(k); sfx('coin'); UI.sellArm = -1; drawInv(); focusSel();
}

// ---------------------------------------------------------------- talents (three trees of medallions)
function openTal() { sfx('pickup'); UI.freeArm = 0; show('sTal'); drawTal(); focusSel(); }
$('bTalClose').onclick = () => closeModal();
// setting the pet free asks twice (as selling does), then it's gone and another can be tamed
$('bPetFree').onclick = () => {
  if (!G.pet_type) return;
  if (UI.freeArm !== G.pet_type) { UI.freeArm = G.pet_type; sfx('nope'); drawTal(); return; }
  UI.freeArm = 0; S.pet_abandon(); S.save_game(); drawTal();
};
$('bTalGear').onclick = () => { show('sInv'); drawInv(); focusSel(); };
function drawTal() {
  const cls = G.player_class, wrap = $('trees'), pts = S.tal_avail();
  $('talTitle').textContent = `${D.CLASS_NAME[cls]} TALENTS`;
  $('talPoints').textContent = `POINTS ${pts}`;
  // the hunter's pet: who it is and how it's doing (or how to get one)
  const tp = $('talPet'); tp.hidden = cls !== 2;
  if (cls === 2) {
    const pet = G.pet_type; tp.classList.toggle('none', !pet);
    if (pet) {
      $('talPetPic').src = petPic(pet); $('talPetPic').hidden = false;
      $('talPetName').textContent = (G.pet_name || D.PET_NAME[pet]).toUpperCase();
      $('talPetInfo').textContent = `${D.PET_NAME[pet]} · ${G.pet_down ? `DOWN: back in ${Math.ceil(G.pet_down / 60)} s (or drink a potion at full HP)` : `HP ${G.pet_hp}/${S.pet_max()}`}`;
      $('talPetFill').style.width = (G.pet_down ? 0 : G.pet_hp / S.pet_max() * 100) + '%';
      const fb = $('bPetFree'), armed = UI.freeArm === pet;
      fb.textContent = armed ? 'Sure? Tap again' : 'Set free'; fb.classList.toggle('warn', armed);
    } else {
      $('talPetPic').hidden = true;
      $('talPetName').textContent = 'NO PET YET';
      $('talPetInfo').textContent = 'Hit a weak slime, bat or spider, then tame it with the blue button.';
    }
  }
  wrap.innerHTML = '';
  for (let tr = 0; tr < 3; tr++) {
    const div = document.createElement('div'); div.className = 'tree'; div.style.setProperty('--c', D.TREE_COLOR[cls * 3 + tr]);
    div.innerHTML = `<h3>${D.TREE_NAME[cls * 3 + tr]}</h3>`;
    const tl = document.createElement('div'); tl.className = 'tl';
    for (let r = 0; r < 5; r++) {
      const idx = tr * 5 + r, max = D.TAL_MAX[idx], have = Math.min(max, G.tal[idx] + S.trinket_bonus(idx));
      const b = document.createElement('button');
      b.className = 'tal' + (S.tal_unlocked(idx) ? '' : ' lock') + (have ? '' : ' zero') + (UI.talSel === idx ? ' sel' : '') + (have >= max ? ' max' : '');
      b.innerHTML = `<span class="med">${talGlyph(cls * D.NTAL + idx)}</span><span class="rk">${have}/${max}${S.trinket_bonus(idx) ? '+' : ''}</span><span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('')}</span>`;
      b.setAttribute('aria-label', D.TAL_NAME[cls * D.NTAL + idx]); b.dataset.focusSel = '1';
      b.onclick = () => { if (UI.talSel === idx && input.lastDevice !== 'touch') { learn(); return; } UI.talSel = idx; UI.resetArm = 0; drawTal(); focusSel(); };
      tl.appendChild(b);
    }
    div.appendChild(tl); wrap.appendChild(div);
  }
  const idx = UI.talSel, r = G.tal[idx], tb = S.trinket_bonus(idx), max = D.TAL_MAX[idx];
  let state;
  if (!S.tal_unlocked(idx)) state = `Locked: ${(idx % 5) * 3} points in ${D.TREE_NAME[cls * 3 + Math.floor(idx / 5)]} first.`;
  else if (r >= max) state = 'Maxed out.';
  else if (pts) state = `${pts} point${pts > 1 ? 's' : ''} to spend.`;
  else state = 'No points left. Every second level gives one.';
  const cost = S.tal_cost() * 20, can = S.tal_unlocked(idx) && r < max && pts;
  $('talInfo').innerHTML = `<h3 style="color:${D.TREE_COLOR[cls * 3 + Math.floor(idx / 5)]}">${D.TAL_NAME[cls * D.NTAL + idx]}${tb ? ` <span style="color:#ffe0a0;font-size:15px">+${tb} trinket</span>` : ''} <span style="float:right;color:#fff;font-size:16px">RANK ${Math.min(max, r + tb)}/${max}</span></h3>
    <p><b>${D.TAL_DESC[cls * D.NTAL + idx]}</b></p><p>${state}</p>
    <div class="acts"><button class="mbtn go" id="aLearn" ${can ? '' : 'disabled'}>Learn</button>
    <button class="mbtn${UI.resetArm ? ' warn' : ''}" id="aReset" ${S.tal_cost() ? '' : 'disabled'}>${UI.resetArm ? 'Tap again: reset for ' : 'Reset '}<span class="coin"></span>${cost}</button></div>`;
  $('aLearn').onclick = learn;
  $('aReset').onclick = () => { if (!UI.resetArm) { UI.resetArm = 1; sfx('nope'); drawTal(); return; } UI.resetArm = 0; S.tal_reset(); drawTal(); };
}
function learn() { if (S.tal_learn(UI.talSel)) { sfx('levelup'); UI.resetArm = 0; drawTal(); focusSel(); } else sfx('nope'); }

// ---------------------------------------------------------------- the merchant
export function openShop() { sfx('buy'); openShopScreen(); }
function openShopScreen() {
  $('shopSay').textContent = '';
  $('shopPicL').src = $('shopPicR').src = merchantPic();
  show('sShop');
  drawShop();
}
function drawShop(focusK) {
  $('shopGold').innerHTML = coinTxt(G.gold);
  const list = $('shopList');
  list.innerHTML = '';
  for (let k = 0; k < 4; k++) {
    let ic, name, det, col = '#fff', rc = '#8a6428', upg = false;
    if (k === 0) { ic = pic(D.K_POTION, 0); name = 'Health potion'; det = 'Restores all your health'; }
    else if (k === 3) { ic = pic(D.K_GOLD, 0); name = 'Mystery chest'; det = G.floor_num < 5 ? 'Uncommon or rare gear (epic if lucky)' : G.floor_num < 10 ? 'Rare or epic gear (legendary if lucky)' : 'Rare, epic or legendary gear'; }
    else {
      const kind = G.sh_kind[k], rar = G.sh_rar[k], lv = G.sh_lvl[k];
      ic = pic(kind, rar, G.sh_tier[k]); col = rc = D.RAR_COLOR[rar];
      name = `${D.RAR_NAME[rar]} ${S.item_name(kind, rar, G.sh_tier[k])}${G.sh_spec[k] ? ' · ' + D.SPEC_NAME[G.sh_spec[k]] : ''}`;
      // (every number set against the piece you wear in that slot, as in the bag)
      const i = kind - 1, has = G.eq_has[i], v = S.gear_fine(kind, lv);
      let chips = chip(S.stat_name(kind), '#ffd75a', v, v - S.worn_fine(kind));
      for (let t = 1; t <= 5; t++) { const sv = statOf(G.sh_st, k, t), w = has ? statOf(G.eq_st, i, t) : 0; if (sv || w) chips += chip(D.STAT_NAME[t], D.STAT_COLOR[t], sv, sv - w); }
      const up = S.shop_better(k);
      det = `<span class="chips">${chips}</span><span class="vd" style="color:${up ? '#7dff86' : '#ff8a7a'}">${up ? '&#x25B2; UPGRADE' : '&#x25BC; NOT BETTER'} · LV ${lv}${has ? '' : ' · nothing worn there'}</span>`;
      upg = up;
    }
    const b = document.createElement('button');
    b.className = 'ware' + (G.sh_sold[k] ? ' sold' : '') + (upg && !G.sh_sold[k] ? ' up' : '');
    b.innerHTML = `<span class="ic" style="--rc:${rc}"><img alt="" src="${ic}"></span><span><b style="color:${col}">${esc(tc(name))}</b><span>${G.sh_sold[k] ? 'Sold out' : det}</span></span><span class="pr"><span class="coin"></span>${G.sh_price[k]}</span>`;
    b.onclick = () => { const say = S.shop_buy(k); $('shopSay').textContent = say; drawShop(k); };
    list.appendChild(b);
  }
  const tr = document.createElement('button'); tr.className = 'ware cmd'; tr.innerHTML = '<b>Trade up (3 for 1)</b>';
  tr.onclick = () => { UI.marks = new Set(); UI.tradeSel = 0; show('sTrade'); drawTrade(); focusSel(); };
  const lv = document.createElement('button'); lv.className = 'ware cmd'; lv.innerHTML = '<b>Leave</b>';
  lv.onclick = () => leaveShop();
  list.append(tr, lv);
  ctlBar('shopCtl', [['dpad', 'CHOOSE'], ['a', 'BUY'], ['b', 'LEAVE']]);
  if (focusK !== undefined && input.lastDevice !== 'touch') setCur(list.children[focusK], false);
}
function leaveShop() { S.shop_close(); show(null); }

// ---------------------------------------------------------------- trade up: pick from the bag, get one better
$('bTradeBack').onclick = () => openShopScreen();
function drawTrade() {
  ctlBar('tradeCtl', [['dpad', 'CHOOSE'], ['a', 'PICK / TRADE'], ['b', 'BACK']]);
  $('tradeGold').innerHTML = coinTxt(G.gold);
  const marks = [...UI.marks];
  const rar = marks.length ? G.b_rar[marks[0]] : -1;
  const need = S.trade_need(marks.length, rar);
  // the picked ones, and the slots still to fill
  const pk = $('tradePick');
  pk.innerHTML = '';
  for (let i = 0; i < need; i++) {
    const d = document.createElement('div'); d.className = 'slot'; d.style.cursor = 'default';
    const k = marks[i];
    if (k !== undefined) { d.innerHTML = slotHTML(G.b_kind[k], G.b_rar[k], G.b_lvl[k], false, G.b_tier[k]); styleSlot(d, G.b_rar[k], 1); }
    pk.appendChild(d);
  }
  const res = $('tradeRes');
  const to = rar < 0 ? -1 : Math.min(D.RAR_LEG, rar + (rar === D.RAR_LEG ? 0 : 1));
  styleSlot(res, Math.max(0, to), to >= 0);
  $('tradeEq').innerHTML = rar < 0 ? '' : `${need} ${D.RAR_NAME[rar]}<br>= 1 ${rar === D.RAR_LEG ? 'BETTER ' : ''}${D.RAR_NAME[to]}`;
  $('tradeEq').style.color = rar < 0 ? '' : D.RAR_COLOR[to];
  // the bag
  const grid = $('tradeGrid');
  grid.innerHTML = '';
  let n = 0;
  for (let k = 0; k < D.BAG; k++) {
    const kind = G.b_kind[k];
    if (kind) n++;
    const b = document.createElement('button');
    b.className = 'slot' + (UI.marks.has(k) ? ' mark' : '') + (UI.tradeSel === k ? ' sel' : '');
    if (kind) b.innerHTML = slotHTML(kind, G.b_rar[k], G.b_lvl[k], false, G.b_tier[k]);
    styleSlot(b, G.b_rar[k], kind);
    b.onclick = () => {
      UI.tradeSel = k;
      if (!kind) { sfx('nope'); drawTrade(); focusSel(); return; }
      if (UI.marks.has(k)) UI.marks.delete(k);
      else {
        if (kind === D.K_TRINKET) { $('tradeSay').textContent = "Trinkets can't be traded."; sfx('nope'); drawTrade(); focusSel(); return; }
        if (UI.marks.size && G.b_rar[k] !== rar) { $('tradeSay').textContent = 'They must all be the same rarity.'; sfx('nope'); drawTrade(); focusSel(); return; }
        if (UI.marks.size >= S.trade_need(UI.marks.size + 1, G.b_rar[k])) { sfx('nope'); return; }
        UI.marks.add(k);
      }
      sfx('pickup'); $('tradeSay').innerHTML = describe(k); drawTrade(); focusSel();
    };
    grid.appendChild(b);
  }
  $('tradeBagT').textContent = `BAG ${n}/${D.BAG}`;
  const ok = marks.length && marks.length === need;
  const fee = rar >= D.RAR_EPIC ? Math.floor(G.gold / 5) : Math.floor(G.gold / 10);
  $('bTradeGo').disabled = !ok;
  $('bTradeGo').innerHTML = !marks.length ? 'Trade' : ok ? `Trade (fee <span class="coin"></span>${fee})` : `Pick ${need - marks.length} more`;
}
function describe(k) {
  const kind = G.b_kind[k];
  return `<b style="color:${D.RAR_COLOR[G.b_rar[k]]}">${esc(D.RAR_NAME[G.b_rar[k]])} ${esc(S.item_name(kind, G.b_rar[k], G.b_tier[k]))}${kind !== D.K_TRINKET ? ' LV' + G.b_lvl[k] : ''}</b>${UI.marks.has(k) ? ' · picked' : ''}`;
}
$('bTradeGo').onclick = () => {
  const r = S.trade([...UI.marks]);
  UI.marks = new Set();
  if (r) {
    const k = r.slot;
    sfx(G.b_rar[k] >= D.RAR_LEG ? 'legend' : 'rare');
    $('tradeSay').innerHTML = `You got ${describe(k)}! Paid ${r.fee}g.`;
    UI.tradeSel = k;
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
const touchUI = () => input.lastDevice === 'touch' || (document.documentElement.classList.contains('touchy') && input.lastDevice !== 'pad');
export function dgFound(c, v) {
  const how = touchUI() ? 'the green button' : (input.lastDevice === 'pad' ? PAD_FACE[padStyle()].X[0] : 'F or C');
  const swap = touchUI() ? 'the arrows under the room' : (input.lastDevice === 'pad' ? 'LB / RB' : 'V');
  const t = {
    [DG.C_BOOMERANG]: ['THE RETURN BLADE', `Throw it with ${how}: it stuns, fetches loot, trips crystal switches. ${swap} switches items.`],
    [DG.C_HAMMER]: ['THE IRON HAMMER', `Swing it with ${how}: it pounds wooden pegs into the floor and crushes what's in front of you.`],
    [DG.C_FIRE]: ['THE EMBER WAND', `Shoot fire with ${how}: it lights braziers (light them all to break a seal) and burns monsters.`],
    [DG.C_HOOK]: ['THE GRAPPLE CHAIN', `Fire it with ${how}: it catches on posts and chests and pulls you over pits. It stuns, too.`],
    [DG.C_BOMBS]: ['BLAST BOMBS', `Set one down with ${how}. Stand clear! They open cracked walls.`],
    [DG.C_BIGKEY]: ['THE BIG KEY', 'It opens the keeper\'s door.'],
    [DG.C_MAP]: ['THE DUNGEON MAP', 'Every room is on your map now (the map button, M or Select).'],
    [DG.C_KEY]: ['A SMALL KEY', 'It opens one door with a padlock. Keys: ' + G.dg_keys],
    [DG.C_GEAR]: ['TREASURE', 'Gear fell out of the chest: walk over it to take it.'],
    [DG.C_GOLD]: ['+' + (v || 0) + ' GOLD', 'Spend it at the merchant after the keeper.'],
  }[c];
  if (t) banner(t[0], t[1], 3.2);
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
  $('lootIc').innerHTML = `<img alt="" src="${itemPic(kind, rar, G.player_class, G.b_tier[k])}" style="width:46px;height:46px">`;
  $('lootT').textContent = tc(`${D.RAR_NAME[rar]} ${S.item_name(kind, rar, G.b_tier[k])}`);
  $('lootT').style.color = D.RAR_COLOR[rar];
  const st = statText(G.b_st, k);
  if (kind === D.K_TRINKET) $('lootS').textContent = (st ? st + ' · ' : '') + S.trinket_talents(G.b_spec[k], G.b_val[k]).map(([t, c]) => `+${c} ${tc(D.TAL_NAME[G.player_class * D.NTAL + t])}`).join(', ');
  else $('lootS').textContent = `LV${G.b_lvl[k]} · ${S.stat_name(kind)} ${S.gear_fine(kind, G.b_lvl[k])}${st ? ' · ' + st : ''}${e.better ? ' · UPGRADE!' : ''}`;
  $('loot').style.boxShadow = `inset 0 0 0 2px ${D.RAR_COLOR[rar]}, 0 10px 24px rgba(0,0,0,.45)`;
  $('loot').classList.add('on');
  UI.toastT = 3.2;
  if (e.better) $('hBag').classList.add('alert');
}
export function roomStart() {
  if (G.mode === 'dungeon') {
    const id = G.dg_seed_text + '#' + G.dg_no;
    if (UI.lastDg !== id) { UI.lastDg = id; banner('FLOOR ' + G.dg_no, D.THEME_NAME[G.theme] + ' · SEED ' + G.dg_seed_text, 2.4); }
    fadeIn(); drawMinimap(); return;
  }
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
// the dungeon's map: rooms you've seen (all of them once you have the map), you, the keeper, chests not yet opened
const ITEM_SVG = {
  [DG.I_BOOMERANG]: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M4 26C10 16 14 9 26 5c-6 6-9 12-11 20-3-2-7-1-11 1z" fill="#dfe4ee" stroke="#5a6070" stroke-width="1.6"/><circle cx="14" cy="17" r="3" fill="#f0b73c" stroke="#8a5a10"/><circle cx="14" cy="17" r="1.2" fill="#40e0ff"/></svg>'),
  [DG.I_HOOK]: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke-linecap="round"><path d="M4 28l3-3M9 23l3-3M14 18l2-2" stroke="#5a5a66" stroke-width="3"/><path d="M15 17L24 8M24 8c-4-1-7 1-7 5M24 8c1 4-1 7-5 7M24 8l3-3" stroke="#2a2a30" stroke-width="4.4"/><path d="M15 17L24 8M24 8c-4-1-7 1-7 5M24 8c1 4-1 7-5 7M24 8l3-3" stroke="#dfe4ee" stroke-width="2.2"/></g><circle cx="15" cy="17" r="2.4" fill="#f0b73c" stroke="#8a5a10"/></svg>'),
  [DG.I_HAMMER]: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M8 27L19 12" stroke="#3a2410" stroke-width="5" stroke-linecap="round"/><path d="M8 27L19 12" stroke="#a8743a" stroke-width="2.6" stroke-linecap="round"/><g transform="rotate(37 20 11)"><rect x="11" y="6" width="18" height="10" rx="2" fill="#5a5a66" stroke="#2a2a30" stroke-width="1.4"/><rect x="11" y="6" width="3" height="10" fill="#8a8a96"/><rect x="26" y="6" width="3" height="10" fill="#8a8a96"/></g></svg>'),
  [DG.I_FIRE]: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M6 28L18 14" stroke="#2a1608" stroke-width="4.4" stroke-linecap="round"/><path d="M6 28L18 14" stroke="#7a4a26" stroke-width="2.2" stroke-linecap="round"/><circle cx="19" cy="13" r="3.2" fill="#f0b73c" stroke="#8a5a10"/><path d="M22 4c4 4 5 8 1 11-1-3-4-3-4-6 0-2 2-3 3-5z" fill="#ff7a1a"/><path d="M22 8c2 2 2 4 0 6-1-2-2-2-2-4z" fill="#ffd36a"/></svg>'),
  [DG.I_BOMBS]: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="15" cy="19" r="10" fill="#2a2a34" stroke="#8a8a9a" stroke-width="1.4"/><rect x="12" y="7" width="6" height="4" rx="1" fill="#5a5a64"/><path d="M17 7q3-4 7-3" stroke="#c8a070" stroke-width="2" fill="none"/><circle cx="25" cy="4" r="2.6" fill="#ffd36a"/><circle cx="11" cy="15" r="2.2" fill="#fff" opacity=".35"/></svg>'),
};
export function drawDungeonMap(c, big) {
  const x = c.getContext('2d'), W = c.width, H = c.height, d = G.dg;
  x.clearRect(0, 0, W, H);
  if (!d) return;
  // fit the rooms in use
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
  for (const r of d.rooms) { x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y); }
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1, cs = Math.floor(Math.min((W - 8) / cols, (H - 8) / rows)), ox = (W - cs * cols) / 2, oy = (H - cs * rows) / 2;
  const pad = Math.max(2, cs * 0.12), rw = cs - pad * 2;
  const shown = r => (G.dg_flags[r.id] & 1) || G.dg_map;
  const pos = r => [ox + (r.x - x0) * cs + pad, oy + (r.y - y0) * cs + pad];
  // corridors between shown rooms
  for (const r of d.rooms) {
    if (!shown(r)) continue;
    const [px, py] = pos(r);
    r.doors.forEach((e, k) => {
      if (!e || (k !== 1 && k !== 2)) return;
      const o = d.rooms[e.to]; if (!shown(o)) return;
      const open = G.dg_flags[r.id] & (16 << k);
      x.fillStyle = e.kind === DG.E_KEY && !open ? '#c8913e' : e.kind === DG.E_BOSS && !open ? '#e8402e' : e.kind === DG.E_BOMB && !open ? 'rgba(255,255,255,.12)' : 'rgba(255,240,220,.45)';
      const t = Math.max(2, cs * 0.14);
      if (k === 1) x.fillRect(px + rw, py + rw / 2 - t / 2, pad * 2, t); else x.fillRect(px + rw / 2 - t / 2, py + rw, t, pad * 2);
    });
  }
  for (const r of d.rooms) {
    if (!shown(r)) continue;
    const [px, py] = pos(r), seen = G.dg_flags[r.id] & 1, cur = r.id === G.dg_room;
    x.fillStyle = cur ? '#ffc93c' : seen ? 'rgba(255,240,220,.55)' : 'rgba(255,240,220,.16)';
    x.beginPath(); x.roundRect(px, py, rw, rw, Math.max(2, rw * 0.18)); x.fill();
    const f = G.dg_flags[r.id];
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 ${Math.max(9, rw * 0.6)}px Nunito, sans-serif`;
    let mark = '', col = cur ? '#2a1600' : '#ffc93c';
    if (r.kind === DG.R_BOSS) { mark = '☠'; col = cur ? '#2a1600' : '#ff6a55'; }
    else if (r.content && !(f & 4) && (G.dg_map || seen)) mark = DG.isGreat(r.content) ? '◆' : '■';
    else if (r.kind === DG.R_START) mark = '▲';
    if (mark) { x.fillStyle = col; x.fillText(mark, px + rw / 2, py + rw / 2 + 1); }
  }
}
export function drawMinimap() {
  if (G.mode === 'dungeon') { const c = $('minimap'); c.classList.add('dg'); if (c.width !== 264) { c.width = 264; c.height = 264; } drawDungeonMap(c, false); return; }
  $('minimap').classList.remove('dg');
  const c = $('minimap'), x = c.getContext('2d'), w = c.width, h = c.height;
  if (w !== 300) { c.width = 300; c.height = 88; }
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
// the controller card: each button and what it does right now (PlayStation symbols for a PlayStation pad)
// each face button (by what the game reads: A attack, B roll, X item, Y potion): [its symbol, its colour]
const PAD_FACE = {
  xbox: { A: ['A', '#3a9a3a'], B: ['B', '#c8303a'], X: ['X', '#2f6ad0'], Y: ['Y', '#d8a81c'], l: 'LB', r: 'RB', sel: 'VIEW', start: 'MENU' },
  ps: { A: ['✕', '#3a6ad0'], B: ['○', '#c8303a'], X: ['□', '#c0508a'], Y: ['△', '#2a9a7a'], l: 'L1', r: 'R1', sel: 'CREATE', start: 'OPTIONS' },
};
// where the card's drawing puts each one: top, left, right, bottom
const PAD_DRAW = ['B', 'A', 'Y', 'X'];
function padStyle() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected) return /054c|playstation|dualsense|dualshock|wireless controller/i.test(p.id) ? 'ps' : 'xbox';
  return 'xbox';
}
// a screen's button row: [[button, what it does]], buttons 'a' 'b' 'x' 'y' 'dpad'; keyboard keys after a key press
function ctlBar(id, rows) {
  const F = PAD_FACE[padStyle()], kb = input.lastDevice === 'kb' && !(navigator.getGamepads && [...navigator.getGamepads()].some(p => p && p.connected));
  const KEY = { a: 'ENTER', b: 'ESC', x: 'F', y: 'Q', dpad: '↑ ↓ ← →' };
  const chip = k => kb ? `<i class="sm">${KEY[k]}</i>` : k === 'dpad' ? '<i class="sm">✚</i>' : `<i style="background:${F[k.toUpperCase()][1]}">${F[k.toUpperCase()][0]}</i>`;
  $(id).innerHTML = rows.map(([k, t]) => `<span>${chip(k)}${t}</span>`).join('');
}
// the item box: the one in use, big; the others you carry, small and dim (with the switch buttons)
const ITEM_NAME = { [DG.I_BOOMERANG]: 'RETURN BLADE', [DG.I_BOMBS]: 'BLAST BOMBS', [DG.I_HOOK]: 'GRAPPLE CHAIN', [DG.I_HAMMER]: 'IRON HAMMER', [DG.I_FIRE]: 'EMBER WAND' };
function drawItemBox() {
  const el = $('itemBox'), it = G.mode === 'dungeon' && G.dg_items ? G.dg_item : 0;
  const show = !!it && !UI.modal && G.state === 'play';
  if (el.hidden === show) el.hidden = !show;
  if (!show) return;
  const n = it === DG.I_BOMBS ? String(G.dg_bombs) : '';
  setText('ibN', n); $('ibN').hidden = !n;
  const key = it + ':' + G.dg_items + ':' + input.lastDevice;
  if (UI.lastHud.itemBox === key) return;
  const swapped = UI.lastHud.itemBox && UI.lastHud.itemBox.split(':')[0] !== String(it);
  UI.lastHud.itemBox = key;
  $('ibPic').src = ITEM_SVG[it]; $('ibName').textContent = ITEM_NAME[it];
  const rest = DG.ITEMS.filter(i => i !== it && (G.dg_items & i));
  const F = PAD_FACE[padStyle()], sw = input.lastDevice === 'kb' ? 'V' : F.l + '/' + F.r;
  $('ibRest').innerHTML = rest.length ? rest.map(i => `<img alt="" src="${ITEM_SVG[i]}">`).join('') + `<i>${sw}</i>` : '';
  if (swapped) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}
// the switch arrows (touch): at the two sides, just under the room's front wall; each shows the item it moves to
const _v = new V3();
function placeSwitch(it) {
  const show = !$('touch').hidden; // (always there in the dungeons: faded until you carry two items)
  $('tPrev').hidden = $('tNext').hidden = !show;
  if (!show) return;
  // (where the room's front edge is on screen; it moves with the camera)
  _v.set(0, 0, wz(D.PLAY_Y + 176)).project(camera);
  let y = Math.round((1 - _v.y) / 2 * innerHeight + 10);
  // (no room under it, as on a phone held sideways: the pair goes side by side above the stick)
  const st = $('stick').getBoundingClientRect(), side = y + 52 > st.top;
  if (side) y = Math.round(st.top - 62);
  if (UI.lastHud.swY !== y || UI.lastHud.swSide !== side) {
    UI.lastHud.swY = y; UI.lastHud.swSide = side;
    $('tPrev').style.top = $('tNext').style.top = y + 'px';
    $('tNext').style.right = side ? 'auto' : ''; $('tNext').style.left = side ? (st.left + 98) + 'px' : '';
    $('tPrev').style.left = side ? st.left + 'px' : '';
  }
  const have = DG.ITEMS.filter(i => G.dg_items & i), k = have.indexOf(it), key = have.join() + ':' + it;
  if (UI.lastHud.swKey === key) return;
  UI.lastHud.swKey = key;
  const prev = have[(k - 1 + have.length) % have.length], next = have[(k + 1) % have.length];
  for (const [id, i] of [['tPrev', prev], ['tNext', next]]) { const im = $(id).querySelector('img'); im.hidden = have.length < 2; if (have.length >= 2) im.src = ITEM_SVG[i]; }
  for (const id of ['tPrev', 'tNext']) $(id).classList.toggle('one', have.length < 2);
}
const manyItems = () => (G.dg_items & (G.dg_items - 1)) !== 0; // (two or more: they can be switched)
function drawPadHelp() {
  const el = $('padHelp');
  if (el.hidden) return;
  const cls = G.player_class, dg = G.mode === 'dungeon', it = dg && G.dg_items ? G.dg_item : 0;
  const spec = cls === 1 ? 'BLINK' : (cls === 2 && !G.pet_type ? 'TAME' : 'ROLL');
  const item = { [DG.I_BOMBS]: 'BOMBS', [DG.I_BOOMERANG]: 'BLADE', [DG.I_HOOK]: 'CHAIN', [DG.I_HAMMER]: 'HAMMER', [DG.I_FIRE]: 'WAND' }[it] || '';
  const swap = dg && manyItems();
  const style = padStyle(), key = [style, spec, item, swap, dg].join();
  if (UI.lastHud.padHelp === key) return;
  UI.lastHud.padHelp = key;
  const F = PAD_FACE[style];
  const face = el.querySelectorAll('#phFace circle'), txt = el.querySelectorAll('#phFace text');
  for (let i = 0; i < 4; i++) { const [n, c] = F[PAD_DRAW[i]]; face[i].setAttribute('fill', c); txt[i].setAttribute('fill', '#fff'); txt[i].textContent = n; }
  for (const id of ['phL', 'phR']) $(id).setAttribute('fill', swap ? '#8a7a5a' : '#4a4440');
  const b = k => `<i style="background:${F[k][1]}">${F[k][0]}</i>`, sm = t => `<i class="sm">${t}</i>`;
  const rows = [
    [b('A'), 'ATTACK'], [b('B'), spec],
    [b('X'), item || 'ATTACK'], [b('Y'), 'POTION'],
    [sm(F.sel), dg ? 'MAP' : 'POTION'], [sm(F.start), 'BAG'],
  ];
  if (swap) rows.push([sm(F.l) + sm(F.r), 'SWITCH ITEM', 1]);
  $('phList').innerHTML = rows.map(([k, t, w]) => `<li${w ? ' class="wide"' : ''}>${k}${t}</li>`).join('');
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
  if (G.mode === 'dungeon' && G.dg) {
    const r = G.dg.rooms[G.dg_room], key = 'dg' + G.dg_no + ':' + G.dg_room;
    if (UI.lastHud.where !== key) {
      UI.lastHud.where = key;
      $('hWhere').innerHTML = `FLOOR ${G.dg_no}<small>${D.THEME_NAME[G.theme]} · ${DG.ROOM_KIND_NAME[r.kind]}</small>`;
      drawMinimap();
    }
    $('hDg').hidden = false; $('hMap').hidden = false;
    setText('hKeys', G.dg_keys); $('hBig').hidden = !G.dg_big;
    const it = G.dg_items ? G.dg_item : 0;
    $('hItem').hidden = !it;
    if (it && UI.lastHud.item !== it) { UI.lastHud.item = it; $('hItemPic').src = ITEM_SVG[it]; $('tItemPic').src = ITEM_SVG[it]; setText('tItemL', ITEM_NAME[it].split(' ').pop()); }
    const n = it === DG.I_BOMBS ? String(G.dg_bombs) : '';
    setText('hItemN', n); setText('tItemN', n);
    // (on a touch screen the item button is always there in the dungeons: grey until you find one)
    $('tItem').hidden = $('touch').hidden; $('tItem').classList.toggle('none', !it); $('tItemPic').hidden = !it;
    if (!it && UI.lastHud.item) { UI.lastHud.item = 0; setText('tItemL', 'ITEM'); }
    placeSwitch(it);
  } else if (UI.lastHud.dgOn !== 0) { UI.lastHud.dgOn = 0; $('hDg').hidden = true; $('hMap').hidden = true; $('tItem').hidden = true; $('tPrev').hidden = $('tNext').hidden = true; }
  if (G.mode === 'dungeon') UI.lastHud.dgOn = 1;
  const wh = G.room_num === D.BOSS_ROOM ? 'BOSS' : 'ROOM ' + G.room_num;
  if (G.mode !== 'dungeon' && UI.lastHud.where !== G.floor_num + wh) {
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
  drawPadHelp(); drawItemBox();
  const pet = G.pet_type;
  $('hPet').hidden = !pet;
  if (pet) { setText('hPetN', G.pet_down ? `PET DOWN · ${Math.ceil(G.pet_down / 60)}s` : (G.pet_name || D.PET_NAME[pet]).toUpperCase()); setW('petfill', G.pet_down ? 0 : G.pet_hp / S.pet_max() * 100); }
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
// the touch controller's SELECT (the bag) and START (pause), as on the SNES pad
for (const [id, go] of [['tSel', () => openPause()], ['tStart', () => openInv()]]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); input.lastDevice = 'touch'; b.classList.add('on'); if (!UI.modal && G.state === 'play') go(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('on'));
}

// ---------------------------------------------------------------- naming a new pet
export function namePet() {
  if (!G.pet_type || G.state !== 'play') return;
  const opts = PET_NAMES[G.pet_type] || ['Buddy'];
  $('petPic').src = petPic(G.pet_type);
  $('petKind').textContent = 'Your new ' + D.PET_NAME[G.pet_type].toLowerCase() + '!';
  $('petName').value = G.pet_name || '';
  $('petSugg').innerHTML = '';
  for (const n of opts) { const b = document.createElement('button'); b.className = 'mbtn'; b.type = 'button'; b.textContent = n; b.onclick = () => { $('petName').value = n; sfx('pickup'); }; $('petSugg').appendChild(b); }
  show('sName');
  if (input.lastDevice !== 'touch') setTimeout(() => $('petName').focus(), 60);
}
$('petForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('petName').value.replace(/[^A-Za-z0-9 '\-]/g, '').trim().slice(0, 10);
  G.pet_name = v || (PET_NAMES[G.pet_type] || ['Buddy'])[0];
  sfx('levelup');
  S.save_game();
  show(null);
});
