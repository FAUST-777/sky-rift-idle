// ════════════════════════════════════════════════════════════════════════════
// 暫代美術：全部用 Canvas 2D 程式畫（戰鬥場景與選單共用同一套畫法）
// 之後換成自己畫的圖：在 assets/manifest.js 登記圖片，見 README
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const A = G.ART = {};

  A.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  A.shade = shade;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // 稀有度對應的裝備顏色（紙娃娃用）
  const GEAR_COLORS = ['#8d8478', '#4f9d57', '#3f7fd0', '#8a4fd0', '#e0a030'];

  // ── 人物外觀資料：由職業 + 裝備組成 ──────────────────────────────────────
  // 把裝備欄轉成外觀；沒穿的部位用 fallback（夥伴的職業預設裝扮）
  function gearLook(e, fb = {}) {
    return {
      weapon: e.weapon ? { type: e.weapon.look, color: GEAR_COLORS[e.weapon.rarity] } : fb.weapon || null,
      helmet: e.helmet ? { v: e.helmet.look, color: GEAR_COLORS[e.helmet.rarity] } : fb.helmet || null,
      armor:  e.armor  ? { v: e.armor.look,  color: GEAR_COLORS[e.armor.rarity] } : fb.armor || null,
      boots:  e.boots  ? { v: e.boots.look,  color: GEAR_COLORS[e.boots.rarity] } : fb.boots || null,
      accessory: e.accessory ? { color: GEAR_COLORS[e.accessory.rarity] } : null,
    };
  }
  // 貓鎧者：永遠是全身鎧甲＋貓耳全罩頭盔（顏色跟著裝備稀有度），沒武器就空手（小貓是武器）
  function catKnightLook(look) {
    const steel = '#9aa3ad';
    look.helmet = { v: 3, color: look.helmet ? look.helmet.color : steel };
    look.armor  = { v: 2, color: look.armor ? look.armor.color : steel };
    look.boots  = { v: 1, color: look.boots ? look.boots.color : steel };
    if (!look.weapon) look.weapon = { type: 'none' };
    return look;
  }

  // 職業招牌外觀：沒裝武器時拿職業武器；沒戴頭盔時戴職業頭飾
  // 頭飾 v：1 鐵盔 2 兜帽 3 貓耳全罩 4 三角海盜帽 5 學士帽 6 貝雷帽 7 頭帶
  const CLASS_HEAD = {
    pirate: { v: 4, color: '#2b2b2b' }, scholar: { v: 5, color: '#24304a' }, darkpainter: { v: 6, color: '#3a2450' },
    druid: { v: 2, color: '#3f6b3a' }, wallbringer: { v: 1, color: '#8a8f99' }, gymgoer: { v: 7, color: '#e04040' },
  };
  function classLook(look, tier) {
    const C = G.CLASSES[look.cls] || {};
    if (look.cls === 'catknight') return catKnightLook(look);
    if (!look.weapon && C.weapon) look.weapon = { type: C.weapon, color: GEAR_COLORS[tier || 0] };
    if (!look.helmet && CLASS_HEAD[look.cls]) look.helmet = CLASS_HEAD[look.cls];
    if (!look.armor && look.cls !== 'villager') look.armor = { v: look.cls === 'wallbringer' ? 2 : 0, color: C.color };
    return look;
  }

  A.lookFromHero = function () {
    const S = G.S;
    return classLook(Object.assign({ skin: S.hero.skin, hair: S.hero.hair, cls: S.hero.cls }, gearLook(S.equipped)), 0);
  };
  // 夥伴：穿上的裝備優先，沒穿的部位用職業預設裝扮
  A.lookFromPartner = function (id) {
    const def = G.PARTNERS.find(p => p.id === id), p = G.S.partners[id];
    const tier = Math.min(4, Math.floor(p.level / 8));
    const look = Object.assign({ skin: def.skin, hair: def.hair, cls: p.cls }, gearLook(p.equipped || {}, { boots: { v: 0, color: '#5b4632' } }));
    return classLook(look, tier);
  };

  // ── 紙娃娃：64×80 一格，面向右，分層畫 ───────────────────────────────────
  // 圖層順序：影子 → 披風 → 腿/靴 → 後手 → 身體/鎧甲 → 頭/頭髮/頭盔 → 前手 → 武器
  A.drawHumanoid = function (ctx, look, ox = 0, oy = 0, s = 1) {
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(s, s);
    const cls = G.CLASSES[look.cls] || G.CLASSES.villager;

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(32, 76, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

    // 披風（職業色）
    if (cls.cape) {
      ctx.fillStyle = shade(cls.cape, -20);
      ctx.beginPath(); ctx.moveTo(25, 31); ctx.lineTo(15, 66); ctx.lineTo(36, 64); ctx.lineTo(38, 31); ctx.closePath(); ctx.fill();
    }

    // 腿
    ctx.fillStyle = '#4b3a2a';
    ctx.fillRect(26, 56, 6, 14); ctx.fillRect(34, 56, 6, 14);
    // 靴子
    const bc = look.boots ? look.boots.color : '#4a3424';
    ctx.fillStyle = shade(bc, -15);
    rr(ctx, 25, 66, 8, 8, 2); ctx.fill();
    rr(ctx, 33, 66, 10, 8, 2); ctx.fill();
    if (look.boots && look.boots.v === 1) { ctx.fillStyle = shade(bc, 40); ctx.fillRect(25, 65, 8, 2); ctx.fillRect(33, 65, 10, 2); }

    // 後手
    ctx.fillStyle = look.armor ? shade(look.armor.color, -30) : '#7a6040';
    rr(ctx, 21, 34, 6, 17, 3); ctx.fill();

    // 身體 / 鎧甲
    const tc = look.armor ? look.armor.color : cls.color === '#f1e3a6' ? '#e9e1c4' : '#8b6f47';
    ctx.fillStyle = tc;
    rr(ctx, 23, 31, 20, 27, 5); ctx.fill();
    if (look.armor && look.armor.v === 1) {            // 鎖甲：點點紋
      ctx.fillStyle = shade(tc, 40);
      for (let y = 34; y < 56; y += 4) for (let x = 26 + (y % 8 ? 2 : 0); x < 41; x += 4) ctx.fillRect(x, y, 1.5, 1.5);
    } else if (look.armor && look.armor.v === 2) {     // 板甲：肩甲 + 胸甲線
      ctx.fillStyle = shade(tc, 35);
      ctx.beginPath(); ctx.arc(25, 34, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(41, 34, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = shade(tc, -40); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(33, 36); ctx.lineTo(33, 54); ctx.stroke();
    } else {                                           // 布衣：腰帶
      ctx.fillStyle = shade(tc, -45);
      ctx.fillRect(23, 49, 20, 3);
    }
    // 飾品：胸前小寶石
    if (look.accessory) {
      ctx.fillStyle = look.accessory.color;
      ctx.beginPath(); ctx.arc(33, 39, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // 頭
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.arc(33, 21, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1d14';
    ctx.fillRect(37, 19, 2, 3);

    // 頭髮 / 頭盔
    const hm = look.helmet;
    if (!hm || [0, 4, 6, 7].includes(hm.v)) {   // 帽子類露出頭髮；鐵盔/兜帽/全罩/學士帽蓋住
      ctx.fillStyle = look.hair;
      ctx.beginPath(); ctx.arc(32, 18, 10, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      ctx.fillRect(22, 17, 5, 9);
    }
    if (hm) {
      ctx.fillStyle = hm.color;
      if (hm.v === 0) {          // 皮帽
        ctx.beginPath(); ctx.arc(33, 16, 10, Math.PI, 0); ctx.fill();
        ctx.fillStyle = shade(hm.color, -30); ctx.fillRect(21, 15, 25, 3);
      } else if (hm.v === 1) {   // 鐵盔：包住上半顆頭 + 鼻樑護片
        ctx.beginPath(); ctx.arc(33, 20, 11.5, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
        ctx.fillRect(21, 18, 5, 10);
        ctx.fillStyle = shade(hm.color, 50); ctx.fillRect(36, 18, 2.5, 8);
        ctx.fillStyle = shade(hm.color, -30); ctx.fillRect(22, 19, 23, 2);
      } else if (hm.v === 3) {   // 貓鎧者：全罩頭盔＋貓耳，只露出發光的眼縫
        ctx.beginPath(); ctx.arc(33, 21, 11.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(24, 14); ctx.lineTo(25, 3); ctx.lineTo(31, 11); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(35, 11); ctx.lineTo(41, 3); ctx.lineTo(42, 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2a7b8';
        ctx.beginPath(); ctx.moveTo(26, 12); ctx.lineTo(26.5, 6.5); ctx.lineTo(29.5, 11); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(37, 11); ctx.lineTo(40, 6.5); ctx.lineTo(40.5, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(hm.color, -55); ctx.fillRect(28, 19, 15, 4);
        ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 5;
        ctx.fillRect(34, 20, 2.5, 2); ctx.fillRect(39, 20, 2.5, 2); ctx.shadowBlur = 0;
        ctx.fillStyle = shade(hm.color, 35);   // 胸口的發射艙門
        ctx.fillRect(27, 36, 4, 3); ctx.fillRect(35, 36, 4, 3); ctx.fillRect(31, 44, 4, 3);
      } else if (hm.v === 4) {   // 海盜三角帽
        ctx.beginPath(); ctx.moveTo(17, 15); ctx.quadraticCurveTo(33, 4, 49, 15); ctx.quadraticCurveTo(33, 11, 17, 15); ctx.fill();
        ctx.beginPath(); ctx.arc(33, 13, 9, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#d4a017'; ctx.fillRect(29, 9, 6, 2);
        ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(32, 9, 1.8, 0, Math.PI * 2); ctx.fill();
      } else if (hm.v === 5) {   // 學士帽
        ctx.beginPath(); ctx.arc(33, 15, 9.5, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(19, 9); ctx.lineTo(33, 4); ctx.lineTo(47, 9); ctx.lineTo(33, 13); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(33, 8); ctx.lineTo(44, 10); ctx.lineTo(44, 17); ctx.stroke();
      } else if (hm.v === 6) {   // 貝雷帽
        ctx.beginPath(); ctx.ellipse(30, 12, 13, 6, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(31, 4, 2, 4);
      } else if (hm.v === 7) {   // 運動頭帶
        ctx.fillRect(23, 15, 21, 4);
        ctx.fillRect(21, 16, 3, 8);
      } else {                   // 兜帽：包住頭，臉露出
        ctx.beginPath(); ctx.arc(32, 21, 13, Math.PI * 0.55, Math.PI * 2.1); ctx.lineTo(28, 33); ctx.closePath(); ctx.fill();
        ctx.fillStyle = look.skin;
        ctx.beginPath(); ctx.ellipse(36, 22, 6, 7.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1d14'; ctx.fillRect(38, 20, 2, 3);
      }
    }

    // 前手
    ctx.fillStyle = look.armor ? shade(look.armor.color, -10) : '#8b6f47';
    rr(ctx, 39, 34, 6, 15, 3); ctx.fill();
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.arc(43, 50, 3.2, 0, Math.PI * 2); ctx.fill();

    // 武器（握在前手）
    const wp = look.weapon;
    ctx.lineCap = 'round';
    if (wp && wp.type === 'none') {
      // 空手（貓鎧者：小貓就是武器）
    } else if (wp && wp.type === 'pistol') {      // 海盜：燧發槍（前手一把、腰間一把）
      const gun = (x, y) => {
        ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 7); ctx.lineTo(x + 1, y + 7); ctx.lineTo(x + 4, y + 1); ctx.fill();
        ctx.fillStyle = shade(wp.color, 30); ctx.fillRect(x, y - 2, 13, 3.5);
      };
      gun(43, 47); gun(25, 52);
    } else if (wp && wp.type === 'book') {        // 學者：厚書
      ctx.fillStyle = shade(wp.color, -10); ctx.fillRect(41, 42, 13, 16);
      ctx.fillStyle = '#f3ead2'; ctx.fillRect(43, 43, 10, 14);
      ctx.fillStyle = '#7a2f2f'; ctx.fillRect(41, 42, 3, 16);
    } else if (wp && wp.type === 'brush') {       // 暗黑畫家：大畫筆
      ctx.strokeStyle = '#6b4a26'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(43, 58); ctx.lineTo(53, 20); ctx.stroke();
      ctx.fillStyle = '#c0c0c0'; ctx.fillRect(51, 17, 5, 5);
      ctx.fillStyle = '#7a3dbf'; ctx.beginPath(); ctx.moveTo(51, 17); ctx.quadraticCurveTo(54, 5, 57, 17); ctx.fill();
    } else if (wp && wp.type === 'tower') {       // 城牆者：大塔盾
      ctx.fillStyle = shade(wp.color, 10); rr(ctx, 40, 28, 18, 36, 4); ctx.fill();
      ctx.strokeStyle = shade(wp.color, -40); ctx.lineWidth = 2; rr(ctx, 40, 28, 18, 36, 4); ctx.stroke();
      ctx.fillStyle = shade(wp.color, 50); ctx.fillRect(47, 32, 4, 28); ctx.fillRect(42, 42, 14, 4);
    } else if (wp && wp.type === 'leash') {       // 遛狗者：牽繩
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(43, 50); ctx.quadraticCurveTo(52, 66, 62, 70); ctx.stroke();
    } else if (wp && wp.type === 'dumbbell') {    // 健身者：啞鈴
      ctx.fillStyle = '#555'; ctx.fillRect(39, 49, 10, 3);
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(37, 45, 4, 11); ctx.fillRect(47, 45, 4, 11);
    } else if (!wp) {              // 村民：草叉
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(43, 62); ctx.lineTo(49, 14); ctx.stroke();
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(45, 16); ctx.lineTo(53, 17); ctx.moveTo(46, 16); ctx.lineTo(46.5, 8);
      ctx.moveTo(49.5, 16.5); ctx.lineTo(50, 8); ctx.moveTo(53, 17); ctx.lineTo(53.5, 9); ctx.stroke();
    } else if (wp.type === 'sword') {
      ctx.strokeStyle = shade(wp.color, 70); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(45, 46); ctx.lineTo(58, 18); ctx.stroke();
      ctx.strokeStyle = wp.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(40, 47); ctx.lineTo(50, 52); ctx.stroke();
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(43, 52); ctx.lineTo(41, 56); ctx.stroke();
    } else if (wp.type === 'axe') {
      ctx.strokeStyle = '#6b4a26'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(42, 60); ctx.lineTo(52, 20); ctx.stroke();
      ctx.fillStyle = shade(wp.color, 40);
      ctx.beginPath(); ctx.moveTo(51, 22); ctx.quadraticCurveTo(64, 20, 62, 34); ctx.lineTo(49, 30); ctx.closePath(); ctx.fill();
    } else if (wp.type === 'staff') {
      ctx.strokeStyle = '#5d4027'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(41, 66); ctx.lineTo(50, 12); ctx.stroke();
      ctx.fillStyle = wp.color; ctx.shadowColor = wp.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(50.5, 10, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (wp.type === 'mace') {
      ctx.strokeStyle = '#6b5a40'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(43, 56); ctx.lineTo(52, 28); ctx.stroke();
      ctx.fillStyle = shade(wp.color, 30);
      ctx.beginPath(); ctx.arc(53, 25, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(wp.color, 70);
      ctx.beginPath(); ctx.arc(51, 23, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  // ── 怪物：64×64，面向左 ──────────────────────────────────────────────────
  A.drawMonster = function (ctx, shape, color, ox = 0, oy = 0, s = 1) {
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(32, 60, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
    const dark = shade(color, -45), light = shade(color, 45);
    const eye = (x, y, r = 4) => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1b2a'; ctx.beginPath(); ctx.arc(x - r * 0.35, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    };

    if (shape === 'slime') {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(10, 56); ctx.quadraticCurveTo(8, 22, 32, 20); ctx.quadraticCurveTo(56, 22, 54, 56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = light; ctx.globalAlpha = .6;
      ctx.beginPath(); ctx.ellipse(22, 30, 6, 4, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      eye(22, 40); eye(36, 40);
    } else if (shape === 'bat') {
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.moveTo(30, 32); ctx.lineTo(4, 18); ctx.lineTo(10, 30); ctx.lineTo(2, 34); ctx.lineTo(14, 40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(34, 32); ctx.lineTo(60, 18); ctx.lineTo(54, 30); ctx.lineTo(62, 34); ctx.lineTo(50, 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(32, 36, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(24, 28); ctx.lineTo(26, 18); ctx.lineTo(30, 26); ctx.fill();
      ctx.beginPath(); ctx.moveTo(34, 26); ctx.lineTo(38, 18); ctx.lineTo(40, 28); ctx.fill();
      eye(27, 35, 3.5); eye(37, 35, 3.5);
    } else if (shape === 'golem') {
      ctx.fillStyle = dark; rr(ctx, 12, 30, 40, 26, 6); ctx.fill();
      ctx.fillStyle = color; rr(ctx, 16, 12, 32, 24, 6); ctx.fill();
      ctx.fillStyle = dark; rr(ctx, 4, 32, 10, 20, 4); ctx.fill(); rr(ctx, 50, 32, 10, 20, 4); ctx.fill();
      ctx.fillStyle = light; ctx.fillRect(18, 40, 6, 3); ctx.fillRect(38, 46, 8, 3);
      ctx.fillStyle = '#7ff3ff'; ctx.shadowColor = '#7ff3ff'; ctx.shadowBlur = 6;
      ctx.fillRect(21, 21, 6, 4); ctx.fillRect(35, 21, 6, 4); ctx.shadowBlur = 0;
    } else if (shape === 'bird') {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(34, 38, 18, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(20, 28, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0a030';
      ctx.beginPath(); ctx.moveTo(12, 26); ctx.lineTo(3, 30); ctx.lineTo(12, 32); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.moveTo(30, 34); ctx.quadraticCurveTo(46, 10, 56, 22); ctx.quadraticCurveTo(48, 36, 30, 40); ctx.fill();
      ctx.beginPath(); ctx.moveTo(50, 40); ctx.lineTo(62, 36); ctx.lineTo(60, 46); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c08020'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30, 50); ctx.lineTo(28, 58); ctx.moveTo(38, 50); ctx.lineTo(38, 58); ctx.stroke();
      eye(18, 27, 3.5);
    } else if (shape === 'jelly') {
      ctx.strokeStyle = shade(color, -20); ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const x = 18 + i * 7;
        ctx.beginPath(); ctx.moveTo(x, 34); ctx.quadraticCurveTo(x - 4, 44, x, 50); ctx.quadraticCurveTo(x + 4, 55, x - 1, 60); ctx.stroke();
      }
      ctx.fillStyle = color; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.ellipse(32, 30, 20, 16, 0, Math.PI, 0); ctx.lineTo(52, 36); ctx.lineTo(12, 36); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(24, 22, 5, 3, -0.4, 0, Math.PI * 2); ctx.fill();
      eye(26, 30, 3); eye(36, 30, 3);
    } else if (shape === 'skeleton') {   // 死靈召喚物（面向右）
      ctx.fillStyle = '#e8e4d8';
      ctx.beginPath(); ctx.arc(32, 20, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(30, 29, 4, 20);
      for (let y = 32; y < 46; y += 4) ctx.fillRect(25, y, 14, 2);
      ctx.fillRect(27, 48, 3, 12); ctx.fillRect(34, 48, 3, 12);
      ctx.fillStyle = '#5bf0a0'; ctx.fillRect(34, 18, 3, 3); ctx.fillRect(28, 18, 3, 3);
      ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(38, 40); ctx.lineTo(52, 22); ctx.stroke();
    }
    ctx.restore();
  };

  // ── 小貓（貓鎧者的投射物）：28×22，面向右、飛撲姿勢 ────────────────────
  A.drawKitten = function (ctx, color) {
    const dark = shade(color, -50);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(12, 13, 8, 5, -0.15, 0, Math.PI * 2); ctx.fill();          // 身體
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(5, 12); ctx.quadraticCurveTo(0, 8, 2, 3); ctx.stroke();       // 尾巴
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 16); ctx.lineTo(21, 19); ctx.moveTo(8, 16); ctx.lineTo(5, 20); ctx.stroke(); // 腳
    ctx.beginPath(); ctx.arc(20, 10, 5.5, 0, Math.PI * 2); ctx.fill();                        // 頭
    ctx.beginPath(); ctx.moveTo(16, 7); ctx.lineTo(16.5, 1); ctx.lineTo(20, 5); ctx.fill();   // 耳
    ctx.beginPath(); ctx.moveTo(21, 5); ctx.lineTo(25, 1); ctx.lineTo(25, 8); ctx.fill();
    ctx.fillStyle = dark; ctx.fillRect(9, 10, 1.5, 4); ctx.fillRect(13, 9, 1.5, 4);         // 花紋
    ctx.fillStyle = '#1b1b2a'; ctx.fillRect(21, 8.5, 1.6, 2); ctx.fillRect(24, 8.5, 1.4, 2); // 眼
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;                                            // 伸出的爪子
    ctx.beginPath(); ctx.moveTo(24, 14); ctx.lineTo(27, 13); ctx.moveTo(24, 16); ctx.lineTo(27, 16.5); ctx.stroke();
  };
  A.KITTEN_COLORS = ['#f0a04b', '#f4f1ea', '#8c8c8c', '#3b3b3b', '#e8c39e'];

  // ── 其他職業的投射物（都畫在 28×22，面向右）──────────────────────────────
  A.MISSILES = {
    book(ctx) {        // 學者：翻開的書
      const c = G.pick(['#7a2f2f', '#2f5a7a', '#3f6b3a', '#6b4a8a']);
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(2, 8); ctx.lineTo(14, 4); ctx.lineTo(26, 8); ctx.lineTo(26, 18); ctx.lineTo(14, 14); ctx.lineTo(2, 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f3ead2'; ctx.beginPath(); ctx.moveTo(4, 9); ctx.lineTo(14, 6); ctx.lineTo(24, 9); ctx.lineTo(24, 16); ctx.lineTo(14, 13); ctx.lineTo(4, 16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, 6); ctx.lineTo(14, 13); ctx.stroke();
    },
    paint(ctx) {       // 暗黑畫家：墨水團
      ctx.fillStyle = G.pick(['#7a3dbf', '#2a1a3d', '#b04be0']);
      ctx.beginPath(); ctx.ellipse(16, 11, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 11, 3, 0, Math.PI * 2); ctx.arc(3, 8, 1.8, 0, Math.PI * 2); ctx.arc(2, 14, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(19, 8, 2.5, 0, Math.PI * 2); ctx.fill();
    },
    bullet(ctx) {      // 海盜：鉛彈＋火光尾
      ctx.fillStyle = 'rgba(255,190,80,.6)'; ctx.beginPath(); ctx.ellipse(10, 11, 9, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(20, 11, 3.5, 0, Math.PI * 2); ctx.fill();
    },
    leaf(ctx) {        // 德魯伊：葉刃
      ctx.fillStyle = '#5fae4f'; ctx.beginPath(); ctx.moveTo(2, 11); ctx.quadraticCurveTo(14, 1, 26, 11); ctx.quadraticCurveTo(14, 21, 2, 11); ctx.fill();
      ctx.strokeStyle = '#2f6a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(3, 11); ctx.lineTo(25, 11); ctx.stroke();
    },
    dog(ctx) {         // 遛狗者：衝出去咬的小狗
      const c = G.pick(['#c8925a', '#f2e6d0', '#3b3b3b', '#a0522d']);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(12, 13, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(21, 10, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(23, 10, 5, 4);
      ctx.fillStyle = shade(c, -45); ctx.beginPath(); ctx.ellipse(18, 7, 2.5, 4.5, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1b2a'; ctx.fillRect(27, 10, 1.5, 1.5); ctx.fillRect(22, 8, 1.6, 1.6);
      ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(5, 11); ctx.lineTo(1, 6); ctx.moveTo(8, 17); ctx.lineTo(6, 21); ctx.moveTo(16, 17); ctx.lineTo(18, 21); ctx.stroke();
    },
  };

  // ── 德魯伊的動物（64×64，面向右）─────────────────────────────────────────
  A.drawAnimal = function (ctx, kind) {
    const a = G.ANIMALS[kind], c = a.color, dark = shade(c, -45), light = shade(c, 40);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(32, 60, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
    const eye = (x, y) => { ctx.fillStyle = '#1b1b2a'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); };
    ctx.fillStyle = c;
    if (kind === 'bear') {
      ctx.beginPath(); ctx.ellipse(28, 42, 20, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(46, 30, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(40, 21, 4, 0, Math.PI * 2); ctx.arc(52, 21, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(14, 50, 7, 10); ctx.fillRect(33, 50, 7, 10);
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(52, 33, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      eye(48, 27); ctx.fillStyle = '#1b1b2a'; ctx.fillRect(54, 31, 3, 2);
    } else if (kind === 'wolf') {
      ctx.beginPath(); ctx.ellipse(28, 40, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(42, 26); ctx.lineTo(58, 34); ctx.lineTo(44, 40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(43, 32, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(38, 26); ctx.lineTo(40, 15); ctx.lineTo(45, 25); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, 36); ctx.quadraticCurveTo(2, 30, 4, 22); ctx.lineTo(12, 33); ctx.fill();
      ctx.fillRect(16, 46, 5, 13); ctx.fillRect(34, 46, 5, 13);
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(30, 44, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      eye(46, 30);
    } else if (kind === 'owl') {
      ctx.beginPath(); ctx.ellipse(32, 38, 15, 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(20, 24); ctx.lineTo(22, 14); ctx.lineTo(28, 22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(44, 24); ctx.lineTo(42, 14); ctx.lineTo(36, 22); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(32, 44, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(26, 30, 6, 0, Math.PI * 2); ctx.arc(38, 30, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0a030'; ctx.beginPath(); ctx.arc(26, 30, 3.5, 0, Math.PI * 2); ctx.arc(38, 30, 3.5, 0, Math.PI * 2); ctx.fill();
      eye(26, 30); eye(38, 30);
      ctx.fillStyle = '#f0a030'; ctx.beginPath(); ctx.moveTo(30, 35); ctx.lineTo(34, 35); ctx.lineTo(32, 39); ctx.fill();
    } else {   // deer
      ctx.beginPath(); ctx.ellipse(28, 38, 17, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(40, 18, 6, 18);
      ctx.beginPath(); ctx.ellipse(48, 18, 8, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(15, 44, 4, 16); ctx.fillRect(36, 44, 4, 16);
      ctx.strokeStyle = '#d9c4a0'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(44, 13); ctx.lineTo(40, 3); ctx.moveTo(42, 8); ctx.lineTo(36, 6); ctx.moveTo(48, 12); ctx.lineTo(52, 2); ctx.moveTo(50, 7); ctx.lineTo(56, 5); ctx.stroke();
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(22, 34, 2, 0, Math.PI * 2); ctx.arc(28, 32, 2, 0, Math.PI * 2); ctx.arc(32, 36, 2, 0, Math.PI * 2); ctx.fill();
      eye(50, 17);
    }
  };

  // ── 飛空艇：每個部位裝的款式（0~4，-1 = 沒裝）決定外觀 ───────────────────
  // look = { paint, balloon, hull, bow, charm, cannon, wing, engine }
  A.drawShip = function (ctx, look, W, H) {
    const paint = G.SHIP_PAINTS[look.paint] || G.SHIP_PAINTS[0];
    const lw = Math.max(1, W / 220);
    const cx = W / 2;
    const bt = Math.max(0, look.balloon), ht = Math.max(0, look.hull);
    const bRx = W * (0.24 + bt * 0.025), bRy = H * (0.2 + bt * 0.018), bCy = H * 0.3;
    const hullW = W * (0.42 + ht * 0.05), hullTop = H * 0.66, hullH = H * (0.15 + ht * 0.01);
    const hx = cx - hullW / 2;

    // 繩索
    ctx.strokeStyle = '#6b5a45'; ctx.lineWidth = lw;
    [-0.7, -0.25, 0.25, 0.7].forEach(t => {
      ctx.beginPath(); ctx.moveTo(cx + t * bRx * 0.8, bCy + bRy * 0.8); ctx.lineTo(cx + t * hullW * 0.4, hullTop); ctx.stroke();
    });

    // 熱氣球：0 拼布 1 條紋 2 雙囊 3 鋼骨 4 星辰
    const envelope = (ex, ey, rx, ry) => {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
      if (bt === 0) {
        const patch = ['#c9a27a', '#a7c4a0', '#d9c27a', '#b98a8a'];
        for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) { ctx.fillStyle = patch[(x + y) % 4]; ctx.fillRect(ex - rx + x * rx / 3, ey - ry + y * ry / 2, rx / 3 + 1, ry / 2 + 1); }
      } else if (bt === 4) {
        ctx.fillStyle = '#1d2050'; ctx.fillRect(ex - rx, ey - ry, rx * 2, ry * 2);
        ctx.fillStyle = '#ffe9a0';
        for (let i = 0; i < 14; i++) { const sx = ex - rx + ((i * 37) % 100) / 100 * rx * 2, sy = ey - ry + ((i * 53) % 100) / 100 * ry * 2; ctx.beginPath(); ctx.arc(sx, sy, W * 0.005 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
      } else {
        const stripes = 8 + bt * 2;
        for (let i = 0; i < stripes; i++) {
          ctx.fillStyle = i % 2 ? '#f3ead2' : paint;
          ctx.fillRect(ex - rx + (i * 2 * rx) / stripes, ey - ry, (2 * rx) / stripes + 1, ry * 2);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.ellipse(ex - rx * 0.3, ey - ry * 0.35, rx * 0.4, ry * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = bt === 3 ? '#4a4f57' : shade(paint, -50); ctx.lineWidth = bt === 3 ? lw * 3 : lw * 2;
      ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      if (bt === 3) {   // 鋼骨
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(ex, ey, Math.abs(i) * rx * 0.3 + 1, ry, 0, 0, Math.PI * 2); ctx.stroke(); }
      }
    };
    if (bt === 2) { envelope(cx - bRx * 0.45, bCy, bRx * 0.62, bRy); envelope(cx + bRx * 0.45, bCy, bRx * 0.62, bRy); }
    else envelope(cx, bCy, bRx, bRy);

    // 船身：0 小木舟 1 商船 2 加固 3 鐵甲 4 黃金王船
    const wood = ['#8a5a32', '#7a4e2c', '#6b4226', '#5d636b', '#7a4e2c'][ht];
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(hx, hullTop); ctx.lineTo(hx + hullW, hullTop);
    ctx.quadraticCurveTo(hx + hullW * 0.97, hullTop + hullH, hx + hullW * 0.8, hullTop + hullH);
    ctx.lineTo(hx + hullW * 0.15, hullTop + hullH);
    ctx.quadraticCurveTo(hx, hullTop + hullH * 0.9, hx, hullTop);
    ctx.fill();
    ctx.fillStyle = ht === 4 ? '#e0b030' : paint;
    ctx.fillRect(hx + 2, hullTop + hullH * 0.18, hullW - 4, hullH * 0.18);
    ctx.fillStyle = shade(wood, -30);
    const planks = 4 + ht * 2;
    for (let i = 1; i < planks; i++) ctx.fillRect(hx + (hullW * i) / planks, hullTop + hullH * 0.45, 1.5, hullH * 0.45);
    if (ht >= 2) {   // 鉚釘/鐵板
      ctx.fillStyle = ht === 3 ? '#9aa3ad' : '#b08a50';
      for (let i = 1; i < 10; i++) ctx.beginPath(), ctx.arc(hx + hullW * i / 10, hullTop + hullH * 0.42, W * 0.004, 0, Math.PI * 2), ctx.fill();
    }
    if (ht === 4) { ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = lw * 2; ctx.beginPath(); ctx.moveTo(hx + 4, hullTop + 2); ctx.lineTo(hx + hullW - 4, hullTop + 2); ctx.stroke(); }
    // 欄杆
    ctx.strokeStyle = shade(wood, -35); ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(hx, hullTop - hullH * 0.25); ctx.lineTo(hx + hullW, hullTop - hullH * 0.25); ctx.stroke();
    for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(hx + (hullW * i) / 8, hullTop - hullH * 0.25); ctx.lineTo(hx + (hullW * i) / 8, hullTop); ctx.stroke(); }

    // 側面穩定翼：從船身側面往後上方伸出（畫在船身前面才看得到）
    // 0 帆布 1 木製 2 鐵骨 → 鰭狀；3 飛鳥 4 天使 → 羽毛翅膀
    if (look.wing >= 0) {
      const wt = look.wing, L = W * (0.16 + wt * 0.035);
      const ax = hx + hullW * 0.32, ay = hullTop + hullH * 0.35;
      const wc = ['#e8dcc0', '#9a6b3e', '#7d848c', '#f4f4f4', '#fff3c4'][wt];
      ctx.lineWidth = lw; ctx.strokeStyle = shade(wc, -60);
      if (wt <= 2) {
        ctx.fillStyle = wc;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - L, ay - L * 0.55); ctx.lineTo(ax - L * 0.8, ay + hullH * 0.2); ctx.lineTo(ax, ay + hullH * 0.35); ctx.closePath();
        ctx.fill(); ctx.stroke();
        if (wt === 2) { ctx.beginPath(); ctx.moveTo(ax, ay + hullH * 0.1); ctx.lineTo(ax - L * 0.9, ay - L * 0.4); ctx.stroke(); }
      } else {
        if (wt === 4) { ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 12; }
        for (let k = 3; k >= 0; k--) {
          ctx.fillStyle = k % 2 ? wc : shade(wc, -12);
          ctx.beginPath();
          ctx.ellipse(ax - L * (0.25 + k * 0.2), ay - L * (0.18 + k * 0.1), L * (0.32 - k * 0.03), L * 0.09, -0.45, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
    }

    // 船砲：款式越高砲越多越大
    if (look.cannon >= 0) {
      const n = Math.min(3, look.cannon + 1), r = hullH * (0.12 + look.cannon * 0.02);
      ctx.fillStyle = look.cannon === 3 ? '#5a3a8a' : look.cannon === 4 ? '#c9a227' : '#2b2b2b';
      for (let i = 0; i < n; i++) {
        const x = hx + hullW * (0.3 + i * 0.18);
        ctx.beginPath(); ctx.arc(x, hullTop + hullH * 0.62, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, hullTop + hullH * 0.62, r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = look.cannon === 3 ? '#5a3a8a' : look.cannon === 4 ? '#c9a227' : '#2b2b2b';
      }
    }

    // 引擎：0 手搖槳 1 風車 2 蒸汽 3 雙渦輪 4 雲晶反應爐
    if (look.engine >= 0) {
      const et = look.engine, props = et >= 3 ? 2 : 1;
      for (let i = 0; i < props; i++) {
        const py = hullTop + hullH * (props === 1 ? 0.4 : 0.15 + i * 0.5);
        ctx.fillStyle = '#555'; ctx.fillRect(hx - W * 0.04, py - 1, W * 0.04, 3);
        ctx.fillStyle = et === 4 ? '#7ff3ff' : '#c9b48a';
        if (et === 4) { ctx.shadowColor = '#7ff3ff'; ctx.shadowBlur = 8; }
        ctx.beginPath(); ctx.ellipse(hx - W * 0.045, py, W * 0.01 + et * 1.5, hullH * (0.22 + et * 0.04), 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (et === 2) {   // 蒸汽煙囪
        ctx.fillStyle = '#444'; ctx.fillRect(hx + hullW * 0.12, hullTop - hullH * 0.9, W * 0.025, hullH * 0.7);
        ctx.fillStyle = 'rgba(230,230,230,.7)'; ctx.beginPath(); ctx.arc(hx + hullW * 0.13, hullTop - hullH * 1.1, W * 0.02, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 船首：0 木製衝角 1 鷹首 2 龍首 3 女神像 4 水晶
    const fx = hx + hullW, fy = hullTop + hullH * 0.2;
    if (look.bow === 0) {
      ctx.fillStyle = '#6b4226';
      ctx.beginPath(); ctx.moveTo(fx - 2, fy - 2); ctx.lineTo(fx + W * 0.05, fy + hullH * 0.3); ctx.lineTo(fx - 2, fy + hullH * 0.6); ctx.fill();
    } else if (look.bow === 1) {
      ctx.fillStyle = '#d4a017';
      ctx.beginPath(); ctx.moveTo(fx - 2, fy - 6); ctx.lineTo(fx + W * 0.06, fy); ctx.lineTo(fx - 2, fy + 8); ctx.fill();
    } else if (look.bow === 2) {
      ctx.fillStyle = '#3b8f5a';
      ctx.beginPath(); ctx.moveTo(fx - 2, fy + 8); ctx.quadraticCurveTo(fx + W * 0.03, fy - 14, fx + W * 0.08, fy - 8);
      ctx.lineTo(fx + W * 0.04, fy); ctx.lineTo(fx - 2, fy + 12); ctx.fill();
    } else if (look.bow === 3) {
      ctx.fillStyle = '#e8e2c8';
      ctx.beginPath(); ctx.arc(fx + W * 0.03, fy - 6, W * 0.015, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - 2, fy + 10); ctx.lineTo(fx + W * 0.04, fy - 2); ctx.lineTo(fx + W * 0.02, fy + 10); ctx.fill();
    } else if (look.bow === 4) {
      ctx.fillStyle = '#7ff3ff'; ctx.shadowColor = '#7ff3ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(fx - 2, fy); ctx.lineTo(fx + W * 0.04, fy - H * 0.04); ctx.lineTo(fx + W * 0.08, fy + 2); ctx.lineTo(fx + W * 0.04, fy + H * 0.05); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 船底掛飾：0 風燈 1 銅鈴 2 船錨 3 雲晶 4 海盜旗
    if (look.charm >= 0) {
      const ax = cx, ay = hullTop + hullH, ch = H * 0.08;
      ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ch); ctx.stroke();
      const y = ay + ch, s = W * 0.025;
      if (look.charm === 0) { ctx.fillStyle = '#ff9a4d'; ctx.shadowColor = '#ffb36b'; ctx.shadowBlur = 8; ctx.fillRect(ax - s * 0.6, y, s * 1.2, s * 1.4); ctx.shadowBlur = 0; }
      else if (look.charm === 1) { ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.moveTo(ax - s, y + s * 1.3); ctx.quadraticCurveTo(ax, y - s * 0.6, ax + s, y + s * 1.3); ctx.fill(); }
      else if (look.charm === 2) { ctx.strokeStyle = '#555'; ctx.lineWidth = lw * 2.5; ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(ax, y + s * 1.8); ctx.moveTo(ax - s, y + s); ctx.quadraticCurveTo(ax, y + s * 2.4, ax + s, y + s); ctx.stroke(); }
      else if (look.charm === 3) { ctx.fillStyle = '#7ff3ff'; ctx.shadowColor = '#7ff3ff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(ax + s, y + s); ctx.lineTo(ax, y + s * 2.2); ctx.lineTo(ax - s, y + s); ctx.fill(); ctx.shadowBlur = 0; }
      else { ctx.fillStyle = '#222'; ctx.fillRect(ax, y - s * 0.2, s * 2.2, s * 1.4); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(ax + s * 1.1, y + s * 0.4, s * 0.35, 0, Math.PI * 2); ctx.fill(); }
    }
  };

  // ── 背景素材（戰鬥場景用，可平鋪）────────────────────────────────────────
  A.drawClouds = function (ctx, W, H, alpha) {
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const blobs = [[40, 0.55, 26], [70, 0.45, 32], [100, 0.58, 22], [190, 0.35, 20], [215, 0.3, 26], [240, 0.38, 18]];
    blobs.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x * W / 256, y * H, r, 0, Math.PI * 2); ctx.fill(); });
  };
  A.drawIslands = function (ctx, W, H, color) {
    const isl = (x, y, w) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - w * 0.35, x + w, y);
      ctx.lineTo(x + w * 0.3, y + w * 0.6); ctx.lineTo(x - w * 0.2, y + w * 0.7); ctx.closePath(); ctx.fill();
    };
    isl(70, H * 0.55, 40); isl(250, H * 0.4, 26); isl(400, H * 0.62, 48);
  };
  A.drawGround = function (ctx, W, H, top, bottom) {
    ctx.fillStyle = bottom; ctx.fillRect(0, 10, W, H - 10);
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 14);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.arc(x + 16, 4, 10, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let x = 0; x < W; x += 24) ctx.fillRect(x + (x % 48 ? 6 : 14), 22 + (x % 3) * 8, 10, 3);
  };
})();
