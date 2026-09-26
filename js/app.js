// Bootstrap the Vue app and wire store -> components.
// Vue is loaded as a global (window.Vue) via index.html because FORGE's preview
// VFS rewrites bare-URL ESM imports relative to the importing file (breaking them).
import DeckInput from "./components/DeckInput.js";
import SampleCards from "./components/SampleCards.js";
import GuideToolbar from "./components/GuideToolbar.js";
import DeckGrid from "./components/DeckGrid.js";
import PrintView from "./components/PrintView.js";
import CardPreview from "./components/CardPreview.js";
import GuideBrowser from "./components/GuideBrowser.js";
import GuideLibrary from "./components/GuideLibrary.js";
import DeviceAuthDialog from "./components/DeviceAuthDialog.js";
import { buildSharePayload } from "./persistence.js";
import { submitGuide, suggestFilename } from "./guides.js";
import { getStoredToken, storeToken, clearToken, fetchUser } from "./githubauth.js";
import {
  store,
  loadDecklist,
  addMatchup,
  removeMatchup,
  renameMatchup,
  setDeckName,
  cycleCard,
  setCardPlan,
  normalizePlanKeys
} from "./store.js";
import { getLastFormat } from "./persistence.js";

const Vue = window.Vue;
if (!Vue || typeof Vue.createApp !== "function") {
  throw new Error("Vue global not found. Ensure /index.html loads vue.global.prod.js before /js/app.js.");
}

// Expose the reactive store on window for debugging, but only on
// localhost. On a public origin, any third-party script would otherwise
// get a live handle to the entire app state.
if (
  typeof window !== "undefined" &&
  window.location &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]")
) {
  window.__store = store;
}

