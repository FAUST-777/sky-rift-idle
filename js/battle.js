// ════════════════════════════════════════════════════════════════════════════
// 戰鬥場景（Phaser）：自動前進 → 遇怪 → 自動戰鬥 → 結算 → 繼續前進
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const W = 480, H = 300, GROUND = 238;
  const PARTY_X = [178, 132, 86, 40];
  const ENEMY_X = [305, 355, 405];

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
    }

    create() {
      this.texVer = 0;
      this.units = [];
      this.enemies = [];
      this.mode = 'walk';
      this.walkT = 1;
      this.cannonT = 6;
      this.needRebuild = false;
      this.frenzyMem = {};   // 吸貓狂熱層數（重建隊伍時保留，倒下才歸零）

      // 小貓貼圖
      G.ART.KITTEN_COLORS.forEach((c, i) => this.tex('kitten' + i, 28, 22, ctx => G.ART.drawKitten(ctx, c)));

      // 背景
      this.sky = this.add.graphics();
      ['clouds', 'clouds2'].forEach((k, i) => this.tex(k, 256, 128, (ctx, w, h) => G.ART.drawClouds(ctx, w, h, i ? 0.85 : 0.45)));
      this.islandsLayer = null;
      // 飛行船放右上（左上角留給 buff 圖示）
      this.shipImg = this.add.image(405, 58, '__DEFAULT').setScale(0.5);
      this.cloudFar = this.add.tileSprite(0, 20, W, 128, 'clouds').setOrigin(0);
      this.cloudNear = this.add.tileSprite(0, 120, W, 128, 'clouds2').setOrigin(0).setAlpha(0.7);
      this.ground = this.add.tileSprite(0, GROUND - 6, W, H - GROUND + 6, '__DEFAULT').setOrigin(0);
      this.drawShip();
      this.applyFloorTheme();

      this.bars = this.add.graphics().setDepth(50);
      this.fx = this.add.layer().setDepth(60);

      this.tweens.add({ targets: this.shipImg, y: 66, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      this.buildParty();

      G.on('look',   () => this.refreshHero(true));
      G.on('inventory', () => this.refreshHero(false));
      G.on('skills', () => this.refreshHero(false));
      G.on('stats',  () => this.refreshHero(false));
      G.on('party',  () => { this.needRebuild = true; });
      G.on('ship',   () => this.drawShip());
      G.on('floor',  () => this.restartFloor());
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
      this.sky.setDepth(-2);
      this.shipImg.setDepth(-1);
    }

    drawShip() {
      const key = 'ship_' + (++this.texVer);
      this.tex(key, 240, 180, (ctx, w, h) => G.ART.drawShip(ctx, G.S.ship, w, h));
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
        alive: true, shield: 0, shieldT: 0, atkCd: G.rand(0.2, 0.8),
        buffs: { atk: { v: 0, t: 0 } }, taunt: { v: 0, t: 0 }, defBreak: { v: 0, t: 0 }, frenzy: 0,
        skills: [], img, homeX: o.x,
      }, o);
      u.hp = u.st.maxHp;
      return u;
    }

    heroSkills() {
      return G.S.activeSkills.filter(Boolean).map(id => {
        const def = (G.SKILLS[G.S.hero.cls] || []).find(s => s.id === id);
        return def && G.S.skills[id] > 0 ? { def, rank: G.S.skills[id], cd: def.cd * 0.5 } : null;
      }).filter(Boolean);
    }

    buildParty() {
      this.units.forEach(u => u.img.destroy());
      this.units = [];
      const hero = this.makeUnit({
        side: 'party', kind: 'hero', key: 'hero', st: G.heroStats(),
        texture: this.humanTex('hero', G.ART.lookFromHero()), x: 0,
      });
      hero.skills = this.heroSkills();
      hero.frenzy = this.frenzyMem.hero || 0;
      this.hero = hero;
      const members = [hero];
      G.S.party.forEach(id => {
        if (!G.S.partners[id]) return;
        const u = this.makeUnit({
          side: 'party', kind: 'partner', key: id, partnerId: id, st: G.partnerStats(id),
          texture: this.humanTex('p_' + id, G.ART.lookFromPartner(id)), x: 0, scale: 1.0,
        });
        u.frenzy = this.frenzyMem[id] || 0;
        const sk = G.partnerSkill(id);
        if (sk) u.skills = [{ def: sk.def, rank: sk.rank, cd: sk.def.cd * 0.7 }];
        members.push(u);
      });
      // 近戰站前排、遠程站後排
      members.sort((a, b) => (a.st.ranged ? 1 : 0) - (b.st.ranged ? 1 : 0));
      members.forEach((u, i) => { u.homeX = PARTY_X[i]; u.img.x = u.homeX; });
      this.units = members;
      this.needRebuild = false;
    }

    refreshHero(look) {
      const h = this.hero;
      if (!h) return;
      const ratio = h.hp / h.st.maxHp;
      h.st = G.heroStats();
      h.hp = Math.max(1, Math.round(h.st.maxHp * ratio));
      if (!h.alive) h.hp = 0;
      h.skills = this.heroSkills();
      if (look) {
        const old = h.img.texture.key;
        h.img.setTexture(this.humanTex('hero', G.ART.lookFromHero()));
        this.textures.remove(old);
        this.needRebuild = true;  // 職業改變時前後排可能要重排
      }
    }

    // ── 波次 ─────────────────────────────────────────────────────────────
    spawnWave() {
      const f = G.S.floor;
      const boss = G.S.kills >= G.CONFIG.killsPerFloor;
      const pool = G.monsterTier(f);
      const count = boss ? 1 : G.randInt(1, Math.min(3, 1 + Math.floor((f + 1) / 3)));
      this.isBossWave = boss;
      this.enemies = [];
      for (let i = 0; i < count; i++) {
        const m = boss ? pool[(f - 1) % pool.length] : G.pick(pool);
        const u = this.makeUnit({
          side: 'enemy', kind: 'monster', boss, monsterId: m.id, shape: m.shape, color: m.color,
          st: G.monsterStats(f, boss), texture: this.monsterTex(m.shape, m.color),
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
      this.enemies.forEach(e => e.img.destroy());
      this.enemies = [];
      this.applyFloorTheme();
      this.buildParty();
      this.mode = 'walk';
      this.walkT = 0.8;
    }

    // ── 目標選擇 ─────────────────────────────────────────────────────────
    partyAlive() { return this.units.filter(u => u.alive); }
    enemiesAlive() { return this.enemies.filter(u => u.alive); }

    targetFor(u) {
      if (u.side === 'party') return this.enemiesAlive()[0];
      const alive = this.partyAlive();
      return alive.find(p => p.taunt.t > 0) || alive.find(p => p.kind === 'summon') || alive.find(p => !p.st.ranged) || alive[0];
    }

    // ── 傷害 ─────────────────────────────────────────────────────────────
    // 士氣：貓鎧者在場時，全隊最終防禦 +morale%
    moraleMult() { return G.catKnightInParty() ? 1 + G.S.morale / 100 : 1; }
    frenzyOn() { return G.catKnightInParty(); }

    hit(src, target, mult, opts = {}) {
      if (!target || !target.alive) return;
      let dmg = src.st.atk * (1 + src.buffs.atk.v) * mult;
      // 吸貓狂熱：攻擊者自身累積的傷害加成
      if (src.side === 'party' && src.frenzy && this.frenzyOn()) dmg *= 1 + src.frenzy / 100;
      const crit = Math.random() * 100 < src.st.crit;
      if (crit) dmg *= src.st.critDmg;
      // 最終防禦：敵人吃破甲；我方吃士氣
      let def = target.st.def;
      if (target.defBreak.t > 0) def *= 1 - target.defBreak.v;
      if (target.side === 'party') def *= this.moraleMult();
      dmg *= 50 / (50 + def);
      if (target.taunt.t > 0) dmg *= 1 - target.taunt.v;
      dmg = Math.max(1, Math.round(dmg * G.rand(0.92, 1.08)));

      // 隊員打中敵人 → 吸貓狂熱 +1%（召喚物、船砲不算）
      if (target.side === 'enemy' && (src.kind === 'hero' || src.kind === 'partner') && this.frenzyOn() && src.frenzy < G.CONFIG.frenzyMax) {
        src.frenzy = Math.min(G.CONFIG.frenzyMax, src.frenzy + G.CONFIG.frenzyPerHit);
        this.frenzyMem[src.key] = src.frenzy;
      }

      let left = dmg;
      if (target.shield > 0) {
        const absorbed = Math.min(target.shield, left);
        target.shield -= absorbed; left -= absorbed;
      }
      target.hp -= left;
      if (src.st.lifesteal && src.alive) src.hp = Math.min(src.st.maxHp, src.hp + dmg * src.st.lifesteal);

      const color = target.side === 'enemy' ? (crit ? '#ffd23f' : '#ffffff') : '#ff7070';
      this.floatText(target.img.x + G.rand(-10, 10), target.img.y - target.img.displayHeight * 0.9, (crit ? G.t('battle.crit') + ' ' : '') + G.fmt(dmg), color, crit ? 18 : 14);
      if (!opts.noFlash) this.tweens.add({ targets: target.img, alpha: 0.4, duration: 60, yoyo: true });

      if (target.hp <= 0) this.kill(target);
    }

    attackAnim(u, target, color) {
      if (!target) return;
      if (u.st.ranged || u.kind === 'cannon') {
        const ball = this.add.circle(u.img.x + 10, u.img.y - 40, 4, Phaser.Display.Color.HexStringToColor(color || '#ffe9a8').color).setDepth(40);
        this.tweens.add({ targets: ball, x: target.img.x, y: target.img.y - 30, duration: 220, onComplete: () => ball.destroy() });
      } else {
        const dir = u.side === 'party' ? 1 : -1;
        this.tweens.add({ targets: u.img, x: u.homeX + 16 * dir, duration: 90, yoyo: true, ease: 'Quad.out' });
      }
    }

    basicAttack(u) {
      const t = this.targetFor(u);
      if (!t) return;
      if (u.st.missile === 'cat') {
        // 貓鎧者：鎧甲開口射出小貓，飛過去抓傷 → 命中時傷害＋破甲
        this.launchKittens(u, [t], 2, () => {
          if (!this.enemies.includes(t) || !u.alive) return;   // 小貓飛行途中換層/戰敗就作廢
          this.hit(u, t, 1);
          this.breakArmor(t, u.st.armorBreak, G.CONFIG.catBreakDur);
          this.checkWaveEnd();
        });
        return;
      }
      this.attackAnim(u, t, u.kind === 'summon' ? '#5bf0a0' : null);
      this.hit(u, t, 1);
    }

    // 從單位的胸口艙門射出 n 隻小貓，畫弧線飛向目標；第一隻抵達時呼叫 onHit
    launchKittens(u, targets, n, onHit) {
      this.glow(u, '#ffe066');
      let hitDone = false;
      for (let i = 0; i < n; i++) {
        const target = targets[i % targets.length];
        if (!target) continue;
        const k = this.add.image(u.img.x + 6, u.img.y - 42 + i * 8, 'kitten' + G.randInt(0, G.ART.KITTEN_COLORS.length - 1)).setDepth(40).setScale(0.9);
        const tx = target.img.x - 8, ty = target.img.y - 34 + G.rand(-8, 8);
        const peak = Math.min(u.img.y, ty) - 40 - i * 10;
        const startX = k.x, startY = k.y;
        this.tweens.addCounter({
          from: 0, to: 1, duration: 320 + i * 60, ease: 'Sine.in',
          onUpdate: tw => {
            const p = tw.getValue();
            k.x = startX + (tx - startX) * p;
            k.y = (1 - p) * (1 - p) * startY + 2 * (1 - p) * p * peak + p * p * ty;   // 二次貝茲弧線
            k.rotation = (p - 0.5) * 0.8;
          },
          onComplete: () => {
            this.scratch(tx, ty);
            k.destroy();
            if (!hitDone && onHit) { hitDone = true; onHit(target); }
          },
        });
      }
    }

    // 抓痕特效
    scratch(x, y) {
      const g = this.add.graphics().setDepth(46);
      g.lineStyle(2, 0xffffff, 1);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 8 + i * 6, y - 9); g.lineTo(x - 2 + i * 6, y + 9); g.strokePath(); }
      this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    }

    // 破甲：取較強、較久的那個
    breakArmor(t, v, dur) {
      if (!t || !t.alive || !v) return;
      if (v >= t.defBreak.v || t.defBreak.t <= 0) t.defBreak = { v, t: dur };
      else t.defBreak.t = Math.max(t.defBreak.t, dur);
    }

    castSkill(u, s) {
      const d = s.def, v = d.v(s.rank);
      const col = { strike: '#ffd27a', aoe: '#ff8a5c', aoeBreak: '#ffb347', buffAtk: '#ff5c8a', healParty: '#7dff9a', shieldParty: '#9fd8ff', summon: '#5bf0a0', taunt: '#ffd23f' }[d.kind];
      this.floatText(u.img.x, u.img.y - u.img.displayHeight - 14, G.skillName(d.id), col, 15, 900);
      // 貓鎧者的範圍技：每個敵人都飛一隻小貓過去
      if ((d.kind === 'aoe' || d.kind === 'aoeBreak') && u.st.missile === 'cat') {
        const es = this.enemiesAlive();
        this.launchKittens(u, es, Math.max(3, es.length * 2));
      }
      const party = this.partyAlive();
      switch (d.kind) {
        case 'strike': { const t = this.targetFor(u); this.attackAnim(u, t, col); this.hit(u, t, v); break; }
        case 'aoe':
          this.enemiesAlive().forEach(e => {
            const ring = this.add.circle(e.img.x, e.img.y - 30, 10, Phaser.Display.Color.HexStringToColor(col).color, 0.6).setDepth(45);
            this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
            this.hit(u, e, v, { noFlash: true });
          });
          break;
        case 'aoeBreak':
          this.enemiesAlive().forEach(e => {
            const ring = this.add.circle(e.img.x, e.img.y - 30, 10, Phaser.Display.Color.HexStringToColor(col).color, 0.6).setDepth(45);
            this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
            this.breakArmor(e, d.breakV, d.dur);
            this.hit(u, e, v, { noFlash: true });
          });
          break;
        case 'buffAtk':
          (d.party ? party : [u]).forEach(p => { p.buffs.atk = { v, t: d.dur }; this.glow(p, col); });
          break;
        case 'healParty':
          party.forEach(p => {
            const amt = Math.round(p.st.maxHp * v * (u.st.healPower || 1));
            p.hp = Math.min(p.st.maxHp, p.hp + amt);
            this.floatText(p.img.x, p.img.y - p.img.displayHeight * 0.9, '+' + G.fmt(amt), '#7dff9a', 14);
            this.glow(p, col);
          });
          break;
        case 'shieldParty':
          party.forEach(p => { p.shield = Math.round(p.st.maxHp * v * (u.st.healPower || 1)); p.shieldT = d.dur; this.glow(p, col); });
          break;
        case 'summon': this.summon(u, v, d.dur); break;
        case 'taunt': u.taunt = { v, t: d.dur }; this.glow(u, col); break;
      }
    }

    summon(owner, v, dur) {
      this.units.filter(x => x.kind === 'summon').forEach(x => { x.alive = false; x.img.destroy(); });
      this.units = this.units.filter(x => x.kind !== 'summon');
      const st = { maxHp: Math.round(owner.st.maxHp * 0.5), atk: owner.st.atk * v * (owner.st.summonPower || 1), def: owner.st.def * 0.5, spd: 1.1, crit: 5, critDmg: 1.5, ranged: false };
      const sk = this.makeUnit({ side: 'party', kind: 'summon', st, x: 222, texture: this.monsterTex('skeleton', '#e8e4d8'), originY: 0.94, scale: 0.95 });
      sk.life = dur;
      sk.img.setAlpha(0);
      this.tweens.add({ targets: sk.img, alpha: 1, duration: 300 });
      this.units.push(sk);
    }

    glow(u, color) {
      const c = this.add.circle(u.img.x, u.img.y - 30, 26, Phaser.Display.Color.HexStringToColor(color).color, 0.35).setDepth(9);
      this.tweens.add({ targets: c, scale: 1.6, alpha: 0, duration: 500, onComplete: () => c.destroy() });
    }

    kill(u) {
      u.alive = false;
      u.hp = 0;
      // 倒下 → 吸貓狂熱歸零
      if (u.key) { u.frenzy = 0; this.frenzyMem[u.key] = 0; }
      if (u.side === 'enemy') {
        this.tweens.add({ targets: u.img, alpha: 0, y: u.img.y + 10, duration: 350, onComplete: () => u.img.setVisible(false) });
        this.reward(u);
      } else if (u.kind === 'hero') {
        this.defeat();
      } else if (u.kind === 'summon') {
        this.tweens.add({ targets: u.img, alpha: 0, duration: 300, onComplete: () => u.img.destroy() });
        this.units = this.units.filter(x => x !== u);
      } else {
        u.img.setAlpha(0.3).setTint(0x777777);
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
      const petCap = 4 + S.ship.hull * 2;
      if (!u.boss && S.nets > 0 && S.pets.length < petCap && Math.random() < G.CONFIG.captureChance) {
        S.nets--;
        S.pets.push({ id: u.monsterId, shape: u.shape, color: u.color });
        G.addLog('log.capture', { name: { k: `monster.${u.monsterId}` } }, '#ffb3f0');
        G.emit('home');
      }
      if (!u.boss) S.kills++;
      else this.bossCleared();
    }

    bossCleared() {
      const S = G.S, f = S.floor;
      S.kills = 0;
      // 士氣：貓鎧者在場、這層沒戰敗 → +1%
      if (G.catKnightInParty() && S.morale < G.CONFIG.moraleMax) {
        S.morale = Math.min(G.CONFIG.moraleMax, S.morale + G.CONFIG.moralePerFloor);
        this.floatText(W / 2, 108, G.t('battle.morale', { n: S.morale }), '#9fd8ff', 17, 1500);
      }
      if (f + 1 > S.maxFloor) {
        S.maxFloor = f + 1;
        G.addLog('log.bossDown', { f, n: f + 1 }, '#ffd76a');
        const unlocked = G.PARTNERS.find(p => p.floor === f + 1 || p.floor === f);
        if (unlocked && !S.partners[unlocked.id] && S.maxFloor >= unlocked.floor) G.addLog('log.partnerAvail', { name: { k: `partner.${unlocked.id}.name` } }, '#7fd1ff');
      }
      const cap = G.shipMaxFloor(S.ship.balloon);
      if (S.autoAdvance) {
        if (f + 1 <= cap) {
          S.floor = f + 1;
          this.time.delayedCall(900, () => this.applyFloorTheme());
          this.floatText(W / 2, 80, G.t('battle.toFloor', { n: S.floor }), '#ffffff', 22, 1500);
        } else if (!this.capWarned) {
          this.capWarned = true;
          G.addLog('log.capReached', { n: cap }, '#ffb36b');
          G.emit('toast', G.t('toast.capReached', { n: cap }));
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
      // 戰後休整：回 25% 血，倒下的夥伴復活
      this.units.forEach(u => {
        if (u.kind === 'summon') return;
        if (!u.alive) { u.alive = true; u.hp = u.st.maxHp * 0.3; u.img.setAlpha(1).clearTint(); }
        u.hp = Math.min(u.st.maxHp, u.hp + u.st.maxHp * 0.25);
      });
      this.enemies.forEach(e => e.img.destroy());
      this.enemies = [];
      if (this.needRebuild) {
        const ratio = this.hero.hp / this.hero.st.maxHp;
        this.buildParty();
        this.hero.hp = this.hero.st.maxHp * ratio;
      }
      this.mode = 'walk';
      this.walkT = 1.2 / (1 + (G.S.ship.engine - 1) * 0.08);
    }

    // ── 文字特效 ─────────────────────────────────────────────────────────
    floatText(x, y, text, color, size = 14, dur = 700) {
      const t = this.add.text(x, y, text, {
        fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif', fontSize: size + 'px', fontStyle: 'bold',
        color, stroke: '#1a1428', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(70);
      this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: dur, ease: 'Quad.out', onComplete: () => t.destroy() });
    }

    // ── 每幀更新 ─────────────────────────────────────────────────────────
    update(_, dtMs) {
      const dt = Math.min(0.1, dtMs / 1000);
      const walking = this.mode === 'walk' || this.mode === 'enter';
      const speed = 70 * (1 + (G.S.ship.engine - 1) * 0.08);
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

    fightTick(dt) {
      const all = [...this.units, ...this.enemies];
      all.forEach(u => {
        if (!u.alive) return;
        if (u.buffs.atk.t > 0 && (u.buffs.atk.t -= dt) <= 0) u.buffs.atk.v = 0;
        if (u.taunt.t > 0) u.taunt.t -= dt;
        if (u.defBreak.t > 0 && (u.defBreak.t -= dt) <= 0) u.defBreak.v = 0;
        if (u.shieldT > 0 && (u.shieldT -= dt) <= 0) u.shield = 0;
        if (u.kind === 'summon' && (u.life -= dt) <= 0) { this.kill(u); return; }

        if (this.mode !== 'fight') return;
        for (const s of u.skills) {
          s.cd -= dt;
          if (s.cd <= 0 && this.enemiesAlive().length) { s.cd = s.def.cd; this.castSkill(u, s); break; }
        }
        if (!u.alive || this.mode !== 'fight') return;
        u.atkCd -= dt;
        if (u.atkCd <= 0) { u.atkCd = 1 / u.st.spd; this.basicAttack(u); }
      });

      // 船砲支援
      if (this.mode === 'fight' && G.S.ship.cannon > 0 && this.enemiesAlive().length) {
        this.cannonT -= dt;
        if (this.cannonT <= 0) {
          this.cannonT = 6;
          const t = this.enemiesAlive()[0];
          const src = { st: { atk: this.hero.st.atk, crit: 0, critDmg: 1, lifesteal: 0 }, buffs: { atk: { v: 0 } }, alive: false };
          const ball = this.add.circle(this.shipImg.x + 20, this.shipImg.y + 30, 5, 0x222222).setDepth(40);
          this.tweens.add({ targets: ball, x: t.img.x, y: t.img.y - 30, duration: 380, ease: 'Quad.in', onComplete: () => {
            ball.destroy();
            if (t.alive) { this.hit(src, t, 0.3 * G.S.ship.cannon); this.floatText(t.img.x, t.img.y - 70, G.t('battle.cannon'), '#ffb36b', 13); this.checkWaveEnd(); }
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
      const out = [], S = G.S, h = this.hero;
      if (!h) return out;
      const cat = G.catKnightInParty();
      if (cat && S.morale > 0) out.push({ id: 'morale', icon: '🎖️', val: `+${S.morale}%`, p: { n: S.morale, max: G.CONFIG.moraleMax } });
      if (cat) {
        const members = this.units.filter(u => u.key);
        const top = Math.max(0, ...members.map(u => u.frenzy || 0));
        if (top > 0) {
          const list = members.map(u => `${u.kind === 'hero' ? G.t('hero.who.hero') : G.partnerName(u.partnerId)} +${u.frenzy}%`).join('、');
          out.push({ id: 'frenzy', icon: '🐾', val: `+${top}%`, p: { max: G.CONFIG.frenzyMax, list } });
        }
      }
      if (h.buffs.atk.t > 0) out.push({ id: 'atk', icon: '⚔️', val: `${Math.ceil(h.buffs.atk.t)}s`, p: { v: Math.round(h.buffs.atk.v * 100), s: Math.ceil(h.buffs.atk.t) } });
      if (h.shield > 0) out.push({ id: 'shield', icon: '🔰', val: G.fmt(h.shield), p: { v: G.fmt(h.shield) } });
      const taunter = this.units.find(u => u.alive && u.taunt.t > 0);
      if (taunter) out.push({ id: 'taunt', icon: '😤', val: `${Math.ceil(taunter.taunt.t)}s`, p: { name: taunter.kind === 'hero' ? G.t('hero.who.hero') : G.partnerName(taunter.partnerId) } });
      const broken = this.enemies.filter(e => e.alive && e.defBreak.t > 0);
      if (broken.length) {
        const v = Math.round(Math.max(...broken.map(e => e.defBreak.v)) * 100);
        out.push({ id: 'break', icon: '💔', val: `-${v}%`, p: { v } });
      }
      return out;
    }

    drawBars() {
      const g = this.bars;
      g.clear();
      [...this.units, ...this.enemies].forEach(u => {
        if (!u.alive || !u.img.visible) return;
        const w = u.boss ? 70 : 38, x = u.img.x - w / 2, y = u.img.y - u.img.displayHeight * 0.95 - 8;
        g.fillStyle(0x000000, 0.55).fillRect(x - 1, y - 1, w + 2, 6);
        const p = Math.max(0, u.hp / u.st.maxHp);
        g.fillStyle(u.side === 'party' ? (u.kind === 'summon' ? 0x5bf0a0 : 0x56d364) : 0xe5534b, 1).fillRect(x, y, w * p, 4);
        if (u.shield > 0) g.fillStyle(0x9fd8ff, 0.9).fillRect(x, y - 3, w * Math.min(1, u.shield / u.st.maxHp), 2);
        if (u.taunt.t > 0) g.lineStyle(1, 0xffd23f, 1).strokeRect(x - 1, y - 1, w + 2, 6);
        if (u.defBreak.t > 0) g.fillStyle(0xffb347, 1).fillRect(x, y + 5, w * Math.min(1, u.defBreak.t / G.CONFIG.catBreakDur), 2);  // 破甲剩餘時間
      });
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
