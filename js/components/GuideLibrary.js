// GuideLibrary: a full-page browse view of community guides.
// Card-showroom styling (Direction A): format tabs at the top, colored
// format pills on cards, arrow-chip buttons, prominent empty states.
//
// Data loading (list + open + source label) is shared with GuideBrowser
// via GuideListMixin so the two views can never drift.
//
// Two Browse modes:
//   - "archetype": renders ArchetypeView when the derived index has at
//     least one bucket with guideCount >= 2. Groups guides by archetype
//     and shows the aggregate card-frequency view.
//   - "flat": the original grid of individual guides.
// The default is archetype-when-usable; a manual toggle overrides it for
// the session. See /docs/archetype-index-spec.md.

import { GuideListMixin } from "../guides-list.js";
import { listArchetypes, hasUsableArchetypes } from "../guides.js";
import ArchetypeView from "./ArchetypeView.js";

const GuideLibrary = {
  mixins: [GuideListMixin],
  components: { ArchetypeView },
  emits: ["load-share", "submit-guide", "go-build"],
  data() {
    return {
      // Empty until the guide list loads; a watcher on `guides` then
      // selects the most-populated format. There is no "all" option --
      // Browse always shows one format at a time.
      filterFormat: "",
      filterText: "",
      sourceOpen: false,
      // Archetype index state.
      archetypeIndex: null,
      archetypeSource: "none",
      archetypeLoading: false,
      // null = "auto" (use archetype view iff usable); "flat" = forced flat.
      viewOverride: null,
      // Info modal explaining how to contribute a guide.
      showSubmitInfo: false
    };
  },
  watch: {
    /**
     * Keep filterFormat in sync with the available formats. On first
     * load this selects the most-populated format (formats() is sorted
     * by count descending). On a later refresh it preserves the current
     * choice if that format still exists, and otherwise falls back to
     * the top format. There is no "all" state: Browse always shows
     * exactly one format.
     */
    guides: {
      immediate: true,
      handler(list) {
        const available = (list || []).map((g) => g.format).filter(Boolean);
        if (!available.length) return;
        if (this.filterFormat && available.includes(this.filterFormat)) return;
        // Pick the most-populated format. formats() is already sorted
        // count-desc, so its first real entry is the top format.
        const top = this.formats.find((f) => f.name !== "all");
        this.filterFormat = top ? top.name : available[0];
      }
    }
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
      // No "all" pseudo-format: Browse is always scoped to one format.
      return list;
    },
    filtered() {
      const q = this.filterText.trim().toLowerCase();
      return this.guides.filter((g) => {
        if (g.format !== this.filterFormat) return false;
        if (!q) return true;
        const hay = ((g.deckName || "") + " " + (g.archetype || "") + " " + (g.author || "")).toLowerCase();
        return hay.includes(q);
      });
    },
    hasFilters() {
      // The format tab is always a specific format now, so it does not
      // count as a "filter" the user can clear -- only the search text.
      return this.filterText.trim().length > 0;
    },
    /**
     * Whether the archetype view should be shown, taking the manual
     * override and the usability check into account.
     *
     * Whether an archetype view is available for the CURRENTLY SELECTED
     * format, independent of which view is showing. This is what the
     * "By archetype" button's :disabled reads: the button should be
     * clickable whenever the current format has a usable archetype, even
     * if the user is presently on the flat list.
     *
     * Format-scoped on purpose: a format whose guides are all
     * single-guide buckets (like Modern with one guide) has no usable
     * archetype, so the view should fall back to the flat list rather
     * than render an empty archetype list.
     *
     * This is a computed: templates must reference it WITHOUT parentheses.
     */
    archetypeViewAvailable() {
      return hasUsableArchetypes(this.filteredIndex);
    },
    /**
     * Whether the archetype view is currently the active view, taking the
     * manual override into account. This decides what renders, not whether
     * the toggle is enabled. Falls back to false (flat list) when the
     * current format has no usable archetype, so an empty archetype view
     * is never shown.
     */
    showArchetypeView() {
      if (!this.archetypeViewAvailable) return false;
      if (this.viewOverride === "flat") return false;
      if (this.viewOverride === "archetype") return true;
      return true;
    },
    /**
     * The index filtered down to the current format tab. Only archetypes
     * in the selected format are kept. Text search is not applied to
     * archetypes -- they are a small, named set and filtering them by
     * free text would only hide them confusingly.
     */
    filteredIndex() {
      if (!this.archetypeIndex || !Array.isArray(this.archetypeIndex.archetypes)) {
        return { version: 1, archetypes: [] };
      }
      const list = this.archetypeIndex.archetypes.filter((a) => {
        return a.format === this.filterFormat;
      });
      return Object.assign({}, this.archetypeIndex, { archetypes: list });
    }
  },
  methods: {
    onOpen(file) {
      return this.openGuide(file, this.$emit.bind(this));
    },
    /**
     * Fetch the derived archetype index. Silent on failure -- a missing
     * or malformed index simply leaves archetypeIndex at null and the
     * view falls back to the flat guide list.
     */
    async refreshArchetypes() {
      this.archetypeLoading = true;
      try {
        const result = await listArchetypes();
        this.archetypeIndex = result.index;
        this.archetypeSource = result.source;
      } catch (_) {
        this.archetypeIndex = null;
        this.archetypeSource = "none";
      } finally {
        this.archetypeLoading = false;
      }
    },
    /**
     * ArchetypeView emits "load-share-file"; route it through the same
     * openGuide() path the flat grid uses, so both modes emit load-share
     * identically to the parent.
     */
    onArchetypeOpen(file) {
      return this.openGuide(file, this.$emit.bind(this));
    },
    setViewOverride(mode) {
      this.viewOverride = this.viewOverride === mode ? null : mode;
    },
    clearFilters() {
      // Only the search text is clearable; the format tab stays put.
      this.filterText = "";
    },
    formatClass(fmt) {
      if (!fmt) return "pill-other";
      return "pill-" + String(fmt).toLowerCase().replace(/[^a-z]/g, "");
    },
    toggleSource() {
      this.sourceOpen = !this.sourceOpen;
    },
    openSubmitInfo() {
      this.showSubmitInfo = true;
    },
    closeSubmitInfo() {
      this.showSubmitInfo = false;
    },
    onSubmitInfoOverlay(evt) {
      if (evt.target === evt.currentTarget) this.closeSubmitInfo();
    },
    goToBuild() {
      this.closeSubmitInfo();
      this.$emit("go-build");
    },
    onSubmitInfoKey(evt) {
      if (!this.showSubmitInfo) return;
      if (evt.key === "Escape") this.closeSubmitInfo();
    },
    clearFilters() {
      // Only the search text is clearable; the format tab stays put.
      this.filterText = "";
    }
  },
  mounted() {
    this.refreshGuides();
    this.refreshArchetypes();
    document.addEventListener("keydown", this.onSubmitInfoKey);
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this.onSubmitInfoKey);
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
            @click="openSubmitInfo"
            title="How to share your own guide"
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

      <div class="guide-library-view-toggle">
        <button
          type="button"
          class="guide-library-view-btn"
          :class="{ 'is-active': showArchetypeView }"
          :disabled="!archetypeViewAvailable"
          :aria-pressed="showArchetypeView ? 'true' : 'false'"
          @click="setViewOverride('archetype')"
          :title="archetypeViewAvailable
            ? 'Group guides by archetype'
            : 'Archetype view appears once this format has an archetype with more than one guide'"
        >By archetype</button>
        <button
          type="button"
          class="guide-library-view-btn"
          :class="{ 'is-active': !showArchetypeView }"
          :aria-pressed="!showArchetypeView ? 'true' : 'false'"
          @click="setViewOverride('flat')"
        >All guides</button>
      </div>

      <archetype-view
        v-if="showArchetypeView && !loading && !error"
        :index="filteredIndex"
        @load-share-file="onArchetypeOpen"
      ></archetype-view>

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

      <ul v-else-if="!showArchetypeView" class="guide-library-grid">
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

      <div
        v-if="showSubmitInfo"
        class="submit-info-overlay"
        @click="onSubmitInfoOverlay"
        role="dialog"
        aria-modal="true"
        aria-label="How to share your own guide"
      >
        <div class="submit-info-panel">
          <header class="submit-info-header">
            <h2>Share your own guide</h2>
            <button
              type="button"
              class="submit-info-close"
              @click="closeSubmitInfo"
              aria-label="Close"
              title="Close"
            >&times;</button>
          </header>

          <div class="submit-info-body">
            <p>
              Building a guide is easy. Switch to <strong>Build</strong>, paste a
              decklist, and add your matchups and your sideboarding plan &mdash;
              which cards come in, and how many, against each opponent.
            </p>
            <p>
              When you're done, click <strong>Submit</strong>. It asks you to sign in
              with GitHub, then opens a pull request for review. Once a maintainer
              approves it, your guide shows up here for everyone.
            </p>
            <p class="submit-info-note">
              You keep the ability to update your own guide later.
            </p>
          </div>

          <footer class="submit-info-actions">
            <button
              type="button"
              class="usa-button"
              @click="goToBuild"
            >Go to Build</button>
            <button
              type="button"
              class="usa-button usa-button--outline"
              @click="closeSubmitInfo"
            >Not now</button>
          </footer>
        </div>
      </div>
    </section>
  `
};

export default GuideLibrary;