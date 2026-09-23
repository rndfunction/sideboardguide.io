// Bootstrap the Vue app and wire store -> components.
// Vue is loaded as a global (window.Vue) via index.html because FORGE's preview
// VFS rewrites bare-URL ESM imports relative to the importing file (breaking them).
import DeckInput from "./components/DeckInput.js";
import SampleCards from "./components/SampleCards.js";
import GuideToolbar from "./components/GuideToolbar.js";
import DeckGrid from "./components/DeckGrid.js";
import PrintView from "./components/PrintView.js";
import {
  store,
  loadDecklist,
  addMatchup,
  removeMatchup,
  renameMatchup,
  setDeckName,
  cycleCard,
  setCardPlan
} from "./store.js";
import { getLastFormat } from "./persistence.js";

const Vue = window.Vue;
if (!Vue || typeof Vue.createApp !== "function") {
  throw new Error("Vue global not found. Ensure /index.html loads vue.global.prod.js before /js/app.js.");
}

const app = Vue.createApp({
  data() {
    return {
      store,
      showPrint: true,
      selectedFormat: getLastFormat()
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
    onSetCardPlan(cardName, matchup, dir, count) { setCardPlan(cardName, matchup, dir, count); },
    async onLoadState(saved) {
      if (saved.rawText) {
        await loadDecklist(saved.rawText);
      }
      if (Array.isArray(saved.matchups)) {
        store.matchups = saved.matchups.slice();
      }
      if (saved.plan && typeof saved.plan === "object") {
        store.plan = JSON.parse(JSON.stringify(saved.plan));
      }
      if (saved.deckName) {
        store.deckName = saved.deckName;
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
    }
  }
});

app.component("deck-input", DeckInput);
app.component("sample-cards", SampleCards);
app.component("guide-toolbar", GuideToolbar);
app.component("deck-grid", DeckGrid);
app.component("print-view", PrintView);
app.mount("#app");