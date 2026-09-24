// SampleCards: shows the three real printable cards with a hardcoded
// Burn-style sample. Uses the actual PrintTitleCard / PrintListCard /
// PrintCard components so it can never drift from production output.
//
// The sideboard plan honors the real rule: cards IN must equal cards OUT
// for every matchup, since you can't add more than you remove without
// going over 60.

import PrintTitleCard from "./PrintTitleCard.js";
import PrintListCard from "./PrintListCard.js";
import PrintCard from "./PrintCard.js";

const SampleCards = {
  components: { PrintTitleCard, PrintListCard, PrintCard },
  data() {
    return {
      deckName: "Mono-Red Burn",
      format: "Modern",
      colors: ["R"],
      fontKey: "cinzel",
      titleColor: "#8a2a1a",

      mainboard: [
        { count: 4, name: "Monastery Swiftspear" },
        { count: 4, name: "Soul-Scar Mage" },
        { count: 4, name: "Lightning Bolt" },
        { count: 4, name: "Lava Spike" },
        { count: 4, name: "Rift Bolt" },
        { count: 4, name: "Skewer the Critics" },
        { count: 4, name: "Eidolon of the Great Revel" },
        { count: 4, name: "Searing Blaze" },
        { count: 4, name: "Mountain" },
        { count: 4, name: "Arid Mesa" },
        { count: 4, name: "Scalding Tarn" },
        { count: 4, name: "Ramunap Ruins" },
        { count: 4, name: "Fiery Islet" },
        { count: 8, name: "Snow-Covered Mountain" }
      ],
      sideboard: [
        { count: 4, name: "Roiling Vortex" },
        { count: 3, name: "Skullcrack" },
        { count: 3, name: "Blood Moon" },
        { count: 3, name: "Anger of the Gods" },
        { count: 2, name: "Deflecting Palm" }
      ],
      matchups: ["Murktide", "Amulet Titan", "Rhinos"],
      // Each matchup's IN total equals its OUT total.
      //   Murktide:     OUT 5 (Blaze 3, Skewer 2) = IN 5 (Vortex 3, Moon 2)
      //   Amulet Titan: OUT 6 (Swiftspear 4, Blaze 2) = IN 6 (Moon 3, Palm 3)
      //   Rhinos:       OUT 4 (Eidolon 3, Blaze 1) = IN 4 (Anger 3, Skullcrack 1)
      plan: {
        "Murktide": {
          "Searing Blaze": { dir: "out", count: 3 },
          "Skewer the Critics": { dir: "out", count: 2 },
          "Roiling Vortex": { dir: "in", count: 3 },
          "Blood Moon": { dir: "in", count: 2 }
        },
        "Amulet Titan": {
          "Monastery Swiftspear": { dir: "out", count: 4 },
          "Searing Blaze": { dir: "out", count: 2 },
          "Blood Moon": { dir: "in", count: 3 },
          "Deflecting Palm": { dir: "in", count: 3 }
        },
        "Rhinos": {
          "Eidolon of the Great Revel": { dir: "out", count: 3 },
          "Searing Blaze": { dir: "out", count: 1 },
          "Anger of the Gods": { dir: "in", count: 3 },
          "Skullcrack": { dir: "in", count: 1 }
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
    /**
     * Build the row set PrintCard expects: main then side, with planByMatchup
     * keyed by matchup. Only include rows that have at least one plan so the
     * sample shows realistic filtering.
     */
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