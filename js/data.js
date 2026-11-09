// ════════════════════════════════════════════════════════════════════════════
// 遊戲資料表：數值、職業、技能、怪物、裝備、夥伴、家具、飛空艇
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
  reviveSeconds: 30,        // 戰敗後免費復活要等幾秒（復活後退回上一層）
  reviveCost: 50,           // 花多少雲晶原地復活

  // 貓鎧者被動（上限由技能等級決定，見 ck_morale / ck_frenzy）
  moralePerAttack: 1,       // 士氣：貓鎧者每攻擊一次（普攻或攻擊技能）+1 層，每層全隊最終防禦 +1%
  frenzyPerHit: 1,          // 吸貓狂熱：每次打中敵人自身傷害 +1%
  crisisHp: 0.6,            // 學者「危機意識」：任一隊友生命低於 60% 觸發
  evadeCap: 0.6,            // 閃避率上限

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
  weapon:    [{ look: 'sword' }, { look: 'axe' }, { look: 'spear' }, { look: 'mace' }],
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
// core  = 定位：atk 攻擊 / buff 輔助 / spc 特殊 / def 防禦（決定屬性倍率的大方向）
// range = 普攻範圍：all 打全部敵人但每下較弱 / one 只打一隻但較痛
// dmgType = 傷害系別：physical 物理 / animal 動物 / arcane 奧術 / dark 黑暗（之後做組合特效用）
// ranged = 站後排；missile = 普攻投射物造型；shots = 普攻一次打幾發
// weapon = 紙娃娃固定拿的職業武器（不受裝備影響）
G.CLASSES = {
  villager:    { core: 'atk',  range: 'one', dmgType: 'physical', color: '#8b6f47', cape: null,      ranged: false, mult: { hp: 1,    atk: 1,    def: 1 }, weapon: 'pitchfork' },
  bloodknight: { core: 'atk',  range: 'one', dmgType: 'physical', color: '#c0392b', cape: '#8b1a1a', ranged: false, mult: { hp: 1.15, atk: 1.35, def: 0.95 }, weapon: 'dualsword' },
  catknight:   { core: 'buff', range: 'all', dmgType: 'animal',   color: '#9aa3ad', cape: '#d98a3a', ranged: false, mult: { hp: 1.25, atk: 1.0,  def: 1.25 }, missile: 'cat', weapon: 'longsword' },
  scholar:     { core: 'atk',  range: 'all', dmgType: 'arcane',   color: '#3f6fb5', cape: '#24477a', ranged: true,  mult: { hp: 0.9,  atk: 1.3,  def: 0.85 }, missile: 'book', weapon: 'openbook' },
  darkpainter: { core: 'spc',  range: 'all', dmgType: 'dark',     color: '#5b3d7a', cape: '#2a1a3d', ranged: true,  mult: { hp: 0.95, atk: 1.1,  def: 0.9 },  missile: 'paint', weapon: 'brush' },
  pirate:      { core: 'atk',  range: 'one', dmgType: 'physical', color: '#7a2f2f', cape: '#2b2b2b', ranged: true,  mult: { hp: 1.0,  atk: 1.4,  def: 0.85 }, missile: 'bullet', shots: 2, weapon: 'pistol' },
  wallbringer: { core: 'def',  range: 'one', dmgType: 'physical', color: '#8a8f99', cape: '#4a5560', ranged: false, mult: { hp: 1.5,  atk: 0.8,  def: 1.7 },  weapon: 'tower' },
  druid:       { core: 'buff', range: 'all', dmgType: 'animal',   color: '#4f8a4a', cape: '#2f5a2c', ranged: true,  mult: { hp: 1.05, atk: 1.0,  def: 1.0 },  missile: 'leaf', weapon: 'axe' },
  dogwalker:   { core: 'spc',  range: 'one', dmgType: 'animal',   color: '#b07a3e', cape: '#6b4a24', ranged: false, mult: { hp: 1.1,  atk: 1.15, def: 1.05 }, missile: 'dog', weapon: 'leash' },
  gymgoer:     { core: 'def',  range: 'one', dmgType: 'physical', color: '#e0703a', cape: null,      ranged: false, mult: { hp: 1.6,  atk: 0.95, def: 1.35 }, weapon: 'dumbbell' },
  manicurist:  { core: 'def',  range: 'all', dmgType: 'arcane',   color: '#d9649e', cape: '#7a2f5c', ranged: false, mult: { hp: 1.3,  atk: 0.85, def: 1.45 }, missile: 'nail', weapon: 'claw' },
};
G.CLASS_ORDER = ['bloodknight', 'catknight', 'scholar', 'darkpainter', 'pirate', 'wallbringer', 'druid', 'dogwalker', 'gymgoer', 'manicurist'];
G.CORE_ICON  = { atk: '⚔️', buff: '✨', spc: '🔮', def: '🛡️' };
G.DMG_TYPES  = { physical: '#ffffff', animal: '#ffd27a', arcane: '#8fd3ff', dark: '#c99bff' };   // 傷害數字顏色
G.BASIC_MULT = { one: 1.0, all: 0.55 };   // 普攻倍率：全體每下較弱

