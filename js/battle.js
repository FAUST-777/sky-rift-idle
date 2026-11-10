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
  const PARTY_X = [178, 132, 86, 40];
  const ENEMY_X = [305, 355, 405];
  const BUFF_IDS = ['atkUp', 'spdUp', 'defUp', 'dmgReduce', 'critUp', 'evade', 'skillDmg', 'regen', 'reflectUp', 'nextSkill', 'shieldWall', 'stunSkill', 'animalSkill', 'hpUp'];
  const DEBUFF_IDS = ['stun', 'defDown', 'slow', 'blind', 'bleed', 'poison'];
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
      this.ground.setTexture('groundTex');
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
        return def && r ? { def, rank: r, cd: Math.min(5, def.cd * G.rand(0.2, 0.5)) } : null;
      }).filter(Boolean);
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
      this.animal = null;
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
      const dur = t * ((src.st.debuffDur || 1) + (this.party(src) ? this.aura.debuffDur || 0 : 0));   // 黑暗系團隊特效
      if (id === 'stun' && target.alive && !this.fxv(target, 'stun')) this.floatText(target.img.x, this.barY(target) - 12, G.t('battle.stun'), '#ffe066', 12);
      const val = (id === 'bleed' || id === 'poison') ? this.atkOf(src) * G.DOT[id] * v : v;
      // 米菈：破防持續時間累加（數值取最高），上限 G.DEFDOWN_STACK_CAP 秒
      const f = target.fx[id];
      if (id === 'defDown' && this.party(src) && this.aura.defDownStack && f && f.t > 0 && target.alive) {
        f.v = Math.max(f.v, val); f.t = Math.min(G.DEFDOWN_STACK_CAP, f.t + dur);
        return;
      }
      this.addFx(target, id, val, dur);
    }

    party(u) { return u.side === 'party'; }
    atkOf(u)  { return u.st.atk * (1 + this.fxv(u, 'atkUp') + (this.party(u) ? this.aura.atkPct || 0 : 0)); }
    spdOf(u)  { return Math.max(0.25, u.st.spd * (1 + this.fxv(u, 'spdUp') + (this.party(u) ? (this.aura.spdPct || 0) + (u.othersSpd || 0) : 0) - this.fxv(u, 'slow'))); }   // othersSpd：野性之絆（德魯伊自己不吃）
    critOf(u) { return (u.st.crit + this.fxv(u, 'critUp') + (this.party(u) ? this.aura.crit || 0 : 0)) * this.procMult(u); }
    procMult(u) { return this.party(u) ? 1 + (this.aura.procRate || 0) : 1; }   // 觸發率（浪浪園區所長米菈的專屬 buff）
    evadeOf(u) { return this.fxv(u, 'stun') ? 0 : Math.max(0, Math.min(G.CONFIG.evadeCap, (u.st.evade || 0) + this.fxv(u, 'evade') + (this.party(u) ? (this.aura.evade || 0) + (u.othersEvade || 0) : 0))); }   // othersEvade：訓犬師、狗蹭蹭（遛狗者自己不吃）   // 暈眩無法閃避
    defOf(u) {
      let m = 1 + this.fxv(u, 'defUp') - this.fxv(u, 'defDown');
      if (this.party(u)) {
        m += this.aura.defPct || 0;
        if (u.special.crisis && this.crisisOn()) m += u.special.crisis.v2;   // 學者危機意識
      }
      let d = u.st.def * Math.max(0.1, m);
      if (this.party(u)) d *= this.moraleMult();
      if (this.party(u) && this.curse && this.curse.def) d *= 1 - this.curse.def;                 // 上升詛咒：防禦下降
      return d;
    }
    takenMult(u) {
      let m = (1 - (u.st.dmgReduce || 0)) * (1 - this.fxv(u, 'dmgReduce'));
      if (this.party(u)) m *= 1 - (this.aura.dmgReduce || 0);
      if (u.taunt.t > 0) m *= 1 - u.taunt.v;
      if (this.fxv(u, 'stun')) m *= 1 + G.STUN.taken;   // 暈眩受到傷害 +15%
      return Math.max(0.1, m);
    }
    skillMult(u) { return 1 + (u.st.skillDmg || 0) + this.fxv(u, 'skillDmg') + (u.st.dmgType === 'animal' ? this.fxv(u, 'animalSkill') : 0) + (this.party(u) ? this.aura.skillDmg || 0 : 0); }   // animalSkill：喵喵鼓舞

    // 反彈率（已含鏡面甲加成）
    reflectOf(u) {
      if (!this.party(u)) return 0;
      const base = ((u.special.thorns || {}).v || 0) + (this.aura.reflect || 0) + this.fxv(u, 'reflectUp');
      return base * (1 + (this.aura.reflectPow || 0));
    }

    // 即時能力值（冒險頁「即時數值」用）：吃 buff、光環、團隊特效、詛咒，隨戰鬥波動
    liveStats(u) {
      const a = this.aura, curse = this.curse || {};
      return {
        hp: Math.max(0, Math.round(u.hp)), maxHp: u.st.maxHp,
        atk: this.atkOf(u), def: this.defOf(u), spd: this.spdOf(u),
        crit: Math.min(100, this.critOf(u)), critDmg: u.st.critDmg + (a.critDmg || 0),
        cdr: Math.min(G.CONFIG.cdrCap, (a.cdr || 0) + (u.st.cdr || 0)),
        regen: (u.st.regen || 0) + (a.regen || 0) + this.fxv(u, 'regen'),
        lifesteal: u.st.lifesteal || 0,
        evade: this.evadeOf(u),
        dmg: (1 + (a.dmgPct || 0)) * (1 - (curse.dmg || 0)) - 1,
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

    // 我方打最前面的敵人；敵人：挑釁 > 召喚獸 > 加權隨機（近戰位 3、後排 1，後排偶爾也會被打）
    targetFor(u) {
      if (u.side === 'party') return this.enemiesAlive()[0];
      const alive = this.partyAlive();
      const forced = alive.find(p => p.taunt.t > 0) || alive.find(p => p.kind === 'summon');
      if (forced) return forced;
      const w = alive.map(p => (p.st.ranged ? 1 : 3));
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
          this.shoot(target, src, 'bullet', 0, () => this.hit(target, src, target.special.riposte.v, { counter: true }));
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
      if (this.party(src) && this.curse && this.curse.dmg) dmg *= 1 - this.curse.dmg;            // 上升詛咒：傷害下降                    // 飛空艇船首：全隊傷害
      if (this.party(src) && src.frenzy && G.frenzyCap()) dmg *= 1 + Math.min(src.frenzy, G.frenzyCap()) / 100;   // 吸貓狂熱（有人裝被動才生效）
      // 對流血（血騎士、詛咒油畫）、對中毒（詛咒油畫）：同一招兩個都中時相加
      const vsB = this.fxv(target, 'bleed') ? (opts.vsBleed || 0) + ((src.special.vsBleed || {}).v || 0) : 0;
      const vsP = this.fxv(target, 'poison') ? opts.vsPoisonSkill || 0 : 0;
      const vsS = this.fxv(target, 'stun') ? opts.vsStunSkill || 0 : 0;   // 毒爪：對暈眩敵人
      if (vsB || vsP || vsS) dmg *= 1 + vsB + vsP + vsS;
      if (src.special.crisis && this.crisisOn()) dmg *= 1 + src.special.crisis.v;               // 學者危機意識
      if (this.party(src) && this.aura.vsStun && this.fxv(target, 'stun')) dmg *= 1 + this.aura.vsStun;   // 貓哈氣爆甲：打暈眩敵人
      // 貓肉球拍打：全隊打到暈眩敵人，出手的人回復生命（範圍攻擊同一次出手只回一次）
      if (this.party(src) && this.aura.stunHit && this.fxv(target, 'stun') && src.alive && src.st.maxHp && src.stunHitAt !== this.time.now) {
        src.stunHitAt = this.time.now;
        this.heal(src, Math.max(1, Math.round(src.st.maxHp * this.aura.stunHit)));
      }
      if (this.fxv(target, 'poison') && src.st.vsPoison) dmg *= 1 + src.st.vsPoison;            // 吸貓狂熱：對中毒敵人
      const crit = Math.random() * 100 < (this.critOf(src) + (opts.critBonus || 0)) * (this.fxv(target, 'stun') ? G.STUN.critMult : 1);   // 暈眩更容易被暴擊
      if (crit) dmg *= src.st.critDmg + (this.party(src) ? this.aura.critDmg || 0 : 0) + (opts.critDmgBonus || 0)
        + (this.party(src) && this.aura.stunCritDmg && this.fxv(target, 'stun') ? this.aura.stunCritDmg : 0);   // 筆觸節奏：對暈眩敵人暴擊傷害   // 團隊特效：暴擊傷害；狗群圍攻：技能自帶暴擊傷害
      if (crit && !opts.skill && !opts.counter && this.party(src) && this.aura.critHeal && src.alive && src.st.maxHp) this.heal(src, Math.max(1, Math.round(src.st.maxHp * this.aura.critHeal)), false);   // 獸群之心：普攻暴擊回血
      dmg *= 50 / (50 + this.defOf(target));
      dmg *= this.takenMult(target);
      dmg = Math.max(1, Math.round(dmg * G.rand(0.92, 1.08)));
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
      this.damage(target, mine, this.party(target) ? '#ff7070' : crit ? '#ffd23f' : G.DMG_TYPES[type] || '#fff', crit, opts.noFlash);

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
          this.damage(src, Math.max(1, Math.round(dmg * r * cm)), '#ff9ad5', rc, true);
        }
      }
      // 吸血
      const ls = (src.st.lifesteal || 0) + (opts.drain || 0);
      if (ls && src.alive) src.hp = Math.min(src.st.maxHp, src.hp + dmg * ls);
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
      if (u.shield > 0) { const a = Math.min(u.shield, left); u.shield -= a; left -= a; }
      u.hp -= left;
      this.floatText(u.img.x + G.rand(-10, 10), this.barY(u) - 12, (crit ? G.t('battle.crit') + ' ' : '') + (amount >= 10000 ? '**' : amount >= 1000 ? '*' : '') + G.fmt(amount), color, crit ? 18 : quiet ? 12 : 14);
      if (!quiet) this.tweens.add({ targets: u.img, alpha: 0.4, duration: 60, yoyo: true });
      if (u.hp <= 0) this.kill(u);
    }

    heal(u, amount, show = true) {
      if (!u.alive || amount <= 0) return;
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
      if (e.partyOthers) return this.partyAlive().some(p => p !== u);   // 沒有其他隊友就不放（不白扣血）
      return true;
    }

    castSkill(u, s) {
      const d = s.def, v = d.v(s.rank), e = d.fx(v, s.rank);
      if (!this.shouldCast(u, e)) return false;
      const col = e.mult ? '#ffd27a' : e.heal || e.selfHeal ? '#7dff9a' : '#9fd8ff';
      this.floatText(u.img.x, this.barY(u) - 22, G.skillName(d.id), col, 15, 900);

      const targets = e.target === 'all' ? this.enemiesAlive() : e.target === 'one' ? [this.targetFor(u)].filter(Boolean) : [];
      const hits = e.hits || 1;
      // 散步時間給的「下一次技能傷害」：這招有傷害就用掉
      const nextBonus = e.mult && targets.length ? this.fxv(u, 'nextSkill') : 0;
      if (nextBonus) delete u.fx.nextSkill;
      if (e.mult && targets.length) this.gainMorale(u);
      // 視覺：有投射物的職業射一輪，近戰撲上去
      if (targets.length) {
        if (u.st.missile) targets.forEach((t, i) => { for (let h = 0; h < Math.min(3, hits); h++) this.shoot(u, t, u.st.missile, i * 3 + h); });
        else this.lunge(u);
        targets.forEach(t => {
          const ring = this.add.circle(t.img.x, t.img.y - 30, 10, Phaser.Display.Color.HexStringToColor(col).color, 0.55).setDepth(45);
          this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        });
      }
      // 詛咒油畫：先把命中敵人身上的減益刷新回完整時間
      if (e.refreshDebuffs) targets.forEach(t => Object.values(t.fx).forEach(f => { if (f.t > 0 && f.full) f.t = Math.max(f.t, f.full); }));
      // 傷害（多段用延遲打出）
      let stunHealed = false;   // 狗群圍攻：咬到暈眩敵人回血，每次施放只回一次
      for (let h = 0; h < hits; h++) {
        const doHit = () => targets.forEach(t => {
          if (!this.valid(t)) return;
          if (e.stunHeal && !stunHealed && u.alive && this.fxv(t, 'stun')) { stunHealed = true; this.heal(u, Math.round(u.st.maxHp * e.stunHeal)); this.glow(u, '#7dff9a'); }
          this.hit(u, t, e.mult, { skill: true, critBonus: e.critBonus, vsBleed: e.vsBleed, vsPoisonSkill: e.vsPoisonSkill, vsStunSkill: e.vsStunSkill, critDmgBonus: e.critDmgBonus, drain: e.drain, noFlash: targets.length > 1, nextBonus });
          const ss = this.fxv(u, 'stunSkill');   // 乖狗狗：動物系技能命中機率暈眩
          if (ss && this.valid(t) && Math.random() < ss * this.procMult(u) * (this.fxv(t, 'stun') ? G.STUN.procMult : 1)) this.debuff(u, t, 'stun', 1, 1.5);
        });
        if (h === 0) doHit(); else this.time.delayedCall(h * 130, () => { if (u.alive) { doHit(); this.checkWaveEnd(); } });
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
      if (e.healOthers) this.partyAlive().filter(p => p !== u && p.kind !== 'summon').forEach(p => { this.heal(p, Math.round(p.st.maxHp * e.healOthers)); this.glow(p, '#7dff9a'); });   // 煙霧彈：其他隊友回血
      if (e.selfHeal) { this.heal(u, Math.round(u.st.maxHp * e.selfHeal)); this.glow(u, col); }
      // 護盾：美甲師「指尖藝術」加厚；不會蓋掉比較厚的舊盾
      if (e.shield) this.partyAlive().forEach(p => { p.shield = Math.max(p.shield || 0, Math.round(p.st.maxHp * e.shield * (u.st.shieldPow || 1))); p.shieldT = 8; this.glow(p, col); });
      if (e.partyType) this.partyAlive().filter(p => p.st.dmgType === e.partyType.type).forEach(p => e.partyType.fx.forEach(b => { this.addFx(p, b.id, bv(b), bt(b)); this.glow(p, col); }));   // 只給某系別的隊友
      if (e.synBoost) { this.synBoost = { v: Math.max(e.synBoost.v, this.synBoost && this.synBoost.t > 0 ? this.synBoost.v : 0), t: e.synBoost.t }; this.computeAura(); }   // 喵喵鼓舞：團隊特效暫時加強
      if (e.taunt) { u.taunt = { v: e.taunt.v, t: e.taunt.t }; this.glow(u, '#ffd23f'); }
      if (e.summon) this.summonAnimal(u, e.summon, e.aura);
      // 速寫：船砲強化一段時間；全隊身上的增益延長
      if (e.sketch) { this.sketch = { t: e.sketch.t, chance: Math.max(e.sketch.chance, this.sketch && this.sketch.t > 0 ? this.sketch.chance : 0) }; this.cannonT = Math.min(this.cannonT, G.cannonInterval(this.aura) / 2); }
      if (e.buffExtend) this.partyAlive().forEach(p => BUFF_IDS.forEach(id => { const f = p.fx[id]; if (f && f.t > 0) f.t += e.buffExtend; }));
      if (e.cdCut) this.partyAlive().forEach(p => p.skills.forEach(x => { if (x !== s) x.cd = Math.max(0, x.cd - e.cdCut); }));
      return true;
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
      } else {
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
        this.ground.tilePositionX += speed * dt;
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
      this.drawBars();
    }

    // 回血（健身者「恢復日」、德魯伊鹿/自然之靈、regen buff）：每秒結算一次
    regenTick(dt) {
      this.units.forEach(u => {
        if (!u.alive) return;
        u.regenAcc = (u.regenAcc || 0) + dt;
        if (u.regenAcc < 1) return;
        u.regenAcc -= 1;
        const r = (u.st.regen || 0) + (this.aura.regen || 0) + this.fxv(u, 'regen');
        if (r > 0 && u.hp < u.st.maxHp) this.heal(u, Math.max(1, Math.round(u.st.maxHp * r)), false);
      });
    }

    fightTick(dt) {
      if (this.synBoost && this.synBoost.t > 0) { this.synBoost.t -= dt; if (this.synBoost.t <= 0) this.computeAura(); }   // 喵喵鼓舞到期，團隊特效恢復
      const all = [...this.units, ...this.enemies];
      this.units.forEach(u => this.syncHpBoost(u));   // 野性狂暴到期：最大生命恢復
      all.forEach(u => {
        if (!u.alive) return;
        // 狀態倒數
        Object.values(u.fx).forEach(f => { if (f.t > 0) f.t -= dt; });
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
            if (this.castSkill(u, s)) { s.cd = s.def.cd * (1 - Math.min(G.CONFIG.cdrCap, (this.aura.cdr || 0) + (u.st.cdr || 0))); break; }
            s.cd = 0.5;   // 條件不符（沒人受傷等），晚點再試
          }
        }
        if (!u.alive || this.mode !== 'fight') return;
        u.atkCd -= dt;
        if (u.atkCd <= 0) { u.atkCd = 1 / this.spdOf(u); this.basicAttack(u); }
      });
      this.regenTick(dt);

      // 船砲支援
      if (this.mode === 'fight' && G.cannonMult() > 0 && this.enemiesAlive().length) {
        this.cannonT -= dt;
        if (this.cannonT <= 0) {
          const sk = this.sketch && this.sketch.t > 0 ? this.sketch : null;
          this.cannonT = G.cannonInterval(this.aura) / (sk ? 2 : 1);   // 團隊特效、貓哈氣爆甲可縮短；速寫期間減半
          const t = this.enemiesAlive()[0];
          const src = { kind: 'cannon', side: 'cannon', st: { atk: this.hero.st.atk, crit: 0, critDmg: 1 }, fx: {}, special: {}, alive: false };
          const ball = this.add.circle(this.shipImg.x - 20, this.shipImg.y + 30, 5, 0x222222).setDepth(40);
          this.tweens.add({ targets: ball, x: t.img.x, y: t.img.y - 30, duration: 380, ease: 'Quad.in', onComplete: () => {
            ball.destroy();
            if (this.valid(t)) {
              const cvd = this.aura.cannonVsDefDown && this.fxv(t, 'defDown') ? 1 + this.aura.cannonVsDefDown : 1;   // 腐蝕顏料：砲擊打破防中的敵人
              this.hit(src, t, G.cannonMult() * cvd); this.floatText(t.img.x, this.barY(t) - 24, G.t('battle.cannon'), '#ffb36b', 13);
              if (sk && Math.random() < sk.chance) this.enemiesAlive().forEach(x => this.debuff(src, x, 'stun', 1, 1.5));   // 速寫：砲擊暈眩全體
              this.checkWaveEnd();
            }
          } });
        }
      }
      this.checkWaveEnd();
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
      if (this.curse) out.push({ id: 'curse', icon: '🌪️', val: G.curseShort(this.curse), p: { text: G.curseText(this.curse), n: G.S.floor } });
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
      if (this.synBoost && this.synBoost.t > 0) out.push({ id: 'synBoost', icon: G.FX_ICON.synBoost, val: `${Math.ceil(this.synBoost.t)}s`, p: { v: pct(this.synBoost.v), s: Math.ceil(this.synBoost.t) } });
      if (this.sketch && this.sketch.t > 0) out.push({ id: 'sketch', icon: G.FX_ICON.sketch, val: `${Math.ceil(this.sketch.t)}s`, p: { v: pct(this.sketch.chance), s: Math.ceil(this.sketch.t) } });
      // 貓哈氣爆甲的全隊效果
      if (this.aura.vsStun || this.aura.cannonCut) out.push({ id: 'hiss', icon: G.FX_ICON.hiss, val: `+${pct(this.aura.vsStun || 0)}%`, p: { v: pct(this.aura.vsStun || 0), cut: this.aura.cannonCut || 0 } });
      const sh = party.reduce((a, u) => a + (u.shield || 0), 0);
      if (sh > 0) out.push({ id: 'shield', icon: G.FX_ICON.shield, val: G.fmt(sh), p: { v: G.fmt(sh) } });
      const taunter = party.find(u => u.taunt.t > 0);
      if (taunter) out.push({ id: 'taunt', icon: G.FX_ICON.taunt, val: `${Math.ceil(taunter.taunt.t)}s`, p: { name: G.whoName(taunter.key) } });
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
        const t = u.fx[id].t;
        return G.FX_ICON[id] + (t < 3 ? t.toFixed(1) : Math.ceil(t));   // 快結束時顯示到小數一位
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
      width: W, height: H,
      backgroundColor: '#9fd8ff',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true },
      scene: [BattleScene],
    });
  };
  G.battleScene = () => G.game && G.game.scene.getScene('battle');
})();
