// ════════════════════════════════════════════════════════════════════════════
// 戰鬥場景（Phaser）：自動前進 → 遇怪 → 自動戰鬥 → 結算 → 繼續前進
//
// 狀態效果（buff/debuff）統一存在 unit.fx[id] = { v, t }，t 是剩餘秒數
//   buff：atkUp spdUp defUp dmgReduce critUp evade skillDmg regen
//   debuff：defDown slow blind bleed poison（bleed/poison 的 v = 每秒傷害）
// 全隊光環 this.aura = 出戰者的 party 被動加總 ＋ 德魯伊動物
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const W = 480, H = 300, GROUND = 238;
  const RES = Math.min(3, Math.max(2, Math.round(window.devicePixelRatio || 1)));   // 戰鬥畫布解析度倍數（座標仍是 480×300）
  const PARTY_X = [178, 132, 86, 40];
  const ENEMY_X = [305, 355, 405];
  const BUFF_IDS = ['breeze', 'atkUp', 'spdUp', 'defUp', 'dmgReduce', 'critUp', 'evade', 'skillDmg', 'regen', 'reflectUp', 'nextSkill', 'shieldWall', 'stunSkill', 'animalSkill', 'hpUp', 'bloodShare', 'snipeX', 'reflectX', 'stunHunter'];
  const DEBUFF_IDS = ['stun', 'defDown', 'slow', 'blind', 'bleed', 'poison', 'critDown', 'fear', 'decay', 'doom'];   // doom 死亡詛咒（怨靈）   // fear 恐懼：傷害下降；decay 衰老詛咒：無法暴擊＋最大生命下降
  const MISSILE_VARIANTS = 4;

  class BattleScene extends Phaser.Scene {
    constructor() { super('battle'); }

    // 把 Canvas 2D 畫好的圖變成 Phaser 貼圖（同 key 會先移除再重建）
    tex(key, w, h, draw) {
      if (this.textures.exists(key)) this.textures.remove(key);
      const c = G.ART.canvas(w, h);
      draw(c.getContext('2d'), w, h);
      this.textures.addCanvas(key, c);
      return key;
    }

    preload() {
      // 自己畫的圖（assets/manifest.js 有登記才會載入）
      const ov = window.ASSET_OVERRIDES || {};
      Object.entries(ov).forEach(([key, url]) => this.load.image('ov_' + key, url));
      // 內嵌的美術（base64，file:// 也能用）
      const data = window.ASSET_DATA || {};
      Object.entries(data).forEach(([key, url]) => this.load.image(key, url));
    }

    create() {
      this.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);
      const addText = this.add.text.bind(this.add);
      this.add.text = (...a) => addText(...a).setResolution(RES);   // 文字跟著畫布解析度，放大才不會糊
      this.texVer = 0;
      this.units = [];
      this.enemies = [];
      this.mode = 'walk';
      this.walkT = 1;
      this.cannonT = G.CANNON_INTERVAL;
      this.needRebuild = false;
      this.frenzyMem = {};   // 吸貓狂熱層數（重建隊伍時保留，倒下才歸零）
      this.aura = {};
      this.animal = null;    // 德魯伊召喚中的動物 { kind, v, unit }

      // 投射物貼圖：小貓 5 色，其他每種畫 4 個隨機變化
      G.ART.KITTEN_COLORS.forEach((c, i) => this.tex('kitten' + i, 28, 22, ctx => G.ART.drawKitten(ctx, c)));
      Object.keys(G.ART.MISSILES).forEach(k => {
        for (let i = 0; i < MISSILE_VARIANTS; i++) this.tex(`ms_${k}${i}`, 28, 22, ctx => G.ART.MISSILES[k](ctx));
      });
      Object.keys(G.ANIMALS).forEach(k => this.tex('animal_' + k, 64, 64, ctx => G.ART.drawAnimal(ctx, k)));
      Object.keys(G.SUMMONS).forEach(k => this.tex('summon_' + k, 64, 64, ctx => G.ART.drawSummon(ctx, k)));

      // 背景
      this.sky = this.add.graphics();
      ['clouds', 'clouds2'].forEach((k, i) => this.tex(k, 256, 128, (ctx, w, h) => G.ART.drawClouds(ctx, w, h, i ? 0.85 : 0.45)));
      this.islandsLayer = null;
      // 飛空艇放右上（左上角留給 buff 圖示）
      this.shipImg = this.add.image(405, 58, '__DEFAULT').setScale(0.5);
      this.shipImg.setInteractive({ useHandCursor: true }).on('pointerdown', () => G.UI && G.UI.shipTip && G.UI.shipTip());   // 點飛空艇 → 提示可爬層數
      this.cloudFar = this.add.tileSprite(0, 20, W, 128, 'clouds').setOrigin(0);
      this.cloudNear = this.add.tileSprite(0, 120, W, 128, 'clouds2').setOrigin(0).setAlpha(0.7);
      this.ground = this.add.tileSprite(0, GROUND - 6, W, H - GROUND + 6, '__DEFAULT').setOrigin(0);
      // 主背景圖（紫暮裂空）：有圖就蓋掉程式畫的漸層天空、浮島、遠雲，只留近雲飄動
      this.bgImg = this.textures.exists('bg_main') ? this.add.image(0, 0, 'bg_main').setOrigin(0).setDisplaySize(W, H).setDepth(-3) : null;
      if (this.bgImg) { this.cloudFar.setVisible(false); this.cloudNear.setAlpha(0.3); }
      // 自製視差圖層：遠山慢、地板快（圖存 2 倍解析度，tileScale 0.5 顯示）
      this.mountains = this.textures.exists('bg_mount') ? this.add.tileSprite(0, 165, W, 58, 'bg_mount').setOrigin(0).setTileScale(0.5).setDepth(-2.5) : null;
      this.floorImg = this.textures.exists('bg_floor');
      if (this.floorImg) this.ground.setTexture('bg_floor').setTileScale(0.5).setPosition(0, GROUND - 21).setSize(W, H - GROUND + 21);
      this.drawShip();
      this.applyFloorTheme();

      this.bars = this.add.graphics().setDepth(75);   // 在浮動文字上面，血條不會被數字蓋住
      this.tweens.add({ targets: this.shipImg, y: 66, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      this.buildParty();

      G.on('look',      () => this.refreshMembers(true));
      G.on('inventory', () => this.refreshMembers(false));
      G.on('skills',    () => this.refreshMembers(false));
      G.on('stats',     () => this.refreshMembers(false));
      G.on('party',     () => { this.needRebuild = true; this.refreshMembers(false); });
      G.on('ship',      () => this.drawShip());
      G.on('floor',     () => this.restartFloor());
    }

    // ── 主題（隨層數變色）────────────────────────────────────────────────
    applyFloorTheme() {
      const f = G.S.floor;
      const [top, bottom] = G.skyFor(f);
      this.sky.clear();
      this.sky.fillGradientStyle(top, top, bottom, bottom, 1);
      this.sky.fillRect(0, 0, W, H);
      const tier = Math.min(4, Math.floor((f - 1) / 5));
      const groundTop = ['#eef7ff', '#e4ecff', '#e3d9ff', '#b9a6e8', '#6d58a8'][tier];
      const groundBot = ['#a9c7e0', '#97acd6', '#9d8fd0', '#7a62b8', '#3c2c70'][tier];
      this.tex('groundTex', 128, H - GROUND + 6, (ctx, w, h) => G.ART.drawGround(ctx, w, h, groundTop, groundBot));
      if (!this.floorImg) this.ground.setTexture('groundTex');
      const islandColor = ['#b9d7ee', '#a6bde6', '#ab9fe0', '#7b66bf', '#3f2f78'][tier];
      this.tex('islands', 512, 160, (ctx, w, h) => G.ART.drawIslands(ctx, w, h, islandColor));
      if (!this.islandsLayer) this.islandsLayer = this.add.tileSprite(0, 40, W, 160, 'islands').setOrigin(0).setDepth(-1);
      else this.islandsLayer.setTexture('islands');
      if (this.bgImg) { this.sky.setVisible(false); this.islandsLayer.setVisible(false); }
      this.sky.setDepth(-2);
      this.shipImg.setDepth(-1);
      // 上升詛咒：進到有詛咒的樓層時提示
      this.curse = G.curseFor(f);
      if (this.curse && this.cursedFloor !== f) {
        this.cursedFloor = f;
        this.floatText(W / 2, 135, G.t('curse.enter', { text: G.curseText(this.curse) }), '#c99bff', 15, 2200);
      }
    }

    drawShip() {
      const key = 'ship_' + (++this.texVer);
      this.tex(key, 240, 180, (ctx, w, h) => G.ART.drawShip(ctx, G.shipLook(), w, h));
      const old = this.shipImg.texture.key;
      this.shipImg.setTexture(key);
      if (old.startsWith('ship_')) this.textures.remove(old);
    }

    // ── 單位 ─────────────────────────────────────────────────────────────
    humanTex(prefix, look) {
      const key = prefix + '_' + (++this.texVer);
      this.tex(key, 64, 80, ctx => G.ART.drawHumanoid(ctx, look));
      return key;
    }

    monsterTex(shape, color) {
      const key = 'mon_' + shape + color;
      if (this.textures.exists('ov_' + key)) return 'ov_' + key;
      if (!this.textures.exists(key)) this.tex(key, 64, 64, ctx => G.ART.drawMonster(ctx, shape, color));
      return key;
    }

    makeUnit(o) {
      const img = this.add.image(o.x, GROUND, o.texture).setOrigin(0.5, o.originY || 0.95).setScale(o.scale || 1.1).setDepth(10 + (o.side === 'enemy' ? 1 : 0));
      if (o.flip) img.setFlipX(true);
      // 自製圖片可能不是 64px 寬，等比例縮成一樣大
      if (o.texture.startsWith('ov_')) img.setScale((o.scale || 1.1) * 64 / img.width);
      const u = Object.assign({
        alive: true, shield: 0, shieldT: 0, atkCd: G.rand(0.2, 0.8), dotAcc: 0,
        fx: {}, taunt: { v: 0, t: 0 }, frenzy: 0, skills: [], procs: [], special: {}, img, homeX: o.x,
      }, o);
      u.hp = u.st.maxHp;
      return u;
    }

    // 角色的主動技能（只算已裝備且有學的）
    memberSkills(who) {
      const ch = G.charOf(who);
      return ch.active.filter(Boolean).map(id => {
        const def = G.skillDef(ch.cls, id), r = ch.skills[id];
        // 開場冷卻最多 5 秒，讓每場戰鬥一開始就會有技能出手
        return def && r && def.type === 'active' ? { def, rank: r, cd: id === 'nc_golem' ? 0.3 : Math.min(5, def.cd * G.rand(0.2, 0.5)) } : null;   // 石魔人開場最先召
      }).filter(Boolean).sort((a, b) => (G.CAST_PRIORITY[a.def.id] ?? 99) - (G.CAST_PRIORITY[b.def.id] ?? 99));   // 同時轉好時，排前面的先放
    }

    memberUnit(who) {
      const isHero = who === 'hero';
      const look = isHero ? G.ART.lookFromHero() : who === G.MERC ? G.S.merc.snap.look : G.ART.lookFromPartner(who);
      const u = this.makeUnit({
        side: 'party', kind: isHero ? 'hero' : 'partner', key: who, partnerId: isHero ? null : who,
        st: G.charStats(who), texture: this.humanTex(isHero ? 'hero' : 'p_' + who.replace('@', ''), look), x: 0, scale: isHero ? 1.1 : 1.0,
      });
      this.applyBuild(u, who);
      u.frenzy = this.frenzyMem[who] || 0;
      return u;
    }

    applyBuild(u, who) {
      const ps = G.passivesOf(who);
      u.skills = this.memberSkills(who);
      u.procs = ps.proc;
      u.special = ps.special;
    }

    buildParty() {
      this.units.forEach(u => u.img.destroy());
      this.units = [];
      this.animal = null; this.minion = null;
      (this.wraiths || []).forEach(w => w.img.destroy()); this.wraiths = [];
      const members = G.partyMembers().map(w => this.memberUnit(w));
      this.hero = members[0];
      // 近戰站前排、遠程站後排
      members.sort((a, b) => (a.st.ranged ? 1 : 0) - (b.st.ranged ? 1 : 0));
      members.forEach((u, i) => { u.homeX = PARTY_X[i]; u.img.x = u.homeX; });
      this.units = members;
      this.needRebuild = false;
      this.computeAura();
      // 全隊生命光環（德魯伊「林地祝福」）
      members.forEach(u => { const m = this.hpAuraOf(u); if (m) { u.st.maxHp = Math.round(u.st.maxHp * (1 + m)); u.hp = u.st.maxHp; } });
    }

    // 全隊生命加成（光環）＋ 其他隊友用論文審查分給我的
    hpAuraOf(u) { return (this.aura.hpPct || 0) + (u.key ? G.othersHpPct(u.key) : 0); }

    // 換裝、學技能後即時更新數值（保留血量比例）；外觀改變時換貼圖
    refreshMembers(look) {
      this.units.forEach(u => {
        if (!u.key || (u.key === G.MERC && !G.S.merc)) return;   // 傭兵剛被解雇，等重建隊伍
        const ratio = u.hp / u.st.maxHp;
        u.st = G.charStats(u.key);
        const hm = this.hpAuraOf(u); if (hm) u.st.maxHp = Math.round(u.st.maxHp * (1 + hm));
        if (u.hpBoostV) u.st.maxHp = Math.round(u.st.maxHp * (1 + u.hpBoostV));   // 野性狂暴期間換裝：保留暫時生命加成
        u.hp = u.alive ? Math.max(1, Math.round(u.st.maxHp * ratio)) : 0;
        const old = u.skills;
        this.applyBuild(u, u.key);
        u.skills.forEach(s => { const o = old.find(x => x.def.id === s.def.id); if (o) s.cd = o.cd; });   // 冷卻不重置
        if (look && u.kind === 'hero') {
          const oldKey = u.img.texture.key;
          u.img.setTexture(this.humanTex('hero', G.ART.lookFromHero()));
          this.textures.remove(oldKey);
          this.needRebuild = true;   // 職業改變時前後排可能要重排
        }
      });
      this.computeAura();
    }

    // 暫時的最大生命加成（野性狂暴 hpUp）：最大生命跟著 buff 變，增加的部分直接補血，到期時扣回（不會扣到死）
    syncHpBoost(u) {
      const want = u.alive ? this.fxv(u, 'hpUp') : 0, cur = u.hpBoostV || 0;
      if (want === cur || !u.st || !u.st.maxHp) return;
      const base = u.st.maxHp / (1 + cur), max = Math.round(base * (1 + want)), diff = max - u.st.maxHp;
      u.st.maxHp = max; u.hpBoostV = want;
      if (u.alive) u.hp = diff > 0 ? u.hp + diff : Math.max(1, Math.min(u.hp, max));
    }

    // 血之狂熱（處決擊殺）：全隊攻速 +100%；期間全隊暴擊率加總（各自最多 100%，美式居合算 100%）
    //   → 每 1% = 技能冷卻 -1%（跟其他冷卻縮短一起受上限）、每 100% = 每秒回復 1% 最大生命
    startFever(u, t) {
      this.fever = { t };
      this.partyAlive().forEach(p => { this.addFx(p, 'spdUp', 1, t); this.glow(p, '#ff4d4d'); });
      this.floatText(u.img.x, this.barY(u) - 40, G.t('battle.fever'), '#ff4d4d', 16, 1100);
    }
    // 血性加速（出血補到隊友時）：4 秒內全隊技能冷卻一律變成 1 秒（正在冷卻的也立刻縮到最多 1 秒）
    //   觸發間隔 7 秒（從上一次觸發開始算）
    startBloodRush(u) {
      const now = this.time.now;
      if (this.bloodRushNext && now < this.bloodRushNext) return;
      this.bloodRushNext = now + 7000;
      const fresh = true;
      this.bloodRush = { t: 4 };
      this.units.forEach(p => { if (p.alive && p.skills) p.skills.forEach(s => { s.cd = Math.min(s.cd, 1); }); });
      if (fresh) this.floatText(u.img.x, this.barY(u) - 40, G.t('battle.bloodRush'), '#ff6b8a', 15, 1000);
    }
    cdrBoostV() { return this.cdrBoost && this.cdrBoost.t > 0 ? this.cdrBoost.v : 0; }
    curseNow() { return this.curseOff && this.curseOff.t > 0 ? null : this.curse; }   // 上升詛咒（百科全書的船砲可以暫時解除）
    rushOn() { return !!(this.bloodRush && this.bloodRush.t > 0); }

    // 美式居合：全隊物理系隊員的傷害技能累積 50 次 → 有美式居合的海盜「狙擊爆頭！！！」4 秒，輸出最終傷害 ×10（發動間隔 5 秒）
    snipeTick() {
      const p = this.partyAlive().find(x => x.st.iai);
      if (!p) return;
      this.snipeCount = (this.snipeCount || 0) + 1;
      const now = this.time.now;
      if (this.snipeCount >= 50 && !(this.snipeNext && now < this.snipeNext)) {
        this.snipeCount = 0; this.snipeNext = now + 5000;
        this.addFx(p, 'snipeX', p.st.snipeX || 1, 4);   // 美式居合等級決定倍率 this.glow(p, '#ffd23f');
        this.floatText(p.img.x, this.barY(p) - 40, G.t('battle.snipe'), '#ffd23f', 17, 1200);
      }
    }

    feverSum() {
      if (!(this.fever && this.fever.t > 0)) return 0;
      return this.partyAlive().filter(p => p.kind !== 'summon').reduce((a, p) => a + (p.st.iai ? 100 : Math.min(100, this.critOf(p))), 0);
    }

    computeAura() {
      const a = G.partyAura(this.synBoost && this.synBoost.t > 0 ? this.synBoost.v : 0);
      this.units.forEach(u => { u.othersSpd = u.key ? G.othersBonus(u.key, 'spdPctOthers') : 0; u.othersEvade = u.key ? G.othersBonus(u.key, 'evadeOthers') : 0; });   // 每次重算光環時快取，不要每幀算
      if (this.animal && this.animal.unit.alive) {
        const k = G.ANIMALS[this.animal.kind].aura;
        a[k] = (a[k] || 0) + this.animal.v;
      }
      this.aura = a;
      this.pStun = G.partyStun();   // 貓貓士氣：全隊普攻暈眩
    }

    // ── 狀態效果 ─────────────────────────────────────────────────────────
    fxv(u, id) { const f = u.fx[id]; return f && f.t > 0 ? f.v : 0; }
    addFx(u, id, v, t) {
      if (!u || !u.alive || !v) return;
      const f = u.fx[id];
      if (f && f.t > 0) { f.v = Math.max(f.v, v); f.t = Math.max(f.t, t); f.full = Math.max(f.full || 0, t); }
      else u.fx[id] = { v, t, full: t };   // full = 完整持續時間（給詛咒油畫刷新用）
    }
    // 對敵人上 debuff（持續時間吃施放者的「畫廊」加成；流血/中毒換算成每秒傷害）
    debuff(src, target, id, v, t) {
      if (this.party(src) && !this.party(target) && target.alive) this.shadowTick();   // 暗影纏繞：每次施加減益都算 1 次
      const dur = t * ((src.st.debuffDur || 1) + (this.party(src) ? this.aura.debuffDur || 0 : 0));   // 黑暗系團隊特效
      if (id === 'stun' && target.alive && !this.fxv(target, 'stun')) this.floatText(target.img.x, this.barY(target) - 12, G.t('battle.stun'), '#ffe066', 12);
      const val = (id === 'bleed' || id === 'poison') ? this.atkOf(src) * G.DOT[id] * v : v;
      // 米菈：破防持續時間累加（數值取最高），上限 G.DEFDOWN_STACK_CAP 秒
      const f = target.fx[id];
      if (id === 'defDown' && this.party(src) && this.aura.defDownStack && f && f.t > 0 && target.alive) {
        f.v = Math.max(f.v, val); f.t = Math.min(G.DEFDOWN_STACK_CAP, f.t + dur);
        return;
      }
      // 衰老詛咒：第一次上時扣最大生命（到期在 fx 倒數那邊還原）
      if (id === 'decay' && target.alive && !(f && f.t > 0) && !target.decayBase) {
        target.decayBase = target.st.maxHp;
        target.st.maxHp = Math.max(1, Math.round(target.st.maxHp * (1 - val)));
        target.hp = Math.min(target.hp, target.st.maxHp);
      }
      // 死亡詛咒：固定 6 秒（不吃延長），可疊層（最多 G.DOOM_MAX_STACKS），每層各自記錄、各自到期引爆；疊滿時不再上
      if (id === 'doom' && target.alive) {
        const st = target.doomStacks || (target.doomStacks = []);
        if (st.length >= G.DOOM_MAX_STACKS) return;
        st.push({ t, v: val, acc: 0 });
        this.syncDoom(target);
        return;
      }
      this.addFx(target, id, val, dur);
    }
    // fx.doom 只用來顯示／算減益數：t = 最快引爆那層的剩餘秒數
    syncDoom(u) {
      const st = u.doomStacks || [];
      if (st.length) u.fx.doom = { v: st[0].v, t: Math.min(...st.map(s => s.t)), full: 6 };
      else delete u.fx.doom;
    }
    // 每層倒數；到期的那層引爆（記錄傷害 × 倍率）
    doomTick(u, dt) {
      const st = u.doomStacks;
      if (!st || !st.length) return;
      st.forEach(s => { s.t -= dt; });
      const done = st.filter(s => s.t <= 0);
      u.doomStacks = st.filter(s => s.t > 0);
      done.forEach(s => this.doomBlast(u, s));
      this.syncDoom(u);
    }
    doomBlast(u, s) {
      const dmg = Math.round(s.acc * s.v);
      if (!u.alive || dmg <= 0) return;
      this.doomBlasting = true;
      this.floatText(u.img.x, this.barY(u) - 26, G.t('battle.doomBlast'), '#e8e4d8', 13, 700);
      this.damage(u, dmg, '#e8e4d8', true, true);
      this.doomBlasting = false;
    }

    // ── 團隊特效「暗影纏繞」：累積施加減益次數 → 全隊增益 ──────────────────
    shadowOn() { return !!(this.shadow && this.shadow.t > 0); }
    shadowV(k) { return this.shadowOn() ? this.aura[k] || 0 : 0; }
    shadowTick() {
      const need = this.aura.darkNeed;
      if (!need) return;
      this.shadowCount = (this.shadowCount || 0) + 1;
      if (this.shadowCount < need) return;
      this.shadowCount = 0; this.shadow = { t: this.aura.darkDur || 6 };
      this.partyAlive().forEach(p => this.glow(p, '#c99bff'));
      if (this.hero) this.floatText(this.hero.img.x, this.barY(this.hero) - 40, G.t('battle.shadow'), '#c99bff', 16, 1100);
    }

    // ── 死靈「死亡契約」與召喚物 ──────────────────────────────────────────
    grudgeV() { return Math.max(0, ...this.partyAlive().filter(p => p.kind !== 'summon').map(p => (p.special.grudge || {}).v || 0)); }   // 咒怨之力：闇屬性傷害加成（0 = 沒人裝）
    isDark(u) { return this.party(u) && u.st.dmgType === 'dark'; }
    boneRank() { return Math.max(0, ...this.partyAlive().filter(p => p.kind !== 'summon').map(p => (p.special.boneStorm || {}).r || 0)); }
    legionRank() { return Math.max(0, ...this.partyAlive().filter(p => p.kind !== 'summon').map(p => (p.special.undeadLegion || {}).r || 0)); }
    pactRank() { return Math.max(0, ...this.partyAlive().filter(p => p.kind !== 'summon').map(p => (p.special.deathPact || {}).r || 0)); }
    summonCount() { return (this.minionAlive() ? 1 : 0) + (this.wraiths || []).length; }
    pactDebuffs() { return Math.max(0, ...this.enemiesAlive().map(e => DEBUFF_IDS.filter(id => this.fxv(e, id)).length)); }
    // 死亡契約的加成：k = G.DEATH_PACT 的欄位；need = 需要幾隻召喚物在場
    pactV(k, need = 0) {
      const r = this.pactRank();
      if (!r || this.summonCount() < need) return 0;
      return G.DEATH_PACT[k](r);
    }
    pactAll(k) { return this.pactV(k, 1); }                                   // 全隊（召喚物 ≥1）
    pactTriple(k) { return this.pactV(k, 3); }                                // 全隊含召喚物（召喚物 ≥3）
    pactSummon(k) { return this.pactV(k, 2); }                                // 召喚物（召喚物 ≥2）
    pactPerDebuff(k) { return this.pactV(k) * this.pactDebuffs(); }           // 召喚物：每個減益

    // 怨靈召喚：飄在死靈頭上的尖刺骷髏頭，不會被打、不會死
    summonWraith(owner, w) {
      if (!this.textures.exists('wraith')) this.tex('wraith', 34, 34, ctx => {
        ctx.fillStyle = '#f2efe4';
        for (let i = 0; i < 9; i++) {   // 尖刺
          const a = -Math.PI * 0.95 + i * Math.PI * 0.95 / 4;
          ctx.beginPath(); ctx.moveTo(17 + Math.cos(a - 0.22) * 10, 16 + Math.sin(a - 0.22) * 10);
          ctx.lineTo(17 + Math.cos(a) * 16, 16 + Math.sin(a) * 16); ctx.lineTo(17 + Math.cos(a + 0.22) * 10, 16 + Math.sin(a + 0.22) * 10); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(17, 16, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(12, 22, 10, 7);
        ctx.fillStyle = '#1b1b2a'; ctx.beginPath(); ctx.arc(13.5, 16, 2.6, 0, Math.PI * 2); ctx.arc(20.5, 16, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(15, 26, 1.2, 3); ctx.fillRect(18, 26, 1.2, 3);
        ctx.fillStyle = 'rgba(160,255,170,.9)'; ctx.beginPath(); ctx.arc(13.5, 16, 1, 0, Math.PI * 2); ctx.arc(20.5, 16, 1, 0, Math.PI * 2); ctx.fill();
      });
      this.wraiths = (this.wraiths || []).filter(x => x.owner !== owner || (x.img.destroy(), false));
      const img = this.add.image(owner.img.x, owner.img.y - 70, 'wraith').setDepth(42).setAlpha(0);
      this.tweens.add({ targets: img, alpha: 0.95, duration: 300 });
      this.wraiths.push({ owner, img, t: w.t, atk: w.atk, spd: w.spd, curse: w.curse, atkCd: 0.3 });
      this.floatText(owner.img.x, this.barY(owner) - 40, G.t('summon.wraith'), '#e8e4d8', 15, 900);
    }
    wraithTick(dt) {
      if (!this.wraiths || !this.wraiths.length) return;
      this.wraiths = this.wraiths.filter(w => {
        w.t -= dt;
        if (w.t <= 0 || !w.owner.alive) { this.tweens.add({ targets: w.img, alpha: 0, duration: 300, onComplete: () => w.img.destroy() }); return false; }
        if (this.mode !== 'fight') return true;
        w.atkCd -= dt;
        if (w.atkCd > 0) return true;
        const o = w.owner;
        w.atkCd = 1 / Math.max(0.25, this.spdOf(o) * (1 + w.spd + this.pactPerDebuff('spd')));
        const t = this.targetFor(o);
        if (!t) return true;
        const k = this.add.image(w.img.x, w.img.y, 'wraith').setDepth(41).setScale(0.45);
        this.tweens.add({ targets: k, x: t.img.x, y: t.img.y - 34, duration: 220, onComplete: () => {
          k.destroy();
          if (!this.valid(t) || !o.alive) return;
          const bonus = (1 + this.pactPerDebuff('dmg')) * (1 + this.pactSummon('sAtk')) - 1;
          this.hit(o, t, w.atk, { wraith: true, nextBonus: bonus, critDmgBonus: this.pactSummon('sCritDmg') });
          if (this.valid(t)) this.debuff(o, t, 'doom', w.curse, 6);
          this.checkWaveEnd();
        } });
        return true;
      });
    }
    wraithFollow() {
      (this.wraiths || []).forEach(w => { w.img.x = w.owner.img.x; w.img.y = this.barY(w.owner) - 22 + Math.sin(this.time.now / 260) * 4; });
    }

    party(u) { return u.side === 'party'; }
    atkOf(u)  { return u.st.atk * (1 + this.fxv(u, 'atkUp') + (this.party(u) ? this.aura.atkPct || 0 : 0) + (u.kind === 'summon' && u.minion ? this.pactSummon('sAtk') : 0)); }   // 死亡契約：召喚物攻擊
    spdOf(u)  { return Math.max(0.25, u.st.spd * (1 + this.fxv(u, 'spdUp') + (this.party(u) ? (this.aura.spdPct || 0) + (u.othersSpd || 0) + this.pactAll('aSpd') + this.pactTriple('tSpd') + this.shadowV('darkSpd') + (u.kind === 'summon' && u.minion ? this.pactPerDebuff('spd') : 0) : 0) - this.fxv(u, 'slow'))); }   // 死亡契約：全隊攻速、召喚物每個減益攻速   // othersSpd：野性之絆（德魯伊自己不吃）
    critOf(u) { return Math.max(0, u.st.crit - this.fxv(u, 'critDown') + this.fxv(u, 'critUp') + (this.party(u) ? (this.aura.crit || 0) + (u.st.dmgType === 'physical' ? this.aura.physCrit || 0 : 0) + (this.arcaneOn() ? (this.aura.arcaneCrit || 0) * 100 : 0) + this.pactAll('aCrit') : 0)) * this.procMult(u); }   // physCrit：神槍手給物理系；奧術共振
    arcaneOn() { return !!(this.arcane && this.arcane.t > 0); }   // physCrit：神槍手給物理系
    procMult(u) { return this.party(u) ? 1 + (this.aura.procRate || 0) : 1; }   // 觸發率（浪浪園區所長米菈的專屬 buff）
    // 閃避：石魔人上限 G.GOLEM_EVADE_CAP，其他人 G.CONFIG.evadeCap
    evadeCapOf(u) { return u.minion === 'golem' ? G.GOLEM_EVADE_CAP : G.CONFIG.evadeCap; }
    evadeRaw(u) { return this.fxv(u, 'stun') ? 0 : Math.max(0, (u.st.evade || 0) + this.fxv(u, 'evade') + (this.party(u) ? (this.aura.evade || 0) + (u.othersEvade || 0) + this.pactAll('aEvade') + this.pactTriple('tEvade') + (u.special.undeadLegion && this.summonCount() ? G.UNDEAD_LEGION.evade(u.special.undeadLegion.r) : 0) + this.shadowV('darkEvade') + (u.kind === 'summon' && u.minion ? this.pactSummon('sEvade') : 0) : 0)); }   // 還沒套上限的閃避   // othersEvade：訓犬師、狗蹭蹭（遛狗者自己不吃）   // 暈眩無法閃避
    evadeOf(u) { return Math.min(this.evadeCapOf(u), this.evadeRaw(u)); }
    defOf(u) {
      let m = 1 + this.fxv(u, 'defUp') - this.fxv(u, 'defDown');
      if (this.party(u)) {
        m += this.aura.defPct || 0;
        if (u.kind === 'summon' && u.minion) m += this.pactSummon('sDef');   // 死亡契約：召喚物防禦
        if (u.shield > 0 && this.aura.shieldDef) m += this.aura.shieldDef;   // 領航員：有護盾時防禦 +100%
        if (u.special.crisis && this.crisisOn()) m += u.special.crisis.v2;   // 學者危機意識
      }
      let d = u.st.def * Math.max(0.1, m);
      if (this.party(u)) d *= this.moraleMult();
      if (this.party(u) && this.curseNow() && this.curse.def) d *= 1 - this.curse.def;                 // 上升詛咒：防禦下降
      return d;
    }
    takenMult(u) {
      let m = (1 - (u.st.dmgReduce || 0)) * (1 - this.fxv(u, 'dmgReduce'));
      if (this.party(u)) m *= 1 - (this.aura.dmgReduce || 0);
      if (u.taunt.t > 0) m *= 1 - u.taunt.v;
      if (this.fxv(u, 'stun')) m *= 1 + G.STUN.taken;   // 暈眩受到傷害 +15%
      return Math.max(0.1, m);
    }
    skillMult(u) { return 1 + (u.st.skillDmg || 0) + (u.st.shipSkill || 0) * G.shipTotalLv() + this.fxv(u, 'skillDmg') + (u.st.dmgType === 'animal' ? this.fxv(u, 'animalSkill') : 0) + (this.party(u) ? this.aura.skillDmg || 0 : 0); }   // animalSkill：喵喵鼓舞

    // 反彈率（已含鏡面甲加成）
    reflectOf(u) {
      if (!this.party(u)) return 0;
      const base = ((u.special.thorns || {}).v || 0) + (this.aura.reflect || 0) + this.fxv(u, 'reflectUp');
      return base * (1 + (this.aura.reflectPow || 0));
    }

    // 即時能力值（冒險頁「即時數值」用）：吃 buff、光環、團隊特效、詛咒，隨戰鬥波動
    liveStats(u) {
      const a = this.aura, curse = this.curseNow() || {};
      return {
        hp: Math.max(0, Math.round(u.hp)), maxHp: u.st.maxHp,
        atk: this.atkOf(u), def: this.defOf(u), spd: this.spdOf(u),
        crit: Math.min(100, this.critOf(u)), critDmg: u.st.critDmg + (a.critDmg || 0) + (this.arcaneOn() ? a.arcaneCritDmg || 0 : 0) + this.pactAll('aCritDmg'),   // 死亡契約（召喚物 ≥1）
        cdr: Math.min(G.CONFIG.cdrCap, (a.cdr || 0) + (u.st.cdr || 0) + (u.st.shipCdr || 0) * G.shipTotalLv() + this.feverSum() / 100 + this.cdrBoostV() + this.shadowV('darkCdr')),
        // 還沒套上限的值（即時數值：超過上限標紅、顯示多出多少）；cap = 上限
        raw: { crit: this.critOf(u), cdr: (a.cdr || 0) + (u.st.cdr || 0) + (u.st.shipCdr || 0) * G.shipTotalLv() + this.feverSum() / 100 + this.cdrBoostV() + this.shadowV('darkCdr'), evade: this.evadeRaw(u) },
        cap: { crit: u.st.iai ? Infinity : 100, cdr: G.CONFIG.cdrCap, evade: this.evadeCapOf(u) },   // 美式居合：超過 100% 的暴擊率會轉成暴擊傷害，不算浪費
        regen: (u.st.regen || 0) + (a.regen || 0) + this.fxv(u, 'regen') + this.fxv(u, 'breeze') + this.shadowV('darkRegen') + (this.isDark(u) && this.grudgeV() ? G.GRUDGE.regen : 0) + this.feverSum() / 10000,   // 暗影纏繞、咒怨之力、血之狂熱
        lifesteal: u.st.lifesteal || 0,
        evade: this.evadeOf(u),
        dmg: (1 + (a.dmgPct || 0)) * (1 - (curse.dmg || 0)) * (this.isDark(u) ? 1 + this.grudgeV() : 1) - 1,   // 咒怨之力：黑暗系傷害
        skillDmg: this.skillMult(u) - 1,
        dmgReduce: 1 - this.takenMult(u),
        debuffDur: (u.st.debuffDur || 1) + (a.debuffDur || 0) - 1,
        shield: u.shield || 0, reflect: this.reflectOf(u),
      };
    }

    // 士氣：隊伍有人裝「士氣」被動時生效（上限依技能等級）
    moraleMult() { return G.moraleCap() > 0 ? 1 + Math.min(G.S.morale, G.moraleCap()) / 100 : 1; }
    crisisOn() { return this.partyAlive().some(p => p.hp / p.st.maxHp < G.CONFIG.crisisHp); }

    // ── 波次 ─────────────────────────────────────────────────────────────
    spawnWave() {
      const f = G.S.floor;
      const boss = G.S.kills >= G.CONFIG.killsPerFloor;
      const pool = G.monsterTier(f);
      const count = boss ? 1 : G.randInt(1, Math.min(3, 1 + Math.floor((f + 1) / 3)));
      this.enemies = [];
      for (let i = 0; i < count; i++) {
        const m = boss ? pool[(f - 1) % pool.length] : G.pick(pool);
        const u = this.makeUnit({
          side: 'enemy', kind: 'monster', boss, monsterId: m.id, shape: m.shape, color: m.color,
          st: Object.assign(G.monsterStats(f, boss), { dmgType: 'physical' }), texture: this.monsterTex(m.shape, m.color),
          x: ENEMY_X[boss ? 1 : i], scale: boss ? 1.75 : 1.1, originY: 0.94,
        });
        u.img.x = W + 40 + i * 50;
        this.tweens.add({ targets: u.img, x: u.homeX, duration: 700, ease: 'Quad.out' });
        this.enemies.push(u);
      }
      if (boss) this.floatText(W / 2, 70, G.t('battle.bossAppear', { n: f }), '#ff6b6b', 22, 1400);
      this.mode = 'enter';
      this.time.delayedCall(720, () => { if (this.mode === 'enter') this.mode = 'fight'; });
    }

    restartFloor() {
      if (this.reviveAt) { this.reviveAt = 0; G.emit('dead', false); }  // 倒地時手動換層 = 直接復活
      this.enemies.forEach(e => { e.img.destroy(); if (e.dbLabel) e.dbLabel.destroy(); });
      this.enemies = [];
      this.applyFloorTheme();
      this.buildParty();
      this.mode = 'walk';
      this.walkT = 0.8;
    }

    // ── 目標選擇 ─────────────────────────────────────────────────────────
    partyAlive() { return this.units.filter(u => u.alive); }
    enemiesAlive() { return this.enemies.filter(u => u.alive); }
    valid(t) { return t && t.alive && (this.enemies.includes(t) || this.units.includes(t)); }

    // 我方打最前面的敵人；敵人：挑釁（石魔人優先於其他挑釁者）> 召喚獸 > 加權隨機（近戰位 3、後排 1，後排偶爾也會被打）
    targetFor(u) {
      if (u.side === 'party') { const es = this.enemiesAlive(); return u.kind === 'summon' ? G.pick(es) : es[0]; }   // 死靈的召喚物：隨機一隻
      const alive = this.partyAlive();
      const forced = alive.find(p => p.taunt.t > 0 && p.minion === 'golem') || alive.find(p => p.taunt.t > 0) || (this.animal && this.animal.unit.alive ? this.animal.unit : null);
      if (forced) return forced;
      const w = alive.map(p => (p.st.ranged && p.kind !== 'summon' ? 1 : 3));   // 召喚物站最前面，跟前排一樣常被打
      let x = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < alive.length; i++) { if ((x -= w[i]) < 0) return alive[i]; }
      return alive[0];
    }

    // ── 傷害 ─────────────────────────────────────────────────────────────
    // opts: skill（技能傷害）critBonus vsBleed drain noFlash noRedirect counter
    hit(src, target, mult, opts = {}) {
      if (!this.valid(target)) return 0;
      // 命中下降（暗黑畫家的墨水）
      if (this.fxv(src, 'blind') && Math.random() < this.fxv(src, 'blind')) {
        this.floatText(target.img.x, this.barY(target) - 12, 'MISS', '#b0b0c0', 13);
        return 0;
      }
      // 閃避（海盜）→ 閃避反擊
      if (Math.random() < this.evadeOf(target)) {
        this.floatText(target.img.x, this.barY(target) - 12, G.t('battle.dodge'), '#9fd8ff', 13);
        if (target.special.riposte && !opts.counter && src.alive && target.alive) {
          const rv = target.special.riposte.v;
          this.enemiesAlive().forEach((en, i) => this.shoot(target, en, 'bullet', i, () => this.hit(target, en, rv, { counter: true, stunBonus: { critDmg: 1.5, finalX: 10 }, breakStun: true })));
        }
        return 0;
      }
      // 城牆者「掩護」：機率幫隊友擋下這一擊
      if (this.party(target) && !this.party(src) && !opts.noRedirect) {
        const cover = this.partyAlive().find(p => p !== target && p.special.cover && p.kind !== 'summon');
        if (cover && Math.random() < cover.special.cover.v) {
          this.floatText(cover.img.x, this.barY(cover) - 18, G.t('battle.cover'), '#ffd23f', 12);
          target = cover;
        }
      }

      let dmg = this.atkOf(src) * mult;
      if (opts.skill) dmg *= this.skillMult(src);
      if (opts.nextBonus) dmg *= 1 + opts.nextBonus;
      if (!opts.skill && !opts.counter && src.st.basicDmg) dmg *= 1 + src.st.basicDmg;   // 指尖藝術：普攻傷害
      if (this.fxv(src, 'shieldWall')) dmg *= 1 - this.fxv(src, 'shieldWall');   // 盾牆！期間輸出 -50%
      if (this.party(src) && this.aura.dmgPct) dmg *= 1 + this.aura.dmgPct;
      if (this.party(src) && this.curseNow() && this.curse.dmg) dmg *= 1 - this.curse.dmg;            // 上升詛咒：傷害下降                    // 飛空艇船首：全隊傷害
      if (this.party(src) && src.frenzy && G.frenzyCap()) dmg *= 1 + Math.min(src.frenzy, G.frenzyCap()) / 100;   // 吸貓狂熱（有人裝被動才生效）
      // 對流血（血騎士、詛咒油畫）、對中毒（詛咒油畫）：同一招兩個都中時相加
      const vsB = this.fxv(target, 'bleed') ? (opts.vsBleed || 0) + ((src.special.vsBleed || {}).v || 0) : 0;
      const vsP = this.fxv(target, 'poison') ? opts.vsPoisonSkill || 0 : 0;
      const vsS = this.fxv(target, 'stun') ? opts.vsStunSkill || 0 : 0;   // 毒爪：對暈眩敵人
      const vsBl = this.fxv(target, 'blind') ? opts.vsBlind || 0 : 0;   // 死亡纏繞：對命中下降的敵人
      if (vsB || vsP || vsS || vsBl) dmg *= 1 + vsB + vsP + vsS + vsBl;
      if (this.fxv(src, 'fear')) dmg *= 1 - this.fxv(src, 'fear');   // 恐懼：傷害下降
      if (src.special.crisis && this.crisisOn()) dmg *= 1 + src.special.crisis.v;               // 學者危機意識
      if (this.party(src) && this.aura.vsStun && this.fxv(target, 'stun')) dmg *= 1 + this.aura.vsStun;   // 貓哈氣爆甲：打暈眩敵人
      if (this.party(src) && this.fxv(target, 'stun')) {
        const fr = Math.max(0, ...this.partyAlive().filter(p => p.kind !== 'summon').map(p => (p.special.frenzy || {}).r || 0));
        if (fr) dmg *= 1 + G.CAT_STUN.party(fr);   // 吸貓狂熱：全隊打暈眩敵人（取最高）
      }
      // 貓肉球拍打：全隊打到暈眩敵人，出手的人回復生命（範圍攻擊同一次出手只回一次）
      if (this.party(src) && this.aura.stunHit && this.fxv(target, 'stun') && src.alive && src.st.maxHp && src.stunHitAt !== this.time.now) {
        src.stunHitAt = this.time.now;
        this.heal(src, Math.max(1, Math.round(src.st.maxHp * this.aura.stunHit)));
      }
      if (this.fxv(target, 'poison') && src.st.vsPoison) dmg *= 1 + src.st.vsPoison;
      if (this.isDark(src)) { const gv = this.grudgeV(); if (gv) dmg *= 1 + gv; }   // 咒怨之力：闇屬性全隊（含召喚物、怨靈）傷害
      if (src.kind === 'summon' && src.minion) dmg *= 1 + this.pactPerDebuff('dmg');   // 死亡契約：召喚物每個減益加傷
      const stunnedNow = this.fxv(target, 'stun') > 0;
      const sb = stunnedNow ? Object.assign({}, opts.stunBonus) : null;   // 打到暈眩敵人的額外效果
      if (stunnedNow && this.fxv(src, 'stunHunter')) { sb.forceCrit = true; sb.breakStun = true; sb.dmgPct = (sb.dmgPct || 0) + this.fxv(src, 'stunHunter'); }   // 大爆射一波！之後 6 秒
      if (sb && sb.dmgPct) dmg *= 1 + sb.dmgPct;
      if (!stunnedNow && opts.elseDmgPct) dmg *= 1 + opts.elseDmgPct;
      const bleeding = this.fxv(target, 'bleed') > 0;   // 渴血：對流血敵人暴擊率、暴擊傷害
      const critChance = (this.critOf(src) + (opts.critBonus || 0) + (bleeding ? (src.st.bleedCrit || 0) * 100 : 0)) * (this.fxv(target, 'stun') ? G.STUN.critMult : 1);   // 暈眩更容易被暴擊
      // 咒怨之力（黑暗系全隊）：普攻打恐懼敵人傷害 +50%；打衰老詛咒敵人暴擊傷害 +50%（兩者可疊加）
      const grudgeOn = this.isDark(src) && this.grudgeV() > 0;
      if (grudgeOn && !opts.skill && !opts.counter && this.fxv(target, 'fear')) dmg *= 1 + G.GRUDGE.vsFear;
      const grudgeCritDmg = grudgeOn && this.fxv(target, 'decay') ? G.GRUDGE.vsDecayCritDmg : 0;
      const legionDecay = (opts.wraith || (src.kind === 'summon' && src.minion)) && this.fxv(target, 'decay') && this.legionRank() > 0;   // 亡靈軍團：召喚物打衰老詛咒的敵人
      if (legionDecay) dmg *= 1 + G.UNDEAD_LEGION.decayDmg;
      const crit = this.fxv(src, 'decay') ? false : src.st.iai || (sb && sb.forceCrit) || legionDecay ? true : Math.random() * 100 < critChance;   // 衰老詛咒：無法暴擊   // 美式居合：必定暴擊
      const iaiOver = src.st.iai ? Math.max(0, critChance - 100) / 100 : 0;   // 超過 100% 的暴擊率 1:1 轉成暴擊傷害
      if (crit) dmg *= src.st.critDmg + grudgeCritDmg + iaiOver + (sb && sb.critDmg || 0) + (this.party(src) && this.arcaneOn() ? this.aura.arcaneCritDmg || 0 : 0) + (bleeding ? src.st.bleedCritDmg || 0 : 0) + (this.party(src) ? (this.aura.critDmg || 0) + this.pactAll('aCritDmg') : 0) + (opts.critDmgBonus || 0) + (src.kind === 'summon' && src.minion ? this.pactSummon('sCritDmg') : 0)
        + (this.party(src) && this.aura.stunCritDmg && this.fxv(target, 'stun') ? this.aura.stunCritDmg : 0);   // 筆觸節奏：對暈眩敵人暴擊傷害   // 團隊特效：暴擊傷害；狗群圍攻：技能自帶暴擊傷害
      if (crit && !opts.skill && !opts.counter && this.party(src) && this.aura.critHeal && src.alive && src.st.maxHp) this.heal(src, Math.max(1, Math.round(src.st.maxHp * this.aura.critHeal)), false);   // 獸群之心：普攻暴擊回血
      dmg *= 50 / (50 + this.defOf(target));
      dmg *= this.takenMult(target);
      dmg = Math.max(1, Math.round(dmg * G.rand(0.92, 1.08)));
      if (opts.skill && this.party(src) && this.aura.stunSkillX && this.fxv(target, 'stun')) dmg *= 1 + this.aura.stunSkillX;   // 筆觸節奏：技能打暈眩敵人最終傷害 ×5
      if (crit && opts.critFinalX) dmg *= opts.critFinalX;
      if (sb && sb.finalX) dmg *= sb.finalX;   // 閃避反擊打暈眩：最終傷害 ×10   // 爆頭！！！：暴擊時最終傷害 ×3
      if (this.fxv(src, 'snipeX')) dmg *= 1 + this.fxv(src, 'snipeX');   // 狙擊爆頭！！！：最終傷害 ×10
      if (opts.skill && this.party(src) && this.aura.animalSkillX && src.st.dmgType === 'animal') dmg *= 1 + this.aura.animalSkillX;   // 牽繩節奏：動物系技能最終傷害 ×2

      // 健身者「健身夥伴」：隊友被打時，分一部分傷害到自己身上
      let mine = dmg;
      if (this.party(target) && !this.party(src)) {
        const buddy = this.partyAlive().find(p => p !== target && p.special.share && p.kind !== 'summon');
        if (buddy) {
          const part = Math.round(dmg * buddy.special.share.v);
          mine = dmg - part;
          if (part > 0) this.damage(buddy, part, '#ffb36b', false, true);
        }
      }
      const type = this.party(src) ? src.st.dmgType : null;
      if ((opts.breakStun || (sb && sb.breakStun)) && stunnedNow && target.fx.stun) delete target.fx.stun;   // 解除暈眩
      if (this.aura.arcaneCrit && target.side === 'enemy' && (this.party(src) || src.kind === 'cannon')) {   // 奧術共振：累積 100 次
        this.arcaneCount = (this.arcaneCount || 0) + 1;
        if (this.arcaneCount >= 100) {
          this.arcaneCount = 0; this.arcane = { t: this.aura.arcaneDur || 6 };
          this.partyAlive().forEach(p => this.glow(p, '#8fd3ff'));
          if (this.hero) this.floatText(this.hero.img.x, this.barY(this.hero) - 40, G.t('battle.arcane'), '#8fd3ff', 16, 1100);
        }
      }
      this.damage(target, mine, this.party(target) ? '#ff7070' : crit ? '#ffd23f' : G.DMG_TYPES[type] || '#fff', crit, opts.noFlash);
      if (this.party(target) && !this.party(src) && target.special.cover && target.alive) this.addFx(target, 'breeze', G.WALL_BREEZE.v, G.WALL_BREEZE.t);   // 掩護：被攻擊後「城牆上微風」
      if (!opts.counter && target.alive && !this.party(target) && this.isDark(src) && this.grudgeV()) this.debuff(src, target, 'bleed', 1, G.GRUDGE.bleedT);   // 咒怨之力：闇屬性每次攻擊上流血
      // 白骨風暴：裝了的死靈自己、或場上召喚物（含怨靈）的攻擊 → 破防、命中下降、中毒
      if (!opts.counter && target.alive && !this.party(target)) {
        const isSummon = opts.wraith || (src.kind === 'summon' && src.minion);
        const br = src.special.boneStorm && !opts.wraith ? src.special.boneStorm.r : isSummon ? this.boneRank() : 0;
        if (br) { const B = G.BONE_STORM; this.debuff(src, target, 'defDown', B.def, B.t); this.debuff(src, target, 'blind', B.blind, B.t); this.debuff(src, target, 'poison', B.poison(br), B.t); }
      }
      if ((opts.wraith || (src.kind === 'summon' && src.minion)) && target.alive && this.legionRank() > 0 && Math.random() < G.UNDEAD_LEGION.fearChance * this.procMult(src)) this.debuff(src, target, 'fear', 0.2, 6);   // 亡靈軍團：召喚物攻擊機率上恐懼

      // 城牆者「尖刺城牆」反傷
      // 反彈：城牆者「尖刺城牆」（自己）＋ 美甲師全隊反彈光環／buff，「鏡面甲」加成反彈傷害
      if (this.party(target) && !this.party(src) && src.alive) {
        const r = this.reflectOf(target);
        if (r > 0) {
          // 倒刺美甲：反彈可暴擊，用被打的那位隊友的暴擊率與暴擊傷害；鏡面甲再加反彈暴擊傷害
          //   指尖藝術：反彈暴擊率再 +40（百分點）、反彈暴擊傷害再 +25%
          const a = this.aura;
          const rc = a.reflectCrit && Math.random() * 100 < (a.reflectCritBase || 0) + this.critOf(target);
          const cm = rc ? target.st.critDmg + (a.critDmg || 0) + (a.reflectCritDmg || 0) + (a.reflectCritAdd || 0) : 1;
          const dm = a.reflectDef ? 1 + this.defOf(target) * a.reflectDef / 100 : 1;   // 倒刺美甲：被打者的防禦轉成反彈增傷（每 1 點防禦 +0.34%）
          const rx = 1 + this.fxv(target, 'reflectX');   // 鹿之靈：反彈最終傷害 ×2
          this.damage(src, Math.max(1, Math.round(dmg * r * cm * dm * rx)), '#ff9ad5', rc, true);
        }
      }
      // 吸血
      const ls = (src.st.lifesteal || 0) + (opts.drain || 0);
      // 毒爪：暴擊時回復自己最大生命 4%→8%（同一次施放只回一次）
      if (crit && opts.critHealMax && src.alive && src.st.maxHp && !(opts.castState && opts.castState.critHealed)) {
        if (opts.castState) opts.castState.critHealed = true;
        this.heal(src, Math.max(1, Math.round(src.st.maxHp * opts.critHealMax)));
      }
      if (ls && src.alive) {
        // 出血：普攻吸血時自己是滿血 → 50% 機率補失血比例最高的隊友 2% 最大生命（每秒最多 3 次）
        if (src.st.bleedHeal && !opts.skill && !opts.counter && src.hp >= src.st.maxHp && Math.random() < 0.5) {
          const now = this.time.now, recent = (src.bleedHealAt || []).filter(x => now - x < 1000);
          src.bleedHealAt = recent;
          const hurt = this.partyAlive().filter(p => p !== src && p.kind !== 'summon' && p.hp < p.st.maxHp).sort((a, b) => a.hp / a.st.maxHp - b.hp / b.st.maxHp)[0];
          if (hurt && recent.length < 3) { recent.push(now); this.heal(hurt, Math.max(1, Math.round(hurt.st.maxHp * src.st.bleedHeal)), false); this.startBloodRush(src); }
        }
        src.hp = Math.min(src.st.maxHp, src.hp + dmg * ls * this.healMult(src));
        const bs = this.fxv(src, 'bloodShare');   // 血性狂暴：吸血時分給其他隊友（每秒最多一次）
        // 每秒最多 3 次：記錄最近 1 秒內的觸發時間
        const now = this.time.now, recent = (src.bloodShareAt || []).filter(x => now - x < 1000);
        src.bloodShareAt = recent;
        if (bs && recent.length < 3 && recent.push(now)) this.partyAlive().forEach(p => { if (p !== src && p.kind !== 'summon') this.heal(p, Math.max(1, Math.round(p.st.maxHp * bs)), false); });
      }
      // 鋼鐵陣線：我方普攻命中回復自己最大生命的 0.5%（不是看傷害）
      if (!opts.skill && !opts.counter && this.party(src) && this.aura.basicLifesteal && src.alive && src.st.maxHp) src.hp = Math.min(src.st.maxHp, src.hp + src.st.maxHp * this.aura.basicLifesteal * this.healMult(src));
      // 吸貓狂熱累積（隊伍有人裝「吸貓狂熱」被動才有）
      const cap = G.frenzyCap();
      if (cap && !this.party(target) && (src.kind === 'hero' || src.kind === 'partner') && src.frenzy < cap) {
        src.frenzy = Math.min(cap, src.frenzy + G.CONFIG.frenzyPerHit);
        this.frenzyMem[src.key] = src.frenzy;
      }
      return dmg;
    }

    // 直接扣血（已經算好傷害）：先扣護盾
    damage(u, amount, color, crit, quiet) {
      if (!u.alive) return;
      let left = amount;
      if (u.shield > 0) {
        const a = Math.min(u.shield, left); u.shield -= a; left -= a;
        // 艦砲武裝齊射：護盾被打破 → 再生一次相同的護盾，量 +5%→25%（每個護盾只再生一次）
        if (u.shield <= 0 && this.party(u) && this.aura.shieldReborn && u.shieldBase && !u.shieldReborn && u.alive && !(u.shieldRebornAt && this.time.now - u.shieldRebornAt < 4000)) {   // 每人間隔 4 秒
          u.shieldReborn = true; u.shieldRebornAt = this.time.now; u.shield = Math.round(u.shieldBase * (1 + this.aura.shieldReborn)); u.shieldT = u.shieldDurBase || 8;
          this.glow(u, '#9fd8ff');
          this.floatText(u.img.x, this.barY(u) - 22, G.t('battle.shieldReborn'), '#9fd8ff', 13, 800);
        }
      }
      u.hp -= left;
      if (!this.doomBlasting && u.doomStacks) u.doomStacks.forEach(s => { s.acc += amount; });   // 死亡詛咒：每層都記錄受到的傷害（引爆本身不算）
      this.floatText(u.img.x + G.rand(-10, 10), this.barY(u) - 12, (crit ? G.t('battle.crit') + ' ' : '') + (amount >= 10000 ? '**' : amount >= 1000 ? '*' : '') + G.fmt(amount), color, crit ? 18 : quiet ? 12 : 14);
      // 受擊閃一下：先停掉上一次的閃爍再從 1 開始，不然連續被打會停在半透明
      if (!quiet && u.alive) {
        if (u.flashTw) u.flashTw.stop();
        u.img.setAlpha(1);
        u.flashTw = this.tweens.add({ targets: u.img, alpha: 0.4, duration: 60, yoyo: true, onComplete: () => { u.flashTw = null; if (u.alive) u.img.setAlpha(1); } });
      }
      if (u.hp <= 0 && this.party(u) && this.wraiths && this.wraiths.length) {   // 怨靈召喚：頭上的怨靈代替死靈倒下，生命回滿
        const w = (this.wraiths || []).find(x => x.owner === u);
        if (w) {
          u.hp = u.st.maxHp;   // 替死後生命回滿
          this.wraiths = this.wraiths.filter(x => x !== w);
          this.tweens.add({ targets: w.img, alpha: 0, scale: 1.8, duration: 400, onComplete: () => w.img.destroy() });
          this.floatText(u.img.x, this.barY(u) - 40, G.t('battle.grudgeSave'), '#c99bff', 15, 1000);
          return;
        }
      }
      if (u.hp <= 0) this.kill(u);
    }

    healMult(u) { return u.minion === 'golem' ? 1 - G.GOLEM_HEAL_CUT : 1; }   // 石魔人：受到的回復減少 G.GOLEM_HEAL_CUT
    heal(u, amount, show = true) {
      if (!u.alive || amount <= 0) return;
      amount = Math.max(1, Math.round(amount * this.healMult(u)));
      u.hp = Math.min(u.st.maxHp, u.hp + amount);
      if (show) this.floatText(u.img.x, this.barY(u) - 12, '+' + G.fmt(amount), '#7dff9a', 13);
    }

    // ── 投射物 ───────────────────────────────────────────────────────────
    // 從 u 射一發 kind 投射物到 target；i 用來錯開弧線；抵達時呼叫 onHit
    shoot(u, target, kind, i, onHit) {
      if (!this.valid(target)) return;
      const tex = kind === 'cat' ? 'kitten' + G.randInt(0, G.ART.KITTEN_COLORS.length - 1) : `ms_${kind}${G.randInt(0, MISSILE_VARIANTS - 1)}`;
      const k = this.add.image(u.img.x + 6, u.img.y - 42 + (i % 3) * 8, tex).setDepth(40).setScale(0.9);
      if (!this.party(u)) k.setFlipX(true);
      const tx = target.img.x - 8, ty = target.img.y - 34 + G.rand(-8, 8);
      const straight = kind === 'bullet';
      const peak = Math.min(u.img.y, ty) - 40 - (i % 3) * 10;
      const sx = k.x, sy = k.y;
      this.tweens.addCounter({
        from: 0, to: 1, duration: straight ? 160 : 300 + (i % 3) * 60, delay: (i % 4) * 50, ease: straight ? 'Linear' : 'Sine.in',
        onUpdate: tw => {
          const p = tw.getValue();
          k.x = sx + (tx - sx) * p;
          k.y = straight ? sy + (ty - sy) * p : (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * peak + p * p * ty;
          if (!straight) k.rotation = (p - 0.5) * 0.8;
        },
        onComplete: () => {
          k.destroy();
          if (kind === 'cat' || kind === 'dog') this.scratch(tx, ty);
          if (onHit && this.valid(target) && (u.alive || u.kind === 'cannon')) onHit();
          this.checkWaveEnd();
        },
      });
    }

    scratch(x, y) {
      const g = this.add.graphics().setDepth(46);
      g.lineStyle(2, 0xffffff, 1);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 8 + i * 6, y - 9); g.lineTo(x - 2 + i * 6, y + 9); g.strokePath(); }
      this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    }

    lunge(u) {
      const dir = this.party(u) ? 1 : -1;
      this.tweens.add({ targets: u.img, x: u.homeX + 16 * dir, duration: 90, yoyo: true, ease: 'Quad.out' });
    }

    // ── 普攻 ─────────────────────────────────────────────────────────────
    // 全體職業打所有敵人（每下較弱）；單體職業打一隻；海盜一次兩發
    basicAttack(u) {
      if (!this.party(u)) { const t = this.targetFor(u); if (t) { this.lunge(u); this.hit(u, t, 1); } return; }
      const targets = u.st.range === 'all' ? this.enemiesAlive() : [this.targetFor(u)].filter(Boolean);
      if (!targets.length) return;
      this.gainMorale(u);
      // 健身者「耐力」：機率對層主額外造成等同自己最大生命的傷害（無視防禦）
      if (u.st.bossSlam && Math.random() < u.st.bossSlam * this.procMult(u)) {
        const boss = this.enemiesAlive().find(e => e.boss);
        if (boss) {
          this.floatText(u.img.x, this.barY(u) - 22, G.t('battle.bossSlam'), '#ff8a3d', 15, 900);
          this.damage(boss, Math.max(1, Math.round(u.st.maxHp)), '#ff8a3d', true, true);
          this.checkWaveEnd();
        }
      }
      // 健身者「耐力」：機率肌肉衝擊，全體小兵（不含層主）額外受到等同自己目前生命的傷害（無視防禦）
      if (u.st.hpSlam && Math.random() < u.st.hpSlam * this.procMult(u)) {
        const minions = this.enemiesAlive().filter(e => !e.boss);
        if (minions.length) {
          this.floatText(u.img.x, this.barY(u) - 22, G.t('battle.hpSlam'), '#ffb36b', 15, 900);
          minions.forEach(e => this.damage(e, Math.max(1, Math.round(u.hp)), '#ffb36b', true, true));
          this.checkWaveEnd();
        }
      }
      const shots = u.st.shots || 1;
      const mult = G.BASIC_MULT[u.st.range || 'one'] * (shots > 1 ? 0.6 : 1);
      const onHit = t => {
        this.hit(u, t, mult); this.applyProcs(u, t);
        const ps = this.pStun;   // 貓貓士氣：全隊普攻機率暈眩
        if (ps && this.valid(t) && Math.random() < ps.chance * this.procMult(u) * (this.fxv(t, 'stun') ? G.STUN.procMult : 1)) this.debuff(u, t, 'stun', 1, ps.t);
        const bp = this.party(u) && this.aura.basicPoison;   // 貓抓印記：全隊普攻機率中毒
        if (bp && this.valid(t) && Math.random() < bp * this.procMult(u) * (this.fxv(t, 'stun') ? G.STUN.procMult : 1)) this.debuff(u, t, 'poison', 1, 5);
      };
      if (u.st.missile) {
        let i = 0;
        targets.forEach(t => { for (let s = 0; s < shots; s++) this.shoot(u, t, u.st.missile, i++, () => onHit(t)); });
        if (u.st.missile === 'cat') this.glow(u, '#ffe066');
      } else {
        this.lunge(u);
        targets.forEach(onHit);
      }
    }

    // 士氣：隊伍有人裝「士氣」被動時，貓鎧者每攻擊一次（普攻或攻擊技能）+1 層（上限依技能等級，戰敗歸零）
    gainMorale(u) {
      const cap = G.moraleCap(), S = G.S;
      if (!cap || S.morale >= cap || !u.key || !this.party(u)) return;
      const ch = G.charOf(u.key);
      if (!ch || ch.cls !== 'catknight') return;
      S.morale = Math.min(cap, S.morale + G.CONFIG.moralePerAttack);
      if (S.morale % 5 === 0 || S.morale === cap) this.floatText(u.img.x, this.barY(u) - 38, G.t('battle.morale', { n: S.morale }), '#9fd8ff', 14, 1100);
    }

    // 普攻附加效果（被動 proc）
    applyProcs(u, t) {
      u.procs.forEach(p => {
        if (!this.valid(t)) return;
        const mult = this.procMult(u) * (this.fxv(t, 'stun') ? G.STUN.procMult : 1);   // 暈眩中的敵人更容易被觸發
        if (Math.random() < p.chance * mult) {
          this.debuff(u, t, p.fx, p.val, p.t);
          (p.more || []).filter(m => !m.chance).forEach(m => this.debuff(u, t, m.fx, m.val, p.t));
        }
        (p.more || []).filter(m => m.chance).forEach(m => { if (this.valid(t) && Math.random() < m.chance * mult) this.debuff(u, t, m.fx, m.val, m.t); });
      });
    }

    // ── 主動技能 ─────────────────────────────────────────────────────────
    // 治療類技能沒人受傷就先不放；召喚類已經有動物就不放
    shouldCast(u, e) {
      if (e.heal && !e.cdCut) return this.partyAlive().some(p => p.hp / p.st.maxHp < 0.8);   // 散步時間：減冷卻為主，順便回血，不用等人受傷
      if (e.selfHeal) return u.hp / u.st.maxHp < 0.75;
      if (e.summon) return !(this.animal && this.animal.unit.alive);
      if (e.wraith) return !(this.wraiths || []).some(w => w.owner === u);   // 怨靈：每位死靈頭上一隻
      if (e.summonMinion) {
        if (this.minionAlive()) return false;                  // 場上最多一隻
        // 沒有召喚物時優先召石魔人：自己的石魔人技能再 G.GOLEM_WAIT 秒內會好，骷髏先等它
        if (e.summonMinion.kind !== 'golem') {
          const g = u.skills.find(s => s.def.id === 'nc_golem');
          if (g && g.cd <= G.GOLEM_WAIT) return false;
        }
        return true;
      }
      if (e.partyOthers) return this.partyAlive().some(p => p !== u);   // 沒有其他隊友就不放（不白扣血）
      return true;
    }

    // 技能基礎冷卻：破牆而出時塔盾衝鋒改 G.BREAKOUT_BASH_CD 秒
    baseCd(u, s) { return s.def.id === 'wb_bash' && u.st.bashDmg ? G.BREAKOUT_BASH_CD : s.def.cd; }
    castSkill(u, s) {
      const d = s.def, v = d.v(s.rank), e = d.fx(v, s.rank);
      if (d.id === 'wb_bash' && u.st.bashDmg) { e.mult *= 1 + u.st.bashDmg; e.target = 'all'; }   // 破牆而出：塔盾衝鋒變全體、傷害 +300%
      if (!this.shouldCast(u, e)) return false;
      const col = e.mult ? '#ffd27a' : e.heal || e.selfHeal ? '#7dff9a' : '#9fd8ff';
      this.floatText(u.img.x, this.barY(u) - 22, G.skillName(d.id), col, 15, 900);

      const targets = e.target === 'all' ? this.enemiesAlive() : e.target === 'one' ? [this.targetFor(u)].filter(Boolean) : [];
      const hits = e.hits || 1;
      // 散步時間給的「下一次技能傷害」：這招有傷害就用掉
      let nextBonus = e.mult && targets.length ? this.fxv(u, 'nextSkill') : 0;
      if (nextBonus) delete u.fx.nextSkill;
      const exB = e.useNextExecute && targets.length ? this.fxv(u, 'nextExecute') : 0;   // 撕裂：下一次處決加傷害
      if (exB) { delete u.fx.nextExecute; nextBonus += exB; }
      if (e.mult && targets.length) this.gainMorale(u);
      if (e.mult && targets.length && this.party(u) && u.kind !== 'summon' && u.st.dmgType === 'physical') this.snipeTick();   // 美式居合：物理技能計數
      // 視覺：有投射物的職業射一輪，近戰撲上去
      if (targets.length) {
        if (e.fromShip && this.shipImg) this.shipVolley(e.fromShip, targets, hits);
        else if (u.st.missile) targets.forEach((t, i) => { for (let h = 0; h < Math.min(3, hits); h++) this.shoot(u, t, u.st.missile, i * 3 + h); });
        else this.lunge(u);
        targets.forEach(t => {
          const ring = this.add.circle(t.img.x, t.img.y - 30, 10, Phaser.Display.Color.HexStringToColor(col).color, 0.55).setDepth(45);
          this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        });
      }
      // 詛咒油畫：先把命中敵人身上的減益刷新回完整時間
      if (e.refreshDebuffs) targets.forEach(t => Object.values(t.fx).forEach(f => { if (f.t > 0 && f.full) f.t = Math.max(f.t, f.full); }));
      // 傷害（多段用延遲打出）
      let stunHealed = false;
      const mult = e.mult;
      const castState = {};   // 同一次施放共用（毒爪暴擊回血只回一次）   // 狗群圍攻：咬到暈眩敵人回血，每次施放只回一次
      for (let h = 0; h < hits; h++) {
        const doHit = () => targets.forEach(t => {
          if (!this.valid(t)) return;
          if (e.stunHeal && !stunHealed && u.alive && this.fxv(t, 'stun')) { stunHealed = true; this.heal(u, Math.round(u.st.maxHp * e.stunHeal)); this.glow(u, '#7dff9a'); }
          const wasAlive = t.alive, wasStunned = this.fxv(t, 'stun') > 0;
          this.hit(u, t, mult, { skill: true, critBonus: e.critBonus, vsBleed: e.vsBleed, vsPoisonSkill: e.vsPoisonSkill, vsStunSkill: e.vsStunSkill, vsBlind: e.vsBlind, critDmgBonus: e.critDmgBonus, critFinalX: e.critFinalX, critHealMax: e.critHealMax, castState, stunBonus: e.stunBonus, elseDmgPct: e.elseDmgPct, breakStun: e.breakStun, drain: e.drain, noFlash: targets.length > 1, nextBonus });
          if (e.stunHunter && wasStunned) this.addFx(u, 'stunHunter', e.stunHunter.v, e.stunHunter.t);   // 大爆射一波！
          if (e.feverOnKill && wasAlive && !t.alive) this.startFever(u, e.feverOnKill);   // 處決擊殺
          const ss = this.fxv(u, 'stunSkill');   // 乖狗狗：動物系技能命中機率暈眩
          if (ss && this.valid(t) && Math.random() < ss * this.procMult(u) * (this.fxv(t, 'stun') ? G.STUN.procMult : 1)) this.debuff(u, t, 'stun', 1, 1.5);
        });
        const delay = (e.fromShip && this.shipImg ? ({ cannon: 400, nuke: 620, barrage: 460 }[e.fromShip] || 420) : 0) + h * 130;   // 飛彈飛到才算命中
        if (delay === 0) doHit(); else this.time.delayedCall(delay, () => { if (u.alive) { doHit(); this.checkWaveEnd(); } });
      }
      (e.debuffs || []).forEach(db => targets.forEach(t => { if (this.valid(t)) this.debuff(u, t, db.id, db.v, db.t); }));
      // 增益：德魯伊「野性之絆」延長持續時間、「獸群之心」提高數值
      const bv = b => b.v * (u.st.buffPow || 1), bt = b => b.t * (u.st.buffDur || 1);
      (e.self || []).forEach(b => { this.addFx(u, b.id, bv(b), bt(b)); this.glow(u, col); });
      (e.party || []).forEach(b => this.partyAlive().forEach(p => { this.addFx(p, b.id, bv(b), bt(b)); this.glow(p, col); }));
      (e.partyOthers || []).forEach(b => this.partyAlive().filter(p => p !== u).forEach(p => { this.addFx(p, b.id, bv(b), bt(b)); this.glow(p, col); }));   // 只給其他隊友
      if (e.partyOthersType) this.partyAlive().filter(p => p !== u && p.kind !== 'summon' && p.st.dmgType === e.partyOthersType.type).forEach(p => e.partyOthersType.fx.forEach(b => this.addFx(p, b.id, bv(b), bt(b))));   // 某系別的其他隊友（取高）
      this.units.forEach(p => this.syncHpBoost(p));
      (e.selfDebuff || []).forEach(b => this.addFx(u, b.id, b.v, bt(b)));   // 施放者自己的代價
      if (e.hpCost) { const c = Math.floor(u.hp * e.hpCost); if (c > 0) { u.hp = Math.max(1, u.hp - c); this.floatText(u.img.x, this.barY(u) - 6, '-' + c, '#ff6b6b', 13, 700); } }   // 扣目前生命
      if (e.heal) this.partyAlive().forEach(p => { this.heal(p, Math.round(p.st.maxHp * e.heal)); this.glow(p, col); });
      // 舷砲齊射：施放時有其他隊友正在挑釁 → 全隊技能冷卻 -50%，5 秒（跟其他冷卻縮短相加，受上限）
      if (e.tauntCdr && this.partyAlive().some(p => p !== u && p.taunt && p.taunt.t > 0)) {
        this.cdrBoost = { v: e.tauntCdr.v, t: e.tauntCdr.t };
        this.partyAlive().forEach(p => this.glow(p, '#9fd8ff'));
        this.floatText(u.img.x, this.barY(u) - 40, G.t('battle.cover_fire'), '#9fd8ff', 15, 1000);
      }
      if (e.feverChance && targets.length && !(this.fever && this.fever.t > 0) && Math.random() < e.feverChance) this.startFever(u, e.feverOnKill);   // 處決：2% 機率直接血之狂熱
      if (e.cannonShot && G.cannonMult() > 0) this.fireCannon(e.cannonShot);   // 舷砲齊射：額外一發船砲
      if (e.healOthers) this.partyAlive().filter(p => p !== u && p.kind !== 'summon').forEach(p => { this.heal(p, Math.round(p.st.maxHp * e.healOthers)); this.glow(p, '#7dff9a'); });   // 煙霧彈：其他隊友回血
      if (e.selfHeal) { this.heal(u, Math.round(u.st.maxHp * e.selfHeal)); this.glow(u, col); }
      // 護盾：美甲師「指尖藝術」加厚；不會蓋掉比較厚的舊盾
      if (e.shield) this.partyAlive().forEach(p => {
        const amt = Math.round(p.st.maxHp * e.shield * (u.st.shieldPow || 1) * (1 + (this.aura.shieldAmt || 0)));   // 領航員／博學：護盾量、時間 +200%
        if (amt >= (p.shield || 0)) { p.shield = amt; p.shieldBase = amt; p.shieldDurBase = 8 * (1 + (this.aura.shieldDur || 0)); p.shieldReborn = false; }
        p.shieldT = 8 * (1 + (this.aura.shieldDur || 0)); this.glow(p, col);
      });   // 領航員：護盾量、時間 +200%
      if (e.partyType) this.partyAlive().filter(p => p.st.dmgType === e.partyType.type).forEach(p => e.partyType.fx.forEach(b => { this.addFx(p, b.id, bv(b), bt(b)); this.glow(p, col); }));   // 只給某系別的隊友
      if (e.synBoost) { this.synBoost = { v: Math.max(e.synBoost.v, this.synBoost && this.synBoost.t > 0 ? this.synBoost.v : 0), t: e.synBoost.t }; this.computeAura(); }   // 喵喵鼓舞：團隊特效暫時加強
      if (e.taunt) { u.taunt = { v: e.taunt.v, t: e.taunt.t }; this.glow(u, '#ffd23f'); }
      if (e.summon) this.summonAnimal(u, e.summon, e.aura);
      if (e.summonMinion) this.summonMinion(u, e.summonMinion.kind, e.summonMinion.power);
      if (e.wraith) this.summonWraith(u, e.wraith);
      if (e.cannonShots && G.cannonMult() > 0) for (let i = 0; i < e.cannonShots.n; i++) this.time.delayedCall(i * 220, () => this.fireCannon(e.cannonShots.bonus));   // 集中砲火
      if (e.tome) this.tomeBuff = { cannon: e.tome.cannon, purge: e.tome.purge, t: e.tome.t };   // 百科全書
      if (e.overdrive) { this.overdrive = { t: e.overdrive }; this.cannonT = Math.min(this.cannonT, G.cannonInterval(this.aura) / 2); }   // 引擎超載：船砲間隔減半
      // 速寫：船砲強化一段時間；全隊身上的增益延長
      if (e.sketch) { this.sketch = { t: e.sketch.t, chance: Math.max(e.sketch.chance, this.sketch && this.sketch.t > 0 ? this.sketch.chance : 0) }; this.cannonT = Math.min(this.cannonT, G.cannonInterval(this.aura) / 2); }
      if (e.buffExtend) this.partyAlive().forEach(p => BUFF_IDS.forEach(id => { const f = p.fx[id]; if (f && f.t > 0) f.t += e.buffExtend; }));
      if (e.cdCut) this.partyAlive().forEach(p => p.skills.forEach(x => { if (x !== s) x.cd = Math.max(0, x.cd - e.cdCut); }));
      return true;
    }

    // 死靈術師：召喚物（石魔人／骷髏弓箭手），站在隊伍正前方，場上最多一隻
    minionAlive() { return !!(this.minion && this.minion.unit.alive); }
    summonMinion(owner, kind, power) {
      if (this.minionAlive()) return;
      const S = G.SUMMONS[kind], sp = power * (owner.st.summonPower || 1);
      const st = {
        maxHp: Math.round(owner.st.maxHp * S.stats.hp * sp), atk: owner.st.atk * S.stats.atk * sp, def: owner.st.def * S.stats.def * sp,
        spd: S.spd, crit: 5, critDmg: 1.5, ranged: false, range: 'one', dmgType: 'dark', missile: S.missile,
      };
      const lr = this.legionRank(); if (lr) st.maxHp = Math.round(st.maxHp * (1 + G.UNDEAD_LEGION.hp(lr)));   // 亡靈軍團：召喚物生命
      const unit = this.makeUnit({ side: 'party', kind: 'summon', minion: kind, st, x: 224, texture: 'summon_' + kind, originY: 0.94, scale: 0.85 });
      unit.img.setAlpha(0);
      this.tweens.add({ targets: unit.img, alpha: 1, duration: 300 });
      const sk = G.SUMMON_SKILLS[kind];   // 召喚物自己的技能（挑釁／箭雨）
      if (sk) unit.skills = [{ def: sk, rank: 1, cd: sk.cd0 }];
      this.units.push(unit);
      this.minion = { kind, unit, owner };
      this.floatText(224, GROUND - 80, G.t('summon.' + kind), '#c99bff', 15, 900);
    }

    // 飛船船長：飛空艇的各種發射動畫（傷害由技能本身結算）
    shipVolley(kind, targets, hits) {
      const sx = this.shipImg.x - 10, sy = this.shipImg.y + 24;
      const ball = (t, color, r, dy, delay) => {
        const b = this.add.circle(sx, sy + dy, r, color).setDepth(40);
        this.tweens.add({ targets: b, x: t.img.x, y: t.img.y - 30 + dy, duration: 380, delay, ease: 'Quad.in', onComplete: () => b.destroy() });
      };
      if (kind === 'cannon') {                 // 集中砲火：一發一發砲彈
        for (let h = 0; h < hits; h++) ball(targets[0], 0x222222, 6, 0, h * 130);
      } else if (kind === 'nuke') {            // 核彈：一顆大飛彈落在敵人中間，大爆炸
        const cx = targets.reduce((a, t) => a + t.img.x, 0) / targets.length, cy = GROUND - 30;
        const k = this.add.image(sx, sy, 'ms_rocket0').setDepth(40).setScale(2.6);
        k.rotation = Math.atan2(cy - sy, cx - sx);
        this.tweens.add({ targets: k, x: cx, y: cy, duration: 600, ease: 'Quad.in', onComplete: () => {
          k.destroy();
          const boom = this.add.circle(cx, cy, 14, 0xffa040, 0.9).setDepth(45), flash = this.add.circle(cx, cy, 10, 0xffffff, 0.9).setDepth(46);
          this.tweens.add({ targets: boom, scale: 9, alpha: 0, duration: 650, onComplete: () => boom.destroy() });
          this.tweens.add({ targets: flash, scale: 5, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
          this.cameras.main.shake(250, 0.01);
          this.floatText(cx, cy - 50, G.t('battle.nuke'), '#ffb36b', 18, 1000);
        } });
      } else if (kind === 'barrage') {         // 艦砲武裝齊射：一大堆小飛彈＋三顆並排藍色砲彈
        targets.forEach((t, i) => { for (let n = 0; n < 3; n++) this.shipMissile(t, i * 3 + n, 0.7); });
        [-12, 0, 12].forEach(dy => ball(targets[0], 0x4aa8ff, 6, dy, 60));
      } else {                                 // 飛彈齊發
        targets.forEach((t, i) => this.shipMissile(t, i));
      }
    }

    // 飛船船長：飛空艇發射飛彈（只是動畫，傷害由技能本身結算）
    shipMissile(t, i, scale = 1.1) {
      const sx = this.shipImg.x - 10, sy = this.shipImg.y + 24, tx = t.img.x, ty = t.img.y - 30;
      const k = this.add.image(sx, sy + G.rand(-6, 6), `ms_rocket${G.randInt(0, MISSILE_VARIANTS - 1)}`).setDepth(40).setScale(scale);
      k.rotation = Math.atan2(ty - sy, tx - sx);
      this.tweens.add({ targets: k, x: tx, y: ty, duration: 400, delay: i * 40, ease: 'Quad.in', onComplete: () => {
        k.destroy();
        const boom = this.add.circle(tx, ty, 8, 0xffa040, 0.8).setDepth(45);
        this.tweens.add({ targets: boom, scale: 3, alpha: 0, duration: 300, onComplete: () => boom.destroy() });
      } });
    }

    // 德魯伊：召喚動物（同時只有一隻），在場時給全隊光環
    summonAnimal(owner, kind, auraV) {
      this.units.filter(x => x.kind === 'summon').forEach(x => { x.alive = false; x.img.destroy(); });
      this.units = this.units.filter(x => x.kind !== 'summon');
      const A = G.ANIMALS[kind], sp = owner.st.summonPower || 1;
      const st = {
        maxHp: Math.round(owner.st.maxHp * A.stats.hp * sp), atk: owner.st.atk * A.stats.atk * sp, def: owner.st.def * A.stats.def * sp,
        spd: 1, crit: 5, critDmg: 1.5, ranged: false, range: 'one', dmgType: 'animal',
      };
      const unit = this.makeUnit({ side: 'party', kind: 'summon', animal: kind, st, x: 224, texture: 'animal_' + kind, originY: 0.94, scale: 0.85 });
      unit.img.setAlpha(0);
      this.tweens.add({ targets: unit.img, alpha: 1, duration: 300 });
      this.units.push(unit);
      this.animal = { kind, v: auraV * (owner.st.animalAura || 1), unit };
      this.computeAura();
      this.floatText(224, GROUND - 80, A.icon, '#ffffff', 22, 900);
    }

    glow(u, color) {
      const c = this.add.circle(u.img.x, u.img.y - 30, 26, Phaser.Display.Color.HexStringToColor(color).color, 0.35).setDepth(9);
      this.tweens.add({ targets: c, scale: 1.6, alpha: 0, duration: 500, onComplete: () => c.destroy() });
    }

    kill(u) {
      if (u.flashTw) { u.flashTw.stop(); u.flashTw = null; }
      u.alive = false;
      u.hp = 0;
      u.fx = {};
      // 倒下 → 吸貓狂熱歸零
      if (u.key) { u.frenzy = 0; this.frenzyMem[u.key] = 0; }
      if (u.side === 'enemy') {
        this.tweens.add({ targets: u.img, alpha: 0, y: u.img.y + 10, duration: 350, onComplete: () => u.img.setVisible(false) });
        this.reward(u);
      } else if (u.kind === 'summon') {
        this.tweens.add({ targets: u.img, alpha: 0, duration: 300, onComplete: () => u.img.destroy() });
        this.units = this.units.filter(x => x !== u);
        if (this.animal && this.animal.unit === u) { this.animal = null; this.computeAura(); }
        if (this.minion && this.minion.unit === u) {   // 召喚物倒下
          const o = this.minion.owner; this.minion = null;
          // 亡靈軍團：召喚物倒下 → 屍爆，對敵方全體造成（召喚物＋主人最大生命）的傷害，無視防禦
          if (this.legionRank() > 0) {
            const dmg = Math.max(1, Math.round(u.st.maxHp + (o ? o.st.maxHp : 0)));
            this.floatText(u.img.x, this.barY(u) - 30, G.t('battle.legionBlast'), '#9dff9d', 15, 1000);
            const ring = this.add.circle(u.img.x, u.img.y - 30, 14, 0x9dff9d, 0.45).setDepth(45);
            this.tweens.add({ targets: ring, scale: 8, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
            this.enemiesAlive().forEach(t => this.damage(t, dmg, '#9dff9d', true, true));
            this.time.delayedCall(0, () => this.checkWaveEnd());
          }
        }
      } else {
        // 船艙寵物「復活」：立刻滿血站起來（每 60 秒一次）
        if (G.petPerk('revive') && Date.now() >= (G.petReviveAt || 0)) {
          G.petReviveAt = Date.now() + G.PET_REVIVE_CD * 1000;
          u.alive = true; u.hp = u.st.maxHp;
          this.glow(u, '#ff9ee8');
          this.floatText(u.img.x, u.img.y - 60, G.t('battle.petRevive'), '#ff9ee8', 15, 1200);
          return;
        }
        // 主角或夥伴倒下：變灰，波次結束時復活。全隊（不算召喚動物）都倒下才算戰敗
        u.img.setAlpha(0.3).setTint(0x777777);
        if (this.mode !== 'dead' && !this.units.some(x => x.alive && x.kind !== 'summon')) this.defeat();
      }
    }

    reward(u) {
      const f = G.S.floor, S = G.S;
      const r = G.rewardFor(f, u.boss);
      const gold = Math.round(r.gold * G.goldMult());
      S.gold += gold;
      G.gainXp(r.xp);
      this.floatText(u.img.x, u.img.y - 10, `+${G.fmt(gold)}💰`, '#ffe066', 13, 900);

      // 掉寶
      const drops = u.boss ? 2 : Math.random() < 0.18 ? 1 : 0;
      for (let i = 0; i < drops; i++) {
        const it = G.makeItem(f, u.boss);
        const res = G.addItem(it);
        if (it.rarity >= 2 && res === 'ok') G.addLog('log.drop', { rarity: { k: `rarity.${it.rarity}` }, item: { item: { slot: it.slot, base: it.base, rarity: it.rarity } } }, G.RARITY[it.rarity].color);
        if (res === 'full') G.addLog('log.bagFull', null, '#aaa');
      }
      // 雲晶
      const crystal = u.boss ? 1 + Math.floor(f / 5) : Math.random() < 0.04 ? 1 : 0;
      if (crystal) { S.crystal += crystal; this.floatText(u.img.x, u.img.y - 30, `+${crystal}💎`, '#9fe8ff', 13, 900); }
      // 捕獲
      // 捕獲（裝著捕獸網才有機率）
      if (!u.boss && Math.random() < G.captureChance()) {
        G.capture(u);
        this.floatText(u.img.x, u.img.y - 50, '🕸️', '#ffffff', 20, 900);
      }
      // 船艙寵物：隨機掉落（越高層越容易，層主更高）
      if ((u.boss && G.bossPetGift()) || G.rollPet(f, u.boss)) this.floatText(u.img.x, u.img.y - 70, '🐾', '#ff9ee8', 22, 1200);   // 層主送寵物（少於 6 隻時）優先，沒送到才走一般掉落
      if (!u.boss) S.kills++;
      else this.bossCleared();
    }

    bossCleared() {
      const S = G.S, f = S.floor;
      S.kills = 0;
      // 圖鑑：打倒層主 → 這一層的怪物都登錄為「已發現」
      G.monsterTier(f).forEach(m => G.dexMark(m.id, 'seen'));
      if (f + 1 > S.maxFloor) {
        S.maxFloor = f + 1;
        G.addLog('log.bossDown', { f, n: f + 1 }, '#ffd76a');
        const unlocked = G.PARTNERS.find(p => p.floor === f + 1 || p.floor === f);
        if (unlocked && !S.partners[unlocked.id] && S.maxFloor >= unlocked.floor) G.addLog('log.partnerAvail', { name: { k: `partner.${unlocked.id}.name` } }, '#7fd1ff');
      }
      const shipCap = G.shipMaxFloor();
      if (S.autoAdvance) {
        if (f + 1 <= shipCap) {
          S.floor = f + 1;
          this.time.delayedCall(900, () => this.applyFloorTheme());
          this.floatText(W / 2, 80, G.t('battle.toFloor', { n: S.floor }), '#ffffff', 22, 1500);
        } else if (!this.capWarned) {
          this.capWarned = true;
          G.addLog('log.capReached', { n: shipCap }, '#ffb36b');
          G.emit('toast', G.t('toast.capReached', { n: shipCap }));
        }
      }
      G.emit('floorChange');
    }

    // 戰敗：等 30 秒免費復活（退回上一層），或花雲晶原地復活
    defeat() {
      this.mode = 'dead';
      this.hero.img.setAlpha(0.35).setTint(0x777777);
      this.floatText(W / 2, 110, G.t('battle.defeat'), '#ff6b6b', 26, 1600);
      // 用真實時間計時：分頁切到背景時 Phaser 會暫停，但復活倒數要照算
      this.reviveAt = Date.now() + G.CONFIG.reviveSeconds * 1000;
      G.addLog('log.defeat', { n: G.S.floor }, '#ff8a8a');
      // 戰敗 → 士氣歸零
      if (G.S.morale > 0) { G.S.morale = 0; G.addLog('log.moraleLost', null, '#ff8a8a'); }
      G.emit('dead', true);
    }

    // 倒數結束：免費復活，退回上一層修練
    reviveFree() {
      const S = G.S;
      const back = Math.max(1, S.floor - 1);
      this.reviveAt = 0;
      S.autoAdvance = false;
      S.floor = back; S.kills = 0;
      G.addLog('log.reviveFree', { n: back }, '#ff8a8a');
      G.emit('dead', false);
      G.emit('floorChange');
      this.restartFloor();
    }

    // 花雲晶：全隊原地滿血復活，繼續這場戰鬥
    revivePaid() {
      const S = G.S, cost = G.CONFIG.reviveCost;
      if (this.mode !== 'dead') return;
      if (S.crystal < cost) return G.emit('toast', G.t('toast.reviveNeed', { n: cost }));
      S.crystal -= cost;
      this.reviveAt = 0;
      this.units.forEach(u => {
        if (u.kind === 'summon') return;
        u.alive = true; u.hp = u.st.maxHp;
        u.img.setAlpha(1).clearTint();
        this.glow(u, '#ffd76a');
      });
      this.floatText(W / 2, 110, G.t('battle.revived'), '#ffd76a', 26, 1200);
      G.addLog('log.revivePaid', { n: cost }, '#9fe8ff');
      G.emit('dead', false);
      this.mode = 'fight';
      this.checkWaveEnd();
    }

    waveCleared() {
      // 戰後休整：回 25% 血，倒下的夥伴復活；動物留在場上
      this.units.forEach(u => {
        if (u.kind === 'summon') return;
        if (!u.alive) { u.alive = true; u.hp = u.st.maxHp * 0.3; u.img.setAlpha(1).clearTint(); }
        u.hp = Math.min(u.st.maxHp, u.hp + u.st.maxHp * 0.25);
      });
      this.enemies.forEach(e => { e.img.destroy(); if (e.dbLabel) e.dbLabel.destroy(); });
      this.enemies = [];
      if (this.needRebuild) {
        const ratio = this.hero.hp / this.hero.st.maxHp;
        this.buildParty();
        this.hero.hp = this.hero.st.maxHp * ratio;
      }
      this.mode = 'walk';
      this.walkT = 1.2 / this.travelSpeed();
    }

    // ── 文字特效 ─────────────────────────────────────────────────────────
    barY(u) { return u.img.y - u.img.displayHeight * 0.95 - 8; }   // 血條的 y（浮動文字從這上面開始，不擋血條）
    floatText(x, y, text, color, size = 14, dur = 700) {
      const t = this.add.text(x, y, text, {
        fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif', fontSize: size + 'px', fontStyle: 'bold',
        color, stroke: '#1a1428', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(70);
      this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: dur, ease: 'Quad.out', onComplete: () => t.destroy() });
    }

    // 引擎越好，在空中前進越快
    travelSpeed() { return 1 + (G.shipTier('engine') + 1) * 0.08; }

    // ── 每幀更新 ─────────────────────────────────────────────────────────
    update(_, dtMs) {
      const dt = Math.min(0.1, dtMs / 1000);
      const walking = this.mode === 'walk' || this.mode === 'enter';
      const speed = 70 * this.travelSpeed();
      if (walking) {
        this.ground.tilePositionX += speed * dt * (this.floorImg ? 2 : 1);   // tileScale 0.5 → 位移要 ×2 才跟角色步伐一致
        if (this.mountains) this.mountains.tilePositionX += speed * 0.15 * 2 * dt;   // 遠山：地板的 15%
        this.cloudNear.tilePositionX += speed * 0.5 * dt;
        this.cloudFar.tilePositionX += speed * 0.2 * dt;
        if (this.islandsLayer) this.islandsLayer.tilePositionX += speed * 0.1 * dt;
        // 走路上下晃
        const bob = Math.abs(Math.sin(this.time.now / 140)) * 3;
        this.units.forEach(u => { if (u.alive) u.img.y = GROUND - bob; });
      } else {
        this.cloudFar.tilePositionX += 6 * dt;
        this.units.forEach(u => { u.img.y = GROUND; });
      }

      if (this.mode === 'walk') {
        this.walkT -= dt;
        this.regenTick(dt);
      if (this.sketch && this.sketch.t > 0) this.sketch.t -= dt;
        if (this.walkT <= 0) {
          if (this.needRebuild) this.buildParty();
          this.spawnWave();
        }
      } else if (this.mode === 'fight') {
        this.fightTick(dt);
      } else if (this.mode === 'dead' && this.reviveAt && Date.now() >= this.reviveAt) {
        this.reviveFree();
      }
      this.wraithFollow();
      this.drawBars();
    }

    // 回血（健身者「恢復日」、德魯伊鹿/自然之靈、regen buff）：每秒結算一次
    regenTick(dt) {
      this.units.forEach(u => {
        if (!u.alive) return;
        u.regenAcc = (u.regenAcc || 0) + dt;
        if (u.regenAcc < 1) return;
        u.regenAcc -= 1;
        const r = (u.kind === 'summon' && u.minion ? this.pactPerDebuff('regen') : 0) + (u.st.regen || 0) + (this.aura.regen || 0) + (this.party(u) ? this.shadowV('darkRegen') : 0) + (this.isDark(u) && this.grudgeV() ? G.GRUDGE.regen : 0) + this.fxv(u, 'regen') + this.fxv(u, 'breeze') + (this.party(u) && u.kind !== 'summon' ? this.feverSum() / 10000 : 0);   // 血之狂熱回血
        if (r > 0 && u.hp < u.st.maxHp) this.heal(u, Math.max(1, Math.round(u.st.maxHp * r)), false);
      });
    }

    fightTick(dt) {
      if (this.fever && this.fever.t > 0) this.fever.t -= dt;
      if (this.tomeBuff && this.tomeBuff.t > 0) this.tomeBuff.t -= dt;
      if (this.curseOff && this.curseOff.t > 0) this.curseOff.t -= dt;
      if (this.arcane && this.arcane.t > 0) this.arcane.t -= dt;
      if (this.shadow && this.shadow.t > 0) this.shadow.t -= dt;
      if (this.overdrive && this.overdrive.t > 0) this.overdrive.t -= dt;
      if (this.bloodRush && this.bloodRush.t > 0) this.bloodRush.t -= dt;
      if (this.cdrBoost && this.cdrBoost.t > 0) this.cdrBoost.t -= dt;
      if (this.synBoost && this.synBoost.t > 0) { this.synBoost.t -= dt; if (this.synBoost.t <= 0) this.computeAura(); }   // 喵喵鼓舞到期，團隊特效恢復
      const all = [...this.units, ...this.enemies];
      this.units.forEach(u => this.syncHpBoost(u));   // 野性狂暴到期：最大生命恢復
      all.forEach(u => {
        if (!u.alive) return;
        // 狀態倒數
        Object.values(u.fx).forEach(f => { if (f.t > 0) f.t -= dt; });
        this.doomTick(u, dt); if (!u.alive) return;   // 死亡詛咒：逐層到期引爆
        if (u.decayBase && !this.fxv(u, 'decay')) { u.st.maxHp = u.decayBase; delete u.decayBase; }   // 衰老詛咒到期：最大生命還原
        if (u.taunt.t > 0) u.taunt.t -= dt;
        if (u.shieldT > 0 && (u.shieldT -= dt) <= 0) u.shield = 0;
        // 流血 / 中毒：每秒結算，不吃防禦
        u.dotAcc += dt;
        if (u.dotAcc >= 1) {
          u.dotAcc -= 1;
          const b = this.fxv(u, 'bleed'), p = this.fxv(u, 'poison');
          if (b) this.damage(u, Math.max(1, Math.round(b)), '#ff5050', false, true);
          if (p && u.alive) this.damage(u, Math.max(1, Math.round(p)), '#7dff7d', false, true);
          if (!u.alive) return;
        }
        if (this.mode !== 'fight') return;
        if (this.fxv(u, 'stun')) return;   // 暈眩：不能攻擊、不能放技能（冷卻也暫停）
        for (const s of u.skills) {
          s.cd -= dt;
          if (s.cd <= 0 && this.enemiesAlive().length) {
            if (this.castSkill(u, s)) { s.cd = this.baseCd(u, s) * (1 - Math.min(G.CONFIG.cdrCap, (this.aura.cdr || 0) + (u.st.cdr || 0) + (u.st.shipCdr || 0) * G.shipTotalLv() + this.feverSum() / 100 + this.cdrBoostV() + this.shadowV('darkCdr'))); if (this.rushOn()) s.cd = Math.min(s.cd, 1); break; }   // 血性加速：冷卻最多 1 秒
            s.cd = 0.5;   // 條件不符（沒人受傷等），晚點再試
          }
        }
        if (!u.alive || this.mode !== 'fight') return;
        u.atkCd -= dt;
        if (u.atkCd <= 0) { u.atkCd = 1 / this.spdOf(u); this.basicAttack(u); }
      });
      this.regenTick(dt);
      this.wraithTick(dt);

      // 船砲支援
      if (this.mode === 'fight' && G.cannonMult() > 0 && this.enemiesAlive().length) {
        this.cannonT -= dt;
        if (this.cannonT <= 0) {
          const sk = this.sketch && this.sketch.t > 0 ? this.sketch : null;
          const od = this.overdrive && this.overdrive.t > 0;
          this.cannonT = G.cannonInterval(this.aura) / (sk || od ? 2 : 1);   // 速寫、引擎超載：減半   // 團隊特效、貓哈氣爆甲可縮短；速寫期間減半
          this.fireCannon(0);
        }
      }
      this.checkWaveEnd();
    }

    // 發射一發船砲；bonus = 這一發的額外傷害（舷砲齊射）
    fireCannon(bonus) {
      const t = this.enemiesAlive()[0];
      if (!t || !this.hero || !this.shipImg) return;
      const sk = this.sketch && this.sketch.t > 0 ? this.sketch : null;
      const src = { kind: 'cannon', side: 'cannon', st: { atk: this.hero.st.atk, crit: this.aura.cannonCrit || 0, critDmg: this.aura.cannonCritDmg || 2.5 }, fx: {}, special: {}, alive: false };   // 王牌砲手：船砲可暴擊
      const ball = this.add.circle(this.shipImg.x - 20, this.shipImg.y + 30, bonus ? 7 : 5, bonus ? 0x7a2f2f : 0x222222).setDepth(40);
      this.tweens.add({ targets: ball, x: t.img.x, y: t.img.y - 30, duration: 380, ease: 'Quad.in', onComplete: () => {
        ball.destroy();
        if (this.valid(t)) {
          const cvd = this.aura.cannonVsDefDown && this.fxv(t, 'defDown') ? 1 + this.aura.cannonVsDefDown : 1;   // 腐蝕顏料：砲擊打破防中的敵人
          this.hit(src, t, G.cannonMult() * cvd * (1 + bonus) * (1 + (this.aura.cannonDmg || 0)) * (1 + (this.tomeBuff && this.tomeBuff.t > 0 ? this.tomeBuff.cannon : 0)));   // 砲術長、百科全書：船砲傷害
          if (this.tomeBuff && this.tomeBuff.t > 0 && this.curse && Math.random() < this.tomeBuff.purge) { this.curseOff = { t: 4 }; this.floatText(W / 2, 135, G.t('battle.curseOff'), '#ffe27a', 15, 1200); }   // 百科全書：解除上升詛咒 4 秒 this.floatText(t.img.x, this.barY(t) - 24, G.t('battle.cannon'), '#ffb36b', 13);
          if (sk && Math.random() < sk.chance) this.enemiesAlive().forEach(x => this.debuff(src, x, 'stun', 1, 1.5));   // 速寫：砲擊暈眩全體
          this.checkWaveEnd();
        }
      } });
    }

    checkWaveEnd() {
      if (this.mode === 'fight' && this.enemies.length && !this.enemiesAlive().length) {
        this.mode = 'clearing';
        this.time.delayedCall(450, () => this.waveCleared());
      }
    }

    // ── 目前生效中的 buff（給介面左上角的圖示用）───────────────────────────
    getBuffs() {
      const out = [], S = G.S;
      if (!this.hero) return out;
      const pct = v => Math.round(v * 100);
      if (this.curse && !this.curseNow()) out.push({ id: 'curseOff', icon: '✨', val: `${Math.ceil(this.curseOff.t)}s`, p: { s: Math.ceil(this.curseOff.t) } });
      else if (this.curse) out.push({ id: 'curse', icon: '🌪️', val: G.curseShort(this.curse), p: { text: G.curseText(this.curse), n: G.S.floor } });
      if (G.petPerk('revive') && (G.petReviveAt || 0) > Date.now()) { const s = Math.ceil((G.petReviveAt - Date.now()) / 1000); out.push({ id: 'petRevive', icon: '💀', val: `${s}s`, p: { s } }); }
      if (this.tomeBuff && this.tomeBuff.t > 0) out.push({ id: 'tome', icon: G.FX_ICON.tome, val: `${Math.ceil(this.tomeBuff.t)}s`, p: { v: pct(this.tomeBuff.cannon), c: pct(this.tomeBuff.purge), s: Math.ceil(this.tomeBuff.t) } });
      const mc = G.moraleCap();
      // 貓貓士氣：有人裝就顯示（全隊暈眩、閃避不用等疊層）
      if (mc) {
        const ps = this.pStun || { chance: 0, t: 0 };
        out.push({ id: 'morale', icon: G.FX_ICON.morale, val: `+${Math.min(S.morale, mc)}%`,
          p: { n: Math.min(S.morale, mc), max: mc, stun: +(ps.chance * 100).toFixed(1), stunT: +ps.t.toFixed(2), evade: pct(this.aura.evade || 0) } });
      }
      const fc = G.frenzyCap();
      if (fc) {
        const members = this.units.filter(u => u.key);
        const top = Math.max(0, ...members.map(u => u.frenzy || 0));
        if (top > 0) {
          const list = members.map(u => `${G.whoName(u.key)} +${u.frenzy}%`).join('、');
          // 裝備者自己的額外加成（閃避、暴擊傷害、對中毒）
          const wearer = members.find(u => G.charOf(u.key).passive.includes('ck_frenzy'));
          const sk = G.skillDef('catknight', 'ck_frenzy'), r = wearer ? G.charOf(wearer.key).skills.ck_frenzy || 0 : 0;
          const self = wearer && r ? G.t('buff.frenzy.self', { who: G.whoName(wearer.key), evade: pct(sk.also.evade(r)), critDmg: pct(sk.also.critDmg(r)), vsPoison: pct(sk.also.vsPoison(r)) }) : '';
          out.push({ id: 'frenzy', icon: G.FX_ICON.frenzy, val: `+${top}%`, p: { max: fc, list, self } });
        }
      }
      if (this.animal && this.animal.unit.alive) {
        const A = G.ANIMALS[this.animal.kind], raw = A.aura === 'crit';
        const val = A.aura === 'regen' ? `${(this.animal.v * 100).toFixed(1)}%/s` : raw ? `+${Math.round(this.animal.v)}%` : `+${pct(this.animal.v)}%`;
        out.push({ id: 'animal_' + this.animal.kind, icon: A.icon, val, p: { v: val } });
      }
      // 我方 buff：取全隊最大值
      const party = this.partyAlive();
      BUFF_IDS.forEach(id => {
        const on = party.filter(u => this.fxv(u, id));
        if (!on.length) return;
        const v = Math.max(...on.map(u => u.fx[id].v)), s = Math.ceil(Math.max(...on.map(u => u.fx[id].t)));
        // critUp 存的是百分點（例如 8 = +8%）；regen 每秒比例很小，留一位小數
        const shown = id === 'critUp' ? Math.round(v) : id === 'regen' ? +(v * 100).toFixed(1) : pct(v);
        out.push({ id, icon: G.FX_ICON[id], val: `${s}s`, p: { v: shown, s } });
      });
      if (party.some(u => u.st.iai)) out.push({ id: 'snipeCount', icon: G.FX_ICON.snipeCount, val: `${Math.min(50, this.snipeCount || 0)}/50`, p: { v: Math.min(50, this.snipeCount || 0) } });
      if (this.cdrBoostV()) out.push({ id: 'coverFire', icon: G.FX_ICON.coverFire, val: `${Math.ceil(this.cdrBoost.t)}s`, p: { v: pct(this.cdrBoost.v), s: Math.ceil(this.cdrBoost.t) } });
      if (this.overdrive && this.overdrive.t > 0) out.push({ id: 'overdrive', icon: G.FX_ICON.overdrive, val: `${Math.ceil(this.overdrive.t)}s`, p: { s: Math.ceil(this.overdrive.t) } });
      if (this.arcaneOn()) out.push({ id: 'arcane', icon: G.FX_ICON.arcane, val: `${Math.ceil(this.arcane.t)}s`, p: { c: Math.round((this.aura.arcaneCrit || 0) * 100), d: Math.round((this.aura.arcaneCritDmg || 0) * 100), s: Math.ceil(this.arcane.t) } });
      else if (this.aura.arcaneCrit) out.push({ id: 'arcaneCount', icon: G.FX_ICON.arcaneCount, val: `${this.arcaneCount || 0}/100`, p: { v: this.arcaneCount || 0 } });
      if (this.shadowOn()) out.push({ id: 'shadow', icon: G.FX_ICON.shadow, val: `${Math.ceil(this.shadow.t)}s`, p: { s: Math.ceil(this.shadow.t), spd: pct(this.aura.darkSpd || 0), cdr: pct(this.aura.darkCdr || 0), ev: pct(this.aura.darkEvade || 0), rg: +((this.aura.darkRegen || 0) * 100).toFixed(1) } });
      else if (this.aura.darkNeed) out.push({ id: 'shadowCount', icon: G.FX_ICON.shadowCount, val: `${this.shadowCount || 0}/${this.aura.darkNeed}`, p: { v: this.shadowCount || 0, n: this.aura.darkNeed } });
      if (this.rushOn()) out.push({ id: 'bloodRush', icon: G.FX_ICON.bloodRush, val: `${Math.ceil(this.bloodRush.t)}s`, p: { s: Math.ceil(this.bloodRush.t) } });
      const nx = party.find(u => this.fxv(u, 'nextExecute'));
      if (nx) out.push({ id: 'nextExecute', icon: G.FX_ICON.nextExecute, val: `+${pct(nx.fx.nextExecute.v)}%`, p: { v: pct(nx.fx.nextExecute.v) } });
      if (this.fever && this.fever.t > 0) { const fs = this.feverSum(); out.push({ id: 'fever', icon: G.FX_ICON.fever, val: `${Math.ceil(this.fever.t)}s`, p: { cdr: Math.round(Math.min(G.CONFIG.cdrCap * 100, fs)), regen: +(fs / 100).toFixed(2), s: Math.ceil(this.fever.t) } }); }
      if (this.synBoost && this.synBoost.t > 0) out.push({ id: 'synBoost', icon: G.FX_ICON.synBoost, val: `${Math.ceil(this.synBoost.t)}s`, p: { v: pct(this.synBoost.v), s: Math.ceil(this.synBoost.t) } });
      if (this.sketch && this.sketch.t > 0) out.push({ id: 'sketch', icon: G.FX_ICON.sketch, val: `${Math.ceil(this.sketch.t)}s`, p: { v: pct(this.sketch.chance), s: Math.ceil(this.sketch.t) } });
      // 貓哈氣爆甲的全隊效果
      if (this.aura.vsStun || this.aura.cannonCut) out.push({ id: 'hiss', icon: G.FX_ICON.hiss, val: `+${pct(this.aura.vsStun || 0)}%`, p: { v: pct(this.aura.vsStun || 0), cut: this.aura.cannonCut || 0 } });
      const sh = party.reduce((a, u) => a + (u.shield || 0), 0);
      if (sh > 0) out.push({ id: 'shield', icon: G.FX_ICON.shield, val: G.fmt(sh), p: { v: G.fmt(sh) } });
      const taunter = party.find(u => u.taunt.t > 0);
      if (taunter) out.push({ id: 'taunt', icon: G.FX_ICON.taunt, val: `${Math.ceil(taunter.taunt.t)}s`, p: { name: taunter.minion ? G.t('minion.' + taunter.minion) : G.whoName(taunter.key) } });
      // 敵人 debuff 不放這裡，改顯示在每隻敵人腳下（drawDebuffLabel）
      return out;
    }

    drawBars() {
      const g = this.bars;
      g.clear();
      [...this.units, ...this.enemies].forEach(u => {
        if (!u.alive || !u.img.visible) return;
        const w = u.boss ? 70 : 38, x = u.img.x - w / 2, y = this.barY(u);
        g.fillStyle(0x000000, 0.55).fillRect(x - 1, y - 1, w + 2, 6);
        const p = Math.max(0, u.hp / u.st.maxHp);
        g.fillStyle(this.party(u) ? (u.kind === 'summon' ? 0x5bf0a0 : 0x56d364) : 0xe5534b, 1).fillRect(x, y, w * p, 4);
        if (u.shield > 0) g.fillStyle(0x9fd8ff, 0.9).fillRect(x, y - 3, w * Math.min(1, u.shield / u.st.maxHp), 2);
        if (u.taunt.t > 0) g.lineStyle(1, 0xffd23f, 1).strokeRect(x - 1, y - 1, w + 2, 6);
      });
      this.enemies.forEach(u => this.drawDebuffLabel(u));
    }

    // 敵人腳下的 debuff 圖示＋剩餘秒數（例如「💫1.2 💔4」），一眼看出哪隻中了什麼
    drawDebuffLabel(u) {
      const parts = u.alive && u.img.visible ? DEBUFF_IDS.filter(id => this.fxv(u, id)).map(id => {
        const t = u.fx[id].t, n = id === 'doom' && u.doomStacks ? u.doomStacks.length : 0;
        return G.FX_ICON[id] + (n > 1 ? '×' + n + ' ' : '') + (t < 3 ? t.toFixed(1) : Math.ceil(t));   // 死亡詛咒顯示層數   // 快結束時顯示到小數一位
      }) : [];
      // 敵人站得很近：一排最多 2 個（層主 3 個）往下疊，才不會跟隔壁的字疊在一起
      const per = u.boss ? 3 : 2, rows = [];
      for (let i = 0; i < parts.length; i += per) rows.push(parts.slice(i, i + per).join(' '));
      const text = rows.join('\n');
      if (!text) { if (u.dbLabel) u.dbLabel.setVisible(false); return; }
      if (!u.dbLabel) {
        u.dbLabel = this.add.text(u.img.x, GROUND + 3, '', {
          fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif', fontSize: '9px', fontStyle: 'bold',
          color: '#ffffff', stroke: '#1a1428', strokeThickness: 3, align: 'center', lineSpacing: -1,
        }).setOrigin(0.5, 0).setDepth(60);
      }
      u.dbLabel.setPosition(u.img.x, GROUND + 3).setVisible(true);
      if (u.dbLabel.text !== text) u.dbLabel.setText(text);
    }
  }

  G.startBattle = function () {
    G.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'battle',
      width: W * RES, height: H * RES,
      backgroundColor: '#9fd8ff',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true },
      scene: [BattleScene],
    });
  };
  G.battleScene = () => G.game && G.game.scene.getScene('battle');
})();