const app = Vue.createApp({
  data() {
    return {
      store,
      showPrint: true,
      selectedFormat: getLastFormat(),
      showGuideBrowser: false,
      // Top-level app mode: "build" (default) or "browse".
      // Reflects the URL hash so #browse deep-links to the library.
      mode: (typeof window !== "undefined" && window.location.hash === "#browse") ? "browse" : "build",
      // Submission feedback for the toolbar and library.
      submitStatus: "",
      submitStatusClass: "ok",
      // Device flow auth state.
      showAuthDialog: false,
      _pendingSubmit: null
    };
  },
  computed: {
    parsed() { return store.parsed; },
    enriched() { return store.enriched; },
    loading() { return store.loading; },
    error() { return store.error; },
    matchups() { return store.matchups; },
    plan() { return store.plan; },
    deckName() { return store.deckName; }
  },
  methods: {
    onParse(text) {
      loadDecklist(text);
    },
    onReset() {
      store.parsed = null;
      store.enriched = null;
      store.error = null;
      store.status = "";
      store.rawText = "";
      store.matchups = [];
      store.plan = {};
      store.deckName = "";
      store.deckNameWasEdited = false;
      this.showPrint = false;
    },
    addMatchup(name) { addMatchup(name); },
    onAddMatchups(names) { for (const n of names) addMatchup(n); },
    removeMatchup(name) { removeMatchup(name); },
    onRenameMatchup(oldName, newName) { renameMatchup(oldName, newName); },
    onToggleCard(cardName, matchup, section) { cycleCard(cardName, matchup, section); },
    onSetCardPlan(cardName, matchup, dir, count, section) { setCardPlan(cardName, matchup, dir, count, section); },

    async onImportShare(parsed) {
      // The share schema nests the decklist under `deck.rawText`.
      const share = parsed || {};
      const deck = share.deck || {};

      // Parse + look up the decklist (async; hits Scryfall or the local DB).
      if (deck.rawText) {
        await loadDecklist(deck.rawText);
      }
      if (Array.isArray(share.matchups)) {
        store.matchups = share.matchups.slice();
      }
      if (share.plan && typeof share.plan === "object") {
        // Imported guides may carry legacy name-only plan keys (no
        // "@main"/"@side" suffix) — notably the two bundled guides and
        // any file merged under the old schema. Normalize against the
        // just-enriched deck so the grid can find the entries. This is
        // the import-path counterpart to the migration that runs inside
        // loadDecklist().
        const cloned = JSON.parse(JSON.stringify(share.plan));
        store.plan = normalizePlanKeys(cloned, store.enriched);
      }
      if (deck.name) {
        store.deckName = deck.name;
        // Mark the name as user-set so auto-naming doesn't overwrite it
        // on subsequent loads within this session.
        store.deckNameWasEdited = true;
      }
    },
    onDeckNameChange(name) {
      setDeckName(name);
    },
    onTogglePrint() {
      this.showPrint = !this.showPrint;
      if (this.showPrint) {
        this.$nextTick(() => {
          const el = document.querySelector('.print-view');
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    onOpenPrint() {
      this.showPrint = true;
      this.$nextTick(() => {
        const el = document.querySelector('.print-view');
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    onClosePrint() {
      this.showPrint = false;
    },
    onOpenGuideBrowser() {
      this.showGuideBrowser = true;
    },
    onCloseGuideBrowser() {
      this.showGuideBrowser = false;
    },
    async onLoadSharedGuide(parsed) {
      await this.onImportShare(parsed);
      this.setMode("build");
    },
    flashSubmit(msg, cls) {
      this.submitStatus = msg;
      this.submitStatusClass = cls || "ok";
      setTimeout(() => { this.submitStatus = ""; }, 4000);
    },
    /**
     * Count total IN/OUT plan entries across every matchup and section.
     * A plan entry is any non-empty cell in the guide.
     */
    planEntryCount() {
      let count = 0;
      const plan = store.plan || {};
      for (const key of Object.keys(plan)) {
        const cardPlan = plan[key];
        if (!cardPlan) continue;
        for (const matchup of Object.keys(cardPlan)) {
          if (cardPlan[matchup]) count++;
        }
      }
      return count;
    },
    async onSubmitGuide() {
      if (!store.enriched) {
        this.flashSubmit("Load a decklist first to submit a guide.", "error");
        return;
      }
      // Gate 1: at least one matchup.
      if (!store.matchups || store.matchups.length === 0) {
        this.flashSubmit("Add at least one matchup before submitting a guide.", "error");
        return;
      }
      // Gate 2: at least one plan entry (a filled IN/OUT cell anywhere).
      const planCount = this.planEntryCount();
      if (planCount === 0) {
        this.flashSubmit("Fill in at least one IN or OUT plan before submitting.", "error");
        return;
      }

      // Include the title-card preferences so a round-trip through the
      // share format preserves the user's customization. Without these
      // the fields serialize as null and every reload resets the cover.
      const payload = buildSharePayload({
        deckName: store.deckName,
        format: this.selectedFormat,
        archetype: store.deckName,
        rawText: store.rawText,
        matchups: store.matchups,
        plan: store.plan,
        titleColor: store.titleColor || null,
        titleFontKey: store.titleFontKey || null,
        titleSymbol: store.titleSymbol || null,
        titleTexture: store.titleTexture || null,
        titleTextureIntensity: store.titleTextureIntensity || null
      });
      const filename = suggestFilename(store.deckName);
      const token = getStoredToken();
      if (!token) {
        this._pendingSubmit = { payload, filename };
        this.showAuthDialog = true;
        return;
      }

      const meta = await this._buildMeta(token);
      await this._doSubmit(payload, filename, meta, token);
    },
    async _buildMeta(token) {
      // Look up the authenticated user for attribution. If the call
      // fails, fall back to "anonymous" so submissions still work.
      let author = "anonymous";
      try {
        const user = await fetchUser(token);
        if (user && user.login) author = user.login;
      } catch (_) {}
      return {
        deckName: store.deckName || "Untitled Deck",
        format: this.selectedFormat || "",
        archetype: store.deckName || "",
        author: author
      };
    },
    async _doSubmit(payload, filename, meta, token) {
      try {
        await submitGuide(payload, filename, meta, token);
        this.flashSubmit("Submitted. A maintainer will review it shortly.", "ok");
      } catch (err) {
        const msg = String(err.message || err);
        // If the token is no longer valid, clear it and offer to re-auth.
        if (/HTTP 401/.test(msg) || /Not authorized/.test(msg)) {
          clearToken();
          this.flashSubmit("Session expired. Click Submit again to re-authorize.", "error");
        } else {
          this.flashSubmit(msg, "error");
        }
      }
    },
    async onAuthAuthorized(token) {
      storeToken(token);
      this.showAuthDialog = false;
      const pending = this._pendingSubmit;
      this._pendingSubmit = null;
      if (pending) {
        const meta = await this._buildMeta(token);
        await this._doSubmit(pending.payload, pending.filename, meta, token);
      }
    },
    onAuthClose() {
      this.showAuthDialog = false;
      this._pendingSubmit = null;
    },
    setMode(next) {
      if (next !== "build" && next !== "browse") return;
      this.mode = next;
      if (typeof window !== "undefined" && window.history && window.history.replaceState) {
        const hash = next === "browse" ? "#browse" : "";
        window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
      }
    },
    onToggleMode() {
      this.setMode(this.mode === "browse" ? "build" : "browse");
    }
  }
});

app.component("deck-input", DeckInput);
app.component("sample-cards", SampleCards);
app.component("guide-toolbar", GuideToolbar);
app.component("deck-grid", DeckGrid);
app.component("print-view", PrintView);
app.component("card-preview", CardPreview);
app.component("guide-browser", GuideBrowser);
app.component("guide-library", GuideLibrary);
app.component("device-auth-dialog", DeviceAuthDialog);

// Handle ?preview=<url> before mounting: fetch that guide and load it.
(async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const previewUrl = params.get("preview");
    if (previewUrl) {
      const res = await fetch(previewUrl, { cache: "no-cache" });
      if (res.ok) {
        const text = await res.text();
        const { parseShare } = await import("./persistence.js");
        const parsed = parseShare(text);
        if (parsed && !parsed.error) {
          // Apply after mount so reactive state flows through.
          const appInstance = app.mount("#app");
          await appInstance.onLoadSharedGuide(parsed);
          return;
        }
      }
    }
  } catch (_) {
    // Fall through to normal mount.
  }
  app.mount("#app");
})();