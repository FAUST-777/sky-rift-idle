// ════════════════════════════════════════════════════════════════════════════
// 遊戲資料表：數值、職業、技能、怪物、裝備、夥伴、家具、飛行船
// 想調平衡或加內容，大部分只要改這個檔案
// 顯示文字（名稱、說明）不放這裡，放在 lang/*.js，用 id 對應
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
  reviveSeconds: 30,        // 戰敗後免費復活要等幾秒（復活後退回上一層）
  reviveCost: 50,           // 花多少雲晶原地復活

  // 貓鎧者
  catBreakBase: 0.10,       // 貓爪普攻的破甲（敵人防禦 -10%），被動「貓爪印記」再往上加
  catBreakDur: 5,           // 破甲持續秒數
  moralePerFloor: 1,        // 士氣：每打過一層（沒戰敗）全隊最終防禦 +1%
  moraleMax: 15,            // 士氣上限 +15%
  frenzyPerHit: 1,          // 吸貓狂熱：每次打中敵人自身傷害 +1%
  frenzyMax: 10,            // 吸貓狂熱上限 +10%

  // 背包擴充
  bagExpandSlots: 5,        // 每次擴充幾格
  bagMax: 100,              // 背包最多幾格
};

// 背包第 n 次擴充（n 從 0 開始）的費用：前面用金幣，越後面越要雲晶，最後只收雲晶
G.bagExpandCost = n => {
  const table = [
    { gold: 500,   crystal: 0 },
    { gold: 1500,  crystal: 0 },
    { gold: 4000,  crystal: 10 },
    { gold: 10000, crystal: 30 },
  ];
  return table[n] || { gold: 0, crystal: 60 + (n - 4) * 40 };
};

// ── 稀有度（名稱：rarity.<index>，裝備前綴：prefix.<index>）────────────────
G.RARITY = [
  { color: '#c9c9c9', mult: 1.0, affix: 0, weight: 60 },
  { color: '#5fd35f', mult: 1.3, affix: 1, weight: 26 },
  { color: '#4aa3ff', mult: 1.7, affix: 1, weight: 10 },
  { color: '#b36bff', mult: 2.3, affix: 2, weight: 3.5 },
  { color: '#ff9a2e', mult: 3.2, affix: 3, weight: 0.5 },
];

// ── 裝備部位（名稱：slot.<id>）─────────────────────────────────────────────
G.SLOTS = ['weapon', 'helmet', 'armor', 'boots', 'accessory'];
G.SLOT_ICON = { weapon: '⚔️', helmet: '⛑️', armor: '🛡️', boots: '👢', accessory: '💍' };

