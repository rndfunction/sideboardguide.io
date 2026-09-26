// GuideBrowser: a modal listing community guides fetched from the
// SideboardGuides repo. Clicking Load fetches the guide JSON and emits
// it upward for the app to apply.
//
// Data loading (list + open + source label) is shared with GuideLibrary
// via GuideListMixin so the two views can never drift.

import { GUIDES_BASE_URL } from "../guides.js";
import { GuideListMixin } from "../guides-list.js";

const GuideBrowser = {
  mixins: [GuideListMixin],
  props: {
    open: { type: Boolean, default: false }
  },
  emits: ["close", "load-share"],
  data() {
    return {
      baseUrl: GUIDES_BASE_URL
    };
  },
  watch: {
    open(newVal) {
      if (newVal) this.refreshGuides();
    }
  },
  mounted() {
    document.addEventListener("keydown", this.onKey);
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this.onKey);
  },
  methods: {
    onLoad(file) {
      return this.openGuide(file, this.$emit.bind(this));
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