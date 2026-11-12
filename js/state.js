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

  const emptyGear = () => ({ weapon: null, helmet: null, armor: null, boots: null, accessory: null });
  const emptySlots = n => Array(n).fill(null);

  // 角色（主角或夥伴）的技能都長一樣：skills {id: 等級}、active[4]、passive[4]
  // 技能點 = 等級 − 已投入點數（每個職業第一招送 1 級）
  function resetSkills(ch) {
    const first = (G.SKILLS[ch.cls] || []).find(s => s.type === 'active');
    ch.skills = first ? { [first.id]: 1 } : {};
    ch.active = emptySlots(G.ACTIVE_SLOTS);
    ch.passive = emptySlots(G.PASSIVE_SLOTS);
    if (first) ch.active[0] = first.id;
  }

  // 飛空艇：eq = 每個部位裝著第幾款（-1 = 沒裝，決定數值），owned = 買過的款式，
  //   look = 每個部位顯示哪一款外觀（第 143 輪紙娃娃：買過的款式都能選，跟 eq 分開；-1 = 不顯示）
  function newShip() {
    const eq = {}, owned = {}, look = {};
    G.SHIP_SLOTS.forEach(s => { const free = G.SHIP_PARTS[s].free; eq[s] = free ? 0 : -1; owned[s] = free ? [0] : []; look[s] = eq[s]; });
    return { paint: 0, eq, owned, look };
  }
  // 舊版飛行船（每個零件是「等級」）→ 新版款式；照舊氣囊能到的層數送穩定翼/引擎，不會改版後爬不上去
  function migrateShip(old) {
    if (!old || old.eq) {
      const ship = Object.assign(newShip(), old || {});
      if (!old || !old.look) ship.look = Object.assign({}, ship.eq);   // 舊存檔：外觀先照目前裝的款式
      return ship;
    }
    const ship = newShip(), give = (slot, tier) => {
      if (tier < 0) return;
      tier = Math.min(4, tier);
      for (let i = 0; i <= tier; i++) if (!ship.owned[slot].includes(i)) ship.owned[slot].push(i);
      ship.eq[slot] = tier;
    };
    const steps = Math.max(0, (old.balloon || 1) - 1);          // 舊氣囊每級 +5 層
    give('engine', Math.ceil(steps / 2) - 1);
    give('wing', Math.floor(steps / 2) - 1);
    give('hull', (old.hull || 1) - 1);
    if (old.cannon > 0) give('cannon', Math.ceil(old.cannon / 2) - 1);
    if (old.figurehead > 0) give('bow', old.figurehead - 1);
    ship.paint = old.paint || 0;
    return ship;
  }

  function newState() {
    const hero = { level: 1, xp: 0, cls: 'villager', hair: '#5a3a22', skin: '#f1c9a0', gender: 'm' };   // gender：m 男 / f 女（舊存檔沒有 = 男）
    resetSkills(hero);
    return {
      v: 1, skillVer: 2,
      seenPrologue: false,
      gold: 0, crystal: 0,
      account: null,                // 冒險者 { id（7 碼遊戲 ID）, name }
      friendData: {},               // 匯入的好友資料：id -> 好友代碼內容
      merc: null,                   // 雇用中的好友主角 { id, name, snap, hiredAt }
      net: { owned: [], eq: -1 },   // 捕獸網：買過的款式、裝著第幾款（-1 = 沒裝）
      dex: {},                      // 怪物圖鑑：id -> { seen, caught, seenClaimed, caughtClaimed }
      hero,
      equipped: emptyGear(),
      inventory: [],
      bagExpands: 0,         // 背包擴充次數
      floor: 1, maxFloor: 1, kills: 0, autoAdvance: true,
      morale: 0,             // 士氣層數（貓鎧者每攻擊一次 +1 層，每層 +1% 全隊最終防禦；有人裝「士氣」被動才累積/生效）
      partners: {},          // id -> { level, cls, equipped, skills, active, passive }
      party: [],             // 出戰中的夥伴 id
      ship: newShip(),
      introVer: 0,           // 看過的開場對話版本（G.INTRO_VER 改版時會再看一次）
      furniture: {},         // id -> 持有數量（未擺放）
      home: {},              // 擺設格 "s0"～"s7" -> furniture id
      homeBg: 0,             // 船艙背景（G.HOME_BGS）
      hpets: [],             // 船艙寵物 { uid, kind, perk }
      hpetEq: [],            // 放在船艙裡的寵物 uid（最多 G.PET_SLOTS 隻）
      pets: [],              // { id(怪物), shape, color, bonus: { stat, v } }
      autoSell: [false, false, false, false],   // 撿到就賣：普通／優良／稀有／史詩（傳說不賣）
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
      G.S.ship = migrateShip(s.ship);
      if (s.seenPrologue && !s.introVer) G.S.introVer = 1;   // 看過舊版序章
      migrateToI18n(G.S);
      migrateSkills(G.S);
      migrateCapture(G.S, s);
      migrateHome(G.S);
      if (!Array.isArray(s.autoSell)) G.S.autoSell = [!!s.autoSellCommon, false, false, false];   // 舊版只有「自動賣普通」
      delete G.S.autoSellCommon;
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

  // 職業重新設計（第 5 輪）：舊職業對應到同定位的新職業，所有人技能點全部退還重配
  const CLASS_MAP = { necro: 'catknight', priest: 'druid', crusader: 'wallbringer' };
  function migrateSkills(S) {
    const fixCls = c => (G.CLASSES[c] ? c : CLASS_MAP[c] || 'bloodknight');
    const chars = [S.hero, ...Object.values(S.partners)];
    chars.forEach(ch => {
      const old = ch.cls;
      ch.cls = fixCls(ch.cls);
      // 舊版沒有技能欄位，或技能 id 已不存在 → 重置
      const valid = new Set((G.SKILLS[ch.cls] || []).map(s => s.id));
      const ok = ch.skills && ch.active && ch.passive && ch.active.length === G.ACTIVE_SLOTS && ch.cls === old &&
        Object.keys(ch.skills).every(id => valid.has(id));
      if (!ok || S.skillVer !== 2) resetSkills(ch);
    });
    Object.values(S.partners).forEach(p => { p.equipped = Object.assign(emptyGear(), p.equipped); });
    delete S.skills; delete S.skillPoints; delete S.activeSkills;
    S.skillVer = 2;
  }

  // 捕獸網改成裝備（第 7 輪）：有舊網子的送蜘蛛網；舊寵物補上隨機增益；圖鑑補登
  function migrateCapture(S, old) {
    if (!S.net || !Array.isArray(S.net.owned)) S.net = { owned: [], eq: -1 };
    if (old.nets > 0 && !S.net.owned.length) { S.net.owned = [0]; S.net.eq = 0; }
    delete S.nets;
    S.dex = S.dex || {};
    S.pets.forEach(p => { if (!p.bonus) p.bonus = G.pick(G.PET_BONUSES); if (p.id) G.dexMark(p.id, 'caught', S); });
    // 已經打過的層：該層怪物算「已發現」
    for (let f = 1; f < S.maxFloor; f++) G.monsterTier(f).forEach(m => G.dexMark(m.id, 'seen', S));
  }

  // 船艙改成背景圖 8 格（第 97 輪）：舊的格子座標 "x,y" 上的家具全部收回倉庫
  function migrateHome(S) {
    Object.keys(S.home).forEach(k => {
      if (/^s[0-7]$/.test(k)) return;
      S.furniture[S.home[k]] = (S.furniture[S.home[k]] || 0) + 1;
      delete S.home[k];
    });
    S.hpetEq = (S.hpetEq || []).filter(u => S.hpets.some(p => p.uid === u)).slice(0, G.PET_SLOTS);
    // 第 155 輪：舊家具刪除 → 擺著的、倉庫裡的都收掉，照原價退金幣／雲晶
    const refund = id => { const o = G.OLD_FURNITURE[id]; if (!o) return; if (o[1] === 'gold') S.gold += o[0]; else S.crystal += o[0]; };
    Object.keys(S.home).forEach(k => { if (!G.FURNITURE.some(f => f.id === S.home[k])) { refund(S.home[k]); delete S.home[k]; } });
    Object.keys(S.furniture).forEach(id => { if (!G.FURNITURE.some(f => f.id === id)) { for (let i = 0; i < (S.furniture[id] || 0); i++) refund(id); delete S.furniture[id]; } });
  }

  // 重置中就不要再存檔（不然頁面重新整理前的自動存檔會把剛刪掉的存檔寫回去）
  let resetting = false;
  G.save = function () {
    if (resetting) return;
    G.S.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.S)); } catch {}
  };

  // 全部重置：遊戲存檔＋設定（語言、戰鬥畫面收合）都清掉
  G.resetSave = function () {
    resetting = true;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('skyrift_settings'); } catch {}
    location.reload();
  };

  // 日誌：存 key + 參數，畫面上才翻譯
  G.addLog = function (k, p, color) {
    G.S.log.unshift({ k, p: p || null, color: color || '' });
    if (G.S.log.length > 30) G.S.log.length = 30;
    G.emit('log');
  };
  G.logText = l => l.k ? t(l.k, l.p) : (l.text || '');   // 舊存檔的日誌是純文字

  // ── 角色 / 技能 ─────────────────────────────────────────────────────────
  // who = 'hero' 或夥伴 id
  // 雇用的好友主角用特殊 id G.MERC，資料是好友上傳的快照
  G.charOf = who => (who === 'hero' || !who ? G.S.hero : who === G.MERC ? G.S.merc.snap.char : G.S.partners[who]);
  G.partyMembers = () => ['hero', ...G.S.party.filter(id => (id === G.MERC ? !!G.S.merc : !!G.S.partners[id]))];
  G.whoName = who => (who === 'hero' || !who ? G.t('hero.who.hero') : who === G.MERC ? (G.S.merc ? G.S.merc.name : '?') : G.partnerName(who));
  G.skillDef = (cls, id) => (G.SKILLS[cls] || []).find(s => s.id === id);
  G.spentPoints = who => Object.values(G.charOf(who).skills).reduce((a, b) => a + b, 0);
  G.spOf = who => Math.max(0, G.charOf(who).level - G.spentPoints(who));

  // 已裝備的被動 → 依類型加總：self / party（光環）/ proc（普攻附加）/ special（特殊機制）
  G.passivesOf = function (who, chOverride) {
    const ch = chOverride || G.charOf(who), out = { self: {}, party: {}, proc: [], special: {} };
    ch.passive.forEach(id => {
      const sk = id && G.skillDef(ch.cls, id), r = id && ch.skills[id];
      if (!sk || !r || sk.type !== 'passive') return;
      const v = sk.v(r);
      if (sk.p === 'proc') out.proc.push({ fx: sk.fx, chance: sk.chance === 'v' ? v : 1, val: sk.val === 'v' ? v : sk.val, t: sk.t,
        // 附帶減益：字串 = 跟主效果一起觸發（狗狗狂吼）；物件 = 自己獨立擲機率（貓肉球拍打的暈眩）
        more: (sk.more || []).map(m => typeof m === 'string' ? { fx: m, val: sk.v2(r) } : { fx: m.fx, chance: m.chance, val: m.val, t: typeof m.t === 'function' ? m.t(r) : m.t }) });
      else if (sk.p === 'special') out.special[sk.key] = { v, r, v2: sk.v2 ? sk.v2(r) : 0 };   // r = 等級（死亡契約用）
      else out[sk.p][sk.key] = (out[sk.p][sk.key] || 0) + v;
      if (sk.key2 && (sk.p === 'self' || sk.p === 'party')) out[sk.p][sk.key2] = (out[sk.p][sk.key2] || 0) + sk.v2(r);   // 第二效果（例如忠犬的吸血）
      Object.entries(sk.also || {}).forEach(([k, f]) => { out.self[k] = (out.self[k] || 0) + f(r); });   // 額外自身屬性（例如吸貓狂熱）
      if (sk.procAlso) { const pa = sk.procAlso; out.proc.push({ fx: pa.fx, chance: pa.chance, val: typeof pa.val === 'function' ? pa.val(r) : pa.val, t: pa.t, more: [] }); }   // 額外普攻附加（例如畫廊）
      Object.entries(sk.partyAlso || {}).forEach(([k, f]) => { out.party[k] = (out.party[k] || 0) + (typeof f === 'function' ? f(r) : f); });   // 額外全隊光環
      if (sk.partyStun) {   // 全隊普攻暈眩（貓貓士氣）：取機率最高的
        const c = sk.partyStun.chance(r);
        if (!out.partyStun || c > out.partyStun.chance) out.partyStun = { chance: c, t: sk.partyStun.t(r) };
      }
    });
    return out;
  };
  // ── 飛空艇數值 ───────────────────────────────────────────────────────────
  G.shipTier = slot => G.S.ship.eq[slot];
  G.shipVal = slot => { const i = G.shipTier(slot); return i >= 0 ? G.SHIP_PARTS[slot].v[i] : 0; };
  G.shipLv = slot => (G.S.ship.eq[slot] >= 0 ? G.S.ship.eq[slot] + 1 : 0);   // 部位等級：沒裝 0，第 1～5 款 = 1～5（飛船船長技能用）
  G.shipTotalLv = () => Object.keys(G.SHIP_PARTS).reduce((a, k) => a + G.shipLv(k), 0);
  G.shipMaxFloor = () => G.SHIP_BASE_FLOORS + G.shipVal('wing') + G.shipVal('engine');
  G.cannonMult = () => G.shipVal('cannon');
  G.homeTier = () => Math.max(0, G.shipTier('hull'));
  G.petCap = () => 6 + G.homeTier() * 2;
  // 給全隊的加成：熱氣球生命、船身防禦、船首傷害、船底掛飾金幣
  G.shipBonus = () => ({ hpPct: G.shipVal('balloon'), defPct: G.shipVal('hull'), dmgPct: G.shipVal('bow'), goldPct: G.shipVal('charm') });
  // 飛空艇外觀（每個部位裝的款式，-1 = 沒裝）
  // 外觀：選過的款式（要有買過）；沒選過就跟裝備一樣
  G.shipLook = () => {
    const sh = G.S.ship, out = { paint: sh.paint };
    G.SHIP_SLOTS.forEach(s => {
      const l = sh.look ? sh.look[s] : undefined;
      out[s] = l === -1 && !G.SHIP_PARTS[s].free ? -1 : l != null && sh.owned[s].includes(l) ? l : sh.eq[s];
    });
    return out;
  };
  // 換外觀：i = 買過的款式；-1 = 不顯示（熱氣球、船身不能拿掉）
  G.setShipLook = function (slot, i) {
    const sh = G.S.ship;
    if (i === -1 ? G.SHIP_PARTS[slot].free : !sh.owned[slot].includes(i)) return;
    sh.look = sh.look || {}; sh.look[slot] = i;
    G.emit('ship');
  };

  // 全隊光環 = 出戰中所有人的 party 被動加總 ＋ 飛空艇加成
  const AURA_MAX = ['noEnemyCrit', 'qeRegen', 'tariff', 'wolfSkill', 'wolfHalf', 'cannonHalf', 'shieldReborn', 'cannonCrit', 'cannonCritDmg', 'shieldDur', 'shieldAmt', 'shieldDef', 'stunSkillX', 'reflectDef', 'physCrit', 'cannonCut', 'vsStun', 'synergyPow', 'critHeal', 'animalSkillX', 'stunHit', 'cannonVsDefDown', 'stunCritDmg', 'basicPoison', 'reflectCrit', 'reflectCritDmg', 'reflectCritBase', 'reflectCritAdd'];
  G.partyAura = function (synBoost) {
    const aura = {};
    const add = (k, v) => { if (v) aura[k] = (aura[k] || 0) + v; };
    // AURA_MAX 的欄位多人裝也不疊加（取最大）
    G.partyMembers().forEach(w => Object.entries(G.passivesOf(w).party).forEach(([k, v]) => { if (AURA_MAX.includes(k)) aura[k] = Math.max(aura[k] || 0, v); else add(k, v); }));
    Object.entries(G.shipBonus()).forEach(([k, v]) => add(k, v));
    G.S.pets.forEach(p => p.bonus && add(p.bonus.stat, p.bonus.v));   // 捕獲的怪物：各自一個小增益
    G.S.party.forEach(id => { const p = G.PARTNERS.find(x => x.id === id); if (p && p.perk && G.S.partners[id]) { add(p.perk.stat, p.perk.v); if (p.perk.extra) aura[p.perk.extra] = 1; } });   // 出戰夥伴的專屬 buff（extra 是開關）
    // 飛船船長：跟著飛空艇部位等級成長的光環
    if (aura.shipDmg) add('dmgPct', aura.shipDmg * G.shipTotalLv());
    if (aura.balloonHp) add('hpPct', aura.balloonHp * G.shipLv('balloon'));
    const synPow = Math.max(aura.synergyPow || 0, synBoost || 0);   // 獸群之心、喵喵鼓舞取高
    G.teamSynergy().active.forEach(a => Object.entries(G.scaleSynergy(a.bonus, synPow)).forEach(([k, v]) => {   // 團隊特效（獸群之心加強）
      if (k === 'cannonInterval') aura[k] = Math.min(aura[k] || G.CANNON_INTERVAL, v);
      else add(k, v);
    }));
    return aura;
  };

  // 論文審查：別人分給我的最大生命（提供者自己不吃）
  G.othersBonus = (who, key) => G.partyMembers().filter(w => w !== who).reduce((a, w) => a + (G.passivesOf(w).party[key] || 0), 0);
  G.othersHpPct = who => G.othersBonus(who, 'hpPctOthers');

  // 船砲間隔：團隊特效（取最短）再扣貓哈氣爆甲的 -1 秒，最少 2 秒
  G.cannonInterval = (aura = G.partyAura()) => Math.max(2, (aura.cannonInterval || G.CANNON_INTERVAL) - (aura.cannonCut || 0) - (aura.captainCut || 0)) * (aura.cannonHalf ? 0.5 : 1) * (aura.wolfHalf ? 0.5 : 1);   // 王牌砲手、華爾街之狼：各自減半
  // 全隊普攻暈眩（貓貓士氣）：出戰成員中最好的那個
  G.partyStun = () => G.partyMembers().map(w => G.passivesOf(w).partyStun).filter(Boolean).sort((a, b) => b.chance - a.chance)[0] || null;

  // 團隊特效：看出戰成員的傷害系別組合
  // 回傳 { members: [{ who, type }], counts: { type: n }, active: [{ id, n?, bonus }] }
  // 獸群之心：團隊特效數值 ×(1+pow)；船砲間隔是秒數（越小越好），不放大
  G.scaleSynergy = (bonus, pow) => pow ? Object.fromEntries(Object.entries(bonus).map(([k, v]) => [k, k === 'cannonInterval' || k === 'arcaneDur' || k === 'darkNeed' || k === 'darkDur' ? v : v * (1 + pow)])) : bonus;
  G.synergyPow = () => Math.max(0, ...G.partyMembers().map(w => G.passivesOf(w).party.synergyPow || 0));
  G.teamSynergy = function () {
    const members = G.partyMembers().map(who => ({ who, type: G.CLASSES[G.charOf(who).cls].dmgType }));
    const counts = {};
    members.forEach(m => { counts[m.type] = (counts[m.type] || 0) + 1; });
    const types = Object.keys(counts);
    const active = [];
    G.TEAM_SYNERGIES.forEach(sy => {
      if (sy.mix) {
        if (members.length === sy.mix.length && types.length === sy.mix.length && sy.mix.every(x => counts[x] === 1)) active.push({ id: sy.id, bonus: sy.bonus });
      } else {
        const n = Math.max(0, ...Object.keys(sy.tiers).map(Number).filter(k => (counts[sy.type] || 0) >= k));
        if (n) active.push({ id: sy.id, n, bonus: sy.tiers[n] });
      }
    });
    return { members, counts, active };
  };
  // 隊伍裡某個特殊被動的最大值（例如士氣上限、吸貓狂熱上限）
  G.partySpecial = key => Math.max(0, ...G.partyMembers().map(w => (G.passivesOf(w).special[key] || {}).v || 0));
  G.moraleCap = () => G.partySpecial('morale');
  G.frenzyCap = () => G.partySpecial('frenzy');

  // ── 屬性計算（主角與夥伴共用）─────────────────────────────────────────
  // 分兩段：bareStats = 等級＋職業＋裝備（還沒套被動）；applySelf = 套上自身被動、四捨五入、補職業欄位
  // 好友傭兵只上傳 bare，所以技能改版後，雇來的好友會自動照新版被動重算
  G.bareStats = function (who) {
    const ch = G.charOf(who), cls = G.CLASSES[ch.cls], isHero = who === 'hero' || !who;
    const B = G.HERO_BASE, L = G.LEVEL_GAIN, lv = ch.level;
    // 夥伴底子比主角略低，靠升級、裝備追上
    const base = isHero
      ? { hp: B.hp + L.hp * (lv - 1), atk: B.atk + L.atk * (lv - 1), def: B.def + L.def * (lv - 1), spd: B.spd }
      : { hp: 80 + 14 * (lv - 1), atk: 8 + 2.4 * (lv - 1), def: 2 + 0.9 * (lv - 1), spd: 0.9 };
    const st = {
      maxHp: base.hp * cls.mult.hp, atk: base.atk * cls.mult.atk, def: base.def * cls.mult.def,
      spd: base.spd, crit: B.crit, critDmg: B.critDmg,
    };
    const gear = G.gearOf(who);
    G.SLOTS.forEach(slot => {
      const it = gear[slot];
      if (!it) return;
      st.maxHp += it.stats.hp || 0; st.atk += it.stats.atk || 0; st.def += it.stats.def || 0;
      st.crit += it.stats.crit || 0; st.spd += it.stats.spd || 0;
    });
    return st;
  };
  G.applySelf = function (bare, ps, clsId) {
    const st = Object.assign({}, bare), cls = G.CLASSES[clsId], g = k => ps[k] || 0;
    st.atk   *= 1 + g('atkPct');
    st.def   *= 1 + g('defPct');
    st.maxHp *= 1 + g('hpPct');
    st.spd   *= 1 + g('spdPct');
    st.crit  += g('crit');
    st.critDmg += g('critDmg');
    // 內線交易：防禦歸零（第 148 輪取消生命鎖 1；第 156 輪取消基礎攻擊倍率）
    if (g('insider')) {
      const r = g('insider');
      st.insider = r;
      st.def = 0;
    }
    Object.assign(st, {
      evade: g('evade'), lifesteal: g('lifesteal'), skillDmg: g('skillDmg'), regen: g('regen'), dmgReduce: g('dmgReduce'),
      summonPower: 1 + g('summonPower'), debuffDur: 1 + g('debuffDur'), animalAura: 1 + g('animalAura'),
      buffDur: 1 + g('buffDur'), buffPow: 1 + g('buffPow'), shieldPow: 1 + g('shieldPow'), vsPoison: g('vsPoison'), basicDmg: g('basicDmg'), hpSlam: g('hpSlam'), bossSlam: g('bossSlam'), cdr: g('cdr'), bleedHeal: g('bleedHeal'), iai: g('iai'), snipeX: g('snipeX'), bleedCrit: g('bleedCrit'), bleedCritDmg: g('bleedCritDmg'), shipSkill: g('shipSkill'), shipCdr: g('shipCdr'), bashDmg: g('bashDmg'),
    });
    st.maxHp = Math.round(st.maxHp);
    st.atk = +st.atk.toFixed(1);
    st.def = +st.def.toFixed(1);
    st.spd = +Math.min(3, st.spd).toFixed(2);
    st.crit = +Math.min(75, st.crit).toFixed(1);
    Object.assign(st, { ranged: cls.ranged, range: cls.range, dmgType: cls.dmgType, missile: cls.missile || null, shots: cls.shots || 1 });
    return st;
  };
  G.charStats = function (who) {
    if (who === G.MERC) return G.snapStats(G.S.merc.snap);   // 好友：照他上傳的底子，套「目前版本」的被動
    const ps = Object.assign({}, G.passivesOf(who).self);
    Object.entries(G.pinkSetBonus(G.pinkCount(who))).forEach(([k, v]) => { ps[k] = (ps[k] || 0) + v; });   // 天櫻套裝
    return G.applySelf(G.bareStats(who), ps, G.charOf(who).cls);
  };
  // 天櫻套裝：身上幾件粉紅裝備 → 累加達到件數的效果
  G.pinkCount = who => G.SLOTS.filter(s => { const it = G.gearOf(who)[s]; return it && it.rarity === G.PINK; }).length;
  G.pinkSetBonus = n => {
    const out = {};
    G.PINK_SET.forEach(t => { if (n >= t.n) Object.entries(t.b).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }); });
    return out;
  };

  // 好友快照 → 戰鬥數值
  //   新版快照帶 bare（沒套被動）→ 直接套新版被動
  //   舊版快照只有 st（已套上傳當時的被動）→ 用 G.LEGACY_SELF 記的舊數值把被動扣回去，再套新版
  G.snapStats = function (snap) {
    const ch = snap.char;
    const bare = snap.bare || unapplySelf(snap.st, legacySelf(ch));
    return G.applySelf(bare, G.passivesOf(G.MERC, ch).self, ch.cls);
  };
  function legacySelf(ch) {
    const out = {};
    (ch.passive || []).forEach(id => {
      const r = id && ch.skills[id], sk = id && G.skillDef(ch.cls, id);
      if (!r || !sk) return;
      const old = G.LEGACY_SELF[id];
      const add = (k, v) => { out[k] = (out[k] || 0) + v; };
      if (old) return Object.entries(old).forEach(([k, f]) => add(k, f(r)));
      if (sk.p === 'self') add(sk.key, sk.v(r));
      if (sk.key2 && sk.p === 'self') add(sk.key2, sk.v2(r));
      Object.entries(sk.also || {}).forEach(([k, f]) => add(k, f(r)));
    });
    return out;
  }
  function unapplySelf(st, ps) {
    const g = k => ps[k] || 0;
    return {
      maxHp: st.maxHp / (1 + g('hpPct')), atk: st.atk / (1 + g('atkPct')), def: st.def / (1 + g('defPct')),
      spd: st.spd / (1 + g('spdPct')), crit: Math.max(0, st.crit - g('crit')), critDmg: Math.max(1, st.critDmg - g('critDmg')),
    };
  }
  G.heroStats = () => G.charStats('hero');
  G.partnerStats = id => G.charStats(id);

  G.power = st => Math.round(st.atk * st.spd * (1 + st.crit / 100 * (st.critDmg - 1)) * (st.range === 'all' ? 5 : 4) + st.maxHp * 0.3 + st.def * 3);

  // ── 等級與經驗 ───────────────────────────────────────────────────────────
  G.xpMult = () => 1 + (G.petPerk('xp') ? G.PET_XP : 0);   // 寵物「經驗 +12%」
  G.gainXp = function (xp) {
    const h = G.S.hero;
    h.xp += Math.round(xp * G.xpMult());
    let up = false;
    while (h.xp >= G.xpToLevel(h.level)) {
      h.xp -= G.xpToLevel(h.level);
      h.level++;
      up = true;
      G.addLog('log.levelUp', { lv: h.level }, '#ffd76a');
      if (h.level === G.CONFIG.classUnlockLevel && h.cls === 'villager') {
        G.addLog('log.canClass', null, '#ffd76a');
        toast('toast.canClass');
      }
    }
    if (up) G.emit('levelup');
  };

  // 金幣倍率：捕獲的怪物、飛空艇船底掛飾、學者「獎學金」等全隊光環
  G.goldMult = () => (1 + (G.partyAura().goldPct || 0)) * (G.petPerk('gold') ? 1.1 : 1);   // 寵物「金幣 +10%」

  // ── 裝備產生 ─────────────────────────────────────────────────────────────
  G.rollRarity = function (boss, floor = 1) {
    const epic = G.petPerk('epic') ? 1.1 : 1;   // 寵物「紫色以上 +10%」
    const w = G.RARITY.map((r, i) => (i === G.PINK ? G.pinkDropWeight(floor) : r.weight) * (boss && i >= 2 ? 6 : 1) * (i >= 3 ? epic : 1));
    if (boss) w[0] = 0;
    const total = w.reduce((a, b) => a + b, 0);
    let x = Math.random() * total;
    for (let i = 0; i < w.length; i++) { if ((x -= w[i]) < 0) return i; }
    return 0;
  };

  G.makeItem = function (floor, boss, force = {}) {   // force：指定 { slot, rarity }（測試用）
    const slot = force.slot || G.pick(G.SLOTS);
    const bases = G.ITEM_BASES[slot];
    const baseIdx = G.randInt(0, bases.length - 1);
    const rarity = force.rarity !== undefined ? force.rarity : G.rollRarity(boss, floor);
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

  // ── 背包容量與擴充 ───────────────────────────────────────────────────────
  G.EXCHANGE_RATE = 10;   // 10 金幣 = 1 雲晶
  // dir 'toCrystal'：花 n×10 金幣換 n 雲晶；'toGold'：花 n 雲晶換 n×10 金幣
  G.exchange = function (dir, n) {
    n = Math.floor(n);
    if (!(n > 0)) return false;
    const g = n * G.EXCHANGE_RATE;
    if (dir === 'toCrystal') {
      if (G.S.gold < g) { toast('toast.notEnoughGold'); return false; }
      G.S.gold -= g; G.S.crystal += n;
      toast('toast.exchanged', { from: `${G.fmt(g)}💰`, to: `${G.fmt(n)}💎` });
    } else {
      if (G.S.crystal < n) { toast('toast.notEnoughCrystal'); return false; }
      G.S.crystal -= n; G.S.gold += g;
      toast('toast.exchanged', { from: `${G.fmt(n)}💎`, to: `${G.fmt(g)}💰` });
    }
    G.save();
    return true;
  };
  G.exchangeMax = dir => dir === 'toCrystal' ? Math.floor(G.S.gold / G.EXCHANGE_RATE) : Math.floor(G.S.crystal);

  G.invCap = () => Math.min(G.CONFIG.bagMax, G.CONFIG.inventorySize + (G.S.bagExpands || 0) * G.CONFIG.bagExpandSlots);
  G.canExpandBag = () => G.invCap() < G.CONFIG.bagMax;
  G.expandBag = function () {
    if (!G.canExpandBag()) return;
    const c = G.bagExpandCost(G.S.bagExpands || 0);
    if (G.S.gold < c.gold) return toast('toast.notEnoughGold');
    if (G.S.crystal < c.crystal) return toast('toast.notEnoughCrystal');
    G.S.gold -= c.gold; G.S.crystal -= c.crystal;
    G.S.bagExpands = (G.S.bagExpands || 0) + 1;
    toast('toast.bagExpanded', { n: G.invCap() });
    G.emit('inventory');
  };

  G.addItem = function (it) {
    if (G.S.autoSell[it.rarity]) {
      G.S.gold += G.itemValue(it);
      return 'sold';
    }
    if (G.S.inventory.length >= G.invCap()) {
      G.S.gold += G.itemValue(it);
      return 'full';
    }
    G.S.inventory.push(it);
    G.emit('inventory');
    return 'ok';
  };

  // ── 玩家操作 ─────────────────────────────────────────────────────────────
  // who = 'hero' 或夥伴 id；夥伴和主角共用同一個背包
  G.gearOf = who => (who === 'hero' || !who ? G.S.equipped : who === G.MERC ? {} : G.S.partners[who].equipped);
  function gearChanged(who) {
    G.emit('inventory');
    G.emit(who === 'hero' || !who ? 'look' : 'party');
  }

  G.equip = function (uid, who = 'hero') {
    const idx = G.S.inventory.findIndex(i => i.uid === uid);
    if (idx < 0) return;
    const gear = G.gearOf(who);
    const it = G.S.inventory[idx];
    const old = gear[it.slot];
    G.S.inventory.splice(idx, 1);
    if (old) G.S.inventory.push(old);
    gear[it.slot] = it;
    gearChanged(who);
  };

  G.unequip = function (slot, who = 'hero') {
    const gear = G.gearOf(who);
    const it = gear[slot];
    if (!it) return;
    if (G.S.inventory.length >= G.invCap()) return toast('toast.bagFull');
    gear[slot] = null;
    G.S.inventory.push(it);
    gearChanged(who);
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

  // 一鍵穿最好的：主角先挑，剩下的再依序給出戰中的夥伴、其他夥伴
  // 主角換下來的舊裝備會回到背包，夥伴也可能撿去穿
  // who 有值 = 只幫那一個角色穿；沒值 = 全隊（主角優先）
  G.autoEquip = function (who) {
    let n = 0;
    const order = who ? [who] : ['hero', ...G.S.party.filter(id => id !== G.MERC), ...Object.keys(G.S.partners).filter(id => !G.S.party.includes(id))];
    // 全隊模式：先把夥伴身上的裝備收回背包一起排，主角才能拿到全隊最好的
    // （每個欄位最後一定會被填回去，所以背包數量不會比原本多）
    const uidOf = (w, slot) => { const it = G.gearOf(w)[slot]; return it ? it.uid : null; };
    const before = {};
    order.forEach(w => { before[w] = {}; G.SLOTS.forEach(slot => { before[w][slot] = uidOf(w, slot); }); });
    if (!who) Object.keys(G.S.partners).forEach(id => {
      const gear = G.gearOf(id);
      G.SLOTS.forEach(slot => { if (gear[slot]) { G.S.inventory.push(gear[slot]); gear[slot] = null; } });
    });
    order.forEach(w => {
      const gear = G.gearOf(w);
      G.SLOTS.forEach(slot => {
        const best = G.S.inventory.filter(i => i.slot === slot).sort((a, b) => G.itemScore(b) - G.itemScore(a))[0];
        if (best && G.itemScore(best) > G.itemScore(gear[slot])) G.equip(best.uid, w);
      });
    });
    // 只算真的有換的欄位
    order.forEach(w => G.SLOTS.forEach(slot => { if (uidOf(w, slot) !== before[w][slot]) n++; }));
    G.emit('party');
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
    h.cls = cls;
    resetSkills(h);   // 技能點全部退還（技能點 = 等級 − 已投入）
    G.addLog('log.classChanged', { cls: { k: `class.${cls}.name` } }, '#ffd76a');
    G.emit('look'); G.emit('skills'); G.emit('stats');
  };

  G.learnSkill = function (id, who = 'hero') {
    const ch = G.charOf(who), sk = G.skillDef(ch.cls, id);
    if (!sk) return;
    if (G.spOf(who) <= 0) return toast('toast.noSP');
    const r = ch.skills[id] || 0;
    if (r >= sk.max) return;
    if (G.spentPoints(who) < G.TIER_REQ[sk.tier]) return toast('toast.tierReq', { n: G.TIER_REQ[sk.tier] });
    ch.skills[id] = r + 1;
    // 第一次學會就自動放進空格
    if (r === 0) {
      const slots = sk.type === 'active' ? ch.active : ch.passive;
      const empty = slots.indexOf(null);
      if (empty >= 0 && !slots.includes(id)) slots[empty] = id;
    }
    skillsChanged(who);
  };

  // 把技能放進第 idx 格（id = null 清空）；同一招已在別格就互換
  G.setSkillSlot = function (who, kind, idx, id) {
    const ch = G.charOf(who), slots = kind === 'active' ? ch.active : ch.passive;
    const existing = id ? slots.indexOf(id) : -1;
    if (existing >= 0) slots[existing] = slots[idx];
    slots[idx] = id;
    skillsChanged(who);
  };

  // 免費重置技能點：全部退回（職業第一招保留 1 級）
  G.resetSkillPoints = function (who = 'hero') {
    const ch = G.charOf(who);
    if (!ch) return;
    resetSkills(ch);
    skillsChanged(who);
    toast('toast.skillsReset', { n: G.spOf(who) });
  };

  function skillsChanged(who) {
    G.emit('skills');
    G.emit(who === 'hero' ? 'stats' : 'party');
  }

  G.recruit = function (id) {
    const p = G.PARTNERS.find(x => x.id === id);
    if (G.S.partners[id]) return;
    if (G.S.maxFloor < p.floor) return toast('toast.reachFloor', { n: p.floor });
    const cost = G.partnerRecruitCost(p);
    if (G.S.gold < cost) return toast('toast.needGold', { n: G.fmt(cost) });
    G.S.gold -= cost;
    const np = { level: 1, cls: 'bloodknight', equipped: emptyGear() };
    resetSkills(np);
    G.S.partners[id] = np;
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
    G.emit('party'); G.emit('skills');
  };

  // 夥伴換職業免費，技能點全部退還
  G.partnerClass = function (id, cls) {
    const p = G.S.partners[id];
    if (p.cls === cls) return;
    p.cls = cls;
    resetSkills(p);
    G.emit('party'); G.emit('skills');
  };

  G.toggleParty = function (id) {
    const i = G.S.party.indexOf(id);
    if (i >= 0) G.S.party.splice(i, 1);
    else if (G.S.party.length >= G.CONFIG.maxParty) return toast('toast.partyFull', { n: G.CONFIG.maxParty });
    else G.S.party.push(id);
    G.emit('party');
  };

  // 買飛空艇零件（買完直接裝上）
  G.buyShipPart = function (slot, i) {
    const sh = G.S.ship;
    if (sh.owned[slot].includes(i)) return G.equipShipPart(slot, i);
    const c = G.shipPartCost(slot, i);
    if (G.S.gold < c.gold || G.S.crystal < c.crystal) return toast('toast.needShip', { gold: G.fmt(c.gold), crystal: c.crystal });
    G.S.gold -= c.gold; G.S.crystal -= c.crystal;
    sh.owned[slot].push(i);
    sh.look = sh.look || {};
    if (sh.look[slot] == null || sh.look[slot] < 0) sh.look[slot] = i;   // 這個部位原本沒外觀 → 直接換上；已經有外觀就保留（升級只多一款可選）
    G.addLog('log.shipBuy', { name: { k: `part.${slot}.${i}` } }, '#9fe39f');
    G.equipShipPart(slot, i);
  };

  G.equipShipPart = function (slot, i) {
    const sh = G.S.ship;
    if (!sh.owned[slot].includes(i)) return;
    sh.eq[slot] = i;
    G.emit('ship'); G.emit('stats'); G.emit('party');
  };

  G.setShipPaint = function (i) { G.S.ship.paint = i; G.emit('ship'); };

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

  // 船艙背景：船身買過最高第幾款，就解鎖到第幾張
  G.homeBgCount = () => Math.min(G.HOME_BGS.length, 1 + Math.max(0, G.shipTier('hull'), ...G.S.ship.owned.hull));
  G.homeBg = () => G.HOME_BGS[Math.min(G.S.homeBg || 0, G.homeBgCount() - 1)];
  G.setHomeBg = function (i) { if (i < G.homeBgCount()) { G.S.homeBg = i; G.emit('home'); } };

  // ── 船艙寵物 ─────────────────────────────────────────────────────────────
  G.hpet = uid => G.S.hpets.find(p => p.uid === uid);
  G.hpetKind = id => G.HOME_PETS.find(k => k.id === id);
  // 生效中的機制：perk -> 第一隻放進船艙、有這個機制的寵物 uid；後面重複的失效
  G.petPerkOwners = function () {
    const own = {};
    G.S.hpetEq.forEach(u => { const p = G.hpet(u); if (p && !own[p.perk]) own[p.perk] = u; });
    return own;
  };
  G.petPerk = perk => !!(G.S && G.S.hpetEq && G.petPerkOwners()[perk]);
  G.petActive = uid => { const p = G.hpet(uid); return !!p && G.petPerkOwners()[p.perk] === uid; };
  G.rollPet = function (floor, boss) {
    if (Math.random() >= G.petDropChance(floor, boss)) return null;
    const p = { uid: G.S.uid++, kind: G.pick(G.HOME_PETS).id, perk: G.pick(G.PET_PERKS).id };
    G.S.hpets.push(p);
    G.addLog('log.petGet', { name: { k: `hpet.${p.kind}` }, perk: { k: `hperk.${p.perk}` } }, '#ff9ee8');
    G.emit('toast', t('toast.petGet', { name: t(`hpet.${p.kind}`) }));
    G.emit('home');
    return p;
  };
  // 層主送寵物（第 140 輪）：擁有的寵物少於 G.BOSS_PET_UNDER 隻 → 擊敗層主 G.BOSS_PET_CHANCE 機率送一隻
  //   品種優先挑還沒有的；機制優先挑還沒有的；都收集齊了才完全隨機
  G.bossPetGift = function () {
    const S = G.S;
    if (S.hpets.length >= G.BOSS_PET_UNDER || Math.random() >= G.BOSS_PET_CHANCE) return null;
    const hasKind = new Set(S.hpets.map(p => p.kind)), hasPerk = new Set(S.hpets.map(p => p.perk));
    const kinds = G.HOME_PETS.filter(k => !hasKind.has(k.id)), perks = G.PET_PERKS.filter(k => !hasPerk.has(k.id));
    const p = { uid: S.uid++, kind: G.pick(kinds.length ? kinds : G.HOME_PETS).id, perk: G.pick(perks.length ? perks : G.PET_PERKS).id };
    S.hpets.push(p);
    G.addLog('log.bossPet', { name: { k: `hpet.${p.kind}` }, perk: { k: `hperk.${p.perk}` } }, '#ff9ee8');
    G.emit('toast', t('toast.petGet', { name: t(`hpet.${p.kind}`) }));
    G.emit('home');
    return p;
  };
  G.equipPet = function (uid) {
    const eq = G.S.hpetEq;
    if (eq.includes(uid) || !G.hpet(uid)) return;
    if (eq.length >= G.PET_SLOTS) return toast('toast.petFull', { n: G.PET_SLOTS });
    eq.push(uid); G.save(); G.emit('home'); G.emit('stats');
  };
  G.unequipPet = function (uid) {
    G.S.hpetEq = G.S.hpetEq.filter(u => u !== uid); G.save(); G.emit('home'); G.emit('stats');
  };
  G.HPET_SELL = 30;   // 賣掉船艙寵物換雲晶
  G.releasePet = function (uid) {
    if (!G.hpet(uid)) return;
    G.unequipPet(uid);
    G.S.crystal += G.HPET_SELL;
    toast('toast.hpetSold', { n: G.HPET_SELL });
    G.S.hpets = G.S.hpets.filter(p => p.uid !== uid); G.save(); G.emit('home');
  };

  G.comfort = function () {
    return Object.values(G.S.home).reduce((a, id) => a + (G.FURNITURE.find(f => f.id === id)?.comfort || 0), 0);
  };

  // ── 捕獸網（裝備型）─────────────────────────────────────────────────────
  G.captureChance = () => (G.S.net.eq >= 0 ? G.NETS[G.S.net.eq].rate * (G.petPerk('net') ? 1.25 : 1) : 0);   // 寵物「補獸網 +25%」
  G.buyNet = function (i) {
    const n = G.NETS[i], net = G.S.net;
    if (net.owned.includes(i)) return G.equipNet(i);
    if (G.S.gold < n.gold || G.S.crystal < n.crystal) return toast('toast.needShip', { gold: G.fmt(n.gold), crystal: n.crystal });
    G.S.gold -= n.gold; G.S.crystal -= n.crystal;
    net.owned.push(i);
    G.equipNet(i);
    toast('toast.netBought', { name: t(`net.${n.id}`) });
  };
  G.equipNet = function (i) { if (G.S.net.owned.includes(i)) { G.S.net.eq = i; G.emit('home'); } };

  // 捕獲：成功就登錄圖鑑；家園有空位才帶回來養（帶一個隨機小增益）
  G.capture = function (m) {
    G.dexMark(m.monsterId, 'caught');
    if (G.S.pets.length >= G.petCap()) { G.addLog('log.captureFull', { name: { k: `monster.${m.monsterId}` } }, '#ffb3f0'); return; }
    G.S.pets.push({ id: m.monsterId, shape: m.shape, color: m.color, bonus: G.pick(G.PET_BONUSES) });
    G.addLog('log.capture', { name: { k: `monster.${m.monsterId}` } }, '#ffb3f0');
    G.emit('home'); G.emit('party');
  };

  // 賣掉捕獲的怪物：換雲晶，增益跟著消失（圖鑑紀錄保留）
  G.sellPet = function (i) {
    const p = G.S.pets[i];
    if (!p) return;
    const price = G.petSellPrice(p);
    G.S.pets.splice(i, 1);
    G.S.crystal += price;
    toast('toast.petSold', { name: G.petName(p), n: price });
    G.save();
    G.emit('home'); G.emit('party');
  };

  // ── 怪物圖鑑 ─────────────────────────────────────────────────────────────
  G.dexMark = function (id, kind, S = G.S) {
    const e = S.dex[id] = S.dex[id] || { seen: false, caught: false, seenClaimed: false, caughtClaimed: false };
    const isNew = !e[kind];
    e[kind] = true;
    if (kind === 'caught') e.seen = true;
    if (isNew && S === G.S) { G.addLog(kind === 'caught' ? 'log.dexCaught' : 'log.dexSeen', { name: { k: `monster.${id}` } }, '#ffd76a'); G.emit('home'); }
    return isNew;
  };
  G.dexClaimable = id => { const e = G.S.dex[id]; return !!e && ((e.seen && !e.seenClaimed) || (e.caught && !e.caughtClaimed)); };
  function claimOne(id) {
    const e = G.S.dex[id], tier = G.monsterTierOf(id);
    if (!e) return 0;
    let got = 0;
    if (e.seen && !e.seenClaimed) { e.seenClaimed = true; got += G.dexReward(tier, 'seen'); }
    if (e.caught && !e.caughtClaimed) { e.caughtClaimed = true; got += G.dexReward(tier, 'caught'); }
    G.S.crystal += got;
    return got;
  }
  // id 有值 = 領一隻；沒值 = 全部領
  G.dexClaim = function (id) {
    const got = id ? claimOne(id) : Object.keys(G.S.dex).reduce((a, k) => a + claimOne(k), 0);
    if (got) { toast('toast.dexClaim', { n: got }); G.emit('home'); }
  };

  // 寵物名稱：新存檔存怪物 id，舊存檔存的是文字
  G.petName = p => p.id ? G.monsterName(p.id) : (p.name || '?');

  G.setFloor = function (f) {
    const limit = Math.min(G.S.maxFloor, G.shipMaxFloor());
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
    return { mins: Math.round(mins), gold, xp: Math.round(xp * G.xpMult()), bonus: G.comfort() };
  };
})();
