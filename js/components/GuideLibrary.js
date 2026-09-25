// GuideLibrary: a full-page browse view of community guides. Rendered
// when the app is in "browse" mode. Click a guide to load it into the
// builder and switch back to "build" mode.

import { listGuides, loadGuide } from "../guides.js";

const GuideLibrary = {
  emits: ["load-share", "submit-guide"],
  data() {
    return {
      loading: false,
      error: "",
      guides: [],
      source: null,
      loadingFile: null,
      filterFormat: "all",
      filterText: ""
    };
  },
  mounted() {
    this.refresh();
  },
  computed: {
    formats() {
      const set = new Set(this.guides.map((g) => g.format).filter(Boolean));
      return ["all", ...Array.from(set).sort()];
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
    sourceLabel() {
      if (this.source === "remote") return "Loaded from github.com/rndfunction/SideboardGuides";
      if (this.source === "local") return "Loaded from the app's local mirror (remote unavailable here)";
      if (this.source === "fallback") return "Showing built-in sample guides (remote and local fetches unavailable)";
      return "";
    }
  },
  methods: {
    async refresh() {
      this.loading = true;
      this.error = "";
      try {
        const result = await listGuides();
        this.guides = result.guides || [];
        this.source = result.source;
        if (!this.guides.length) {
          this.error = "No community guides found yet.";
        }
      } catch (err) {
        this.error = "Could not load guides: " + String(err.message || err);
      } finally {
        this.loading = false;
      }
    },
    async onOpen(file) {
      if (this.loadingFile) return;
      this.loadingFile = file;
      this.error = "";
      try {
        const payload = await loadGuide(file);
        if (!payload || payload.format !== "mtg-sideboard-guide") {
          throw new Error("Not a valid guide file.");
        }
        this.$emit("load-share", payload);
      } catch (err) {
        this.error = "Could not load guide: " + String(err.message || err);
      } finally {
        this.loadingFile = null;
      }
    }
  },
  template: `
    <section class="guide-library">
      <header class="guide-library-header">
        <div class="guide-library-header-row">
          <div>
            <h2>Community guides</h2>
            <p class="guide-library-lead">
              Sideboard guides shared by other players. Click a guide to open it in the builder.
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

      <div class="guide-library-controls">
        <label class="guide-library-filter">
          <span class="usa-sr-only">Filter by format</span>
          <select v-model="filterFormat">
            <option v-for="f in formats" :key="f" :value="f">{{ f === "all" ? "All formats" : f }}</option>
          </select>
        </label>
        <label class="guide-library-search">
          <span class="usa-sr-only">Search</span>
          <input
            type="search"
            v-model="filterText"
            placeholder="Search by name, archetype, or author"
          />
        </label>
        <span class="guide-library-source">{{ sourceLabel }}</span>
      </div>

      <div v-if="loading" class="guide-library-status">Loading guides...</div>
      <div v-else-if="error" class="guide-library-status guide-library-error">{{ error }}</div>
      <div v-else-if="!filtered.length" class="guide-library-status">No guides match your filter.</div>

      <ul v-else class="guide-library-grid">
        <li v-for="g in filtered" :key="g.file" class="guide-library-card">
          <div class="guide-library-card-body">
            <h3 class="guide-library-card-name">{{ g.deckName || g.file }}</h3>
            <div class="guide-library-card-meta">
              <span v-if="g.format" class="guide-library-tag">{{ g.format }}</span>
              <span v-if="g.archetype" class="guide-library-archetype">{{ g.archetype }}</span>
            </div>
            <p v-if="g.author" class="guide-library-card-author">by {{ g.author }}</p>
          </div>
          <button
            type="button"
            class="usa-button guide-library-open"
            :disabled="loadingFile === g.file"
            @click="onOpen(g.file)"
          >{{ loadingFile === g.file ? "Opening..." : "Open in builder" }}</button>
        </li>
      </ul>

      <footer class="guide-library-footer">
        <span>
          Want to share your own? Build a guide in <strong>Build</strong> mode and click
          <strong>Submit</strong> — it opens a pull request in the community repository.
          You can also contribute directly at
          <a href="https://github.com/rndfunction/SideboardGuides" target="_blank" rel="noopener">github.com/rndfunction/SideboardGuides</a>.
        </span>
      </footer>
    </section>
  `
};

export default GuideLibrary;