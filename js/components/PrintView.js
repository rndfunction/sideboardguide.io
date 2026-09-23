// PrintView: orchestrates the 3in x 4in printable cards.
//
// Prints, in order:
//   1. Optional title card (decorative cover, user-customized).
//   2. Optional Maindeck/Sideboard inventory card(s).
//   3. One matchup-guide card per 4 matchups.
//
// The title card supports a user-chosen background color and font, persisted
// in localStorage under mtg-deck-guide:title-card-prefs.

import PrintCard from "./PrintCard.js";
import PrintListCard from "./PrintListCard.js";
import PrintTitleCard from "./PrintTitleCard.js";
import { identifyDeck } from "../archetype.js";
import {
  defaultColorForDeck,
  defaultFontKey,
  FONT_OPTIONS,
  loadPrefs,
  savePrefs
} from "../titlecard.js";

const MATCHUPS_PER_CARD = 4;
const COMBINED_ROW_CAP = 50;

const PrintView = {
  props: {
    deck: { type: Object, required: true },
    deckName: { type: String, default: "" },
    format: { type: String, default: "" },
    matchups: { type: Array, default: () => [] },
    plan: { type: Object, default: () => ({}) },
    printMode: { type: Boolean, default: false }
  },
  emits: ["close"],
  data() {
    // Only the decorative prefs (color + font) persist across sessions.
    // Toggles always start true so the preview shows everything by default;
    // the user hides things from there if they want.
    const prefs = loadPrefs() || {};
    return {
      includeDecklist: true,
      includeSideboard: true,
      includeTitleCard: true,
      titleColor: prefs.titleColor || null, // resolved to default on mount
      titleFontKey: prefs.titleFontKey || defaultFontKey()
    };
  },
  mounted() {
    // Resolve the default title color once we know the deck's colors.
    if (!this.titleColor) {
      this.titleColor = defaultColorForDeck(this.deck);
    }
  },
  watch: {
    titleColor() { this.persistPrefs(); },
    titleFontKey() { this.persistPrefs(); }
  },
  computed: {
    colors() {
      return (this.deck && this.deck.stats && this.deck.stats.colors) || [];
    },
    fontOptions() {
      return FONT_OPTIONS;
    },
    autoSubtitle() {
      // Subtitle on the title card: the archetype name IF it differs from
      // the current deck name. If the user hasn't renamed, this is blank
      // to avoid redundancy.
      if (!this.deck) return "";
      const arch = identifyDeck(this.deck);
      if (!arch) return "";
      if (arch === this.deckName) return "";
      return arch;
    },
    pages() {
      const mus = this.matchups || [];
      if (!mus.length) return [];
      const pages = [];
      for (let i = 0; i < mus.length; i += MATCHUPS_PER_CARD) {
        const pageMatchups = mus.slice(i, i + MATCHUPS_PER_CARD);
        pages.push({
          matchups: pageMatchups,
          rows: this.buildRows(pageMatchups)
        });
      }
      return pages;
    },
    decklistRows() {
      if (!this.deck) return [];
      return this.inventoryRows(this.deck.mainboard || []);
    },
    sideboardRows() {
      if (!this.deck) return [];
      return this.inventoryRows(this.deck.sideboard || []);
    },
    decklistTotal() {
      return this.decklistRows.reduce((a, r) => a + r.count, 0);
    },
    sideboardTotal() {
      return this.sideboardRows.reduce((a, r) => a + r.count, 0);
    },
    guideCardCount() {
      return this.pages.length;
    },
    inventoryCardCount() {
      return this.inventoryCards.length;
    },
    titleCardCount() {
      return this.includeTitleCard ? 1 : 0;
    },
    totalCards() {
      return this.titleCardCount + this.inventoryCardCount + this.guideCardCount;
    },
    inventoryCards() {
      const wantMain = this.includeDecklist && this.decklistRows.length > 0;
      const wantSide = this.includeSideboard && this.sideboardRows.length > 0;
      const cards = [];

      if (wantMain && wantSide) {
        const combinedRows = this.decklistRows.length + this.sideboardRows.length;
        if (combinedRows <= COMBINED_ROW_CAP) {
          cards.push({
            sections: [
              { title: "Maindeck", total: this.decklistTotal, rows: this.decklistRows },
              { title: "Sideboard", total: this.sideboardTotal, rows: this.sideboardRows }
            ]
          });
          return cards;
        }
      }

      if (wantMain) {
        cards.push({
          sections: [
            { title: "Maindeck", total: this.decklistTotal, rows: this.decklistRows }
          ]
        });
      }
      if (wantSide) {
        cards.push({
          sections: [
            { title: "Sideboard", total: this.sideboardTotal, rows: this.sideboardRows }
          ]
        });
      }
      return cards;
    }
  },
  methods: {
    persistPrefs() {
      savePrefs({
        titleColor: this.titleColor,
        titleFontKey: this.titleFontKey
      });
    },
    /**
     * Build a flat, deduped, type-then-CMC sorted row list for an inventory card.
     */
    inventoryRows(list) {
      const byName = new Map();
      for (const e of list) {
        if (!byName.has(e.name)) {
          byName.set(e.name, {
            name: e.name,
            count: 0,
            cmc: e.card ? e.card.cmc : 0,
            type: (e.card && e.card.type_line) || ""
          });
        }
        byName.get(e.name).count += e.count;
      }
      const rows = Array.from(byName.values());
      const bucketOf = (t) => {
        const s = (t || "").toLowerCase();
        if (s.includes("land")) return "Land";
        if (s.includes("creature")) return "Creature";
        if (s.includes("planeswalker")) return "Planeswalker";
        if (s.includes("instant")) return "Instant";
        if (s.includes("sorcery")) return "Sorcery";
        if (s.includes("enchantment")) return "Enchantment";
        if (s.includes("artifact")) return "Artifact";
        return "Other";
      };
      const order = ["Creature", "Planeswalker", "Instant", "Sorcery", "Enchantment", "Artifact", "Land", "Other"];
      rows.sort((a, b) => {
        const ba = order.indexOf(bucketOf(a.type));
        const bb = order.indexOf(bucketOf(b.type));
        if (ba !== bb) return ba - bb;
        if (a.cmc !== b.cmc) return a.cmc - b.cmc;
        return a.name.localeCompare(b.name);
      });
      return rows;
    },
    buildRows(pageMatchups) {
      if (!this.deck) return [];
      const mainRows = this.rowsFor(this.deck.mainboard || [], pageMatchups, false);
      const sideRows = this.rowsFor(this.deck.sideboard || [], pageMatchups, true);
      if (sideRows.length) sideRows[0].firstSide = true;

      const plannedMain = mainRows.filter((r) => r.hasAnyPlan);
      const plannedSide = sideRows.filter((r) => r.hasAnyPlan);

      const useMain = plannedMain.length || plannedSide.length ? plannedMain : mainRows;
      const useSide = plannedMain.length || plannedSide.length ? plannedSide : sideRows;

      const combined = [...useMain, ...useSide];
      for (const r of combined) r.firstSide = false;
      const firstSideRow = combined.find((r) => r.isSide);
      if (firstSideRow) firstSideRow.firstSide = true;
      return combined;
    },
    rowsFor(list, pageMatchups, isSide) {
      const byName = new Map();
      for (const e of list) {
        if (!byName.has(e.name)) {
          byName.set(e.name, { name: e.name, count: 0, isSide });
        }
        byName.get(e.name).count += e.count;
      }
      const rows = Array.from(byName.values());
      for (const r of rows) {
        r.planByMatchup = {};
        r.hasAnyPlan = false;
        for (const mu of pageMatchups) {
          const entry = this.entryFor(r.name, mu);
          r.planByMatchup[mu] = entry;
          if (entry) r.hasAnyPlan = true;
        }
      }
      return rows;
    },
    entryFor(cardName, matchup) {
      const cardPlan = this.plan[cardName];
      if (!cardPlan) return null;
      const entry = cardPlan[matchup];
      if (!entry) return null;
      if (typeof entry === "string") return { dir: entry, count: 0 };
      return entry;
    },
    onPrint() {
      window.print();
    },
    resetTitleColor() {
      this.titleColor = defaultColorForDeck(this.deck);
    }
  },
  components: { PrintCard, PrintListCard, PrintTitleCard },
  template: `
    <section class="print-view" :class="{ 'print-view-printmode': printMode }">
      <div v-if="!printMode" class="print-view-controls">
        <div class="print-view-controls-row">
          <strong>Print cards</strong>
          <span class="print-summary">
            {{ totalCards }} card{{ totalCards === 1 ? '' : 's' }} &middot;
            {{ guideCardCount }} matchup-guide card{{ guideCardCount === 1 ? '' : 's' }}
          </span>
          <button type="button" class="usa-button" @click="onPrint">Print</button>
          <button type="button" class="usa-button usa-button--outline" @click="$emit('close')">Close</button>
        </div>

        <div class="print-view-controls-row">
          <span class="print-include-label">Include:</span>
          <label
            class="print-chip"
            :class="{ 'print-chip-on': includeTitleCard }"
          >
            <input type="checkbox" v-model="includeTitleCard" />
            <span class="print-chip-label">Title</span>
          </label>
          <label
            class="print-chip"
            :class="{ 'print-chip-on': includeDecklist, 'print-chip-disabled': !decklistRows.length }"
          >
            <input type="checkbox" v-model="includeDecklist" :disabled="!decklistRows.length" />
            <span class="print-chip-label">Decklist</span>
            <span class="print-chip-count" v-if="decklistRows.length">({{ decklistTotal }})</span>
            <span class="print-chip-count" v-else>(empty)</span>
          </label>
          <label
            class="print-chip"
            :class="{ 'print-chip-on': includeSideboard, 'print-chip-disabled': !sideboardRows.length }"
          >
            <input type="checkbox" v-model="includeSideboard" :disabled="!sideboardRows.length" />
            <span class="print-chip-label">Sideboard</span>
            <span class="print-chip-count" v-if="sideboardRows.length">({{ sideboardTotal }})</span>
            <span class="print-chip-count" v-else>(empty)</span>
          </label>
          <span class="print-tip">
            Tip: in the print dialog choose "Actual size" (not "Fit to page") so 3&times;4in is preserved.
          </span>
        </div>

        <div v-if="includeTitleCard" class="print-view-controls-row title-card-controls">
          <span class="print-include-label">Title card:</span>
          <label class="title-control">
            <span class="title-control-label">Color</span>
            <input type="color" v-model="titleColor" />
          </label>
          <button type="button" class="title-reset-btn" @click="resetTitleColor" title="Reset to auto-derived color">
            Auto
          </button>
          <label class="title-control">
            <span class="title-control-label">Font</span>
            <select v-model="titleFontKey">
              <option v-for="f in fontOptions" :key="f.key" :value="f.key">{{ f.label }}</option>
            </select>
          </label>
        </div>
      </div>

      <div v-if="!pages.length && !inventoryCardCount && !includeTitleCard" class="empty-state">
        Nothing to print. Enable at least one card above.
      </div>

      <div v-else class="print-cards-grid">
        <print-title-card
          v-if="includeTitleCard"
          :deck-name="deckName || 'Untitled Deck'"
          :subtitle="autoSubtitle"
          :colors="colors"
          :font-key="titleFontKey"
          :bg-color="titleColor || '#3a3a4a'"
        ></print-title-card>

        <print-list-card
          v-for="(inv, idx) in inventoryCards"
          :key="'inv-' + idx"
          :deck-name="deckName || 'Untitled Deck'"
          :format="format"
          :colors="colors"
          :sections="inv.sections"
        ></print-list-card>

        <print-card
          v-for="(page, idx) in pages"
          :key="'pg-' + idx"
          :deck-name="deckName || 'Untitled Deck'"
          :format="format"
          :colors="colors"
          :rows="page.rows"
          :matchups="page.matchups"
        ></print-card>
      </div>
    </section>
  `
};

export default PrintView;