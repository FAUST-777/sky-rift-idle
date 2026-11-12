// ════════════════════════════════════════════════════════════════════════════
// 骨架動畫人物（原型：血騎士）
//   不用任何外部圖檔：身體拆成髖、軀幹、頭、上下臂、上下腿、武器，用關節角度擺姿勢，
//   每個動作取幾格畫成一張 sprite sheet，戰鬥場景依狀態切換格子。
//   軀幹／鎧甲、頭／頭髮／頭盔沿用 G.ART.drawTorsoGear / drawHeadGear（紙娃娃裝備照樣顯示），
//   手腳、披風、武器重新用關節畫；整個人物畫完再自動加一圈深色描邊。
//
//   座標：跟舊紙娃娃一樣的 64×80「單位」，面向右；角度 0 = 往下，正值 = 往前（往右）轉。
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const R = G.RIG = {};
  const shade = (c, a) => G.ART.shade(c, a);

  R.CLASSES = ['bloodknight'];                 // 原型：先只有血騎士換新畫法
  R.enabled = look => !!look && R.CLASSES.includes(look.cls);

  // 一格的大小（單位）：比舊的 64×80 左右各多 16、上方多 8，揮劍時劍不會被切掉
  R.PAD_X = 16; R.PAD_TOP = 8;
  R.FW = 64 + R.PAD_X * 2; R.FH = 80 + R.PAD_TOP;
  R.SCALE = 2;                                 // 實際畫 2 倍解析度
  R.ORIGIN_Y = (76 + R.PAD_TOP) / R.FH;        // 腳底（影子中心）在格子裡的高度比例

  // 動作：格數、一輪秒數、是否循環
  R.ANIMS = {
    idle:   { n: 6, dur: 1.4, loop: true },
    walk:   { n: 8, dur: 0.88, loop: true },
    attack: { n: 7, dur: 0.34, loop: false },
    hit:    { n: 3, dur: 0.26, loop: false },
    dead:   { n: 1, dur: 1, loop: false },
  };

  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k * k * (3 - 2 * k);
  // 由關鍵格內插：keys = [[t, pose], ...]
  function keyed(keys, t) {
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, a] = keys[i - 1], [t1, b] = keys[i], k = ease((t - t0) / (t1 - t0 || 1));
        const out = {};
        Object.keys(a).forEach(key => { out[key] = lerp(a[key], b[key] !== undefined ? b[key] : a[key], k); });
        return out;
      }
    }
    return Object.assign({}, keys[keys.length - 1][1]);
  }

  // ── 姿勢 ───────────────────────────────────────────────────────────────
  //   dx/dy 身體位移、lean 軀幹前傾、head 頭部額外傾斜
  //   bT/bK 後腿大腿／膝、fT/fK 前腿、bS/bE 後手肩／肘、fS/fE 前手、bW/fW 後／前劍的絕對角度
  //   cape 披風擺動、slash 揮劍殘影強度（0～1）
  const STAND = { dx: 0, dy: 0, lean: 0.06, head: 0, bT: -0.18, bK: 0.12, fT: 0.22, fK: 0.1,
    bS: 0.5, bE: -0.75, fS: 0.55, fE: -1.05, bW: 1.85, fW: 2.55, cape: 0, slash: 0 };

  R.pose = function (anim, t) {
    const p = Object.assign({}, STAND);
    const TAU = Math.PI * 2;
    if (anim === 'idle') {             // 待機：呼吸起伏、手微微晃、披風飄
      const s = Math.sin(t * TAU);
      p.dy = s * 0.7; p.lean += s * 0.015;
      p.fS += s * 0.05; p.bS -= s * 0.05; p.fW += s * 0.04; p.bW -= s * 0.03;
      p.cape = 0.06 + s * 0.05;
    } else if (anim === 'walk') {      // 走路：雙腳交替、膝蓋彎、雙手反向擺、身體上下
      const ph = t * TAU, s = Math.sin(ph), c = Math.cos(ph);
      p.fT = 0.5 * s; p.bT = -0.5 * s;
      p.fK = 0.15 + 0.6 * Math.max(0, -c); p.bK = 0.15 + 0.6 * Math.max(0, c);
      p.dy = -Math.abs(c) * 1.6 + 0.8;
      p.lean = 0.12;
      p.fS = 0.45 - 0.3 * s; p.bS = 0.45 + 0.3 * s;
      p.fW = 2.45 - 0.15 * s; p.bW = 1.8 + 0.15 * s;
      p.cape = 0.22 + 0.06 * Math.abs(s);
    } else if (anim === 'attack') {    // 攻擊：前劍舉到後上方 → 往前下砍（殘影）→ 後劍補一刀 → 收回
      Object.assign(p, keyed([
        [0.0,  { dx: 0, lean: 0.06, fS: 0.55, fE: -1.05, fW: 2.55, bS: 0.5, bE: -0.75, bW: 1.85, fT: 0.22, bT: -0.18, slash: 0, head: 0 }],
        [0.28, { dx: -2, lean: -0.12, fS: -2.5, fE: -0.5, fW: -2.6, bS: -0.3, bE: -0.9, bW: 2.6, fT: 0.1, bT: -0.25, slash: 0, head: -0.08 }],
        [0.5,  { dx: 5, lean: 0.32, fS: 1.35, fE: -0.15, fW: 1.25, bS: -1.6, bE: -0.6, bW: -2.4, fT: 0.6, bT: -0.45, slash: 1, head: 0.1 }],
        [0.7,  { dx: 6, lean: 0.36, fS: 1.1, fE: -0.3, fW: 1.4, bS: 1.4, bE: -0.15, bW: 1.0, fT: 0.6, bT: -0.45, slash: 0.6, head: 0.12 }],
        [1.0,  { dx: 0, lean: 0.06, fS: 0.55, fE: -1.05, fW: 2.55, bS: 0.5, bE: -0.75, bW: 1.85, fT: 0.22, bT: -0.18, slash: 0, head: 0 }],
      ], t));
      p.cape = 0.1 + Math.max(0, p.dx) * 0.04;
    } else if (anim === 'hit') {       // 被打：往後仰、頭甩、手張開
      const k = Math.sin(Math.min(1, t * 1.4) * Math.PI);
      p.dx = -3 * k; p.lean = 0.06 - 0.3 * k; p.head = -0.25 * k;
      p.fS = 0.55 - 0.5 * k; p.fE = -1.05 + 0.5 * k; p.bS = 0.5 + 0.5 * k;
      p.fT = 0.22 + 0.2 * k; p.bT = -0.18 - 0.1 * k; p.cape = -0.1 * k;
    } else if (anim === 'dead') {      // 倒下：跪倒、上半身往前垂、劍拄地
      Object.assign(p, { dx: -2, dy: 9, lean: 0.85, head: 0.35, bT: -1.35, bK: 2.3, fT: 0.75, fK: 1.6,
        bS: 0.4, bE: -0.2, fS: 0.9, fE: -0.2, bW: 0.7, fW: 0.3, cape: 0.5 });
    }
    return p;
  };

  // ── 畫一個姿勢（標準 64×80 座標，外層已經做好平移／縮放）───────────────────
  const pt = (o, a, L) => [o[0] + Math.sin(a) * L, o[1] + Math.cos(a) * L];
  const rot = (o, a, x, y) => [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)];
  function limb(ctx, a, b, w, color) {
    ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }

  // ── Q 版美術（第 160 輪：參考日系線上 RPG 的 Q 版比例；動作不變）─────────────
  //   大頭（約全身 1/3）、大眼睛、蓬鬆分層的頭髮、短身體、短手短腳、圓頭靴
  //   比例常數：腿兩段各 LEG、手兩段各 ARM、軀幹 TORSO、頭半徑 HEAD_R
  const LEG = 6.6, ARM = 6.2, TORSO = 15.5, HEAD_R = 13.5;
  R.CHIBI = { LEG, ARM, TORSO, HEAD_R };

  // 頭：3/4 側臉朝右；畫在以頭中心為 (0,0) 的座標
  function chibiHead(ctx, look, cls) {
    const r = HEAD_R, hair = look.hair || '#5a3a22', hm = look.helmet;
    const hairDark = shade(hair, -38), hairLight = shade(hair, 45);
    const covered = hm && (hm.v === 1 || hm.v === 2);       // 鐵盔、兜帽：頭頂頭髮被蓋住
    // 後髮（頭後面一大團，尾端分岔）
    if (!(hm && hm.v === 2)) {
      ctx.fillStyle = hairDark;
      ctx.beginPath();
      ctx.moveTo(-4, -r + 1);
      ctx.quadraticCurveTo(-r - 6, -r + 2, -r - 3, 4);
      ctx.lineTo(-r - 6, 12); ctx.lineTo(-r + 1, 9); ctx.lineTo(-r - 1, 15); ctx.lineTo(-r + 5, 10);
      ctx.quadraticCurveTo(-3, 6, -4, -r + 1);
      ctx.fill();
    }
    // 臉
    const g = ctx.createRadialGradient(3, -2, 2, 0, 0, r + 1);
    g.addColorStop(0, shade(look.skin, 12)); g.addColorStop(1, shade(look.skin, -14));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0.5, 0.5, r, r - 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // 下巴往右前收一點（3/4 側臉）
    ctx.beginPath(); ctx.moveTo(-2, 8); ctx.quadraticCurveTo(8, 15, 12, 6); ctx.lineTo(10, 2); ctx.closePath(); ctx.fill();
    // 耳朵（在臉的後半）
    ctx.fillStyle = shade(look.skin, -10);
    ctx.beginPath(); ctx.ellipse(-4.5, 2.5, 2.4, 3.2, 0.2, 0, Math.PI * 2); ctx.fill();
    // 眼睛：近的大、遠的窄；白眼、虹膜（職業色）、瞳孔、兩個高光、上睫毛
    const iris = shade(cls.color || '#3a5a9a', -10);
    const eye = (x, w, h) => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, 2, w, h, 0, 0, Math.PI * 2); ctx.fill();
      const ig = ctx.createLinearGradient(0, 2 - h, 0, 2 + h);
      ig.addColorStop(0, shade(iris, -45)); ig.addColorStop(1, shade(iris, 35));
      ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(x + w * 0.25, 2.4, w * 0.72, h * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.ellipse(x + w * 0.3, 2.6, w * 0.32, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w * 0.05, 0.6, Math.max(0.8, w * 0.32), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.6, 4, Math.max(0.5, w * 0.16), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a1820'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - w - 0.4, 2 - h * 0.55); ctx.quadraticCurveTo(x, 2 - h - 1.4, x + w + 0.8, 2 - h * 0.7); ctx.stroke();
    };
    eye(5.2, 2.7, 3.6);    // 近眼
    eye(11, 1.6, 3.3);     // 遠眼（被透視壓窄）
    // 眉毛、嘴、腮紅
    ctx.strokeStyle = hairDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(3, -3.4); ctx.lineTo(7.6, -4); ctx.moveTo(10, -4); ctx.lineTo(12.2, -3.5); ctx.stroke();
    ctx.strokeStyle = '#8a3a3a'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(8, 9.2); ctx.quadraticCurveTo(9.5, 10, 10.6, 9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,130,.35)';
    ctx.beginPath(); ctx.ellipse(3.5, 7.2, 2.6, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    // 前髮：頭頂一大片＋垂到額前的尖瀏海＋臉側一撮（帽子蓋住就只畫露出來的瀏海）
    if (!covered) {
      const hg = ctx.createLinearGradient(0, -r - 4, 0, 2);
      hg.addColorStop(0, hairLight); hg.addColorStop(0.45, hair); hg.addColorStop(1, hairDark);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(-r - 1, 3);
      ctx.quadraticCurveTo(-r - 2, -r - 3, 2, -r - 3);       // 後腦到頭頂
      ctx.quadraticCurveTo(r + 3, -r - 1, r + 2, -3);         // 頭頂到前額
      ctx.lineTo(r - 1, -1.5); ctx.lineTo(10.5, -5.2);         // 瀏海尖 1
      ctx.lineTo(8.5, 0.5); ctx.lineTo(6.2, -5.4);             // 瀏海尖 2
      ctx.lineTo(3.4, 1.5); ctx.lineTo(1.2, -5);               // 瀏海尖 3
      ctx.lineTo(-1.8, 1); ctx.lineTo(-3.5, -3);
      ctx.lineTo(-6.5, 8); ctx.lineTo(-8, 1);                  // 臉側那撮
      ctx.closePath(); ctx.fill();
      // 頭頂翹毛
      ctx.beginPath(); ctx.moveTo(-1, -r - 2); ctx.quadraticCurveTo(-3, -r - 9, 3, -r - 8); ctx.quadraticCurveTo(0, -r - 5, 2, -r - 2); ctx.fill();
      // 光澤帶
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(1, -2, r - 2, Math.PI * 1.18, Math.PI * 1.55); ctx.stroke();
    } else if (hm.v === 1) {   // 戴鐵盔：盔沿下露出一點瀏海
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.moveTo(1, -5); ctx.lineTo(3.5, 0); ctx.lineTo(5.5, -5); ctx.lineTo(8.5, 0.5); ctx.lineTo(10.5, -5); ctx.closePath(); ctx.fill();
    }
    // 頭盔
    if (hm) {
      const hc = hm.color, hl = shade(hc, 45), hd = shade(hc, -40);
      if (hm.v === 0) {            // 皮帽：圓頂軟帽＋帽緣
        const cg = ctx.createLinearGradient(0, -r - 6, 0, -4); cg.addColorStop(0, hl); cg.addColorStop(1, hc);
        ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(0, -r + 3, r + 1, 9, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = hd; ctx.beginPath(); ctx.ellipse(1.5, -r + 3.5, r + 4, 2.6, 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shade(hc, 70); ctx.fillRect(-6, -r - 3, 3, 2);
      } else if (hm.v === 1) {     // 鐵盔：包住頭頂和後腦、鼻樑護片、鉚釘
        const cg = ctx.createLinearGradient(-r, -r, r, 0); cg.addColorStop(0, hd); cg.addColorStop(0.5, hl); cg.addColorStop(1, hc);
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.moveTo(-r - 2, 9); ctx.quadraticCurveTo(-r - 3, -r - 3, 1, -r - 3); ctx.quadraticCurveTo(r + 3, -r - 2, r + 2, -4);
        ctx.lineTo(-3, -4); ctx.lineTo(-5, 9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hd; ctx.fillRect(-r - 1, -5.5, 2 * r + 3, 2.4);
        ctx.fillStyle = hl; ctx.fillRect(7.4, -5, 2.4, 7.5);
        ctx.fillStyle = shade(hc, 80); [[-8, -4.3], [-2, -4.3], [4, -4.3]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = hl; ctx.beginPath(); ctx.moveTo(-2, -r - 3); ctx.lineTo(1, -r - 9); ctx.lineTo(4, -r - 3); ctx.fill();   // 頂飾
      } else if (hm.v === 2) {     // 兜帽：包住頭和後頸，臉露出來
        ctx.fillStyle = hc;
        ctx.beginPath(); ctx.moveTo(-r - 3, 14); ctx.quadraticCurveTo(-r - 5, -r - 4, 2, -r - 3); ctx.quadraticCurveTo(r + 4, -r - 1, r + 2, -2);
        ctx.quadraticCurveTo(r - 3, -6, 4, -5.5); ctx.quadraticCurveTo(-3, -3, -3, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hd; ctx.beginPath(); ctx.moveTo(-3, 12); ctx.quadraticCurveTo(-3, -3, 4, -5.5); ctx.lineTo(4, -3.5); ctx.quadraticCurveTo(-1, -1.5, -1, 12); ctx.closePath(); ctx.fill();
      } else {                     // 其他職業頭飾：沿用舊畫法放大（之後再逐一改 Q 版）
        ctx.save(); ctx.scale(1.3, 1.3); ctx.translate(-33, -21);
        G.ART.drawHelmetOnly && G.ART.drawHelmetOnly(ctx, look);
        ctx.restore();
      }
    }
  }

  // 軀幹：圓滾滾的短上衣（布衣／鎖甲／板甲），畫在以髖部為 (0,0)、往上 TORSO 的座標
  function chibiTorso(ctx, look, cls) {
    const ar = look.armor, c = ar ? ar.color : '#8b6f47';
    const H = TORSO, top = -H - 1;
    const g = ctx.createLinearGradient(-8, 0, 9, 0);
    g.addColorStop(0, shade(c, -30)); g.addColorStop(0.55, c); g.addColorStop(1, shade(c, 22));
    ctx.fillStyle = g;
    // 上窄下寬的短上衣，下擺微微外翻
    ctx.beginPath();
    ctx.moveTo(-6, top); ctx.quadraticCurveTo(0, top - 1.5, 7, top);
    ctx.quadraticCurveTo(10, -5, 10.5, 1.5); ctx.quadraticCurveTo(1, 4, -9.5, 1.5);
    ctx.quadraticCurveTo(-9, -5, -6, top); ctx.closePath(); ctx.fill();
    if (!ar || ar.v === 0) {       // 布衣：領口、腰帶、扣環
      ctx.fillStyle = shade(c, 40); ctx.beginPath(); ctx.moveTo(-3, top); ctx.lineTo(2.5, top + 4.5); ctx.lineTo(6, top); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c, -55); ctx.fillRect(-9, -4, 19.5, 2.6);
      ctx.fillStyle = '#e0b84a'; ctx.fillRect(1.2, -4.4, 3.2, 3.4);
    } else if (ar.v === 1) {       // 鎖甲：鎖鏈點點＋腰帶
      ctx.fillStyle = shade(c, 45);
      for (let y = top + 3; y < -2; y += 2.4) for (let x = -7 + ((y | 0) % 2); x < 9; x += 2.4) ctx.fillRect(x, y, 1.1, 1.1);
      ctx.fillStyle = shade(c, -55); ctx.fillRect(-9, -4, 19.5, 2.4);
    } else {                       // 板甲：胸甲反光、中線、下擺甲片
      ctx.fillStyle = shade(c, 30);
      ctx.beginPath(); ctx.moveTo(-5, top + 1.5); ctx.quadraticCurveTo(3, top - 0.5, 8.5, top + 2); ctx.quadraticCurveTo(9, top + 9, 2, top + 10.5); ctx.quadraticCurveTo(-5, top + 9, -5, top + 1.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(5, top + 4, 2, 1.1, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = shade(c, -45); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(2, top + 1); ctx.lineTo(2, top + 10); ctx.stroke();
      ctx.fillStyle = shade(c, -20); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.rect(-9 + i * 5, -2.5, 4.5, 4); ctx.fill(); }
    }
    if (look.accessory) {          // 飾品：胸前寶石＋小鍊子
      ctx.strokeStyle = '#e0b84a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-2, top + 1); ctx.quadraticCurveTo(2.5, top + 6, 7, top + 1); ctx.stroke();
      ctx.fillStyle = look.accessory.color; ctx.beginPath(); ctx.moveTo(2.5, top + 4.5); ctx.lineTo(4.3, top + 6.5); ctx.lineTo(2.5, top + 8.8); ctx.lineTo(0.7, top + 6.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(1.9, top + 5.4, 0.9, 0.9);
    }
  }

  R.drawPose = function (ctx, look, p) {
    const cls = G.CLASSES[look.cls] || G.CLASSES.villager;
    const hip = [32 + p.dx, 61 + p.dy];   // 腳底（鞋底）約在 y 76，跟影子對齊
    const neck = rot(hip, p.lean, 0, -TORSO);
    const headC = rot(neck, p.lean + p.head, 1.5, -HEAD_R + 1);
    const armC = look.armor ? look.armor.color : '#8b6f47';
    const bootC = look.boots ? look.boots.color : '#4a3424';
    const wp = look.weapon || { type: 'dualsword', color: G.ART.GEAR_COLORS[0] };
    const plate = look.armor && look.armor.v === 2;

    // 腿：短短的大腿＋小腿＋圓頭靴（後腿比較暗）
    const leg = (hx, T, K, back) => {
      const h0 = rot(hip, p.lean * 0.3, hx, 0);
      const knee = pt(h0, T, LEG), ankle = pt(knee, T - K, LEG);
      const dk = back ? -28 : 0;
      limb(ctx, h0, knee, 5.6, shade('#4b3a2a', dk));
      limb(ctx, knee, ankle, 5, shade('#4b3a2a', dk - 6));
      const bc = shade(bootC, dk - 8);
      const bg = ctx.createLinearGradient(0, ankle[1] - 4, 0, ankle[1] + 3);
      bg.addColorStop(0, shade(bc, 25)); bg.addColorStop(1, shade(bc, -20));
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(ankle[0] - 3.2, ankle[1] - 4.5); ctx.lineTo(ankle[0] + 2.5, ankle[1] - 4.5);
      ctx.quadraticCurveTo(ankle[0] + 8, ankle[1] - 1.5, ankle[0] + 7.2, ankle[1] + 2.6); ctx.lineTo(ankle[0] - 3.4, ankle[1] + 2.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(bc, -40); ctx.fillRect(ankle[0] - 3.4, ankle[1] + 1.6, 10.6, 1.2);           // 鞋底
      if (look.boots && look.boots.v === 1) { ctx.fillStyle = shade(bootC, 45 + dk); ctx.fillRect(ankle[0] - 3.6, ankle[1] - 5.6, 6.6, 2); }   // 靴口翻邊
    };
    // 手：短手、圓圓的拳頭；板甲多一個圓肩甲
    const arm = (sh, S, E, back) => {
      const elbow = pt(sh, S, ARM), hand = pt(elbow, S + E, ARM);
      const c = back ? shade(armC, -32) : shade(armC, -6);
      limb(ctx, sh, elbow, 5.4, c);
      limb(ctx, elbow, hand, 4.8, shade(c, -8));
      ctx.fillStyle = back ? shade(look.skin, -25) : look.skin;
      ctx.beginPath(); ctx.arc(hand[0], hand[1], 2.7, 0, Math.PI * 2); ctx.fill();
      return hand;
    };
    const pauldron = (sh, back) => {
      if (!plate) return;
      const c = back ? shade(armC, -25) : shade(armC, 18);
      const g = ctx.createRadialGradient(sh[0] - 1, sh[1] - 2, 0.5, sh[0], sh[1], 5);
      g.addColorStop(0, shade(c, 40)); g.addColorStop(1, c);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sh[0], sh[1] + 0.5, 4.6, 4, 0, 0, Math.PI * 2); ctx.fill();
    };
    const sword = (hand, a, L, back) => {
      const tip = pt(hand, a, L);
      G.ART.blade(ctx, back ? shade(wp.color, -25) : wp.color, hand[0], hand[1], tip[0], tip[1], back ? 2.5 : 3);
      return tip;
    };

    // 1. 披風（掛在肩後，比較短，下襬分岔）
    if (cls.cape) {
      const top = rot(neck, p.lean, -4, 1.5), sway = p.cape;
      const L = 21, bl = [top[0] - 10 - sway * 12, top[1] + L - sway * 5], br = [top[0] + 3 - sway * 7, top[1] + L + 1 - sway * 3];
      const g = ctx.createLinearGradient(top[0], top[1], top[0], top[1] + L);
      g.addColorStop(0, shade(cls.cape, 5)); g.addColorStop(1, shade(cls.cape, -45));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(top[0] - 2, top[1]); ctx.quadraticCurveTo(bl[0] + 2, top[1] + 10, bl[0], bl[1]);
      ctx.lineTo((bl[0] + br[0]) / 2, (bl[1] + br[1]) / 2 - 3); ctx.lineTo(br[0], br[1]);
      ctx.quadraticCurveTo(top[0] + 7, top[1] + 10, top[0] + 6, top[1]); ctx.closePath(); ctx.fill();
    }
    // 2. 後腳、後手＋後劍
    leg(-3, p.bT, p.bK, true);
    const bSh = rot(neck, p.lean, -4.5, 2.5);
    const bHand = arm(bSh, p.bS, p.bE, true);
    pauldron(bSh, true);
    if (wp.type === 'dualsword') sword(bHand, p.bW, 20, true);
    // 3. 前腳
    leg(3, p.fT, p.fK, false);
    // 4. 軀幹（跟著髖部旋轉）
    ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(p.lean);
    chibiTorso(ctx, look, cls);
    ctx.restore();
    // 5. 頭（大頭，跟著軀幹＋頭部傾斜）
    ctx.save(); ctx.translate(headC[0], headC[1]); ctx.rotate(p.lean + p.head);
    chibiHead(ctx, look, cls);
    ctx.restore();
    // 6. 前手＋肩甲＋前劍（揮砍時畫殘影弧線）
    const fSh = rot(neck, p.lean, 5.5, 2.5);
    const fHand = arm(fSh, p.fS, p.fE, false);
    pauldron(fSh, false);
    if (wp.type === 'dualsword') {
      if (p.slash > 0.05) {
        ctx.save(); ctx.globalAlpha = 0.55 * p.slash;
        const g = ctx.createRadialGradient(fSh[0], fSh[1], 6, fSh[0], fSh[1], 28);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,240,240,.9)'); g.addColorStop(1, shade(cls.color, 40));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(fSh[0], fSh[1], 28, -Math.PI * 0.62, Math.PI * 0.18); ctx.arc(fSh[0], fSh[1], 16, Math.PI * 0.18, -Math.PI * 0.62, true); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      sword(fHand, p.fW, 24, false);
    }
  };

  // ── 一格：加影子、畫姿勢、自動描邊 ──────────────────────────────────────
  // 回傳畫好的 canvas（FW×FH 單位 × SCALE）
  R.frame = function (look, anim, t) {
    const S = R.SCALE, W = R.FW * S, H = R.FH * S;
    const fig = G.ART.canvas(W, H), f = fig.getContext('2d');
    f.save(); f.scale(S, S); f.translate(R.PAD_X, R.PAD_TOP);
    R.drawPose(f, look, R.pose(anim, t));
    f.restore();
    // 描邊：把人物剪影往 8 個方向偏移、塗深色，墊在下面
    const sil = G.ART.canvas(W, H), s = sil.getContext('2d');
    s.drawImage(fig, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#1a1020'; s.fillRect(0, 0, W, H);
    const out = G.ART.canvas(W, H), o = out.getContext('2d');
    // 影子（不描邊）
    const p = R.pose(anim, t);
    o.fillStyle = 'rgba(0,0,0,.25)';
    o.beginPath(); o.ellipse((32 + R.PAD_X + p.dx * 0.5) * S, (76 + R.PAD_TOP) * S, (anim === 'dead' ? 20 : 16) * S, 4 * S, 0, 0, Math.PI * 2); o.fill();
    const d = 1.1 * S / 2 + 0.5;
    [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, y]) => o.drawImage(sil, x * d, y * d));
    o.drawImage(fig, 0, 0);
    return out;
  };

  // 整張 sprite sheet：所有動作的格子排一排；frames = { anim: [格子 x 位置…] }
  R.sheet = function (look) {
    const S = R.SCALE, W = R.FW * S, H = R.FH * S;
    const total = Object.values(R.ANIMS).reduce((a, x) => a + x.n, 0);
    const c = G.ART.canvas(W * total, H), ctx = c.getContext('2d');
    const frames = {};
    let i = 0;
    Object.entries(R.ANIMS).forEach(([anim, A]) => {
      frames[anim] = [];
      for (let k = 0; k < A.n; k++) {
        const t = A.loop ? k / A.n : (A.n === 1 ? 1 : k / (A.n - 1));
        ctx.drawImage(R.frame(look, anim, t), i * W, 0);
        frames[anim].push(i * W); i++;
      }
    });
    return { canvas: c, frames, fw: W, fh: H };
  };

  // 目前該顯示哪一格（給戰鬥場景用）：state = { anim, t }，回傳 [動作, 格子編號]
  R.frameAt = function (anim, t) {
    const A = R.ANIMS[anim];
    const k = A.loop ? Math.floor((t / A.dur) % 1 * A.n) : Math.min(A.n - 1, Math.floor(t / A.dur * A.n));
    return k;
  };
})();
