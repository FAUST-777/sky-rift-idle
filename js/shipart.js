// ════════════════════════════════════════════════════════════════════════════
// 飛空艇紙娃娃（圖片版，第 143 輪）：7 個部位 × 5 款，任意混搭
//   圖片：assets/ship/ship_parts.js（window.SHIP_PART_DATA，key = 部位＋款式編號，例如 hull2）
//   單位：船身寬 = 1000。每個部位有顯示寬度 w 和自己的接點 a（圖片內比例座標），
//   每款船身定義接點要接到哪裡（船身圖片內的比例座標）。
//   繪製順序（後→前）：氣囊、船砲、掛飾、引擎、船首像、船身、側翼
//   圖片還沒載完時，G.ART.drawShip 先用舊的程式畫法
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const SHIP_ART = G.SHIP_ART = {
    // 船身：deck 甲板（氣囊橫桿、船砲接這裡）、front 船首像、rear 引擎、keel 掛飾、wing 側翼（左緣 x、中心 y）
    hull: [
      { deck: [0.52, 0.50], front: [0.95, 0.62], rear: [0.05, 0.55], keel: [0.50, 0.92], wing: [0.00, 1.02] },   // 維京
      { deck: [0.52, 0.36], front: [0.98, 0.30], rear: [0.03, 0.55], keel: [0.50, 0.92], wing: [0.00, 1.08] },   // 蒸氣龐克
      { deck: [0.52, 0.30], front: [0.95, 0.35], rear: [0.05, 0.50], keel: [0.47, 0.90], wing: [0.00, 1.02] },   // 白色科技
      { deck: [0.52, 0.40], front: [0.90, 0.35], rear: [0.05, 0.55], keel: [0.50, 0.92], wing: [0.00, 1.00] },   // 鬼盜船
      { deck: [0.52, 0.46], front: [0.95, 0.32], rear: [0.06, 0.45], keel: [0.50, 0.92], wing: [0.00, 1.00] },   // 神秘銀河
    ],
    // 其他部位：w = 顯示寬（船身 = 1000），a = 這個部位自己的接點
    balloon: [{ w: 1400, a: [0.53, 1] }, { w: 1340, a: [0.50, 1] }, { w: 1150, a: [0.50, 1] }, { w: 1220, a: [0.50, 1] }, { w: 1330, a: [0.50, 1] }],
    cannon:  [{ w: 570, a: [0.50, 0.80] }, { w: 650, a: [0.50, 0.80] }, { w: 450, a: [0.50, 0.80] }, { w: 520, a: [0.50, 0.80] }, { w: 540, a: [0.50, 0.80] }],
    bow:     [{ w: 260, a: [0.02, 0.60] }, { w: 210, a: [0.03, 0.55] }, { w: 310, a: [0.55, 0.95] }, { w: 380, a: [0.02, 0.75] }, { w: 210, a: [0.05, 0.72] }],
    engine:  [{ w: 175, a: [1, 0.55] }, { w: 260, a: [1, 0.58] }, { w: 230, a: [1, 0.50] }, { w: 175, a: [1, 0.50] }, { w: 160, a: [1, 0.50] }],
    wing:    [{ w: 320 }, { w: 270 }, { w: 245 }, { w: 350 }, { w: 265 }],   // 左緣接 hull.wing.x，垂直中心接 hull.wing.y
    charm:   [{ w: 205, a: [0.50, 0] }, { w: 220, a: [0.45, 0] }, { w: 165, a: [0.36, 0] }, { w: 150, a: [0.45, 0] }, { w: 300, a: [0.50, 0] }],   // 依參考圖的總高度回推
    order: ['balloon', 'cannon', 'charm', 'engine', 'bow', 'hull', 'wing'],
  };

  // 算出每個部位的位置（單位座標），回傳 [{ slot, img, x, y, w, h }] 與整體範圍
  function layout(look, imgs) {
    const hi = Math.max(0, look.hull | 0), hImg = imgs.hull && imgs.hull[hi];
    if (!hImg) return null;
    const H = SHIP_ART.hull[hi], hw = 1000, hh = hw * hImg.height / hImg.width;
    const at = p => [p[0] * hw, p[1] * hh];
    const parts = [];
    const place = (slot, i, ax, ay) => {
      const img = imgs[slot] && imgs[slot][i]; if (!img) return;
      const c = SHIP_ART[slot][i], w = c.w, h = w * img.height / img.width;
      parts.push({ slot, img, x: ax - (c.a ? c.a[0] : 0) * w, y: ay - (c.a ? c.a[1] : 0.5) * h, w, h });
    };
    SHIP_ART.order.forEach(slot => {
      const i = look[slot];
      if (slot === 'hull') { parts.push({ slot, img: hImg, x: 0, y: 0, w: hw, h: hh }); return; }
      if (i == null || i < 0) return;
      const p = slot === 'balloon' || slot === 'cannon' ? at(H.deck) : slot === 'bow' ? at(H.front) : slot === 'engine' ? at(H.rear)
        : slot === 'charm' ? at(H.keel) : at(H.wing);
      place(slot, i, p[0], p[1]);
    });
    const x0 = Math.min(...parts.map(p => p.x)), y0 = Math.min(...parts.map(p => p.y));
    const x1 = Math.max(...parts.map(p => p.x + p.w)), y1 = Math.max(...parts.map(p => p.y + p.h));
    return { parts, x0, y0, x1, y1 };
  }

  // 畫進 W×H 畫布（置中、等比例縮放，留 pad 比例邊）
  function draw(ctx, look, imgs, W, H, pad = 0.04) {
    const L = layout(look, imgs); if (!L) return false;
    const bw = L.x1 - L.x0, bh = L.y1 - L.y0, s = Math.min(W * (1 - 2 * pad) / bw, H * (1 - 2 * pad) / bh);
    const ox = (W - bw * s) / 2 - L.x0 * s, oy = (H - bh * s) / 2 - L.y0 * s;
    ctx.imageSmoothingQuality = 'high';
    L.parts.forEach(p => ctx.drawImage(p.img, ox + p.x * s, oy + p.y * s, p.w * s, p.h * s));
    return true;
  }

  // ── 載入部位圖 ───────────────────────────────────────────────────────────
  const IMGS = G.SHIP_IMGS = {};
  let pending = 0;
  G.shipArtReady = false;
  Object.entries(window.SHIP_PART_DATA || {}).forEach(([key, url]) => {
    const slot = key.replace(/\d+$/, ''), i = +key.slice(slot.length);
    const im = new Image();
    pending++;
    im.onload = im.onerror = () => { if (--pending === 0) { G.shipArtReady = true; G.emit && G.emit('ship'); } };
    im.src = url;
    (IMGS[slot] = IMGS[slot] || [])[i] = im;
  });
  G.shipPartImg = (slot, i) => (IMGS[slot] || [])[i];
  // 外觀選單的縮圖：用 CSS class 帶圖（只注入一次，畫面重繪不用重複塞大字串）
  if (typeof document !== 'undefined' && window.SHIP_PART_DATA) {
    const st = document.createElement('style');
    st.textContent = Object.entries(window.SHIP_PART_DATA).map(([k, u]) => `.sp-${k}{background-image:url(${u})}`).join('\n');
    document.head.appendChild(st);
  }

  // 換掉舊的程式畫法：圖片載好就用部位圖組裝
  const oldDraw = G.ART.drawShip;
  G.ART.drawShip = function (ctx, look, W, H) {
    if (G.shipArtReady && draw(ctx, look, IMGS, W, H)) return;
    oldDraw(ctx, look, W, H);
  };
})();
