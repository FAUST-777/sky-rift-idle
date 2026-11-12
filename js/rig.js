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

  R.drawPose = function (ctx, look, p) {
    const cls = G.CLASSES[look.cls] || G.CLASSES.villager;
    const hip = [32 + p.dx, 55 + p.dy];
    const neck = rot(hip, p.lean, 0, -24);
    const headC = rot(neck, p.lean + p.head, 1, -10);
    const armC = look.armor ? look.armor.color : '#8b6f47';
    const bootC = look.boots ? look.boots.color : '#4a3424';
    const wp = look.weapon || { type: 'dualsword', color: G.ART.GEAR_COLORS[0] };

    // 腿：大腿 → 小腿 → 靴子（後腿比較暗）
    const leg = (hx, T, K, back) => {
      const h0 = rot(hip, p.lean * 0.3, hx, 1);
      const knee = pt(h0, T, 8.5), ankle = pt(knee, T - K, 8.5);
      const dk = back ? -28 : 0;
      limb(ctx, h0, knee, 6, shade('#4b3a2a', dk));
      limb(ctx, knee, ankle, 5.5, shade('#4b3a2a', dk - 6));
      // 靴子：腳掌往前
      const bc = shade(bootC, dk - 12);
      ctx.fillStyle = bc;
      G.ART.rr(ctx, ankle[0] - 3.5, ankle[1] - 4, 9.5, 6.5, 2); ctx.fill();
      ctx.fillStyle = shade(bc, 25); ctx.fillRect(ankle[0] - 3.5, ankle[1] - 4, 9.5, 1.5);
      if (look.boots && look.boots.v === 1) { ctx.fillStyle = shade(bootC, 40 + dk); ctx.fillRect(ankle[0] - 3.5, ankle[1] - 6, 7.5, 2); }
    };
    // 手：上臂 → 前臂 → 手掌；回傳手的位置
    const arm = (sh, S, E, back) => {
      const elbow = pt(sh, S, 8), hand = pt(elbow, S + E, 8);
      const c = back ? shade(armC, -32) : shade(armC, -8);
      limb(ctx, sh, elbow, 6, c);
      limb(ctx, elbow, hand, 5.5, shade(c, -8));
      ctx.fillStyle = back ? shade(look.skin, -25) : look.skin;
      ctx.beginPath(); ctx.arc(hand[0], hand[1], 3, 0, Math.PI * 2); ctx.fill();
      return hand;
    };
    // 劍：握把在手上，角度 a，長度 L
    const sword = (hand, a, L, back) => {
      const tip = pt(hand, a, L);
      G.ART.blade(ctx, back ? shade(wp.color, -25) : wp.color, hand[0], hand[1], tip[0], tip[1], back ? 2.5 : 3);
      return tip;
    };

    // 1. 披風（掛在脖子，往後飄）
    if (cls.cape) {
      const top = rot(neck, p.lean, -5, 1), sway = p.cape;
      const bl = [top[0] - 12 - sway * 14, top[1] + 33 - sway * 6], br = [top[0] + 4 - sway * 8, top[1] + 34 - sway * 3];
      const g = ctx.createLinearGradient(top[0], top[1], top[0], top[1] + 34);
      g.addColorStop(0, shade(cls.cape, -10)); g.addColorStop(1, shade(cls.cape, -45));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(top[0] - 2, top[1]); ctx.quadraticCurveTo(bl[0] + 2, top[1] + 16, bl[0], bl[1]);
      ctx.lineTo(br[0], br[1]); ctx.quadraticCurveTo(top[0] + 8, top[1] + 16, top[0] + 7, top[1]); ctx.closePath(); ctx.fill();
    }
    // 2. 後腳、後手＋後劍
    leg(-3.5, p.bT, p.bK, true);
    const bSh = rot(neck, p.lean, -6, 4);
    const bHand = arm(bSh, p.bS, p.bE, true);
    if (wp.type === 'dualsword') sword(bHand, p.bW, 22, true);
    // 3. 前腳
    leg(3.5, p.fT, p.fK, false);
    // 4. 軀幹＋鎧甲（沿用紙娃娃畫法，跟著髖部旋轉）
    ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(p.lean); ctx.translate(-32, -55);
    G.ART.drawTorsoGear(ctx, look);
    ctx.restore();
    // 5. 頭＋頭髮＋頭盔
    ctx.save(); ctx.translate(headC[0], headC[1]); ctx.rotate(p.lean + p.head); ctx.translate(-33, -21);
    G.ART.drawHeadGear(ctx, look);
    ctx.restore();
    // 6. 前手＋前劍（揮砍時畫殘影弧線）
    const fSh = rot(neck, p.lean, 7, 4);
    const fHand = arm(fSh, p.fS, p.fE, false);
    if (wp.type === 'dualsword') {
      if (p.slash > 0.05) {
        ctx.save(); ctx.globalAlpha = 0.55 * p.slash;
        const g = ctx.createRadialGradient(fSh[0], fSh[1], 6, fSh[0], fSh[1], 30);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,240,240,.9)'); g.addColorStop(1, shade(cls.color, 40));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(fSh[0], fSh[1], 30, -Math.PI * 0.62, Math.PI * 0.18); ctx.arc(fSh[0], fSh[1], 18, Math.PI * 0.18, -Math.PI * 0.62, true); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      sword(fHand, p.fW, 26, false);
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
