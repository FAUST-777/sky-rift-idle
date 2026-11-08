// ════════════════════════════════════════════════════════════════════════════
// 遊戲資料表：數值、職業、技能、怪物、裝備、夥伴、家具、飛行船
// 想調平衡或加內容，大部分只要改這個檔案
// ════════════════════════════════════════════════════════════════════════════
window.G = window.G || {};

G.CONFIG = {
  killsPerFloor: 10,        // 每層打幾隻小怪後出現層主
  classUnlockLevel: 5,      // 幾等可以轉職
  classChangeCost: 500,     // 轉職後再換職業的費用
  maxParty: 2,              // 同時出戰的夥伴數
  inventorySize: 40,
  offlineCapHours: 8,
  netPrice: 50,             // 捕獸網價格
  captureChance: 0.05,
};

// ── 稀有度 ─────────────────────────────────────────────────────────────────
G.RARITY = [
  { name: '普通', color: '#c9c9c9', mult: 1.0, affix: 0, weight: 60 },
  { name: '優良', color: '#5fd35f', mult: 1.3, affix: 1, weight: 26 },
  { name: '稀有', color: '#4aa3ff', mult: 1.7, affix: 1, weight: 10 },
  { name: '史詩', color: '#b36bff', mult: 2.3, affix: 2, weight: 3.5 },
  { name: '傳說', color: '#ff9a2e', mult: 3.2, affix: 3, weight: 0.5 },
];
G.RARITY_PREFIX = ['', '雲紋', '風暴', '星辰', '裂界'];

// ── 裝備部位 ───────────────────────────────────────────────────────────────
G.SLOTS = ['weapon', 'helmet', 'armor', 'boots', 'accessory'];
G.SLOT_NAME = { weapon: '武器', helmet: '頭盔', armor: '鎧甲', boots: '靴子', accessory: '飾品' };
G.SLOT_ICON = { weapon: '⚔️', helmet: '⛑️', armor: '🛡️', boots: '👢', accessory: '💍' };

// 每個部位的底材：名稱 + 紙娃娃外觀樣式
G.ITEM_BASES = {
  weapon:    [{ n: '長劍', look: 'sword' }, { n: '戰斧', look: 'axe' }, { n: '法杖', look: 'staff' }, { n: '權杖', look: 'mace' }],
  helmet:    [{ n: '皮帽', look: 0 }, { n: '鐵盔', look: 1 }, { n: '兜帽', look: 2 }],
  armor:     [{ n: '布衣', look: 0 }, { n: '鎖甲', look: 1 }, { n: '板甲', look: 2 }],
  boots:     [{ n: '皮靴', look: 0 }, { n: '鐵靴', look: 1 }],
  accessory: [{ n: '護身符', look: 0 }, { n: '戒指', look: 1 }, { n: '徽章', look: 2 }],
};
// 主屬性（第 1 層普通品質的基準值）
G.SLOT_MAIN = {
  weapon:    { atk: 4 },
  helmet:    { hp: 15, def: 1 },
  armor:     { hp: 20, def: 3 },
  boots:     { hp: 10, spd: 0.04 },
  accessory: { atk: 2, crit: 2 },
};
G.AFFIXES = [{ atk: 2 }, { hp: 12 }, { def: 1.5 }, { crit: 1.5 }, { spd: 0.03 }];
G.STAT_NAME = { atk: '攻擊', hp: '生命', def: '防禦', crit: '暴擊%', spd: '攻速' };

// ── 職業 ───────────────────────────────────────────────────────────────────
// mult = 屬性倍率；ranged = 遠程（站後面放投射物）
G.CLASSES = {
  villager:   { name: '村民',     color: '#8b6f47', cape: null,      ranged: false, mult: { hp: 1, atk: 1, def: 1 },
                desc: '平凡的村民。到 5 級可以轉職。' },
  bloodknight:{ name: '血騎士',   color: '#c0392b', cape: '#8b1a1a', ranged: false, mult: { hp: 1.1, atk: 1.35, def: 1.0 },
                desc: '近戰物理輸出，靠吸血續戰。' },
  necro:      { name: '死靈術師', color: '#7d5ba6', cape: '#3d2b56', ranged: true,  mult: { hp: 0.9, atk: 1.2, def: 0.85 },
                desc: '遠程魔法與召喚骷髏，擅長群體傷害。' },
  priest:     { name: '牧師',     color: '#f1e3a6', cape: '#e8e2c8', ranged: true,  mult: { hp: 1.0, atk: 0.9, def: 1.0 },
                desc: '治療、護盾、強化隊友。' },
  crusader:   { name: '聖十字軍', color: '#d4a017', cape: '#c9a227', ranged: false, mult: { hp: 1.45, atk: 0.85, def: 1.6 },
                desc: '坦克，挑釁敵人、承受傷害。' },
};
G.CLASS_ORDER = ['bloodknight', 'necro', 'priest', 'crusader'];

