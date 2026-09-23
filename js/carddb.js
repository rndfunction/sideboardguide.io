// Local card database fallback.
// Compact: [name, mana_cost, cmc, type_line, color_identity, oracle_text_short]
// color_identity: string like "U" or "WU" or "" for colorless.
// This is intentionally a starter set — enough to cover common Pauper,
// Modern, Legacy, Standard, and Commander cards, plus everything needed for
// the built-in example decks.

const ROWS = [
  // --- Pauper Elves (test list) ---
  ["Avenging Hunter", "{4}{G}", 5, "Creature - Elf Ranger", "G", "When ~ enters, target creature gets +2/+2."],
  ["Elvish Mystic", "{G}", 1, "Creature - Elf Druid", "G", "{T}: Add {G}."],
  ["Forest", "", 0, "Basic Land - Forest", "G", "({T}: Add {G}.)"],
  ["Fyndhorn Elves", "{G}", 1, "Creature - Elf Druid", "G", "{T}: Add {G}."],
  ["Generous Ent", "{5}{G}", 6, "Creature - Treefolk", "G", "Reach. When ~ enters, you gain 3 life."],
  ["Gingerbread Cabin", "{G}", 0, "Land - Forest", "G", "({T}: Add {G}.) ~ enters tapped unless you control three or more other Forests."],
  ["Land Grant", "{1}{G}", 2, "Sorcery", "G", "If you have no land cards in hand, you may reveal your hand rather than pay this spell's mana cost. Search your library for a Forest card, reveal it, put it into your hand, then shuffle."],
  ["Lead the Stampede", "{2}{G}", 3, "Sorcery", "G", "Look at the top five cards of your library. You may reveal any number of creature cards from among them and put the revealed cards into your hand. Put the rest on the bottom of your library in any order."],
  ["Masked Vandal", "{1}{G}", 2, "Creature - Shapeshifter", "G", "Changeling. When ~ enters, you may exile a creature card from your graveyard. If you do, exile target artifact or enchantment an opponent controls."],
  ["Nyxborn Hydra", "{X}{G}{G}", 2, "Enchantment Creature - Hydra", "G", "Bestow {X}{G}{G}. ~ enters with X +1/+1 counters on it. Enchanted creature gets +1/+1 for each +1/+1 counter on ~."],
  ["Priest of Titania", "{1}{G}", 2, "Creature - Elf Druid", "G", "{T}: Add {G} for each Elf on the battlefield."],
  ["Quirion Ranger", "{G}", 1, "Creature - Elf Ranger", "G", "Return a Forest you control to its owner's hand: Untap target creature. Activate only once each turn."],
  ["Sagu Wildling", "{3}{G}", 4, "Creature - Beast", "G", "Reach, trample."],
  ["Timberwatch Elf", "{2}{G}", 3, "Creature - Elf", "G", "{T}: Target creature gets +X/+X until end of turn, where X is the number of Elves on the battlefield."],
  ["Wellwisher", "{1}{G}", 2, "Creature - Elf", "G", "{T}: You gain 1 life for each Elf on the battlefield."],
  ["Winding Way", "{1}{G}", 2, "Sorcery", "G", "Choose creature or land. Reveal the top four cards of your library. Put all cards of the chosen type revealed this way into your hand and the rest into your graveyard."],
  ["Faerie Macabre", "{1}{B}{B}", 3, "Creature - Faerie Rogue", "B", "Flying. Discard ~: Exile up to two target cards from target player's graveyard."],
  ["Gnaw to the Bone", "{1}{G}", 2, "Instant", "G", "You gain 2 life for each creature card in your graveyard. Flashback {2}{G}."],
  ["Monstrous Emergence", "{1}{G}", 2, "Sorcery", "G", "Target creature you control fights target creature you don't control."],
  ["Spinewoods Paladin", "{3}{G}", 4, "Creature - Elf Knight", "G", "Vigilance. When ~ enters, you gain 2 life."],
  ["Vitu-Ghazi Inspector", "{1}{G}", 2, "Creature - Elf Detective", "G", "When ~ enters, investigate."],

  // --- Pauper format staples ---
  ["Lightning Bolt", "{R}", 1, "Instant", "R", "~ deals 3 damage to any target."],
  ["Counterspell", "{U}{U}", 2, "Instant", "U", "Counter target spell."],
  ["Brainstorm", "{U}", 1, "Instant", "U", "Draw three cards, then put two cards from your hand on top of your library in any order."],
  ["Ponder", "{U}", 1, "Sorcery", "U", "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card."],
  ["Preordain", "{U}", 1, "Sorcery", "U", "Scry 2, then draw a card."],
  ["Delver of Secrets", "{U}", 1, "Creature - Human Wizard", "U", "At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform ~."],
  ["Snap", "{1}{U}", 2, "Instant", "U", "Return target creature to its owner's hand. Untap up to two lands."],
  ["Spell Pierce", "{U}", 1, "Instant", "U", "Counter target noncreature spell unless its controller pays {2}."],
  ["Dispel", "{U}", 1, "Instant", "U", "Counter target instant spell."],
  ["Hydroblast", "{U}", 1, "Instant", "U", "Choose one - Counter target spell if it's red; or destroy target permanent if it's red."],
  ["Pyroblast", "{R}", 1, "Instant", "R", "Choose one - Counter target spell if it's blue; or destroy target permanent if it's blue."],
  ["Red Elemental Blast", "{R}", 1, "Instant", "R", "Choose one - Counter target blue spell; or destroy target blue permanent."],
  ["Blue Elemental Blast", "{U}", 1, "Instant", "U", "Choose one - Counter target red spell; or destroy target red permanent."],
  ["Duress", "{B}", 1, "Sorcery", "B", "Target opponent reveals their hand. You choose a noncreature, nonland card from it. That player discards that card."],
  ["Divest", "{B}", 1, "Sorcery", "B", "Target player reveals their hand. You choose an artifact or creature card from it. That player discards that card."],
  ["Cast Down", "{1}{B}", 2, "Instant", "B", "Destroy target nonlegendary creature."],
  ["Doom Blade", "{1}{B}", 2, "Instant", "B", "Destroy target nonblack creature."],
  ["Snuff Out", "{3}{B}", 4, "Instant", "B", "If you control a Swamp, you may pay 4 life rather than pay this spell's mana cost. Destroy target nonblack creature. It can't be regenerated."],
  ["Chainer's Edict", "{1}{B}", 2, "Sorcery", "B", "Target player sacrifices a creature. Flashback {5}{B}{B}."],
  ["Diabolic Edict", "{1}{B}", 2, "Instant", "B", "Target player sacrifices a creature."],
  ["Suffocating Fumes", "{2}{B}", 3, "Instant", "B", "Creatures your opponents control get -1/-1 until end of turn. Cycling {2}."],
  ["Crypt Rats", "{2}{B}", 3, "Creature - Rat", "B", "{X}: ~ deals X damage to each creature and each player. Activate only as a sorcery."],
  ["Gray Merchant of Asphodel", "{3}{B}{B}", 5, "Creature - Zombie", "B", "When ~ enters, each opponent loses X life, where X is your devotion to black. You gain life equal to the life lost this way."],
  ["Bojuka Bog", "", 0, "Land", "B", "~ enters tapped. When ~ enters, exile target player's graveyard. {T}: Add {B}."],
  ["Kuldotha Rebirth", "{R}", 1, "Sorcery", "R", "As an additional cost to cast this spell, sacrifice an artifact. Create three 1/1 red Goblin creature tokens."],
  ["Galvanic Blast", "{R}", 1, "Instant", "R", "~ deals 2 damage to any target. Metalcraft - ~ deals 4 damage instead if you control three or more artifacts."],
  ["Goblin Bushwhacker", "{R}", 1, "Creature - Goblin Warrior", "R", "Kicker {R}. When ~ enters, if it was kicked, creatures you control get +1/+0 and gain haste until end of turn."],
  ["Goblin Tomb Raider", "{R}", 1, "Creature - Goblin Pirate", "R", "Haste. ~ gets +1/+0 for each artifact you control."],
  ["Voldaren Epicure", "{R}", 1, "Creature - Vampire", "R", "When ~ enters, it deals 1 damage to each opponent. Create a Blood token."],
  ["Synthesizer Schemer", "{1}{U}", 2, "Creature - Human Wizard", "U", "When ~ enters, you may return an instant or sorcery card from your graveyard to your hand."],
  ["Tolarian Terror", "{6}{U}", 7, "Creature - Serpent", "U", "This spell costs {1} less to cast for each instant and sorcery card in your graveyard. Ward {2}."],
  ["Lórien Revealed", "{3}{U}{U}", 5, "Sorcery", "U", "Draw three cards. Islandcycling {1}."],
  ["Murmuring Mystic", "{3}{U}", 4, "Creature - Human Wizard", "U", "Whenever you cast an instant or sorcery spell, create a 1/1 blue Bird Illusion creature token with flying."],
  ["Augur of Bolas", "{1}{U}", 2, "Creature - Merfolk Wizard", "U", "When ~ enters, look at the top three cards of your library. You may reveal an instant or sorcery card from among them and put it into your hand. Put the rest on the bottom of your library in any order."],
  ["Ninja of the Deep Hours", "{3}{U}", 4, "Creature - Human Ninja", "U", "Ninjutsu {1}{U}. Whenever ~ deals combat damage to a player, you may draw a card."],

  // --- Core Modern/Legacy staples ---
  ["Force of Will", "{3}{U}{U}", 5, "Instant", "U", "You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost. Counter target spell."],
  ["Snapcaster Mage", "{1}{U}", 2, "Creature - Human Wizard", "U", "Flash. When ~ enters, target instant or sorcery card in your graveyard gains flashback until end of turn."],
  ["Surgical Extraction", "{B/P}", 0, "Instant", "B", "Choose target card in a graveyard other than a basic land card. Search its owner's graveyard, hand, and library for any number of cards with the same name and exile them."],
  ["Thoughtseize", "{B}", 1, "Sorcery", "B", "Target player reveals their hand. You choose a nonland card from it. That player discards that card. You lose 2 life."],
  ["Inquisition of Kozilek", "{B}", 1, "Sorcery", "B", "Target player reveals their hand. You choose a nonland card from it with mana value 3 or less. That player discards that card."],
  ["Fatal Push", "{B}", 1, "Instant", "B", "Destroy target creature if it has mana value 2 or less. Revolt - Destroy that creature if it has mana value 4 or less instead if a permanent you controlled left the battlefield this turn."],
  ["Path to Exile", "{W}", 1, "Instant", "W", "Exile target creature. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle."],
  ["Swords to Plowshares", "{W}", 1, "Instant", "W", "Exile target creature. Its controller gains life equal to its power."],
  ["Wrath of God", "{2}{W}{W}", 4, "Sorcery", "W", "Destroy all creatures. They can't be regenerated."],
  ["Supreme Verdict", "{1}{W}{U}{U}", 4, "Sorcery", "WU", "This spell can't be countered. Destroy all creatures."],
  ["Teferi, Time Raveler", "{1}{W}{U}", 3, "Legendary Planeswalker - Teferi", "WU", "Each opponent can cast spells only any time they could cast a sorcery. -3: Return target artifact, creature, or enchantment to its owner's hand. Draw a card."],
  ["Jace, the Mind Sculptor", "{2}{U}{U}", 4, "Legendary Planeswalker - Jace", "U", "+2: Look at the top card of target player's library. 0: Draw three cards, then put two cards from your hand on top of your library in any order."],
  ["Liliana of the Veil", "{1}{B}{B}", 3, "Legendary Planeswalker - Liliana", "B", "+1: Each player discards a card. -2: Target player sacrifices a creature. -6: Separate all permanents target player controls into two piles."],
  ["Wrenn and Six", "{R}{G}", 2, "Legendary Planeswalker - Wrenn", "RG", "+1: Return a land card from your graveyard to your hand. -1: ~ deals 1 damage to target creature."],
  ["Tarmogoyf", "{1}{G}", 2, "Creature - Lhurgoyf", "G", "~'s power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1."],
  ["Ragavan, Nimble Pilferer", "{R}", 1, "Legendary Creature - Monkey Pirate", "R", "Whenever ~ deals combat damage to a player, create a Treasure token and exile the top card of that player's library. Until end of turn, you may cast that card."],
  ["Urza's Saga", "", 0, "Enchantment Land - Urza's Saga", "", "(As this Saga enters, add a lore counter.) I, II: Create a 0/0 colorless Construct artifact creature token with 'This creature gets +1/+1 for each artifact you control.' III: Search your library for an artifact card with mana value 0 or 1."],
  ["Mishra's Bauble", "{0}", 0, "Artifact", "", "{T}, Sacrifice ~: Look at the top card of target player's library. Draw a card at the beginning of the next turn's upkeep."],
  ["Aether Vial", "{1}", 1, "Artifact", "", "At the beginning of your upkeep, you may put a charge counter on ~. {T}: You may put a creature card with mana value equal to the number of charge counters on ~ from your hand onto the battlefield."],
  ["Chalice of the Void", "{X}{X}", 0, "Artifact", "", "~ enters with X charge counters on it. Whenever a player casts a spell with mana value equal to the number of charge counters on ~, counter that spell."],
  ["Blood Moon", "{2}{R}", 3, "Enchantment", "R", "Nonbasic lands are Mountains."],
  ["Back to Basics", "{2}{U}", 3, "Enchantment", "U", "Nonbasic lands don't untap during their controllers' untap steps."],
  ["Sylvan Library", "{1}{G}", 2, "Enchantment", "G", "At the beginning of your draw step, you may draw two additional cards. If you do, choose two cards in your hand drawn this turn. For each of those cards, pay 4 life or put the card on top of your library."],
  ["Deathrite Shaman", "{B/G}", 1, "Creature - Elf Shaman", "BG", "{T}: Exile target land card from a graveyard. Add one mana of any color. {B}, {T}: Exile target instant or sorcery card from a graveyard. Each opponent loses 2 life."],
  ["Noble Hierarch", "{G}", 1, "Creature - Human Cleric", "GWU", "Exalted. {T}: Add {G}, {W}, or {U}."],
  ["Birds of Paradise", "{G}", 1, "Creature - Bird", "G", "Flying. {T}: Add one mana of any color."],
  ["Crop Rotation", "{G}", 1, "Instant", "G", "As an additional cost to cast this spell, sacrifice a land. Search your library for a land card, put that card onto the battlefield, then shuffle."],
  ["Ancient Stirrings", "{G}", 1, "Sorcery", "G", "Look at the top five cards of your library. You may reveal a colorless card from among them and put it into your hand. Put the rest on the bottom of your library in any order."],
  ["Karn Liberated", "{7}", 7, "Legendary Planeswalker - Karn", "", "+4: Target player exiles a card from their hand. -3: Exile target permanent. -14: Restart the game, leaving in exile all non-Aura permanent cards exiled with ~."],

  // --- Standard hits ---
  ["Monastery Swiftspear", "{R}", 1, "Creature - Human Monk", "R", "Haste. Prowess."],
  ["Soul-Scar Mage", "{R}", 1, "Creature - Human Wizard", "R", "Prowess. If a source you control would deal noncombat damage to a creature an opponent controls, put that many -1/-1 counters on that creature instead."],
  ["Play with Fire", "{R}", 1, "Instant", "R", "~ deals 2 damage to any target. Scry 1."],
  ["Kumano Faces Kakkazan", "{R}", 1, "Enchantment - Saga", "R", "I: ~ deals 1 damage to each opponent. II: Exile the top card of your library. III: Create a 1/1 red Goblin creature token."],
  ["Sheoldred, the Apocalypse", "{2}{B}{B}", 4, "Legendary Creature - Praetor", "B", "Deathtouch. Whenever you draw a card, you gain 2 life. Whenever an opponent draws a card, they lose 2 life."],
  ["Wedding Announcement", "{2}{W}", 3, "Enchantment", "W", "At the beginning of your end step, create a 1/1 white Human Soldier creature token, then if you control three or more creatures, transform ~."],
  ["The Wandering Emperor", "{2}{W}{W}", 4, "Legendary Planeswalker", "W", "Flash. +1: Put a +1/+1 counter on target creature. -2: Exile target tapped creature."],
  ["Sunfall", "{3}{W}{W}", 5, "Sorcery", "W", "Exile all creatures. Incubate X, where X is the number of creatures exiled this way."],
  ["Leyline Binding", "{5}{W}", 6, "Enchantment", "W", "Flash. Domain - This spell costs {1} less to cast for each basic land type among lands you control. When ~ enters, exile target nonland permanent an opponent controls until ~ leaves the battlefield."],
  ["Fable of the Mirror-Breaker", "{2}{R}", 3, "Enchantment - Saga", "R", "I: Create a 2/2 red Goblin Shaman creature token. II: Discard up to two cards, then draw that many cards. III: Exile ~, then return it to the battlefield transformed."],
  ["Invoke Despair", "{1}{B}{B}{B}{B}", 5, "Sorcery", "B", "Target opponent sacrifices a creature. If they can't, they lose 2 life and you draw a card. Repeat this process two more times for enchantments and planeswalkers."],
  ["Raffine, Scheming Seer", "{W}{U}{B}", 3, "Legendary Creature - Sphinx Demon", "WUB", "Flying, ward {1}. Whenever you attack, target attacking creature connives X, where X is the number of attacking creatures."],
  ["Sheoldred's Edict", "{1}{B}", 2, "Instant", "B", "Choose one - Each opponent sacrifices a nontoken creature; or each opponent sacrifices a planeswalker; or each opponent sacrifices a creature token."],

  // --- Commander staples ---
  ["Sol Ring", "{1}", 1, "Artifact", "", "{T}: Add {C}{C}."],
  ["Arcane Signet", "{2}", 2, "Artifact", "", "{T}: Add one mana of any color in your commander's color identity."],
  ["Command Tower", "", 0, "Land", "", "{T}: Add one mana of any color in your commander's color identity."],
  ["Rhystic Study", "{2}{U}", 3, "Enchantment", "U", "Whenever an opponent casts a spell, counter it unless that player pays {1}."],
  ["Smothering Tithe", "{3}{W}", 4, "Enchantment", "W", "Whenever an opponent draws a card, that player may pay {2}. If they don't, you create a Treasure token."],
  ["Cyclonic Rift", "{1}{U}", 2, "Instant", "U", "Return target nonland permanent you don't control to its owner's hand. Overload {6}{U}."],
  ["Swords to Plowshares ", "{W}", 1, "Instant", "W", "Exile target creature. Its controller gains life equal to its power."],
  ["Beast Within", "{2}{G}", 3, "Instant", "G", "Destroy target permanent. Its controller creates a 3/3 green Beast creature token."],
  ["Chaos Warp", "{2}{R}", 3, "Instant", "R", "The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield."],
  ["Anguished Unmaking", "{1}{W}{B}", 3, "Instant", "WB", "Exile target nonland permanent. You lose 3 life."],
  ["Assassin's Trophy", "{B}{G}", 2, "Instant", "BG", "Destroy target permanent an opponent controls. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle."],
  ["Teferi's Protection", "{2}{W}", 3, "Instant", "W", "Until your next turn, your life total can't change and you have protection from everything. All permanents you control phase out."],
  ["Mana Drain", "{U}{U}", 2, "Instant", "U", "Counter target spell. At the beginning of your next main phase, add an amount of {C} equal to that spell's mana value."],
  ["Vampiric Tutor", "{B}", 1, "Instant", "B", "Search your library for a card, then shuffle and put that card on top. You lose 2 life."],
  ["Demonic Tutor", "{1}{B}", 2, "Sorcery", "B", "Search your library for a card, put that card into your hand, then shuffle."],
  ["Mystical Tutor", "{U}", 1, "Instant", "U", "Search your library for an instant or sorcery card, reveal it, then shuffle and put that card on top."],
  ["Enlightened Tutor", "{W}", 1, "Instant", "W", "Search your library for an artifact or enchantment card, reveal it, then shuffle and put that card on top."],
  ["Worldly Tutor", "{G}", 1, "Instant", "G", "Search your library for a creature card, reveal it, then shuffle and put that card on top."],
  ["Bolas's Citadel", "{3}{B}{B}{B}", 6, "Legendary Artifact", "B", "You may look at the top card of your library any time. You may play the top card of your library. If you cast a spell this way, pay life equal to its mana value rather than pay its mana cost."],

  // --- Basic lands and duals ---
  ["Plains", "", 0, "Basic Land - Plains", "W", "({T}: Add {W}.)"],
  ["Island", "", 0, "Basic Land - Island", "U", "({T}: Add {U}.)"],
  ["Swamp", "", 0, "Basic Land - Swamp", "B", "({T}: Add {B}.)"],
  ["Mountain", "", 0, "Basic Land - Mountain", "R", "({T}: Add {R}.)"],
  ["Wastes", "", 0, "Basic Land", "", "({T}: Add {C}.)"],
  ["Scalding Tarn", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for an Island or Mountain card, put it onto the battlefield, then shuffle."],
  ["Flooded Strand", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle."],
  ["Polluted Delta", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle."],
  ["Bloodstained Mire", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for a Swamp or Mountain card, put it onto the battlefield, then shuffle."],
  ["Wooded Foothills", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for a Mountain or Forest card, put it onto the battlefield, then shuffle."],
  ["Windswept Heath", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for a Forest or Plains card, put it onto the battlefield, then shuffle."],
  ["Misty Rainforest", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for a Forest or Island card, put it onto the battlefield, then shuffle."],
  ["Verdant Catacombs", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for a Swamp or Forest card, put it onto the battlefield, then shuffle."],
  ["Arid Mesa", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for a Mountain or Plains card, put it onto the battlefield, then shuffle."],
  ["Marsh Flats", "", 0, "Land", "", "{T}, Pay 1 life, Sacrifice ~: Search your library for a Plains or Swamp card, put it onto the battlefield, then shuffle."],
  ["Hallowed Fountain", "", 0, "Land - Plains Island", "WU", "({T}: Add {W} or {U}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Watery Grave", "", 0, "Land - Island Swamp", "UB", "({T}: Add {U} or {B}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Blood Crypt", "", 0, "Land - Swamp Mountain", "BR", "({T}: Add {B} or {R}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Stomping Ground", "", 0, "Land - Mountain Forest", "RG", "({T}: Add {R} or {G}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Temple Garden", "", 0, "Land - Forest Plains", "GW", "({T}: Add {G} or {W}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Godless Shrine", "", 0, "Land - Plains Swamp", "WB", "({T}: Add {W} or {B}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Steam Vents", "", 0, "Land - Island Mountain", "UR", "({T}: Add {U} or {R}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Overgrown Tomb", "", 0, "Land - Swamp Forest", "BG", "({T}: Add {B} or {G}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Sacred Foundry", "", 0, "Land - Mountain Plains", "RW", "({T}: Add {R} or {W}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."],
  ["Breeding Pool", "", 0, "Land - Forest Island", "GU", "({T}: Add {G} or {U}.) As ~ enters, you may pay 2 life. If you don't, it enters tapped."]
];

// Index by lowercased name for O(1) lookup.
const INDEX = new Map();
for (const row of ROWS) {
  const [name, mana_cost, cmc, type_line, color_identity, oracle_text] = row;
  INDEX.set(name.toLowerCase(), {
    name,
    mana_cost: mana_cost || "",
    cmc: typeof cmc === "number" ? cmc : 0,
    type_line: type_line || "",
    color_identity: color_identity ? color_identity.split("") : [],
    oracle_text: oracle_text || "",
    rarity: "",
    set: "local",
    set_name: "Local DB",
    image_normal: "",
    image_small: "",
    scryfall_uri: "",
    layout: "normal"
  });
}

/**
 * Look up a card by name. Returns normalized card or null.
 */
export function findLocal(name) {
  if (!name) return null;
  return INDEX.get(String(name).trim().toLowerCase()) || null;
}

/**
 * Return all card names in the DB (for debug / coverage info).
 */
export function listLocalNames() {
  return Array.from(INDEX.values()).map((c) => c.name);
}

export function localDbSize() {
  return INDEX.size;
}