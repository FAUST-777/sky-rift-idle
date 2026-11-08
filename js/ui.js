// ════════════════════════════════════════════════════════════════════════════
// 介面：HUD、六個分頁、設定、彈窗、提示
// 所有按鈕用 data-act 屬性，由最下面的事件代理統一處理
// 所有文字用 t()；切換語言時整個介面重畫
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const $ = id => document.getElementById(id);
  const t = (k, p) => G.t(k, p);
  const UI = G.UI = { tab: 'adventure', placing: null };
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
    $('floorName').textContent = t('floor.name', { n: S.floor });
    const boss = S.kills >= G.CONFIG.killsPerFloor;
    $('floorProg').style.width = Math.min(100, S.kills / G.CONFIG.killsPerFloor * 100) + '%';
    $('floorKills').textContent = boss ? t('floor.boss') : `${S.kills}/${G.CONFIG.killsPerFloor}`;
    $('floorKills').classList.toggle('boss', boss);
    // 戰敗復活倒數
    const sc = G.battleScene();
    if (sc && sc.reviveAt) {
      const left = Math.max(0, Math.ceil((sc.reviveAt - Date.now()) / 1000));
      $('reviveTitle').textContent = t('revive.title');
      $('reviveText').innerHTML = t('revive.wait', { s: left, n: Math.max(1, S.floor - 1) });
      const cost = G.CONFIG.reviveCost;
      $('revivePay').textContent = t('revive.pay', { cost, have: G.fmt(S.crystal) });
      $('revivePay').disabled = S.crystal < cost;
    }
    // 有技能點未使用 → 技能分頁亮紅點；可以轉職 → 角色分頁亮紅點
    setDot('skills', S.skillPoints > 0);
    setDot('hero', h.cls === 'villager' && h.level >= G.CONFIG.classUnlockLevel);
  }
  function setDot(tab, on) {
    const b = document.querySelector(`#tabs [data-tab="${tab}"]`);
    let d = b.querySelector('.dot');
    if (on && !d) { d = document.createElement('i'); d.className = 'dot'; b.appendChild(d); }
    if (!on && d) d.remove();
  }

  // ── 共用小元件 ───────────────────────────────────────────────────────────
  const itemIcon = it => it.slot === 'weapon' ? { sword: '🗡️', axe: '🪓', staff: '🔮', mace: '🔨' }[it.look] : G.SLOT_ICON[it.slot];

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
    const cap = G.shipMaxFloor(S.ship.balloon);
    const top = Math.min(S.maxFloor, cap);
    return `
      <div class="card">
        <h3>${t('adv.title')} <small>${t('adv.reach', { top, cap })}</small></h3>
        <div class="row between">
          <button class="btn" data-act="floor" data-v="${S.floor - 1}" ${S.floor <= 1 ? 'disabled' : ''}>${t('adv.down')}</button>
          <div style="text-align:center"><div style="font-size:24px;font-weight:700">${t('floor.name', { n: S.floor })}</div>
            <div class="muted" style="font-size:12px">${G.monsterTier(S.floor).map(m => G.monsterName(m.id)).join('・')}</div></div>
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
      <div class="card">
        <h3>${t('adv.log')}</h3>
        <ul class="log">${S.log.map(l => `<li style="color:${l.color || 'inherit'}">${esc(G.logText(l))}</li>`).join('') || `<li class="muted">${t('adv.logEmpty')}</li>`}</ul>
      </div>`;
  }

  // ── 分頁：角色（紙娃娃 + 裝備 + 轉職）──────────────────────────────────
  function renderHero() {
    const S = G.S, st = G.heroStats(), h = S.hero;
    const slots = G.SLOTS.map(slot => {
      const it = S.equipped[slot];
      return it
        ? `<button class="slot" style="border-color:${G.RARITY[it.rarity].color}" data-act="item" data-slot="${slot}">${itemIcon(it)}<small>${G.slotName(slot)}</small></button>`
        : `<button class="slot empty">${G.SLOT_ICON[slot]}<small>${G.slotName(slot)}</small></button>`;
    }).join('');
    const inv = [...S.inventory].sort((a, b) => b.rarity - a.rarity || G.itemScore(b) - G.itemScore(a)).map(it => {
      const better = G.itemScore(it) > G.itemScore(S.equipped[it.slot]);
      return `<button class="item" style="border-color:${G.RARITY[it.rarity].color}" data-act="item" data-id="${it.uid}">
        ${better ? '<span class="up">▲</span>' : ''}${itemIcon(it)}<small>${esc(G.itemName(it))}</small></button>`;
    }).join('');

    let clsHtml;
    if (h.level < G.CONFIG.classUnlockLevel) {
      clsHtml = `<p class="muted" style="margin:0">${t('hero.classLocked', { lv: G.CONFIG.classUnlockLevel, cur: h.level })}</p>`;
    } else {
      clsHtml = `<div class="classes">${G.CLASS_ORDER.map(c => `<button class="cls ${h.cls === c ? 'cur' : ''}" data-act="class" data-cls="${c}">
          <b style="color:${G.CLASSES[c].color}">${G.clsName(c)}${h.cls === c ? t('hero.current') : ''}</b><p>${t(`class.${c}.desc`)}</p></button>`).join('')}</div>
      ${h.cls !== 'villager' ? `<p class="muted" style="font-size:12px;margin:8px 0 0">${t('hero.classChangeNote', { cost: G.CONFIG.classChangeCost })}</p>` : ''}`;
    }

    return `
      <div class="card">
        <div class="doll-wrap">
          <canvas class="doll" id="dollSlot"></canvas>
          <div class="grow">
            <div style="font-size:18px;font-weight:700">Lv ${h.level} <span style="color:${G.CLASSES[h.cls].color}">${G.clsName(h.cls)}</span></div>
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
        <h3>${t('hero.class')} <small>${G.clsName(h.cls)}</small></h3>
        ${clsHtml}
      </div>
      <div class="card">
        <h3>${t('hero.bag')} <small>${S.inventory.length}/${G.CONFIG.inventorySize}</small></h3>
        <div class="row wrap" style="margin-bottom:10px">
          <button class="btn small good" data-act="autoequip">${t('hero.autoEquip')}</button>
          <button class="btn small" data-act="sellbelow" data-v="0">${t('hero.sellCommon')}</button>
          <button class="btn small" data-act="sellbelow" data-v="1">${t('hero.sellUncommon')}</button>
        </div>
        <div class="inv">${inv || `<p class="muted" style="grid-column:1/-1;margin:0">${t('hero.bagEmpty')}</p>`}</div>
      </div>`;
  }

  function itemModal(it, equippedSlot) {
    const cur = equippedSlot ? null : G.S.equipped[it.slot];
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
             <button class="btn primary" data-act="equip" data-id="${it.uid}">${t('item.equip')}</button>`}
      </div>`);
  }

  // ── 分頁：技能 ───────────────────────────────────────────────────────────
  function renderSkills() {
    const S = G.S, cls = S.hero.cls, list = G.SKILLS[cls] || [];
    const spent = G.skillPointsInClass();
    const aslots = S.activeSkills.map((id, i) => {
      const sk = id && list.find(s => s.id === id);
      return `<button class="aslot ${sk ? 'filled' : ''}" data-act="aslot" data-i="${i}">${sk
        ? `<b>${G.skillName(id)}</b><br><small class="muted">Lv ${S.skills[id]}</small>`
        : `<span class="muted">${t('skills.empty')}<br><small>${t('skills.emptyHint')}</small></span>`}</button>`;
    }).join('');
    const tiers = [0, 1, 2].map(tier => {
      const sks = list.filter(s => s.tier === tier);
      if (!sks.length) return '';
      const locked = spent < G.TIER_REQ[tier];
      return `<div class="tier-title ${locked ? 'locked' : ''}">${t('skills.tier', { n: tier + 1 })}${tier ? t('skills.tierReq', { req: G.TIER_REQ[tier], cur: spent }) : ''}</div>` +
        sks.map(s => {
          const r = S.skills[s.id];
          const now = r ? G.skillDesc(s, r) : t('skills.notLearned');
          const next = r < s.max ? t('skills.next', { desc: G.skillDesc(s, r + 1) }) : t('skills.maxed');
          return `<div class="skill ${locked ? 'locked' : ''}">
            <div class="info">
              <div class="name">${G.skillName(s.id)}<span class="tag ${s.type}">${s.type === 'active' ? t('skills.active', { cd: s.cd }) : t('skills.passive')}</span></div>
              <div class="desc">${now}</div><div class="desc">${next}</div>
              <div class="pips">${Array.from({ length: s.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div>
            </div>
            <button class="btn small primary" data-act="learn" data-id="${s.id}" ${locked || r >= s.max || S.skillPoints <= 0 ? 'disabled' : ''}>＋</button>
          </div>`;
        }).join('');
    }).join('');

    return `
      <div class="card">
        <h3>${t('skills.points')} <span class="gold">${S.skillPoints}</span></h3>
        <p class="muted" style="margin:0 0 10px;font-size:12px">${t('skills.help')}</p>
        <div class="aslots">${aslots}</div>
      </div>
      <div class="card">
        <h3>${t('skills.tree', { cls: G.clsName(cls) })}</h3>
        ${cls === 'villager' ? `<p class="muted" style="margin:0 0 8px">${t('skills.villager', { lv: G.CONFIG.classUnlockLevel })}</p>` : ''}
        ${tiers}
      </div>`;
  }

  function slotPicker(i) {
    const S = G.S, list = (G.SKILLS[S.hero.cls] || []).filter(s => s.type === 'active' && S.skills[s.id] > 0);
    UI.modal(`
      <h2>${t('skills.pickTitle', { n: i + 1 })}</h2>
      ${list.map(s => `<button class="btn" style="width:100%;margin-bottom:8px;text-align:left;white-space:normal" data-act="setaslot" data-i="${i}" data-id="${s.id}">
        <b>${G.skillName(s.id)}</b> Lv ${S.skills[s.id]}　<span class="muted">${G.skillDesc(s, S.skills[s.id])}</span></button>`).join('') || `<p class="muted">${t('skills.noActive')}</p>`}
      <div class="modal-actions">
        ${S.activeSkills[i] ? `<button class="btn" data-act="setaslot" data-i="${i}" data-id="">${t('skills.clear')}</button>` : ''}
        <button class="btn" data-act="close">${t('common.close')}</button>
      </div>`);
  }

  // ── 分頁：夥伴 ───────────────────────────────────────────────────────────
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
            <div class="muted" style="font-size:12px;margin:4px 0 8px">${open ? t(`partner.${p.id}.bio`) : t('partners.meetAt', { n: p.floor })}</div>
            ${open ? `<button class="btn small primary" data-act="recruit" data-id="${p.id}">${t('partners.recruit', { cost: G.fmt(G.partnerRecruitCost(p)) })}</button>` : ''}
          </div></div>`;
      }
      const st = G.partnerStats(p.id), inParty = S.party.includes(p.id), sk = G.partnerSkill(p.id);
      return `<div class="card partner">
        <canvas data-doll="${p.id}" width="64" height="80"></canvas>
        <div class="grow">
          <div class="row between"><b>${G.partnerName(p.id)} <span class="muted">Lv ${own.level}</span></b>
            <button class="btn small ${inParty ? 'on' : ''}" data-act="party" data-id="${p.id}">${inParty ? t('partners.inParty') : t('partners.resting')}</button></div>
          <div class="muted" style="font-size:12px;margin:4px 0">${t('partners.stats', { hp: G.fmt(st.maxHp), atk: st.atk, def: st.def })}${sk ? t('partners.skill', { name: G.skillName(sk.def.id), lv: sk.rank }) : ''}</div>
          <div class="row wrap" style="margin-top:6px">
            <select data-act="pclass" data-id="${p.id}">
              ${G.CLASS_ORDER.map(c => `<option value="${c}" ${own.cls === c ? 'selected' : ''}>${G.clsName(c)}</option>`).join('')}
            </select>
            <button class="btn small good" data-act="plevel" data-id="${p.id}">${t('partners.levelUp', { cost: G.fmt(G.partnerLevelCost(own.level)) })}</button>
          </div>
        </div></div>`;
    }).join('');
    return `<div class="card"><h3>${t('partners.title')} <small>${t('partners.deployed', { n: S.party.length, max: G.CONFIG.maxParty })}</small></h3>
      <p class="muted" style="margin:0;font-size:12px">${t('partners.help')}</p></div>${cards}`;
  }

  function mountPartnerDolls() {
    $('panel').querySelectorAll('canvas[data-doll]').forEach(c => {
      const id = c.dataset.doll, own = G.S.partners[id], def = G.PARTNERS.find(p => p.id === id);
      const look = own ? G.ART.lookFromPartner(id) : { skin: def.skin, hair: def.hair, cls: 'villager' };
      c.width = 128; c.height = 160;
      const ctx = c.getContext('2d');
      if (!own && G.S.maxFloor < def.floor) ctx.filter = 'brightness(0)';
      G.ART.drawHumanoid(ctx, look, 0, 0, 2);
    });
  }

  // ── 分頁：飛行船 ─────────────────────────────────────────────────────────
  function partDesc(k, lv) {
    if (k === 'balloon') return t('part.balloon.desc', { n: G.shipMaxFloor(lv) });
    if (k === 'engine') return t('part.engine.desc', { n: (lv - 1) * 10 });
    if (k === 'hull') { const s = G.homeSize(lv); return t('part.hull.desc', { w: s.w, h: s.h }); }
    return lv === 0 ? t('part.cannon.none') : t('part.cannon.desc', { n: lv * 30 });
  }

  function renderShip() {
    const S = G.S, sh = S.ship;
    const parts = Object.entries(G.SHIP_PARTS).map(([k, P]) => {
      const lv = sh[k], maxed = lv >= P.max, c = G.shipUpgradeCost(k, lv);
      return `<div class="part">
        <div class="ico">${P.icon}</div>
        <div class="grow"><b>${t(`part.${k}.name`)}</b> <span class="muted">Lv ${lv}/${P.max}</span>
          <div class="muted" style="font-size:12px">${partDesc(k, lv)}${maxed ? '' : `　→　<span style="color:var(--good)">${partDesc(k, lv + 1)}</span>`}</div></div>
        <button class="btn small primary" data-act="ship" data-part="${k}" ${maxed ? 'disabled' : ''}>${maxed ? t('ship.maxed') : `${G.fmt(c.gold)}💰<br>${c.crystal}💎`}</button>
      </div>`;
    }).join('');
    const figures = Array.from({ length: G.SHIP_FIGUREHEADS }, (_, i) =>
      `<button class="chip ${sh.figurehead === i ? 'on' : ''}" data-act="figure" data-v="${i}">${t(`figurehead.${i}`)}</button>`).join('');
    return `
      <div class="card"><canvas class="ship-view" id="shipSlot"></canvas>
        <p class="muted" style="font-size:12px;margin:8px 0 0">${t('ship.help')}</p></div>
      <div class="card"><h3>${t('ship.parts')} <small>${t('ship.partsHint')}</small></h3>${parts}</div>
      <div class="card"><h3>${t('ship.look')}</h3>
        <div class="muted" style="font-size:12px;margin-bottom:6px">${t('ship.paint')}</div>
        <div class="swatches">${G.SHIP_PAINTS.map((c, i) => `<button class="swatch ${sh.paint === i ? 'on' : ''}" style="background:${c}" data-act="paint" data-v="${i}"></button>`).join('')}</div>
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${t('ship.figurehead')}</div>
        <div class="chips">${figures}</div>
      </div>`;
  }

  // ── 分頁：家園（飛行船內部）─────────────────────────────────────────────
  function renderHome() {
    const S = G.S, { w, h } = G.homeSize(S.ship.hull), petCap = 4 + S.ship.hull * 2;
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
      <div class="card">
        <h3>${t('home.pets')} <small>${t('home.petsInfo', { n: S.pets.length, cap: petCap })}</small></h3>
        <div class="row" style="margin-bottom:10px">
          <span class="grow">${t('home.nets', { n: S.nets })}<br><small class="muted">${t('home.netsHint', { p: G.CONFIG.captureChance * 100 })}</small></span>
          <button class="btn small" data-act="nets" data-v="1">${t('home.buy1', { price: G.CONFIG.netPrice })}</button>
          <button class="btn small" data-act="nets" data-v="10">${t('home.buy10')}</button>
        </div>
        <div class="pets">${S.pets.map((p, i) => `<canvas data-pet="${i}" title="${esc(G.petName(p))}"></canvas>`).join('') || `<span class="muted">${t('home.noPets')}</span>`}</div>
      </div>`;
  }

  function mountPets() {
    $('panel').querySelectorAll('canvas[data-pet]').forEach(c => {
      const p = G.S.pets[+c.dataset.pet];
      c.width = 96; c.height = 96;
      G.ART.drawMonster(c.getContext('2d'), p.shape, p.color, 0, 0, 1.5);
    });
  }

  // ── 設定（右上角 ⚙️）：之後新增的設定都放這裡 ────────────────────────────
  function settingsModal() {
    const S = G.S;
    UI.modal(`
      <h2>⚙️ ${t('settings.title')}</h2>
      <div class="set-group">
        <div class="set-label">🌐 ${t('settings.language')}</div>
        <div class="chips">${G.LANGS.map(l => `<button class="chip ${G.settings.lang === l.id ? 'on' : ''}" data-act="lang" data-v="${l.id}">${l.name}</button>`).join('')}</div>
      </div>
      <div class="set-group">
        <div class="set-label">🎮 ${t('settings.game')}</div>
        <label class="switch"><input type="checkbox" data-act="autosell" ${S.autoSellCommon ? 'checked' : ''}><i></i>${t('settings.autosell')}</label>
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
    if (UI.tab === 'hero') mount('#dollSlot', dollCanvas(G.ART.lookFromHero(), 128, 160, 1.8));
    if (UI.tab === 'partners') mountPartnerDolls();
    if (UI.tab === 'home') mountPets();
    if (UI.tab === 'ship') {
      const c = G.ART.canvas(640, 480);
      G.ART.drawShip(c.getContext('2d'), G.S.ship, 640, 480);
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
      case 'lang': G.setLang(d.v); break;
      case 'floor': S.autoAdvance = +d.v > S.floor ? true : S.autoAdvance; G.setFloor(+d.v); UI.refresh(); break;
      case 'auto': S.autoAdvance = el.checked; break;
      case 'autosell': S.autoSellCommon = el.checked; break;
      case 'reset': UI.modalKind = 'reset'; UI.modal(`<h2>${t('reset.title')}</h2><p>${t('reset.body')}</p>
        <div class="modal-actions"><button class="btn" data-act="settings">${t('common.cancel')}</button><button class="btn danger" data-act="reset2">${t('reset.confirm')}</button></div>`); break;
      case 'reset2': G.resetSave(); break;
      case 'credits': UI.modalKind = 'credits'; creditsModal(); break;
      case 'revivePay': G.battleScene().revivePaid(); break;
      case 'item':
        if (d.slot) itemModal(S.equipped[d.slot], d.slot);
        else itemModal(S.inventory.find(i => i.uid === +d.id));
        break;
      case 'equip': G.equip(+d.id); UI.close(); break;
      case 'unequip': G.unequip(d.slot); UI.close(); break;
      case 'sell': G.sell(+d.id); UI.close(); break;
      case 'autoequip': G.autoEquip(); break;
      case 'sellbelow': G.sellAllBelow(+d.v); break;
      case 'class': {
        if (S.hero.cls === d.cls) break;
        UI.modal(`<h2>${t('classModal.title', { name: G.clsName(d.cls) })}</h2><p>${t(`class.${d.cls}.desc`)}</p>
          <p class="muted">${S.hero.cls === 'villager' ? t('classModal.free') : t('classModal.cost', { cost: G.CONFIG.classChangeCost })}${t('classModal.refund')}</p>
          <div class="modal-actions"><button class="btn" data-act="close">${t('common.cancel')}</button><button class="btn primary" data-act="class2" data-cls="${d.cls}">${t('classModal.confirm')}</button></div>`);
        break;
      }
      case 'class2': G.changeClass(d.cls); UI.close(); UI.refresh(); break;
      case 'learn': G.learnSkill(d.id); break;
      case 'aslot': slotPicker(+d.i); break;
      case 'setaslot': G.setActiveSkill(+d.i, d.id || null); UI.close(); break;
      case 'recruit': G.recruit(d.id); break;
      case 'party': G.toggleParty(d.id); break;
      case 'plevel': G.partnerLevelUp(d.id); break;
      case 'ship': G.upgradeShip(d.part); break;
      case 'paint': G.setShipLook('paint', +d.v); break;
      case 'figure': G.setShipLook('figurehead', +d.v); break;
      case 'buy': G.buyFurniture(d.id); break;
      case 'pick': UI.placing = UI.placing === d.id ? null : d.id; UI.refresh(); break;
      case 'cell':
        if (S.home[d.k]) G.removeFurniture(d.k);
        else if (UI.placing) { G.placeFurniture(d.k, UI.placing); if (!S.furniture[UI.placing]) UI.placing = null; UI.refresh(); }
        else UI.toast(t('home.pickFirst'));
        break;
      case 'nets': G.buyNets(+d.v); break;
    }
  }

  // 切換語言：固定文字、HUD、目前分頁、開著的設定/序章視窗全部重畫
  function onLang() {
    applyStatic();
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
      if (!b) return;
      UI.tab = b.dataset.tab;
      UI.placing = null;
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      $('panel').scrollTop = 0;
      UI.render();
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
    G.on('party', () => UI.refresh(['partners', 'adventure']));
    G.on('ship', () => UI.refresh(['ship', 'home', 'adventure']));
    G.on('home', () => UI.refresh(['home']));

    setInterval(hud, 400);
    hud();
    UI.render();
  };
})();
