// A complete, finished guide used by the "Load example guide" button on
// the empty Build screen. It is in the same shape onImportShare consumes
// (see js/persistence.js buildSharePayload), so loading it routes through
// the normal load path: decklist parsed and enriched, matchups set, plan
// filled, printed cards rendered. One click shows a visitor the payoff
// they'd be building.
//
// Based on the bundled Mono Red Madness (Pauper) guide so the demo
// matches what Browse shows. Update this file if that guide changes.

export const EXAMPLE_GUIDE = {
  format: "mtg-sideboard-guide",
  version: 1,
  generator: "Sideboard Guide Builder",
  createdAt: "2026-09-25T00:00:00.000Z",
  deck: {
    name: "Mono Red Madness",
    format: "Pauper",
    archetype: "Mono Red Madness",
    rawText: [
      "3 Faithless Looting",
      "4 Fiery Temper",
      "3 Fireblast",
      "4 Grab the Prize",
      "3 Guttersnipe",
      "4 Highway Robbery",
      "4 Kessig Flamebreather",
      "4 Lava Dart",
      "4 Lightning Bolt",
      "18 Mountain",
      "1 Sazacap's Brew",
      "4 Sneaky Snacker",
      "4 Voldaren Epicure",
      "",
      "3 Cleansing Wildfire",
      "1 Crimson Fleet Commodore",
      "4 Pyroblast",
      "1 Red Elemental Blast",
      "1 Sazacap's Brew",
      "3 Searing Blaze",
      "2 Tectonic Hazard"
    ].join("\n")
  },
  matchups: ["Mono U Faeries", "Tron", "Dimir Control"],
  // Section-aware plan keys (name@main / name@side), matching store.js.
  plan: {
    "Fireblast@main": {
      "Mono U Faeries": { dir: "out", count: 3 },
      "Tron": { dir: "out", count: 3 },
      "Dimir Control": { dir: "out", count: 3 }
    },
    "Grab the Prize@main": {
      "Mono U Faeries": { dir: "out", count: 1 }
    },
    "Lava Dart@main": {
      "Dimir Control": { dir: "out", count: 2 }
    },
    "Sazacap's Brew@main": {
      "Dimir Control": { dir: "out", count: 1 }
    },
    "Pyroblast@side": {
      "Mono U Faeries": { dir: "in", count: 4 },
      "Dimir Control": { dir: "in", count: 4 }
    },
    "Cleansing Wildfire@side": {
      "Tron": { dir: "in", count: 3 }
    },
    "Red Elemental Blast@side": {
      "Dimir Control": { dir: "in", count: 1 }
    },
    "Crimson Fleet Commodore@side": {
      "Dimir Control": { dir: "in", count: 1 }
    }
  },
  titleCard: {
    color: "#8a2a1a",
    fontKey: "cinzel",
    symbol: "auto",
    texture: "none",
    intensity: "medium"
  }
};