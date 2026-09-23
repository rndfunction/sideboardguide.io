// Deck input component: textarea + parse button + status.
// Collapses to a single-line summary after a successful parse.
// Expanded view is two-column: textarea on the left, file-upload and
// helper actions on the right.
const DeckInput = {
  props: {
    parsed: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: null }
  },
  emits: ["parse", "reset"],
  data() {
    return {
      text: "",
      expanded: true,
      dragOver: false,
      fileError: "",
      example: [
        "4 Lightning Bolt",
        "4 Counterspell",
        "4 Snapcaster Mage",
        "2 Force of Will",
        "20 Island",
        "4 Scalding Tarn",
        "",
        "3 Surgical Extraction",
        "2 Pyroblast",
        "2 Hydroblast"
      ].join("\n"),
      placeholder: [
        "Paste a decklist. Examples:",
        "4 Lightning Bolt",
        "4x Counterspell",
        "2 Snapcaster Mage (ISD) 78",
        "",
        "Sideboard",
        "3 Force of Will",
        "2 Surgical Extraction",
        "",
        "Or use the MTGGoldfish style (blank line before sideboard):",
        "4 Elvish Mystic",
        "9 Forest",
        "",
        "3 Faerie Macabre",
        "3 Gnaw to the Bone"
      ].join("\n")
    };
  },
  computed: {
    canParse() {
      return !this.loading && this.text.trim().length > 0;
    },
    hasParsed() {
      return this.parsed && this.parsed.mainboard && this.parsed.mainboard.length > 0;
    },
    summary() {
      if (!this.hasParsed) return "";
      const mainCount = this.parsed.mainboard.reduce((a, e) => a + e.count, 0);
      const sideCount = (this.parsed.sideboard || []).reduce((a, e) => a + e.count, 0);
      return mainCount + " maindeck, " + sideCount + " sideboard";
    }
  },
  mounted() {
    // Nudge focus to the textarea so a Ctrl/Cmd+V is one keystroke away.
    this.$nextTick(() => {
      const ta = this.$refs.textareaEl;
      if (ta && ta.focus && !this.hasParsed) ta.focus();
    });
  },
  watch: {
    hasParsed(val) {
      if (val) this.expanded = false;
    }
  },
  methods: {
    onParse() {
      if (!this.canParse) return;
      this.fileError = "";
      this.$emit("parse", this.text);
    },
    onReset() {
      this.text = "";
      this.expanded = true;
      this.fileError = "";
      this.$emit("reset");
    },
    toggleExpanded() {
      this.expanded = !this.expanded;
    },
    loadExample() {
      this.text = this.example;
      this.fileError = "";
      this.expanded = true;
    },
    // --- File upload ---
    triggerFileInput() {
      const el = this.$refs.fileInput;
      if (el) el.click();
    },
    async pasteFromClipboard() {
      this.fileError = "";
      // Clipboard API is not available at all (very old browser).
      if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
        this.fallbackToManualPaste(
          "Clipboard access isn't available in this browser. Click the decklist box and press Ctrl/Cmd+V."
        );
        return;
      }
      try {
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
          this.fileError = "The clipboard is empty. Copy a decklist first, then try again.";
          return;
        }
        this.applyFileText(text);
      } catch (err) {
        // Opaque-origin documents (e.g. the FORGE preview iframe, sandboxed
        // <iframe srcdoc>) cannot request the clipboard-read permission no
        // matter what the user does. Distinguish that case with a clearer
        // message; everything else gets a generic prompt.
        const isOpaque = (typeof window !== "undefined" && window.origin === "null")
          || (document.location && document.location.origin === "null");
        const reason = err && err.name ? err.name : "Error";
        const msg = isOpaque
          ? "The preview sandbox blocks clipboard reads. Click the decklist box and press Ctrl/Cmd+V — it'll work here, and the button works fine when the app is deployed."
          : "Couldn't read the clipboard (" + reason + "). Click the decklist box and press Ctrl/Cmd+V.";
        this.fallbackToManualPaste(msg);
      }
    },
    fallbackToManualPaste(message) {
      this.fileError = message;
      // Focus and select the textarea so a Ctrl+V immediately replaces the
      // current content. Defer a tick so the error message renders first.
      this.expanded = true;
      this.$nextTick(() => {
        const ta = this.$refs.textareaEl;
        if (ta && ta.focus) {
          ta.focus();
          if (typeof ta.select === "function") ta.select();
        }
      });
    },
    onFileChange(evt) {
      const file = evt.target.files && evt.target.files[0];
      if (file) this.readFile(file);
      evt.target.value = "";
    },
    onDrop(evt) {
      evt.preventDefault();
      this.dragOver = false;
      const file = evt.dataTransfer.files && evt.dataTransfer.files[0];
      if (file) this.readFile(file);
    },
    onDragOver(evt) {
      evt.preventDefault();
      this.dragOver = true;
    },
    onDragLeave() {
      this.dragOver = false;
    },
    readFile(file) {
      this.fileError = "";
      const name = (file.name || "").toLowerCase();

      // .dek files are MTGO XML with card IDs, not names. Warn the user and
      // guide them to a plain-text export instead of silently failing.
      if (name.endsWith(".dek")) {
        const reader = new FileReader();
        reader.onload = () => {
          const head = String(reader.result || "").slice(0, 200);
          if (/<\?xml|<Deck/i.test(head)) {
            this.fileError =
              "MTGO .dek files store internal card IDs, not names, so we can't read them. " +
              "Export as plain text from Moxfield, MTGGoldfish, or MTG Arena instead.";
          } else {
            this.applyFileText(String(reader.result || ""));
          }
        };
        reader.onerror = () => { this.fileError = "Could not read file."; };
        reader.readAsText(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => this.applyFileText(String(reader.result || ""));
      reader.onerror = () => { this.fileError = "Could not read file."; };
      reader.readAsText(file);
    },
    applyFileText(text) {
      const trimmed = (text || "").replace(/\r\n/g, "\n").trim();
      if (!trimmed) {
        this.fileError = "That file looks empty.";
        return;
      }
      this.text = trimmed;
      this.fileError = "";
      this.expanded = true;
      this.$emit("parse", this.text);
    }
  },
  template: `
    <section class="deck-input">
      <div v-if="hasParsed && !expanded" class="deck-input-collapsed">
        <span class="deck-input-summary">
          <strong>Decklist:</strong> {{ summary }}
        </span>
        <button
          type="button"
          class="usa-button usa-button--outline usa-button--small"
          @click="toggleExpanded"
        >Edit decklist</button>
        <button
          type="button"
          class="usa-button usa-button--unstyled deck-input-reset-link"
          @click="onReset"
        >Clear</button>
      </div>

      <div v-else>
        <label class="usa-label" for="decklist-input">Decklist</label>
        <p class="usa-hint" style="margin-top:0;">
          Paste or upload a decklist. Separate maindeck from sideboard with a blank line, or with a "Sideboard" header.
        </p>

        <div class="deck-input-grid">
          <div
            class="deck-input-textarea-wrap"
            :class="{ 'drag-over': dragOver }"
            @drop="onDrop"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
          >
            <textarea
              id="decklist-input"
              ref="textareaEl"
              class="usa-textarea"
              :placeholder="placeholder"
              v-model="text"
              spellcheck="false"
            ></textarea>
          </div>

          <aside class="deck-input-side">
            <input
              ref="fileInput"
              type="file"
              accept=".txt,.dec,.dek,text/plain"
              class="deck-input-file-hidden"
              @change="onFileChange"
            />
            <button
              type="button"
              class="usa-button deck-input-paste-btn"
              @click="pasteFromClipboard"
            >Paste from clipboard</button>
            <p class="deck-input-side-hint">
              Grab a decklist you've already copied from Moxfield, Arena, or anywhere else.
            </p>

            <button
              type="button"
              class="usa-button usa-button--outline deck-input-upload-btn"
              @click="triggerFileInput"
            >Upload decklist</button>
            <p class="deck-input-side-hint">
              .txt from Moxfield, MTGGoldfish, MTG Arena, or any plain-text export.
            </p>

            <hr class="deck-input-side-divider" />

            <button
              type="button"
              class="usa-button usa-button--outline deck-input-example-btn"
              @click="loadExample"
            >Load example decklist</button>
            <p class="deck-input-side-hint">
              Drag &amp; drop works on the textarea too.
            </p>

            <div v-if="fileError" class="deck-input-file-error">
              {{ fileError }}
            </div>
          </aside>
        </div>

        <div class="deck-input-actions">
          <button
            type="button"
            class="usa-button"
            :disabled="!canParse"
            @click="onParse"
          >
            {{ loading ? "Looking up..." : "Parse & Look Up" }}
          </button>
          <button
            type="button"
            class="usa-button usa-button--outline"
            @click="onReset"
          >Reset</button>
          <button
            v-if="hasParsed"
            type="button"
            class="usa-button usa-button--unstyled"
            @click="toggleExpanded"
          >Collapse</button>
          <span v-if="parsed" class="parse-status ok">
            Maindeck: {{ parsed.mainboard.length }} entries &middot;
            Sideboard: {{ parsed.sideboard.length }} entries
          </span>
        </div>
      </div>

      <div v-if="error" class="parse-status error">{{ error }}</div>
    </section>
  `
};

export default DeckInput;