// ── 團隊特效（名稱：syn.<id>.name；效果文字：syn.b.<key>）──────────────────
// 依出戰成員（主角＋夥伴／雇用好友）的傷害系別觸發，效果併入全隊光環
//   mix   = 三人系別各不相同且剛好是這三種
//   type  = 同系別人數達到 tiers 的門檻（取最高的一階）
// bonus 欄位：spdPct 攻速  cdr 冷卻縮短  dmgPct 全體傷害  debuffDur 我方施加的減益持續時間
//   critDmg 暴擊傷害（加在倍率上）  hpPct 生命  defPct 防禦  cannonInterval 船砲間隔秒數（取最短）
G.TEAM_SYNERGIES = [
  { id: 'wildhunt', mix: ['animal', 'physical', 'dark'],   bonus: { spdPct: 0.18, cannonInterval: 5 } },
  { id: 'triad',    mix: ['animal', 'physical', 'arcane'], bonus: { critDmg: 0.10, hpPct: 0.15, defPct: 0.01 } },
  { id: 'animal',   type: 'animal',   tiers: { 2: { cdr: 0.15 },      3: { cdr: 0.24 } } },
  { id: 'physical', type: 'physical', tiers: { 2: { spdPct: 0.07 },   3: { spdPct: 0.16 } } },
  { id: 'arcane',   type: 'arcane',   tiers: { 2: { dmgPct: 0.15 },   3: { dmgPct: 0.27 } } },
  { id: 'dark',     type: 'dark',     tiers: { 2: { debuffDur: 0.2 }, 3: { debuffDur: 0.4 } } },
];
G.CANNON_INTERVAL = 6;   // 船砲預設每幾秒一發

// ── 技能（名稱/說明：skill.<id>.name / .desc；{v} 代入數值）────────────────
// 主動：fx(v, rank) 回傳這招的效果，戰鬥場景會依欄位執行：
//   target 'one'|'all'|'none'  mult 傷害倍率  hits 段數  critBonus 額外暴擊率
//   debuffs [{id,v,t}] 對命中目標上狀態    self / party [{id,v,t}] 給自己/全隊上 buff
//   heal 全隊回復最大生命比例  shield 全隊護盾比例  taunt {v,t} 挑釁並減傷
//   drain 傷害轉生命比例  vsBleed 對流血目標額外倍率  summon 動物 id（目前沒有技能使用）  cdCut 全隊主動技能冷卻減少秒數
// 被動：p = 'self' 自身屬性 / 'party' 全隊光環 / 'proc' 普攻附加 / 'special' 特殊機制
//   key = 影響的屬性或機制；proc 另有 fx（狀態）、chance（'v' = 機率吃 v）、val、t
// buff/debuff id：atkUp spdUp defUp dmgReduce critUp evade skillDmg regen reflectUp ｜ stun（暈眩，見 G.STUN） defDown slow blind bleed poison
// v(rank) = 該等級數值；v2(rank) = 第二個數值（說明 {v2}）；被動有 key2 時 v2 加到 key2 屬性
// raw: true → {v} 直接顯示不換百分比
// tier = 技能樹層級（需要在該職業投入 G.TIER_REQ 點）
const lin = (base, per) => r => +(base + per * (r - 1)).toFixed(4);
G.TIER_REQ = [0, 3, 8];
G.ACTIVE_SLOTS = 4;
G.PASSIVE_SLOTS = 4;
G.DOT = { bleed: 0.3, poison: 0.22 };
// 暈眩：不能攻擊也不能放技能；受到傷害 +15%、無法閃避；被觸發減益、被暴擊的機率 ×1.5
G.STUN = { taken: 0.15, procMult: 1.5, critMult: 1.5 };   // 每秒傷害 = 施放者攻擊 × 倍率

