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

  // 第 163 輪起：全部職業（含冒險者）都用骨架畫法
  R.enabled = look => !!look;
  // 攻擊動作類型：dual 雙劍、melee 近戰單手、ranged 遠程（手往前推出）、cast 遠程長柄、gun 雙槍（雙手往前）
  R.style = function (look) {
    const w = look.weapon ? look.weapon.type : '';
    if (w === 'dualsword') return 'dual';
    if (w === 'pistol') return 'gun';
    const C = G.CLASSES[look.cls];
    if (!C || !C.ranged) return 'melee';
    return ['brush', 'scythe', 'axe'].includes(w) ? 'cast' : 'ranged';   // cast：長柄武器往前上方舉（不會超出格子）
  };

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

  R.pose = function (anim, t, style) {
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
    } else if (anim === 'attack' && (style === 'ranged' || style === 'gun' || style === 'cast')) {   // 遠程：手縮回 → 往前推出（施法／開槍）→ 停一下 → 收回
      const g = style === 'gun', up = style === 'cast' ? 0.8 : 0;   // up：長柄武器往上抬的角度
      Object.assign(p, keyed([
        [0.0,  { dx: 0, lean: 0.06, head: 0, fS: 0.55, fE: -1.05, fW: 2.55, bS: 0.5, bE: -0.75, bW: 1.85 }],
        [0.3,  { dx: -1.5, lean: -0.06, head: -0.05, fS: 0.15, fE: -1.7, fW: 2.9 + up * 0.2, bS: g ? 0.2 : 0.5, bE: g ? -1.5 : -0.75, bW: g ? 2.6 : 1.85 }],
        [0.5,  { dx: 2, lean: 0.14, head: 0.06, fS: 1.5, fE: -0.05, fW: 1.6 + up, bS: g ? 1.35 : 0.3, bE: g ? -0.05 : -0.9, bW: g ? 1.65 : 1.85 }],
        [0.75, { dx: 1.5, lean: 0.12, head: 0.05, fS: 1.45, fE: -0.1, fW: 1.65 + up, bS: g ? 1.3 : 0.3, bE: g ? -0.1 : -0.9, bW: g ? 1.7 : 1.85 }],
        [1.0,  { dx: 0, lean: 0.06, head: 0, fS: 0.55, fE: -1.05, fW: 2.55, bS: 0.5, bE: -0.75, bW: 1.85 }],
      ], t));
      p.cape = 0.1 + Math.max(0, p.dx) * 0.03;
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
  //   美術風格（第 161 輪）：日系線上 RPG 的像素小人感覺——約 3.3 頭身、
  //   分層尖刺的蓬鬆頭髮（暗面＋亮面＋髮絲線）、黑點眼睛、衣服鎧甲有明暗兩階、整體偏暖的柔和色調
  const pt = (o, a, L) => [o[0] + Math.sin(a) * L, o[1] + Math.cos(a) * L];
  const rot = (o, a, x, y) => [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)];
  function limb(ctx, a, b, w, color) {
    ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  // 兩階明暗的手腳：先畫暗色整條，再往右上偏一點畫亮色（光從前上方來）
  function limb2(ctx, a, b, w, c) {
    limb(ctx, a, b, w, shade(c, -40));
    limb(ctx, [a[0] + 0.5, a[1] - 0.45], [b[0] + 0.5, b[1] - 0.45], w - 1.9, c);
  }
  const mix = (a, b, k) => {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const ch = s => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
    return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
  };
  const mute = c => mix(c, '#7a6452', 0.22);   // 裝備顏色往暖灰靠一點，比較柔和
  const poly = (ctx, pts) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  // 兩階明暗的色塊：整塊先塗暗色，再把同一塊往右上偏移、塗亮色（剪在原形狀裡）→ 左下留一圈暗面
  function cel(ctx, path, base, dark, ox = 1.1, oy = -1.1) {
    ctx.fillStyle = dark; path(); ctx.fill();
    ctx.save(); path(); ctx.clip(); ctx.translate(ox, oy); ctx.fillStyle = base; path(); ctx.fill(); ctx.restore();
  }
  const strokes = (ctx, color, w, lines) => {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    lines.forEach(l => { ctx.beginPath(); ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); ctx.stroke(); });
  };

  // ── 頭（頭中心 = (0,0)，面向右的 3/4 側臉）─────────────────────────────
  const HAIR_BACK = [[7, -8], [4, -11.5], [-1, -13], [-6, -12], [-10, -9.5], [-15, -9.5], [-11.8, -5.8], [-16, -3.2],
    [-11.8, -0.6], [-15, 3.8], [-10.2, 3], [-12, 8.5], [-6.8, 4.6], [-5.6, 10], [-3, 3], [-1, -2], [3, -5]];
  const HAIR_TOP = [[10.6, -3], [10.2, -8], [6.2, -12.2], [0, -13.8], [-6.2, -12.8], [-10.8, -8.4], [-11.4, -2.4],
    [-9.4, 4], [-6.4, 7.4], [-4.6, 2.4], [-3, -1.2], [0, -4.2], [4, -5.6], [8, -5.2]];
  const HAIR_BANGS = [[-1.2, -4.2], [0.8, -8.4], [5, -9.6], [9.4, -9], [12, -6.4], [12.6, -2.2], [10.6, -3.9],
    [11, 0.4], [8.6, -3.5], [7.5, -1.6], [5.8, -4.3], [3.6, -1.4], [2.8, -4.6], [0.6, 4.6]];
  const HAIR_TUFTS = [[[-3.5, -12.8], [-7.5, -16.2], [-0.5, -13.6]], [[1, -13.6], [3.2, -17.2], [5.6, -12]]];
  // 女生：長髮垂到背上（髮尾分岔）、側分瀏海、臉旁一長撮、一根呆毛
  const F_BACK = [[7, -8], [4, -11.8], [-1, -13.4], [-6.5, -12.5], [-11, -9], [-13.2, -3], [-13.8, 4], [-13.2, 11],
    [-14.8, 18.5], [-10.6, 15.8], [-9.2, 20.8], [-6.2, 16.4], [-3.4, 19.2], [-3, 10], [-2.5, 4], [-1, -2], [3, -5]];
  const F_TOP = [[10.6, -3], [10.4, -8], [6.4, -12.4], [0, -14], [-6.4, -13], [-11, -8.6], [-12, -2], [-11.2, 5],
    [-8, 8.5], [-4.6, 3], [-3, -1.2], [0, -4.2], [4, -5.6], [8, -5.2]];
  const F_BANGS = [[-1.2, -4.2], [1, -8.6], [5.5, -10], [10, -8.8], [12.2, -5.6], [12.4, -1.4], [10.6, -3.2], [9.8, -0.4],
    [8, -4], [5.6, -2.2], [4.4, -5], [2.6, -3.2], [2, -5.2], [0.6, 5], [1.8, 10.8], [-1.2, 9.4]];
  const F_TUFTS = [[[0, -13.6], [2.4, -17.8], [3.6, -13.2]]];

  //   頭盔／頭飾先不畫（第 162 輪：之後另外設計紙娃娃），一律露出完整髮型
  function drawHead(ctx, look) {
    const hair = look.hair || '#5a3a22', skin = look.skin || '#f1c9a0';
    const hD = shade(hair, -42), hL = shade(hair, 48), hDD = shade(hair, -70);
    const skD = shade(skin, -32);

    const fem = look.gender === 'f';
    // 1. 後髮：男生是腦後往後下翹的尖髮束；女生是垂到背上的長髮（最暗）
    ctx.fillStyle = hD; poly(ctx, fem ? F_BACK : HAIR_BACK); ctx.fill();
    strokes(ctx, hDD, 0.8, fem ? [[[-9, -6], [-11.6, 6], [-12.2, 15]], [[-6, -4], [-7.6, 8], [-7, 17]]]
      : [[[-8, -7], [-12, -4.6]], [[-7.5, -2.5], [-12, 1.5]], [[-6.5, 2], [-9.5, 6.5]]]);
    // 2. 臉（下巴往右前收）
    cel(ctx, () => {
      ctx.beginPath(); ctx.ellipse(0.4, 0.2, 9.6, 9.8, 0, 0, Math.PI * 2);
      ctx.moveTo(10, 3.6); ctx.lineTo(8.2, 9); ctx.lineTo(4, 10.6); ctx.lineTo(-3.5, 7); ctx.closePath();   // 跟橢圓同方向，不然重疊處會變破洞
    }, skin, skD, 1.2, -0.6);
    // 3. 頭頂的頭髮（包住頭頂跟後腦，留出臉）＋髮絲分層線
    cel(ctx, () => poly(ctx, fem ? F_TOP : HAIR_TOP), hair, hD, 1.3, -1.3);
    strokes(ctx, hD, 0.75, [[[-2, -11.5], [-7.5, -5], [-8, 1]], [[2.5, -12], [-2.5, -6.5], [-4.5, -0.5]], [[6, -11], [3, -7]]]);
    // 4. 耳朵
    ctx.fillStyle = skD; ctx.beginPath(); ctx.ellipse(-2.9, 2.4, 1.9, 2.6, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-2.5, 2.2, 1.2, 1.9, 0.15, 0, Math.PI * 2); ctx.fill();
    // 5. 眼睛：方形黑點（近眼寬一點、遠眼窄一點）＋淡淡腮紅
    ctx.fillStyle = '#1c1418';
    ctx.fillRect(3.8, 0.4, 2.2, 2.8);
    ctx.fillRect(8.4, 0.3, 1.5, 2.6);
    if (fem) { ctx.fillRect(3.1, -0.1, 1.3, 0.9); ctx.fillRect(8.1, -0.2, 0.9, 0.8); }   // 女生：眼角一點睫毛
    ctx.fillStyle = 'rgba(235,110,100,.22)';
    ctx.beginPath(); ctx.ellipse(4.2, 5.4, 2, 1, 0, 0, Math.PI * 2); ctx.fill();
    // 6. 瀏海＋翹毛＋亮面
    cel(ctx, () => poly(ctx, fem ? F_BANGS : HAIR_BANGS), hair, hD, 1, -1);
    strokes(ctx, hD, 0.7, fem ? [[[5.5, -9], [5.4, -3]], [[9.5, -8.4], [9.6, -2]], [[1.8, -7], [1.2, 8]]]
      : [[[5, -8.6], [5.6, -4.6]], [[9, -8.2], [8.8, -4]], [[1.8, -7], [1.6, 1]]]);
    (fem ? F_TUFTS : HAIR_TUFTS).forEach(t => cel(ctx, () => poly(ctx, t), hair, hD, 0.7, -0.7));
    ctx.fillStyle = hL;
    poly(ctx, [[-7, -9.6], [-3, -12], [-2.2, -11.2], [-6.2, -8.8]]); ctx.fill();
    poly(ctx, [[0.5, -12.2], [5, -11.2], [4.5, -10.3], [0.6, -11.2]]); ctx.fill();
    poly(ctx, [[7.5, -8.4], [10.4, -7.2], [10.1, -6.4], [7.6, -7.5]]); ctx.fill();
    poly(ctx, [[2.6, -8], [4.4, -8.4], [4, -7.6], [2.8, -7.3]]); ctx.fill();
  }

  // ── 軀幹（髖部 = (0,0)，往上約 24；跟著身體前傾旋轉）──────────────────────
  const STEEL = '#9097a0';
  function drawTorso(ctx, look, cls) {
    const ar = look.armor, v = ar ? ar.v : 0;
    const tc = ar ? mute(ar.color) : '#8b6f47', tD = shade(tc, -40);
    const skin = look.skin || '#f1c9a0';
    // 脖子
    ctx.fillStyle = shade(skin, -30); ctx.fillRect(-2.4, -28.5, 5, 6);
    // 下擺（皮帶以下，蓋住大腿上半）
    const fem = look.gender === 'f';
    const skirt = () => poly(ctx, fem ? [[-8.6, -4.5], [9.4, -4.5], [12.6, 8.2], [5, 9.6], [2.2, 6.2], [-0.6, 9.6], [-11.6, 8.2]]
      : [[-8.6, -4.5], [9.4, -4.5], [11.2, 5], [4.6, 6.6], [2.2, 3.2], [-0.4, 6.6], [-10.2, 5.2]]);
    if (v === 1) cel(ctx, skirt, STEEL, shade(STEEL, -40));
    else if (v === 2) cel(ctx, skirt, shade(tc, -10), shade(tc, -50));
    else cel(ctx, skirt, shade(tc, -16), shade(tc, -52));
    // 上衣／胸甲
    const body = fem
      ? () => { ctx.beginPath(); ctx.moveTo(-7, -23.4); ctx.quadraticCurveTo(1, -25.8, 9, -22.8);
          ctx.lineTo(9.8, -15.5); ctx.lineTo(7.8, -9); ctx.lineTo(8.8, -5.5); ctx.lineTo(-7.8, -5.5); ctx.lineTo(-7.4, -9); ctx.lineTo(-8.6, -15.5); ctx.closePath(); }
      : () => { ctx.beginPath(); ctx.moveTo(-7.6, -23.4); ctx.quadraticCurveTo(1, -26, 9.6, -22.8);
          ctx.lineTo(10.2, -14.5); ctx.lineTo(8.6, -5.5); ctx.lineTo(-7.6, -5.5); ctx.lineTo(-9.2, -14.5); ctx.closePath(); };
    if (v === 0) {                         // 布衣：V 領、綁帶、衣褶
      cel(ctx, body, tc, tD, 1.4, -1);
      ctx.fillStyle = '#e9dcc0'; poly(ctx, [[-1.6, -24.6], [3.2, -18], [7.4, -24.2]]); ctx.fill();
      ctx.fillStyle = shade(tc, 30); poly(ctx, [[-2.6, -24.6], [3.2, -16.6], [3.2, -18], [-1.6, -24.6]]); ctx.fill();
      strokes(ctx, tD, 0.8, [[[-4.5, -19], [-5.2, -8]], [[6.8, -14], [7.4, -8]]]);
      strokes(ctx, shade(tc, 45), 0.6, [[[2.4, -16], [4, -15]], [[2.4, -13.5], [4, -12.5]], [[2.4, -11], [4, -10]]]);
    } else if (v === 1) {                  // 鎖甲＋前面一片罩袍
      cel(ctx, body, STEEL, shade(STEEL, -42), 1.4, -1);
      ctx.strokeStyle = shade(STEEL, -30); ctx.lineWidth = 0.55;
      for (let y = -22; y < -6; y += 2.2) for (let x = -7 + ((y * 10 | 0) % 2 ? 1.1 : 0); x < 9; x += 2.2) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI); ctx.stroke(); }
      cel(ctx, () => poly(ctx, [[-1.5, -24.6], [7.6, -24], [8.4, -5.5], [-2, -5.5]]), tc, tD, 1.1, -0.8);
      ctx.fillStyle = shade(tc, 55); ctx.fillRect(2.4, -20.5, 1.6, 8); ctx.fillRect(0, -18, 6.4, 1.6);
      cel(ctx, () => poly(ctx, [[-0.4, -4.5], [7.8, -4.5], [8.4, 6], [0.4, 6]]), tc, tD, 0.8, -0.6);
    } else {                               // 板甲：胸甲反光、下緣甲片、腿前甲片
      cel(ctx, body, tc, tD, 1.6, -1.2);
      ctx.fillStyle = shade(tc, 50); poly(ctx, [[3.8, -23.6], [6.8, -23.4], [7.6, -12], [5, -10.5]]); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(5.8, -20, 1, 1.8, 0.2, 0, Math.PI * 2); ctx.fill();
      strokes(ctx, tD, 0.8, [[[-8, -11], [-2, -9.6], [9.6, -11.4]]]);
      [[-8.2, 9.2, -1.5], [-9, 10.6, 2]].forEach(([x0, x1, y]) => cel(ctx, () => poly(ctx, [[x0, y - 3], [x1, y - 3], [x1 + 0.6, y + 1], [x0 - 0.6, y + 1]]), shade(tc, -6), shade(tc, -48), 0.5, -0.5));
    }
    // 皮帶＋扣環
    cel(ctx, () => poly(ctx, [[-8, -7], [9, -7], [9.2, -4], [-8.2, -4]]), '#5a3a26', '#2e1c14', 0.4, -0.6);
    cel(ctx, () => poly(ctx, [[4, -7.6], [7.6, -7.6], [7.6, -3.4], [4, -3.4]]), '#e0b850', '#9a7228', 0.5, -0.5);
    // 飾品：胸前墜子
    if (look.accessory) {
      strokes(ctx, '#d8b04a', 0.6, [[[-1.6, -24.4], [2.6, -19.6], [7, -24]]]);
      const ac = look.accessory.color;
      cel(ctx, () => poly(ctx, [[2.6, -20.4], [4.4, -18.4], [2.6, -16.2], [0.8, -18.4]]), ac, shade(ac, -50), 0.5, -0.5);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(2.2, -19.4, 0.8, 0.8);
    }
  }

  // 肩甲（鎖甲小、板甲大兩層）
  function pauldron(ctx, look, sh, lean, back) {
    const ar = look.armor; if (!ar || ar.v === 0) return;
    let c = ar.v === 1 ? STEEL : mute(ar.color);
    if (back) c = shade(c, -30);
    const big = ar.v === 2;
    ctx.save(); ctx.translate(sh[0], sh[1]); ctx.rotate(lean);
    cel(ctx, () => { ctx.beginPath(); ctx.ellipse(0.6, big ? 0.6 : 0.4, big ? 5.6 : 4, big ? 4.6 : 3.4, 0, Math.PI * 1.05, Math.PI * 1.95 + 0.0001); ctx.lineTo(big ? 5.6 : 4, big ? 3.4 : 2.4); ctx.lineTo(big ? -4.6 : -3.4, big ? 3.4 : 2.4); ctx.closePath(); }, c, shade(c, -45), 0.8, -0.8);
    if (big) {
      cel(ctx, () => poly(ctx, [[-4.4, 3], [5.8, 3], [5.2, 5.6], [-3.8, 5.6]]), shade(c, -8), shade(c, -50), 0.5, -0.5);
      ctx.fillStyle = shade(c, 50); poly(ctx, [[-1, -3.4], [3, -3.6], [3.2, -2.7], [-0.8, -2.5]]); ctx.fill();
    }
    ctx.restore();
  }


  // ── 武器（每個職業固定一種）：hand = 手的位置、a = 武器角度（0 往下、π 往上）、back = 後手 ──
  //   along()：把座標轉成「+y 沿著武器往前端、-x 是武器朝前／朝下的那一側」
  function along(ctx, hand, a, fn) { ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-a); fn(); ctx.restore(); }
  function drawWeapon(ctx, wp, hand, a, back, p, hip) {
    const t = wp.type, wc = back ? shade(wp.color, -25) : wp.color;
    const wood = '#6b4a2a';
    if (back) {                              // 後手只有雙劍、雙槍會拿東西
      if (t === 'dualsword') { const tip = pt(hand, a, 22); G.ART.blade(ctx, wc, hand[0], hand[1], tip[0], tip[1], 2.5); }
      else if (t === 'pistol') along(ctx, hand, a, () => gun(ctx, wc));
      return;
    }
    if (t === 'dualsword') { const tip = pt(hand, a, 26); G.ART.blade(ctx, wc, hand[0], hand[1], tip[0], tip[1], 3); }
    else if (t === 'longsword') {            // 貓鎧者：長劍
      const tip = pt(hand, a, 31); G.ART.blade(ctx, wc, hand[0], hand[1], tip[0], tip[1], 3.8);
      along(ctx, hand, a, () => { ctx.fillStyle = wc; ctx.beginPath(); ctx.arc(0, -5, 1.8, 0, Math.PI * 2); ctx.fill(); });
    } else if (t === 'pistol') along(ctx, hand, a, () => gun(ctx, wc));
    else along(ctx, hand, a, () => {
      if (t === 'axe') {                     // 德魯伊：斧頭＋藤蔓
        limb(ctx, [0, -5], [0, 24], 2.6, wood);
        cel(ctx, () => poly(ctx, [[-1, 15], [-8, 12], [-11, 18], [-8, 25], [-1, 22]]), shade(wc, 40), shade(wc, -10), -0.6, 0.6);
        strokes(ctx, '#4f8a4a', 1.2, [[[0.8, 2], [-1.4, 6], [1.2, 10], [-1.2, 14]]]);
      } else if (t === 'scythe') {           // 死靈術師：鐮刀（刀刃顏色 = 稀有度）
        limb(ctx, [0, -10], [0, 30], 2.6, '#3a2f2a');
        cel(ctx, () => { ctx.beginPath(); ctx.moveTo(0, 29.5); ctx.quadraticCurveTo(14, 34, 21, 21); ctx.quadraticCurveTo(12, 27.5, 0, 25.5); ctx.closePath(); },
          shade(wc, 60), shade(wc, 10), 0.5, 0.6);
        ctx.fillStyle = '#9dff9d'; ctx.shadowColor = '#7dff9a'; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(0, 30, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      } else if (t === 'brush') {            // 暗黑畫家：大畫筆
        limb(ctx, [0, -4], [0, 22], 2.6, wood);
        ctx.fillStyle = shade(wc, 20); ctx.fillRect(-2.2, 21.5, 4.4, 3.2);
        cel(ctx, () => { ctx.beginPath(); ctx.moveTo(-2.6, 24.5); ctx.quadraticCurveTo(0, 35, 2.6, 24.5); ctx.closePath(); }, '#8a4fd0', '#4a2480', -0.5, 0.5);
      } else if (t === 'tower') {            // 城牆者：大塔盾（擋在身前）
        ctx.rotate(a + p.lean * 0.5);        // 盾牌大致保持直立
        cel(ctx, () => { G.ART.rr(ctx, -4, -16, 15, 30, 3); }, shade(mute(wc), 10), shade(mute(wc), -40), 1, -1);
        ctx.fillStyle = shade(mute(wc), 55); ctx.fillRect(2, -12, 3, 22); ctx.fillRect(-1.5, -4, 10, 3);
      } else if (t === 'openbook') {         // 學者：打開的書
        ctx.rotate(a + p.lean * 0.5 - 0.15);
        ctx.fillStyle = shade(wc, -25); poly(ctx, [[-5, -6], [3, -3.5], [11, -6], [11, 4], [3, 6.5], [-5, 4]]); ctx.fill();
        ctx.fillStyle = '#f3ead2';
        poly(ctx, [[-4, -7], [3, -4.5], [3, 5], [-4, 3]]); ctx.fill();
        poly(ctx, [[10, -7], [3, -4.5], [3, 5], [10, 3]]); ctx.fill();
        strokes(ctx, '#9a8c70', 0.6, [0, 1, 2].flatMap(i => [[[-2.6, -4 + i * 2.3], [1.6, -2.4 + i * 2.3]], [[4.4, -2.4 + i * 2.3], [8.6, -4 + i * 2.3]]]));
      } else if (t === 'spyglass') {         // 飛船船長：黃銅望遠鏡（環 = 稀有度）
        cel(ctx, () => G.ART.rr(ctx, -2.4, -2, 4.8, 13, 1.5), '#c8963b', '#7a5420', 0.5, 0.5);
        cel(ctx, () => G.ART.rr(ctx, -3.1, 10, 6.2, 7, 1.5), '#e0b04a', '#8a6024', 0.5, 0.5);
        ctx.fillStyle = wc; ctx.fillRect(-2.4, 3, 4.8, 1.6); ctx.fillRect(-3.1, 12, 6.2, 1.6);
        ctx.fillStyle = '#9fd8ff'; ctx.fillRect(-2.4, 16.4, 4.8, 1);
      } else if (t === 'briefcase') {        // 對沖基金經理人：公事包（往下垂）
        ctx.rotate(a);                       // 不跟著手轉，永遠往下掛
        strokes(ctx, '#2a1d14', 1.2, [[[-2.5, 3], [-2.5, 0], [2.5, 0], [2.5, 3]]]);
        cel(ctx, () => G.ART.rr(ctx, -8, 3, 16, 11, 1.6), '#6a442a', '#3a2416', 0.8, -0.8);
        ctx.fillStyle = '#3e2716'; ctx.fillRect(-8, 7.5, 16, 1.2);
        ctx.fillStyle = wc; ctx.fillRect(-1.5, 6.5, 3, 3.4);
      } else if (t === 'dumbbell') {         // 健身者：啞鈴（跟手臂垂直）
        limb(ctx, [-5.5, 0.5], [5.5, 0.5], 1.8, '#666');
        cel(ctx, () => { ctx.beginPath(); ctx.rect(-8, -3.2, 3.4, 7.4); ctx.rect(4.6, -3.2, 3.4, 7.4); }, shade(wc, -20), shade(wc, -60), 0.5, -0.5);
      } else if (t === 'claw') {             // 美甲師：三爪拳刃，爪尖是亮粉色指甲
        cel(ctx, () => G.ART.rr(ctx, -3.4, -1.5, 6.8, 6.5, 1.5), shade(wc, 20), shade(wc, -30), 0.5, 0.5);
        [-2.4, 0, 2.4].forEach(x => {
          strokes(ctx, '#d8dde6', 1.5, [[[x, 4.5], [x * 1.3 - 0.8, 10], [x * 1.5 - 2.4, 14]]]);
          ctx.fillStyle = '#ff5fae'; ctx.beginPath(); ctx.arc(x * 1.5 - 2.4, 14, 1.3, 0, Math.PI * 2); ctx.fill();
        });
      } else if (t === 'leash') {            // 遛狗者：牽繩（狗另外畫）
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); ctx.fill();
      } else {                               // 冒險者：草叉
        limb(ctx, [0, -6], [0, 25], 2.4, '#8a6a3a');
        strokes(ctx, '#a0a4aa', 1.3, [[[-4, 25], [4, 25]], [[-4, 25], [-4, 32]], [[0, 25], [0, 33]], [[4, 25], [4, 32]]]);
      }
    });
    if (t === 'leash') drawDog(ctx, hand, p, hip);
  }
  // 雙槍的一把：槍管沿著武器方向，握把往下
  function gun(ctx, wc) {
    cel(ctx, () => poly(ctx, [[0.8, -1.5], [-5, -3.2], [-5.6, -0.4], [-1.2, 2.2]]), '#6a4426', '#3a2414', -0.4, 0.4);
    cel(ctx, () => { ctx.beginPath(); ctx.rect(-1.5, -1, 3, 12); }, shade(wc, 25), shade(wc, -25), 0.5, 0.5);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(-1.5, 10, 3, 1.2);
  }
  // 遛狗者的狗：站在主人前面，牽繩從手拉到項圈
  function drawDog(ctx, hand, p, hip) {
    const x = hip[0] + 18 - p.dx * 0.3, y = 70.5 + Math.abs(p.dy) * 0.4, dc = '#b9874f', dD = shade(dc, -40);
    strokes(ctx, '#c0392b', 1.1, [[hand, [(hand[0] + x + 6) / 2, Math.max(hand[1], y - 6) + 4], [x + 6, y - 6]]]);
    ctx.fillStyle = dD; ctx.fillRect(x - 3.5, y - 2, 2.4, 6); ctx.fillRect(x + 4, y - 2, 2.4, 6);   // 後面兩隻腳
    strokes(ctx, dc, 1.8, [[[x - 5, y - 4], [x - 8, y - 9]]]);                                 // 尾巴
    cel(ctx, () => G.ART.rr(ctx, -6 + x, y - 8, 13, 7, 3), dc, dD, 0.8, -0.8);                // 身體
    ctx.fillStyle = dc; ctx.fillRect(x - 2, y - 2, 2.4, 6); ctx.fillRect(x + 5, y - 2, 2.4, 6);
    cel(ctx, () => { ctx.beginPath(); ctx.ellipse(x + 9, y - 9, 4.4, 4, 0, 0, Math.PI * 2); ctx.rect(x + 10, y - 9, 4.4, 3.2); }, dc, dD, 0.6, -0.6);
    ctx.fillStyle = dD; ctx.beginPath(); ctx.ellipse(x + 6.4, y - 9.6, 1.7, 3.3, 0.4, 0, Math.PI * 2); ctx.fill();   // 耳朵
    ctx.fillStyle = '#1c1418'; ctx.fillRect(x + 10, y - 11, 1.4, 1.6); ctx.fillRect(x + 13.6, y - 9, 1.4, 1.3);   // 眼睛、鼻子
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x + 5.6, y - 8, 1.8, 4);                           // 項圈
  }

  R.drawPose = function (ctx, look, p) {
    const cls = G.CLASSES[look.cls] || G.CLASSES.villager;
    const hip = [32 + p.dx, 55 + p.dy];
    const neck = rot(hip, p.lean, 0, -24);
    const headC = rot(neck, p.lean + p.head, 1, -10);
    const ar = look.armor, av = ar ? ar.v : 0;
    const tc = ar ? mute(ar.color) : '#8b6f47';
    const sleeve = av === 1 ? STEEL : av === 2 ? '#5a5560' : tc;   // 上臂：布衣同色、鎖甲鋼色、板甲深色內襯
    const fore = av === 2 ? tc : sleeve;                           // 前臂：板甲換成護臂
    const pants = '#4e3d30';
    const bootC = look.boots ? mute(look.boots.color) : '#5e4230';
    const wp = look.weapon || { type: 'dualsword', color: G.ART.GEAR_COLORS[0] };

    // 腿：褲子大腿 → 長靴（小腿）→ 腳掌；後腿整條暗一階
    const leg = (hx, T, K, back) => {
      const dk = back ? -30 : 0;
      const h0 = rot(hip, p.lean * 0.3, hx, 1);
      const knee = pt(h0, T, 8.5), ankle = pt(knee, T - K, 8.5);
      limb2(ctx, h0, knee, 6.2, shade(pants, dk));
      const bc = shade(bootC, dk);
      const kb = [knee[0] + (ankle[0] - knee[0]) * 0.18, knee[1] + (ankle[1] - knee[1]) * 0.18];
      limb2(ctx, kb, ankle, 6, bc);
      // 靴筒翻邊
      const cuffC = look.boots && look.boots.v === 1 ? shade(bc, 45) : shade(bc, 22);
      limb(ctx, [kb[0] - Math.cos(T - K) * 3.2, kb[1] + Math.sin(T - K) * 3.2], [kb[0] + Math.cos(T - K) * 3.2, kb[1] - Math.sin(T - K) * 3.2], 2.2, cuffC);
      // 腳掌（往前）＋鞋底
      cel(ctx, () => poly(ctx, [[ankle[0] - 3.2, ankle[1] - 3], [ankle[0] + 2.6, ankle[1] - 3], [ankle[0] + 6.8, ankle[1] - 0.4], [ankle[0] + 7.2, ankle[1] + 2.4], [ankle[0] - 3.4, ankle[1] + 2.4]]), bc, shade(bc, -40), 0.8, -0.8);
      ctx.fillStyle = shade(bc, -60); ctx.fillRect(ankle[0] - 3.4, ankle[1] + 1.4, 10.6, 1.1);
      if (look.boots && look.boots.v === 1) {   // 金屬靴：膝蓋護片
        cel(ctx, () => { ctx.beginPath(); ctx.arc(knee[0], knee[1], 3.1, 0, Math.PI * 2); }, shade(bc, 18), shade(bc, -35), 0.6, -0.6);
      }
    };
    // 手：袖子 → 前臂 → 手套；回傳手的位置
    const arm = (sh, S, E, back) => {
      const dk = back ? -30 : 0;
      const elbow = pt(sh, S, 8), hand = pt(elbow, S + E, 8);
      limb2(ctx, sh, elbow, 6.2, shade(sleeve, dk));
      limb2(ctx, elbow, hand, 5.6, shade(fore, dk));
      const gl = shade('#6e4c34', dk);
      cel(ctx, () => { ctx.beginPath(); ctx.arc(hand[0], hand[1], 2.9, 0, Math.PI * 2); }, gl, shade(gl, -40), 0.6, -0.6);
      return hand;
    };

    // 1. 披風（掛在脖子，往後飄；有兩條布褶）
    if (cls.cape) {
      const top = rot(neck, p.lean, -5, 1), sway = p.cape;
      const bl = [top[0] - 12 - sway * 14, top[1] + 33 - sway * 6], br = [top[0] + 4 - sway * 8, top[1] + 34 - sway * 3];
      const capeC = mute(cls.cape);
      const path = () => { ctx.beginPath(); ctx.moveTo(top[0] - 2, top[1]); ctx.quadraticCurveTo(bl[0] + 2, top[1] + 16, bl[0], bl[1]);
        ctx.lineTo((bl[0] * 2 + br[0]) / 3, (bl[1] * 2 + br[1]) / 3 - 2.5); ctx.lineTo((bl[0] + br[0] * 2) / 3, (bl[1] + br[1] * 2) / 3 + 0.5);
        ctx.lineTo(br[0], br[1]); ctx.quadraticCurveTo(top[0] + 8, top[1] + 16, top[0] + 7, top[1]); ctx.closePath(); };
      cel(ctx, path, shade(capeC, -6), shade(capeC, -45), 2.2, -0.6);
      const m = (k, s) => [top[0] + (bl[0] + (br[0] - bl[0]) * s - top[0]) * k, top[1] + (bl[1] + (br[1] - bl[1]) * s - top[1]) * k];
      strokes(ctx, shade(capeC, -55), 0.9, [[m(0.25, 0.3), m(0.95, 0.3)], [m(0.35, 0.65), m(0.92, 0.65)]]);
    }
    // 2. 後腳、後手＋後肩甲＋後劍
    leg(-3.5, p.bT, p.bK, true);
    const bSh = rot(neck, p.lean, -6, 4);
    const bHand = arm(bSh, p.bS, p.bE, true);
    pauldron(ctx, look, bSh, p.lean, true);
    drawWeapon(ctx, wp, bHand, p.bW, true, p, hip);
    // 3. 前腳
    leg(3.5, p.fT, p.fK, false);
    // 4. 軀幹＋鎧甲（跟著髖部旋轉）
    ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(p.lean);
    drawTorso(ctx, look, cls);
    ctx.restore();
    // 5. 頭＋頭髮＋頭盔
    ctx.save(); ctx.translate(headC[0], headC[1]); ctx.rotate(p.lean + p.head);
    ctx.translate(0, 0.4); ctx.scale(0.94, 0.94);   // 頭比原本小一點（第 162 輪）
    drawHead(ctx, look);
    ctx.restore();
    // 6. 前手＋前肩甲＋前劍（揮砍時畫殘影弧線）
    const fSh = rot(neck, p.lean, 7, 4);
    const fHand = arm(fSh, p.fS, p.fE, false);
    pauldron(ctx, look, fSh, p.lean, false);
    const style = R.style(look);
    if (style === 'dual' || style === 'melee') {
      if (p.slash > 0.05) {
        ctx.save(); ctx.globalAlpha = 0.55 * p.slash;
        const g = ctx.createRadialGradient(fSh[0], fSh[1], 6, fSh[0], fSh[1], 30);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,240,240,.9)'); g.addColorStop(1, shade(cls.color, 40));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(fSh[0], fSh[1], 30, -Math.PI * 0.62, Math.PI * 0.18); ctx.arc(fSh[0], fSh[1], 18, Math.PI * 0.18, -Math.PI * 0.62, true); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    drawWeapon(ctx, wp, fHand, p.fW, false, p, hip);
  };

  // ── 一格：加影子、畫姿勢、自動描邊 ──────────────────────────────────────
  // 回傳畫好的 canvas（FW×FH 單位 × SCALE）
  R.frame = function (look, anim, t, scale) {
    const S = scale || R.SCALE, W = R.FW * S, H = R.FH * S;
    const style = R.style(look);
    const fig = G.ART.canvas(W, H), f = fig.getContext('2d');
    f.save(); f.scale(S, S); f.translate(R.PAD_X, R.PAD_TOP);
    R.drawPose(f, look, R.pose(anim, t, style));
    f.restore();
    // 描邊：把人物剪影往 8 個方向偏移、塗深色，墊在下面
    const sil = G.ART.canvas(W, H), s = sil.getContext('2d');
    s.drawImage(fig, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#1a1020'; s.fillRect(0, 0, W, H);
    const out = G.ART.canvas(W, H), o = out.getContext('2d');
    // 影子（不描邊）
    const p = R.pose(anim, t, style);
    o.fillStyle = 'rgba(0,0,0,.25)';
    o.beginPath(); o.ellipse((32 + R.PAD_X + p.dx * 0.5) * S, (76 + R.PAD_TOP) * S, (anim === 'dead' ? 20 : 16) * S, 4 * S, 0, 0, Math.PI * 2); o.fill();
    const d = 1.1 * S / 2 + 0.5;
    [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, y]) => o.drawImage(sil, x * d, y * d));
    o.drawImage(fig, 0, 0);
    return out;
  };

  // 選單裡的紙娃娃：高解析度的待機第一格（同樣外觀只畫一次）
  const dollCache = new Map();
  R.DOLL_SCALE = 6;
  R.doll = function (look) {
    const key = JSON.stringify(look);
    if (!dollCache.has(key)) {
      if (dollCache.size > 40) dollCache.delete(dollCache.keys().next().value);
      dollCache.set(key, R.frame(look, 'idle', 0, R.DOLL_SCALE));
    }
    return dollCache.get(key);
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
