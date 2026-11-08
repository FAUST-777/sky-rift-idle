// English
G.I18N['en'] = {
  'game.title': 'Sky Rift Chronicles',

  // ── Tabs / common ──
  'tab.adventure': 'Adventure', 'tab.hero': 'Hero', 'tab.skills': 'Skills', 'tab.partners': 'Party', 'tab.ship': 'Airship', 'tab.home': 'Home',
  'common.close': 'Close', 'common.cancel': 'Cancel', 'common.gold': 'Gold', 'common.crystal': 'Cloud Crystals',
  'floor.name': 'Floor {n}', 'floor.boss': 'Boss',

  // ── Stats ──
  'stat.hp': 'HP', 'stat.atk': 'ATK', 'stat.def': 'DEF', 'stat.spd': 'SPD', 'stat.crit': 'Crit %', 'stat.power': 'Power',

  // ── Settings ──
  'settings.title': 'Settings', 'settings.language': 'Language',
  'settings.game': 'Game', 'settings.autosell': 'Auto-sell Common gear',
  'settings.data': 'Save data', 'settings.saveNote': 'Progress is saved automatically in this browser.',
  'settings.reset': 'Reset save', 'settings.credits': 'Licenses',
  'reset.title': 'Reset save?', 'reset.body': 'All progress will be lost. This cannot be undone.', 'reset.confirm': 'Reset',
  'credits.body': 'This game uses <b>Phaser 3.80.1</b> (https://phaser.io) under the MIT License.',

  // ── Adventure ──
  'adv.title': 'The Sky Rift', 'adv.reach': 'Highest reachable: Floor {top} (balloon limit {cap})',
  'adv.down': '◀ Down', 'adv.up': 'Up ▶', 'adv.auto': 'Climb automatically after beating the boss', 'adv.challenge': 'Challenge Floor {n}',
  'adv.partners': 'Party', 'adv.log': 'Adventure Log', 'adv.logEmpty': 'Nothing yet',

  // ── Hero / gear ──
  'hero.class': 'Class', 'hero.classLocked': 'Choose a class at Lv {lv} (currently Lv {cur}).', 'hero.current': ' (current)',
  'hero.classChangeNote': 'Changing class costs {cost} gold. All skill points are refunded.',
  'hero.bag': 'Inventory', 'hero.autoEquip': 'Equip best', 'hero.sellCommon': 'Sell Common', 'hero.sellUncommon': 'Sell Uncommon & below',
  'hero.bagEmpty': 'Monsters drop gear. Anything you find shows up here.',
  'item.named': '{prefix} {base}', 'item.meta': '{rarity} · {slot} · Dropped on Floor {floor}',
  'item.compare': 'Numbers in brackets compare with your equipped {name}', 'item.unequip': 'Unequip', 'item.sell': 'Sell +{v}💰', 'item.equip': 'Equip',
  'classModal.title': 'Become a {name}?', 'classModal.free': 'Your first class change is free.', 'classModal.cost': 'Costs {cost} gold.',
  'classModal.refund': 'All skill points will be refunded so you can spend them again.', 'classModal.confirm': 'Change class',

  'slot.weapon': 'Weapon', 'slot.helmet': 'Helmet', 'slot.armor': 'Armor', 'slot.boots': 'Boots', 'slot.accessory': 'Accessory',
  'rarity.0': 'Common', 'rarity.1': 'Uncommon', 'rarity.2': 'Rare', 'rarity.3': 'Epic', 'rarity.4': 'Legendary',
  'prefix.1': 'Cloudwoven', 'prefix.2': 'Stormforged', 'prefix.3': 'Starlit', 'prefix.4': 'Riftborn',
  'base.weapon.0': 'Longsword', 'base.weapon.1': 'Battle Axe', 'base.weapon.2': 'Staff', 'base.weapon.3': 'Mace',
  'base.helmet.0': 'Leather Cap', 'base.helmet.1': 'Iron Helm', 'base.helmet.2': 'Hood',
  'base.armor.0': 'Tunic', 'base.armor.1': 'Chainmail', 'base.armor.2': 'Plate Armor',
  'base.boots.0': 'Leather Boots', 'base.boots.1': 'Iron Greaves',
  'base.accessory.0': 'Amulet', 'base.accessory.1': 'Ring', 'base.accessory.2': 'Badge',

  // ── Classes ──
  'class.villager.name': 'Villager', 'class.villager.desc': 'An ordinary villager. Choose a class at Lv 5.',
  'class.bloodknight.name': 'Blood Knight', 'class.bloodknight.desc': 'Melee physical damage that heals by draining blood.',
  'class.necro.name': 'Necromancer', 'class.necro.desc': 'Ranged magic and summoned skeletons. Strong area damage.',
  'class.priest.name': 'Priest', 'class.priest.desc': 'Heals, shields and empowers the party.',
  'class.crusader.name': 'Crusader', 'class.crusader.desc': 'A tank who taunts enemies and soaks up damage.',

  // ── Skills ──
  'skills.points': 'Skill Points', 'skills.help': 'Active skills only cast automatically when placed in the 3 slots below. Passive skills work as soon as you learn them. Different combos = different builds.',
  'skills.empty': 'Empty', 'skills.emptyHint': 'Tap to assign', 'skills.tree': '{cls} Skill Tree',
  'skills.villager': 'Villagers only know Smash. The full skill tree opens after choosing a class at Lv {lv}.',
  'skills.tier': 'Tier {n}', 'skills.tierReq': ' · Requires {req} points in this class (you have {cur})',
  'skills.notLearned': 'Not learned', 'skills.next': 'Next rank: {desc}', 'skills.maxed': 'Max rank',
  'skills.active': 'Active · {cd}s', 'skills.passive': 'Passive',
  'skills.pickTitle': 'Assign to slot {n}', 'skills.noActive': 'You have not learned any active skills yet', 'skills.clear': 'Clear',

  'skill.smash.name': 'Smash', 'skill.smash.desc': 'Deals {v}% ATK damage',
  'skill.bloodslash.name': 'Blood Slash', 'skill.bloodslash.desc': 'Deals {v}% damage to one enemy',
  'skill.drain.name': 'Lifedrain', 'skill.drain.desc': 'Heals for {v}% of damage dealt',
  'skill.whirl.name': 'Crimson Whirl', 'skill.whirl.desc': 'Deals {v}% damage to all enemies',
  'skill.frenzy.name': 'Frenzy', 'skill.frenzy.desc': 'Crit chance +{v}%',
  'skill.bloodlust.name': 'Bloodlust', 'skill.bloodlust.desc': 'Own ATK +{v}% for 8s',
  'skill.bonespear.name': 'Bone Spear', 'skill.bonespear.desc': 'Deals {v}% damage to one enemy',
  'skill.soulsiphon.name': 'Soul Siphon', 'skill.soulsiphon.desc': 'ATK +{v}%',
  'skill.skeleton.name': 'Raise Skeleton', 'skill.skeleton.desc': 'Summons a skeleton for 12s with {v}% of your ATK',
  'skill.legion.name': 'Army of the Dead', 'skill.legion.desc': 'Summon ATK +{v}%',
  'skill.corpse.name': 'Corpse Explosion', 'skill.corpse.desc': 'Deals {v}% damage to all enemies',
  'skill.holylight.name': 'Holy Light', 'skill.holylight.desc': 'Heals the party for {v}% HP',
  'skill.smite.name': 'Smite', 'skill.smite.desc': 'ATK +{v}%',
  'skill.aegis.name': 'Divine Aegis', 'skill.aegis.desc': 'Shields the party for {v}% of their HP',
  'skill.devotion.name': 'Devotion', 'skill.devotion.desc': 'Healing and shields +{v}%',
  'skill.blessing.name': 'Blessing', 'skill.blessing.desc': 'Party ATK +{v}% for 10s',
  'skill.shieldbash.name': 'Shield Bash', 'skill.shieldbash.desc': 'Deals {v}% damage to one enemy',
  'skill.bulwark.name': 'Bulwark', 'skill.bulwark.desc': 'DEF +{v}%',
  'skill.provoke.name': 'Provoke', 'skill.provoke.desc': 'Draws all enemies and reduces damage taken by {v}% for 6s',
  'skill.fortitude.name': 'Fortitude', 'skill.fortitude.desc': 'HP +{v}%',
  'skill.judgement.name': 'Judgement', 'skill.judgement.desc': 'Deals {v}% damage to all enemies',

  // ── Party ──
  'partners.title': 'Companions', 'partners.deployed': 'Deployed {n}/{max}',
  'partners.help': 'You meet new companions as you climb. Pick their class and spend gold to level them up. They automatically use their class\'s first skill. Changing their class is free.',
  'partners.unknown': '???', 'partners.meetAt': 'Met after reaching Floor {n}', 'partners.recruit': 'Recruit {cost}💰',
  'partners.inParty': 'Deployed', 'partners.resting': 'Resting', 'partners.stats': 'HP {hp} · ATK {atk} · DEF {def}',
  'partners.skill': ' · Skill: {name} Lv{lv}', 'partners.levelUp': 'Level up {cost}💰',
  'partner.ella.name': 'Ella the Hunter', 'partner.ella.bio': 'The best archer in the village, curious about what game lives in the rift.',
  'partner.bram.name': 'Bram the Smith', 'partner.bram.bio': 'The blacksmith who patched your balloon. Frighteningly strong.',
  'partner.lina.name': 'Sister Lina', 'partner.lina.bio': 'A nun lost on Floor 7 who believes the rift is a divine trial.',
  'partner.kael.name': 'Kael the Wanderer', 'partner.kael.bio': 'An explorer who came up before anyone else. He seems to know something.',
  'partner.mira.name': 'Mira the Astrologer', 'partner.mira.bio': 'A girl who can read the rift\'s star charts.',

  // ── Airship ──
  'ship.help': 'Your airship decides how high you can go: <b>balloon level</b> sets the highest floor you can enter. Upgrading parts also changes how it looks.',
  'ship.parts': 'Upgrades', 'ship.partsHint': 'Bosses always drop Cloud Crystals', 'ship.maxed': 'Max',
  'ship.look': 'Appearance', 'ship.paint': 'Paint', 'ship.figurehead': 'Figurehead',
  'part.balloon.name': 'Balloon', 'part.balloon.desc': 'Reach Floor {n}',
  'part.engine.name': 'Engine', 'part.engine.desc': 'Gold +{n}%, faster travel',
  'part.hull.name': 'Hull', 'part.hull.desc': 'Home space {w}×{h}',
  'part.cannon.name': 'Cannon', 'part.cannon.desc': 'Fires every 6s for {n}% ATK damage', 'part.cannon.none': 'Not installed',
  'figurehead.0': 'None', 'figurehead.1': 'Eagle', 'figurehead.2': 'Dragon', 'figurehead.3': 'Goddess',

  // ── Home ──
  'home.title': 'Airship Cabin', 'home.comfort': 'Comfort {c} (offline earnings +{c}%)',
  'home.placingHint': '👉 Tap an empty tile to place it. Tap placed furniture to put it back in storage.',
  'home.hint': 'Pick a piece of furniture from Storage below, then tap an empty tile. Tap placed furniture to remove it.', 'home.hullHint': 'Upgrade the Hull for more space.',
  'home.storage': 'Storage', 'home.storageEmpty': 'Empty. Buy some furniture in the shop below.', 'home.shop': 'Furniture Shop',
  'home.collect': 'Collectible', 'home.comfortPlus': 'Comfort +{n}',
  'home.pets': 'Captured Monsters', 'home.petsInfo': '{n}/{cap} · Each gives +1% gold',
  'home.nets': '🕸️ Nets: <b>{n}</b>', 'home.netsHint': 'With nets, defeated monsters have a {p}% chance to be captured',
  'home.buy1': 'Buy 1 for {price}💰', 'home.buy10': 'Buy 10', 'home.noPets': 'No monsters captured yet', 'home.pickFirst': 'Pick furniture from Storage first',
  'furniture.plant': 'Potted Plant', 'furniture.barrel': 'Barrel', 'furniture.lamp': 'Lantern', 'furniture.chair': 'Wooden Chair', 'furniture.bed': 'Hammock',
  'furniture.rug': 'Woven Rug', 'furniture.shelf': 'Bookshelf', 'furniture.globe': 'Sky Orrery', 'furniture.compass': 'Ancient Compass',
  'furniture.egg': 'Dragon Egg', 'furniture.star': 'Stardust Jar',

  // ── Monsters ──
  'monster.cloudSlime': 'Cloud Slime', 'monster.windBat': 'Wind Bat', 'monster.rubbleGolem': 'Rubble Golem',
  'monster.thunderBird': 'Thunderbird', 'monster.skyJelly': 'Sky Jelly', 'monster.ironCrow': 'Ironfeather Crow',
  'monster.gargoyle': 'Gargoyle', 'monster.cloudGiant': 'Cloud Giant', 'monster.riftSlime': 'Rift Slime',
  'monster.voidJelly': 'Void Jelly', 'monster.starGolem': 'Starwreck Golem', 'monster.skyWarden': 'Sky Warden',

  // ── Battle ──
  'battle.bossAppear': '⚠ Floor {n} Boss', 'battle.crit': 'CRIT', 'battle.cannon': 'Fire!',
  'battle.toFloor': '↑ To Floor {n}', 'battle.defeat': 'Defeated...', 'battle.revived': 'Revived!',
  'revive.title': '💀 Defeated', 'revive.wait': 'Free revive in<b>{s}s</b>(back to Floor {n})', 'revive.pay': '💎 {cost} Revive here now (you have {have})',

  // ── Log ──
  'log.start': '🎈 You drifted into the Sky Rift on a hot-air balloon...',
  'log.levelUp': '⬆️ Reached Lv {lv}! +1 skill point', 'log.canClass': '✨ You can choose a class! Go to the Hero tab',
  'log.classChanged': '🎓 You became a {cls}! Skill points reset', 'log.recruited': '🤝 {name} joined the party!',
  'log.shipUp': '🛠️ {part} upgraded to Lv {lv}', 'log.drop': '🎁 Found {rarity} {item}', 'log.bagFull': '🎒 Inventory full, gear sold automatically',
  'log.capture': '🕸️ Captured: {name}! It now lives on your airship', 'log.bossDown': '🏆 Defeated the Floor {f} boss! Floor {n} unlocked',
  'log.partnerAvail': '🤝 {name} can be recruited (Party tab)', 'log.capReached': '🎈 Your balloon only reaches Floor {n}. Upgrade it to climb higher',
  'log.defeat': '💀 Fell on Floor {n}', 'log.reviveFree': '🕊️ Revived and pulled back to Floor {n} to train (auto-climb paused)',
  'log.revivePaid': '💎 Spent {n} Cloud Crystals to revive on the spot',

  // ── Toasts ──
  'toast.canClass': 'You can choose a class! Go to the Hero tab', 'toast.bagFull': 'Inventory full',
  'toast.sold': 'Sold {n} items for {g} gold', 'toast.equipped': 'Equipped {n} better items', 'toast.bestAlready': 'You already have the best gear on',
  'toast.classLevel': 'Class change unlocks at Lv {lv}', 'toast.classCost': 'Changing class costs {cost} gold',
  'toast.noSP': 'No skill points left. Level up to earn more', 'toast.tierReq': 'Spend {n} points in this class first',
  'toast.reachFloor': 'Reach Floor {n} first', 'toast.needGold': 'Need {n} gold',
  'toast.partnerCap': 'Companions can\'t be more than 5 levels above you', 'toast.partyFull': 'Up to {n} companions can be deployed',
  'toast.shipMax': 'Already at max level', 'toast.needShip': 'Need {gold} gold and {crystal} Cloud Crystals',
  'toast.notEnoughGold': 'Not enough gold', 'toast.notEnoughCrystal': 'Not enough Cloud Crystals', 'toast.bought': 'Bought {name}. Place it in your Home',
  'toast.capReached': 'Your airship only reaches Floor {n}. Upgrade the Balloon to go higher', 'toast.reviveNeed': 'Not enough Cloud Crystals. Need {n} 💎',

  // ── Offline / prologue ──
  'offline.title': 'Welcome back!', 'offline.away': 'You were away for {time}. Your companions kept exploring Floor {floor}.',
  'time.hm': '{h}h {m}m', 'time.m': '{m} min',
  'offline.gold': 'Gold', 'offline.xp': 'XP', 'offline.bonus': 'Home comfort bonus',
  'offline.cap': 'Offline earnings build up for at most {h} hours. Decorate your Home to earn more.', 'offline.ok': 'Collect',
  'prologue.title': 'Prologue', 'prologue.next': 'Next', 'prologue.go': 'Set off!',
  'prologue.1': 'An ordinary medieval village. Wheat fields, windmills, cobbled streets. One day much like the next.',
  'prologue.2': 'Until one morning, the villagers looked up and saw a great hole torn in the sky.',
  'prologue.3': 'Wind howled from inside it, and glittering Cloud Crystals rained down.',
  'prologue.4': 'One after another, people climbed into hot-air balloons and flew in to explore...',
  'prologue.5': 'And you? You are just an ordinary villager.',
};