const A = (id, tier, cd, v, fx, extra) => Object.assign({ id, type: 'active', tier, max: 5, cd, v, fx }, extra);
const P = (id, tier, v, p, key, extra) => Object.assign({ id, type: 'passive', tier, max: 5, v, p, key }, extra);

G.SKILLS = {
  villager: [
    A('smash', 0, 6, lin(1.8, 0.2), v => ({ target: 'one', mult: v })),
  ],

  // 血騎士：吸血續戰、流血
  bloodknight: [
    A('bk_slash',     0, 5,  lin(2.2, 0.25), v => ({ target: 'one', mult: v, debuffs: [{ id: 'bleed', v: 1, t: 5 }] })),
    A('bk_rend',      0, 8,  lin(0.9, 0.12), v => ({ target: 'one', mult: v, hits: 3, debuffs: [{ id: 'bleed', v: 1, t: 6 }] })),
    A('bk_feast',     1, 10, lin(1.8, 0.25), v => ({ target: 'one', mult: v, drain: 1 })),
    A('bk_bloodlust', 1, 15, lin(0.4, 0.1),  v => ({ target: 'none', self: [{ id: 'atkUp', v, t: 8 }] })),
    A('bk_execute',   2, 12, lin(2.5, 0.3),  v => ({ target: 'one', mult: v, vsBleed: 1 })),
    P('bk_drain',      0, lin(0.05, 0.03), 'self', 'lifesteal'),
    P('bk_hemorrhage', 0, lin(0.25, 0.1),  'proc', 'bleed', { fx: 'bleed', chance: 'v', val: 1, t: 4 }),
    P('bk_frenzy',     1, lin(5, 3),       'self', 'crit', { raw: true }),
    P('bk_thirst',     1, lin(0.1, 0.05),  'special', 'vsBleed'),
    P('bk_vitality',   2, lin(0.1, 0.06),  'self', 'hpPct'),
  ],

  // 貓鎧者：士氣 / 吸貓狂熱、貓抓降攻速、中毒
  catknight: [
    A('ck_volley',    0, 6,  lin(0.9, 0.15),  v => ({ target: 'all', mult: v, debuffs: [{ id: 'slow', v: 0.2, t: 4 }] })),
    A('ck_toxic',     0, 8,  lin(0.6, 0.1),   v => ({ target: 'all', mult: v, debuffs: [{ id: 'poison', v: 1, t: 6 }] })),
    A('ck_fullburst', 1, 12, lin(1.2, 0.2),   v => ({ target: 'all', mult: v, debuffs: [{ id: 'slow', v: 0.3, t: 5 }, { id: 'defDown', v: 0.2, t: 5 }] })),
    A('ck_rally',     1, 15, lin(0.2, 0.06),  v => ({ target: 'none', party: [{ id: 'atkUp', v, t: 10 }] })),
    A('ck_purr',      2, 14, lin(0.12, 0.04), v => ({ target: 'none', heal: v, party: [{ id: 'regen', v: 0.01, t: 5 }] })),   // 之後 5 秒每秒再回 1%
    P('ck_morale',  0, lin(5, 2.5),    'special', 'morale', { raw: true }),   // 士氣上限（5 級 = 15%）
    // 吸貓狂熱：隊伍傷害疊層上限 5%→15%；裝的人自己另外加閃避、暴擊傷害、對中毒敵人傷害（also = 額外的自身屬性）
    P('ck_frenzy',  0, lin(5, 2.5),    'special', 'frenzy', { raw: true, also: { evade: lin(0.05, 0.0125), critDmg: lin(0.2, 0.025), vsPoison: lin(0.05, 0.025) } }),
    P('ck_claws',   1, lin(0.1, 0.05), 'proc', 'slow',   { fx: 'slow', val: 'v', t: 4 }),
    // 貓肉球拍打：普攻機率中毒；另外獨立 10% 機率暈眩 1→1.5 秒
    P('ck_venom',   1, lin(0.15, 0.08), 'proc', 'poison', { fx: 'poison', chance: 'v', val: 1, t: 5, v2: lin(1, 0.125), v2raw: true,
      more: [{ fx: 'stun', chance: 0.1, val: 1, t: lin(1, 0.125) }] }),
    P('ck_plate',   2, lin(0.08, 0.06), 'self', 'defPct'),
  ],

  // 學者：書海全體攻擊、危機意識、多賺金幣
  scholar: [
    A('sc_barrage', 0, 6,  lin(0.45, 0.08), v => ({ target: 'all', mult: v, hits: 3 })),
    A('sc_tome',    0, 8,  lin(1.4, 0.22),  v => ({ target: 'all', mult: v })),
    A('sc_lecture', 1, 10, lin(0.8, 0.12),  v => ({ target: 'all', mult: v, debuffs: [{ id: 'defDown', v: 0.15, t: 5 }] })),
    A('sc_cram',    1, 15, lin(0.35, 0.08), v => ({ target: 'none', self: [{ id: 'atkUp', v, t: 8 }, { id: 'spdUp', v: 0.2, t: 8 }] })),
    A('sc_exam',    2, 12, lin(1.1, 0.18),  v => ({ target: 'all', mult: v, critBonus: 100 })),
    P('sc_crisis',  0, lin(0.1, 0.03),  'special', 'crisis', { v2: lin(0.2, 0.05) }),
    P('sc_grant',   0, lin(0.08, 0.05), 'party', 'goldPct'),
    P('sc_wisdom',  1, lin(0.06, 0.04), 'self', 'atkPct'),
    P('sc_speed',   1, lin(0.06, 0.04), 'self', 'spdPct'),
    P('sc_thesis',  2, lin(0.08, 0.05), 'self', 'skillDmg'),
  ],

  // 暗黑畫家：降命中、降防、全隊加攻速
  darkpainter: [
    A('dp_splash',      0, 6,  lin(0.8, 0.14), v => ({ target: 'all', mult: v, debuffs: [{ id: 'blind', v: 0.2, t: 4 }] })),
    A('dp_erase',       0, 8,  lin(0.7, 0.12), v => ({ target: 'all', mult: v, debuffs: [{ id: 'defDown', v: 0.25, t: 6 }] })),
    A('dp_sketch',      1, 14, lin(0.2, 0.06), v => ({ target: 'none', party: [{ id: 'spdUp', v, t: 8 }] })),
    A('dp_nightmare',   1, 12, lin(1.3, 0.2),  v => ({ target: 'all', mult: v, debuffs: [{ id: 'blind', v: 0.3, t: 5 }, { id: 'slow', v: 0.2, t: 5 }] })),
    A('dp_masterpiece', 2, 18, lin(0.15, 0.05), v => ({ target: 'none', party: [{ id: 'atkUp', v, t: 10 }, { id: 'spdUp', v: 0.15, t: 10 }] })),
    P('dp_ink',     0, lin(0.08, 0.04), 'proc', 'blind',   { fx: 'blind', val: 'v', t: 3 }),
    P('dp_corrode', 0, lin(0.06, 0.03), 'proc', 'defDown', { fx: 'defDown', val: 'v', t: 4 }),
    P('dp_tempo',   1, lin(0.04, 0.02), 'party', 'spdPct'),
    P('dp_darkart', 1, lin(0.06, 0.04), 'self', 'atkPct'),
    P('dp_gallery', 2, lin(0.15, 0.1),  'self', 'debuffDur'),
  ],

  // 海盜：雙槍高單體、閃避
  pirate: [
    A('pi_doubletap', 0, 5,  lin(1.2, 0.15), v => ({ target: 'one', mult: v, hits: 2 })),
    A('pi_headshot',  0, 9,  lin(3.0, 0.35), v => ({ target: 'one', mult: v, critBonus: 50 })),
    A('pi_broadside', 1, 12, lin(0.5, 0.08), v => ({ target: 'one', mult: v, hits: 5 })),
    A('pi_smoke',     1, 14, lin(0.3, 0.06), v => ({ target: 'none', self: [{ id: 'evade', v, t: 6 }] })),
    A('pi_plunder',   2, 10, lin(2.0, 0.25), v => ({ target: 'one', mult: v, self: [{ id: 'atkUp', v: 0.2, t: 6 }] })),
    P('pi_nimble',   0, lin(0.06, 0.03), 'self', 'evade'),
    P('pi_sharp',    0, lin(5, 3),       'self', 'crit', { raw: true }),
    P('pi_quick',    1, lin(0.08, 0.04), 'self', 'spdPct'),
    P('pi_ruthless', 1, lin(0.15, 0.1),  'self', 'critDmg'),
    P('pi_riposte',  2, lin(0.6, 0.15),  'special', 'riposte'),
  ],

  // 城牆者：幫隊友扛傷、降隊友受傷、全隊防禦
  wallbringer: [
    A('wb_bash',    0, 6,  lin(1.5, 0.2),   v => ({ target: 'one', mult: v })),
    A('wb_provoke', 0, 12, lin(0.3, 0.06),  v => ({ target: 'none', taunt: { v, t: 6 } })),
    A('wb_bulwark', 1, 14, lin(0.15, 0.04), v => ({ target: 'none', party: [{ id: 'dmgReduce', v, t: 6 }] })),
    A('wb_fortify', 1, 15, lin(0.25, 0.07), v => ({ target: 'none', party: [{ id: 'defUp', v, t: 10 }] })),
    A('wb_aegis',   2, 16, lin(0.12, 0.04), v => ({ target: 'none', shield: v })),
    P('wb_cover',    0, lin(0.15, 0.07), 'special', 'cover'),
    P('wb_stone',    0, lin(0.1, 0.08),  'self', 'defPct'),
    P('wb_guardian', 1, lin(0.04, 0.02), 'party', 'dmgReduce'),
    P('wb_rampart',  1, lin(0.1, 0.07),  'self', 'hpPct'),
    P('wb_thorns',   2, lin(0.1, 0.06),  'special', 'thorns'),
  ],

  // 德魯伊：動物之靈附身全隊，各給一種限時全隊 buff（不再召喚動物上場）
  //   數值略低於其他職業的同類單一 buff（例如貓鎧者鼓舞、城牆者加固），因為德魯伊有四種可輪流掛
  //   持續 8 秒／冷卻 16 秒 ≈ 50% 覆蓋率；滿級野性之絆 +30% 持續 → 約 65%
  druid: [
    A('dr_bear',   0, 16, lin(0.15, 0.04),   v => ({ target: 'none', party: [{ id: 'defUp',  v, t: 8 }] })),
    A('dr_wolf',   0, 16, lin(0.12, 0.03),   v => ({ target: 'none', party: [{ id: 'atkUp',  v, t: 8 }] })),
    A('dr_owl',    1, 16, lin(6, 1.5),       v => ({ target: 'none', party: [{ id: 'critUp', v, t: 8 }] }), { raw: true }),
    A('dr_deer',   1, 18, lin(0.01, 0.003),  v => ({ target: 'none', party: [{ id: 'regen',  v, t: 6 }] })),
    A('dr_thorns', 2, 9,  lin(0.9, 0.15),    v => ({ target: 'all', mult: v, debuffs: [{ id: 'slow', v: 0.15, t: 4 }] })),
    P('dr_bond',   0, lin(0.1, 0.05),    'self', 'buffDur'),     // 自己施放的增益持續時間 +v
    P('dr_grove',  0, lin(0.04, 0.02),   'party', 'hpPct'),
    P('dr_spirit', 1, lin(0.003, 0.0015), 'party', 'regen'),
    P('dr_wild',   1, lin(0.06, 0.04),   'self', 'atkPct'),
    P('dr_herd',   2, lin(0.06, 0.04),   'self', 'buffPow'),     // 自己施放的增益數值 +v（相對）
  ],

  // 遛狗者：全隊減冷卻、加攻速、加技能傷害
  dogwalker: [
    A('dw_fetch',   0, 6,  lin(1.8, 0.25), v => ({ target: 'one', mult: v })),
    A('dw_walkies', 0, 14, lin(2, 0.5),    (v, r) => ({ target: 'none', cdCut: v, heal: lin(0.1, 0.0125)(r) }), { raw: true, v2: lin(0.1, 0.0125) }),   // 回血 10%→15%
    A('dw_zoomies', 1, 14, lin(0.25, 0.06), v => ({ target: 'none', party: [{ id: 'spdUp', v, t: 8 }] })),
    A('dw_pack',    1, 10, lin(0.55, 0.08), v => ({ target: 'one', mult: v, hits: 4 })),
    A('dw_goodboy', 2, 16, lin(0.2, 0.06), v => ({ target: 'none', party: [{ id: 'skillDmg', v, t: 10 }] })),
    P('dw_leash',   0, lin(0.05, 0.03), 'party', 'cdr'),
    P('dw_trainer', 0, lin(0.04, 0.03), 'party', 'skillDmg'),
    P('dw_loyal',   1, lin(0.06, 0.04), 'self', 'atkPct', { key2: 'lifesteal', v2: lin(0.2, 0.025) }),   // 另外吸血 20%→30%
    P('dw_stride',  1, lin(0.03, 0.02), 'party', 'spdPct'),
    // 狗狗狂吼：觸發時同時上緩速＋致盲（降命中）＋破防；v2 = 致盲與破防數值 10%→17%
    P('dw_bark',    2, lin(0.15, 0.08), 'proc', 'slow', { fx: 'slow', chance: 'v', val: 0.2, t: 3, v2: lin(0.1, 0.0175), more: ['blind', 'defDown'] }),
  ],

  // 美甲師：全隊反彈傷害、護盾、防禦；特化反彈
  //   反彈 = 隊友被敵人打到時，把「實際受到的傷害 × 反彈率」打回去（不吃攻擊力，所以敵人越痛反越痛）
  //   全隊反彈率 = 倒刺美甲（常駐光環）＋ 水晶尖甲／頂級沙龍（限時 buff）＋ 城牆者尖刺城牆（只算自己）
  manicurist: [
    A('mc_scratch', 0, 6,  lin(0.7, 0.12),  v => ({ target: 'all', mult: v })),
    A('mc_gel',     0, 14, lin(0.1, 0.03),  v => ({ target: 'none', shield: v })),
    A('mc_spikes',  1, 15, lin(0.3, 0.08),  v => ({ target: 'none', party: [{ id: 'reflectUp', v, t: 8 }] })),
    A('mc_topcoat', 1, 15, lin(0.2, 0.05),  v => ({ target: 'none', party: [{ id: 'defUp', v, t: 10 }] })),
    A('mc_salon',   2, 18, lin(0.45, 0.1),  v => ({ target: 'none', shield: 0.12, party: [{ id: 'reflectUp', v, t: 8 }] })),
    P('mc_thorn',   0, lin(0.06, 0.03), 'party', 'reflect'),
    P('mc_harden',  0, lin(0.04, 0.02), 'party', 'defPct'),
    P('mc_gelcoat', 1, lin(0.1, 0.07),  'self', 'hpPct'),
    P('mc_mirror',  1, lin(0.2, 0.12),  'party', 'reflectPow'),
    P('mc_art',     2, lin(0.15, 0.1),  'self', 'shieldPow'),
  ],

  // 健身者：幫隊友平均分攤傷害、自己緩緩回血
  gymgoer: [
    A('gy_punch',    0, 6,  lin(1.6, 0.2),   v => ({ target: 'one', mult: v })),
    A('gy_squat',    0, 12, lin(0.2, 0.05),  v => ({ target: 'none', selfHeal: v })),
    A('gy_flex',     1, 12, lin(0.3, 0.08),  v => ({ target: 'none', taunt: { v: 0.2, t: 6 }, self: [{ id: 'defUp', v, t: 6 }] })),
    A('gy_protein',  1, 14, lin(0.1, 0.03),  v => ({ target: 'none', heal: v })),
    A('gy_superset', 2, 10, lin(0.7, 0.1),   v => ({ target: 'one', mult: v, hits: 3 })),
    P('gy_buddy',     0, lin(0.3, 0.05),  'special', 'share'),
    P('gy_recovery',  0, lin(0.01, 0.005), 'self', 'regen'),
    P('gy_bulk',      1, lin(0.12, 0.08), 'self', 'hpPct'),
    P('gy_core',      1, lin(0.08, 0.06), 'self', 'defPct'),
    P('gy_endurance', 2, lin(0.04, 0.03), 'self', 'dmgReduce'),
  ],
};