// ── 技能 ───────────────────────────────────────────────────────────────────
// kind（主動）：strike 單體倍率傷害 / aoe 全體傷害 / buffAtk 攻擊強化 / healParty 群補
//               shieldParty 群體護盾 / summon 召喚 / taunt 挑釁減傷
// kind（被動）：lifesteal / critUp / atkPct / defPct / hpPct / healPower / summonPower
// v(rank) = 該等級的效果數值；tier = 技能樹層級（需要在該職業投入的點數）
const lin = (base, per) => r => +(base + per * (r - 1)).toFixed(3);
G.TIER_REQ = [0, 3, 8];

G.SKILLS = {
  villager: [
    { id: 'smash', name: '猛擊', type: 'active', kind: 'strike', tier: 0, max: 5, cd: 6, v: lin(1.8, 0.2), fmt: v => `造成 ${Math.round(v * 100)}% 攻擊傷害` },
  ],
  bloodknight: [
    { id: 'bloodslash', name: '血斬',     type: 'active',  kind: 'strike',  tier: 0, max: 5, cd: 5,  v: lin(2.2, 0.25), fmt: v => `單體 ${Math.round(v * 100)}% 傷害` },
    { id: 'drain',      name: '吸血',     type: 'passive', kind: 'lifesteal', tier: 0, max: 5,      v: lin(0.05, 0.03), fmt: v => `傷害的 ${Math.round(v * 100)}% 轉為生命` },
    { id: 'whirl',      name: '旋風血刃', type: 'active',  kind: 'aoe',     tier: 1, max: 5, cd: 8,  v: lin(1.4, 0.2),  fmt: v => `全體 ${Math.round(v * 100)}% 傷害` },
    { id: 'frenzy',     name: '狂怒',     type: 'passive', kind: 'critUp',  tier: 1, max: 5,         v: lin(5, 3),      fmt: v => `暴擊率 +${v}%` },
    { id: 'bloodlust',  name: '嗜血',     type: 'active',  kind: 'buffAtk', tier: 2, max: 5, cd: 15, v: lin(0.4, 0.1),  dur: 8, fmt: v => `自身攻擊 +${Math.round(v * 100)}%，8 秒` },
  ],
  necro: [
    { id: 'bonespear',  name: '骨矛',     type: 'active',  kind: 'strike',  tier: 0, max: 5, cd: 4,  v: lin(2.0, 0.25), fmt: v => `單體 ${Math.round(v * 100)}% 傷害` },
    { id: 'soulsiphon', name: '靈魂汲取', type: 'passive', kind: 'atkPct',  tier: 0, max: 5,         v: lin(0.06, 0.04), fmt: v => `攻擊 +${Math.round(v * 100)}%` },
    { id: 'skeleton',   name: '召喚骷髏', type: 'active',  kind: 'summon',  tier: 1, max: 5, cd: 14, v: lin(0.5, 0.12), dur: 12, fmt: v => `召喚骷髏 12 秒，攻擊力為你的 ${Math.round(v * 100)}%` },
    { id: 'legion',     name: '亡者大軍', type: 'passive', kind: 'summonPower', tier: 1, max: 5,     v: lin(0.15, 0.1), fmt: v => `召喚物攻擊 +${Math.round(v * 100)}%` },
    { id: 'corpse',     name: '屍爆',     type: 'active',  kind: 'aoe',     tier: 2, max: 5, cd: 9,  v: lin(1.8, 0.25), fmt: v => `全體 ${Math.round(v * 100)}% 傷害` },
  ],
  priest: [
    { id: 'holylight',  name: '聖光術',   type: 'active',  kind: 'healParty', tier: 0, max: 5, cd: 7, v: lin(0.2, 0.05), fmt: v => `全隊回復 ${Math.round(v * 100)}% 生命` },
    { id: 'smite',      name: '聖光懲擊', type: 'passive', kind: 'atkPct',  tier: 0, max: 5,         v: lin(0.05, 0.04), fmt: v => `攻擊 +${Math.round(v * 100)}%` },
    { id: 'aegis',      name: '神聖護盾', type: 'active',  kind: 'shieldParty', tier: 1, max: 5, cd: 12, v: lin(0.15, 0.05), dur: 8, fmt: v => `全隊獲得 ${Math.round(v * 100)}% 生命的護盾` },
    { id: 'devotion',   name: '虔誠',     type: 'passive', kind: 'healPower', tier: 1, max: 5,       v: lin(0.15, 0.1), fmt: v => `治療與護盾效果 +${Math.round(v * 100)}%` },
    { id: 'blessing',   name: '祝福',     type: 'active',  kind: 'buffAtk', tier: 2, max: 5, cd: 15, v: lin(0.25, 0.07), dur: 10, party: true, fmt: v => `全隊攻擊 +${Math.round(v * 100)}%，10 秒` },
  ],
  crusader: [
    { id: 'shieldbash', name: '盾擊',     type: 'active',  kind: 'strike',  tier: 0, max: 5, cd: 5,  v: lin(1.6, 0.2),  fmt: v => `單體 ${Math.round(v * 100)}% 傷害` },
    { id: 'bulwark',    name: '鐵壁',     type: 'passive', kind: 'defPct',  tier: 0, max: 5,         v: lin(0.1, 0.08), fmt: v => `防禦 +${Math.round(v * 100)}%` },
    { id: 'provoke',    name: '挑釁',     type: 'active',  kind: 'taunt',   tier: 1, max: 5, cd: 12, v: lin(0.3, 0.06), dur: 6, fmt: v => `吸引所有敵人，自身減傷 ${Math.round(v * 100)}%，6 秒` },
    { id: 'fortitude',  name: '堅韌',     type: 'passive', kind: 'hpPct',   tier: 1, max: 5,         v: lin(0.1, 0.08), fmt: v => `生命 +${Math.round(v * 100)}%` },
    { id: 'judgement',  name: '神聖審判', type: 'active',  kind: 'aoe',     tier: 2, max: 5, cd: 10, v: lin(1.3, 0.2),  fmt: v => `全體 ${Math.round(v * 100)}% 傷害` },
  ],
};
G.ACTIVE_SLOTS = 3;

