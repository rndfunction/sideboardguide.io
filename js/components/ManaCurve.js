// ManaCurve: a small bar chart of the deck's mana curve, with an overlay
// showing how the curve changes after sideboarding for the active
// matchup. "Before" is the maindeck curve; "after" adds the cards boarded
// in and removes the cards boarded out for the currently-selected
// matchup.
//
// The after-curve is a real boon to planning: it shows whether you become
// a lower- or higher-curve deck once you board, not just what the deck is.
//
// Props come from the app; activeMatchup is read from the shared store so
// this stays in sync with the deck grid's selected tab.

import { store } from "../store.js";

const BUCKET_LABELS = ["0", "1", "2", "3", "4", "5", "6", "7+"];

const ManaCurve = {
  props: {
    // The enriched deck (has stats.curve and the card metadata).
    deck: { type: Object, required: true },
    // The plan object (section-aware keys -> matchup -> { dir, count }).
    plan: { type: Object, default: () => ({}) }
  },
  computed: {
    activeMatchup() {
      // Defensive: works even if the store field is absent.
      return (store && store.activeMatchup) || null;
    },
    /**
     * The maindeck mana curve: counts per CMC bucket (0..7+), non-land.
     * Copied from deck.stats.curve so this is pure and reactive.
     */
    beforeCurve() {
      const c = this.deck && this.deck.stats && this.deck.stats.curve;
      return Array.isArray(c) ? c.slice() : [0, 0, 0, 0, 0, 0, 0, 0];
    },
    /**
     * The curve after sideboarding for the active matchup: start from the
     * before-curve, subtract boarded-out cards, add boarded-in cards.
     * Lands are excluded (the before-curve excludes them, and we skip any
     * card whose type line is a land).
     */
    afterCurve() {
      const after = this.beforeCurve.slice();
      const matchup = this.activeMatchup;
      if (!matchup || !this.plan) return after;

      // Index the deck's cards by section-aware key for CMC + land lookup.
      const mainCards = this.deck.mainboard || [];
      const sideCards = this.deck.sideboard || [];
      const cmcOf = new Map();
      const isLand = new Map();
      const index = (list, section) => {
        for (const e of list) {
          const key = e.name + "@" + section;
          if (!cmcOf.has(key)) {
            cmcOf.set(key, e.card ? Math.min(7, Math.max(0, Math.round(e.card.cmc || 0))) : 0);
            isLand.set(key, /(^|\s)land(\s|$)/i.test((e.card && e.card.type_line) || ""));
          }
        }
      };
      index(mainCards, "main");
      index(sideCards, "side");

      for (const key of Object.keys(this.plan)) {
        const entry = this.plan[key] && this.plan[key][matchup];
        if (!entry || !entry.count) continue;
        if (isLand.get(key)) continue;
        const cmc = cmcOf.get(key);
        if (typeof cmc !== "number") continue;
        if (entry.dir === "out") {
          after[cmc] -= entry.count;
        } else if (entry.dir === "in") {
          after[cmc] += entry.count;
        }
      }
      return after;
    },
    /**
     * The largest bucket value across before and after, so both series
     * share a scale. Min 1 to avoid divide-by-zero.
     */
    maxValue() {
      const all = this.beforeCurve.concat(this.afterCurve);
      return Math.max(1, ...all);
    },
    hasData() {
      return this.beforeCurve.some((n) => n > 0);
    },
    amvBefore() {
      return this.amvOf(this.beforeCurve);
    },
    amvAfter() {
      return this.amvOf(this.afterCurve);
    },
    amvDelta() {
      return this.amvAfter - this.amvBefore;
    },
    amvBeforeText() {
      return this.amvBefore.toFixed(2);
    },
    amvAfterText() {
      return this.amvAfter.toFixed(2);
    },
    amvDeltaText() {
      const d = this.amvDelta;
      if (Math.abs(d) < 0.005) return "no change";
      const sign = d > 0 ? "+" : "";
      return sign + d.toFixed(2);
    },
    // Only show the after AMV when a matchup is active and it actually
    // differs; otherwise "before" alone is the whole story.
    amvChanged() {
      return Math.abs(this.amvDelta) >= 0.005;
    },
    buckets() {
      return BUCKET_LABELS.map((label, i) => {
        const before = this.beforeCurve[i] || 0;
        const after = this.afterCurve[i] || 0;
        return {
          label,
          before,
          after,
          beforeH: (before / this.maxValue) * 100,
          afterH: (after / this.maxValue) * 100
        };
      });
    }
  },
  methods: {
    /**
     * Average mana value of a curve array: sum(bucket index * count) /
     * total nonland cards. The last bucket is "7+" and is counted as 7,
     * so the very top of the curve is a slight approximation (rare cards).
     *
     * This is a METHOD, not a computed: it takes the curve as an argument.
     */
    amvOf(curve) {
      let total = 0;
      let cards = 0;
      for (let i = 0; i < curve.length; i++) {
        total += i * (curve[i] || 0);
        cards += curve[i] || 0;
      }
      return cards ? total / cards : 0;
    }
  },
  template: `
    <div class="mana-curve">
      <div class="mana-curve-head">
        <h3 class="mana-curve-title">Mana curve</h3>
        <span v-if="activeMatchup" class="mana-curve-sub">vs {{ activeMatchup }}</span>
        <span v-else class="mana-curve-sub">maindeck</span>
      </div>

      <div v-if="hasData" class="mana-curve-amv">
        <span class="mana-curve-amv-label">Avg. mana value:</span>
        <span class="mana-curve-amv-value">{{ amvBeforeText }}</span>
        <template v-if="amvChanged">
          <span class="mana-curve-amv-arrow" aria-hidden="true">&rarr;</span>
          <span class="mana-curve-amv-value after">{{ amvAfterText }}</span>
          <span
            class="mana-curve-amv-delta"
            :class="{ 'is-up': amvDelta > 0, 'is-down': amvDelta < 0 }"
          >({{ amvDeltaText }})</span>
        </template>
      </div>

      <div v-if="hasData" class="mana-curve-chart">
        <div v-for="b in buckets" :key="b.label" class="mana-curve-col">
          <div class="mana-curve-bars">
            <span class="mana-curve-bar before" :style="{ height: b.beforeH + '%' }"></span>
            <span class="mana-curve-bar after" :style="{ height: b.afterH + '%' }"></span>
          </div>
          <span class="mana-curve-label">{{ b.label }}</span>
        </div>
      </div>
      <p v-else class="mana-curve-empty">No nonland cards to chart yet.</p>

      <div class="mana-curve-legend">
        <span class="mana-curve-swatch before"></span> maindeck
        <span class="mana-curve-swatch after"></span> after sideboarding
      </div>
    </div>
  `
};

export default ManaCurve;