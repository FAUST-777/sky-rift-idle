// ════════════════════════════════════════════════════════════════════════════
// 多語系：G.t('key', { 參數 }) 取得目前語言的文字
// 翻譯檔放在 lang/<語言>.js；新增語言 = 複製 lang/en.js 翻譯，再加進 G.LANGS 和 index.html
// 找不到的 key 會退回繁體中文，再找不到就直接顯示 key（方便抓漏翻）
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const SETTINGS_KEY = 'skyrift_settings';

  G.LANGS = [
    { id: 'zh-TW', name: '繁體中文' },
    { id: 'en',    name: 'English' },
    { id: 'zh-CN', name: '简体中文' },
  ];
  G.I18N = {};
  const FALLBACK = 'zh-TW';

  // ── 設定（跟遊戲存檔分開存，重置存檔不會影響）────────────────────────────
  function detectLang() {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    if (/^zh/i.test(nav)) return /(TW|HK|MO|Hant)/i.test(nav) ? 'zh-TW' : 'zh-CN';
    return 'en';
  }
  G.settings = { lang: null };
  try { Object.assign(G.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch {}
  if (!G.LANGS.some(l => l.id === G.settings.lang)) G.settings.lang = detectLang();

  G.saveSettings = function () {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings)); } catch {}
  };

  // ── 翻譯 ─────────────────────────────────────────────────────────────────
  // 參數可以是字串/數字，或 { k: 'key', p: {...} }（存檔裡的日誌用這種，切換語言時才會跟著換）
  function resolve(v) {
    if (v && typeof v === 'object') {
      if (v.item) return G.itemName(v.item);
      if (v.k) return G.t(v.k, v.p);
    }
    return v;
  }
  G.t = function (key, p) {
    const dict = G.I18N[G.settings.lang] || {};
    let s = dict[key];
    if (s === undefined) s = (G.I18N[FALLBACK] || {})[key];
    if (s === undefined) return key;
    if (p) s = s.replace(/\{(\w+)\}/g, (m, name) => (p[name] === undefined ? m : resolve(p[name])));
    return s;
  };

  G.setLang = function (id) {
    if (!G.I18N[id]) return;
    G.settings.lang = id;
    G.saveSettings();
    document.documentElement.lang = id;
    G.emit('lang');
  };

  // ── 常用名稱 ─────────────────────────────────────────────────────────────
  G.clsName     = id => G.t(`class.${id}.name`);
  G.skillName   = id => G.t(`skill.${id}.name`);
  G.monsterName = id => G.t(`monster.${id}`);
  G.partnerName = id => G.t(`partner.${id}.name`);
  G.slotName    = s  => G.t(`slot.${s}`);
  G.statName    = k  => G.t(`stat.${k}`);
  G.rarityName  = r  => G.t(`rarity.${r}`);

  // 技能說明：{v} 依技能設定換成百分比或原始數值
  // 上升詛咒文字：「傷害 -12%」「防禦 -12%」或兩個都有
  G.curseText = c => [c.dmg ? G.t('curse.dmg', { v: Math.round(c.dmg * 100) }) : '', c.def ? G.t('curse.def', { v: Math.round(c.def * 100) }) : ''].filter(Boolean).join('、');
  G.curseShort = c => `-${Math.round(Math.max(c.dmg, c.def) * 100)}%`;

  // 百分比：小於 10% 時留一位小數（例如每秒回 0.3%）
  const pct = x => { const n = x * 100; return +(n < 10 ? n.toFixed(1) : Math.round(n)); };
  G.skillDesc = function (sk, rank) {
    const v = sk.v(rank);
    const p = { v: sk.raw ? +v.toFixed(1) : pct(v) };
    if (sk.v2) p.v2 = sk.v2raw ? +sk.v2(rank).toFixed(2) : pct(sk.v2(rank));
    Object.entries(sk.also || {}).forEach(([k, f]) => { p[k] = pct(f(rank)); });
    Object.entries(sk.descV || {}).forEach(([k, f]) => { p[k] = pct(f(rank)); });   // 主動技能說明用的額外數值
    Object.entries(sk.partyAlso || {}).forEach(([k, f]) => { const v = typeof f === 'function' ? f(rank) : f; p['party_' + k] = (sk.rawKeys || []).includes(k) ? v : pct(v); });
    if (sk.partyStun) { p.stun = pct(sk.partyStun.chance(rank)); p.stunT = +sk.partyStun.t(rank).toFixed(2); }
    return G.t(`skill.${sk.id}.desc`, p);
  };

  // 裝備名稱：前綴（依稀有度）+ 底材。舊存檔沒有 base 欄位時用存好的 name
  G.itemName = function (it) {
    if (it.base === undefined) return it.name || '?';
    const base = G.t(`base.${it.slot}.${it.base}`);
    return it.rarity > 0 ? G.t('item.named', { prefix: G.t(`prefix.${it.rarity}`), base }) : base;
  };
})();
