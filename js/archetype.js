// Deck archetype identification from a parsed + enriched decklist.
//
// Three tiers, applied in priority order:
//   1. Signature card match (highest confidence)
//   2. Tribal / theme detection (based on creature subtype dominance)
//   3. Color identity + archetype heuristic (fallback)
//
// Exports: identifyDeck(enriched, opts) -> string

// --- Tier 1: Signature cards -----------------------------------------------
// Keyed by lowercased card name. Value is the suggested deck name.
// If multiple signature cards are present, the one appearing at the highest
// copy count (in main or side) wins.
const SIGNATURE_CARDS = {
  // Combo / specific archetypes
  "splinter twin": "Splinter Twin",
  "through the breach": "Through the Breach",
  "living end": "Living End",
  "amulet of vigor": "Amulet Titan",
  "goblin charbelcher": "Belcher",
  "painter's servant": "Painter",
  "ad nauseam": "Ad Nauseam",
  "doomsday": "Doomsday",
  "sneak attack": "Sneak and Show",
  "show and tell": "Sneak and Show",
  "reanimate": "Reanimator",
  "animate dead": "Reanimator",
  "entomb": "Reanimator",
  "exhume": "Reanimator",
  "tendrils of agony": "Storm",
  "grapeshot": "Storm",
  "empty the warrens": "Storm",
  "past in flames": "Storm",
  "paradox engine": "Paradox Storm",
  "sun titan": "Sun Titan",
  "gifts ungiven": "Gifts Storm",

  // Pauper signature cards
  "kuldotha rebirth": "Kuldotha Red",
  "tolarian terror": "Mono-Blue Terror",
  "serpentine curve": "Izzet Curve",
  "galvanic blast": "Affinity",
  "thoughtcast": "Affinity",
  "myr enforcer": "Affinity",
  "atog": "Affinity",
  "cranial plating": "Affinity",
  "bogles": "Bogles",
  "slippery bogle": "Bogles",
  "gladecover scout": "Bogles",
  "silhana ledgewalker": "Bogles",
  "kiln fiend": "Kiln Fiend",
  "nivix cyclops": "Kiln Fiend",
  "immolating souleater": "Kiln Fiend",
  "tireless tribe": "Tireless Tribe",
  "inside out": "Tireless Tribe",
  "archers of the queen": "Midnight Gond",
  "midnight guard": "Midnight Gond",
  "presence of gond": "Midnight Gond",
  "caw-blade": "Caw-Blade",
  "squadron hawk": "Caw-Gates",
  "basilisk gate": "Caw-Gates",
  "journey to nowhere": "Caw-Gates",
  "ephemerate": "Ephemerate",
  "mulldrifter": "Ephemerate",
  "familiar's ruse": "Familiars",
  "sunscape familiar": "Familiars",
  "snap": "Familiars",
  "gray merchant of asphodel": "Mono-Black Devotion",
  "chittering rats": "Mono-Black Control",
  "crypt rats": "Mono-Black Control",
  "pestilence": "Mono-Black Control",
  "cycle storm": "Cycle Storm",
  "song of the damned": "Cycle Storm",
  "drannith healer": "Cycle Storm",
  "first day of class": "Golgari Gardens",
  "golgari rot farm": "Golgari Gardens",

  // Modern / Legacy hits
  "tarmogoyf": "Jund",
  "liliana of the veil": "Jund",
  "wrenn and six": "Jund Saga",
  "urza's saga": "Urza's Saga",
  "ragavan, nimble pilferer": "Murktide",
  "murktide regent": "Murktide",
  "dragon's rage channeler": "Murktide",
  "primeval titan": "Amulet Titan",
  "dryad of the ilysian grove": "Amulet Titan",
  "valakut, the molten pinnacle": "Scapeshift",
  "scapeshift": "Scapeshift",
  "death's shadow": "Death's Shadow",
  "grief": "Scam",
  "fury": "Scam",
  "solitude": "Scam",
  "the one ring": "Mono-Black Coffers",
  "cabal coffers": "Mono-Black Coffers",
  "aether vial": "Death and Taxes",
  "stoneforge mystic": "Death and Taxes",
  "thalia, guardian of thraben": "Death and Taxes",
  "craterhoof behemoth": "Elves",
  "natural order": "Elves",
  "glimpse of nature": "Elves",
  "heritage druid": "Elves",
  "wirewood symbiote": "Elves",
  "tendrils of agony ": "ANT",
  "lion's eye diamond": "ANT",
  "dark ritual": "ANT",
  "cabal ritual": "ANT"
};

