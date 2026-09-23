// Toolbar: save/load/forget + print-preview toggle + preset matchups.
import {
  saveGuide,
  loadGuide,
  clearSaved,
  PRESET_MATCHUPS,
  FORMAT_LIST,
  getLastFormat,
  setLastFormat
} from "../persistence.js";

const GuideToolbar = {
  props: {
    deckName: { type: String, default: "" },
    rawText: { type: String, default: "" },
    matchups: { type: Array, default: () => [] },
    plan: { type: Object, default: () => ({}) },
    printOpen: { type: Boolean, default: false }
  },
  emits: ["load-state", "add-matchups", "toggle-print"],
  data() {
    return {
      lastMessage: "",
      lastMessageClass: "ok",
      presetFormat: getLastFormat()
    };
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
      return PRESET_MATCHUPS[this.presetFormat] || [];
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
    onSave() {
      const r = saveGuide({
        rawText: this.rawText,
        matchups: this.matchups,
        plan: this.plan,
        deckName: this.deckName
      });
      if (r.ok) this.flash("Saved locally.", "ok");
      else this.flash("Save failed: " + (r.error || "unknown"), "error");
    },
    onLoad() {
      const saved = loadGuide();
      if (!saved) { this.flash("No saved guide found.", "error"); return; }
      this.$emit("load-state", saved);
      this.flash("Loaded saved guide.", "ok");
    },
    onClear() {
      clearSaved();
      this.flash("Saved guide forgotten.", "ok");
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
    }
  },
  template: `
    <div class="guide-toolbar">
      <div class="toolbar-row">
        <button type="button" class="usa-button usa-button--outline" @click="onSave">Save</button>
        <button type="button" class="usa-button usa-button--outline" @click="onLoad">Load</button>
        <button type="button" class="usa-button usa-button--outline" @click="onClear">Forget</button>
        <button type="button" class="usa-button" @click="onTogglePrint">
          {{ printOpen ? "Hide print preview" : "Show print preview" }}
        </button>
        <span v-if="lastMessage" class="toolbar-msg" :class="lastMessageClass">{{ lastMessage }}</span>
      </div>

      <div class="toolbar-row">
        <label class="usa-sr-only" for="preset-format">Format</label>
        <select id="preset-format" class="usa-select" v-model="presetFormat" style="max-width:12rem;">
          <option v-for="f in presetFormats" :key="f" :value="f">{{ f }}</option>
        </select>
        <span class="preset-label">Quick-add:</span>
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