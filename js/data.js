// ════════════════════════════════════════════════════════════════════════════
// 遊戲資料表：數值、職業、技能、怪物、裝備、夥伴、家具、飛空艇
// 想調平衡或加內容，大部分只要改這個檔案
// 顯示文字（名稱、說明）不放這裡，放在 lang/*.js，用 id 對應
// ════════════════════════════════════════════════════════════════════════════
window.G = window.G || {};

G.CONFIG = {
  killsPerFloor: 10,        // 每層打幾隻小怪後出現層主
  classUnlockLevel: 3,      // 幾等可以轉職
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
  evadeCap: 0.9,            // 閃避率上限（原本 60% → 80% → 90%）
  cdrCap: 0.8,              // 技能冷卻縮短上限（原本 50%）

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
// core  = 定位：atk 攻擊 / buff 輔助 / def 防禦（只用在顯示標籤）
// range = 普攻範圍：all 打全部敵人但每下較弱 / one 只打一隻但較痛
// dmgType = 傷害系別：physical 物理 / animal 動物 / arcane 奧術 / dark 黑暗（之後做組合特效用）
// ranged = 站後排；missile = 普攻投射物造型；shots = 普攻一次打幾發
// weapon = 紙娃娃固定拿的職業武器（不受裝備影響）
G.CLASSES = {
  villager:    { core: 'atk',  range: 'one', dmgType: 'physical', color: '#8b6f47', cape: null,      ranged: false, mult: { hp: 1,    atk: 1,    def: 1 }, weapon: 'pitchfork' },
  bloodknight: { core: 'atk',  range: 'one', dmgType: 'physical', color: '#c0392b', cape: '#8b1a1a', ranged: false, mult: { hp: 1.15, atk: 1.35, def: 0.95 }, weapon: 'dualsword' },
  catknight:   { core: 'buff', range: 'all', dmgType: 'animal',   color: '#9aa3ad', cape: '#d98a3a', ranged: false, mult: { hp: 1.25, atk: 1.0,  def: 1.25 }, missile: 'cat', weapon: 'longsword' },
  scholar:     { core: 'buff', range: 'all', dmgType: 'arcane',   color: '#3f6fb5', cape: '#24477a', ranged: true,  mult: { hp: 0.9,  atk: 1.3,  def: 0.85 }, missile: 'book', weapon: 'openbook' },
  darkpainter: { core: 'buff', range: 'all', dmgType: 'dark',     color: '#5b3d7a', cape: '#2a1a3d', ranged: true,  mult: { hp: 0.95, atk: 1.1,  def: 0.9 },  missile: 'paint', weapon: 'brush' },
  pirate:      { core: 'atk',  range: 'one', dmgType: 'physical', color: '#7a2f2f', cape: '#2b2b2b', ranged: true,  mult: { hp: 1.0,  atk: 1.4,  def: 0.85 }, missile: 'bullet', shots: 2, weapon: 'pistol' },
  wallbringer: { core: 'def',  range: 'one', dmgType: 'physical', color: '#8a8f99', cape: '#4a5560', ranged: false, mult: { hp: 1.5,  atk: 0.8,  def: 1.7 },  weapon: 'tower' },
  druid:       { core: 'buff', range: 'all', dmgType: 'animal',   color: '#4f8a4a', cape: '#2f5a2c', ranged: true,  mult: { hp: 1.05, atk: 1.0,  def: 1.0 },  missile: 'leaf', weapon: 'axe' },
  dogwalker:   { core: 'buff', range: 'one', dmgType: 'animal',   color: '#b07a3e', cape: '#6b4a24', ranged: false, mult: { hp: 1.1,  atk: 1.15, def: 1.05 }, missile: 'dog', weapon: 'leash' },
  gymgoer:     { core: 'def',  range: 'one', dmgType: 'physical', color: '#e0703a', cape: null,      ranged: false, mult: { hp: 1.6,  atk: 0.95, def: 1.35 }, weapon: 'dumbbell' },
  necromancer: { core: 'atk',  range: 'one', dmgType: 'dark',     color: '#3a2f4a', cape: '#1a1424', ranged: true,  mult: { hp: 0.95, atk: 1.25, def: 0.9 },  missile: 'skull', weapon: 'scythe' },
  captain:     { core: 'atk',  range: 'one', dmgType: 'arcane',   color: '#2f4a7a', cape: '#1f2f4f', ranged: true,  mult: { hp: 1.0,  atk: 1.2,  def: 1.0 },  missile: 'flare', weapon: 'spyglass' },
  manicurist:  { core: 'def',  range: 'all', dmgType: 'arcane',   color: '#d9649e', cape: '#7a2f5c', ranged: false, mult: { hp: 1.3,  atk: 0.85, def: 1.45 }, missile: 'nail', weapon: 'claw' },
};
G.CLASS_ORDER = ['bloodknight', 'catknight', 'scholar', 'darkpainter', 'pirate', 'wallbringer', 'druid', 'dogwalker', 'gymgoer', 'manicurist', 'necromancer', 'captain'];
G.CORE_ICON  = { atk: '⚔️', buff: '✨', def: '🛡️' };
G.DMG_TYPES  = { physical: '#ffffff', animal: '#ffd27a', arcane: '#8fd3ff', dark: '#c99bff' };   // 傷害數字顏色
G.BASIC_MULT = { one: 1.0, all: 0.55 };   // 普攻倍率：全體每下較弱

// ── 團隊特效（名稱：syn.<id>.name；效果文字：syn.b.<key>）──────────────────
// 依出戰成員（主角＋夥伴／雇用好友）的傷害系別觸發，效果併入全隊光環
//   mix   = 三人系別各不相同且剛好是這三種
//   type  = 同系別人數達到 tiers 的門檻（取最高的一階）
// bonus 欄位：spdPct 攻速  cdr 冷卻縮短  dmgPct 全體傷害  debuffDur 我方施加的減益持續時間
//   critDmg 暴擊傷害（加在倍率上）  hpPct 生命  defPct 防禦  cannonInterval 船砲間隔秒數（取最短）  procRate 觸發率
//   arcaneCrit / arcaneCritDmg / arcaneDur：全隊對怪物造成傷害累積 100 次 → 全隊暴擊率（×100 個百分點）、暴擊傷害提升，持續秒數  basicLifesteal 普攻命中回復最大生命比例
G.TEAM_SYNERGIES = [
  { id: 'wildhunt', mix: ['animal', 'physical', 'dark'],   bonus: { spdPct: 0.18, cannonInterval: 5 } },
  { id: 'triad',    mix: ['animal', 'physical', 'arcane'], bonus: { critDmg: 0.10, hpPct: 0.15, defPct: 0.01 } },
  { id: 'animal',   type: 'animal',   tiers: { 2: { cdr: 0.25 },      3: { cdr: 0.35 } } },
  { id: 'physical', type: 'physical', tiers: { 2: { spdPct: 0.07 },   3: { spdPct: 0.10, basicLifesteal: 0.005 } } },   // basicLifesteal：普攻命中回復自己最大生命的比例
  { id: 'arcane',   type: 'arcane',   tiers: { 2: { arcaneCrit: 0.5, arcaneCritDmg: 1.0, arcaneDur: 6 }, 3: { arcaneCrit: 0.55, arcaneCritDmg: 1.1, arcaneDur: 12 } } },   // 全隊打怪累積 100 次 → 全隊暴擊率／暴擊傷害提升 N 秒
  // 暗影纏繞：我方對敵人施加減益（新上、刷新、重上都算 1 次）累積 darkNeed 次 → 全隊攻速／冷卻縮短／每秒回血，持續 darkDur 秒
  { id: 'dark',     type: 'dark',     tiers: { 2: { darkNeed: 200, darkSpd: 0.37, darkCdr: 0.15, darkRegen: 0.015, darkDur: 5 }, 3: { darkNeed: 100, darkSpd: 0.37, darkCdr: 0.15, darkRegen: 0.03, darkDur: 7 } } },
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
// 舊版好友快照（沒有 bare 欄位）上傳時，自身被動的舊數值；用來把舊數值扣回去再套新版
// 只需要記「自身屬性被改過」的被動，其他沿用目前定義
G.LEGACY_SELF = {
  ck_plate:  { defPct: r => lin(0.08, 0.06)(r) },   // 第 18 輪前：重裝鎧甲 防禦 +8%→32%
  ck_frenzy: {},                                    // 第 17 輪前：吸貓狂熱沒有自身屬性
};
G.ACTIVE_SLOTS = 4;
G.PASSIVE_SLOTS = 4;
G.DOT = { bleed: 0.3, poison: 0.22 };
// 暈眩：不能攻擊也不能放技能；受到傷害 +15%、無法閃避；被觸發減益、被暴擊的機率 ×1.5
// 破防累加（米菈 extra）：再次破防時持續時間相加、數值取最高，最多累到幾秒
G.DEFDOWN_STACK_CAP = 30;
G.STUN = { taken: 0.15, procMult: 1.5, critMult: 1.5 };   // 每秒傷害 = 施放者攻擊 × 倍率

const CURSE = { def: lin(0.2, 0.0125), slow: lin(0.2, 0.025) };   // 暗黑繪師「詛咒油畫」的附加數值
const WALL = { reflect: lin(0.2, 0.075), regen: lin(0.005, 0.00125) };   // 盾牆者「盾牆！」的附加數值
const CRAM = { hp: lin(0.05, 0.0175), spd: lin(0.4, 0.0925), t: r => [2, 3, 4, 4.5, 5][r - 1] };   // 臨時抱佛腳：隊友攻速、持續秒數
const RALLY = { syn: lin(0.1, 0.025), animal: lin(0.07, 0.02) };   // 喵喵鼓舞：團隊特效加強、動物系技能傷害
const WOLF = { slow: lin(0.25, 0.025), spd: lin(0.1, 0.025) };   // 狼之靈：自己攻速 -25%→-35%、全隊攻速 +10%→20%
const FERAL = { hp: lin(0.1, 0.0375), spd: lin(0.55, 0.0825), phys: lin(0.55, 0.1125), slow: lin(0.55, 0.0625) };   // 野性狂暴：隊友攻速、物理系隊友攻速、自己減攻速
const SHIP_SKILL_DESC = { sdmg: () => G.shipSkillBonus().dmg, scrit: () => G.shipSkillBonus().crit / 100, scd: () => G.shipSkillBonus().critDmg };   // 船長大招說明用（目前加成）
const WALK = { heal: lin(0.1, 0.0125), evade: lin(0.1, 0.0125), next: lin(0.1, 0.025) };   // 遛狗者散步時間的附加數值
const A = (id, tier, cd, v, fx, extra) => Object.assign({ id, type: 'active', tier, max: 5, cd, v, fx }, extra);
const P = (id, tier, v, p, key, extra) => Object.assign({ id, type: 'passive', tier, max: 5, v, p, key }, extra);

G.SKILLS = {
  villager: [
    A('smash', 0, 6, lin(1.8, 0.2), v => ({ target: 'one', mult: v })),
  ],

  // 血騎士：吸血續戰、流血
  bloodknight: [
    A('bk_slash',     0, 5,  lin(2.2, 0.25), v => ({ target: 'one', mult: v, debuffs: [{ id: 'bleed', v: 1, t: 5 }] })),
    // 撕裂：連砍 3 下並流血；另外下一次處決傷害 +100%→177%（留到用掉為止）
    A('bk_rend',      0, 8,  lin(0.9, 0.12), (v, r) => ({ target: 'one', mult: v, hits: 3, debuffs: [{ id: 'bleed', v: 1, t: 6 }], self: [{ id: 'nextExecute', v: lin(1, 0.1925)(r), t: 9999 }] }),
      { descV: { exe: lin(1, 0.1925) } }),
    A('bk_feast',     1, 10, lin(1.8, 0.25), v => ({ target: 'one', mult: v, drain: 1 })),
    // 血性狂暴（原嗜血）：自身攻擊 +v，8 秒；期間血騎士每次吸血，其他隊友回復 1%→1.5% 最大生命
    A('bk_bloodlust', 1, 15, lin(0.4, 0.1),  (v, r) => ({ target: 'none', self: [{ id: 'atkUp', v, t: 8 }, { id: 'bloodShare', v: lin(0.01, 0.00125)(r), t: 8 }] }),
      { descV: { share: lin(0.01, 0.00125) } }),
    A('bk_execute',   2, 12, lin(2.5, 0.3),  v => ({ target: 'one', mult: v, vsBleed: 1, feverOnKill: 7, feverChance: 0.02, useNextExecute: true })),   // 處決擊殺 → 全隊「血之狂熱」7 秒
    P('bk_drain',      0, lin(0.05, 0.03), 'self', 'lifesteal'),
    P('bk_hemorrhage', 0, lin(0.25, 0.1),  'proc', 'bleed', { fx: 'bleed', chance: 'v', val: 1, t: 4, also: { bleedHeal: lin(0.02, 0) } }),   // bleedHeal：滿血時普攻吸血 50% 機率改補失血最多的隊友 2%
    P('bk_frenzy',     1, lin(5, 3),       'self', 'crit', { raw: true }),
    P('bk_thirst',     1, lin(0.1, 0.085), 'special', 'vsBleed', { also: { bleedCrit: lin(0.01, 0.0225), bleedCritDmg: lin(0.1, 0.05) } }),   // 對流血敵人：傷害 +10%→44%、暴擊率 +1%→10%、暴擊傷害 +10%→30%
    P('bk_vitality',   2, lin(0.1, 0.06),  'self', 'hpPct'),
  ],

  // 貓鎧者：士氣 / 吸貓狂熱、貓抓降攻速、中毒
  catknight: [
    // 貓咪齊射：另外給全隊動物系隊友「下一次技能傷害 +100%」（20 秒內用掉）
    A('ck_volley',    0, 6,  lin(0.9, 0.15),  v => ({ target: 'all', mult: v, debuffs: [{ id: 'slow', v: 0.2, t: 4 }], partyType: { type: 'animal', fx: [{ id: 'nextSkill', v: 1, t: 20 }] } })),
    // 毒爪：對暈眩中的敵人技能傷害 +500%
    A('ck_toxic',     0, 8,  lin(0.6, 0.1),   (v, r) => ({ target: 'all', mult: v, vsStunSkill: lin(5, 0.165)(r), critHealMax: lin(0.04, 0.01)(r), debuffs: [{ id: 'poison', v: 1, t: 6 }] }), { descV: { stun: lin(5, 0.165), heal: lin(0.04, 0.01) } }),   // 對暈眩敵人技能傷害 +500%→566%
    A('ck_fullburst', 1, 12, lin(1.2, 0.2),   v => ({ target: 'all', mult: v, debuffs: [{ id: 'slow', v: 0.3, t: 5 }, { id: 'defDown', v: 0.2, t: 5 }] })),
    // 喵喵鼓舞：全隊攻擊；10 秒內團隊特效數值 +10%→20%（跟獸群之心取高）、全隊動物系技能傷害 +7%→15%
    A('ck_rally',     1, 15, lin(0.2, 0.06),  (v, r) => ({ target: 'none', synBoost: { v: RALLY.syn(r), t: 10 }, party: [{ id: 'atkUp', v, t: 10 }, { id: 'animalSkill', v: RALLY.animal(r), t: 10 }] }),
      { descV: { syn: RALLY.syn, animal: RALLY.animal } }),
    A('ck_purr',      2, 14, lin(0.12, 0.04), v => ({ target: 'none', heal: v, party: [{ id: 'regen', v: 0.01, t: 5 }] })),   // 之後 5 秒每秒再回 1%
    // 貓貓士氣：士氣上限 5%→15%（原本）；另外全隊普攻 1%→2% 機率暈眩 1.5 秒、全隊閃避 +5%→8%
    P('ck_morale',  0, lin(5, 2.5),    'special', 'morale', { raw: true,
      partyStun: { chance: lin(0.01, 0.0025), t: () => 1.5 }, partyAlso: { evade: lin(0.05, 0.0075) } }),
    // 吸貓狂熱：隊伍傷害疊層上限 5%→15%；裝的人自己另外加閃避、暴擊傷害、對中毒敵人傷害（also = 額外的自身屬性）
    P('ck_frenzy',  0, lin(5, 2.5),    'special', 'frenzy', { raw: true, also: { evade: lin(0.05, 0.0125), critDmg: () => 0.3, vsPoison: lin(0.05, 0.025) }, partyAlso: { critDmg: 0.15 } }),   // 暴擊傷害：自己 +30%、全隊 +15%
    // 貓抓印記：普攻緩速；全隊普攻 5%→8% 機率中毒 5 秒（多人裝不疊加）
    P('ck_claws',   1, lin(0.1, 0.05), 'proc', 'slow',   { fx: 'slow', val: 'v', t: 4, partyAlso: { basicPoison: lin(0.05, 0.0075) } }),
    // 貓肉球拍打：普攻機率中毒；另外獨立 7% 機率暈眩 1→1.5 秒
    P('ck_venom',   1, lin(0.15, 0.08), 'proc', 'poison', { fx: 'poison', chance: 'v', val: 1, t: 5, v2: lin(1, 0.125), v2raw: true,
      more: [{ fx: 'stun', chance: 0.07, val: 1, t: lin(1, 0.125) }], partyAlso: { stunHit: 0.005 } }),   // 全隊打到暈眩敵人回 0.5% 生命
    // 貓哈氣爆甲：捨防禦換輸出（1→5 級）。防禦 -80%→-50%、生命固定 -40%、攻擊 +37%→77%、暴擊傷害 +66%→77%、閃避 +8%→15%、
    //   自身技能冷卻 -15%→-25%、攻速 +5%→15%
    //   全隊：飛空艇砲擊間隔 -1 秒、打暈眩中的敵人傷害 +50%（隊上有兩隻不疊加，取最大）
    P('ck_plate',   2, lin(-0.8, 0.075), 'self', 'defPct', { also: { hpPct: lin(-0.4, 0), atkPct: lin(0.37, 0.1), critDmg: lin(0.66, 0.0275), evade: lin(0.08, 0.0175),
        cdr: lin(0.15, 0.025), spdPct: lin(0.05, 0.025) },
      partyAlso: { cannonCut: 1, vsStun: 0.5 }, rawKeys: ['cannonCut'] }),
  ],

  // 學者：書海全體攻擊、危機意識、多賺金幣
  scholar: [
    A('sc_barrage', 0, 6,  lin(0.45, 0.08), v => ({ target: 'all', mult: v, hits: 3 })),
    // 百科全書：全體傷害；施放後 8 秒船砲傷害 +100%→200%，船砲命中 5%→10% 機率解除上升詛咒 4 秒
    A('sc_tome',    0, 8,  lin(1.4, 0.22),  (v, r) => ({ target: 'all', mult: v, tome: { cannon: lin(1, 0.25)(r), purge: lin(0.05, 0.0125)(r), t: 8 } }),
      { descV: { cannon: lin(1, 0.25), purge: lin(0.05, 0.0125) } }),
    A('sc_lecture', 1, 10, lin(0.8, 0.12),  v => ({ target: 'all', mult: v, debuffs: [{ id: 'defDown', v: 0.15, t: 5 }] })),
    // 臨時抱佛腳：扣自己目前生命 25%，其他隊友攻速 +40%→77%，持續 2/3/4/4.5/5 秒；期間學者自己防禦 -30%
    A('sc_cram',    1, 20, CRAM.spd, (v, r) => ({ target: 'none', hpCost: 0.25, partyOthers: [{ id: 'spdUp', v, t: CRAM.t(r) }, { id: 'hpUp', v: CRAM.hp(r), t: CRAM.t(r) }], selfDebuff: [{ id: 'defDown', v: 0.3, t: CRAM.t(r) }] }),   // hpUp：其他隊友最大生命 +5%→12%
      { descV: { t: CRAM.t, hp: CRAM.hp }, rawKeys: ['t'] }),
    A('sc_exam',    2, 12, lin(1.1, 0.18),  v => ({ target: 'all', mult: v, critBonus: 100 })),
    P('sc_crisis',  0, lin(0.1, 0.03),  'special', 'crisis', { v2: lin(0.2, 0.05), partyAlso: { hpPct: lin(0.02, 0.015) } }),   // 另外全隊最大生命 +2%→8%
    P('sc_grant',   0, lin(0.08, 0.05), 'party', 'goldPct'),
    P('sc_wisdom',  1, lin(0.06, 0.04), 'self', 'atkPct', { partyAlso: { shieldDur: 2, shieldAmt: 2, shieldDef: 0.15 }, rawKeys: ['shieldDur', 'shieldAmt', 'shieldDef'] }),   // 另外全隊護盾量、時間 +200%，有護盾時防禦 +15%（跟領航員取高）
    P('sc_speed',   1, lin(0.06, 0.04), 'party', 'spdPctOthers'),   // 速讀：只給其他隊友攻速，學者自己不吃
    // 論文審查：技能傷害；另外把自己的最大生命 10%→15% 分給其他隊友（自己 -、其他人 +，各隊友都 +）
    P('sc_thesis',  2, lin(0.08, 0.05), 'self', 'skillDmg', { also: { hpPct: r => -lin(0.1, 0.0125)(r) }, partyAlso: { hpPctOthers: lin(0.1, 0.0125) } }),
  ],

  // 暗黑畫家：降命中、降防、全隊加攻速
  darkpainter: [
    A('dp_splash',      0, 6,  lin(0.8, 0.14), v => ({ target: 'all', mult: v, debuffs: [{ id: 'blind', v: 0.2, t: 4 }] })),
    // 詛咒油畫（原抹除）：全體 50%→100%；先把敵人身上的減益刷新回完整時間，再上破防 20%→25%、緩速 20%→30%（6 秒）
    //   對中毒 +100%、對流血 +200%（兩個都中就相加 +300%）
    A('dp_erase',       0, 8,  lin(0.5, 0.125), (v, r) => ({ target: 'all', mult: v, refreshDebuffs: true, vsPoisonSkill: 1, vsBleed: 2,
      debuffs: [{ id: 'defDown', v: CURSE.def(r), t: 6 }, { id: 'slow', v: CURSE.slow(r), t: 6 }] }), { descV: { def: CURSE.def, slow: CURSE.slow } }),
    // 速寫：8 秒內船砲間隔減半、每發 1%→5% 機率暈眩全體敵人 1.5 秒；施放時全隊技能冷卻 -2 秒、全隊身上增益延長 2→6 秒
    A('dp_sketch',      1, 14, lin(0.01, 0.01), (v, r) => ({ target: 'none', sketch: { t: 8, chance: v }, cdCut: 2, buffExtend: lin(2, 1)(r) }),
      { v2: lin(2, 1), v2raw: true }),
    A('dp_nightmare',   1, 12, lin(1.3, 0.2),  v => ({ target: 'all', mult: v, debuffs: [{ id: 'blind', v: 0.3, t: 5 }, { id: 'slow', v: 0.2, t: 5 }] })),
    A('dp_masterpiece', 2, 18, lin(0.15, 0.05), v => ({ target: 'none', party: [{ id: 'atkUp', v, t: 10 }, { id: 'spdUp', v: 0.15, t: 10 }] })),
    P('dp_ink',     0, lin(0.08, 0.04), 'proc', 'blind',   { fx: 'blind', val: 'v', t: 3 }),
    // 腐蝕顏料：普攻破防；另外飛空艇砲擊對破防中的敵人傷害 +200%→1000%（多人裝不疊加）
    P('dp_corrode', 0, lin(0.06, 0.03), 'proc', 'defDown', { fx: 'defDown', val: 'v', t: 4, partyAlso: { cannonVsDefDown: lin(2, 2) } }),
    // 筆觸節奏：全隊攻速；另外全隊對暈眩敵人的暴擊傷害 +100%→300%（多人裝不疊加）
    P('dp_tempo',   1, lin(0.04, 0.02), 'party', 'spdPct', { partyAlso: { stunCritDmg: lin(1, 0.5), stunSkillX: 4 }, rawKeys: ['stunSkillX'] }),   // stunSkillX：全隊技能打暈眩敵人最終傷害 ×5
    P('dp_darkart', 1, lin(0.06, 0.04), 'self', 'atkPct'),
    // 畫廊：減益持續時間 +15%→55%；另外普攻讓敵人攻速 -20%→80%，8 秒
    P('dp_gallery', 2, lin(0.15, 0.1),  'self', 'debuffDur', { procAlso: { fx: 'slow', chance: 1, val: lin(0.2, 0.15), t: 8 }, descV: { slow: lin(0.2, 0.15) } }),
  ],

  // 海盜：雙槍高單體、閃避
  pirate: [
    A('pi_doubletap', 0, 5,  lin(1.2, 0.15), v => ({ target: 'one', mult: v, hits: 2 })),
    A('pi_headshot',  0, 9,  lin(3.0, 0.35), v => ({ target: 'one', mult: v, critBonus: 20, critFinalX: 3 })),   // 爆頭！！！：這招暴擊率 +20%，暴擊時最終傷害 ×3
    // 舷砲齊射：連開 5 槍；另外額外發動一次飛空艇砲擊，這發傷害 +10%→77%（不影響砲擊的計時）
    A('pi_broadside', 1, 12, lin(0.5, 0.08), (v, r) => ({ target: 'one', mult: v, hits: 5, cannonShot: lin(0.1, 0.1675)(r), tauntCdr: { v: 0.5, t: 5 } }), { descV: { cannon: lin(0.1, 0.1675) } }),
    // 煙霧彈：自己閃避 +30%→54%；另外全隊閃避 +15%→30%（6 秒，跟自己的取高）、其他隊友立刻回 2% 最大生命
    A('pi_smoke',     1, 14, lin(0.3, 0.06), (v, r) => ({ target: 'none', self: [{ id: 'evade', v, t: 6 }], party: [{ id: 'evade', v: lin(0.15, 0.0375)(r), t: 6 }], healOthers: 0.02 }),
      { descV: { party: lin(0.15, 0.0375) } }),
    // 大爆射一波！（原掠奪）：打暈眩者 → 傷害 +300%→777%、必定暴擊、暴擊傷害 +777%，打完解除暈眩，之後 6 秒打暈眩者必定暴擊、傷害 +777%；打沒暈眩者只有 +300%
    A('pi_plunder',   2, 10, lin(2.0, 0.25), (v, r) => ({ target: 'one', mult: v, stunBonus: { dmgPct: lin(3, 1.1925)(r), forceCrit: true, critDmg: 7.77 }, elseDmgPct: 3, breakStun: true,
      stunHunter: { v: 7.77, t: 6 } }), { descV: { stun: lin(3, 1.1925) } }),
    P('pi_nimble',   0, lin(0.06, 0.03), 'self', 'evade'),
    P('pi_sharp',    0, lin(5, 3),       'self', 'crit', { raw: true, partyAlso: { physCrit: lin(10, 1.5) }, rawKeys: ['physCrit'] }),   // 另外全隊物理系角色暴擊率 +10→16
    // 美式居合（1→5 級）：必定暴擊，溢出暴擊率轉暴擊傷害；閃避 -50%→-20%；狙擊爆頭！！！最終傷害 ×2/3/4/4.5/5
    P('pi_quick',    1, lin(-0.5, 0.075), 'self', 'evade', { also: { iai: () => 1, snipeX: r => [1, 2, 3, 3.5, 4][r - 1] },
      descV: { snipe: r => [2, 3, 4, 4.5, 5][r - 1] }, rawKeys: ['snipe'] }),
    P('pi_ruthless', 1, lin(0.15, 0.1),  'self', 'critDmg'),
    P('pi_riposte',  2, lin(1.99, 2),    'special', 'riposte', { partyAlso: { evade: lin(0.04, 0.015) } }),   // 閃避反擊：每發 199%→999%；全隊閃避 +4%→10%
  ],

  // 城牆者：幫隊友扛傷、降隊友受傷、全隊防禦
  wallbringer: [
    A('wb_bash',    0, 6,  lin(1.5, 0.2),   v => ({ target: 'one', mult: v })),
    A('wb_provoke', 0, 12, lin(0.3, 0.06),  v => ({ target: 'none', taunt: { v, t: 6 } })),
    A('wb_bulwark', 1, 14, lin(0.15, 0.04), v => ({ target: 'none', party: [{ id: 'dmgReduce', v, t: 6 }] })),
    A('wb_fortify', 1, 15, lin(0.25, 0.07), v => ({ target: 'none', party: [{ id: 'defUp', v, t: 10 }] })),
    // 盾牆！（原壁壘護盾）：8 秒內自身輸出 -50%，換防禦 +70%→150%、反彈 +20%→50%、每秒回 0.5%→1% 生命（1→5 級）
    A('wb_aegis',   2, 16, lin(0.7, 0.2), (v, r) => ({ target: 'none', self: [{ id: 'shieldWall', v: 0.5, t: 8 }, { id: 'defUp', v, t: 8 },
      { id: 'reflectUp', v: WALL.reflect(r), t: 8 }, { id: 'regen', v: WALL.regen(r), t: 8 }] }), { descV: { reflect: WALL.reflect, regen: WALL.regen } }),
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
    A('dr_wolf',   0, 16, lin(0.12, 0.03),   (v, r) => ({ target: 'none', party: [{ id: 'atkUp',  v, t: 8 }, { id: 'spdUp', v: WOLF.spd(r), t: 8 }], selfDebuff: [{ id: 'slow', v: WOLF.slow(r), t: 8 }] }),
      { descV: { spd: WOLF.spd, slow: WOLF.slow } }),
    A('dr_owl',    1, 16, lin(6, 1.5),       v => ({ target: 'none', party: [{ id: 'critUp', v, t: 8 }] }), { raw: true }),
    // 鹿之靈：全隊每秒回血 6 秒；另外全隊防禦 +5%→37%、反彈最終傷害 ×2（同 6 秒）
    A('dr_deer',   1, 18, lin(0.01, 0.003),  (v, r) => ({ target: 'none', party: [{ id: 'regen',  v, t: 6 }, { id: 'defUp', v: lin(0.05, 0.08)(r), t: 6 }, { id: 'reflectX', v: 1, t: 6 }] }),
      { descV: { def: lin(0.05, 0.08) } }),
    // 野性狂暴（原荊棘纏繞）：持續 3/4.5/6/8/10 秒；其他隊友攻速 +55%→88%（物理系 +55%→100%）、每秒回 1% 生命；德魯伊自己攻速 -55%→-80%
    A('dr_thorns', 2, 20, r => [3, 4.5, 6, 8, 10][r - 1], (v, r) => ({ target: 'none',
      partyOthers: [{ id: 'spdUp', v: FERAL.spd(r), t: v }, { id: 'regen', v: 0.01, t: v }, { id: 'hpUp', v: FERAL.hp(r), t: v }],   // hpUp：最大生命 +10%→25%
      partyOthersType: { type: 'physical', fx: [{ id: 'spdUp', v: FERAL.phys(r), t: v }] },
      selfDebuff: [{ id: 'slow', v: FERAL.slow(r), t: v }] }), { raw: true, descV: { hp: FERAL.hp, spd: FERAL.spd, phys: FERAL.phys, slow: FERAL.slow } }),
    P('dr_bond',   0, lin(0.1, 0.05),    'self', 'buffDur', { partyAlso: { hpPctOthers: lin(0.05, 0.0125), spdPctOthers: lin(0.01, 0.0125) } }),   // 自己施放的增益持續時間 +v；其他隊友最大生命 +5%→10%、攻速 +1%→6%
    P('dr_grove',  0, lin(0.04, 0.02),   'party', 'hpPct'),
    P('dr_spirit', 1, lin(0.003, 0.0015), 'party', 'regen', { partyAlso: { hpPctOthers: lin(0.05, 0.0125) } }),   // 另外其他隊友最大生命 +5%→10%
    P('dr_wild',   1, lin(0.06, 0.04),   'self', 'atkPct'),
    P('dr_herd',   2, lin(0.1, 0.025),   'party', 'synergyPow', { partyAlso: { critHeal: 0.002 } }),   // 團隊特效數值 +10%→20%（相對）；全隊普攻暴擊回 0.2% 生命
  ],

  // 遛狗者：全隊減冷卻、加攻速、加技能傷害
  dogwalker: [
    A('dw_fetch',   0, 6,  lin(1.8, 0.25), v => ({ target: 'one', mult: v, debuffs: [{ id: 'poison', v: 1, t: 5 }] })),   // 去咬他！：咬傷中毒
    // 散步時間：減冷卻＋回血 10%→15%；全隊閃避 +10%→15%（2 秒）；動物系隊友下一次攻擊技能傷害 +10%→20%
    A('dw_walkies', 0, 14, lin(2, 0.5), (v, r) => ({ target: 'none', cdCut: v, heal: WALK.heal(r),
      party: [{ id: 'evade', v: WALK.evade(r), t: 2 }], partyType: { type: 'animal', fx: [{ id: 'nextSkill', v: WALK.next(r), t: 20 }] } }),
      { raw: true, v2: WALK.heal, descV: { evade: WALK.evade, next: WALK.next } }),
    A('dw_zoomies', 1, 14, lin(0.4, 0.15),  v => ({ target: 'none', party: [{ id: 'spdUp', v, t: 8 }] })),   // 狗狗暴衝：全隊攻速 +40%→100%
    // 狗群圍攻：暴擊時暴擊傷害再 +25%；咬到中毒敵人傷害 +50%；咬到暈眩敵人回復自己 2%→6% 最大生命（每次施放最多回一次）；兩者可同時成立
    A('dw_pack',    1, 10, lin(0.55, 0.08), (v, r) => ({ target: 'one', mult: v, hits: 4, critDmgBonus: 0.25, vsPoisonSkill: 0.5, stunHeal: lin(0.02, 0.01)(r) }), { descV: { heal: lin(0.02, 0.01) } }),
    // 乖狗狗：全隊技能傷害；期間動物系隊友的攻擊技能每次命中 2% 機率暈眩 1.5 秒
    A('dw_goodboy', 2, 16, lin(0.2, 0.06), v => ({ target: 'none', party: [{ id: 'skillDmg', v, t: 10 }], partyType: { type: 'animal', fx: [{ id: 'stunSkill', v: 0.02, t: 10 }] } })),
    // 牽繩節奏：全隊冷卻縮短；另外全隊動物系隊友的技能最終傷害 ×2（多人裝不疊加）
    P('dw_leash',   0, lin(0.05, 0.03), 'party', 'cdr', { partyAlso: { animalSkillX: 1 }, rawKeys: ['animalSkillX'] }),
    P('dw_trainer', 0, lin(0.04, 0.03), 'party', 'skillDmg', { partyAlso: { evadeOthers: lin(0.05, 0.0125) } }),   // 另外其他隊友閃避 +5%→10%（遛狗者自己不吃）
    P('dw_loyal',   1, lin(0.06, 0.04), 'self', 'atkPct', { key2: 'lifesteal', v2: lin(0.2, 0.025) }),   // 另外吸血 20%→30%
    P('dw_stride',  1, lin(0.04, 0.04), 'party', 'spdPct', { also: { evade: r => -lin(0.05, 0.0075)(r), defPct: lin(0.1, 0.0175) }, partyAlso: { evadeOthers: lin(0.03, 0.01) } }),   // 狗蹭蹭：全隊攻速 +4%→20%；自己閃避 -5%→-8%、防禦 +10%→17%；其他隊友閃避 +3%→7%
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
    A('mc_topcoat', 1, 15, lin(0.2, 0.05),  v => ({ target: 'none', party: [{ id: 'defUp', v, t: 10 }, { id: 'reflectUp', v: 0.5, t: 10 }] })),   // 另外全隊反彈 +50%
    A('mc_salon',   2, 18, lin(0.45, 0.1),  v => ({ target: 'none', shield: 0.12, party: [{ id: 'reflectUp', v, t: 8 }] })),
    // 倒刺美甲：全隊常駐反彈 10%→30%；並讓全隊反彈可以暴擊（用被打那位隊友的暴擊率、暴擊傷害）
    P('mc_thorn',   0, lin(0.1, 0.05),  'party', 'reflect', { partyAlso: { reflectCrit: 1, reflectDef: 0.34 } }),   // reflectDef：被打者目前防禦每 1 點，反彈傷害 +0.34%
    P('mc_harden',  0, lin(0.04, 0.02), 'party', 'defPct'),
    P('mc_gelcoat', 1, lin(0.1, 0.07),  'self', 'hpPct'),
    // 鏡面甲：全隊反彈傷害 +20%→68%；反彈暴擊時暴擊傷害再 +50%→100%（要有倒刺美甲讓反彈能暴擊才有用）
    P('mc_mirror',  1, lin(0.2, 0.12),  'party', 'reflectPow', { partyAlso: { reflectCritDmg: lin(0.5, 0.125) } }),
    // 指尖藝術：護盾 +15%→55%、自身普攻 +50%；全隊反彈可暴擊，反彈暴擊率 = 40% ＋ 被打者暴擊率，反彈暴擊傷害再 +25%（固定）
    P('mc_art',     2, lin(0.15, 0.1),  'self', 'shieldPow', { also: { basicDmg: () => 0.5 }, partyAlso: { reflectCrit: 1, reflectCritBase: 40, reflectCritAdd: 0.25 } }),
  ],

  // 死靈術師：召喚石魔人／骷髏弓箭手（同時只有一隻，站在隊伍最前面），引爆召喚物
  necromancer: [
    // 死亡纏繞：單體 100%→150%；上「恐懼」（敵人傷害 -20%，6 秒）；對命中下降（blind）的敵人傷害再 +100%→200%
    A('nc_coil',      0, 6,  lin(1, 0.125),  (v, r) => ({ target: 'one', mult: v, vsBlind: lin(1, 0.25)(r), debuffs: [{ id: 'fear', v: 0.2, t: 6 }] }),
      { descV: { blind: lin(1, 0.25) } }),
    // 黑死詛咒：全體 200%→250%；上「衰老詛咒」（敵人無法暴擊、最大生命 -15%，6 秒）
    A('nc_plague',    0, 10, lin(2, 0.125),  v => ({ target: 'all', mult: v, debuffs: [{ id: 'decay', v: 0.15, t: 6 }] })),
    A('nc_golem',     1, 16, lin(1, 0.15),   v => ({ target: 'none', summonMinion: { kind: 'golem', power: v } })),
    A('nc_archer',    1, 16, lin(1, 0.15),   v => ({ target: 'none', summonMinion: { kind: 'skeleton', power: v } })),
    // 怨靈召喚：每位死靈頭上一隻尖刺骷髏頭，18 秒，不會被打也不會死；攻擊力 = 死靈 80%→120%、攻速 = 死靈 ×(1 + 50%→100%)
    //   每次攻擊上「死亡詛咒」6 秒：記錄期間受到的傷害，到期引爆 110%→200%；被刷新時先馬上引爆再重上
    A('nc_wraith',    2, 20, lin(0.8, 0.1),  (v, r) => ({ target: 'none', wraith: { atk: v, spd: lin(0.5, 0.125)(r), curse: G.DOOM_MULT, t: 18 } }),
      { descV: { spd: lin(0.5, 0.125) } }),
    P('nc_bond',      1, lin(0.1, 0.05),  'self', 'summonPower'),   // 第 107 輪：跟亡者之力對調到第二階
    // 白骨風暴（原腐朽，id 不變）：見 G.BONE_STORM；v = 中毒強度
    P('nc_rot',       0, lin(1, 0.25),    'special', 'boneStorm'),
    // 亡靈軍團（原不死之契，id 不變）：數值見 G.UNDEAD_LEGION；v = 召喚物生命
    P('nc_undying',   1, lin(0.1, 0.1),   'special', 'undeadLegion', { descV: { evade: r => G.UNDEAD_LEGION.evade(r) } }),
    // 咒怨之力（原亡者之力，id 不變，第一階）：見 G.GRUDGE；v = 闇屬性全隊傷害
    P('nc_dread',     0, lin(0.1, 0.1675), 'special', 'grudge'),
    // 死亡契約：數值見 G.DEATH_PACT（v = 每個減益的召喚物回血）
    P('nc_pact',      2, lin(0.01, 0.005), 'special', 'deathPact', { descV: Object.fromEntries(Object.entries({
      dmg: 'dmg', spd: 'spd', tSpd: 'tSpd', tEvade: 'tEvade', aSpd: 'aSpd', aCrit: 'aCrit', aCritDmg: 'aCritDmg', aEvade: 'aEvade', sDef: 'sDef', sEvade: 'sEvade', sAtk: 'sAtk', sCritDmg: 'sCritDmg' }).map(([k]) => [k, r => G.DEATH_PACT[k](r)])), rawKeys: ['aCrit'] }),
  ],

  // 飛船船長：技能跟著飛空艇各部位的等級變強；強化船砲；從飛空艇發射飛彈
  //   部位等級 G.shipLv(slot)：沒裝 0，第 1～5 款 = 1～5
  captain: [
    A('cp_missile',   0, 5,  lin(0.9, 0.15), (v, r) => ({ target: 'all', mult: v * (1 + 0.2 * G.shipLv('cannon')), fromShip: 'missile',
        debuffs: [{ id: 'critDown', v: lin(10, 2.5)(r), t: 6 }] }),   // 飛彈齊發：船砲每階 +20%；敵人暴擊率 -10→20（百分點）
      { descV: { can: () => 0.2 * G.shipLv('cannon'), cdn: lin(10, 2.5) }, rawKeys: ['cdn'] }),
    A('cp_salvo',     0, 8,  lin(1.0, 0.15), v => ({ target: 'one', mult: v + 0.1 * G.shipLv('cannon'), hits: 2, fromShip: 'cannon' }),   // 集中砲火：看自己的攻擊，船砲每階 +10%
      { descV: { can: () => 0.1 * G.shipLv('cannon') } }),
    A('cp_overdrive', 1, 16, lin(4, 1),      v => ({ target: 'none', overdrive: v, party: [{ id: 'spdUp', v: 0.1 + 0.02 * G.shipLv('wing'), t: v }] }),
      { raw: true, descV: { spd: () => 0.1 + 0.02 * G.shipLv('wing') } }),
    A('cp_repair',    1, 15, lin(0.08, 0.02), v => ({ target: 'none', heal: v + 0.02 * G.shipLv('hull') }),
      { descV: { hull: () => 0.02 * G.shipLv('hull') } }),
    // 核彈！！（原艦首衝撞）：全體；飛空艇每個部位都加成（傷害／暴擊率／暴擊傷害）
    A('cp_ram',       2, 14, lin(3.66, 0.75), v => { const b = G.shipSkillBonus(); return { target: 'all', mult: v * (1 + b.dmg), critBonus: b.crit, critDmgBonus: b.critDmg, fromShip: 'nuke' }; },
      { descV: SHIP_SKILL_DESC }),
    P('cp_gunner',    0, lin(0.2, 0.1),   'party', 'cannonDmg'),                               // 船砲傷害
    P('cp_navigator', 0, lin(0.005, 0.0025), 'party', 'shipDmg', { partyAlso: { shieldDur: 2, shieldAmt: 2, shieldDef: 1 }, rawKeys: ['shieldDur', 'shieldAmt', 'shieldDef'], descV: { now: r => lin(0.005, 0.0025)(r) * G.shipTotalLv() } }),   // 每 1 階部位 → 全隊傷害
        P('cp_quarter',   1, () => 1,         'party', 'cannonHalf', { partyAlso: { cannonCrit: lin(35, 5), cannonCritDmg: lin(3, 0.25) }, rawKeys: ['cannonCrit', 'cannonCritDmg'] }),   // 王牌砲手：船砲間隔減半；暴擊率 35→55%、暴擊 ×3→×4
    // 艦砲武裝齊射！！（被動）：飛空艇所有部位每 1 階 → 船長自己的技能傷害 +1%→3%、技能冷卻 -0.5%→1%
    P('cp_ace',       2, lin(0.01, 0.005), 'self', 'shipSkill', { also: { shipCdr: lin(0.005, 0.00125) }, partyAlso: { shieldReborn: lin(0.05, 0.05) },   // shieldReborn：隊友護盾被打破時再生一次，量 +5%→25%
      descV: { now: r => lin(0.01, 0.005)(r) * G.shipTotalLv(), cdnow: r => lin(0.005, 0.00125)(r) * G.shipTotalLv() } }),
    P('cp_crew',      1, lin(0.01, 0.005), 'party', 'balloonHp', { descV: { now: r => lin(0.01, 0.005)(r) * G.shipLv('balloon') } }),   // 氣球每 1 階 → 全隊生命
  ],

  // 健身者：幫隊友平均分攤傷害、自己緩緩回血
  gymgoer: [
    A('gy_punch',    0, 6,  lin(1.6, 0.2),   v => ({ target: 'one', mult: v })),
    A('gy_squat',    0, 12, lin(0.2, 0.05),  v => ({ target: 'none', selfHeal: v })),
    A('gy_flex',     1, 12, lin(0.3, 0.08),  v => ({ target: 'none', taunt: { v: 0.2, t: 6 }, self: [{ id: 'defUp', v, t: 6 }] })),
    A('gy_protein',  1, 14, lin(0.1, 0.03),  v => ({ target: 'none', heal: v })),
    A('gy_superset', 2, 10, lin(0.7, 0.1),   v => ({ target: 'one', mult: v, hits: 3 })),
    P('gy_buddy',     0, lin(0.3, 0.05),  'special', 'share'),
    // 棒式恢復（原恢復日）：全隊每秒回 1%→5% 生命、全隊最大生命 +5%→15%
    P('gy_recovery',  0, lin(0.01, 0.01), 'party', 'regen', { partyAlso: { hpPct: lin(0.05, 0.025) } }),
    // 增肌：全隊生命 +12%→44%；健身者自己再多一份（自身 = 全隊那份 ＋ 同樣數值）
    P('gy_bulk',      1, lin(0.12, 0.08), 'party', 'hpPct', { also: { hpPct: lin(0.12, 0.08) } }),
    P('gy_core',      1, lin(0.08, 0.06), 'self', 'defPct'),
    // 耐力：受到傷害 -4%→16%；普攻 5%→25% 機率「肌肉衝擊」：全體小兵（層主除外）額外受到等同自己目前生命的傷害
    P('gy_endurance', 2, lin(0.04, 0.03), 'self', 'dmgReduce', { also: { hpSlam: lin(0.05, 0.05), bossSlam: lin(0.01, 0.01) } }),   // bossSlam：普攻 1%→5% 機率對層主造成等同最大生命的傷害
  ],
};

// 動物造型與舊召喚資料（德魯伊已改成全隊 buff，暫時沒有技能召喚）：aura = 在場時給全隊的加成種類；stats = 以施放者屬性為基準的倍率
G.ANIMALS = {
  bear: { icon: '🐻', aura: 'defPct', stats: { hp: 1.4, atk: 0.4, def: 1.2 }, color: '#7a5230' },
  wolf: { icon: '🐺', aura: 'atkPct', stats: { hp: 0.6, atk: 0.8, def: 0.6 }, color: '#8a8f99' },
  owl:  { icon: '🦉', aura: 'crit',   stats: { hp: 0.4, atk: 0.5, def: 0.4 }, color: '#a07a50' },
  deer: { icon: '🦌', aura: 'regen',  stats: { hp: 0.7, atk: 0.3, def: 0.7 }, color: '#c08a50' },
};
// 飛船船長「核彈！！」「艦砲武裝齊射！！」：飛空艇每個部位每 1 階的加成
G.SHIP_SKILL_BONUS = {
  bow: { dmg: 0.15 }, cannon: { dmg: 0.15 }, engine: { dmg: 0.1 },
  hull: { critDmg: 0.2 }, wing: { critDmg: 0.2 },
  balloon: { crit: 8 }, charm: { crit: 8 },   // crit 是百分點
};
G.shipSkillBonus = () => {
  const out = { dmg: 0, crit: 0, critDmg: 0 };
  Object.entries(G.SHIP_SKILL_BONUS).forEach(([slot, b]) => Object.entries(b).forEach(([k, v]) => { out[k] += v * G.shipLv(slot); }));
  return out;
};
// 死靈「死亡契約」（1→5 級）。召喚物 = 石魔人／骷髏弓箭手＋怨靈（每位死靈各一隻）
//   每個減益（取減益最多的那隻敵人）：召喚物每秒回 regen、傷害 +dmg、攻速 +spd
//   場上召喚物 ≥1：全隊攻速 aSpd、暴擊率 aCrit（百分點）、暴擊傷害 aCritDmg、閃避 aEvade
//   場上召喚物 ≥2：召喚物再加防禦 sDef、閃避 sEvade、攻擊 sAtk、暴擊傷害 sCritDmg
//   場上召喚物 ≥3：全隊（含召喚物）再加攻速 tSpd、閃避 tEvade
// 死靈「亡靈軍團」（1→5 級，隊上多位取最高；死靈自身閃避看自己的等級）
//   召喚物（石魔人／骷髏）生命 +hp；召喚物（含怨靈）攻擊 fearChance 機率上恐懼（同死亡纏繞：傷害 -20%、6 秒）
//   打到有衰老詛咒的敵人：傷害 ×(1 + decayDmg) 且必定暴擊
//   召喚物倒下 → 屍爆：對敵方全體造成（召喚物最大生命＋主人最大生命）的傷害，無視防禦
//   場上有召喚物：死靈自己閃避 +evade
// 死靈「白骨風暴」：裝了的死靈自己、或場上召喚物（含怨靈，隊上取最高等級）每次攻擊（普攻＋技能）→
//   破防 def、命中下降 blind（敵人 miss 機率）、中毒（強度 poison × 一般中毒），都是 t 秒
// 死靈「咒怨之力」（隊上取最高等級）：
//   裝了的死靈要倒下時，頭上的怨靈代替他死（怨靈消失，死靈生命回滿）
//   全隊闇屬性角色（含召喚物）：每秒回 regen 生命、傷害 +v（10%→77%）、每次攻擊上流血 bleedT 秒
G.GRUDGE = { regen: 0.01, bleedT: 3 };
G.BONE_STORM = { def: 0.2, blind: 0.2, poison: lin(1, 0.25), t: 6 };
G.DOOM_MAX_STACKS = 1;   // 死亡詛咒同時幾層（第 110 輪改 1：不疊層，身上有詛咒時不會再上）
G.DOOM_MULT = 1;         // 死亡詛咒引爆倍率（第 110 輪：110%→200% 改固定 100%）
G.UNDEAD_LEGION = { hp: lin(0.1, 0.1), evade: lin(0.1, 0.0125), fearChance: 0.1, decayDmg: 0.5 };
G.DEATH_PACT = {
  regen: lin(0.01, 0.005), dmg: lin(0.01, 0.01), spd: lin(0.05, 0.0175),
  aSpd: lin(0.4, 0.05), aCrit: lin(10, 4.25), aCritDmg: lin(0.5, 0.175), aEvade: lin(0.1, 0.025),
  sDef: lin(0.1, 0.225), sEvade: lin(0.2, 0.0375), sAtk: lin(0.18, 0.08), sCritDmg: lin(1, 0.5),
  tSpd: lin(0.5, 0.125), tEvade: () => 0.5,   // 場上召喚物 ≥3：全隊（含召喚物）攻速、閃避
};
// 召喚物自己的技能（名稱：skill.<id>.name）；cd0 = 召出來後第一次施放要等幾秒
//   石魔人「挑釁」：敵方全體只打它、自己受到傷害 -50%，10 秒，CD 9 秒
//   骷髏弓箭手「箭雨」：敵方全體 200% 傷害，自己攻速 +100% 5 秒，CD 8 秒
// 技能施放優先順序：同一刻有好幾招都轉好時，數字小的先放（沒列的照技能欄順序排在後面）
//   死靈：召喚石魔人 > 召喚骷髏弓箭手 > 怨靈召喚 > 其他
G.CAST_PRIORITY = { nc_golem: 0, nc_archer: 1, nc_wraith: 2 };
G.SUMMON_SKILLS = {
  golem:    { id: 'sm_taunt',  cd: 9, cd0: 0.5, v: () => 0.5, fx: v => ({ target: 'none', taunt: { v, t: 10 } }) },
  skeleton: { id: 'sm_arrows', cd: 8, cd0: 1.5, v: () => 2,   fx: v => ({ target: 'all', mult: v, self: [{ id: 'spdUp', v: 1, t: 5 }] }) },
};
G.GOLEM_EVADE_CAP = 0.3;   // 石魔人閃避上限（一般角色是 G.CONFIG.evadeCap 90%）
G.GOLEM_HEAL_CUT = 0.5;    // 石魔人受到的所有回復 -50%（回血、治療、吸血）
// 死靈術師的召喚物：站在隊伍正前方，普攻隨機打一隻敵人；場上最多一隻
G.SUMMONS = {
  golem:    { icon: '🗿', stats: { hp: 3.0, atk: 0.25, def: 2.0 }, spd: 0.7 },                     // 石魔人：肉盾
  skeleton: { icon: '💀', stats: { hp: 0.35, atk: 1.6, def: 0.3 }, spd: 1.1, missile: 'arrow' },   // 骷髏弓箭手：高傷害、很脆
};
// 狀態圖示
G.FX_ICON = {
  atkUp: '⚔️', spdUp: '💨', defUp: '🛡️', dmgReduce: '🧱', critUp: '🎯', evade: '🌀', skillDmg: '✨', animalSkill: '🐾', tome: '📚', critDown: '🥴', arcane: '🔮', arcaneCount: '🔮', shadow: '🌑', shadowCount: '🌑', stunHunter: '🔫', overdrive: '⚙️', reflectX: '🦌', coverFire: '🏴‍☠️', snipeX: '💥', snipeCount: '🎯', bloodRush: '⏩', nextExecute: '🪓', fever: '🔥', bloodShare: '❣️', hpUp: '❤️', synBoost: '📣', regen: '💚', reflectUp: '💅', nextSkill: '🦴', shieldWall: '🏰', stunSkill: '💫', sketch: '🎨', hiss: '😾',
  shield: '🔰', taunt: '😤', morale: '🎖️', frenzy: '🐾',
  stun: '💫', fear: '😱', decay: '🥀', doom: '💀', defDown: '💔', slow: '🐌', blind: '🌫️', bleed: '🩸', poison: '☠️',
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
// perk = 專屬 buff（永久、不能升級；出戰時給全隊，文字：perk.<stat>）；extra = 額外特殊效果（文字：perk.<extra>）
//   cdr 技能冷卻縮短、procRate 觸發率（暴擊、流血、中毒、緩速等機率 ×(1+v)）
G.PARTNERS = [
  { id: 'ella', floor: 2,  hair: '#d9a066', skin: '#f3d2b3', perk: { stat: 'cdr',      v: 0.10 } },
  { id: 'bram', floor: 4,  hair: '#3b2a1e', skin: '#d9a47a', perk: { stat: 'defPct',   v: 0.06 } },
  { id: 'lina', floor: 7,  hair: '#f5e6a8', skin: '#f6dcc4', perk: { stat: 'hpPct',    v: 0.08 } },
  { id: 'kael', floor: 10, hair: '#222831', skin: '#e0b895', perk: { stat: 'atkPct',   v: 0.06 } },
  { id: 'mira', floor: 14, hair: '#9c7be0', skin: '#f1d1c0', perk: { stat: 'procRate', v: 0.15, extra: 'defDownStack' } },   // extra：破防持續時間可累加
];
G.partnerRecruitCost = p => 80 * p.floor;
G.partnerLevelCost = lv => Math.round(25 * Math.pow(1.3, lv - 1));   // 原本 50 起跳，-50%

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
G.SHIP_BASE_FLOORS = 20;  // 沒有穩定翼和引擎時只能到第 20 層（全滿 20+25+25 = 70）
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
  { id: 'spider',  icon: '🕸️', rate: 0.06, gold: 300,    crystal: 0 },
  { id: 'fishing', icon: '🎣', rate: 0.07, gold: 2000,   crystal: 0 },
  { id: 'wire',    icon: '⛓️', rate: 0.12, gold: 8000,   crystal: 10 },
  { id: 'money',   icon: '💰', rate: 0.17, gold: 30000,  crystal: 40 },
  { id: 'mystery', icon: '🔮', rate: 0.25, gold: 100000, crystal: 120 },
];

// ── 怪物圖鑑：打倒層主登錄該層怪物、捕獲再點亮一次，各領一次雲晶 ─────────
G.dexReward = (tier, kind) => (kind === 'caught' ? 10 + tier * 5 : 3 + tier * 2);
G.petSellPrice = p => 5 + Math.max(0, G.monsterTierOf(p.id)) * 3;   // 賣掉捕獲的怪物換雲晶
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
