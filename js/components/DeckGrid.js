// DeckGrid: single unified grid for the deck list + sideboard guide.
//
// Layout:
//   +----------------+-------+-------+-------+-----------+
//   | Card           | MU 1  | MU 2  | ...   | + Add MU  |
//   +----------------+-------+-------+-------+-----------+
//   | 4 Lightning ...| OUT 4 |       |       |           |
//   | 4 Ponder       |       | IN 2  |       |           |
//   | ...            |       |       |       |           |
//
// - Cards grouped by type (Creature, Instant, ..., Land) with a divider row.
// - Matchup columns start empty. "+ Add matchup" opens an inline input; on
//   commit, the new column appears at the right.
// - Click a cell to cycle (context-aware: maindeck -> OUT first,
//   sideboard -> IN first).
// - Right-click a cell (or the pencil chip) to set a partial count.
// - Header deck-name field is editable and emits update:deckName.

const TYPE_ORDER = ["Creature", "Planeswalker", "Instant", "Sorcery", "Enchantment", "Artifact", "Battle", "Land", "Other"];

function typeBucket(typeLine) {
  const t = (typeLine || "").toLowerCase();
  if (t.includes("land")) return "Land";
  if (t.includes("creature")) return "Creature";
  if (t.includes("planeswalker")) return "Planeswalker";
  if (t.includes("instant")) return "Instant";
  if (t.includes("sorcery")) return "Sorcery";
  if (t.includes("enchantment")) return "Enchantment";
  if (t.includes("artifact")) return "Artifact";
  if (t.includes("battle")) return "Battle";
  return "Other";
}

function bucketSortKey(bucket) {
  const i = TYPE_ORDER.indexOf(bucket);
  return i === -1 ? TYPE_ORDER.length : i;
}

function manaSymbols(manaCost) {
  if (!manaCost) return [];
  const syms = [];
  const re = /\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(manaCost)) !== null) syms.push(m[1]);
  return syms;
}

