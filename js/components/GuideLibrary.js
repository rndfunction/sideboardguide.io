// GuideLibrary: a full-page browse view of community guides.
// Card-showroom styling (Direction A): format tabs at the top, colored
// format pills on cards, arrow-chip buttons, prominent empty states.
//
// Data loading (list + open + source label) is shared with GuideBrowser
// via GuideListMixin so the two views can never drift.

import { GuideListMixin } from "../guides-list.js";

const GuideLibrary = {
  mixins: [GuideListMixin],
  emits: ["load-share", "submit-guide"],
  data() {
    return {
      filterFormat: "all",
      filterText: "",
      sourceOpen: false
    };
  },
  mounted() {
    this.refreshGuides();
  },
  computed: {
    formats() {
      // Formats present in the guide list, with counts. Ordered by count
      // descending so the most-represented format is first.
      const counts = new Map();
      for (const g of this.guides) {
        if (!g.format) continue;
        counts.set(g.format, (counts.get(g.format) || 0) + 1);
      }
      const list = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count }));
      return [{ name: "all", count: this.guides.length }, ...list];
    },
    filtered() {
      const q = this.filterText.trim().toLowerCase();
      return this.guides.filter((g) => {
        if (this.filterFormat !== "all" && g.format !== this.filterFormat) return false;
        if (!q) return true;
        const hay = ((g.deckName || "") + " " + (g.archetype || "") + " " + (g.author || "")).toLowerCase();
        return hay.includes(q);
      });
    },
    hasFilters() {
      return this.filterFormat !== "all" || this.filterText.trim().length > 0;
    }
  },
  methods: {
    onOpen(file) {
      return this.openGuide(file, this.$emit.bind(this));
    },
    clearFilters() {
      this.filterFormat = "all";
      this.filterText = "";
    },
    formatClass(fmt) {
      if (!fmt) return "pill-other";
      return "pill-" + String(fmt).toLowerCase().replace(/[^a-z]/g, "");
    },
    toggleSource() {
      this.sourceOpen = !this.sourceOpen;
    }
  },
  template: `
    <section class="guide-library">
      <header class="guide-library-header">
        <div class="guide-library-header-row">
          <div>
            <p class="guide-library-eyebrow">Community</p>
            <h2>Sideboard guides</h2>
            <p class="guide-library-lead">
              Shared by other players. Click any guide to open it in the builder.
            </p>
          </div>
          <button
            type="button"
            class="usa-button guide-library-submit"
            @click="$emit('submit-guide')"
            title="Submit the currently loaded guide"
          >Submit a guide</button>
        </div>
      </header>

      <nav class="guide-library-tabs" role="tablist" aria-label="Filter by format">
        <button
          v-for="f in formats"
          :key="f.name"
          type="button"
          role="tab"
          :aria-selected="filterFormat === f.name ? 'true' : 'false'"
          class="guide-library-tab"
          :class="{ 'is-active': filterFormat === f.name }"
          @click="filterFormat = f.name"
        >
          {{ f.name === "all" ? "All" : f.name }}
          <span class="guide-library-tab-count">{{ f.count }}</span>
        </button>

        <label class="guide-library-search">
          <span class="usa-sr-only">Search guides</span>
          <input
            type="search"
            v-model="filterText"
            placeholder="Search by name, archetype, or author"
          />
        </label>

        <button
          v-if="sourceLabel"
          type="button"
          class="guide-library-info"
          :aria-expanded="sourceOpen ? 'true' : 'false'"
          title="Where these guides are loaded from"
          @click="toggleSource"
        >i</button>
      </nav>

      <div v-if="sourceOpen && sourceLabel" class="guide-library-source-inline">
        {{ sourceLabel }}
      </div>

      <div v-if="loading" class="guide-library-status">
        <div class="guide-library-spinner" aria-hidden="true"></div>
        <p>Loading guides...</p>
      </div>

      <div v-else-if="error" class="guide-library-status guide-library-error">
        <p>{{ error }}</p>
        <button type="button" class="usa-button usa-button--outline" @click="refreshGuides">Try again</button>
      </div>

      <div v-else-if="!filtered.length" class="guide-library-status">
        <p>No guides match your filter.</p>
        <button
          v-if="hasFilters"
          type="button"
          class="usa-button usa-button--outline"
          @click="clearFilters"
        >Clear filters</button>
      </div>

      <ul v-else class="guide-library-grid">
        <li v-for="g in filtered" :key="g.file" class="guide-library-card">
          <div class="guide-library-card-body">
            <h3 class="guide-library-card-name">{{ g.deckName || g.file }}</h3>
            <div class="guide-library-card-meta">
              <span
                v-if="g.format"
                class="guide-library-pill"
                :class="formatClass(g.format)"
              >{{ g.format }}</span>
              <span v-if="g.archetype && g.archetype !== g.deckName" class="guide-library-archetype">{{ g.archetype }}</span>
            </div>
            <p v-if="g.author" class="guide-library-card-author">
              <span class="guide-library-by">by</span> {{ g.author }}
            </p>
          </div>
          <button
            type="button"
            class="guide-library-open"
            :disabled="loadingFile === g.file"
            @click="onOpen(g.file)"
            :aria-label="'Open ' + (g.deckName || g.file) + ' in the builder'"
          >
            <span>{{ loadingFile === g.file ? "Opening..." : "Open" }}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </li>
      </ul>

      <footer class="guide-library-footer">
        <span>
          Share your own from <strong>Build</strong> mode &mdash; the guide builder has a
          <strong>Submit</strong> button that opens a pull request in the community repository.
        </span>
      </footer>
    </section>
  `
};

export default GuideLibrary;