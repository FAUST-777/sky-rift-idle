// ════════════════════════════════════════════════════════════════════════════
// 冒險者名稱、遊戲 ID、好友代碼（完全離線，不需要伺服器）
//
// 好友怎麼加：A 按「複製我的好友代碼」→ 用 LINE 等貼給 B → B 按「匯入」
// 要更新好友資料：A 重新複製一次代碼給 B，B 再匯入（同一個 ID 會覆蓋成新資料）
// 代碼 = "SKY1." + base64url(壓縮後的 JSON)；不支援壓縮的瀏覽器用 "SKY0."（未壓縮）
// 本專案不處理作弊：代碼可以被改，影響的只有匯入的人自己
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const t = (k, p) => G.t(k, p);
  const toast = (k, p) => G.emit('toast', t(k, p));
  G.MERC = '@merc';
  G.MAX_FRIENDS = 50;
  G.hireCost = lv => 10 + Math.round(lv * 2);   // 雇用好友主角的雲晶

  // ── 名稱：中日韓全形字算 2、其他算 1，上限 20（= 10 個中文字 ≈ 20 個英文字）──
  G.NAME_MAX = 20;
  const WIDE = [[0x1100, 0x115f], [0x2e80, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x20000, 0x3fffd]];
  const BAD = [[0x0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff], [0x3c, 0x3c], [0x3e, 0x3e]];   // 控制字元、零寬字元、< >
  const inRanges = (cp, r) => r.some(([a, b]) => cp >= a && cp <= b);
  G.nameWidth = s => Array.from(s).reduce((w, ch) => w + (inRanges(ch.codePointAt(0), WIDE) ? 2 : 1), 0);
  G.cleanName = raw => Array.from(String(raw || '').normalize('NFC')).filter(ch => !inRanges(ch.codePointAt(0), BAD)).join('').trim().replace(/\s+/g, ' ');

  // ── 遊戲 ID：7 碼英文＋數字（拿掉容易看錯的 0 O 1 I L），一定同時有英文和數字 ──
  // 在玩家自己的瀏覽器產生；組合有 270 億種，實際上不會撞號
  const ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  G.ID_RE = /^[A-Z0-9]{7}$/;
  function genId() {
    for (;;) {
      const b = new Uint8Array(7);
      crypto.getRandomValues(b);
      const id = Array.from(b, x => ID_CHARS[x % ID_CHARS.length]).join('');
      if (/[A-Z]/.test(id) && /[0-9]/.test(id)) return id;
    }
  }

  G.myName = () => (G.S.account && G.S.account.name) || '';
  G.myId = () => (G.S.account && G.S.account.id) || '';
  G.createAccount = function (name) {
    G.S.account = { id: genId(), name };
    G.save();
    G.emit('account');
    return G.S.account;
  };

  // ── 匯出：我的公開資料（名稱、等級、層數、飛空艇外觀、主角外觀與戰鬥資料）──
  G.profileSnapshot = function () {
    const h = G.S.hero;
    return {
      v: 1, id: G.myId(), name: G.myName(), at: Date.now(),
      level: h.level, cls: h.cls, floor: G.S.floor, maxFloor: G.S.maxFloor,
      ship: G.shipLook(), look: G.ART.lookFromHero(),
      merc: { char: { cls: h.cls, level: h.level, skills: h.skills, active: h.active, passive: h.passive }, st: G.heroStats() },
    };
  };

  // base64url ⇄ bytes
  const toB64 = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const fromB64 = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  const canZip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function pipe(bytes, Stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw')));
    return new Uint8Array(await out.arrayBuffer());
  }

  G.exportCode = async function () {
    const json = new TextEncoder().encode(JSON.stringify(G.profileSnapshot()));
    if (canZip) return 'SKY1.' + toB64(await pipe(json, CompressionStream));
    return 'SKY0.' + toB64(json);
  };

  async function decode(code) {
    const s = String(code || '').trim().replace(/\s+/g, '');
    const m = s.match(/(SKY[01])\.([A-Za-z0-9_-]+)/);   // 容許前後夾雜其他文字（例如聊天訊息）
    if (!m) return null;
    let bytes = fromB64(m[2]);
    if (m[1] === 'SKY1') { if (!canZip) return null; bytes = await pipe(bytes, DecompressionStream); }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  // 代碼內容基本檢查（不防作弊，只防貼錯東西讓遊戲壞掉）
  function valid(p) {
    return p && p.v === 1 && G.ID_RE.test(p.id || '') && typeof p.name === 'string' && p.name &&
      p.merc && p.merc.st && p.merc.char && G.CLASSES[p.merc.char.cls] && p.look && p.ship;
  }

  // ── 匯入：加好友，或更新已有好友的資料 ──────────────────────────────────
  G.importCode = async function (code) {
    let p = null;
    try { p = await decode(code); } catch { p = null; }
    if (!valid(p)) return toast('friends.badCode');
    p.name = G.cleanName(p.name).slice(0, 40) || '?';
    if (p.id === G.myId()) return toast('friends.self');
    const isNew = !G.S.friendData[p.id];
    if (isNew && Object.keys(G.S.friendData).length >= G.MAX_FRIENDS) return toast('friends.full', { n: G.MAX_FRIENDS });
    G.S.friendData[p.id] = p;
    // 雇用中的好友 → 換成剛匯入的新資料
    if (G.S.merc && G.S.merc.id === p.id) { G.S.merc.name = p.name; G.S.merc.snap = mercSnap(p); G.emit('party'); }
    G.save();
    toast(isNew ? 'friends.imported' : 'friends.refreshed', { name: p.name });
    G.emit('friends');
    return true;
  };

  G.removeFriend = function (id) {
    delete G.S.friendData[id];
    G.emit('friends');
  };
  G.friendList = () => Object.values(G.S.friendData).sort((a, b) => (b.at || 0) - (a.at || 0));

  // ── 雇用好友主角：佔一個出戰名額，同時只能雇一位（雇別人會取代）────────────
  function mercSnap(p) { return { char: p.merc.char, st: p.merc.st, look: p.look, level: p.level }; }

  G.hireFriend = function (id) {
    const p = G.S.friendData[id];
    if (!valid(p)) return;
    if (G.S.merc && G.S.merc.id === id) return;
    const cost = G.hireCost(p.level || 1);
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
  G.agoText = ms => {
    const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
    return m < 60 ? t('ago.min', { n: Math.max(1, m) }) : m < 1440 ? t('ago.hour', { n: Math.round(m / 60) }) : t('ago.day', { n: Math.round(m / 1440) });
  };
})();