// ── 怪物 ───────────────────────────────────────────────────────────────────
// 每 5 層換一組怪；shape 決定程式畫的造型
G.MONSTER_TIERS = [
  [{ n: '雲史萊姆', shape: 'slime', color: '#7ec8e3' }, { n: '風蝙蝠', shape: 'bat', color: '#8a7fb5' }, { n: '碎石魔像', shape: 'golem', color: '#9a8f80' }],
  [{ n: '雷鳥', shape: 'bird', color: '#f2d24b' }, { n: '浮空水母', shape: 'jelly', color: '#e58fd6' }, { n: '鐵羽鴉', shape: 'bird', color: '#5b5f6b' }],
  [{ n: '石像鬼', shape: 'bat', color: '#6b7d8c' }, { n: '雲巨人', shape: 'golem', color: '#d8e4f0' }, { n: '裂界史萊姆', shape: 'slime', color: '#b04be0' }],
  [{ n: '虛空水母', shape: 'jelly', color: '#5b3daf' }, { n: '星骸魔像', shape: 'golem', color: '#2f3b66' }, { n: '天穹守衛', shape: 'bird', color: '#ffd27a' }],
];
G.monsterTier = f => G.MONSTER_TIERS[Math.min(G.MONSTER_TIERS.length - 1, Math.floor((f - 1) / 5))];
G.monsterStats = (f, boss) => {
  const m = boss ? { hp: 7, atk: 1.8, def: 1.5 } : { hp: 1, atk: 1, def: 1 };
  return {
    maxHp: Math.round(35 * Math.pow(1.17, f - 1) * m.hp),
    atk:   +(4 * Math.pow(1.14, f - 1) * m.atk).toFixed(1),
    def:   +(2 * Math.pow(1.14, f - 1) * m.def).toFixed(1),
    spd:   boss ? 0.7 : 0.8,
    crit:  5, critDmg: 1.5,
  };
};
G.rewardFor = (f, boss) => ({
  gold: Math.round(6 * Math.pow(1.15, f - 1) * (boss ? 8 : 1)),
  xp:   Math.round(5 * Math.pow(1.15, f - 1) * (boss ? 6 : 1)),
});

// 每層的天空顏色（越高越偏紫、越暗）
G.SKY_COLORS = [
  [0x9fd8ff, 0xe8f6ff], [0x86b8f0, 0xd9ecff], [0x7a8fe0, 0xd6c8ff], [0x5d4fb0, 0xb79ce8], [0x2c1f5e, 0x6b4fa8],
];
G.skyFor = f => G.SKY_COLORS[Math.min(G.SKY_COLORS.length - 1, Math.floor((f - 1) / 5))];

// ── 經驗 ───────────────────────────────────────────────────────────────────
G.xpToLevel = lv => Math.round(20 * Math.pow(1.28, lv - 1));
G.LEVEL_GAIN = { hp: 12, atk: 2.2, def: 0.8 };
G.HERO_BASE  = { hp: 100, atk: 10, def: 3, spd: 1.0, crit: 5, critDmg: 1.5 };

