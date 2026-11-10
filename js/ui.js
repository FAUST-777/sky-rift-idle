// ════════════════════════════════════════════════════════════════════════════
// 介面：HUD、六個分頁、設定、彈窗、提示
// 所有按鈕用 data-act 屬性，由最下面的事件代理統一處理
// 所有文字用 t()；切換語言時整個介面重畫
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const $ = id => document.getElementById(id);
  const t = (k, p) => G.t(k, p);
  const UI = G.UI = { tab: 'adventure', placing: null, who: 'hero' };   // who = 角色分頁目前看的是主角還是哪個夥伴
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── 固定在 HTML 裡的文字（data-i18n="key"）───────────────────────────────
  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.title = t('game.title');
    document.documentElement.lang = G.settings.lang;
  }

  // ── HUD（每 0.4 秒更新）────────────────────────────────────────────────
  function hud() {
    const S = G.S, h = S.hero;
    $('hudLv').textContent = h.level;
    $('hudCls').textContent = G.clsName(h.cls);
    $('hudXp').style.width = Math.min(100, h.xp / G.xpToLevel(h.level) * 100) + '%';
    $('hudGold').textContent = G.fmt(S.gold);
    $('hudCrystal').textContent = G.fmt(S.crystal);
    $('floorName').textContent = t('floor.name', { n: S.floor }) + (G.curseFor(S.floor) ? ' 🌪️' : '');
    const boss = S.kills >= G.CONFIG.killsPerFloor;
    $('floorProg').style.width = Math.min(100, S.kills / G.CONFIG.killsPerFloor * 100) + '%';
    $('floorKills').textContent = boss ? t('floor.boss') : `${S.kills}/${G.CONFIG.killsPerFloor}`;
    $('floorKills').classList.toggle('boss', boss);
    // 戰敗復活倒數
    const sc = G.battleScene();
    if (sc && sc.reviveAt && G.settings.battleCollapsed) {
      // 戰鬥畫面收起來時，倒數改顯示在進度條旁邊
      $('floorKills').textContent = t('battle.deadShort', { s: Math.max(0, Math.ceil((sc.reviveAt - Date.now()) / 1000)) });
      $('floorKills').classList.add('boss');
    }
    renderBuffs(sc);
    renderLive(sc);
    if (sc && sc.reviveAt) {
      const left = Math.max(0, Math.ceil((sc.reviveAt - Date.now()) / 1000));
      $('reviveTitle').textContent = t('revive.title');
      $('reviveText').innerHTML = t('revive.wait', { s: left, n: Math.max(1, S.floor - 1) });
      const cost = G.CONFIG.reviveCost;
      $('revivePay').textContent = t('revive.pay', { cost, have: G.fmt(S.crystal) });
      $('revivePay').disabled = S.crystal < cost;
    }
    // 有技能點未使用 → 技能分頁亮紅點；可以轉職 → 角色分頁亮紅點
    setDot('skills', ['hero', ...Object.keys(S.partners)].some(w => G.spOf(w) > 0 && G.charOf(w).cls !== 'villager'));
    $('hudName').textContent = G.myName();
    setDot('hero', h.cls === 'villager' && h.level >= G.CONFIG.classUnlockLevel);
  }
  // ── Buff 圖示（戰鬥畫面左上角，點一下看說明）─────────────────────────────
  let lastBuffSig = '';
  UI.buffs = [];
  function renderBuffs(sc) {
    const list = sc && sc.getBuffs ? sc.getBuffs() : [];
    UI.buffs = list;
    const sig = list.map(b => b.id + b.val).join('|');
    if (sig === lastBuffSig) return;     // 沒變就不重畫，點擊才不會被打斷
    lastBuffSig = sig;
    $('buffBar').innerHTML = list.map(b =>
      `<button class="buff ${b.id}" data-act="buff" data-id="${b.id}" title="${esc(t(`buff.${b.id}.name`))}">${b.icon}<b>${esc(b.val)}</b></button>`).join('');
  }

  // ── 冒險頁「即時數值」：每 0.4 秒跟著 hud 更新，切換看哪個角色（UI.liveWho）──
  let lastWhoSig = '';
  function renderLive(sc) {
    const grid = $('liveGrid'), whoBox = $('liveWho');
    if (!grid || UI.tab !== 'adventure' || !sc || !sc.units) return;
    const members = sc.units.filter(u => u.key);
    if (!members.length) return;
    if (!members.some(u => u.key === UI.liveWho)) UI.liveWho = members[0].key;
    const whoSig = members.map(u => u.key).join('|') + '#' + UI.liveWho + G.settings.lang;
    if (whoSig !== lastWhoSig || !whoBox.children.length) {   // 成員有變才重畫按鈕，避免點擊被打斷
      lastWhoSig = whoSig;
      whoBox.innerHTML = members.map(u => `<button class="btn small ${u.key === UI.liveWho ? 'on' : ''}" data-act="livewho" data-v="${esc(u.key)}">${esc(G.whoName(u.key))} <span class="muted">${G.clsName(G.charOf(u.key).cls)}</span></button>`).join('');
    }
    const u = members.find(x => x.key === UI.liveWho), L = sc.liveStats(u), base = u.st;
    const pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
    // 比基礎（沒 buff）高 → 綠色、低 → 紅色
    const cmp = (now, b) => now > b * 1.001 ? 'up' : now < b * 0.999 ? 'down' : '';
    const cell = (k, v, cls = '') => `<div>${t(k)} <b class="${cls}">${v}</b></div>`;
    grid.innerHTML = [
      cell('live.hp', `${G.fmt(L.hp)} / ${G.fmt(L.maxHp)}`, u.alive ? '' : 'down'),
      cell('stat.atk', L.atk.toFixed(1), cmp(L.atk, base.atk)),
      cell('stat.def', L.def.toFixed(1), cmp(L.def, base.def)),
      cell('live.spd', L.spd.toFixed(2) + '/s', cmp(L.spd, base.spd)),
      cell('live.crit', L.crit.toFixed(1) + '%', cmp(L.crit, base.crit)),
      cell('live.critDmg', pc(L.critDmg), cmp(L.critDmg, base.critDmg)),
      cell('live.cdr', pc(L.cdr), L.cdr > 0 ? 'up' : ''),
      cell('live.regen', pc(L.regen, 1) + '/s', L.regen > 0 ? 'up' : ''),
      cell('live.lifesteal', pc(L.lifesteal)),
      cell('live.evade', pc(L.evade)),
      cell('live.dmg', (L.dmg >= 0 ? '+' : '') + pc(L.dmg), L.dmg > 0 ? 'up' : L.dmg < 0 ? 'down' : ''),
      cell('live.skillDmg', '+' + pc(L.skillDmg)),
      cell('live.dmgReduce', pc(L.dmgReduce)),
      cell('live.reflect', pc(L.reflect), L.reflect > 0 ? 'up' : ''),
      cell('live.debuffDur', '+' + pc(L.debuffDur)),
      L.shield ? cell('live.shield', G.fmt(L.shield), 'up') : '',
    ].join('');
  }

  // 點右上角飛空艇：提示最多能到第幾層
  UI.shipTip = function () {
    const S = G.S, cap = G.shipMaxFloor();
    let msg = t('ship.tipFloor', { n: cap, base: G.SHIP_BASE_FLOORS, wing: G.shipVal('wing'), engine: G.shipVal('engine'), max: S.maxFloor });
    if (S.maxFloor >= cap) msg += ' ' + t('ship.tipMore');
    UI.toast(msg);
  };

  function setDot(tab, on) {
    const b = document.querySelector(`#tabs [data-tab="${tab}"]`);
    let d = b.querySelector('.dot');
    if (on && !d) { d = document.createElement('i'); d.className = 'dot'; b.appendChild(d); }
    if (!on && d) d.remove();
  }

  // ── 共用小元件 ───────────────────────────────────────────────────────────
  const itemIcon = it => it.slot === 'weapon' ? { sword: '🗡️', axe: '🪓', spear: '🔱', staff: '🔱', mace: '🔨' }[it.look] : G.SLOT_ICON[it.slot];

  function dollCanvas(look, w, h, scale) {
    const c = G.ART.canvas(w * 2, h * 2);  // 2 倍解析度，手機上比較清楚
    const ctx = c.getContext('2d');
    G.ART.drawHumanoid(ctx, look, (w * 2 - 64 * scale * 2) / 2, (h * 2 - 80 * scale * 2) / 2, scale * 2);
    return c;
  }
  function mount(sel, canvas) { const el = $('panel').querySelector(sel); if (el) el.replaceWith(Object.assign(canvas, { className: el.className })); }

  // ── 分頁：冒險 ───────────────────────────────────────────────────────────
  function renderAdventure() {
    const S = G.S, st = G.heroStats();
    const cap = G.shipMaxFloor();
    const top = Math.min(S.maxFloor, cap);
    return `
      <div class="card">
        <h3>${t('adv.title')} <small>${t('adv.reach', { top, cap })}</small></h3>
        <div class="row between">
          <button class="btn" data-act="floor" data-v="${S.floor - 1}" ${S.floor <= 1 ? 'disabled' : ''}>${t('adv.down')}</button>
          <div style="text-align:center"><div style="font-size:24px;font-weight:700">${t('floor.name', { n: S.floor })}</div>
            <div class="muted" style="font-size:12px">${G.monsterTier(S.floor).map(m => G.monsterName(m.id)).join('・')}</div>
            ${G.curseFor(S.floor) ? `<div class="curse">🌪️ ${t('curse.name')}：${G.curseText(G.curseFor(S.floor))}</div>` : ''}</div>
          <button class="btn" data-act="floor" data-v="${S.floor + 1}" ${S.floor >= top ? 'disabled' : ''}>${t('adv.up')}</button>
        </div>
        <div class="row between wrap" style="margin-top:12px">
          <label class="switch"><input type="checkbox" data-act="auto" ${S.autoAdvance ? 'checked' : ''}><i></i>${t('adv.auto')}</label>
          ${S.floor < top ? `<button class="btn small primary" data-act="floor" data-v="${top}">${t('adv.challenge', { n: top })}</button>` : ''}
        </div>
      </div>
      <div class="card">
        <h3>${t('stat.power')} <span class="gold">${G.fmt(G.power(st))}</span></h3>
        <div class="stats">
          <div>${t('stat.hp')} <b>${G.fmt(st.maxHp)}</b></div><div>${t('stat.atk')} <b>${st.atk}</b></div>
          <div>${t('stat.def')} <b>${st.def}</b></div><div>${t('stat.spd')} <b>${st.spd}</b></div>
          <div>${t('stat.crit')} <b>${st.crit}%</b></div><div>${t('adv.partners')} <b>${S.party.length}/${G.CONFIG.maxParty}</b></div>
        </div>
      </div>
      <div class="card" id="liveCard">
        <h3>📊 ${t('live.title')} <small>${t('live.hint')}</small></h3>
        <div class="live-who" id="liveWho"></div>
        <div class="stats live" id="liveGrid"><div class="muted">${t('live.waiting')}</div></div>
      </div>
      <div class="card">
        <h3>${t('adv.log')}</h3>
        <ul class="log">${S.log.map(l => `<li style="color:${l.color || 'inherit'}">${esc(G.logText(l))}</li>`).join('') || `<li class="muted">${t('adv.logEmpty')}</li>`}</ul>
      </div>`;
  }

  // ── 分頁：角色（紙娃娃 + 裝備 + 轉職）──────────────────────────────────
  const whoName = who => (who === 'hero' ? t('hero.who.hero') : G.partnerName(who));

  function renderHero() {
    const S = G.S, h = S.hero;
    if (UI.who !== 'hero' && !S.partners[UI.who]) UI.who = 'hero';
    const who = UI.who, isHero = who === 'hero';
    const gear = G.gearOf(who);
    const st = isHero ? G.heroStats() : G.partnerStats(who);
    const cls = isHero ? h.cls : S.partners[who].cls;
    const lv = isHero ? h.level : S.partners[who].level;


    const slots = G.SLOTS.map(slot => {
      const it = gear[slot];
      return it
        ? `<button class="slot" style="border-color:${G.RARITY[it.rarity].color}" data-act="item" data-slot="${slot}">${itemIcon(it)}<small>${G.slotName(slot)}</small></button>`
        : `<button class="slot empty">${G.SLOT_ICON[slot]}<small>${G.slotName(slot)}</small></button>`;
    }).join('');
    // ▲ = 比「目前選的角色」身上的更好
    const inv = [...S.inventory].sort((a, b) => b.rarity - a.rarity || G.itemScore(b) - G.itemScore(a)).map(it => {
      const better = G.itemScore(it) > G.itemScore(gear[it.slot]);
      return `<button class="item" style="border-color:${G.RARITY[it.rarity].color}" data-act="item" data-id="${it.uid}">
        ${better ? '<span class="up">▲</span>' : ''}${itemIcon(it)}<small>${esc(G.itemName(it))}</small></button>`;
    }).join('');

    const cap = G.invCap(), canExp = G.canExpandBag(), ec = G.bagExpandCost(S.bagExpands || 0);
    const expCost = [ec.gold ? `${G.fmt(ec.gold)}💰` : '', ec.crystal ? `${ec.crystal}💎` : ''].filter(Boolean).join(' ');

    let clsHtml;
    if (!isHero) {
      clsHtml = `<p class="muted" style="margin:0;font-size:12px">${t('hero.partnerNote')}</p>`;
    } else if (h.level < G.CONFIG.classUnlockLevel) {
      clsHtml = `<p class="muted" style="margin:0">${t('hero.classLocked', { lv: G.CONFIG.classUnlockLevel, cur: h.level })}</p>`;
    } else {
      // 轉職：左邊職業列表，右邊詳細說明，按確認才轉職
      if (!G.CLASSES[UI.clsPick] || UI.clsPick === 'villager') UI.clsPick = h.cls === 'villager' ? G.CLASS_ORDER[0] : h.cls;
      const pick = UI.clsPick, C = G.CLASSES[pick];
      const list = G.CLASS_ORDER.map(c => `<button class="cls-item ${pick === c ? 'on' : ''} ${h.cls === c ? 'cur' : ''}" data-act="clspick" data-cls="${c}">
          <span>${G.CORE_ICON[G.CLASSES[c].core]}</span>${G.clsName(c)}${h.cls === c ? ' ✓' : ''}</button>`).join('');
      const sk = (G.SKILLS[pick] || []);
      const names = type => sk.filter(s => s.type === type).map(s => G.skillName(s.id)).join('・');
      const cost = h.cls === 'villager' ? t('classModal.free') : t('classModal.cost', { cost: G.CONFIG.classChangeCost });
      clsHtml = `<div class="cls-picker">
          <div class="cls-list">${list}</div>
          <div class="cls-detail">
            <b class="cls-name">${G.clsName(pick)}</b>
            <div class="tags">${classTags(pick)}</div>
            <p>${t(`class.${pick}.desc`)}</p>
            <div class="muted" style="font-size:11px;margin-bottom:4px"><b>${t('skills.activeSlots')}</b>：${names('active')}</div>
            <div class="muted" style="font-size:11px"><b>${t('skills.passiveSlots')}</b>：${names('passive')}</div>
            ${h.cls === pick
              ? `<button class="btn small" disabled style="margin-top:10px;width:100%">${t('hero.current').replace(/[（）() ]/g, '')}</button>`
              : `<button class="btn small primary" data-act="class2" data-cls="${pick}" style="margin-top:10px;width:100%">${t('hero.changeTo', { name: G.clsName(pick) })}</button>
                 <div class="muted" style="font-size:11px;margin-top:4px">${cost}${t('classModal.refund')}</div>`}
          </div>
        </div>`;
    }

    return `
      <div class="card">
        ${whoBarHtml(false)}
        <div class="doll-wrap">
          <canvas class="doll" id="dollSlot"></canvas>
          <div class="grow">
            ${isHero ? '' : `<div style="font-weight:700;margin-bottom:2px">${esc(whoName(who))}</div>`}
            <div style="font-size:18px;font-weight:700">Lv ${lv} <span style="color:${G.CLASSES[cls].color}">${G.clsName(cls)}</span></div>
            <div class="muted" style="font-size:12px;margin-bottom:8px">${t('stat.power')} <span class="gold">${G.fmt(G.power(st))}</span></div>
            <div class="stats" style="grid-template-columns:1fr">
              <div>${t('stat.hp')} <b>${G.fmt(st.maxHp)}</b></div><div>${t('stat.atk')} <b>${st.atk}</b></div><div>${t('stat.def')} <b>${st.def}</b></div>
              <div>${t('stat.spd')} <b>${st.spd}</b></div><div>${t('stat.crit')} <b>${st.crit}%</b></div>
            </div>
          </div>
        </div>
        <div class="slots">${slots}</div>
      </div>
      <div class="card">
        <h3>${t('hero.class')} <small>${G.clsName(cls)}</small></h3>
        ${clsHtml}
      </div>
      <div class="card">
        <div class="bag-head" style="margin-bottom:10px">
          <b style="font-size:15px">${t('hero.bag')}</b><small class="muted">${S.inventory.length}/${cap}</small>
          <button class="btn small" data-act="expand" ${canExp ? '' : 'disabled'}>${canExp ? `${t('hero.expand', { n: G.CONFIG.bagExpandSlots })}　${expCost}` : t('hero.bagMax')}</button>
        </div>
        <div class="row wrap" style="margin-bottom:10px">
          <button class="btn small good" data-act="autoequip" data-scope="one">${t('hero.autoEquipOne', { name: esc(whoName(who)) })}</button>
          <button class="btn small good" data-act="autoequip" data-scope="all" title="${esc(t('hero.autoEquipHint'))}">${t('hero.autoEquipAll')}</button>
          ${[0, 1, 2, 3].map(r => `<button class="btn small" data-act="sellbelow" data-v="${r}" style="color:${G.RARITY[r].color}">${t('hero.sellBelow.' + r)}</button>`).join('')}
        </div>
        <div class="inv">${inv || `<p class="muted" style="grid-column:1/-1;margin:0">${t('hero.bagEmpty')}</p>`}</div>
      </div>`;
  }

  // 裝備彈窗：對象 = 角色分頁目前選的人（主角或夥伴）
  function itemModal(it, equippedSlot) {
    const who = UI.who;
    const cur = equippedSlot ? null : G.gearOf(who)[it.slot];
    const keys = [...new Set([...Object.keys(it.stats), ...(cur ? Object.keys(cur.stats) : [])])];
    const rows = keys.map(k => {
      const a = it.stats[k] || 0, b = cur ? cur.stats[k] || 0 : 0, d = +(a - b).toFixed(2);
      const diff = cur && d !== 0 ? `<span class="${d > 0 ? 'diff-up' : 'diff-down'}">（${d > 0 ? '+' : ''}${d}）</span>` : '';
      return `<div>${G.statName(k)} <b>${a}${diff}</b></div>`;
    }).join('');
    UI.modal(`
      <h2 style="color:${G.RARITY[it.rarity].color}">${itemIcon(it)} ${esc(G.itemName(it))}</h2>
      <div class="muted" style="font-size:12px;margin-bottom:10px">${t('item.meta', { rarity: G.rarityName(it.rarity), slot: G.slotName(it.slot), floor: it.floor })}</div>
      <div class="stats" style="grid-template-columns:1fr">${rows}</div>
      ${cur ? `<p class="muted" style="font-size:12px">${t('item.compare', { name: esc(G.itemName(cur)) })}</p>` : ''}
      <div class="modal-actions">
        <button class="btn" data-act="close">${t('common.close')}</button>
        ${equippedSlot
          ? `<button class="btn" data-act="unequip" data-slot="${equippedSlot}">${t('item.unequip')}</button>`
          : `<button class="btn danger" data-act="sell" data-id="${it.uid}">${t('item.sell', { v: G.fmt(G.itemValue(it)) })}</button>
             <button class="btn primary" data-act="equip" data-id="${it.uid}">${who === 'hero' ? t('item.equip') : t('item.equipTo', { name: esc(whoName(who)) })}</button>`}
      </div>`);
  }

  // ── 分頁：技能 ───────────────────────────────────────────────────────────
  // 角色切換列（角色、技能分頁共用；顯示各角色剩餘技能點）
  function whoBarHtml(withSp) {
    const S = G.S;
    const ids = Object.keys(S.partners).sort((a, b) => S.party.includes(b) - S.party.includes(a));
    if (!ids.length) return '';
    // 主角金色、出戰中綠色＋「出戰」標籤、休息中灰色
    return `<div class="who">${['hero', ...ids].map(id => {
      const sp = withSp ? G.spOf(id) : 0;
      const state = id === 'hero' ? 'hero' : S.party.includes(id) ? 'deployed' : 'resting';
      const tag = state === 'deployed' ? `<span class="wtag">${t('hero.deployedTag')}</span>` : state === 'resting' ? `<span class="wtag rest">${t('partners.resting')}</span>` : '';
      return `<button class="chip who-${state} ${UI.who === id ? 'on' : ''}" data-act="who" data-v="${id}">${id === 'hero' ? '🧍 ' : ''}${esc(whoName(id))}${tag}${sp ? ` <b class="gold">+${sp}</b>` : ''}</button>`;
    }).join('')}</div>`;
  }

  // 職業標籤：定位・範圍・系別
  function classTags(c) {
    const C = G.CLASSES[c];
    return `<span class="ctag">${G.CORE_ICON[C.core]} ${t(`core.${C.core}`)}</span><span class="ctag">${t(`range.${C.range}`)}</span><span class="ctag" style="color:${G.DMG_TYPES[C.dmgType]}">${t(`dtype.${C.dmgType}`)}</span>`;
  }
  UI.classTags = classTags;

  function slotGrid(kind, ch, list) {
    const slots = kind === 'active' ? ch.active : ch.passive;
    return `<div class="aslots">${slots.map((id, i) => {
      const sk = id && list.find(s => s.id === id);
      return `<button class="aslot ${sk ? 'filled ' + kind : ''}" data-act="slot" data-kind="${kind}" data-i="${i}">${sk
        ? `<b>${G.skillName(id)}</b><br><small class="muted">Lv ${ch.skills[id] || 0}</small>`
        : `<span class="muted">${t('skills.empty')}<br><small>${t('skills.emptyHint')}</small></span>`}</button>`;
    }).join('')}</div>`;
  }

  function renderSkills() {
    const S = G.S;
    if (UI.who !== 'hero' && !S.partners[UI.who]) UI.who = 'hero';
    const who = UI.who, ch = G.charOf(who), cls = ch.cls, list = G.SKILLS[cls] || [];
    const spent = G.spentPoints(who), sp = G.spOf(who);
    const tiers = [0, 1, 2].map(tier => {
      const sks = list.filter(s => s.tier === tier);
      if (!sks.length) return '';
      const locked = spent < G.TIER_REQ[tier];
      return `<div class="tier-title ${locked ? 'locked' : ''}">${t('skills.tier', { n: tier + 1 })}${tier ? t('skills.tierReq', { req: G.TIER_REQ[tier], cur: spent }) : ''}</div>` +
        sks.map(s => {
          const r = ch.skills[s.id] || 0;
          const equipped = (s.type === 'active' ? ch.active : ch.passive).includes(s.id);
          const now = r ? G.skillDesc(s, r) : t('skills.notLearned');
          const next = r < s.max ? t('skills.next', { desc: G.skillDesc(s, r + 1) }) : t('skills.maxed');
          return `<div class="skill ${locked ? 'locked' : ''} ${equipped ? 'eq ' + s.type : ''}">
            <div class="info">
              <div class="name">${G.skillName(s.id)}<span class="tag ${s.type}">${s.type === 'active' ? t('skills.active', { cd: s.cd }) : t('skills.passive')}</span>${equipped ? `<span class="tag eq">${t('skills.equipped')}</span>` : ''}</div>
              <div class="desc">${now}</div><div class="desc">${next}</div>
              <div class="pips">${Array.from({ length: s.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div>
            </div>
            <button class="btn small primary" data-act="learn" data-id="${s.id}" ${locked || r >= s.max || sp <= 0 ? 'disabled' : ''}>＋</button>
          </div>`;
        }).join('');
    }).join('');

    return `
      <div class="card">
        ${whoBarHtml(true)}
        <h3 class="row" style="gap:6px;justify-content:flex-start">${who === 'hero' ? '' : esc(whoName(who)) + '・'}${t('skills.points')} <span class="gold">${sp}</span><button class="btn small" style="white-space:nowrap" data-act="skreset" data-id="${who}" title="${esc(t('skills.resetHint'))}">${t('skills.resetBtn')}</button>${G.S.partners[who] ? `<span class="grow"></span><span class="muted" style="font-size:12px;font-weight:400;white-space:nowrap">Lv ${G.S.partners[who].level}</span><button class="btn small good" data-act="plevel" data-id="${who}">${t('partners.levelUp', { cost: G.fmt(G.partnerLevelCost(G.S.partners[who].level)) })}</button>` : ''}</h3>
        <div class="row" style="gap:10px;align-items:flex-start;margin:0 0 10px">
          <p class="muted grow" style="margin:0;font-size:12px">${t('skills.help', { a: G.ACTIVE_SLOTS, p: G.PASSIVE_SLOTS })}</p>
        </div>
        <div class="slot-label">${t('skills.activeSlots')}</div>
        ${slotGrid('active', ch, list)}
        <div class="slot-label">${t('skills.passiveSlots')}</div>
        ${slotGrid('passive', ch, list)}
      </div>
      <div class="card">
        <h3>${t('skills.tree', { cls: G.clsName(cls) })}</h3>
        ${cls === 'villager' ? `<p class="muted" style="margin:0 0 8px">${t('skills.villager', { lv: G.CONFIG.classUnlockLevel })}</p>` : `<div class="tags">${classTags(cls)}</div>`}
        ${tiers}
      </div>`;
  }

  function slotPicker(kind, i) {
    const who = UI.who, ch = G.charOf(who);
    const list = (G.SKILLS[ch.cls] || []).filter(s => s.type === kind && ch.skills[s.id] > 0);
    const slots = kind === 'active' ? ch.active : ch.passive;
    UI.modal(`
      <h2>${t(kind === 'active' ? 'skills.pickActive' : 'skills.pickPassive', { n: i + 1 })}</h2>
      ${list.map(s => `<button class="btn ${slots.includes(s.id) ? 'on' : ''}" style="width:100%;margin-bottom:8px;text-align:left;white-space:normal" data-act="setslot" data-kind="${kind}" data-i="${i}" data-id="${s.id}">
        <b>${G.skillName(s.id)}</b> Lv ${ch.skills[s.id]}　<span class="muted">${G.skillDesc(s, ch.skills[s.id])}</span></button>`).join('') || `<p class="muted">${t(kind === 'active' ? 'skills.noActive' : 'skills.noPassive')}</p>`}
      <div class="modal-actions">
        ${slots[i] ? `<button class="btn" data-act="setslot" data-kind="${kind}" data-i="${i}" data-id="">${t('skills.clear')}</button>` : ''}
        <button class="btn" data-act="close">${t('common.close')}</button>
      </div>`);
  }

  // ── 分頁：夥伴 ───────────────────────────────────────────────────────────
  // 夥伴專屬 buff 標籤（永久、不能升級，出戰時給全隊）
  function perkTag(p) {
    if (!p.perk) return '';
    const tag = txt => `<span class="tag perk" title="${esc(t('partners.perkHint'))}">★ ${txt}</span>`;
    return tag(t('perk.' + p.perk.stat, { v: Math.round(p.perk.v * 100) })) + (p.perk.extra ? tag(t('perk.' + p.perk.extra, { cap: G.DEFDOWN_STACK_CAP })) : '');
  }
  function renderPartners() {
    const S = G.S;
    const cards = G.PARTNERS.map(p => {
      const own = S.partners[p.id];
      if (!own) {
        const open = S.maxFloor >= p.floor;
        return `<div class="card partner ${open ? '' : 'locked'}">
          <canvas data-doll="${p.id}" width="64" height="80"></canvas>
          <div class="grow">
            <b>${open ? G.partnerName(p.id) : t('partners.unknown')}</b>
            <div class="muted" style="font-size:12px;margin:4px 0 8px">${open ? t(`partner.${p.id}.bio`) + '<br>' + perkTag(p) : t('partners.meetAt', { n: p.floor })}</div>
            ${open ? `<button class="btn small primary" data-act="recruit" data-id="${p.id}">${t('partners.recruit', { cost: G.fmt(G.partnerRecruitCost(p)) })}</button>` : ''}
          </div></div>`;
      }
      const st = G.partnerStats(p.id), inParty = S.party.includes(p.id), sp = G.spOf(p.id);
      const nSk = own.active.filter(Boolean).length + own.passive.filter(Boolean).length;
      return `<div class="card partner">
        <canvas data-doll="${p.id}" width="64" height="80"></canvas>
        <div class="grow">
          <div class="row between"><b>${G.partnerName(p.id)} <span class="muted">Lv ${own.level}</span>${perkTag(p)}</b>
            <button class="btn small ${inParty ? 'on' : ''}" data-act="party" data-id="${p.id}">${inParty ? t('partners.inParty') : t('partners.resting')}</button></div>
          <div class="tags" style="margin:4px 0">${classTags(own.cls)}</div>
          <div class="muted" style="font-size:12px;margin:4px 0">${t('partners.stats', { hp: G.fmt(st.maxHp), atk: st.atk, def: st.def })}</div>
          <div class="row wrap" style="margin-top:6px">
            <select data-act="pclass" data-id="${p.id}">
              ${G.CLASS_ORDER.map(c => `<option value="${c}" ${own.cls === c ? 'selected' : ''}>${G.clsName(c)}</option>`).join('')}
            </select>
            <button class="btn small good" data-act="plevel" data-id="${p.id}">${t('partners.levelUp', { cost: G.fmt(G.partnerLevelCost(own.level)) })}</button>
            <button class="btn small" data-act="pskills" data-id="${p.id}">📜 ${t('partners.skills', { n: nSk })}${sp ? ` <b class="gold">+${sp}</b>` : ''}</button>
          </div>
        </div></div>`;
    }).join('');
    return `${renderFriends()}${renderMerc()}
      <div class="card"><h3>${t('partners.title')} <small>${t('partners.deployed', { n: S.party.length, max: G.CONFIG.maxParty })}</small></h3>
      <p class="muted" style="margin:0;font-size:12px">${t('partners.help')}</p></div>${renderSynergy()}${cards}`;
  }

  // ── 團隊特效：目前組合＋生效效果；全部特效表收在折疊區（展開狀態記在 UI，重繪不會自己收起）──
  function synBonusText(bonus) {
    return Object.entries(bonus).map(([k, v]) => t('syn.b.' + k, { v: k === 'cannonInterval' ? v : Math.round(v * 1000) / 10 })).join(t('syn.sep'));
  }
  function dtypeTag(type) {
    return `<span class="ctag" style="color:${G.DMG_TYPES[type]}">${t('dtype.' + type)}</span>`;
  }
  function renderSynergy() {
    const syn = G.teamSynergy();
    const lineup = syn.members.map(m => `<span class="syn-mem">${esc(G.whoName(m.who))} ${dtypeTag(m.type)}</span>`).join('');
    const active = syn.active.map(a => `<div class="syn-on"><b>✦ ${t(`syn.${a.id}.name`)}</b>
        <span class="muted">${a.n ? t('syn.cond.type', { type: t('dtype.' + G.TEAM_SYNERGIES.find(x => x.id === a.id).type), n: a.n }) : ''}</span>
        <div>${synBonusText(G.scaleSynergy(a.bonus, G.synergyPow()))}${G.synergyPow() ? ` <span class="tag perk">${t('syn.herd', { v: Math.round(G.synergyPow() * 100) })}</span>` : ''}</div></div>`).join('');
    const rows = G.TEAM_SYNERGIES.map(sy => {
      const on = syn.active.find(a => a.id === sy.id);
      if (sy.mix) {
        return `<div class="syn-row ${on ? 'on' : ''}"><b>${t(`syn.${sy.id}.name`)}</b>
          <span class="muted">${t('syn.cond.mix', { list: sy.mix.map(x => t('dtype.' + x)).join(t('syn.sep')) })}</span>
          <div>${synBonusText(sy.bonus)}</div></div>`;
      }
      return `<div class="syn-row ${on ? 'on' : ''}"><b>${t(`syn.${sy.id}.name`)}</b>
        ${Object.entries(sy.tiers).map(([n, b]) => `<div class="${on && on.n === +n ? 'gold' : ''}"><span class="muted">${t('syn.cond.type', { type: t('dtype.' + sy.type), n })}</span>：${synBonusText(b)}</div>`).join('')}</div>`;
    }).join('');
    return `<div class="card syn">
      <h3>🔗 ${t('syn.title')}</h3>
      <p class="muted" style="margin:0 0 8px;font-size:12px">${t('syn.help')}</p>
      <div class="slot-label" style="margin-top:0">${t('syn.current')}</div>
      <div class="syn-lineup">${lineup}</div>
      <div class="slot-label">${t('syn.active')}</div>
      ${active || `<p class="muted" style="margin:0;font-size:12px">${t('syn.none')}</p>`}
      <details class="syn-list" ${UI.synOpen ? 'open' : ''} data-syn-list>
        <summary>${t('syn.list')}</summary>${rows}
      </details>
    </div>`;
  }
  // 記住折疊區有沒有打開（分頁重繪時保持）
  document.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('[data-syn-list]')) UI.synOpen = e.target.open; }, true);

  // ── 好友（代碼制）：複製我的代碼、貼上匯入、好友列表（查看 / 雇用 / 移除）──
  function renderFriends() {
    const S = G.S, list = G.friendList();
    const rows = list.map(p => {
      const hired = S.merc && S.merc.id === p.id;
      return `<div class="friend ${hired ? 'hired' : ''}">
        <div class="grow"><b>${esc(p.name)}</b> <span class="muted" style="font-size:11px">${p.id}</span>
          <div class="muted" style="font-size:11px">Lv ${p.level} ${G.clsName(p.merc.char.cls)}・${t('friends.floor', { n: p.maxFloor || p.floor || 1 })}・${t('friends.updated', { t: G.agoText(p.at) })}</div></div>
        <button class="btn small" data-act="fview" data-id="${p.id}">${t('friends.view')}</button>
        ${hired ? `<button class="btn small on" disabled>${t('friends.hired')}</button>`
          : `<button class="btn small primary" data-act="hire" data-id="${p.id}">${t('friends.hire', { cost: G.hireCost(p.level || 1) })}</button>`}
        <button class="btn small" data-act="unfriend" data-id="${p.id}" title="${t('friends.remove')}">✕</button>
      </div>`;
    }).join('');
    return `<div class="card">
      <h3>👥 ${t('friends.title')} <small>${list.length}/${G.MAX_FRIENDS}</small></h3>
      <div class="row" style="margin-bottom:6px">
        <span class="grow">${esc(G.myName())}　<span class="muted">ID</span> <b class="gold">${G.myId() || '—'}</b></span>
        <button class="btn small primary" data-act="exportcode">📋 ${t('friends.export')}</button>
      </div>
      <p class="muted" style="font-size:11px;margin:0 0 8px">${t('friends.exportHelp')}</p>
      <div class="row" style="margin-bottom:8px;align-items:stretch">
        <textarea id="friendInput" class="text-input grow" rows="2" placeholder="${t('friends.inputPh')}" autocomplete="off" spellcheck="false">${esc(UI.friendDraft || '')}</textarea>
        <button class="btn small good" data-act="importcode">${t('friends.import')}</button>
      </div>
      ${rows || `<p class="muted" style="font-size:12px;margin:0">${t('friends.empty')}</p>`}
    </div>`;
  }

  // 雇用中的好友主角（佔一個出戰名額）
  function renderMerc() {
    const m = G.S.merc;
    if (!m) return '';
    const st = G.charStats(G.MERC), inParty = G.S.party.includes(G.MERC);
    return `<div class="card partner merc">
      <canvas data-doll="${G.MERC}" width="64" height="80"></canvas>
      <div class="grow">
        <div class="row between"><b>${esc(m.name)} <span class="wtag">${t('merc.tag')}</span></b>
          <button class="btn small ${inParty ? 'on' : ''}" data-act="party" data-id="${G.MERC}">${inParty ? t('partners.inParty') : t('partners.resting')}</button></div>
        <div class="tags" style="margin:4px 0">${classTags(m.snap.char.cls)}</div>
        <div class="muted" style="font-size:12px;margin:4px 0">Lv ${m.snap.level}・${t('partners.stats', { hp: G.fmt(st.maxHp), atk: st.atk, def: st.def })}</div>
        <p class="muted" style="font-size:11px;margin:4px 0">${t('merc.help')}</p>
        <button class="btn small danger" data-act="dismiss">${t('merc.dismiss')}</button>
      </div></div>`;
  }

  // 查看好友：飛空艇外觀＋主角
  function friendModal(id) {
    const p = G.S.friendData[id];
    if (!p) return;
    const hired = G.S.merc && G.S.merc.id === id;
    UI.modal(`<h2>${t('friends.viewTitle', { name: esc(p.name) })}</h2>
      <div class="muted" style="font-size:12px;margin-bottom:8px">ID ${id}・${t('friends.updated', { t: G.agoText(p.at) })}</div>
      <canvas class="ship-view" id="fShip"></canvas>
      <div class="doll-wrap" style="margin-top:10px">
        <canvas class="doll" id="fDoll"></canvas>
        <div class="grow stats" style="grid-template-columns:1fr">
          <div>${t('friends.level')} <b>Lv ${p.level}</b></div>
          <div>${t('hero.class')} <b>${G.clsName(p.merc.char.cls)}</b></div>
          <div>${t('friends.nowFloor')} <b>${t('floor.name', { n: p.floor || 1 })}</b></div>
          <div>${t('friends.bestFloor')} <b>${t('floor.name', { n: p.maxFloor || 1 })}</b></div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" data-act="close">${t('common.close')}</button>
        ${hired ? '' : `<button class="btn primary" data-act="hire" data-id="${id}">${t('friends.hire', { cost: G.hireCost(p.level || 1) })}</button>`}
      </div>`);
    const ship = $('fShip'), doll = $('fDoll');
    ship.width = 640; ship.height = 480;
    G.ART.drawShip(ship.getContext('2d'), p.ship, 640, 480);
    doll.width = 256; doll.height = 320;
    G.ART.drawHumanoid(doll.getContext('2d'), p.look, (256 - 64 * 3.6) / 2, (320 - 80 * 3.6) / 2, 3.6);
  }

  // 複製我的好友代碼；瀏覽器不給複製時，跳出視窗讓玩家自己全選複製
  async function exportCode() {
    const code = await G.exportCode();
    try {
      await navigator.clipboard.writeText(code);
      UI.toast(t('friends.exported'));
    } catch {
      UI.modal(`<h2>${t('friends.codeTitle')}</h2><p class="muted" style="font-size:12px">${t('friends.copyManual')}</p>
        <textarea class="text-input" style="width:100%;height:140px;font-size:11px" readonly onclick="this.select()">${code}</textarea>
        <div class="modal-actions"><button class="btn primary" data-act="close">${t('common.close')}</button></div>`);
    }
  }

  async function importCode() {
    const el = $('friendInput');
    const ok = await G.importCode(el ? el.value : '');
    if (ok) UI.friendDraft = '';
    UI.refresh(['partners']);
  }

  // ── 開場：輸入冒險者名稱 → 取得遊戲 ID（在本機產生，不需要網路）──────────
  UI.askName = function (onDone) {
    const show = err => UI.modal(`<div class="prologue name-entry">
      <h2>${t('name.title')}</h2>
      <p class="muted" style="font-size:13px;min-height:0">${t('name.help', { max: G.NAME_MAX / 2, en: G.NAME_MAX })}</p>
      <input id="nameInput" class="text-input" style="width:100%" placeholder="${t('name.placeholder')}" value="${esc(UI.nameDraft || '')}">
      <div class="row between" style="margin-top:6px"><small id="nameErr" style="color:var(--bad)">${err || ''}</small><small id="nameCount" class="muted"></small></div>
      <div class="modal-actions"><button class="btn primary" data-act="namego">${t('name.ok')}</button></div></div>`);
    const count = () => {
      const el = $('nameInput'); if (!el) return;
      UI.nameDraft = el.value;
      const w = G.nameWidth(G.cleanName(el.value));
      $('nameCount').textContent = `${w}/${G.NAME_MAX}`;
      $('nameCount').style.color = w > G.NAME_MAX ? 'var(--bad)' : '';
    };
    UI.nameShow = err => { show(err); count(); };
    UI.nameDone = onDone;
    UI.nameCount = count;
    UI.nameShow();
    setTimeout(() => { const el = $('nameInput'); if (el) el.focus(); }, 50);
  };

  function submitName() {
    const name = G.cleanName(UI.nameDraft || '');
    if (!name) return UI.nameShow(t('name.empty'));
    if (G.nameWidth(name) > G.NAME_MAX) return UI.nameShow(t('name.tooLong'));
    const acc = G.createAccount(name);
    UI.close();
    UI.toast(t('name.done', { id: acc.id }));
    UI.nameDone();
  }

  function mountPartnerDolls() {
    $('panel').querySelectorAll('canvas[data-doll]').forEach(c => {
      const id = c.dataset.doll;
      if (id === G.MERC) { c.width = 128; c.height = 160; if (G.S.merc) G.ART.drawHumanoid(c.getContext('2d'), G.S.merc.snap.look, 0, 0, 2); return; }
      const own = G.S.partners[id], def = G.PARTNERS.find(p => p.id === id);
      const look = own ? G.ART.lookFromPartner(id) : { skin: def.skin, hair: def.hair, cls: 'villager' };
      c.width = 128; c.height = 160;
      const ctx = c.getContext('2d');
      if (!own && G.S.maxFloor < def.floor) ctx.filter = 'brightness(0)';
      G.ART.drawHumanoid(ctx, look, 0, 0, 2);
    });
  }

  // ── 分頁：飛空艇（零件商店：7 個部位 × 5 款）───────────────────────────
  // 每款的效果文字
  function partEffect(slot, i) {
    const v = G.SHIP_PARTS[slot].v[i], pct = Math.round(v * 100);
    if (slot === 'hull') { const s = G.homeSize(i); return t('part.hull.desc', { v: pct, w: s.w, h: s.h }); }
    if (slot === 'wing' || slot === 'engine') return t(`part.${slot}.desc`, { v });
    if (slot === 'cannon') return t('part.cannon.desc', { v: pct, n: G.fmt(Math.round(G.heroStats().atk * v)) });   // 基礎傷害 = 主角攻擊 × 倍率
    return t(`part.${slot}.desc`, { v: pct });
  }

  function renderShip() {
    const S = G.S, sh = S.ship, b = G.shipBonus();
    const pct = v => `+${Math.round(v * 100)}%`;
    // 目前加成總覽
    const summary = [
      ['🎈', t('ship.sum.hp'), pct(b.hpPct)], ['🚢', t('ship.sum.def'), pct(b.defPct)], ['🗿', t('ship.sum.dmg'), pct(b.dmgPct)],
      ['🔔', t('ship.sum.gold'), pct(b.goldPct)], ['💣', t('ship.sum.cannon'), G.cannonMult() ? `${G.fmt(Math.round(G.heroStats().atk * G.cannonMult()))}（${Math.round(G.cannonMult() * 100)}%）` : '—'],
      ['🧭', t('ship.sum.floors'), t('floor.name', { n: G.shipMaxFloor() })],
    ].map(([i, k, v]) => `<div>${i} ${k} <b>${v}</b></div>`).join('');

    const slots = G.SHIP_SLOTS.map(slot => {
      const P = G.SHIP_PARTS[slot], cur = sh.eq[slot];
      const rows = P.v.map((_, i) => {
        const own = sh.owned[slot].includes(i), using = cur === i, c = G.shipPartCost(slot, i);
        const price = [c.gold ? `${G.fmt(c.gold)}💰` : '', c.crystal ? `${c.crystal}💎` : ''].filter(Boolean).join(' ') || t('ship.free');
        // 使用中 → 紅色；已擁有可裝上 → 淡藍色
        const btn = using ? `<button class="btn small ship-using" disabled>${t('ship.using')}</button>`
          : own ? `<button class="btn small ship-equip" data-act="shipeq" data-slot="${slot}" data-i="${i}">${t('ship.equip')}</button>`
          : `<button class="btn small primary" data-act="shipbuy" data-slot="${slot}" data-i="${i}">${price}</button>`;
        return `<div class="model ${using ? 'using' : ''}">
          <span class="tier">${['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'][i]}</span>
          <div class="grow"><b>${t(`part.${slot}.${i}`)}</b><div class="muted" style="font-size:11px">${partEffect(slot, i)}</div></div>${btn}</div>`;
      }).join('');
      return `<div class="card">
        <h3>${P.icon} ${t(`part.${slot}.name`)} <small>${cur >= 0 ? t(`part.${slot}.${cur}`) : t('ship.none')}</small></h3>
        <p class="muted" style="font-size:12px;margin:-4px 0 8px">${t(`part.${slot}.what`)}</p>
        ${slot === 'cannon' ? `<p class="cannon-base">${t('ship.cannonBase', { atk: G.heroStats().atk, s: G.cannonInterval() })}</p>` : ''}
        ${rows}</div>`;
    }).join('');

    return `
      <div class="card"><canvas class="ship-view" id="shipSlot"></canvas>
        <p class="muted" style="font-size:12px;margin:8px 0 10px">${t('ship.help')}</p>
        <div class="stats">${summary}</div></div>
      ${slots}
      <div class="card"><h3>${t('ship.paint')}</h3>
        <div class="swatches">${G.SHIP_PAINTS.map((c, i) => `<button class="swatch ${sh.paint === i ? 'on' : ''}" style="background:${c}" data-act="paint" data-v="${i}"></button>`).join('')}</div>
      </div>`;
  }

  // ── 分頁：家園（飛空艇內部）─────────────────────────────────────────────
  function renderHome() {
    const S = G.S, { w, h } = G.homeSize(G.homeTier()), petCap = G.petCap();
    let cells = '';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const key = `${x},${y}`, id = S.home[key], f = id && G.FURNITURE.find(z => z.id === id);
      cells += `<button class="cell ${UI.placing && !id ? 'placing' : ''}" data-act="cell" data-k="${key}" title="${f ? t(`furniture.${id}`) : ''}">${f ? f.icon : ''}</button>`;
    }
    const stock = Object.entries(S.furniture).filter(([, n]) => n > 0).map(([id, n]) => {
      const f = G.FURNITURE.find(z => z.id === id);
      return `<button class="chip ${UI.placing === id ? 'on' : ''}" data-act="pick" data-id="${id}">${f.icon} ${t(`furniture.${id}`)} ×${n}</button>`;
    }).join('');
    const shop = G.FURNITURE.map(f => `<button data-act="buy" data-id="${f.id}"><b>${f.icon}</b>${t(`furniture.${f.id}`)}${f.collect ? ` <span class="tag passive">${t('home.collect')}</span>` : ''}<br>
      <small class="muted">${f.cur === 'gold' ? G.fmt(f.price) + '💰' : f.price + '💎'}・${t('home.comfortPlus', { n: f.comfort })}</small></button>`).join('');

    return `
      <div class="card">
        <h3>${t('home.title')} <small>${t('home.comfort', { c: G.comfort() })}</small></h3>
        <div class="home-grid" style="grid-template-columns:repeat(${w},1fr)">${cells}</div>
        <p class="muted" style="font-size:12px;margin:8px 0 0">${UI.placing ? t('home.placingHint') : t('home.hint')}${t('home.hullHint')}</p>
      </div>
      <div class="card"><h3>${t('home.storage')}</h3><div class="chips">${stock || `<span class="muted">${t('home.storageEmpty')}</span>`}</div></div>
      <div class="card"><h3>${t('home.shop')}</h3><div class="shop">${shop}</div></div>
      ${renderNets()}
      <div class="card">
        <h3>${t('home.pets')} <small>${t('home.petsInfo', { n: S.pets.length, cap: petCap })}</small></h3>
        <div class="pets">${S.pets.map((p, i) => `<div class="pet"><canvas data-pet="${i}"></canvas><small>${esc(G.petName(p))}</small><small class="gold">${petBonusText(p)}</small></div>`).join('') || `<span class="muted">${t('home.noPets')}</span>`}</div>
      </div>
      ${renderDex()}`;
  }

  const petBonusText = p => {
    if (!p.bonus) return '';
    const v = p.bonus.stat === 'crit' ? p.bonus.v : Math.round(p.bonus.v * 100);
    return t(`petBonus.${p.bonus.stat}`, { v });
  };

  // 捕獸網：五款，買了直接裝上，永久生效
  function renderNets() {
    const net = G.S.net;
    const rows = G.NETS.map((n, i) => {
      const own = net.owned.includes(i), using = net.eq === i;
      const price = [n.gold ? `${G.fmt(n.gold)}💰` : '', n.crystal ? `${n.crystal}💎` : ''].filter(Boolean).join(' ');
      const btn = using ? `<button class="btn small on" disabled>${t('ship.using')}</button>`
        : own ? `<button class="btn small good" data-act="neteq" data-i="${i}">${t('ship.equip')}</button>`
        : `<button class="btn small primary" data-act="netbuy" data-i="${i}">${price}</button>`;
      return `<div class="model ${using ? 'using' : ''}"><span class="tier">${n.icon}</span>
        <div class="grow"><b>${t(`net.${n.id}`)}</b><div class="muted" style="font-size:11px">${t('net.rate', { p: Math.round(n.rate * 100) })}</div></div>${btn}</div>`;
    }).join('');
    return `<div class="card">
      <h3>🕸️ ${t('net.title')} <small>${net.eq >= 0 ? t('net.rate', { p: Math.round(G.captureChance() * 100) }) : t('net.none')}</small></h3>
      <p class="muted" style="font-size:12px;margin:-4px 0 8px">${t('net.help')}</p>${rows}</div>`;
  }

  // 怪物圖鑑：打倒層主登錄（已發現）、捕獲再點亮（★），各領一次雲晶
  function renderDex() {
    const all = G.MONSTER_TIERS.flat(), dex = G.S.dex;
    const seen = all.filter(m => dex[m.id] && dex[m.id].seen).length, caught = all.filter(m => dex[m.id] && dex[m.id].caught).length;
    const anyClaim = all.some(m => G.dexClaimable(m.id));
    const cells = all.map(m => {
      const e = dex[m.id] || {}, tier = G.monsterTierOf(m.id);
      const claim = G.dexClaimable(m.id);
      return `<button class="dex ${e.seen ? '' : 'unknown'} ${claim ? 'claim' : ''}" data-act="dexclaim" data-id="${m.id}">
        <canvas data-dex="${m.id}"></canvas>
        <small>${e.seen ? G.monsterName(m.id) : '？？？'}</small>
        <span class="stars">${e.seen ? '👁' : '·'}${e.caught ? '⭐' : '·'}</span>
        ${claim ? `<span class="dex-badge">+${(e.seen && !e.seenClaimed ? G.dexReward(tier, 'seen') : 0) + (e.caught && !e.caughtClaimed ? G.dexReward(tier, 'caught') : 0)}💎</span>` : ''}
      </button>`;
    }).join('');
    return `<div class="card">
      <h3>📖 ${t('dex.title')} <small>${t('dex.progress', { s: seen, c: caught, n: all.length })}</small></h3>
      <p class="muted" style="font-size:12px;margin:-4px 0 8px">${t('dex.help')}</p>
      ${anyClaim ? `<button class="btn small primary" data-act="dexclaim" data-id="" style="margin-bottom:8px">${t('dex.claimAll')}</button>` : ''}
      <div class="dex-grid">${cells}</div></div>`;
  }

  function mountPets() {
    $('panel').querySelectorAll('canvas[data-pet]').forEach(c => {
      const p = G.S.pets[+c.dataset.pet];
      c.width = 96; c.height = 96;
      G.ART.drawMonster(c.getContext('2d'), p.shape, p.color, 0, 0, 1.5);
    });
    $('panel').querySelectorAll('canvas[data-dex]').forEach(c => {
      const m = G.MONSTER_TIERS.flat().find(x => x.id === c.dataset.dex), e = G.S.dex[m.id];
      c.width = 96; c.height = 96;
      const ctx = c.getContext('2d');
      if (!e || !e.seen) ctx.filter = 'brightness(0) opacity(.5)';   // 還沒發現：剪影
      G.ART.drawMonster(ctx, m.shape, m.color, 0, 0, 1.5);
    });
  }

  // ── 設定（右上角 ⚙️）：之後新增的設定都放這裡 ────────────────────────────
  function settingsModal() {
    const S = G.S;
    UI.modal(`
      <h2>⚙️ ${t('settings.title')}</h2>
      <div class="set-group">
        <div class="set-label">🧭 ${t('settings.account')}</div>
        <div style="font-size:13px">${esc(G.myName() || '—')}　<span class="muted">ID</span> <b class="gold">${G.myId() || '—'}</b>
          ${G.myId() ? `<button class="btn small" data-act="copyid" style="margin-left:6px">${t('friends.copy')}</button>` : ''}</div>
      </div>
      <div class="set-group">
        <div class="set-label">🌐 ${t('settings.language')}</div>
        <div class="chips">${G.LANGS.map(l => `<button class="chip ${G.settings.lang === l.id ? 'on' : ''}" data-act="lang" data-v="${l.id}">${l.name}</button>`).join('')}</div>
      </div>
      <div class="set-group">
        <div class="set-label">🎮 ${t('settings.game')}</div>
        <div class="muted" style="font-size:12px;margin:0 0 6px">${t('settings.autosell')}</div>
        <div class="row wrap" style="gap:10px 16px">${[0, 1, 2, 3].map(r => `<label class="switch"><input type="checkbox" data-act="autosell" data-v="${r}" ${S.autoSell[r] ? 'checked' : ''}><i></i><span style="color:${G.RARITY[r].color}">${t('rarity.' + r)}</span></label>`).join('')}</div>
      </div>
      <div class="set-group">
        <div class="set-label">💾 ${t('settings.data')}</div>
        <p class="muted" style="font-size:12px;margin:0 0 8px">${t('settings.saveNote')}</p>
        <div class="row wrap">
          <button class="btn small danger" data-act="reset">${t('settings.reset')}</button>
          <button class="btn small" data-act="credits">${t('settings.credits')}</button>
        </div>
      </div>
      <div class="modal-actions"><button class="btn primary" data-act="close">${t('common.close')}</button></div>`);
  }

  function creditsModal() {
    UI.modal(`<h2>${t('settings.credits')}</h2>
      <p>${t('credits.body')}</p>
      <pre style="white-space:pre-wrap;font-size:10px;line-height:1.5;color:var(--muted);background:#120e20;padding:10px;border-radius:8px">The MIT License (MIT)

Copyright (c) 2024 Richard Davey, Phaser Studio Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</pre>
      <div class="modal-actions"><button class="btn" data-act="settings">◀ ${t('settings.title')}</button><button class="btn primary" data-act="close">${t('common.close')}</button></div>`);
  }

  // ── 繪製目前分頁 ─────────────────────────────────────────────────────────
  const RENDER = { adventure: renderAdventure, hero: renderHero, skills: renderSkills, partners: renderPartners, ship: renderShip, home: renderHome };
  UI.render = function () {
    $('panel').innerHTML = RENDER[UI.tab]();
    if (UI.tab === 'hero') mount('#dollSlot', dollCanvas(UI.who === 'hero' ? G.ART.lookFromHero() : G.ART.lookFromPartner(UI.who), 128, 160, 1.8));
    if (UI.tab === 'partners') mountPartnerDolls();
    if (UI.tab === 'home') mountPets();
    if (UI.tab === 'ship') {
      const c = G.ART.canvas(640, 480);
      G.ART.drawShip(c.getContext('2d'), G.shipLook(), 640, 480);
      mount('#shipSlot', c);
    }
  };
  // 同一幀內多次觸發只重畫一次
  let pending = false;
  UI.refresh = function (tabs) {
    if (tabs && !tabs.includes(UI.tab)) return;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; UI.render(); });
  };

  // ── 彈窗 / 提示 ──────────────────────────────────────────────────────────
  // 金幣 ⇄ 雲晶 兌換視窗
  function exchangeModal() {
    const S = G.S, R = G.EXCHANGE_RATE;
    const quick = dir => [1, 10, 100].map(n => `<button class="btn small" data-act="exdo" data-dir="${dir}" data-n="${n}">${G.fmt(n)}💎</button>`).join('')
      + `<button class="btn small good" data-act="exdo" data-dir="${dir}" data-n="max">${t('ex.max')} (${G.fmt(G.exchangeMax(dir))}💎)</button>`;
    UI.modal(`<h2>${t('ex.title')}</h2>
      <p class="muted" style="font-size:12px">${t('ex.rate', { r: R })}</p>
      <p><b>💰 ${G.fmt(S.gold)}</b>　<b>💎 ${G.fmt(S.crystal)}</b></p>
      <div class="slot-label">${t('ex.toCrystal', { r: R })}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">${quick('toCrystal')}</div>
      <div class="slot-label">${t('ex.toGold', { r: R })}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">${quick('toGold')}</div>
      <div class="row" style="gap:6px;align-items:center;flex-wrap:wrap">
        <input id="exN" type="number" min="1" step="1" value="1" style="width:90px">💎
        <button class="btn small" data-act="exdo" data-dir="toCrystal" data-n="input">${t('ex.buyN')}</button>
        <button class="btn small" data-act="exdo" data-dir="toGold" data-n="input">${t('ex.sellN')}</button>
      </div>
      <div class="modal-actions"><button class="btn" data-act="close">${t('common.close')}</button></div>`);
  }

  UI.modal = function (html) { $('modalCard').innerHTML = html; $('modal').hidden = false; };
  UI.close = function () { $('modal').hidden = true; UI.modalKind = null; };
  let toastT;
  UI.toast = function (text) {
    const el = $('toast');
    el.textContent = text; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400);
  };

  UI.prologue = function (onDone) {
    let i = 1;
    const n = G.PROLOGUE_PAGES;
    const show = () => UI.modal(`<div class="prologue"><h2>${t('prologue.title')}</h2><p>${t(`prologue.${i}`)}</p>
      <div class="modal-actions"><span class="muted grow" style="align-self:center">${i}/${n}</span>
      <button class="btn primary" data-act="prologue">${i < n ? t('prologue.next') : t('prologue.go')}</button></div></div>`);
    UI.showPrologue = show;   // 切換語言時重畫目前這頁
    UI.nextPrologue = () => { i++; if (i <= n) show(); else { UI.showPrologue = null; UI.close(); onDone(); } };
    show();
  };

  // ── 事件代理：所有按鈕 ───────────────────────────────────────────────────
  function act(el) {
    const a = el.dataset.act, d = el.dataset, S = G.S;
    switch (a) {
      case 'close': UI.close(); break;
      case 'prologue': UI.nextPrologue(); break;
      case 'settings': UI.modalKind = 'settings'; settingsModal(); break;
      case 'exchange': exchangeModal(); break;
      case 'exdo': {
        const n = d.n === 'max' ? G.exchangeMax(d.dir) : d.n === 'input' ? +($('exN') || {}).value : +d.n;
        if (G.exchange(d.dir, n)) exchangeModal();
        break;
      }
      case 'lang': G.setLang(d.v); break;
      case 'floor': S.autoAdvance = +d.v > S.floor ? true : S.autoAdvance; G.setFloor(+d.v); UI.refresh(); break;
      case 'auto': S.autoAdvance = el.checked; break;
      case 'autosell': S.autoSell[+d.v] = el.checked; break;
      case 'reset': UI.modalKind = 'reset'; UI.modal(`<h2>${t('reset.title')}</h2><p>${t('reset.body')}</p>
        <div class="modal-actions"><button class="btn" data-act="settings">${t('common.cancel')}</button><button class="btn danger" data-act="reset2">${t('reset.confirm')}</button></div>`); break;
      case 'reset2': G.resetSave(); break;
      case 'credits': UI.modalKind = 'credits'; creditsModal(); break;
      case 'revivePay': G.battleScene().revivePaid(); break;
      case 'item':
        if (d.slot) itemModal(G.gearOf(UI.who)[d.slot], d.slot);
        else itemModal(S.inventory.find(i => i.uid === +d.id));
        break;
      case 'equip': G.equip(+d.id, UI.who); UI.close(); UI.refresh(); break;
      case 'unequip': G.unequip(d.slot, UI.who); UI.close(); UI.refresh(); break;
      case 'who': UI.who = d.v; UI.render(); break;
      case 'livewho': UI.liveWho = d.v; lastWhoSig = ''; renderLive(G.battleScene()); break;
      case 'expand': G.expandBag(); break;
      case 'collapse': setCollapsed(!G.settings.battleCollapsed); break;
      case 'buff': {
        const b = UI.buffs.find(x => x.id === d.id);
        if (b) UI.toast(`${b.icon} ${t(`buff.${b.id}.name`)}：${t(`buff.${b.id}.desc`, b.p)}`);
        break;
      }
      case 'sell': G.sell(+d.id); UI.close(); break;
      case 'autoequip': G.autoEquip(d.scope === 'one' ? UI.who : null); break;
      case 'clspick': UI.clsPick = d.cls; UI.render(); break;
      case 'sellbelow':
        // 紫色是好東西：要在 3 秒內按第二次才賣，避免手滑
        if (+d.v >= 3 && UI.sellArmed !== el) {
          UI.sellArmed = el; const label = el.textContent; el.textContent = t('hero.sellConfirm');
          setTimeout(() => { if (UI.sellArmed === el) { UI.sellArmed = null; el.textContent = label; } }, 3000);
          break;
        }
        UI.sellArmed = null; G.sellAllBelow(+d.v); break;
      case 'class': {
        if (S.hero.cls === d.cls) break;
        UI.modal(`<h2>${t('classModal.title', { name: G.clsName(d.cls) })}</h2><p>${t(`class.${d.cls}.desc`)}</p>
          <p class="muted">${S.hero.cls === 'villager' ? t('classModal.free') : t('classModal.cost', { cost: G.CONFIG.classChangeCost })}${t('classModal.refund')}</p>
          <div class="modal-actions"><button class="btn" data-act="close">${t('common.cancel')}</button><button class="btn primary" data-act="class2" data-cls="${d.cls}">${t('classModal.confirm')}</button></div>`);
        break;
      }
      case 'class2': G.changeClass(d.cls); UI.close(); UI.refresh(); break;
      case 'learn': G.learnSkill(d.id, UI.who); break;
      case 'slot': slotPicker(d.kind, +d.i); break;
      case 'setslot': G.setSkillSlot(UI.who, d.kind, +d.i, d.id || null); UI.close(); break;
      case 'pskills': UI.who = d.id; switchTab('skills'); break;
      case 'namego': submitName(); break;
      case 'exportcode': exportCode(); break;
      case 'importcode': importCode(); break;
      case 'unfriend': G.removeFriend(d.id); break;
      case 'fview': friendModal(d.id); break;
      case 'hire': G.hireFriend(d.id); if (!$('modal').hidden) UI.close(); break;
      case 'dismiss': G.dismissMerc(); break;
      case 'copyid':
        try { navigator.clipboard.writeText(G.myId()); UI.toast(t('friends.copied')); } catch { UI.toast(G.myId()); }
        break;
      case 'recruit': G.recruit(d.id); break;
      case 'party': G.toggleParty(d.id); break;
      case 'plevel': G.partnerLevelUp(d.id); break;
      case 'skreset': UI.modal(`<h2>${t('skills.reset')}</h2><p>${t('skills.resetBody', { who: esc(whoName(d.id)) })}</p>
        <div class="modal-actions"><button class="btn" data-act="close">${t('common.cancel')}</button><button class="btn good" data-act="skreset2" data-id="${d.id}">${t('skills.resetConfirm')}</button></div>`); break;
      case 'skreset2': UI.close(); G.resetSkillPoints(d.id); break;
      case 'shipbuy': G.buyShipPart(d.slot, +d.i); break;
      case 'shipeq': G.equipShipPart(d.slot, +d.i); break;
      case 'paint': G.setShipPaint(+d.v); break;
      case 'buy': G.buyFurniture(d.id); break;
      case 'pick': UI.placing = UI.placing === d.id ? null : d.id; UI.refresh(); break;
      case 'cell':
        if (S.home[d.k]) G.removeFurniture(d.k);
        else if (UI.placing) { G.placeFurniture(d.k, UI.placing); if (!S.furniture[UI.placing]) UI.placing = null; UI.refresh(); }
        else UI.toast(t('home.pickFirst'));
        break;
      case 'netbuy': G.buyNet(+d.i); break;
      case 'neteq': G.equipNet(+d.i); break;
      case 'dexclaim': if (!d.id || G.dexClaimable(d.id)) G.dexClaim(d.id || null); break;
    }
  }

  function switchTab(tab) {
    UI.tab = tab;
    UI.placing = null;
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
    $('panel').scrollTop = 0;
    UI.render();
  }

  // 戰鬥畫面折疊（記在設定裡，重開也保持）
  function setCollapsed(on) {
    G.settings.battleCollapsed = !!on;
    G.saveSettings();
    $('battleWrap').classList.toggle('collapsed', !!on);
    $('collapseBtn').textContent = on ? '▼' : '▲';
    $('collapseBtn').title = t(on ? 'battle.expand' : 'battle.collapse');
    hud();
  }

  // 切換語言：固定文字、HUD、目前分頁、開著的設定/序章視窗全部重畫
  function onLang() {
    applyStatic();
    lastBuffSig = '';
    setCollapsed(G.settings.battleCollapsed);
    hud();
    UI.render();
    if (UI.showPrologue) UI.showPrologue();
    else if (UI.modalKind === 'settings') settingsModal();
    else if (UI.modalKind === 'credits') creditsModal();
  }

  UI.init = function () {
    applyStatic();
    document.getElementById('tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]');
      if (b) switchTab(b.dataset.tab);
    });
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
      act(el);
    });
    document.addEventListener('change', e => {
      const el = e.target;
      if (el.matches('input[data-act]')) act(el);
      if (el.matches('select[data-act="pclass"]')) G.partnerClass(el.dataset.id, el.value);
    });
    $('modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('modalCard').querySelector('.prologue')) UI.close(); });

    // 狀態改變時，只重畫有關的分頁
    G.on('toast', UI.toast);
    G.on('lang', onLang);
    G.on('dead', on => { $('revive').hidden = !on; hud(); });
    G.on('log', () => UI.refresh(['adventure']));
    G.on('floorChange', () => UI.refresh(['adventure']));
    G.on('floor', () => UI.refresh(['adventure']));
    G.on('inventory', () => UI.refresh(['hero', 'adventure']));
    G.on('look', () => UI.refresh(['hero', 'adventure']));
    G.on('levelup', () => UI.refresh(['hero', 'skills', 'adventure']));
    G.on('skills', () => UI.refresh(['skills', 'hero', 'adventure']));
    G.on('stats', () => UI.refresh(['hero', 'adventure']));
    G.on('party', () => UI.refresh(['partners', 'hero', 'adventure']));
    G.on('friends', () => UI.refresh(['partners']));
    G.on('account', () => UI.refresh(['partners']));
    // 名稱輸入框：即時字數；按 Enter 送出
    document.addEventListener('input', e => {
      if (e.target.id === 'nameInput') UI.nameCount && UI.nameCount();
      if (e.target.id === 'friendInput') UI.friendDraft = e.target.value;
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'nameInput') submitName();
    });
    G.on('ship', () => UI.refresh(['ship', 'home', 'adventure']));
    G.on('home', () => UI.refresh(['home']));

    setCollapsed(G.settings.battleCollapsed);
    setInterval(hud, 400);
    hud();
    UI.render();
  };
})();
