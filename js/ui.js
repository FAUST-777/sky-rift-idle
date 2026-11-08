// ════════════════════════════════════════════════════════════════════════════
// 介面：HUD、六個分頁、彈窗、提示
// 所有按鈕用 data-act 屬性，由最下面的事件代理統一處理
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const $ = id => document.getElementById(id);
  const UI = G.UI = { tab: 'adventure', placing: null };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── HUD（每 0.4 秒更新）────────────────────────────────────────────────
  function hud() {
    const S = G.S, h = S.hero;
    $('hudLv').textContent = h.level;
    $('hudCls').textContent = G.CLASSES[h.cls].name;
    $('hudXp').style.width = Math.min(100, h.xp / G.xpToLevel(h.level) * 100) + '%';
    $('hudGold').textContent = G.fmt(S.gold);
    $('hudCrystal').textContent = G.fmt(S.crystal);
    $('floorName').textContent = `第 ${S.floor} 層`;
    const boss = S.kills >= G.CONFIG.killsPerFloor;
    $('floorProg').style.width = Math.min(100, S.kills / G.CONFIG.killsPerFloor * 100) + '%';
    $('floorKills').textContent = boss ? '層主戰' : `${S.kills}/${G.CONFIG.killsPerFloor}`;
    $('floorKills').classList.toggle('boss', boss);
    // 有技能點未使用 → 技能分頁亮紅點
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
  const statLine = st => Object.entries(st).filter(([, v]) => v).map(([k, v]) => `${G.STAT_NAME[k]} +${v}`).join('　');
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
        <h3>天空裂洞 <small>最高可到第 ${top} 層（氣囊上限 ${cap}）</small></h3>
        <div class="row between">
          <button class="btn" data-act="floor" data-v="${S.floor - 1}" ${S.floor <= 1 ? 'disabled' : ''}>◀ 下降</button>
          <div style="text-align:center"><div style="font-size:24px;font-weight:700">第 ${S.floor} 層</div>
            <div class="muted" style="font-size:12px">${G.monsterTier(S.floor).map(m => m.n).join('・')}</div></div>
          <button class="btn" data-act="floor" data-v="${S.floor + 1}" ${S.floor >= top ? 'disabled' : ''}>上升 ▶</button>
        </div>
        <div class="row between" style="margin-top:12px">
          <label class="switch"><input type="checkbox" data-act="auto" ${S.autoAdvance ? 'checked' : ''}><i></i>打倒層主後自動往上</label>
          ${S.floor < top ? `<button class="btn small primary" data-act="floor" data-v="${top}">挑戰第 ${top} 層</button>` : ''}
        </div>
      </div>
      <div class="card">
        <h3>戰力 <span class="gold">${G.fmt(G.power(st))}</span></h3>
        <div class="stats">
          <div>生命 <b>${G.fmt(st.maxHp)}</b></div><div>攻擊 <b>${st.atk}</b></div>
          <div>防禦 <b>${st.def}</b></div><div>攻速 <b>${st.spd}</b></div>
          <div>暴擊 <b>${st.crit}%</b></div><div>夥伴 <b>${S.party.length}/${G.CONFIG.maxParty}</b></div>
        </div>
      </div>
      <div class="card">
        <h3>冒險日誌</h3>
        <ul class="log">${S.log.map(l => `<li style="color:${l.color || 'inherit'}">${esc(l.text)}</li>`).join('') || '<li class="muted">還沒有紀錄</li>'}</ul>
      </div>
      <div class="card">
        <h3>設定</h3>
        <label class="switch"><input type="checkbox" data-act="autosell" ${S.autoSellCommon ? 'checked' : ''}><i></i>撿到普通裝備自動賣掉</label>
        <div class="row" style="margin-top:12px"><button class="btn small danger" data-act="reset">重置存檔</button>
          <span class="muted" style="font-size:12px">進度自動存在這個瀏覽器</span></div>
      </div>`;
  }

  // ── 分頁：角色（紙娃娃 + 裝備 + 轉職）──────────────────────────────────
  function renderHero() {
    const S = G.S, st = G.heroStats(), h = S.hero;
    const slots = G.SLOTS.map(slot => {
      const it = S.equipped[slot];
      return it
        ? `<button class="slot" style="border-color:${G.RARITY[it.rarity].color}" data-act="item" data-slot="${slot}">${itemIcon(it)}<small>${G.SLOT_NAME[slot]}</small></button>`
        : `<button class="slot empty">${G.SLOT_ICON[slot]}<small>${G.SLOT_NAME[slot]}</small></button>`;
    }).join('');
    const inv = [...S.inventory].sort((a, b) => b.rarity - a.rarity || G.itemScore(b) - G.itemScore(a)).map(it => {
      const better = G.itemScore(it) > G.itemScore(S.equipped[it.slot]);
      return `<button class="item" style="border-color:${G.RARITY[it.rarity].color}" data-act="item" data-id="${it.uid}">
        ${better ? '<span class="up">▲</span>' : ''}${itemIcon(it)}<small>${esc(it.name)}</small></button>`;
    }).join('');

    let clsHtml;
    if (h.level < G.CONFIG.classUnlockLevel) {
      clsHtml = `<p class="muted" style="margin:0">到 ${G.CONFIG.classUnlockLevel} 級可以轉職（目前 ${h.level} 級）。</p>`;
    } else {
      clsHtml = `<div class="classes">${G.CLASS_ORDER.map(c => {
        const C = G.CLASSES[c];
        return `<button class="cls ${h.cls === c ? 'cur' : ''}" data-act="class" data-cls="${c}">
          <b style="color:${C.color}">${C.name}${h.cls === c ? '（目前）' : ''}</b><p>${C.desc}</p></button>`;
      }).join('')}</div>
      ${h.cls !== 'villager' ? `<p class="muted" style="font-size:12px;margin:8px 0 0">換職業要 ${G.CONFIG.classChangeCost} 金幣，技能點會全部退還。</p>` : ''}`;
    }

    return `
      <div class="card">
        <div class="doll-wrap">
          <canvas class="doll" id="dollSlot"></canvas>
          <div class="grow">
            <div style="font-size:18px;font-weight:700">Lv ${h.level} <span style="color:${G.CLASSES[h.cls].color}">${G.CLASSES[h.cls].name}</span></div>
            <div class="muted" style="font-size:12px;margin-bottom:8px">戰力 <span class="gold">${G.fmt(G.power(st))}</span></div>
            <div class="stats" style="grid-template-columns:1fr">
              <div>生命 <b>${G.fmt(st.maxHp)}</b></div><div>攻擊 <b>${st.atk}</b></div><div>防禦 <b>${st.def}</b></div>
              <div>攻速 <b>${st.spd}</b></div><div>暴擊 <b>${st.crit}%</b></div>
            </div>
          </div>
        </div>
        <div class="slots">${slots}</div>
      </div>
      <div class="card">
        <h3>職業 <small>${G.CLASSES[h.cls].name}</small></h3>
        ${clsHtml}
      </div>
      <div class="card">
        <h3>背包 <small>${S.inventory.length}/${G.CONFIG.inventorySize}</small></h3>
        <div class="row wrap" style="margin-bottom:10px">
          <button class="btn small good" data-act="autoequip">一鍵穿最好的</button>
          <button class="btn small" data-act="sellbelow" data-v="0">賣掉普通</button>
          <button class="btn small" data-act="sellbelow" data-v="1">賣掉優良以下</button>
        </div>
        <div class="inv">${inv || '<p class="muted" style="grid-column:1/-1;margin:0">打怪會掉裝備，掉到的會出現在這裡。</p>'}</div>
      </div>`;
  }

  function itemModal(it, equippedSlot) {
    const cur = equippedSlot ? null : G.S.equipped[it.slot];
    const keys = [...new Set([...Object.keys(it.stats), ...(cur ? Object.keys(cur.stats) : [])])];
    const rows = keys.map(k => {
      const a = it.stats[k] || 0, b = cur ? cur.stats[k] || 0 : 0, d = +(a - b).toFixed(2);
      const diff = cur && d !== 0 ? `<span class="${d > 0 ? 'diff-up' : 'diff-down'}">（${d > 0 ? '+' : ''}${d}）</span>` : '';
      return `<div>${G.STAT_NAME[k]} <b>${a}${diff}</b></div>`;
    }).join('');
    UI.modal(`
      <h2 style="color:${G.RARITY[it.rarity].color}">${itemIcon(it)} ${esc(it.name)}</h2>
      <div class="muted" style="font-size:12px;margin-bottom:10px">${G.RARITY[it.rarity].name}・${G.SLOT_NAME[it.slot]}・第 ${it.floor} 層掉落</div>
      <div class="stats" style="grid-template-columns:1fr">${rows}</div>
      ${cur ? `<p class="muted" style="font-size:12px">括號內是跟目前穿著「${esc(cur.name)}」的差異</p>` : ''}
      <div class="modal-actions">
        <button class="btn" data-act="close">關閉</button>
        ${equippedSlot
          ? `<button class="btn" data-act="unequip" data-slot="${equippedSlot}">卸下</button>`
          : `<button class="btn danger" data-act="sell" data-id="${it.uid}">賣掉 +${G.fmt(G.itemValue(it))}💰</button>
             <button class="btn primary" data-act="equip" data-id="${it.uid}">裝備</button>`}
      </div>`);
  }

  // ── 分頁：技能 ───────────────────────────────────────────────────────────
  function renderSkills() {
    const S = G.S, cls = S.hero.cls, list = G.SKILLS[cls] || [];
    const spent = G.skillPointsInClass();
    const aslots = S.activeSkills.map((id, i) => {
      const sk = id && list.find(s => s.id === id);
      return `<button class="aslot ${sk ? 'filled' : ''}" data-act="aslot" data-i="${i}">${sk ? `<b>${sk.name}</b><br><small class="muted">Lv ${S.skills[id]}</small>` : '<span class="muted">空格<br><small>點我放技能</small></span>'}</button>`;
    }).join('');
    const tiers = [0, 1, 2].map(t => {
      const sks = list.filter(s => s.tier === t);
      if (!sks.length) return '';
      const locked = spent < G.TIER_REQ[t];
      return `<div class="tier-title ${locked ? 'locked' : ''}">第 ${t + 1} 階 ${t ? `・需在此職業投入 ${G.TIER_REQ[t]} 點（目前 ${spent}）` : ''}</div>` +
        sks.map(s => {
          const r = S.skills[s.id];
          const now = r ? s.fmt(s.v(r)) : '尚未學習';
          const next = r < s.max ? `下一級：${s.fmt(s.v(r + 1))}` : '已滿級';
          return `<div class="skill ${locked ? 'locked' : ''}">
            <div class="info">
              <div class="name">${s.name}<span class="tag ${s.type}">${s.type === 'active' ? `主動・${s.cd}秒` : '被動'}</span></div>
              <div class="desc">${now}</div><div class="desc">${next}</div>
              <div class="pips">${Array.from({ length: s.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div>
            </div>
            <button class="btn small primary" data-act="learn" data-id="${s.id}" ${locked || r >= s.max || S.skillPoints <= 0 ? 'disabled' : ''}>＋</button>
          </div>`;
        }).join('');
    }).join('');

    return `
      <div class="card">
        <h3>技能點 <span class="gold">${S.skillPoints}</span></h3>
        <p class="muted" style="margin:0 0 10px;font-size:12px">主動技能放進下面 3 個格子才會自動施放。被動技能學了就生效。換不同組合 = 不同 Build。</p>
        <div class="aslots">${aslots}</div>
      </div>
      <div class="card">
        <h3>${G.CLASSES[cls].name} 技能樹</h3>
        ${cls === 'villager' ? `<p class="muted" style="margin:0 0 8px">村民只會「猛擊」。到 ${G.CONFIG.classUnlockLevel} 級轉職後會開啟完整技能樹。</p>` : ''}
        ${tiers}
      </div>`;
  }

  function slotPicker(i) {
    const S = G.S, list = (G.SKILLS[S.hero.cls] || []).filter(s => s.type === 'active' && S.skills[s.id] > 0);
    UI.modal(`
      <h2>放入第 ${i + 1} 格</h2>
      ${list.map(s => `<button class="btn" style="width:100%;margin-bottom:8px;text-align:left" data-act="setaslot" data-i="${i}" data-id="${s.id}">
        <b>${s.name}</b> Lv ${S.skills[s.id]}　<span class="muted">${s.fmt(s.v(S.skills[s.id]))}</span></button>`).join('') || '<p class="muted">還沒有學會的主動技能</p>'}
      <div class="modal-actions">
        ${S.activeSkills[i] ? `<button class="btn" data-act="setaslot" data-i="${i}" data-id="">清空</button>` : ''}
        <button class="btn" data-act="close">關閉</button>
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
            <b>${open ? p.name : '？？？'}</b>
            <div class="muted" style="font-size:12px;margin:4px 0 8px">${open ? p.bio : `到達第 ${p.floor} 層後會遇到`}</div>
            ${open ? `<button class="btn small primary" data-act="recruit" data-id="${p.id}">招募 ${G.fmt(G.partnerRecruitCost(p))}💰</button>` : ''}
          </div></div>`;
      }
      const st = G.partnerStats(p.id), inParty = S.party.includes(p.id), sk = G.partnerSkill(p.id);
      return `<div class="card partner">
        <canvas data-doll="${p.id}" width="64" height="80"></canvas>
        <div class="grow">
          <div class="row between"><b>${p.name} <span class="muted">Lv ${own.level}</span></b>
            <button class="btn small ${inParty ? 'on' : ''}" data-act="party" data-id="${p.id}">${inParty ? '出戰中' : '休息中'}</button></div>
          <div class="muted" style="font-size:12px;margin:4px 0">生命 ${G.fmt(st.maxHp)}・攻擊 ${st.atk}・防禦 ${st.def}${sk ? `・技能「${sk.def.name}」Lv${sk.rank}` : ''}</div>
          <div class="row wrap" style="margin-top:6px">
            <select data-act="pclass" data-id="${p.id}">
              ${G.CLASS_ORDER.map(c => `<option value="${c}" ${own.cls === c ? 'selected' : ''}>${G.CLASSES[c].name}</option>`).join('')}
            </select>
            <button class="btn small good" data-act="plevel" data-id="${p.id}">升級 ${G.fmt(G.partnerLevelCost(own.level))}💰</button>
          </div>
        </div></div>`;
    }).join('');
    return `<div class="card"><h3>夥伴 <small>出戰 ${S.party.length}/${G.CONFIG.maxParty}</small></h3>
      <p class="muted" style="margin:0;font-size:12px">每往上爬幾層會遇到新夥伴。夥伴可以選職業、花金幣升級，會自動施放職業的第一個技能。職業可以免費更換。</p></div>${cards}`;
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
  function renderShip() {
    const S = G.S, sh = S.ship;
    const parts = Object.entries(G.SHIP_PARTS).map(([k, P]) => {
      const lv = sh[k], maxed = lv >= P.max, c = G.shipUpgradeCost(k, lv);
      return `<div class="part">
        <div class="ico">${P.icon}</div>
        <div class="grow"><b>${P.name}</b> <span class="muted">Lv ${lv}/${P.max}</span>
          <div class="muted" style="font-size:12px">${P.desc(lv)}${maxed ? '' : `　→　<span style="color:var(--good)">${P.desc(lv + 1)}</span>`}</div></div>
        <button class="btn small primary" data-act="ship" data-part="${k}" ${maxed ? 'disabled' : ''}>${maxed ? '滿級' : `${G.fmt(c.gold)}💰<br>${c.crystal}💎`}</button>
      </div>`;
    }).join('');
    return `
      <div class="card"><canvas class="ship-view" id="shipSlot"></canvas>
        <p class="muted" style="font-size:12px;margin:8px 0 0">飛行船決定你能飛多高：<b style="color:var(--text)">氣囊等級</b>決定能進入的最高層。升級零件，外觀也會跟著改變。</p></div>
      <div class="card"><h3>改裝零件 <small>雲晶：打層主必掉</small></h3>${parts}</div>
      <div class="card"><h3>外觀</h3>
        <div class="muted" style="font-size:12px;margin-bottom:6px">塗裝</div>
        <div class="swatches">${G.SHIP_PAINTS.map((c, i) => `<button class="swatch ${sh.paint === i ? 'on' : ''}" style="background:${c}" data-act="paint" data-v="${i}"></button>`).join('')}</div>
        <div class="muted" style="font-size:12px;margin:12px 0 6px">船首像</div>
        <div class="chips">${G.SHIP_FIGUREHEADS.map((n, i) => `<button class="chip ${sh.figurehead === i ? 'on' : ''}" data-act="figure" data-v="${i}">${n}</button>`).join('')}</div>
      </div>`;
  }

  // ── 分頁：家園（飛行船內部）─────────────────────────────────────────────
  function renderHome() {
    const S = G.S, { w, h } = G.homeSize(S.ship.hull), petCap = 4 + S.ship.hull * 2;
    let cells = '';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const key = `${x},${y}`, id = S.home[key], f = id && G.FURNITURE.find(z => z.id === id);
      cells += `<button class="cell ${UI.placing && !id ? 'placing' : ''}" data-act="cell" data-k="${key}" title="${f ? f.n : ''}">${f ? f.icon : ''}</button>`;
    }
    const stock = Object.entries(S.furniture).filter(([, n]) => n > 0).map(([id, n]) => {
      const f = G.FURNITURE.find(z => z.id === id);
      return `<button class="chip ${UI.placing === id ? 'on' : ''}" data-act="pick" data-id="${id}">${f.icon} ${f.n} ×${n}</button>`;
    }).join('');
    const shop = G.FURNITURE.map(f => `<button data-act="buy" data-id="${f.id}"><b>${f.icon}</b>${f.n}${f.collect ? ' <span class="tag passive">收藏</span>' : ''}<br>
      <small class="muted">${f.cur === 'gold' ? G.fmt(f.price) + '💰' : f.price + '💎'}・舒適 +${f.comfort}</small></button>`).join('');

    return `
      <div class="card">
        <h3>飛行船船艙 <small>舒適度 ${G.comfort()}（離線收益 +${G.comfort()}%）</small></h3>
        <div class="home-grid" style="grid-template-columns:repeat(${w},1fr)">${cells}</div>
        <p class="muted" style="font-size:12px;margin:8px 0 0">${UI.placing ? '👉 點空格擺放，點已擺的家具收回倉庫' : '先在下面「倉庫」選一件家具，再點空格擺放。點已擺放的家具可收回。'}升級「船身」可以擴大空間。</p>
      </div>
      <div class="card"><h3>倉庫</h3><div class="chips">${stock || '<span class="muted">空的，去下面商店買家具吧</span>'}</div></div>
      <div class="card"><h3>家具商店</h3><div class="shop">${shop}</div></div>
      <div class="card">
        <h3>捕獲的怪物 <small>${S.pets.length}/${petCap}・每隻金幣 +1%</small></h3>
        <div class="row" style="margin-bottom:10px">
          <span class="grow">🕸️ 捕獸網 <b>${S.nets}</b> 張<br><small class="muted">有網時打倒小怪有 ${G.CONFIG.captureChance * 100}% 機率捕獲</small></span>
          <button class="btn small" data-act="nets" data-v="1">買 1 張 ${G.CONFIG.netPrice}💰</button>
          <button class="btn small" data-act="nets" data-v="10">買 10 張</button>
        </div>
        <div class="pets">${S.pets.map((p, i) => `<canvas data-pet="${i}" title="${esc(p.name)}"></canvas>`).join('') || '<span class="muted">還沒有捕獲任何怪物</span>'}</div>
      </div>`;
  }

  function mountPets() {
    $('panel').querySelectorAll('canvas[data-pet]').forEach(c => {
      const p = G.S.pets[+c.dataset.pet];
      c.width = 96; c.height = 96;
      G.ART.drawMonster(c.getContext('2d'), p.shape, p.color, 0, 0, 1.5);
    });
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
  UI.close = function () { $('modal').hidden = true; };
  let toastT;
  UI.toast = function (text) {
    const t = $('toast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  };

  UI.prologue = function (onDone) {
    let i = 0;
    const show = () => UI.modal(`<div class="prologue"><h2>序章</h2><p>${G.PROLOGUE[i]}</p>
      <div class="modal-actions"><span class="muted grow" style="align-self:center">${i + 1}/${G.PROLOGUE.length}</span>
      <button class="btn primary" data-act="prologue">${i < G.PROLOGUE.length - 1 ? '繼續' : '出發！'}</button></div></div>`);
    UI.nextPrologue = () => { i++; if (i < G.PROLOGUE.length) show(); else { UI.close(); onDone(); } };
    show();
  };

  // ── 事件代理：所有按鈕 ───────────────────────────────────────────────────
  function act(el) {
    const a = el.dataset.act, d = el.dataset, S = G.S;
    switch (a) {
      case 'close': UI.close(); break;
      case 'prologue': UI.nextPrologue(); break;
      case 'floor': S.autoAdvance = +d.v > S.floor ? true : S.autoAdvance; G.setFloor(+d.v); UI.refresh(); break;
      case 'auto': S.autoAdvance = el.checked; break;
      case 'autosell': S.autoSellCommon = el.checked; break;
      case 'reset': UI.modal(`<h2>重置存檔？</h2><p>所有進度都會消失，無法復原。</p>
        <div class="modal-actions"><button class="btn" data-act="close">取消</button><button class="btn danger" data-act="reset2">確定重置</button></div>`); break;
      case 'reset2': G.resetSave(); break;
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
        const C = G.CLASSES[d.cls];
        if (S.hero.cls === d.cls) break;
        UI.modal(`<h2>轉職為「${C.name}」？</h2><p>${C.desc}</p>
          <p class="muted">${S.hero.cls === 'villager' ? '第一次轉職免費。' : `需要 ${G.CONFIG.classChangeCost} 金幣。`}技能點會全部退還，可以重新分配。</p>
          <div class="modal-actions"><button class="btn" data-act="close">取消</button><button class="btn primary" data-act="class2" data-cls="${d.cls}">轉職</button></div>`);
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
        else UI.toast('先在「倉庫」選一件家具');
        break;
      case 'nets': G.buyNets(+d.v); break;
    }
  }

  UI.init = function () {
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
      if (!el || el.tagName === 'SELECT' || (el.tagName === 'INPUT')) return;
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