// 每個部位的底材：紙娃娃外觀樣式（名稱：base.<slot>.<index>）
G.ITEM_BASES = {
  weapon:    [{ look: 'sword' }, { look: 'axe' }, { look: 'staff' }, { look: 'mace' }],
  helmet:    [{ look: 0 }, { look: 1 }, { look: 2 }],
  armor:     [{ look: 0 }, { look: 1 }, { look: 2 }],
  boots:     [{ look: 0 }, { look: 1 }],
  accessory: [{ look: 0 }, { look: 1 }, { look: 2 }],
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

// ── 職業（名稱/說明：class.<id>.name / .desc）──────────────────────────────
// mult = 屬性倍率；ranged = 遠程（站後面放投射物）
// missile = 普攻的投射物造型（貓鎧者：從鎧甲開口射出小貓）
G.CLASSES = {
  villager:    { color: '#8b6f47', cape: null,      ranged: false, mult: { hp: 1, atk: 1, def: 1 } },
  bloodknight: { color: '#c0392b', cape: '#8b1a1a', ranged: false, mult: { hp: 1.1, atk: 1.35, def: 1.0 } },
  catknight:   { color: '#9aa3ad', cape: '#d98a3a', ranged: false, missile: 'cat', mult: { hp: 1.25, atk: 1.05, def: 1.3 } },
  priest:      { color: '#f1e3a6', cape: '#e8e2c8', ranged: true,  mult: { hp: 1.0, atk: 0.9, def: 1.0 } },
  crusader:    { color: '#d4a017', cape: '#c9a227', ranged: false, mult: { hp: 1.45, atk: 0.85, def: 1.6 } },
};
G.CLASS_ORDER = ['bloodknight', 'catknight', 'priest', 'crusader'];

// ── 技能（名稱/說明：skill.<id>.name / .desc，說明裡的 {v} 會代入數值）─────
// kind（主動）：strike 單體倍率傷害 / aoe 全體傷害 / buffAtk 攻擊強化 / healParty 群補
//               shieldParty 群體護盾 / summon 召喚 / taunt 挑釁減傷
//               aoeBreak 全體傷害＋破甲
// kind（被動）：lifesteal / critUp / atkPct / defPct / hpPct / healPower / summonPower / armorBreak
// v(rank) = 該等級的效果數值；raw: true 表示 {v} 直接顯示，不換成百分比
// tier = 技能樹層級（需要在該職業投入 G.TIER_REQ 點）
const lin = (base, per) => r => +(base + per * (r - 1)).toFixed(3);
G.TIER_REQ = [0, 3, 8];

G.SKILLS = {
  villager: [
    { id: 'smash', type: 'active', kind: 'strike', tier: 0, max: 5, cd: 6, v: lin(1.8, 0.2) },
  ],
  bloodknight: [
    { id: 'bloodslash', type: 'active',  kind: 'strike',    tier: 0, max: 5, cd: 5,  v: lin(2.2, 0.25) },
    { id: 'drain',      type: 'passive', kind: 'lifesteal', tier: 0, max: 5,         v: lin(0.05, 0.03) },
    { id: 'whirl',      type: 'active',  kind: 'aoe',       tier: 1, max: 5, cd: 8,  v: lin(1.4, 0.2) },
    { id: 'frenzy',     type: 'passive', kind: 'critUp',    tier: 1, max: 5,         v: lin(5, 3), raw: true },
    { id: 'bloodlust',  type: 'active',  kind: 'buffAtk',   tier: 2, max: 5, cd: 15, v: lin(0.4, 0.1), dur: 8 },
  ],
  // 貓鎧者：職業特性 = 普攻破甲、士氣、吸貓狂熱（數值見 G.CONFIG）
  catknight: [
    { id: 'kittenvolley', type: 'active',  kind: 'aoe',        tier: 0, max: 5, cd: 6,  v: lin(1.2, 0.2) },
    { id: 'clawmark',     type: 'passive', kind: 'armorBreak', tier: 0, max: 5,         v: lin(0.05, 0.03) },
    { id: 'fullburst',    type: 'active',  kind: 'aoeBreak',   tier: 1, max: 5, cd: 10, v: lin(1.6, 0.25), breakV: 0.3, dur: 6 },
    { id: 'heavyplate',   type: 'passive', kind: 'defPct',     tier: 1, max: 5,         v: lin(0.08, 0.06) },
    { id: 'catstorm',     type: 'active',  kind: 'buffAtk',    tier: 2, max: 5, cd: 15, v: lin(0.2, 0.06), dur: 10, party: true },
  ],
  priest: [
    { id: 'holylight',  type: 'active',  kind: 'healParty',   tier: 0, max: 5, cd: 7,  v: lin(0.2, 0.05) },
    { id: 'smite',      type: 'passive', kind: 'atkPct',      tier: 0, max: 5,         v: lin(0.05, 0.04) },
    { id: 'aegis',      type: 'active',  kind: 'shieldParty', tier: 1, max: 5, cd: 12, v: lin(0.15, 0.05), dur: 8 },
    { id: 'devotion',   type: 'passive', kind: 'healPower',   tier: 1, max: 5,         v: lin(0.15, 0.1) },
    { id: 'blessing',   type: 'active',  kind: 'buffAtk',     tier: 2, max: 5, cd: 15, v: lin(0.25, 0.07), dur: 10, party: true },
  ],
  crusader: [
    { id: 'shieldbash', type: 'active',  kind: 'strike', tier: 0, max: 5, cd: 5,  v: lin(1.6, 0.2) },
    { id: 'bulwark',    type: 'passive', kind: 'defPct', tier: 0, max: 5,         v: lin(0.1, 0.08) },
    { id: 'provoke',    type: 'active',  kind: 'taunt',  tier: 1, max: 5, cd: 12, v: lin(0.3, 0.06), dur: 6 },
    { id: 'fortitude',  type: 'passive', kind: 'hpPct',  tier: 1, max: 5,         v: lin(0.1, 0.08) },
    { id: 'judgement',  type: 'active',  kind: 'aoe',    tier: 2, max: 5, cd: 10, v: lin(1.3, 0.2) },
  ],
};
G.ACTIVE_SLOTS = 3;

// ── 怪物（名稱：monster.<id>）──────────────────────────────────────────────
// 每 5 層換一組怪；shape 決定程式畫的造型
G.MONSTER_TIERS = [
  [{ id: 'cloudSlime', shape: 'slime', color: '#7ec8e3' }, { id: 'windBat', shape: 'bat', color: '#8a7fb5' }, { id: 'rubbleGolem', shape: 'golem', color: '#9a8f80' }],
  [{ id: 'thunderBird', shape: 'bird', color: '#f2d24b' }, { id: 'skyJelly', shape: 'jelly', color: '#e58fd6' }, { id: 'ironCrow', shape: 'bird', color: '#5b5f6b' }],
  [{ id: 'gargoyle', shape: 'bat', color: '#6b7d8c' }, { id: 'cloudGiant', shape: 'golem', color: '#d8e4f0' }, { id: 'riftSlime', shape: 'slime', color: '#b04be0' }],
  [{ id: 'voidJelly', shape: 'jelly', color: '#5b3daf' }, { id: 'starGolem', shape: 'golem', color: '#2f3b66' }, { id: 'skyWarden', shape: 'bird', color: '#ffd27a' }],
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

// ── 夥伴（名稱/介紹：partner.<id>.name / .bio）─────────────────────────────
// floor = 打到第幾層後可招募
G.PARTNERS = [
  { id: 'ella', floor: 2,  hair: '#d9a066', skin: '#f3d2b3' },
  { id: 'bram', floor: 4,  hair: '#3b2a1e', skin: '#d9a47a' },
  { id: 'lina', floor: 7,  hair: '#f5e6a8', skin: '#f6dcc4' },
  { id: 'kael', floor: 10, hair: '#222831', skin: '#e0b895' },
  { id: 'mira', floor: 14, hair: '#9c7be0', skin: '#f1d1c0' },
];
G.partnerRecruitCost = p => 80 * p.floor;
G.partnerLevelCost = lv => Math.round(50 * Math.pow(1.3, lv - 1));

// ── 飛行船（名稱：part.<id>.name）──────────────────────────────────────────
G.SHIP_PARTS = {
  balloon: { icon: '🎈', max: 10 },
  engine:  { icon: '⚙️', max: 10 },
  hull:    { icon: '🚢', max: 4 },
  cannon:  { icon: '💣', max: 10 },
};
G.shipMaxFloor = lv => 5 + (lv - 1) * 5;
G.homeSize = lv => [{ w: 4, h: 3 }, { w: 5, h: 4 }, { w: 6, h: 5 }, { w: 6, h: 6 }][Math.max(0, lv - 1)];
G.shipUpgradeCost = (part, lv) => {
  const base = { balloon: 200, engine: 150, hull: 400, cannon: 250 }[part];
  return { gold: Math.round(base * Math.pow(2.6, lv)), crystal: Math.round(3 * Math.pow(1.9, lv)) };
};
G.SHIP_PAINTS = ['#b5523b', '#3b6fb5', '#3b8f5a', '#7a4bb5', '#d4a017', '#3a3a3a'];
G.SHIP_FIGUREHEADS = 4;   // 名稱：figurehead.<index>

// ── 家具與收藏品（名稱：furniture.<id>）────────────────────────────────────
// comfort = 舒適度（每 1 點 = 離線收益 +1%）；cur = 用金幣(gold)或雲晶(crystal)買
G.FURNITURE = [
  { id: 'plant',   icon: '🌿', price: 60,  cur: 'gold',    comfort: 1 },
  { id: 'barrel',  icon: '🛢️', price: 80,  cur: 'gold',    comfort: 1 },
  { id: 'lamp',    icon: '🏮', price: 90,  cur: 'gold',    comfort: 1 },
  { id: 'chair',   icon: '🪑', price: 100, cur: 'gold',    comfort: 1 },
  { id: 'bed',     icon: '🛏️', price: 150, cur: 'gold',    comfort: 2 },
  { id: 'rug',     icon: '🧶', price: 180, cur: 'gold',    comfort: 2 },
  { id: 'shelf',   icon: '📚', price: 260, cur: 'gold',    comfort: 3 },
  { id: 'globe',   icon: '🌐', price: 500, cur: 'gold',    comfort: 5 },
  { id: 'compass', icon: '🧭', price: 10,  cur: 'crystal', comfort: 6, collect: true },
  { id: 'egg',     icon: '🥚', price: 25,  cur: 'crystal', comfort: 10, collect: true },
  { id: 'star',    icon: '✨', price: 40,  cur: 'crystal', comfort: 15, collect: true },
];

// 開場劇情頁數（內容：prologue.1 ～ prologue.N）
G.PROLOGUE_PAGES = 5;