// ── 夥伴 ───────────────────────────────────────────────────────────────────
// floor = 打到第幾層後可招募
G.PARTNERS = [
  { id: 'ella', name: '獵人艾拉',   floor: 2,  hair: '#d9a066', skin: '#f3d2b3', bio: '村裡最好的弓手，想知道天空洞裡有什麼獵物。' },
  { id: 'bram', name: '鐵匠布蘭',   floor: 4,  hair: '#3b2a1e', skin: '#d9a47a', bio: '幫你修過熱氣球的鐵匠，力氣大得嚇人。' },
  { id: 'lina', name: '修女莉娜',   floor: 7,  hair: '#f5e6a8', skin: '#f6dcc4', bio: '在第 7 層迷路的修女，相信裂洞是神的試煉。' },
  { id: 'kael', name: '浪人凱爾',   floor: 10, hair: '#222831', skin: '#e0b895', bio: '比所有人都早上來的探險者，似乎知道些什麼。' },
  { id: 'mira', name: '占星師米菈', floor: 14, hair: '#9c7be0', skin: '#f1d1c0', bio: '能讀懂裂洞星圖的少女。' },
];
G.partnerRecruitCost = p => 80 * p.floor;
G.partnerLevelCost = lv => Math.round(50 * Math.pow(1.3, lv - 1));

// ── 飛行船 ─────────────────────────────────────────────────────────────────
G.SHIP_PARTS = {
  balloon: { name: '氣囊', icon: '🎈', max: 10, desc: lv => `可到達第 ${G.shipMaxFloor(lv)} 層` },
  engine:  { name: '引擎', icon: '⚙️', max: 10, desc: lv => `金幣 +${(lv - 1) * 10}%、移動加快` },
  hull:    { name: '船身', icon: '🚢', max: 4,  desc: lv => `家園空間 ${G.homeSize(lv).w}×${G.homeSize(lv).h}` },
  cannon:  { name: '船砲', icon: '💣', max: 10, desc: lv => lv === 0 ? '尚未安裝' : `每 6 秒砲擊，${lv * 30}% 攻擊力傷害` },
};
G.shipMaxFloor = lv => 5 + (lv - 1) * 5;
G.homeSize = lv => [{ w: 4, h: 3 }, { w: 5, h: 4 }, { w: 6, h: 5 }, { w: 6, h: 6 }][Math.max(0, lv - 1)];
G.shipUpgradeCost = (part, lv) => {
  const base = { balloon: 200, engine: 150, hull: 400, cannon: 250 }[part];
  return { gold: Math.round(base * Math.pow(2.6, lv)), crystal: Math.round(3 * Math.pow(1.9, lv)) };
};
G.SHIP_PAINTS = ['#b5523b', '#3b6fb5', '#3b8f5a', '#7a4bb5', '#d4a017', '#3a3a3a'];
G.SHIP_FIGUREHEADS = ['無', '鷹首', '龍首', '女神像'];

// ── 家具與收藏品 ───────────────────────────────────────────────────────────
// comfort = 舒適度（每 1 點 = 離線收益 +1%）；cur = 用金幣(gold)或雲晶(crystal)買
G.FURNITURE = [
  { id: 'plant',   n: '盆栽',     icon: '🌿', price: 60,  cur: 'gold',    comfort: 1 },
  { id: 'barrel',  n: '酒桶',     icon: '🛢️', price: 80,  cur: 'gold',    comfort: 1 },
  { id: 'lamp',    n: '風燈',     icon: '🏮', price: 90,  cur: 'gold',    comfort: 1 },
  { id: 'chair',   n: '木椅',     icon: '🪑', price: 100, cur: 'gold',    comfort: 1 },
  { id: 'bed',     n: '吊床',     icon: '🛏️', price: 150, cur: 'gold',    comfort: 2 },
  { id: 'rug',     n: '織毯',     icon: '🧶', price: 180, cur: 'gold',    comfort: 2 },
  { id: 'shelf',   n: '書櫃',     icon: '📚', price: 260, cur: 'gold',    comfort: 3 },
  { id: 'globe',   n: '天空儀',   icon: '🌐', price: 500, cur: 'gold',    comfort: 5 },
  { id: 'compass', n: '古代羅盤', icon: '🧭', price: 10,  cur: 'crystal', comfort: 6, collect: true },
  { id: 'egg',     n: '龍蛋',     icon: '🥚', price: 25,  cur: 'crystal', comfort: 10, collect: true },
  { id: 'star',    n: '星砂瓶',   icon: '✨', price: 40,  cur: 'crystal', comfort: 15, collect: true },
];

// ── 開場劇情 ───────────────────────────────────────────────────────────────
G.PROLOGUE = [
  '這是一個平凡的中世紀村莊。麥田、風車、石板路，日子一天天過去。',
  '直到某天清晨，村民們抬頭，看見天空破了一個大洞。',
  '洞裡傳來風聲，也落下閃閃發光的「雲晶」。',
  '大家紛紛搭上熱氣球，飛進洞裡探險……',
  '而你，只是一個普通的村民。',
];
