// ════════════════════════════════════════════════════════════════════════════
// 線上功能：冒險者註冊、資料同步、好友、雇用好友主角
// 後端在 api/（Vercel Serverless + Neon），雙擊 index.html 離線玩時直接連正式站的 API
// 連不上網也能玩：名稱先存起來，之後自動補註冊
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const t = (k, p) => G.t(k, p);
  const toast = (k, p) => G.emit('toast', t(k, p));
  G.API = location.protocol === 'file:' ? 'https://sky-rift-idle.vercel.app' : '';
  G.MERC = '@merc';
  G.ID_RE = /^[A-Z0-9]{7}$/;
  G.MAX_FRIENDS = 50;
  G.hireCost = lv => 10 + Math.round(lv * 2);   // 雇用好友主角的雲晶

  // ── 名稱：中日韓全形字算 2、其他算 1，上限 20（= 10 個中文字），跟後端同一套規則 ──
  G.NAME_MAX = 20;
  const WIDE = [[0x1100, 0x115f], [0x2e80, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x20000, 0x3fffd]];
  const BAD = [[0x0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff], [0x3c, 0x3c], [0x3e, 0x3e]];
  const inRanges = (cp, r) => r.some(([a, b]) => cp >= a && cp <= b);
  G.nameWidth = s => Array.from(s).reduce((w, ch) => w + (inRanges(ch.codePointAt(0), WIDE) ? 2 : 1), 0);
  G.cleanName = raw => Array.from(String(raw || '').normalize('NFC')).filter(ch => !inRanges(ch.codePointAt(0), BAD)).join('').trim().replace(/\s+/g, ' ');

  // 我的名稱（還沒註冊成功時用暫存的名稱）
  G.myName = () => (G.S.account && G.S.account.name) || G.S.pendingName || '';
  G.myId = () => (G.S.account && G.S.account.id) || '';

  async function api(path, opts) {
    const r = await fetch(G.API + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'http ' + r.status); e.status = r.status; throw e; }
    return j;
  }

  // ── 註冊：取得 7 碼遊戲 ID ────────────────────────────────────────────────
  G.register = async function (name) {
    const j = await api('/api/register', { method: 'POST', body: JSON.stringify({ name }) });
    G.S.account = { id: j.id, token: j.token, name: j.name };
    delete G.S.pendingName;
    G.save();
    G.emit('account');
    G.syncNow();
    return j;
  };

  // ── 同步：上傳給好友看的資料（也是好友雇用你時用的戰鬥資料）─────────────
  G.profileSnapshot = function () {
    const h = G.S.hero;
    return {
      v: 1, name: G.myName(), level: h.level, cls: h.cls, floor: G.S.floor, maxFloor: G.S.maxFloor,
      ship: G.shipLook(), look: G.ART.lookFromHero(),
      merc: { char: { cls: h.cls, level: h.level, skills: h.skills, active: h.active, passive: h.passive }, st: G.heroStats() },
    };
  };
  let lastSync = 0, syncing = false;
  G.syncNow = async function () {
    if (syncing) return;
    // 有名稱但還沒註冊成功 → 先補註冊
    if (!G.S.account) {
      if (!G.S.pendingName) return;
      syncing = true;
      try { await G.register(G.S.pendingName); } catch {} finally { syncing = false; }
      return;
    }
    syncing = true;
    try {
      await api('/api/sync', { method: 'POST', body: JSON.stringify({ id: G.S.account.id, token: G.S.account.token, profile: G.profileSnapshot() }) });
      lastSync = Date.now();
    } catch {} finally { syncing = false; }
  };
  // 升級、換層等重要變化 → 最快 20 秒同步一次；另外每分鐘固定同步
  G.syncSoon = () => { if (Date.now() - lastSync > 20000) G.syncNow(); };

  // ── 好友 ─────────────────────────────────────────────────────────────────
  G.friendCache = {};     // id -> { id, name, profile, updatedAt }
  G.friendFetchedAt = 0;
  G.fetchFriends = async function () {
    const ids = G.S.friends.concat(G.S.merc ? [G.S.merc.id] : []);
    if (!ids.length) { G.friendFetchedAt = Date.now(); return; }
    const j = await api('/api/players?ids=' + encodeURIComponent([...new Set(ids)].join(',')), { method: 'GET' });
    j.players.forEach(p => { G.friendCache[p.id] = p; });
    G.friendFetchedAt = Date.now();
    // 雇用中的好友：換成他最新的資料
    const m = G.S.merc && G.friendCache[G.S.merc.id];
    if (m && m.profile && m.profile.merc) { G.S.merc.snap = mercSnap(m); G.S.merc.name = m.name; G.emit('party'); }
  };

  G.addFriend = async function (raw) {
    const id = String(raw || '').trim().toUpperCase();
    if (!G.ID_RE.test(id)) return toast('friends.badId');
    if (id === G.myId()) return toast('friends.self');
    if (G.S.friends.includes(id)) return toast('friends.already');
    if (G.S.friends.length >= G.MAX_FRIENDS) return toast('friends.full', { n: G.MAX_FRIENDS });
    let j;
    try { j = await api('/api/players?ids=' + id, { method: 'GET' }); } catch { return toast('friends.offline'); }
    const p = j.players[0];
    if (!p) return toast('friends.notFound');
    G.friendCache[id] = p;
    G.S.friends.push(id);
    G.save();
    toast('friends.added', { name: p.name });
    if (G.UI) G.UI.friendDraft = '';
    G.emit('friends');
  };

  G.removeFriend = function (id) {
    G.S.friends = G.S.friends.filter(x => x !== id);
    G.emit('friends');
  };

  // ── 雇用好友主角：佔一個出戰名額，同時只能雇一位（雇別人會取代）────────────
  function mercSnap(p) {
    const m = p.profile.merc;
    return { char: m.char, st: m.st, look: p.profile.look, level: p.profile.level };
  }
  G.canHire = p => !!(p && p.profile && p.profile.merc && p.profile.merc.st && G.CLASSES[p.profile.merc.char.cls]);

  G.hireFriend = function (id) {
    const p = G.friendCache[id];
    if (!G.canHire(p)) return toast('merc.noData');
    if (G.S.merc && G.S.merc.id === id) return;
    const cost = G.hireCost(p.profile.level || 1);
    if (G.S.crystal < cost) return toast('toast.notEnoughCrystal');
    G.S.crystal -= cost;
    const prev = G.S.merc;
    G.S.merc = { id, name: p.name, snap: mercSnap(p), hiredAt: Date.now() };
    // 放進出戰名單：已經有傭兵就直接換人；滿了就把最後一位夥伴換下來
    if (!G.S.party.includes(G.MERC)) {
      if (G.S.party.length >= G.CONFIG.maxParty) G.S.party.pop();
      G.S.party.push(G.MERC);
    }
    G.addLog(prev ? 'log.mercReplaced' : 'log.mercHired', { name: p.name, old: prev ? prev.name : '' }, '#7fd1ff');
    toast('merc.hired', { name: p.name });
    G.emit('party'); G.emit('friends');
  };

  G.dismissMerc = function () {
    if (!G.S.merc) return;
    G.S.party = G.S.party.filter(x => x !== G.MERC);
    G.S.merc = null;
    G.emit('party'); G.emit('friends');
  };

  // 相對時間：「5 分鐘」「3 小時」「2 天」
  G.agoText = iso => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    return m < 60 ? t('ago.min', { n: Math.max(1, m) }) : m < 1440 ? t('ago.hour', { n: Math.round(m / 60) }) : t('ago.day', { n: Math.round(m / 1440) });
  };

  // ── 背景同步排程 ─────────────────────────────────────────────────────────
  G.startNet = function () {
    G.syncNow();
    setInterval(() => { if (!document.hidden) G.syncNow(); }, 60000);
    G.on('levelup', G.syncSoon);
    G.on('floorChange', G.syncSoon);
    G.on('look', G.syncSoon);
    G.on('ship', G.syncSoon);
  };
})();
