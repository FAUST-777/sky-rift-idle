// ════════════════════════════════════════════════════════════════════════════
// 遊戲狀態、存檔、屬性計算、所有玩家操作
// 顯示給玩家的文字一律用 G.t()；日誌存「key + 參數」，切換語言時舊日誌也會跟著換
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const SAVE_KEY = 'skyrift_save_v1';
  const t = (k, p) => G.t(k, p);
  const toast = (k, p) => G.emit('toast', t(k, p));

  // ── 簡單事件匯流排（UI 與戰鬥場景互相通知）─────────────────────────────────
  const listeners = {};
  G.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  G.emit = (ev, data) => { (listeners[ev] || []).forEach(fn => fn(data)); };

  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randInt = (a, b) => Math.floor(G.rand(a, b + 1));
  G.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  G.fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(Math.floor(n));

  function newState() {
    const skills = {};
    Object.keys(G.SKILLS).forEach(c => G.SKILLS[c].forEach(s => skills[s.id] = 0));
    skills.smash = 1;
    return {
      v: 1,
      seenPrologue: false,
      gold: 0, crystal: 0, nets: 0,
      hero: { level: 1, xp: 0, cls: 'villager', hair: '#5a3a22', skin: '#f1c9a0' },
      skills,
      skillPoints: 0,
      activeSkills: ['smash', null, null],
      equipped: { weapon: null, helmet: null, armor: null, boots: null, accessory: null },
      inventory: [],
      floor: 1, maxFloor: 1, kills: 0, autoAdvance: true,
      partners: {},          // id -> { level, cls }
      party: [],             // 出戰中的夥伴 id
      ship: { balloon: 1, engine: 1, hull: 1, cannon: 0, paint: 0, figurehead: 0 },
      furniture: {},         // id -> 持有數量（未擺放）
      home: {},              // "x,y" -> furniture id
      pets: [],              // { id(怪物), shape, color }
      autoSellCommon: false,
      log: [],               // { k, p, color }
      uid: 1,
      lastSeen: Date.now(),
    };
  }

  G.load = function () {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}
    const base = newState();
    if (s && s.v === 1) {
      // 補上新版本新增的欄位，舊存檔也能讀
      G.S = Object.assign(base, s);
      G.S.ship = Object.assign(newState().ship, s.ship);
      G.S.skills = Object.assign(newState().skills, s.skills);
      migrateToI18n(G.S);
    } else {
      G.S = base;
    }
  };

  // 多語系之前的存檔：裝備/寵物存的是中文名稱、日誌是純文字 → 轉成 id，切換語言才會跟著換
  function migrateToI18n(S) {
    const zh = G.I18N['zh-TW'];
    const fixItem = it => {
      if (!it || it.base !== undefined || !it.name) return;
      const baseName = it.name.split('・').pop();
      const idx = G.ITEM_BASES[it.slot].findIndex((_, i) => zh[`base.${it.slot}.${i}`] === baseName);
      if (idx >= 0) { it.base = idx; delete it.name; }
    };
    S.inventory.forEach(fixItem);
    Object.values(S.equipped).forEach(fixItem);
    S.pets.forEach(p => {
      if (p.id || !p.name) return;
      const m = G.MONSTER_TIERS.flat().find(x => zh[`monster.${x.id}`] === p.name);
      if (m) { p.id = m.id; delete p.name; }
    });
    S.log = S.log.filter(l => l.k);   // 舊的純文字日誌無法翻譯，直接清掉
  }

  G.save = function () {
    G.S.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.S)); } catch {}
  };

  G.resetSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    location.reload();
  };

  // 日誌：存 key + 參數，畫面上才翻譯
  G.addLog = function (k, p, color) {
    G.S.log.unshift({ k, p: p || null, color: color || '' });
    if (G.S.log.length > 30) G.S.log.length = 30;
    G.emit('log');
  };
  G.logText = l => l.k ? t(l.k, l.p) : (l.text || '');   // 舊存檔的日誌是純文字

  // ── 屬性計算 ─────────────────────────────────────────────────────────────
  function passiveSum(kind) {
    const list = G.SKILLS[G.S.hero.cls] || [];
    let sum = 0;
    list.forEach(sk => { if (sk.type === 'passive' && sk.kind === kind && G.S.skills[sk.id] > 0) sum += sk.v(G.S.skills[sk.id]); });
    return sum;
  }
  G.passive = passiveSum;

  G.heroStats = function () {
    const h = G.S.hero, cls = G.CLASSES[h.cls], B = G.HERO_BASE, L = G.LEVEL_GAIN;
    const st = {
      maxHp: (B.hp + L.hp * (h.level - 1)) * cls.mult.hp,
      atk:   (B.atk + L.atk * (h.level - 1)) * cls.mult.atk,
      def:   (B.def + L.def * (h.level - 1)) * cls.mult.def,
      spd: B.spd, crit: B.crit, critDmg: B.critDmg,
    };
    G.SLOTS.forEach(slot => {
      const it = G.S.equipped[slot];
      if (!it) return;
      st.maxHp += it.stats.hp || 0;
      st.atk   += it.stats.atk || 0;
      st.def   += it.stats.def || 0;
      st.crit  += it.stats.crit || 0;
      st.spd   += it.stats.spd || 0;
    });
    st.atk   *= 1 + passiveSum('atkPct');
    st.def   *= 1 + passiveSum('defPct');
    st.maxHp *= 1 + passiveSum('hpPct');
    st.crit  += passiveSum('critUp');
    st.lifesteal   = passiveSum('lifesteal');
    st.healPower   = 1 + passiveSum('healPower');
    st.summonPower = 1 + passiveSum('summonPower');
    st.maxHp = Math.round(st.maxHp);
    st.atk = +st.atk.toFixed(1);
    st.def = +st.def.toFixed(1);
    st.spd = +Math.min(3, st.spd).toFixed(2);
    st.crit = +Math.min(75, st.crit).toFixed(1);
    st.ranged = G.CLASSES[h.cls].ranged;
    return st;
  };

  G.partnerStats = function (id) {
    const p = G.S.partners[id], cls = G.CLASSES[p.cls];
    // 夥伴成長比主角略低，靠升級追上
    return {
      maxHp: Math.round((80 + 14 * (p.level - 1)) * cls.mult.hp),
      atk:   +((8 + 2.4 * (p.level - 1)) * cls.mult.atk).toFixed(1),
      def:   +((2 + 0.9 * (p.level - 1)) * cls.mult.def).toFixed(1),
      spd: 0.9, crit: 5, critDmg: 1.5,
      lifesteal: 0, healPower: 1, summonPower: 1,
      ranged: cls.ranged,
    };
  };
  // 夥伴使用該職業的第一個主動技能（等級跟著夥伴等級成長）
  G.partnerSkill = function (id) {
    const p = G.S.partners[id];
    if (p.cls === 'villager') return null;
    const sk = G.SKILLS[p.cls].find(s => s.type === 'active');
    return { def: sk, rank: Math.min(sk.max, 1 + Math.floor(p.level / 5)) };
  };

  G.power = st => Math.round(st.atk * st.spd * (1 + st.crit / 100 * (st.critDmg - 1)) * 4 + st.maxHp * 0.3 + st.def * 3);

  // ── 等級與經驗 ───────────────────────────────────────────────────────────
  G.gainXp = function (xp) {
    const h = G.S.hero;
    h.xp += xp;
    let up = false;
    while (h.xp >= G.xpToLevel(h.level)) {
      h.xp -= G.xpToLevel(h.level);
      h.level++;
      G.S.skillPoints++;
      up = true;
      G.addLog('log.levelUp', { lv: h.level }, '#ffd76a');
      if (h.level === G.CONFIG.classUnlockLevel && h.cls === 'villager') {
        G.addLog('log.canClass', null, '#ffd76a');
        toast('toast.canClass');
      }
    }
    if (up) G.emit('levelup');
  };

  G.goldMult = () => 1 + (G.S.ship.engine - 1) * 0.1 + G.S.pets.length * 0.01;

  // ── 裝備產生 ─────────────────────────────────────────────────────────────
  G.rollRarity = function (boss) {
    const w = G.RARITY.map((r, i) => r.weight * (boss && i >= 2 ? 6 : 1));
    if (boss) w[0] = 0;
    const total = w.reduce((a, b) => a + b, 0);
    let x = Math.random() * total;
    for (let i = 0; i < w.length; i++) { if ((x -= w[i]) < 0) return i; }
    return 0;
  };

  G.makeItem = function (floor, boss) {
    const slot = G.pick(G.SLOTS);
    const bases = G.ITEM_BASES[slot];
    const baseIdx = G.randInt(0, bases.length - 1);
    const rarity = G.rollRarity(boss);
    const R = G.RARITY[rarity];
    const scale = (1 + (floor - 1) * 0.22) * R.mult;
    const stats = {};
    Object.entries(G.SLOT_MAIN[slot]).forEach(([k, v]) => stats[k] = v * scale);
    for (let i = 0; i < R.affix; i++) {
      const [k, v] = Object.entries(G.pick(G.AFFIXES))[0];
      stats[k] = (stats[k] || 0) + v * scale * G.rand(0.4, 0.7);
    }
    Object.keys(stats).forEach(k => stats[k] = k === 'spd' ? +stats[k].toFixed(2) : +stats[k].toFixed(1));
    // 名稱不存文字，存底材編號，顯示時依語言組出來
    return { uid: G.S.uid++, slot, base: baseIdx, rarity, floor, look: bases[baseIdx].look, stats };
  };

  G.itemScore = it => it ? (it.stats.atk || 0) * 4 + (it.stats.hp || 0) * 0.3 + (it.stats.def || 0) * 3 + (it.stats.crit || 0) * 2 + (it.stats.spd || 0) * 60 : 0;
  G.itemValue = it => Math.round(5 * it.floor * Math.pow(it.rarity + 1, 2));

  G.addItem = function (it) {
    if (G.S.autoSellCommon && it.rarity === 0) {
      G.S.gold += G.itemValue(it);
      return 'sold';
    }
    if (G.S.inventory.length >= G.CONFIG.inventorySize) {
      G.S.gold += G.itemValue(it);
      return 'full';
    }
    G.S.inventory.push(it);
    G.emit('inventory');
    return 'ok';
  };

  // ── 玩家操作 ─────────────────────────────────────────────────────────────
  G.equip = function (uid) {
    const idx = G.S.inventory.findIndex(i => i.uid === uid);
    if (idx < 0) return;
    const it = G.S.inventory[idx];
    const old = G.S.equipped[it.slot];
    G.S.inventory.splice(idx, 1);
    if (old) G.S.inventory.push(old);
    G.S.equipped[it.slot] = it;
    G.emit('inventory'); G.emit('look');
  };

  G.unequip = function (slot) {
    const it = G.S.equipped[slot];
    if (!it) return;
    if (G.S.inventory.length >= G.CONFIG.inventorySize) return toast('toast.bagFull');
    G.S.equipped[slot] = null;
    G.S.inventory.push(it);
    G.emit('inventory'); G.emit('look');
  };

  G.sell = function (uid) {
    const idx = G.S.inventory.findIndex(i => i.uid === uid);
    if (idx < 0) return;
    G.S.gold += G.itemValue(G.S.inventory[idx]);
    G.S.inventory.splice(idx, 1);
    G.emit('inventory');
  };

  G.sellAllBelow = function (rarity) {
    let n = 0, g = 0;
    G.S.inventory = G.S.inventory.filter(it => {
      if (it.rarity <= rarity) { n++; g += G.itemValue(it); return false; }
      return true;
    });
    G.S.gold += g;
    G.emit('inventory');
    toast('toast.sold', { n, g: G.fmt(g) });
  };

  // 自動穿上分數較高的裝備
  G.autoEquip = function () {
    let n = 0;
    G.SLOTS.forEach(slot => {
      const best = G.S.inventory.filter(i => i.slot === slot).sort((a, b) => G.itemScore(b) - G.itemScore(a))[0];
      if (best && G.itemScore(best) > G.itemScore(G.S.equipped[slot])) { G.equip(best.uid); n++; }
    });
    n ? toast('toast.equipped', { n }) : toast('toast.bestAlready');
  };

  G.changeClass = function (cls) {
    const h = G.S.hero;
    if (h.level < G.CONFIG.classUnlockLevel) return toast('toast.classLevel', { lv: G.CONFIG.classUnlockLevel });
    if (h.cls === cls) return;
    if (h.cls !== 'villager') {
      if (G.S.gold < G.CONFIG.classChangeCost) return toast('toast.classCost', { cost: G.CONFIG.classChangeCost });
      G.S.gold -= G.CONFIG.classChangeCost;
    }
    // 退還所有技能點
    let refund = 0;
    Object.keys(G.S.skills).forEach(id => { refund += G.S.skills[id]; G.S.skills[id] = 0; });
    G.S.skillPoints += refund - 1;   // 每個職業第一招的 1 點是送的，不退
    if (G.S.skillPoints < 0) G.S.skillPoints = 0;
    h.cls = cls;
    const first = G.SKILLS[cls][0];
    G.S.skills[first.id] = 1;
    G.S.activeSkills = [first.id, null, null];
    G.addLog('log.classChanged', { cls: { k: `class.${cls}.name` } }, '#ffd76a');
    G.emit('look'); G.emit('skills'); G.emit('stats');
  };

  G.skillPointsInClass = function () {
    return (G.SKILLS[G.S.hero.cls] || []).reduce((a, s) => a + G.S.skills[s.id], 0);
  };

  G.learnSkill = function (id) {
    const sk = (G.SKILLS[G.S.hero.cls] || []).find(s => s.id === id);
    if (!sk) return;
    if (G.S.skillPoints <= 0) return toast('toast.noSP');
    if (G.S.skills[id] >= sk.max) return;
    if (G.skillPointsInClass() < G.TIER_REQ[sk.tier]) return toast('toast.tierReq', { n: G.TIER_REQ[sk.tier] });
    G.S.skills[id]++;
    G.S.skillPoints--;
    // 第一次學會主動技能時，有空格就自動放進去
    if (sk.type === 'active' && G.S.skills[id] === 1 && !G.S.activeSkills.includes(id)) {
      const empty = G.S.activeSkills.indexOf(null);
      if (empty >= 0) G.S.activeSkills[empty] = id;
    }
    G.emit('skills'); G.emit('stats');
  };

  G.setActiveSkill = function (slotIdx, id) {
    const a = G.S.activeSkills;
    const existing = a.indexOf(id);
    if (existing >= 0) a[existing] = a[slotIdx];
    a[slotIdx] = id;
    G.emit('skills');
  };

  G.recruit = function (id) {
    const p = G.PARTNERS.find(x => x.id === id);
    if (G.S.partners[id]) return;
    if (G.S.maxFloor < p.floor) return toast('toast.reachFloor', { n: p.floor });
    const cost = G.partnerRecruitCost(p);
    if (G.S.gold < cost) return toast('toast.needGold', { n: G.fmt(cost) });
    G.S.gold -= cost;
    G.S.partners[id] = { level: 1, cls: 'bloodknight' };
    if (G.S.party.length < G.CONFIG.maxParty) G.S.party.push(id);
    G.addLog('log.recruited', { name: { k: `partner.${id}.name` } }, '#7fd1ff');
    G.emit('party');
  };

  G.partnerLevelUp = function (id) {
    const p = G.S.partners[id];
    const cost = G.partnerLevelCost(p.level);
    if (G.S.gold < cost) return toast('toast.needGold', { n: G.fmt(cost) });
    if (p.level >= G.S.hero.level + 5) return toast('toast.partnerCap');
    G.S.gold -= cost;
    p.level++;
    G.emit('party');
  };

  G.partnerClass = function (id, cls) {
    G.S.partners[id].cls = cls;
    G.emit('party');
  };

  G.toggleParty = function (id) {
    const i = G.S.party.indexOf(id);
    if (i >= 0) G.S.party.splice(i, 1);
    else if (G.S.party.length >= G.CONFIG.maxParty) return toast('toast.partyFull', { n: G.CONFIG.maxParty });
    else G.S.party.push(id);
    G.emit('party');
  };

  G.upgradeShip = function (part) {
    const lv = G.S.ship[part], P = G.SHIP_PARTS[part];
    if (lv >= P.max) return toast('toast.shipMax');
    const c = G.shipUpgradeCost(part, lv);
    if (G.S.gold < c.gold || G.S.crystal < c.crystal) return toast('toast.needShip', { gold: G.fmt(c.gold), crystal: c.crystal });
    G.S.gold -= c.gold; G.S.crystal -= c.crystal;
    G.S.ship[part]++;
    if (part === 'hull') trimHome();
    G.addLog('log.shipUp', { part: { k: `part.${part}.name` }, lv: G.S.ship[part] }, '#9fe39f');
    G.emit('ship');
  };

  G.setShipLook = function (key, val) { G.S.ship[key] = val; G.emit('ship'); };

  G.buyFurniture = function (id) {
    const f = G.FURNITURE.find(x => x.id === id);
    const have = f.cur === 'gold' ? G.S.gold : G.S.crystal;
    if (have < f.price) return toast(f.cur === 'gold' ? 'toast.notEnoughGold' : 'toast.notEnoughCrystal');
    if (f.cur === 'gold') G.S.gold -= f.price; else G.S.crystal -= f.price;
    G.S.furniture[id] = (G.S.furniture[id] || 0) + 1;
    G.emit('home');
    toast('toast.bought', { name: t(`furniture.${id}`) });
  };

  G.placeFurniture = function (key, id) {
    if (!G.S.furniture[id]) return;
    if (G.S.home[key]) G.S.furniture[G.S.home[key]] = (G.S.furniture[G.S.home[key]] || 0) + 1;
    G.S.home[key] = id;
    G.S.furniture[id]--;
    G.emit('home');
  };

  G.removeFurniture = function (key) {
    const id = G.S.home[key];
    if (!id) return;
    G.S.furniture[id] = (G.S.furniture[id] || 0) + 1;
    delete G.S.home[key];
    G.emit('home');
  };

  function trimHome() {
    const { w, h } = G.homeSize(G.S.ship.hull);
    Object.keys(G.S.home).forEach(k => {
      const [x, y] = k.split(',').map(Number);
      if (x >= w || y >= h) G.removeFurniture(k);
    });
  }

  G.comfort = function () {
    return Object.values(G.S.home).reduce((a, id) => a + (G.FURNITURE.find(f => f.id === id)?.comfort || 0), 0);
  };

  G.buyNets = function (n) {
    const cost = G.CONFIG.netPrice * n;
    if (G.S.gold < cost) return toast('toast.notEnoughGold');
    G.S.gold -= cost; G.S.nets += n;
    G.emit('home');
  };

  // 寵物名稱：新存檔存怪物 id，舊存檔存的是文字
  G.petName = p => p.id ? G.monsterName(p.id) : (p.name || '?');

  G.setFloor = function (f) {
    const limit = Math.min(G.S.maxFloor, G.shipMaxFloor(G.S.ship.balloon));
    G.S.floor = Math.max(1, Math.min(f, limit));
    G.S.kills = 0;
    G.emit('floor');
  };

  // ── 離線收益 ─────────────────────────────────────────────────────────────
  G.offlineGains = function () {
    const ms = Math.min(Date.now() - (G.S.lastSeen || Date.now()), G.CONFIG.offlineCapHours * 3600e3);
    const mins = ms / 60e3;
    if (mins < 1) return null;
    const killsPerMin = 8;   // 保守估計
    const r = G.rewardFor(G.S.floor, false);
    const bonus = 1 + G.comfort() / 100;
    const gold = Math.round(r.gold * killsPerMin * mins * G.goldMult() * bonus * 0.5);
    const xp   = Math.round(r.xp * killsPerMin * mins * bonus * 0.5);
    G.S.gold += gold;
    G.gainXp(xp);
    return { mins: Math.round(mins), gold, xp, bonus: G.comfort() };
  };
})();
