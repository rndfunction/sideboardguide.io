// Toolbar: format + quick-add + export/import + browse/submit + print toggle.
import {
  loadPresets,
  FORMAT_LIST,
  getLastFormat,
  setLastFormat,
  downloadShare,
  parseShare
} from "../persistence.js";

const GuideToolbar = {
  props: {
    deckName: { type: String, default: "" },
    rawText: { type: String, default: "" },
    matchups: { type: Array, default: () => [] },
    plan: { type: Object, default: () => ({}) },
    printOpen: { type: Boolean, default: false },
    // Extra state needed for the JSON share payload (title card prefs etc.).
    format: { type: String, default: "" },
    archetype: { type: String, default: "" },
    titleColor: { type: String, default: null },
    titleFontKey: { type: String, default: null },
    titleSymbol: { type: String, default: null },
    titleTexture: { type: String, default: null },
    titleTextureIntensity: { type: String, default: null }
  },
  emits: ["add-matchups", "toggle-print", "import-share", "browse-guides", "submit-guide"],
  data() {
    return {
      lastMessage: "",
      lastMessageClass: "ok",
      presetFormat: getLastFormat(),
      // Populated in mounted() from /presets.json (or the built-in fallback).
      presets: {}
    };
  },
  async mounted() {
    try {
      this.presets = await loadPresets();
    } catch (_) {
      this.presets = {};
    }
  },
  watch: {
    presetFormat(val) {
      setLastFormat(val);
    }
  },
  computed: {
    presetFormats() {
      return FORMAT_LIST;
    },
    presetList() {
      return this.presets[this.presetFormat] || [];
    },
    newPresets() {
      // Only show presets that aren't already added.
      return this.presetList.filter((m) => !this.matchups.includes(m));
    }
  },
  methods: {
    flash(msg, cls) {
      this.lastMessage = msg;
      this.lastMessageClass = cls || "ok";
      setTimeout(() => { this.lastMessage = ""; }, 2500);
    },
    onAddPreset(matchup) {
      this.$emit("add-matchups", [matchup]);
    },
    onAddAllPresets() {
      if (!this.newPresets.length) return;
      this.$emit("add-matchups", this.newPresets.slice());
    },
    onTogglePrint() {
      this.$emit("toggle-print");
    },
    onExportShare() {
      downloadShare({
        deckName: this.deckName,
        format: this.format,
        archetype: this.archetype,
        rawText: this.rawText,
        matchups: this.matchups,
        plan: this.plan,
        titleColor: this.titleColor,
        titleFontKey: this.titleFontKey,
        titleSymbol: this.titleSymbol,
        titleTexture: this.titleTexture,
        titleTextureIntensity: this.titleTextureIntensity
      });
      this.flash("Downloaded share file.", "ok");
    },
    onImportShareClick() {
      const el = this.$refs.importShareInput;
      if (el) el.click();
    },
    onImportShareChange(evt) {
      const file = evt.target.files && evt.target.files[0];
      evt.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseShare(String(reader.result || ""));
        if (parsed.error) {
          this.flash(parsed.error, "error");
          return;
        }
        this.$emit("import-share", parsed);
        this.flash("Loaded shared guide.", "ok");
      };
      reader.onerror = () => this.flash("Could not read file.", "error");
      reader.readAsText(file);
    }
  },
  template: `
    <div class="guide-toolbar">
      <div class="toolbar-row toolbar-row-primary">
        <label class="usa-sr-only" for="preset-format">Format</label>
        <select id="preset-format" class="usa-select toolbar-format-select" v-model="presetFormat">
          <option v-for="f in presetFormats" :key="f" :value="f">Format: {{ f }}</option>
        </select>
        <div class="toolbar-actions">
          <button type="button" class="usa-button usa-button--outline" @click="onExportShare" title="Download this guide as a .json file">Export</button>
          <button type="button" class="usa-button usa-button--outline" @click="onImportShareClick" title="Load a guide from a .json file">Import</button>
          <input
            ref="importShareInput"
            type="file"
            accept=".json,application/json"
            class="toolbar-import-input"
            @change="onImportShareChange"
          />
          <button type="button" class="usa-button usa-button--outline" @click="$emit('browse-guides')" title="Browse community-submitted guides">
            Browse
          </button>
          <button type="button" class="usa-button usa-button--outline" @click="$emit('submit-guide')" title="Submit this guide to the community repository">
            Submit
          </button>
          <button type="button" class="usa-button" @click="onTogglePrint">
            {{ printOpen ? "Hide print preview" : "Show print preview" }}
          </button>
        </div>
        <span v-if="lastMessage" class="toolbar-msg" :class="lastMessageClass">{{ lastMessage }}</span>
      </div>

      <div class="toolbar-row toolbar-row-preset-label">
        <span class="preset-label">Quick-add:</span>
      </div>

      <div class="toolbar-row toolbar-row-presets">
        <button
          v-for="m in newPresets.slice(0, 10)"
          :key="m"
          type="button"
          class="usa-button usa-button--unstyled preset-chip"
          @click="onAddPreset(m)"
        >+ {{ m }}</button>
        <button
          v-if="newPresets.length > 1"
          type="button"
          class="usa-button usa-button--outline preset-chip"
          @click="onAddAllPresets"
        >Add all</button>
      </div>
    </div>
  `
};

export default GuideToolbar;