// 動物造型與舊召喚資料（德魯伊已改成全隊 buff，暫時沒有技能召喚）：aura = 在場時給全隊的加成種類；stats = 以施放者屬性為基準的倍率
G.ANIMALS = {
  bear: { icon: '🐻', aura: 'defPct', stats: { hp: 1.4, atk: 0.4, def: 1.2 }, color: '#7a5230' },
  wolf: { icon: '🐺', aura: 'atkPct', stats: { hp: 0.6, atk: 0.8, def: 0.6 }, color: '#8a8f99' },
  owl:  { icon: '🦉', aura: 'crit',   stats: { hp: 0.4, atk: 0.5, def: 0.4 }, color: '#a07a50' },
  deer: { icon: '🦌', aura: 'regen',  stats: { hp: 0.7, atk: 0.3, def: 0.7 }, color: '#c08a50' },
};
// 狀態圖示
G.FX_ICON = {
  atkUp: '⚔️', spdUp: '💨', defUp: '🛡️', dmgReduce: '🧱', critUp: '🎯', evade: '🌀', skillDmg: '✨', regen: '💚', reflectUp: '💅',
  shield: '🔰', taunt: '😤', morale: '🎖️', frenzy: '🐾',
  stun: '💫', defDown: '💔', slow: '🐌', blind: '🌫️', bleed: '🩸', poison: '☠️',
};

