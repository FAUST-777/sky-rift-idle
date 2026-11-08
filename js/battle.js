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

      // 背景
      this.sky = this.add.graphics();
      ['clouds', 'clouds2'].forEach((k, i) => this.tex(k, 256, 128, (ctx, w, h) => G.ART.drawClouds(ctx, w, h, i ? 0.85 : 0.45)));
      this.islandsLayer = null;
      this.shipImg = this.add.image(78, 62, '__DEFAULT').setScale(0.5);
      this.cloudFar = this.add.tileSprite(0, 20, W, 128, 'clouds').setOrigin(0);
      this.cloudNear = this.add.tileSprite(0, 120, W, 128, 'clouds2').setOrigin(0).setAlpha(0.7);
      this.ground = this.add.tileSprite(0, GROUND - 6, W, H - GROUND + 6, '__DEFAULT').setOrigin(0);
      this.drawShip();
      this.applyFloorTheme();

      this.bars = this.add.graphics().setDepth(50);
      this.fx = this.add.layer().setDepth(60);

      this.tweens.add({ targets: this.shipImg, y: 70, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

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
        buffs: { atk: { v: 0, t: 0 } }, taunt: { v: 0, t: 0 }, skills: [], img, homeX: o.x,
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
        side: 'party', kind: 'hero', name: '你', st: G.heroStats(),
        texture: this.humanTex('hero', G.ART.lookFromHero()), x: 0,
      });
      hero.skills = this.heroSkills();
      this.hero = hero;
      const members = [hero];
      G.S.party.forEach(id => {
        if (!G.S.partners[id]) return;
        const def = G.PARTNERS.find(p => p.id === id);
        const u = this.makeUnit({
          side: 'party', kind: 'partner', name: def.name, partnerId: id, st: G.partnerStats(id),
          texture: this.humanTex('p_' + id, G.ART.lookFromPartner(id)), x: 0, scale: 1.0,
        });
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
          side: 'enemy', kind: 'monster', boss, name: boss ? `層主・${m.n}` : m.n, shape: m.shape, color: m.color,
          st: G.monsterStats(f, boss), texture: this.monsterTex(m.shape, m.color),
          x: ENEMY_X[boss ? 1 : i], scale: boss ? 1.75 : 1.1, originY: 0.94,
        });
        u.img.x = W + 40 + i * 50;
        this.tweens.add({ targets: u.img, x: u.homeX, duration: 700, ease: 'Quad.out' });
        this.enemies.push(u);
      }
      if (boss) this.floatText(W / 2, 70, `⚠ 第 ${f} 層 層主出現`, '#ff6b6b', 22, 1400);
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
    hit(src, target, mult, opts = {}) {
      if (!target || !target.alive) return;
      let dmg = src.st.atk * (1 + src.buffs.atk.v) * mult;
      const crit = Math.random() * 100 < src.st.crit;
      if (crit) dmg *= src.st.critDmg;
      dmg *= 50 / (50 + target.st.def);
      if (target.taunt.t > 0) dmg *= 1 - target.taunt.v;
      dmg = Math.max(1, Math.round(dmg * G.rand(0.92, 1.08)));

      let left = dmg;
      if (target.shield > 0) {
        const absorbed = Math.min(target.shield, left);
        target.shield -= absorbed; left -= absorbed;
      }
      target.hp -= left;
      if (src.st.lifesteal && src.alive) src.hp = Math.min(src.st.maxHp, src.hp + dmg * src.st.lifesteal);

      const color = target.side === 'enemy' ? (crit ? '#ffd23f' : '#ffffff') : '#ff7070';
      this.floatText(target.img.x + G.rand(-10, 10), target.img.y - target.img.displayHeight * 0.9, (crit ? '暴擊 ' : '') + G.fmt(dmg), color, crit ? 18 : 14);
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
      this.attackAnim(u, t, u.kind === 'summon' ? '#5bf0a0' : null);
      this.hit(u, t, 1);
    }

    castSkill(u, s) {
      const d = s.def, v = d.v(s.rank);
      const col = { strike: '#ffd27a', aoe: '#ff8a5c', buffAtk: '#ff5c8a', healParty: '#7dff9a', shieldParty: '#9fd8ff', summon: '#5bf0a0', taunt: '#ffd23f' }[d.kind];
      this.floatText(u.img.x, u.img.y - u.img.displayHeight - 14, d.name, col, 15, 900);
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
      const sk = this.makeUnit({ side: 'party', kind: 'summon', name: '骷髏', st, x: 222, texture: this.monsterTex('skeleton', '#e8e4d8'), originY: 0.94, scale: 0.95 });
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
        if (it.rarity >= 2 && res === 'ok') G.addLog(`🎁 掉落 ${G.RARITY[it.rarity].name}「${it.name}」`, G.RARITY[it.rarity].color);
        if (res === 'full') G.addLog('🎒 背包滿了，裝備自動賣掉', '#aaa');
      }
      // 雲晶
      const crystal = u.boss ? 1 + Math.floor(f / 5) : Math.random() < 0.04 ? 1 : 0;
      if (crystal) { S.crystal += crystal; this.floatText(u.img.x, u.img.y - 30, `+${crystal}💎`, '#9fe8ff', 13, 900); }
      // 捕獲
      const petCap = 4 + S.ship.hull * 2;
      if (!u.boss && S.nets > 0 && S.pets.length < petCap && Math.random() < G.CONFIG.captureChance) {
        S.nets--;
        S.pets.push({ name: u.name, shape: u.shape, color: u.color });
        G.addLog(`🕸️ 捕獲了「${u.name}」！牠住進了飛行船`, '#ffb3f0');
        G.emit('home');
      }
      if (!u.boss) S.kills++;
      else this.bossCleared();
    }

    bossCleared() {
      const S = G.S, f = S.floor;
      S.kills = 0;
      if (f + 1 > S.maxFloor) {
        S.maxFloor = f + 1;
        G.addLog(`🏆 擊敗第 ${f} 層層主！第 ${f + 1} 層已開放`, '#ffd76a');
        const unlocked = G.PARTNERS.find(p => p.floor === f + 1 || p.floor === f);
        if (unlocked && !S.partners[unlocked.id] && S.maxFloor >= unlocked.floor) G.addLog(`🤝 ${unlocked.name} 可以招募了（夥伴分頁）`, '#7fd1ff');
      }
      const cap = G.shipMaxFloor(S.ship.balloon);
      if (S.autoAdvance) {
        if (f + 1 <= cap) {
          S.floor = f + 1;
          this.time.delayedCall(900, () => this.applyFloorTheme());
          this.floatText(W / 2, 80, `↑ 前往第 ${S.floor} 層`, '#ffffff', 22, 1500);
        } else if (!this.capWarned) {
          this.capWarned = true;
          G.addLog(`🎈 氣囊高度只到第 ${cap} 層，升級氣囊才能往上`, '#ffb36b');
          G.emit('toast', `飛行船只能到第 ${cap} 層，升級「氣囊」才能繼續往上`);
        }
      }
      G.emit('floorChange');
    }

    // 戰敗：等 30 秒免費復活（退回上一層），或花雲晶原地復活
    defeat() {
      this.mode = 'dead';
      this.hero.img.setAlpha(0.35).setTint(0x777777);
      this.floatText(W / 2, 110, '戰敗……', '#ff6b6b', 26, 1600);
      // 用真實時間計時：分頁切到背景時 Phaser 會暫停，但復活倒數要照算
      this.reviveAt = Date.now() + G.CONFIG.reviveSeconds * 1000;
      G.addLog(`💀 在第 ${G.S.floor} 層倒下`, '#ff8a8a');
      G.emit('dead', true);
    }

    // 倒數結束：免費復活，退回上一層修練
    reviveFree() {
      const S = G.S;
      const back = Math.max(1, S.floor - 1);
      this.reviveAt = 0;
      S.autoAdvance = false;
      S.floor = back; S.kills = 0;
      G.addLog(`🕊️ 復活了，退回第 ${back} 層修練（已暫停自動推進）`, '#ff8a8a');
      G.emit('dead', false);
      G.emit('floorChange');
      this.restartFloor();
    }

    // 花雲晶：全隊原地滿血復活，繼續這場戰鬥
    revivePaid() {
      const S = G.S, cost = G.CONFIG.reviveCost;
      if (this.mode !== 'dead') return;
      if (S.crystal < cost) return G.emit('toast', `雲晶不夠，需要 ${cost} 💎`);
      S.crystal -= cost;
      this.reviveAt = 0;
      this.units.forEach(u => {
        if (u.kind === 'summon') return;
        u.alive = true; u.hp = u.st.maxHp;
        u.img.setAlpha(1).clearTint();
        this.glow(u, '#ffd76a');
      });
      this.floatText(W / 2, 110, '復活！', '#ffd76a', 26, 1200);
      G.addLog(`💎 花了 ${cost} 雲晶原地復活`, '#9fe8ff');
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
            if (t.alive) { this.hit(src, t, 0.3 * G.S.ship.cannon); this.floatText(t.img.x, t.img.y - 70, '砲擊!', '#ffb36b', 13); this.checkWaveEnd(); }
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
