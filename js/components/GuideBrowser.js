// GuideBrowser: a modal listing community guides fetched from the
// SideboardGuides repo. Clicking Load fetches the guide JSON and emits
// it upward for the app to apply.

import { listGuides, loadGuide, GUIDES_BASE_URL } from "../guides.js";

const GuideBrowser = {
  props: {
    open: { type: Boolean, default: false }
  },
  emits: ["close", "load-share"],
  data() {
    return {
      loading: false,
      error: "",
      guides: [],
      source: null, // "remote" | "local" | null
      loadingFile: null,
      baseUrl: GUIDES_BASE_URL
    };
  },
  watch: {
    open(newVal) {
      if (newVal) this.refresh();
    }
  },
  mounted() {
    document.addEventListener("keydown", this.onKey);
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this.onKey);
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
          this.error = "No community guides found.";
        }
      } catch (err) {
        this.error = "Could not load guides list: " + String(err.message || err);
      } finally {
        this.loading = false;
      }
    },
    async onLoad(file) {
      if (this.loadingFile) return;
      this.loadingFile = file;
      this.error = "";
      try {
        const payload = await loadGuide(file);
        if (!payload || payload.format !== "mtg-sideboard-guide") {
          throw new Error("That file is not a valid guide.");
        }
        this.$emit("load-share", payload);
        this.$emit("close");
      } catch (err) {
        this.error = "Could not load guide: " + String(err.message || err);
      } finally {
        this.loadingFile = null;
      }
    },
    onClose() {
      this.$emit("close");
    },
    onOverlayClick(evt) {
      if (evt.target === evt.currentTarget) this.onClose();
    },
    onKey(evt) {
      if (!this.open) return;
      if (evt.key === "Escape") this.onClose();
    },
    sourceLabel() {
      if (this.source === "remote") return "Loaded from github.com/rndfunction/SideboardGuides";
      if (this.source === "local") return "Loaded from the app's local mirror (remote unavailable)";
      if (this.source === "fallback") return "Showing built-in sample guides (remote and local fetches unavailable)";
      return "";
    }
  },
  template: `
    <div
      v-if="open"
      class="guide-browser-overlay"
      @click="onOverlayClick"
      role="dialog"
      aria-modal="true"
      aria-label="Community guides"
    >
      <div class="guide-browser-panel">
        <header class="guide-browser-header">
          <h2>Community guides</h2>
          <button
            type="button"
            class="guide-browser-close"
            @click="onClose"
            aria-label="Close"
            title="Close"
          >&times;</button>
        </header>

        <p class="guide-browser-source" v-if="sourceLabel">{{ sourceLabel }}</p>

        <div v-if="loading" class="guide-browser-status">Loading guides...</div>

        <div v-else-if="error" class="guide-browser-status guide-browser-error">{{ error }}</div>

        <ul v-else class="guide-browser-list">
          <li v-for="g in guides" :key="g.file" class="guide-browser-item">
            <div class="guide-browser-info">
              <div class="guide-browser-name">{{ g.deckName || g.file }}</div>
              <div class="guide-browser-meta">
                <span v-if="g.format" class="guide-browser-tag">{{ g.format }}</span>
                <span v-if="g.archetype" class="guide-browser-sub">{{ g.archetype }}</span>
                <span v-if="g.author" class="guide-browser-author">by {{ g.author }}</span>
              </div>
            </div>
            <button
              type="button"
              class="usa-button guide-browser-load"
              :disabled="loadingFile === g.file"
              @click="onLoad(g.file)"
            >{{ loadingFile === g.file ? "Loading..." : "Load" }}</button>
          </li>
        </ul>

        <footer class="guide-browser-footer">
          <span class="guide-browser-hint">
            Submissions welcome at
            <a :href="baseUrl.replace('raw.githubusercontent.com', 'github.com').replace('/main', '')" target="_blank" rel="noopener">github.com/rndfunction/SideboardGuides</a>
          </span>
        </footer>
      </div>
    </div>
  `
};

export default GuideBrowser;