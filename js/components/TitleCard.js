// Title card: deck name, colors, counts, mana curve.
import { exportElementToPng } from "../exportimage.js";

const COLOR_NAMES = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };

const TitleCard = {
  props: {
    deck: { type: Object, required: true },
    deckName: { type: String, default: "" }
  },
  emits: ["update:deckName"],
  data() {
    return {
      exporting: false,
      exportError: ""
    };
  },
  computed: {
    localName: {
      get() {
        return this.deckName || "Untitled Deck";
      },
      set(val) {
        this.$emit("update:deckName", val);
      }
    },
    stats() {
      return this.deck.stats || {};
    },
    colors() {
      return this.stats.colors || [];
    },
    colorLabel() {
      if (!this.colors.length) return "Colorless";
      return this.colors.map((c) => COLOR_NAMES[c] || c).join(" / ");
    },
    curve() {
      return this.stats.curve || [];
    },
    curveMax() {
      return Math.max(1, ...this.curve);
    },
    curveColumns() {
      const labels = ["0", "1", "2", "3", "4", "5", "6", "7+"];
      const max = this.curveMax;
      return this.curve.map((count, i) => ({
        label: labels[i],
        count,
        heightPct: Math.round((count / max) * 100)
      }));
    },
    mainCount() { return this.stats.totalMain || 0; },
    sideCount() { return this.stats.totalSide || 0; },
    mainOk() { return this.mainCount === 60; },
    sideOk() { return this.sideCount === 15 || this.sideCount === 0; }
  },
  methods: {
    normalizeName() {
      // Fire a lightweight titlecase on blur via the store's setter.
      const v = (this.localName || "").trim();
      if (!v) return;
      // Re-emit so the parent applies titlecase. Vue's v-model on blur has
      // already written the raw value; we just re-emit a cased version.
      const cased = this.simpleTitleCase(v);
      if (cased !== v) this.$emit("update:deckName", cased);
    },
    simpleTitleCase(input) {
      return String(input)
        .trim()
        .split(/\s+/)
        .map((w) => {
          if (/^\d/.test(w)) return w;
          // Keep all-caps 2-4 char tokens.
          if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z]+$/.test(w)) return w;
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(" ");
    },
    async onExportPng() {
      this.exporting = true;
      this.exportError = "";
      try {
        const el = this.$refs.card;
        const safe = (this.localName || "deck").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        await exportElementToPng(el, safe + "-title.png");
      } catch (err) {
        this.exportError = String(err && err.message ? err.message : err);
      } finally {
        this.exporting = false;
      }
    }
  },
  template: `
    <section class="title-card" ref="card">
      <label class="usa-sr-only" for="deck-name-input">Deck name</label>
      <input
        id="deck-name-input"
        class="deck-name-input"
        style="background:transparent;border:none;color:inherit;font-size:2.25rem;font-weight:700;width:100%;padding:0;margin:0;"
        v-model="localName"
        @blur="normalizeName"
      />

      <div class="deck-meta">
        <span :class="{ 'count-bad': !mainOk, 'count-good': mainOk }">
          <strong>{{ mainCount }}</strong> maindeck
        </span>
        <span :class="{ 'count-bad': !sideOk, 'count-good': sideOk }">
          <strong>{{ sideCount }}</strong> sideboard
        </span>
        <span><strong>{{ stats.landCount || 0 }}</strong> lands</span>
        <span>{{ colorLabel }}</span>
      </div>

      <div class="color-pips" v-if="colors.length">
        <span
          v-for="c in colors"
          :key="c"
          class="color-pip"
          :class="'pip-' + c"
          :title="c"
        >{{ c }}</span>
      </div>

      <div class="mana-curve" v-if="curve.length">
        <div class="curve-column" v-for="col in curveColumns" :key="col.label">
          <div
            class="curve-bar"
            :style="{ height: col.heightPct + '%', minHeight: col.count > 0 ? '12px' : '2px', opacity: col.count > 0 ? 1 : 0.25 }"
            :title="col.count + ' cards at CMC ' + col.label"
          >{{ col.count > 0 ? col.count : '' }}</div>
          <div class="curve-label">{{ col.label }}</div>
        </div>
      </div>

      <div class="title-card-actions">
        <button
          type="button"
          class="usa-button usa-button--outline title-export-btn"
          :disabled="exporting"
          @click="onExportPng"
        >{{ exporting ? "Rendering..." : "Export PNG" }}</button>
        <span v-if="exportError" class="title-export-err">{{ exportError }}</span>
      </div>

      <div v-if="stats.missing && stats.missing.length" style="margin-top:1rem;color:#ffd166;font-size:0.85rem;">
        Not found on Scryfall: {{ stats.missing.join(", ") }}
      </div>
    </section>
  `
};

export default TitleCard;