// --- Tier 2: Creature subtype -> deck name --------------------------------
// Subtype strings from type lines, e.g. "Creature - Elf Druid" -> "Elf".
const TRIBE_NAMES = {
  "elf": "Elves",
  "goblin": "Goblins",
  "merfolk": "Merfolk",
  "zombie": "Zombies",
  "vampire": "Vampires",
  "soldier": "Soldiers",
  "wizard": "Wizards",
  "human": "Humans",
  "faerie": "Faeries",
  "spirit": "Spirits",
  "dragon": "Dragons",
  "angel": "Angels",
  "sliver": "Slivers",
  "elemental": "Elementals",
  "beast": "Beasts",
  "treefolk": "Treefolk",
  "giant": "Giants",
  "knight": "Knights",
  "warrior": "Warriors",
  "rogue": "Rogues",
  "cleric": "Clerics",
  "druid": "Druids",
  "shaman": "Shamans",
  "cat": "Cats",
  "dinosaur": "Dinosaurs",
  "pirate": "Pirates",
  "ninja": "Ninjas",
  "samurai": "Samurai",
  "rat": "Rats",
  "snake": "Snakes",
  "sphinx": "Sphinxes",
  "hydra": "Hydras",
  "plant": "Plants",
  "fungus": "Fungi",
  "scarecrow": "Scarecrows",
  "construct": "Constructs",
  "golem": "Golems",
  "horror": "Horrors",
  "eldrazi": "Eldrazi",
  "phyrexian": "Phyrexians"
};

// --- Tier 3: Color + archetype heuristics ---------------------------------
const COLOR_LABEL = {
  "": "Colorless",
  "W": "Mono-White",
  "U": "Mono-Blue",
  "B": "Mono-Black",
  "R": "Mono-Red",
  "G": "Mono-Green",
  "WU": "Azorius",
  "WB": "Orzhov",
  "WR": "Boros",
  "WG": "Selesnya",
  "UB": "Dimir",
  "UR": "Izzet",
  "UG": "Simic",
  "BR": "Rakdos",
  "BG": "Golgari",
  "RG": "Gruul",
  "WUB": "Esper",
  "WUR": "Jeskai",
  "WUG": "Bant",
  "WBR": "Mardu",
  "WBG": "Abzan",
  "WRG": "Naya",
  "UBR": "Grixis",
  "UBG": "Sultai",
  "URG": "Temur",
  "BRG": "Jund",
  "WUBR": "Four-Color",
  "WUBG": "Four-Color",
  "WURG": "Four-Color",
  "WBRG": "Four-Color",
  "UBRG": "Four-Color",
  "WUBRG": "Five-Color"
};

// --- Helpers ---------------------------------------------------------------

function normalizeName(name) {
  return (name || "").trim().toLowerCase();
}

/**
 * Sum counts of a given card across the whole deck (main + side).
 */
function totalCopies(enriched, cardName) {
  const target = normalizeName(cardName);
  let total = 0;
  const visit = (list) => {
    for (const e of list || []) {
      if (normalizeName(e.name) === target) total += e.count;
    }
  };
  visit(enriched.mainboard);
  visit(enriched.sideboard);
  return total;
}

/**
 * Walk creature type lines and count subtypes.
 * Returns a Map<lowercasedSubtype, totalCopies>.
 */
