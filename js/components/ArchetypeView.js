// ArchetypeView: renders the derived archetype index (archetypes.json).
//
// Receives the index object as a prop -- it does NOT fetch. Data loading
// lives in GuideLibrary via listArchetypes() so that all network access
// goes through the same fallback chain and the component stays testable.
//
// Layout: a list of archetype rows (name, format, guide count). Click a
// row to expand it and see the card-frequency summary and the guides in
// that archetype. Emits "load-share" when a guide is opened, matching
// GuideLibrary's existing contract.

const MAX_VISIBLE_FREQUENCY = 15;

const ArchetypeView = {
  props: {
    index: { type: Object, required: true }
  },
  emits: ["load-share"],
  data() {
    return {
      expandedKey: null,
      // key -> bool, tracks "show all" for expanded archetypes.
      showAllFrequency: {},
      // Set of "archetypeKey|cardName" strings for board-in cards whose
      // per-matchup detail is expanded.
      expandedCards: {},
      loadingFile: null
    };
  },
  computed: {
    archetypes() {
      return (this.index && Array.isArray(this.index.archetypes))
        ? this.index.archetypes
        : [];
    }
  },
  methods: {
    isExpanded(key) {
      return this.expandedKey === key;
    },
    toggle(key) {
      this.expandedKey = this.expandedKey === key ? null : key;
    },
    frequencyFor(archetype) {
      const all = archetype.cardFrequency || [];
      if (this.showAllFrequency[archetype.key]) return all;
      return all.slice(0, MAX_VISIBLE_FREQUENCY);
    },
    hasMoreFrequency(archetype) {
      const all = archetype.cardFrequency || [];
      return all.length > MAX_VISIBLE_FREQUENCY && !this.showAllFrequency[archetype.key];
    },
    showAll(archetype) {
      this.showAllFrequency = Object.assign({}, this.showAllFrequency, {
        [archetype.key]: true
      });
    },
    pct(n) {
      // inclusion is 0..1; render as an integer percent.
      return Math.round((n || 0) * 100) + "%";
    },
    barWidth(n) {
      const pct = Math.max(0, Math.min(1, n || 0)) * 100;
      return pct + "%";
    },
    /**
     * Matchup names present in this archetype's boardInMatrix, in the
     * order they appear in the object. Empty array when the archetype
     * is v1 (no boardInMatrix) or has none, so the section is skipped.
     */
    boardInMatchups(archetype) {
      if (!archetype || !archetype.boardInMatrix) return [];
      return Object.keys(archetype.boardInMatrix);
    },
    /**
     * Invert boardInMatrix (matchup -> cards) into a card-first list:
     * [{ name, matchups: [{ matchup, inclusion, avgCopies }], matchupCount }],
     * sorted by matchupCount desc, then name asc.
     *
     * The stored shape is matchup-first because that mirrors how the
     * data is produced (each guide's plan is walked per matchup). The
     * display shape is card-first because a reader asks "when do I
     * bring this card in," not "what do I bring in against Tron."
     * Inverting at render time keeps the file in its natural storage
     * shape and costs one walk over the matrix.
     */
    boardInCards(archetype) {
      if (!archetype || !archetype.boardInMatrix) return [];
      const byCard = new Map();
      for (const matchup of Object.keys(archetype.boardInMatrix)) {
        for (const entry of archetype.boardInMatrix[matchup] || []) {
          if (!byCard.has(entry.name)) {
            byCard.set(entry.name, { name: entry.name, matchups: [], matchupCount: 0 });
          }
          const card = byCard.get(entry.name);
          card.matchups.push({
            matchup: matchup,
            inclusion: entry.inclusion,
            avgCopies: entry.avgCopies
          });
          card.matchupCount += 1;
        }
      }
      const list = Array.from(byCard.values());
      list.sort((a, b) => {
        if (b.matchupCount !== a.matchupCount) return b.matchupCount - a.matchupCount;
        return a.name.localeCompare(b.name);
      });
      return list;
    },
    /**
     * True when this card's index is the first of its matchup-count tier,
     * so the template can draw a divider above it. Compares against the
     * previous card in the already-sorted list.
     */
    isNewTier(archetype, index) {
      const cards = this.boardInCards(archetype);
      if (index === 0) return false;
      return cards[index].matchupCount !== cards[index - 1].matchupCount;
    },
    cardKey(archetype, cardName) {
      return archetype.key + "|" + cardName;
    },
    isCardExpanded(archetype, cardName) {
      return !!this.expandedCards[this.cardKey(archetype, cardName)];
    },
    toggleCard(archetype, cardName) {
      const k = this.cardKey(archetype, cardName);
      const next = Object.assign({}, this.expandedCards);
      if (next[k]) delete next[k];
      else next[k] = true;
      this.expandedCards = next;
    },
    matchupCountLabel(n) {
      return n + (n === 1 ? " matchup" : " matchups");
    },
    /**
     * Format an average-copies value as a compact "x4" / "x1.7" label.
     * Trailing ".0" is dropped so whole numbers read cleanly.
     */
    copiesLabel(avg) {
      const n = typeof avg === "number" ? avg : 0;
      const rounded = Math.round(n * 10) / 10;
      const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      return "\u00d7" + text;
    },
    onOpenGuide(file) {
      if (this.loadingFile) return;
      this.loadingFile = file;
      // The parent (GuideLibrary) handles the actual fetch and the
      // load-share emit; we just signal intent and clear our own spinner
      // state on the next tick so the button does not stay disabled.
      this.$emit("load-share-file", file);
      this.$nextTick(() => {
        this.loadingFile = null;
      });
    },
    sourceLabel() {
      if (this.index && this.index.source === "remote") return "index: live";
      if (this.index && this.index.source === "local") return "index: local mirror";
      return "";
    }
  },
  template: `
    <section class="archetype-view">
      <header class="archetype-view-header">
        <div>
          <p class="archetype-view-eyebrow">Browse</p>
          <h2>Archetypes</h2>
          <p class="archetype-view-lead">
            What each archetype looks like in aggregate, and who has built it.
          </p>
        </div>
        <span v-if="sourceLabel()" class="archetype-view-source">{{ sourceLabel() }}</span>
      </header>

      <ul class="archetype-list">
        <li
          v-for="a in archetypes"
          :key="a.key"
          class="archetype-item"
          :class="{ 'is-expanded': isExpanded(a.key) }"
        >
          <button
            type="button"
            class="archetype-row"
            :aria-expanded="isExpanded(a.key) ? 'true' : 'false'"
            @click="toggle(a.key)"
          >
            <span class="archetype-row-main">
              <span class="archetype-row-name">{{ a.name }}</span>
              <span v-if="a.format" class="archetype-row-format">{{ a.format }}</span>
            </span>
            <span class="archetype-row-meta">
              <span class="archetype-row-count">
                {{ a.guideCount }} guide{{ a.guideCount === 1 ? '' : 's' }}
              </span>
              <span class="archetype-row-chevron" aria-hidden="true">
                {{ isExpanded(a.key) ? '&#9662;' : '&#9656;' }}
              </span>
            </span>
          </button>

          <div v-if="isExpanded(a.key)" class="archetype-detail">
            <div v-if="a.tags && a.tags.length" class="archetype-tags">
              <span v-for="t in a.tags" :key="t" class="archetype-tag">{{ t }}</span>
            </div>

            <div class="archetype-columns">
            <div class="archetype-freq">
              <h3 class="archetype-freq-title">Common cards</h3>
              <ul class="archetype-freq-list">
                <li
                  v-for="f in frequencyFor(a)"
                  :key="f.name"
                  class="archetype-freq-row"
                >
                  <span class="archetype-freq-name">{{ f.name }}</span>
                  <span class="archetype-freq-bar-wrap" aria-hidden="true">
                    <span
                      class="archetype-freq-bar"
                      :style="{ width: barWidth(f.inclusion) }"
                    ></span>
                  </span>
                  <span class="archetype-freq-pct">{{ pct(f.inclusion) }}</span>
                </li>
              </ul>
              <button
                v-if="hasMoreFrequency(a)"
                type="button"
                class="archetype-freq-more"
                @click="showAll(a)"
              >
                Show all {{ a.cardFrequency.length }} cards
              </button>
            </div>

            <div v-if="boardInCards(a).length" class="archetype-boardin">
              <h3 class="archetype-freq-title">What comes in</h3>
              <p class="archetype-boardin-hint">
                Sideboard cards this archetype uses, ranked by how many
                matchups they come in for. Click a card for the matchups.
              </p>
              <ul class="archetype-boardin-list">
                <li
                  v-for="(card, ci) in boardInCards(a)"
                  :key="'bi-' + card.name"
                  class="archetype-boardin-card"
                  :class="{ 'is-new-tier': isNewTier(a, ci) }"
                >
                  <button
                    type="button"
                    class="archetype-boardin-row"
                    :aria-expanded="isCardExpanded(a, card.name) ? 'true' : 'false'"
                    @click="toggleCard(a, card.name)"
                  >
                    <span class="archetype-boardin-chevron" aria-hidden="true">
                      {{ isCardExpanded(a, card.name) ? '&#9662;' : '&#9656;' }}
                    </span>
                    <span class="archetype-boardin-name">{{ card.name }}</span>
                    <span class="archetype-boardin-count">
                      {{ matchupCountLabel(card.matchupCount) }}
                    </span>
                  </button>
                  <ul v-if="isCardExpanded(a, card.name)" class="archetype-boardin-detail">
                    <li
                      v-for="m in card.matchups"
                      :key="'bi-' + card.name + '-' + m.matchup"
                      class="archetype-boardin-detail-row"
                    >
                      <span class="archetype-boardin-detail-vs">vs {{ m.matchup }}</span>
                      <span class="archetype-boardin-detail-pct">{{ pct(m.inclusion) }} of guides</span>
                      <span class="archetype-boardin-detail-copies">{{ copiesLabel(m.avgCopies) }}</span>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
            </div>

            <div class="archetype-guides">
              <h3 class="archetype-guides-title">Guides</h3>
              <ul class="archetype-guides-list">
                <li
                  v-for="g in a.guides"
                  :key="g.file"
                  class="archetype-guide-row"
                >
                  <span class="archetype-guide-info">
                    <span class="archetype-guide-author">{{ g.author || 'anonymous' }}</span>
                    <span v-if="g.verified" class="archetype-guide-verified" title="Verified">&#10003;</span>
                    <span v-if="g.lastEditedAt" class="archetype-guide-date">{{ g.lastEditedAt }}</span>
                  </span>
                  <button
                    type="button"
                    class="usa-button archetype-guide-open"
                    :disabled="loadingFile === g.file"
                    @click="onOpenGuide(g.file)"
                  >{{ loadingFile === g.file ? 'Opening...' : 'Open' }}</button>
                </li>
              </ul>
            </div>
          </div>
        </li>
      </ul>
    </section>
  `
};

export default ArchetypeView;