// ── 怪物（名稱：monster.<id>）──────────────────────────────────────────────
// 每 5 層換一組怪；shape 決定程式畫的造型
G.MONSTER_TIERS = [
  [{ id: 'cloudSlime', shape: 'slime', color: '#7ec8e3' }, { id: 'windBat', shape: 'bat', color: '#8a7fb5' }, { id: 'rubbleGolem', shape: 'golem', color: '#9a8f80' }],
  [{ id: 'thunderBird', shape: 'bird', color: '#f2d24b' }, { id: 'skyJelly', shape: 'jelly', color: '#e58fd6' }, { id: 'ironCrow', shape: 'bird', color: '#5b5f6b' }],
  [{ id: 'gargoyle', shape: 'bat', color: '#6b7d8c' }, { id: 'cloudGiant', shape: 'golem', color: '#d8e4f0' }, { id: 'riftSlime', shape: 'slime', color: '#b04be0' }],
  [{ id: 'voidJelly', shape: 'jelly', color: '#5b3daf' }, { id: 'starGolem', shape: 'golem', color: '#2f3b66' }, { id: 'skyWarden', shape: 'bird', color: '#ffd27a' }],
  // 第 21 層起：裂洞上方的「天空之海」，海洋生物（每 5 層 2 種）
  [{ id: 'bubbleCrab', shape: 'crab', color: '#e8604c' }, { id: 'skyStarfish', shape: 'starfish', color: '#ffb347' }],
  [{ id: 'pearlClam', shape: 'clam', color: '#e9d6c2' }, { id: 'cloudPuffer', shape: 'puffer', color: '#9fd3ef' }],
  [{ id: 'inkOctopus', shape: 'octopus', color: '#b05a9e' }, { id: 'thunderUrchin', shape: 'urchin', color: '#5a4a8a' }],
  [{ id: 'tideSeahorse', shape: 'seahorse', color: '#4fc3a1' }, { id: 'isleTurtle', shape: 'turtle', color: '#6b9a5a' }],
  [{ id: 'stormEel', shape: 'eel', color: '#3a7bd5' }, { id: 'skyWhale', shape: 'whale', color: '#5b7fb5' }],
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
// perk = 專屬 buff（永久、不能升級；出戰時給全隊，文字：perk.<stat>）
//   cdr 技能冷卻縮短、procRate 觸發率（暴擊、流血、中毒、緩速等機率 ×(1+v)）
G.PARTNERS = [
  { id: 'ella', floor: 2,  hair: '#d9a066', skin: '#f3d2b3', perk: { stat: 'cdr',      v: 0.10 } },
  { id: 'bram', floor: 4,  hair: '#3b2a1e', skin: '#d9a47a', perk: { stat: 'defPct',   v: 0.06 } },
  { id: 'lina', floor: 7,  hair: '#f5e6a8', skin: '#f6dcc4', perk: { stat: 'hpPct',    v: 0.08 } },
  { id: 'kael', floor: 10, hair: '#222831', skin: '#e0b895', perk: { stat: 'atkPct',   v: 0.06 } },
  { id: 'mira', floor: 14, hair: '#9c7be0', skin: '#f1d1c0', perk: { stat: 'procRate', v: 0.15 } },
];
G.partnerRecruitCost = p => 80 * p.floor;
G.partnerLevelCost = lv => Math.round(50 * Math.pow(1.3, lv - 1));

// ── 飛空艇（部位名稱：part.<id>.name；款式名稱：part.<id>.<0~4>）───────────
// 每個部位 5 款，越後面越強、外觀也不同；買過的款式可以自由切換
// v = 每款的效果數值；free = 第 0 款開局就有（熱氣球、船身）；costMult = 價格倍率
//   balloon 全隊生命%  hull 全隊防禦%（也決定家園大小）  bow 全隊傷害%  charm 全隊冒險金幣%
//   cannon 砲擊傷害（攻擊力倍率，每 6 秒）  wing / engine 可爬層數 +N
G.SHIP_SLOTS = ['balloon', 'hull', 'bow', 'charm', 'cannon', 'wing', 'engine'];
G.SHIP_PARTS = {
  balloon: { icon: '🎈', stat: 'hpPct',   v: [0, 0.08, 0.16, 0.26, 0.40], free: true, costMult: 1 },
  hull:    { icon: '🚢', stat: 'defPct',  v: [0, 0.08, 0.16, 0.26, 0.40], free: true, costMult: 1.2 },
  bow:     { icon: '🗿', stat: 'dmgPct',  v: [0.05, 0.10, 0.18, 0.28, 0.40], costMult: 1.3 },
  charm:   { icon: '🔔', stat: 'goldPct', v: [0.10, 0.20, 0.35, 0.55, 0.80], costMult: 1 },
  cannon:  { icon: '💣', stat: 'cannon',  v: [0.3, 0.6, 1.0, 1.6, 2.5], costMult: 1.1 },
  wing:    { icon: '🕊️', stat: 'floors',  v: [5, 10, 15, 20, 25], costMult: 0.9 },
  engine:  { icon: '⚙️', stat: 'floors',  v: [5, 10, 15, 20, 25], costMult: 1 },
};
G.SHIP_BASE_FLOORS = 5;   // 沒有穩定翼和引擎時只能到第 5 層
G.SHIP_COST = [
  { gold: 400,    crystal: 0 },
  { gold: 2500,   crystal: 5 },
  { gold: 10000,  crystal: 20 },
  { gold: 40000,  crystal: 60 },
  { gold: 140000, crystal: 160 },
];
G.shipPartCost = (slot, i) => {
  const P = G.SHIP_PARTS[slot];
  if (P.free && i === 0) return { gold: 0, crystal: 0 };
  const c = G.SHIP_COST[i];
  return { gold: Math.round(c.gold * P.costMult), crystal: Math.round(c.crystal * P.costMult) };
};
G.homeSize = tier => [{ w: 4, h: 3 }, { w: 5, h: 3 }, { w: 5, h: 4 }, { w: 6, h: 5 }, { w: 6, h: 6 }][Math.max(0, Math.min(4, tier))];
G.SHIP_PAINTS = ['#b5523b', '#3b6fb5', '#3b8f5a', '#7a4bb5', '#d4a017', '#3a3a3a'];

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

// ── 上升詛咒：越往上越常出現，降低全隊傷害或防禦 ─────────────────────────
// 每一層的詛咒是固定的（用層數算出來），不會每次進去都不同
G.CURSE_START = 10;
G.curseFor = f => {
  if (f < G.CURSE_START) return null;
  const h = (Math.imul(f, 2654435761) >>> 0) % 1000;
  const chance = Math.min(850, 400 + (f - G.CURSE_START) * 15);   // 第 10 層 40% → 第 40 層 85%
  if (h >= chance) return null;
  const v = +Math.min(0.35, 0.06 + (f - G.CURSE_START) * 0.008).toFixed(3);
  if (f >= 25 && h % 3 === 0) return { dmg: +(v * 0.75).toFixed(3), def: +(v * 0.75).toFixed(3) };   // 雙重詛咒
  return h % 2 ? { dmg: v, def: 0 } : { dmg: 0, def: v };
};

// ── 捕獸網（裝備型，名稱：net.<id>）：裝一張就永久生效 ────────────────────
G.NETS = [
  { id: 'spider',  icon: '🕸️', rate: 0.01, gold: 300,    crystal: 0 },
  { id: 'fishing', icon: '🎣', rate: 0.02, gold: 2000,   crystal: 0 },
  { id: 'wire',    icon: '⛓️', rate: 0.03, gold: 8000,   crystal: 10 },
  { id: 'money',   icon: '💰', rate: 0.04, gold: 30000,  crystal: 40 },
  { id: 'mystery', icon: '🔮', rate: 0.05, gold: 100000, crystal: 120 },
];

// ── 怪物圖鑑：打倒層主登錄該層怪物、捕獲再點亮一次，各領一次雲晶 ─────────
G.dexReward = (tier, kind) => (kind === 'caught' ? 10 + tier * 5 : 3 + tier * 2);
G.monsterTierOf = id => G.MONSTER_TIERS.findIndex(t => t.some(m => m.id === id));

// 捕獲的怪物：隨機一個小增益（全隊），主要是收集用
G.PET_BONUSES = [
  { stat: 'atkPct', v: 0.01 }, { stat: 'defPct', v: 0.01 }, { stat: 'hpPct', v: 0.01 },
  { stat: 'spdPct', v: 0.01 }, { stat: 'goldPct', v: 0.02 }, { stat: 'crit', v: 0.5 },
];

// 開場對話頁數（內容：prologue.1 ～ prologue.N）
// INTRO_VER 改版時 +1，看過舊版開場的玩家會再看一次新的
G.PROLOGUE_PAGES = 3;
G.INTRO_VER = 2;