function creatureSubtypeCounts(enriched) {
  const counts = new Map();
  let creatureTotal = 0;
  for (const e of enriched.mainboard || []) {
    if (!e.card) continue;
    const tl = e.card.type_line || "";
    if (!/creature/i.test(tl)) continue;
    creatureTotal += e.count;
    const subtypePart = tl.split(/\u2014|\u2013|--| - /).slice(1).join(" ").trim();
    if (!subtypePart) continue;
    for (const rawSub of subtypePart.split(/\s+/)) {
      const sub = rawSub.toLowerCase();
      if (!sub) continue;
      counts.set(sub, (counts.get(sub) || 0) + e.count);
    }
  }
  return { counts, creatureTotal };
}

/**
 * Tier 3: color identity + archetype heuristic.
 */
function colorAndArchetype(enriched) {
  const stats = enriched.stats || {};
  const colors = (stats.colors || []).slice().sort().join("");
  const colorName = COLOR_LABEL[colors] || "Colorless";

  // Count relevant card categories in maindeck.
  let creatures = 0;
  let counterspells = 0;
  let burnSpells = 0;
  let discardSpells = 0;
  let removalSpells = 0;

  for (const e of enriched.mainboard || []) {
    if (!e.card) continue;
    const tl = e.card.type_line || "";
    const ot = e.card.oracle_text || "";
    if (/creature/i.test(tl)) creatures += e.count;
    if (/counter target/i.test(ot)) counterspells += e.count;
    if (/deals \d+ damage to (any target|target creature|target player)/i.test(ot) && /instant|sorcery/i.test(tl)) {
      burnSpells += e.count;
    }
    if (/target (player|opponent) discards|target opponent reveals/i.test(ot)) discardSpells += e.count;
    if (/destroy target|exile target/i.test(ot) && /instant|sorcery/i.test(tl)) removalSpells += e.count;
  }

  let archetype = "";
  if (creatures <= 6 && (counterspells >= 4 || removalSpells >= 6)) archetype = "Control";
  else if (burnSpells >= 8 && creatures <= 10) archetype = "Burn";
  else if (creatures >= 22) archetype = "Aggro";
  else if (creatures <= 16 && creatures >= 8) archetype = "Midrange";
  else if (counterspells >= 4) archetype = "Tempo";
  else archetype = "";

  return [colorName, archetype].filter(Boolean).join(" ");
}

// --- Main ------------------------------------------------------------------

/**
 * Identify a deck from its enriched form.
 * Returns a short human-friendly name like "Pauper Elves" or "Mono-Red Burn".
 */
export function identifyDeck(enriched) {
  if (!enriched) return "Untitled Deck";

  // --- Tier 1: signature cards ---
  // Prefer the signature card with the highest copy count.
  let best = null;
  for (const [cardName, deckName] of Object.entries(SIGNATURE_CARDS)) {
    const n = totalCopies(enriched, cardName);
    if (n <= 0) continue;
    if (!best || n > best.count) best = { deckName, count: n, cardName };
  }
  if (best) return best.deckName;

  // --- Tier 2: tribe detection ---
  const { counts, creatureTotal } = creatureSubtypeCounts(enriched);
  if (creatureTotal >= 12) {
    let topSub = null;
    let topCount = 0;
    for (const [sub, n] of counts.entries()) {
      if (n > topCount) { topSub = sub; topCount = n; }
    }
    if (topSub && topCount / creatureTotal >= 0.3) {
      const tribe = TRIBE_NAMES[topSub] || null;
      if (tribe) {
        const stats = enriched.stats || {};
        const colors = (stats.colors || []).slice().sort().join("");
        const colorName = COLOR_LABEL[colors] || "";
        // e.g. "Mono-Green Elves" / "Azorius Spirits"
        return [colorName, tribe].filter(Boolean).join(" ");
      }
    }
  }

  // --- Tier 3: color + archetype heuristic ---
  const fallback = colorAndArchetype(enriched);
  return fallback || "Untitled Deck";
}

export const SIGNATURE_CARD_COUNT = Object.keys(SIGNATURE_CARDS).length;