const DeckGrid = {
  props: {
    deck: { type: Object, required: true },
    matchups: { type: Array, default: () => [] },
    plan: { type: Object, default: () => ({}) },
    deckName: { type: String, default: "" }
  },
  emits: ["add-matchup", "rename-matchup", "remove-matchup", "toggle-card", "set-card-plan", "update:deck-name"],
  data() {
    return {
      newMatchup: "",
      addingMatchup: false,
      renamingMatchup: null,
      renameDraft: "",
      popover: null, // { cardName, matchup, top, left }
      localName: ""
    };
  },
  watch: {
    deckName: {
      immediate: true,
      handler(v) { this.localName = v || ""; }
    }
  },
  computed: {
    sections() {
      // Merge main + side into one ordered set of sections.
      // Main first, then a synthetic "Sideboard" divider, then side.
      const mainSections = this.sectionsFor(this.deck.mainboard || []);
      const sideSections = this.sectionsFor(this.deck.sideboard || []);
      const out = [];
      for (const s of mainSections) out.push({ ...s, isSide: false });
      if (sideSections.length) {
        out.push({ bucket: "Sideboard", rows: [], isSide: true, isDivider: true });
        for (const s of sideSections) out.push({ ...s, isSide: true });
      }
      return out;
    },
    copiesByName() {
      const m = new Map();
      const add = (list) => {
        for (const e of list) m.set(e.name, (m.get(e.name) || 0) + e.count);
      };
      add(this.deck.mainboard || []);
      add(this.deck.sideboard || []);
      return m;
    }
  },
  mounted() {
    document.addEventListener("click", this.onDocumentClick);
    document.addEventListener("keydown", this.onDocumentKey);
  },
  beforeUnmount() {
    document.removeEventListener("click", this.onDocumentClick);
    document.removeEventListener("keydown", this.onDocumentKey);
  },
  methods: {
    sectionsFor(list) {
      const byName = new Map();
      for (const e of list) {
        if (!byName.has(e.name)) {
          byName.set(e.name, {
            name: e.name,
            count: 0,
            card: e.card,
            bucket: typeBucket(e.card && e.card.type_line)
          });
        }
        byName.get(e.name).count += e.count;
      }
      const rows = Array.from(byName.values());
      rows.sort((a, b) => {
        const ba = bucketSortKey(a.bucket);
        const bb = bucketSortKey(b.bucket);
        if (ba !== bb) return ba - bb;
        const ca = a.card ? a.card.cmc : 0;
        const cb = b.card ? b.card.cmc : 0;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      });
      const sections = [];
      let current = null;
      for (const r of rows) {
        if (!current || current.bucket !== r.bucket) {
          current = { bucket: r.bucket, rows: [] };
          sections.push(current);
        }
        current.rows.push(r);
      }
      return sections;
    },

    manaSymbols,
    manaClass(sym) {
      if (!sym) return "ms-C";
      const up = String(sym).toUpperCase();
      if (up.includes("W")) return "ms-W";
      if (up.includes("U")) return "ms-U";
      if (up.includes("B")) return "ms-B";
      if (up.includes("R")) return "ms-R";
      if (up.includes("G")) return "ms-G";
      return "ms-C";
    },
    symbolText(sym) {
      if (!sym) return "";
      const s = String(sym);
      if (s.length === 1) return s;
      const num = s.match(/^\d+/);
      if (num) return num[0];
      const letter = s.match(/[WUBRGC]/i);
      return letter ? letter[0].toUpperCase() : s[0];
    },
    copiesFor(cardName) {
      return this.copiesByName.get(cardName) || 1;
    },
    isMaindeck(cardName) {
      for (const e of this.deck.mainboard || []) if (e.name === cardName) return true;
      return false;
    },

    entryFor(cardName, matchup) {
      const cardPlan = this.plan[cardName];
      if (!cardPlan) return null;
      const entry = cardPlan[matchup];
      if (!entry) return null;
      if (typeof entry === "string") return { dir: entry, count: this.copiesFor(cardName) };
      return entry;
    },
    cellLabel(cardName, matchup) {
      const e = this.entryFor(cardName, matchup);
      if (!e) return "";
      const dir = e.dir === "in" ? "IN" : "OUT";
      return dir + " " + e.count;
    },
    cellClass(cardName, matchup) {
      const e = this.entryFor(cardName, matchup);
      const full = this.copiesFor(cardName);
      const partial = e && e.count < full;
      return {
        "state-in": e && e.dir === "in",
        "state-out": e && e.dir === "out",
        partial: !!partial
      };
    },
    onCellClick(cardName, matchup, evt) {
      if (this.popover && this.popover.cardName === cardName && this.popover.matchup === matchup) return;
      this.closePopover();
      const section = this.isMaindeck(cardName) ? "main" : "side";
      this.$emit("toggle-card", cardName, matchup, section);
    },
    onCellContext(cardName, matchup, evt) {
      evt.preventDefault();
      evt.stopPropagation();
      this.openPopover(cardName, matchup, evt.currentTarget);
    },
    onEditChip(cardName, matchup, evt) {
      evt.preventDefault();
      evt.stopPropagation();
      this.openPopover(cardName, matchup, evt.currentTarget.closest(".toggle-cell"));
    },

    // --- Add matchup inline ---
    beginAddMatchup() {
      this.addingMatchup = true;
      this.$nextTick(() => {
        const el = this.$refs.newMatchupInput;
        const node = Array.isArray(el) ? el[0] : el;
        if (node && node.focus) node.focus();
      });
    },
    commitAddMatchup() {
      const name = (this.newMatchup || "").trim();
      this.newMatchup = "";
      this.addingMatchup = false;
      if (!name) return;
      this.$emit("add-matchup", name);
    },
    cancelAddMatchup() {
      this.newMatchup = "";
      this.addingMatchup = false;
    },

    // --- Rename matchup ---
    beginRenameMatchup(name, evt) {
      evt.stopPropagation();
      this.renamingMatchup = name;
      this.renameDraft = name;
      this.$nextTick(() => {
        const el = this.$refs.renameInput;
        const node = Array.isArray(el) ? el[0] : el;
        if (node && node.focus) node.focus();
      });
    },
    commitRenameMatchup() {
      if (!this.renamingMatchup) return;
      const oldName = this.renamingMatchup;
      const newName = (this.renameDraft || "").trim();
      this.renamingMatchup = null;
      this.renameDraft = "";
      if (!newName || newName === oldName) return;
      this.$emit("rename-matchup", oldName, newName);
    },
    cancelRenameMatchup() {
      this.renamingMatchup = null;
      this.renameDraft = "";
    },
    onRemoveMatchup(name, evt) {
      evt.stopPropagation();
      this.closePopover();
      this.$emit("remove-matchup", name);
    },

    // --- Popover ---
    openPopover(cardName, matchup, cellEl) {
      if (!cellEl) return;
      const rect = cellEl.getBoundingClientRect();
      const popW = 200;
      const popH = 120;
      const viewH = window.innerHeight;
      const viewW = window.innerWidth;
      let top = rect.bottom + window.scrollY + 4;
      if (rect.bottom + popH > viewH - 10) top = rect.top + window.scrollY - popH - 4;
      let left = rect.left + window.scrollX;
      if (left + popW > viewW - 10) left = Math.max(4, viewW - popW - 10);
      this.popover = { cardName, matchup, top, left };
    },
    closePopover() {
      this.popover = null;
    },
    onPopoverPick(dir, count) {
      if (!this.popover) return;
      this.$emit("set-card-plan", this.popover.cardName, this.popover.matchup, dir, count);
      this.closePopover();
    },
    /** Whether the popover's target card is in the maindeck. */
    popoverIsMain() {
      if (!this.popover) return true;
      return this.isMaindeck(this.popover.cardName);
    },
    onPopoverClear() {
      if (!this.popover) return;
      this.$emit("set-card-plan", this.popover.cardName, this.popover.matchup, null, 0);
      this.closePopover();
    },
    onDocumentClick(evt) {
      if (!this.popover) return;
      const pop = this.$refs.popover;
      if (pop && pop.contains(evt.target)) return;
      this.closePopover();
    },
    onDocumentKey(evt) {
      if (evt.key === "Escape") {
        this.closePopover();
        this.cancelAddMatchup();
        this.cancelRenameMatchup();
      }
    },

    // --- Deck name ---
    onNameInput(v) {
      this.localName = v;
    },
    onNameBlur() {
      const v = (this.localName || "").trim();
      this.$emit("update:deck-name", v);
    },

    /**
     * Sum of IN counts across all cards (main + side) for a matchup.
     */
    inTotal(matchup) {
      let total = 0;
      const visit = (list) => {
        for (const e of list) {
          const entry = this.entryFor(e.name, matchup);
          if (entry && entry.dir === "in") total += entry.count;
        }
      };
      visit(this.deck.mainboard || []);
      visit(this.deck.sideboard || []);
      return total;
    },
    /**
     * Sum of OUT counts across all cards (main + side) for a matchup.
     */
    outTotal(matchup) {
      let total = 0;
      const visit = (list) => {
        for (const e of list) {
          const entry = this.entryFor(e.name, matchup);
          if (entry && entry.dir === "out") total += entry.count;
        }
      };
      visit(this.deck.mainboard || []);
      visit(this.deck.sideboard || []);
      return total;
    },
    /**
     * Balance check: IN - OUT should be 0 for a valid plan. Anything else
     * means the deck no longer has 60 cards after sideboarding.
     */
    balanceFor(matchup) {
      return this.inTotal(matchup) - this.outTotal(matchup);
    }
  },
  template: `
    <section class="deck-grid">
      <header class="deck-grid-header">
        <input
          class="deck-grid-title"
          type="text"
          v-model="localName"
          placeholder="Deck name"
          @blur="onNameBlur"
          aria-label="Deck name"
        />
      </header>

      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead>
            <tr>
              <th class="card-col">Card</th>
              <th v-for="m in matchups" :key="m" class="matchup-th">
                <div class="matchup-th-inner">
                  <template v-if="renamingMatchup === m">
                    <input
                      ref="renameInput"
                      type="text"
                      class="matchup-rename-input"
                      v-model="renameDraft"
                      @keydown.enter.prevent="commitRenameMatchup"
                      @keydown.esc.prevent="cancelRenameMatchup"
                      @blur="commitRenameMatchup"
                    />
                  </template>
                  <template v-else>
                    <span
                      class="matchup-name"
                      :title="m + ' \u2014 double-click to rename'"
                      @dblclick="beginRenameMatchup(m, $event)"
                    >{{ m }}</span>
                    <button
                      type="button"
                      class="matchup-edit"
                      :title="'Rename ' + m"
                      @click="beginRenameMatchup(m, $event)"
                    >&#9998;</button>
                    <button
                      type="button"
                      class="matchup-remove"
                      :title="'Remove ' + m"
                      @click="onRemoveMatchup(m, $event)"
                    >&times;</button>
                  </template>
                </div>
              </th>
              <th class="add-matchup-th">
                <template v-if="addingMatchup">
                  <input
                    ref="newMatchupInput"
                    type="text"
                    class="matchup-rename-input"
                    v-model="newMatchup"
                    placeholder="Matchup name"
                    @keydown.enter.prevent="commitAddMatchup"
                    @keydown.esc.prevent="cancelAddMatchup"
                    @blur="commitAddMatchup"
                  />
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="add-matchup-btn"
                    @click="beginAddMatchup"
                  >+ Add matchup</button>
                </template>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(section, si) in sections" :key="'sec-' + si">
              <tr v-if="section.isDivider" class="section-row sideboard-divider">
                <td :colspan="matchups.length + 2">Sideboard</td>
              </tr>
              <tr v-else class="section-row">
                <td :colspan="matchups.length + 2">{{ section.bucket }}</td>
              </tr>
              <tr v-for="row in section.rows" :key="'r-' + si + '-' + row.name">
                <th class="card-col">
                  <span class="card-count-badge">{{ row.count }}</span>{{ row.name }}
                <span class="mana-cost" v-if="row.card && row.card.mana_cost">
                  <span
                    v-for="(sym, i) in manaSymbols(row.card.mana_cost)"
                    :key="i"
                    class="mana-symbol"
                    :class="manaClass(sym)"
                  >{{ symbolText(sym) }}</span>
                </span>
                </th>
                <td
                  v-for="m in matchups"
                  :key="'c-' + row.name + '-' + m"
                  class="toggle-cell"
                  :class="cellClass(row.name, m)"
                  @click="onCellClick(row.name, m, $event)"
                  @contextmenu="onCellContext(row.name, m, $event)"
                  :title="'Left-click to cycle. Right-click for partial counts.'"
                >
                  <span>{{ cellLabel(row.name, m) }}</span>
                  <span
                    v-if="entryFor(row.name, m)"
                    class="edit-hint"
                    @click="onEditChip(row.name, m, $event)"
                    title="Edit partial count"
                  >&#9998;</span>
                </td>
                <td class="add-matchup-filler"></td>
              </tr>
            </template>

            <tr v-if="matchups.length" class="section-row net-row">
              <td :colspan="matchups.length + 2">Board totals</td>
            </tr>
            <tr v-if="matchups.length">
              <th class="card-col">
                <span class="net-in-label">IN</span>
              </th>
              <td
                v-for="m in matchups"
                :key="'in-total-' + m"
                class="net-cell net-in-cell"
              >{{ inTotal(m) > 0 ? '+' + inTotal(m) : '' }}</td>
              <td class="add-matchup-filler"></td>
            </tr>
            <tr v-if="matchups.length">
              <th class="card-col">
                <span class="net-out-label">OUT</span>
              </th>
              <td
                v-for="m in matchups"
                :key="'out-total-' + m"
                class="net-cell net-out-cell"
              >{{ outTotal(m) > 0 ? '-' + outTotal(m) : '' }}</td>
              <td class="add-matchup-filler"></td>
            </tr>
            <tr v-if="matchups.length">
              <th class="card-col">
                <span class="net-balance-label">Balance</span>
              </th>
              <td
                v-for="m in matchups"
                :key="'bal-' + m"
                class="net-cell net-balance-cell"
                :class="{ 'net-ok': balanceFor(m) === 0, 'net-bad': balanceFor(m) !== 0 }"
              >{{ balanceFor(m) === 0 ? '0' : (balanceFor(m) > 0 ? '+' + balanceFor(m) : balanceFor(m)) }}</td>
              <td class="add-matchup-filler"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="popover"
        ref="popover"
        class="plan-popover"
        :style="{ top: popover.top + 'px', left: popover.left + 'px', position: 'absolute' }"
        @click.stop
      >
        <h5>{{ popover.cardName }} &middot; {{ popover.matchup }}</h5>
        <div v-if="!popoverIsMain" class="plan-popover-row">
          <span class="plan-popover-label">IN</span>
          <button
            v-for="n in copiesFor(popover.cardName)"
            :key="'in-' + n"
            type="button"
            class="plan-popover-btn"
            :class="{ 'active-in': entryFor(popover.cardName, popover.matchup) && entryFor(popover.cardName, popover.matchup).dir === 'in' && entryFor(popover.cardName, popover.matchup).count === n }"
            @click="onPopoverPick('in', n)"
          >{{ n }}</button>
        </div>
        <div v-if="popoverIsMain" class="plan-popover-row">
          <span class="plan-popover-label">OUT</span>
          <button
            v-for="n in copiesFor(popover.cardName)"
            :key="'out-' + n"
            type="button"
            class="plan-popover-btn"
            :class="{ 'active-out': entryFor(popover.cardName, popover.matchup) && entryFor(popover.cardName, popover.matchup).dir === 'out' && entryFor(popover.cardName, popover.matchup).count === n }"
            @click="onPopoverPick('out', n)"
          >{{ n }}</button>
        </div>
        <button type="button" class="plan-popover-clear" @click="onPopoverClear">Clear</button>
      </div>
    </section>
  `
};

export default DeckGrid;