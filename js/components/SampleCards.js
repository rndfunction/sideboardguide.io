// SampleCards: shows the three real printable cards with a Mono Red
// Madness (Pauper) sample. Uses the actual PrintTitleCard / PrintListCard
// / PrintCard components so it can never drift from production output.

import PrintTitleCard from "./PrintTitleCard.js";
import PrintListCard from "./PrintListCard.js";
import PrintCard from "./PrintCard.js";

const SampleCards = {
  components: { PrintTitleCard, PrintListCard, PrintCard },
  data() {
    return {
      deckName: "Mono Red Madness",
      format: "Pauper",
      colors: ["R"],
      fontKey: "cinzel",
      titleColor: "#8a2a1a",

      mainboard: [
        { count: 3, name: "Faithless Looting" },
        { count: 4, name: "Fiery Temper" },
        { count: 3, name: "Fireblast" },
        { count: 4, name: "Grab the Prize" },
        { count: 3, name: "Guttersnipe" },
        { count: 4, name: "Highway Robbery" },
        { count: 4, name: "Kessig Flamebreather" },
        { count: 4, name: "Lava Dart" },
        { count: 4, name: "Lightning Bolt" },
        { count: 18, name: "Mountain" },
        { count: 1, name: "Sazacap's Brew" },
        { count: 4, name: "Sneaky Snacker" },
        { count: 4, name: "Voldaren Epicure" }
      ],
      sideboard: [
        { count: 3, name: "Cleansing Wildfire" },
        { count: 1, name: "Crimson Fleet Commodore" },
        { count: 4, name: "Pyroblast" },
        { count: 1, name: "Red Elemental Blast" },
        { count: 1, name: "Sazacap's Brew" },
        { count: 3, name: "Searing Blaze" },
        { count: 2, name: "Tectonic Hazard" }
      ],
      matchups: ["Mono U Faeries", "Tron", "Dimir Control"],
      // Each matchup's IN total equals its OUT total.
      //   Mono U Faeries: OUT 4 (Fireblast 3, Grab the Prize 1) = IN 4 (Pyroblast 4)
      //   Tron:           OUT 3 (Fireblast 3) = IN 3 (Cleansing Wildfire 3)
      //   Dimir Control:  OUT 6 (Lava Dart 2, Fireblast 3, Sazacap's Brew 1)
      //                   = IN 6 (Pyroblast 4, Red Elemental Blast 1, Crimson Fleet Commodore 1)
      plan: {
        "Mono U Faeries": {
          "Fireblast": { dir: "out", count: 3 },
          "Grab the Prize": { dir: "out", count: 1 },
          "Pyroblast": { dir: "in", count: 4 }
        },
        "Tron": {
          "Fireblast": { dir: "out", count: 3 },
          "Cleansing Wildfire": { dir: "in", count: 3 }
        },
        "Dimir Control": {
          "Lava Dart": { dir: "out", count: 2 },
          "Fireblast": { dir: "out", count: 3 },
          "Sazacap's Brew": { dir: "out", count: 1 },
          "Pyroblast": { dir: "in", count: 4 },
          "Red Elemental Blast": { dir: "in", count: 1 },
          "Crimson Fleet Commodore": { dir: "in", count: 1 }
        }
      }
    };
  },
  computed: {
    listSections() {
      return [
        { title: "Maindeck", total: this.mainboard.reduce((a, r) => a + r.count, 0), rows: this.mainboard },
        { title: "Sideboard", total: this.sideboard.reduce((a, r) => a + r.count, 0), rows: this.sideboard }
      ];
    },
    guideRows() {
      const build = (list, isSide) => {
        const byName = new Map();
        for (const e of list) {
          if (!byName.has(e.name)) byName.set(e.name, { name: e.name, count: 0, isSide });
          byName.get(e.name).count += e.count;
        }
        return Array.from(byName.values());
      };

      const mainRows = build(this.mainboard, false);
      const sideRows = build(this.sideboard, true);

      const attach = (rows) => rows.map((r) => {
        const planByMatchup = {};
        let hasAnyPlan = false;
        for (const mu of this.matchups) {
          const entry = (this.plan[mu] && this.plan[mu][r.name]) || null;
          planByMatchup[mu] = entry;
          if (entry) hasAnyPlan = true;
        }
        return { ...r, planByMatchup, hasAnyPlan };
      });

      const mainWith = attach(mainRows);
      const sideWith = attach(sideRows);

      const plannedMain = mainWith.filter((r) => r.hasAnyPlan);
      const plannedSide = sideWith.filter((r) => r.hasAnyPlan);

      const combined = [...plannedMain, ...plannedSide];
      for (const r of combined) r.firstSide = false;
      const firstSide = combined.find((r) => r.isSide);
      if (firstSide) firstSide.firstSide = true;
      return combined;
    }
  },
  template: `
    <div class="sample-cards" aria-hidden="true">
      <p class="sample-cards-caption">You'll get three printable sleeve-sized cards:</p>

      <div class="sample-cards-row">
        <div class="sample-mini-wrap">
          <print-title-card
            :deck-name="deckName"
            :colors="colors"
            :font-key="fontKey"
            :bg-color="titleColor"
          ></print-title-card>
        </div>

        <div class="sample-mini-wrap">
          <print-list-card
            :deck-name="deckName"
            :format="format"
            :colors="colors"
            :sections="listSections"
          ></print-list-card>
        </div>

        <div class="sample-mini-wrap">
          <print-card
            :deck-name="deckName"
            :format="format"
            :colors="colors"
            :rows="guideRows"
            :matchups="matchups"
          ></print-card>
        </div>
      </div>
    </div>
  `
};

export default SampleCards;