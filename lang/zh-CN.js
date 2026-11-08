// 简体中文
G.I18N['zh-CN'] = {
  'game.title': '天空裂洞物语',

  // ── 分页 / 通用 ──
  'tab.adventure': '冒险', 'tab.hero': '角色', 'tab.skills': '技能', 'tab.partners': '伙伴', 'tab.ship': '飞行船', 'tab.home': '家园',
  'common.close': '关闭', 'common.cancel': '取消', 'common.gold': '金币', 'common.crystal': '云晶',
  'floor.name': '第 {n} 层', 'floor.boss': '层主战',

  // ── 属性 ──
  'stat.hp': '生命', 'stat.atk': '攻击', 'stat.def': '防御', 'stat.spd': '攻速', 'stat.crit': '暴击%', 'stat.power': '战力',

  // ── 设置 ──
  'settings.title': '设置', 'settings.language': '语言',
  'settings.game': '游戏', 'settings.autosell': '捡到普通装备自动卖掉',
  'settings.data': '存档', 'settings.saveNote': '进度自动保存在这个浏览器。',
  'settings.reset': '重置存档', 'settings.credits': '授权说明',
  'reset.title': '重置存档？', 'reset.body': '所有进度都会消失，无法恢复。', 'reset.confirm': '确定重置',
  'credits.body': '本游戏使用 <b>Phaser 3.80.1</b>（https://phaser.io），依 MIT 许可使用。',

  // ── 冒险 ──
  'adv.title': '天空裂洞', 'adv.reach': '最高可到第 {top} 层（气囊上限 {cap}）',
  'adv.down': '◀ 下降', 'adv.up': '上升 ▶', 'adv.auto': '击败层主后自动往上', 'adv.challenge': '挑战第 {n} 层',
  'adv.partners': '伙伴', 'adv.log': '冒险日志', 'adv.logEmpty': '还没有记录',

  // ── 角色 / 装备 ──
  'hero.class': '职业', 'hero.classLocked': '到 {lv} 级可以转职（当前 {cur} 级）。', 'hero.current': '（当前）',
  'hero.classChangeNote': '更换职业需要 {cost} 金币，技能点会全部返还。',
  'hero.bag': '背包', 'hero.autoEquip': '一键穿最好的', 'hero.sellCommon': '卖掉普通', 'hero.sellUncommon': '卖掉优良以下',
  'hero.bagEmpty': '打怪会掉装备，掉到的会出现在这里。',
  'item.named': '{prefix}・{base}', 'item.meta': '{rarity}・{slot}・第 {floor} 层掉落',
  'item.compare': '括号内是与当前穿着「{name}」的差异', 'item.unequip': '卸下', 'item.sell': '卖掉 +{v}💰', 'item.equip': '装备',
  'classModal.title': '转职为「{name}」？', 'classModal.free': '第一次转职免费。', 'classModal.cost': '需要 {cost} 金币。',
  'classModal.refund': '技能点会全部返还，可以重新分配。', 'classModal.confirm': '转职',

  'slot.weapon': '武器', 'slot.helmet': '头盔', 'slot.armor': '铠甲', 'slot.boots': '靴子', 'slot.accessory': '饰品',
  'rarity.0': '普通', 'rarity.1': '优良', 'rarity.2': '稀有', 'rarity.3': '史诗', 'rarity.4': '传说',
  'prefix.1': '云纹', 'prefix.2': '风暴', 'prefix.3': '星辰', 'prefix.4': '裂界',
  'base.weapon.0': '长剑', 'base.weapon.1': '战斧', 'base.weapon.2': '法杖', 'base.weapon.3': '权杖',
  'base.helmet.0': '皮帽', 'base.helmet.1': '铁盔', 'base.helmet.2': '兜帽',
  'base.armor.0': '布衣', 'base.armor.1': '锁甲', 'base.armor.2': '板甲',
  'base.boots.0': '皮靴', 'base.boots.1': '铁靴',
  'base.accessory.0': '护身符', 'base.accessory.1': '戒指', 'base.accessory.2': '徽章',

  // ── 职业 ──
  'class.villager.name': '村民', 'class.villager.desc': '平凡的村民。到 5 级可以转职。',
  'class.bloodknight.name': '血骑士', 'class.bloodknight.desc': '近战物理输出，靠吸血续战。',
  'class.necro.name': '死灵术士', 'class.necro.desc': '远程魔法与召唤骷髅，擅长群体伤害。',
  'class.priest.name': '牧师', 'class.priest.desc': '治疗、护盾、强化队友。',
  'class.crusader.name': '圣十字军', 'class.crusader.desc': '坦克，嘲讽敌人、承受伤害。',

  // ── 技能 ──
  'skills.points': '技能点', 'skills.help': '主动技能放进下面 3 个格子才会自动施放。被动技能学了就生效。换不同组合 = 不同 Build。',
  'skills.empty': '空格', 'skills.emptyHint': '点我放技能', 'skills.tree': '{cls} 技能树',
  'skills.villager': '村民只会「猛击」。到 {lv} 级转职后会开启完整技能树。',
  'skills.tier': '第 {n} 阶', 'skills.tierReq': '・需在此职业投入 {req} 点（当前 {cur}）',
  'skills.notLearned': '尚未学习', 'skills.next': '下一级：{desc}', 'skills.maxed': '已满级',
  'skills.active': '主动・{cd}秒', 'skills.passive': '被动',
  'skills.pickTitle': '放入第 {n} 格', 'skills.noActive': '还没有学会的主动技能', 'skills.clear': '清空',

  'skill.smash.name': '猛击', 'skill.smash.desc': '造成 {v}% 攻击伤害',
  'skill.bloodslash.name': '血斩', 'skill.bloodslash.desc': '单体 {v}% 伤害',
  'skill.drain.name': '吸血', 'skill.drain.desc': '伤害的 {v}% 转为生命',
  'skill.whirl.name': '旋风血刃', 'skill.whirl.desc': '全体 {v}% 伤害',
  'skill.frenzy.name': '狂怒', 'skill.frenzy.desc': '暴击率 +{v}%',
  'skill.bloodlust.name': '嗜血', 'skill.bloodlust.desc': '自身攻击 +{v}%，8 秒',
  'skill.bonespear.name': '骨矛', 'skill.bonespear.desc': '单体 {v}% 伤害',
  'skill.soulsiphon.name': '灵魂汲取', 'skill.soulsiphon.desc': '攻击 +{v}%',
  'skill.skeleton.name': '召唤骷髅', 'skill.skeleton.desc': '召唤骷髅 12 秒，攻击力为你的 {v}%',
  'skill.legion.name': '亡者大军', 'skill.legion.desc': '召唤物攻击 +{v}%',
  'skill.corpse.name': '尸爆', 'skill.corpse.desc': '全体 {v}% 伤害',
  'skill.holylight.name': '圣光术', 'skill.holylight.desc': '全队恢复 {v}% 生命',
  'skill.smite.name': '圣光惩击', 'skill.smite.desc': '攻击 +{v}%',
  'skill.aegis.name': '神圣护盾', 'skill.aegis.desc': '全队获得 {v}% 生命的护盾',
  'skill.devotion.name': '虔诚', 'skill.devotion.desc': '治疗与护盾效果 +{v}%',
  'skill.blessing.name': '祝福', 'skill.blessing.desc': '全队攻击 +{v}%，10 秒',
  'skill.shieldbash.name': '盾击', 'skill.shieldbash.desc': '单体 {v}% 伤害',
  'skill.bulwark.name': '铁壁', 'skill.bulwark.desc': '防御 +{v}%',
  'skill.provoke.name': '嘲讽', 'skill.provoke.desc': '吸引所有敌人，自身减伤 {v}%，6 秒',
  'skill.fortitude.name': '坚韧', 'skill.fortitude.desc': '生命 +{v}%',
  'skill.judgement.name': '神圣审判', 'skill.judgement.desc': '全体 {v}% 伤害',

  // ── 伙伴 ──
  'partners.title': '伙伴', 'partners.deployed': '出战 {n}/{max}',
  'partners.help': '每往上爬几层会遇到新伙伴。伙伴可以选职业、花金币升级，会自动施放职业的第一个技能。职业可以免费更换。',
  'partners.unknown': '？？？', 'partners.meetAt': '到达第 {n} 层后会遇到', 'partners.recruit': '招募 {cost}💰',
  'partners.inParty': '出战中', 'partners.resting': '休息中', 'partners.stats': '生命 {hp}・攻击 {atk}・防御 {def}',
  'partners.skill': '・技能「{name}」Lv{lv}', 'partners.levelUp': '升级 {cost}💰',
  'partner.ella.name': '猎人艾拉', 'partner.ella.bio': '村里最好的弓手，想知道天空洞里有什么猎物。',
  'partner.bram.name': '铁匠布兰', 'partner.bram.bio': '帮你修过热气球的铁匠，力气大得吓人。',
  'partner.lina.name': '修女莉娜', 'partner.lina.bio': '在第 7 层迷路的修女，相信裂洞是神的试炼。',
  'partner.kael.name': '浪人凯尔', 'partner.kael.bio': '比所有人都早上来的探险者，似乎知道些什么。',
  'partner.mira.name': '占星师米菈', 'partner.mira.bio': '能读懂裂洞星图的少女。',

  // ── 飞行船 ──
  'ship.help': '飞行船决定你能飞多高：<b>气囊等级</b>决定能进入的最高层。升级零件，外观也会跟着改变。',
  'ship.parts': '改装零件', 'ship.partsHint': '云晶：打层主必掉', 'ship.maxed': '满级',
  'ship.look': '外观', 'ship.paint': '涂装', 'ship.figurehead': '船首像',
  'part.balloon.name': '气囊', 'part.balloon.desc': '可到达第 {n} 层',
  'part.engine.name': '引擎', 'part.engine.desc': '金币 +{n}%、移动加快',
  'part.hull.name': '船身', 'part.hull.desc': '家园空间 {w}×{h}',
  'part.cannon.name': '船炮', 'part.cannon.desc': '每 6 秒炮击，{n}% 攻击力伤害', 'part.cannon.none': '尚未安装',
  'figurehead.0': '无', 'figurehead.1': '鹰首', 'figurehead.2': '龙首', 'figurehead.3': '女神像',

  // ── 家园 ──
  'home.title': '飞行船船舱', 'home.comfort': '舒适度 {c}（离线收益 +{c}%）',
  'home.placingHint': '👉 点空格摆放，点已摆的家具收回仓库。',
  'home.hint': '先在下面「仓库」选一件家具，再点空格摆放。点已摆放的家具可收回。', 'home.hullHint': '升级「船身」可以扩大空间。',
  'home.storage': '仓库', 'home.storageEmpty': '空的，去下面商店买家具吧', 'home.shop': '家具商店',
  'home.collect': '收藏', 'home.comfortPlus': '舒适 +{n}',
  'home.pets': '捕获的怪物', 'home.petsInfo': '{n}/{cap}・每只金币 +1%',
  'home.nets': '🕸️ 捕兽网 <b>{n}</b> 张', 'home.netsHint': '有网时击败小怪有 {p}% 概率捕获',
  'home.buy1': '买 1 张 {price}💰', 'home.buy10': '买 10 张', 'home.noPets': '还没有捕获任何怪物', 'home.pickFirst': '先在「仓库」选一件家具',
  'furniture.plant': '盆栽', 'furniture.barrel': '酒桶', 'furniture.lamp': '风灯', 'furniture.chair': '木椅', 'furniture.bed': '吊床',
  'furniture.rug': '织毯', 'furniture.shelf': '书柜', 'furniture.globe': '天空仪', 'furniture.compass': '古代罗盘',
  'furniture.egg': '龙蛋', 'furniture.star': '星砂瓶',

  // ── 怪物 ──
  'monster.cloudSlime': '云史莱姆', 'monster.windBat': '风蝙蝠', 'monster.rubbleGolem': '碎石魔像',
  'monster.thunderBird': '雷鸟', 'monster.skyJelly': '浮空水母', 'monster.ironCrow': '铁羽鸦',
  'monster.gargoyle': '石像鬼', 'monster.cloudGiant': '云巨人', 'monster.riftSlime': '裂界史莱姆',
  'monster.voidJelly': '虚空水母', 'monster.starGolem': '星骸魔像', 'monster.skyWarden': '天穹守卫',

  // ── 战斗 ──
  'battle.bossAppear': '⚠ 第 {n} 层 层主出现', 'battle.crit': '暴击', 'battle.cannon': '炮击!',
  'battle.toFloor': '↑ 前往第 {n} 层', 'battle.defeat': '战败……', 'battle.revived': '复活！',
  'revive.title': '💀 战败', 'revive.wait': '<b>{s}</b>秒后免费复活（退回第 {n} 层）', 'revive.pay': '💎 {cost} 立即原地复活（有 {have}）',

  // ── 日志 ──
  'log.start': '🎈 你乘着热气球飞进了天空裂洞……',
  'log.levelUp': '⬆️ 升到 {lv} 级！获得 1 技能点', 'log.canClass': '✨ 可以转职了！到「角色」分页选择职业',
  'log.classChanged': '🎓 转职为「{cls}」！技能点已重置', 'log.recruited': '🤝 {name} 加入了队伍！',
  'log.shipUp': '🛠️ {part} 升到 {lv} 级', 'log.drop': '🎁 掉落 {rarity}「{item}」', 'log.bagFull': '🎒 背包满了，装备自动卖掉',
  'log.capture': '🕸️ 捕获了「{name}」！它住进了飞行船', 'log.bossDown': '🏆 击败第 {f} 层层主！第 {n} 层已开放',
  'log.partnerAvail': '🤝 {name} 可以招募了（伙伴分页）', 'log.capReached': '🎈 气囊高度只到第 {n} 层，升级气囊才能往上',
  'log.defeat': '💀 在第 {n} 层倒下', 'log.reviveFree': '🕊️ 复活了，退回第 {n} 层修炼（已暂停自动推进）',
  'log.revivePaid': '💎 花了 {n} 云晶原地复活',

  // ── 提示 ──
  'toast.canClass': '可以转职了！到「角色」分页选择职业', 'toast.bagFull': '背包满了',
  'toast.sold': '卖出 {n} 件，获得 {g} 金币', 'toast.equipped': '换上 {n} 件更好的装备', 'toast.bestAlready': '已经是最好的装备了',
  'toast.classLevel': '{lv} 级才能转职', 'toast.classCost': '更换职业需要 {cost} 金币',
  'toast.noSP': '没有技能点了，升级可以获得', 'toast.tierReq': '需要先在此职业投入 {n} 点',
  'toast.reachFloor': '要先到达第 {n} 层', 'toast.needGold': '需要 {n} 金币',
  'toast.partnerCap': '伙伴等级不能超过主角 5 级以上', 'toast.partyFull': '最多 {n} 位伙伴出战',
  'toast.shipMax': '已经升到最高级', 'toast.needShip': '需要 {gold} 金币、{crystal} 云晶',
  'toast.notEnoughGold': '金币不够', 'toast.notEnoughCrystal': '云晶不够', 'toast.bought': '买了 {name}，到家园点空格摆放',
  'toast.capReached': '飞行船只能到第 {n} 层，升级「气囊」才能继续往上', 'toast.reviveNeed': '云晶不够，需要 {n} 💎',

  // ── 离线收益 / 序章 ──
  'offline.title': '欢迎回来！', 'offline.away': '你离开了 {time}，飞行船上的伙伴们持续在第 {floor} 层探索。',
  'time.hm': '{h} 小时 {m} 分钟', 'time.m': '{m} 分钟',
  'offline.gold': '金币', 'offline.xp': '经验', 'offline.bonus': '家园舒适度加成',
  'offline.cap': '离线收益最多累积 {h} 小时。布置家园可以提高收益。', 'offline.ok': '收下',
  'prologue.title': '序章', 'prologue.next': '继续', 'prologue.go': '出发！',
  'prologue.1': '这是一个平凡的中世纪村庄。麦田、风车、石板路，日子一天天过去。',
  'prologue.2': '直到某天清晨，村民们抬头，看见天空破了一个大洞。',
  'prologue.3': '洞里传来风声，也落下闪闪发光的「云晶」。',
  'prologue.4': '大家纷纷乘上热气球，飞进洞里探险……',
  'prologue.5': '而你，只是一个普通的村民。',
};
