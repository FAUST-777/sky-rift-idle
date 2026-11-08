// 繁體中文（主要語言，其他語言缺字時會退回這裡）
G.I18N['zh-TW'] = {
  'game.title': '天空裂洞物語',

  // ── 分頁 / 共用 ──
  'tab.adventure': '冒險', 'tab.hero': '角色', 'tab.skills': '技能', 'tab.partners': '夥伴', 'tab.ship': '飛行船', 'tab.home': '家園',
  'common.close': '關閉', 'common.cancel': '取消', 'common.gold': '金幣', 'common.crystal': '雲晶',
  'floor.name': '第 {n} 層', 'floor.boss': '層主戰',

  // ── 屬性 ──
  'stat.hp': '生命', 'stat.atk': '攻擊', 'stat.def': '防禦', 'stat.spd': '攻速', 'stat.crit': '暴擊%', 'stat.power': '戰力',

  // ── 設定 ──
  'settings.title': '設定', 'settings.language': '語言',
  'settings.game': '遊戲', 'settings.autosell': '撿到普通裝備自動賣掉',
  'settings.data': '存檔', 'settings.saveNote': '進度自動存在這個瀏覽器。',
  'settings.reset': '重置存檔', 'settings.credits': '授權說明',
  'reset.title': '重置存檔？', 'reset.body': '所有進度都會消失，無法復原。', 'reset.confirm': '確定重置',
  'credits.body': '本遊戲使用 <b>Phaser 3.80.1</b>（https://phaser.io），依 MIT 授權使用。',

  // ── 冒險 ──
  'adv.title': '天空裂洞', 'adv.reach': '最高可到第 {top} 層（氣囊上限 {cap}）',
  'adv.down': '◀ 下降', 'adv.up': '上升 ▶', 'adv.auto': '打倒層主後自動往上', 'adv.challenge': '挑戰第 {n} 層',
  'adv.partners': '夥伴', 'adv.log': '冒險日誌', 'adv.logEmpty': '還沒有紀錄',

  // ── 角色 / 裝備 ──
  'hero.class': '職業', 'hero.classLocked': '到 {lv} 級可以轉職（目前 {cur} 級）。', 'hero.current': '（目前）',
  'hero.classChangeNote': '換職業要 {cost} 金幣，技能點會全部退還。',
  'hero.bag': '背包', 'hero.autoEquip': '一鍵穿最好的', 'hero.sellCommon': '賣掉普通', 'hero.sellUncommon': '賣掉優良以下',
  'hero.bagEmpty': '打怪會掉裝備，掉到的會出現在這裡。',
  'hero.who.hero': '主角', 'hero.partnerNote': '夥伴的職業與升級在「夥伴」分頁。', 'hero.notRecruited': '還沒有夥伴，往上爬就會遇到。',
  'hero.expand': '擴充 +{n} 格', 'hero.bagMax': '已達上限', 'item.equipTo': '給 {name} 裝備',
  'hero.autoEquipHint': '主角先挑，剩下的再分給夥伴',
  'item.named': '{prefix}・{base}', 'item.meta': '{rarity}・{slot}・第 {floor} 層掉落',
  'item.compare': '括號內是跟目前穿著「{name}」的差異', 'item.unequip': '卸下', 'item.sell': '賣掉 +{v}💰', 'item.equip': '裝備',
  'classModal.title': '轉職為「{name}」？', 'classModal.free': '第一次轉職免費。', 'classModal.cost': '需要 {cost} 金幣。',
  'classModal.refund': '技能點會全部退還，可以重新分配。', 'classModal.confirm': '轉職',

  'slot.weapon': '武器', 'slot.helmet': '頭盔', 'slot.armor': '鎧甲', 'slot.boots': '靴子', 'slot.accessory': '飾品',
  'rarity.0': '普通', 'rarity.1': '優良', 'rarity.2': '稀有', 'rarity.3': '史詩', 'rarity.4': '傳說',
  'prefix.1': '雲紋', 'prefix.2': '風暴', 'prefix.3': '星辰', 'prefix.4': '裂界',
  'base.weapon.0': '長劍', 'base.weapon.1': '戰斧', 'base.weapon.2': '法杖', 'base.weapon.3': '權杖',
  'base.helmet.0': '皮帽', 'base.helmet.1': '鐵盔', 'base.helmet.2': '兜帽',
  'base.armor.0': '布衣', 'base.armor.1': '鎖甲', 'base.armor.2': '板甲',
  'base.boots.0': '皮靴', 'base.boots.1': '鐵靴',
  'base.accessory.0': '護身符', 'base.accessory.1': '戒指', 'base.accessory.2': '徽章',

  // ── 職業 ──
  'class.villager.name': '村民', 'class.villager.desc': '平凡的村民。到 5 級可以轉職。',
  'class.bloodknight.name': '血騎士', 'class.bloodknight.desc': '近戰物理輸出，靠吸血續戰。',
  'class.catknight.name': '貓鎧者', 'class.catknight.desc': '全身包覆鎧甲的神祕騎士。打開鎧甲開口射出小貓抓傷敵人，削弱敵人防禦、擅長全體傷害，並讓全隊累積「士氣」與「吸貓狂熱」。',
  'class.priest.name': '牧師', 'class.priest.desc': '治療、護盾、強化隊友。',
  'class.crusader.name': '聖十字軍', 'class.crusader.desc': '坦克，挑釁敵人、承受傷害。',

  // ── 技能 ──
  'skills.points': '技能點', 'skills.help': '主動技能放進下面 3 個格子才會自動施放。被動技能學了就生效。換不同組合 = 不同 Build。',
  'skills.empty': '空格', 'skills.emptyHint': '點我放技能', 'skills.tree': '{cls} 技能樹',
  'skills.villager': '村民只會「猛擊」。到 {lv} 級轉職後會開啟完整技能樹。',
  'skills.tier': '第 {n} 階', 'skills.tierReq': '・需在此職業投入 {req} 點（目前 {cur}）',
  'skills.notLearned': '尚未學習', 'skills.next': '下一級：{desc}', 'skills.maxed': '已滿級',
  'skills.active': '主動・{cd}秒', 'skills.passive': '被動',
  'skills.pickTitle': '放入第 {n} 格', 'skills.noActive': '還沒有學會的主動技能', 'skills.clear': '清空',

  'skill.smash.name': '猛擊', 'skill.smash.desc': '造成 {v}% 攻擊傷害',
  'skill.bloodslash.name': '血斬', 'skill.bloodslash.desc': '單體 {v}% 傷害',
  'skill.drain.name': '吸血', 'skill.drain.desc': '傷害的 {v}% 轉為生命',
  'skill.whirl.name': '旋風血刃', 'skill.whirl.desc': '全體 {v}% 傷害',
  'skill.frenzy.name': '狂怒', 'skill.frenzy.desc': '暴擊率 +{v}%',
  'skill.bloodlust.name': '嗜血', 'skill.bloodlust.desc': '自身攻擊 +{v}%，8 秒',
  'skill.kittenvolley.name': '貓咪齊射', 'skill.kittenvolley.desc': '打開艙門射出一群小貓，全體 {v}% 傷害',
  'skill.clawmark.name': '貓爪印記', 'skill.clawmark.desc': '普攻破甲效果再 +{v}%（基本 10%）',
  'skill.fullburst.name': '全彈發射', 'skill.fullburst.desc': '全身艙門打開，全體 {v}% 傷害，並使敵人防禦 -30%，6 秒',
  'skill.heavyplate.name': '重裝鎧甲', 'skill.heavyplate.desc': '防禦 +{v}%',
  'skill.catstorm.name': '萬貓奔騰', 'skill.catstorm.desc': '全隊攻擊 +{v}%，10 秒',
  'skill.holylight.name': '聖光術', 'skill.holylight.desc': '全隊回復 {v}% 生命',
  'skill.smite.name': '聖光懲擊', 'skill.smite.desc': '攻擊 +{v}%',
  'skill.aegis.name': '神聖護盾', 'skill.aegis.desc': '全隊獲得 {v}% 生命的護盾',
  'skill.devotion.name': '虔誠', 'skill.devotion.desc': '治療與護盾效果 +{v}%',
  'skill.blessing.name': '祝福', 'skill.blessing.desc': '全隊攻擊 +{v}%，10 秒',
  'skill.shieldbash.name': '盾擊', 'skill.shieldbash.desc': '單體 {v}% 傷害',
  'skill.bulwark.name': '鐵壁', 'skill.bulwark.desc': '防禦 +{v}%',
  'skill.provoke.name': '挑釁', 'skill.provoke.desc': '吸引所有敵人，自身減傷 {v}%，6 秒',
  'skill.fortitude.name': '堅韌', 'skill.fortitude.desc': '生命 +{v}%',
  'skill.judgement.name': '神聖審判', 'skill.judgement.desc': '全體 {v}% 傷害',

  // ── 夥伴 ──
  'partners.title': '夥伴', 'partners.deployed': '出戰 {n}/{max}',
  'partners.help': '每往上爬幾層會遇到新夥伴。夥伴可以選職業、花金幣升級，會自動施放職業的第一個技能。職業可以免費更換。',
  'partners.unknown': '？？？', 'partners.meetAt': '到達第 {n} 層後會遇到', 'partners.recruit': '招募 {cost}💰',
  'partners.inParty': '出戰中', 'partners.resting': '休息中', 'partners.stats': '生命 {hp}・攻擊 {atk}・防禦 {def}',
  'partners.skill': '・技能「{name}」Lv{lv}', 'partners.levelUp': '升級 {cost}💰',
  'partner.ella.name': '獵人艾拉', 'partner.ella.bio': '村裡最好的弓手，想知道天空洞裡有什麼獵物。',
  'partner.bram.name': '鐵匠布蘭', 'partner.bram.bio': '幫你修過熱氣球的鐵匠，力氣大得嚇人。',
  'partner.lina.name': '修女莉娜', 'partner.lina.bio': '在第 7 層迷路的修女，相信裂洞是神的試煉。',
  'partner.kael.name': '浪人凱爾', 'partner.kael.bio': '比所有人都早上來的探險者，似乎知道些什麼。',
  'partner.mira.name': '占星師米菈', 'partner.mira.bio': '能讀懂裂洞星圖的少女。',

  // ── 飛行船 ──
  'ship.help': '飛行船決定你能飛多高：<b>氣囊等級</b>決定能進入的最高層。升級零件，外觀也會跟著改變。',
  'ship.parts': '改裝零件', 'ship.partsHint': '雲晶：打層主必掉', 'ship.maxed': '滿級',
  'ship.look': '外觀', 'ship.paint': '塗裝', 'ship.figurehead': '船首像',
  'part.balloon.name': '氣囊', 'part.balloon.desc': '可到達第 {n} 層',
  'part.engine.name': '引擎', 'part.engine.desc': '金幣 +{n}%、移動加快',
  'part.hull.name': '船身', 'part.hull.desc': '家園空間 {w}×{h}',
  'part.cannon.name': '船砲', 'part.cannon.desc': '每 6 秒砲擊，{n}% 攻擊力傷害', 'part.cannon.none': '尚未安裝',
  'figurehead.0': '無', 'figurehead.1': '鷹首', 'figurehead.2': '龍首', 'figurehead.3': '女神像',

  // ── 家園 ──
  'home.title': '飛行船船艙', 'home.comfort': '舒適度 {c}（離線收益 +{c}%）',
  'home.placingHint': '👉 點空格擺放，點已擺的家具收回倉庫。',
  'home.hint': '先在下面「倉庫」選一件家具，再點空格擺放。點已擺放的家具可收回。', 'home.hullHint': '升級「船身」可以擴大空間。',
  'home.storage': '倉庫', 'home.storageEmpty': '空的，去下面商店買家具吧', 'home.shop': '家具商店',
  'home.collect': '收藏', 'home.comfortPlus': '舒適 +{n}',
  'home.pets': '捕獲的怪物', 'home.petsInfo': '{n}/{cap}・每隻金幣 +1%',
  'home.nets': '🕸️ 捕獸網 <b>{n}</b> 張', 'home.netsHint': '有網時打倒小怪有 {p}% 機率捕獲',
  'home.buy1': '買 1 張 {price}💰', 'home.buy10': '買 10 張', 'home.noPets': '還沒有捕獲任何怪物', 'home.pickFirst': '先在「倉庫」選一件家具',
  'furniture.plant': '盆栽', 'furniture.barrel': '酒桶', 'furniture.lamp': '風燈', 'furniture.chair': '木椅', 'furniture.bed': '吊床',
  'furniture.rug': '織毯', 'furniture.shelf': '書櫃', 'furniture.globe': '天空儀', 'furniture.compass': '古代羅盤',
  'furniture.egg': '龍蛋', 'furniture.star': '星砂瓶',

  // ── 怪物 ──
  'monster.cloudSlime': '雲史萊姆', 'monster.windBat': '風蝙蝠', 'monster.rubbleGolem': '碎石魔像',
  'monster.thunderBird': '雷鳥', 'monster.skyJelly': '浮空水母', 'monster.ironCrow': '鐵羽鴉',
  'monster.gargoyle': '石像鬼', 'monster.cloudGiant': '雲巨人', 'monster.riftSlime': '裂界史萊姆',
  'monster.voidJelly': '虛空水母', 'monster.starGolem': '星骸魔像', 'monster.skyWarden': '天穹守衛',

  // ── 戰鬥 ──
  'battle.bossAppear': '⚠ 第 {n} 層 層主出現', 'battle.crit': '暴擊', 'battle.cannon': '砲擊!',
  'battle.toFloor': '↑ 前往第 {n} 層', 'battle.defeat': '戰敗……', 'battle.revived': '復活！',
  'revive.title': '💀 戰敗', 'revive.wait': '<b>{s}</b>秒後免費復活（退回第 {n} 層）', 'revive.pay': '💎 {cost} 立即原地復活（有 {have}）',

  'battle.morale': '🎖️ 士氣 +{n}%', 'battle.collapse': '收起戰鬥畫面', 'battle.expand': '展開戰鬥畫面',
  'battle.deadShort': '💀 {s}秒',

  // ── Buff ──
  'buff.morale.name': '士氣', 'buff.morale.desc': '貓鎧者在場時，每打過一層（沒有戰敗）全隊最終防禦 +1%，最多 +{max}%。目前 +{n}%。戰敗會歸零。',
  'buff.frenzy.name': '吸貓狂熱', 'buff.frenzy.desc': '貓鎧者在場時，隊員每次打中敵人，自身傷害 +1%（最多 +{max}%），倒下才重新計算。目前：{list}',
  'buff.atk.name': '攻擊強化', 'buff.atk.desc': '攻擊 +{v}%，還剩 {s} 秒',
  'buff.shield.name': '護盾', 'buff.shield.desc': '可再吸收 {v} 點傷害',
  'buff.taunt.name': '挑釁', 'buff.taunt.desc': '{name} 正在吸引所有敵人',
  'buff.break.name': '敵人破甲', 'buff.break.desc': '敵人防禦 -{v}%',

  // ── 日誌 ──
  'log.start': '🎈 你搭著熱氣球飛進了天空裂洞……',
  'log.levelUp': '⬆️ 升到 {lv} 級！獲得 1 技能點', 'log.canClass': '✨ 可以轉職了！到「角色」分頁選擇職業',
  'log.classChanged': '🎓 轉職為「{cls}」！技能點已重置', 'log.recruited': '🤝 {name} 加入了隊伍！',
  'log.shipUp': '🛠️ {part} 升到 {lv} 級', 'log.drop': '🎁 掉落 {rarity}「{item}」', 'log.bagFull': '🎒 背包滿了，裝備自動賣掉',
  'log.capture': '🕸️ 捕獲了「{name}」！牠住進了飛行船', 'log.bossDown': '🏆 擊敗第 {f} 層層主！第 {n} 層已開放',
  'log.partnerAvail': '🤝 {name} 可以招募了（夥伴分頁）', 'log.capReached': '🎈 氣囊高度只到第 {n} 層，升級氣囊才能往上',
  'log.defeat': '💀 在第 {n} 層倒下', 'log.reviveFree': '🕊️ 復活了，退回第 {n} 層修練（已暫停自動推進）',
  'log.revivePaid': '💎 花了 {n} 雲晶原地復活', 'log.moraleLost': '🎖️ 戰敗，士氣歸零',

  // ── 提示 ──
  'toast.canClass': '可以轉職了！到「角色」分頁選擇職業', 'toast.bagFull': '背包滿了',
  'toast.sold': '賣出 {n} 件，獲得 {g} 金幣', 'toast.equipped': '換上 {n} 件更好的裝備（主角優先，其次夥伴）',
  'toast.bagExpanded': '背包擴充到 {n} 格', 'toast.bestAlready': '已經是最好的裝備了',
  'toast.classLevel': '{lv} 級才能轉職', 'toast.classCost': '換職業需要 {cost} 金幣',
  'toast.noSP': '沒有技能點了，升級可以獲得', 'toast.tierReq': '需要先在此職業投入 {n} 點',
  'toast.reachFloor': '要先到達第 {n} 層', 'toast.needGold': '需要 {n} 金幣',
  'toast.partnerCap': '夥伴等級不能超過主角 5 級以上', 'toast.partyFull': '最多 {n} 位夥伴出戰',
  'toast.shipMax': '已經升到最高級', 'toast.needShip': '需要 {gold} 金幣、{crystal} 雲晶',
  'toast.notEnoughGold': '金幣不夠', 'toast.notEnoughCrystal': '雲晶不夠', 'toast.bought': '買了 {name}，到家園點空格擺放',
  'toast.capReached': '飛行船只能到第 {n} 層，升級「氣囊」才能繼續往上', 'toast.reviveNeed': '雲晶不夠，需要 {n} 💎',

  // ── 離線收益 / 序章 ──
  'offline.title': '歡迎回來！', 'offline.away': '你離開了 {time}，飛行船上的夥伴們持續在第 {floor} 層探索。',
  'time.hm': '{h} 小時 {m} 分鐘', 'time.m': '{m} 分鐘',
  'offline.gold': '金幣', 'offline.xp': '經驗', 'offline.bonus': '家園舒適度加成',
  'offline.cap': '離線收益最多累積 {h} 小時。布置家園可以提高收益。', 'offline.ok': '收下',
  'prologue.title': '序章', 'prologue.next': '繼續', 'prologue.go': '出發！',
  'prologue.1': '這是一個平凡的中世紀村莊。麥田、風車、石板路，日子一天天過去。',
  'prologue.2': '直到某天清晨，村民們抬頭，看見天空破了一個大洞。',
  'prologue.3': '洞裡傳來風聲，也落下閃閃發光的「雲晶」。',
  'prologue.4': '大家紛紛搭上熱氣球，飛進洞裡探險……',
  'prologue.5': '而你，只是一個普通的村民。',
};
