// DeckGrid: matchups on the left, plan focus on the right.
//
// Layout:
//   +------------------------+---------------------------------------+
//   | Matchups               | vs Mono-Red Burn                      |
//   | [ Mono-Red Burn ]  *   |                                       |
//   | [ Affinity ]           | Card        | Plan                    |
//   | [ Bogles ]             | 4 Bolt      | OUT 4                   |
//   | ...                    | 4 Ponder    | IN 2                    |
//   | [+ Add matchup]        | ...                                   |
//   |                        |                                       |
//   |                        | Board totals: IN 4 / OUT 4 / Bal 0    |
//   +------------------------+---------------------------------------+
//
// - The left list shows every matchup. Click to focus.
// - Rename/remove affordances appear on the focused matchup.
// - The right pane shows the selected matchup's plan for every card.
// - Click a cell to cycle (maindeck -> OUT first, sideboard -> IN first).
// - Right-click a cell for partial counts.

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

import { store } from "../store.js";

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
      localName: "",
      selectedMatchup: null
    };
  },
  watch: {
    deckName: {
      immediate: true,
      handler(v) { this.localName = v || ""; }
    },
    // Keep the selected matchup valid when the list changes.
    matchups: {
      immediate: true,
      handler(list) {
        if (!list || !list.length) {
          this.selectedMatchup = null;
          return;
        }
        if (!this.selectedMatchup || !list.includes(this.selectedMatchup)) {
          this.selectedMatchup = list[0];
        }
      }
    }
  },
  computed: {
    sections() {
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
    },
    activeMatchup() {
      if (!this.matchups || !this.matchups.length) return null;
      return this.selectedMatchup && this.matchups.includes(this.selectedMatchup)
        ? this.selectedMatchup
        : this.matchups[0];
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
    onCellClick(cardName, evt) {
      const matchup = this.activeMatchup;
      if (!matchup) return;
      if (this.popover && this.popover.cardName === cardName && this.popover.matchup === matchup) return;
      this.closePopover();
      const section = this.isMaindeck(cardName) ? "main" : "side";
      this.$emit("toggle-card", cardName, matchup, section);
    },
    onCellContext(cardName, evt) {
      const matchup = this.activeMatchup;
      if (!matchup) return;
      evt.preventDefault();
      evt.stopPropagation();
      this.openPopover(cardName, matchup, evt.currentTarget);
    },
    onEditChip(cardName, evt) {
      const matchup = this.activeMatchup;
      if (!matchup) return;
      evt.preventDefault();
      evt.stopPropagation();
      this.openPopover(cardName, matchup, evt.currentTarget.closest(".toggle-cell"));
    },

    // --- Matchup selection ---
    selectMatchup(name) {
      if (this.selectedMatchup === name) return;
      this.selectedMatchup = name;
      this.closePopover();
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

    // --- Card hover preview ---
    onCardHover(row, evt) {
      if (!row.card) return;
      store.hoveredCard = row.card;
      this.onCardHoverMove(evt);
    },
    onCardHoverMove(evt) {
      store.hoveredCardPos = { x: evt.clientX, y: evt.clientY };
    },
    onCardHoverEnd() {
      store.hoveredCard = null;
    },

    // --- Deck name ---
    onNameInput(v) {
      this.localName = v;
    },
    onNameBlur() {
      const v = (this.localName || "").trim();
      this.$emit("update:deck-name", v);
    },

    inTotal(matchup) {
      if (!matchup) return 0;
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
    outTotal(matchup) {
      if (!matchup) return 0;
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

      <div class="matchup-tabs" role="tablist" aria-label="Matchups">
        <span class="matchup-tabs-label">Matchups:</span>

        <button
          v-for="m in matchups"
          :key="m"
          type="button"
          role="tab"
          :aria-selected="m === activeMatchup ? 'true' : 'false'"
          class="matchup-tab"
          :class="{ 'is-active': m === activeMatchup }"
          @click="selectMatchup(m)"
          @dblclick="beginRenameMatchup(m, $event)"
        >
          <template v-if="renamingMatchup === m">
            <input
              ref="renameInput"
              type="text"
              class="matchup-tab-rename"
              v-model="renameDraft"
              @click.stop
              @keydown.enter.prevent="commitRenameMatchup"
              @keydown.esc.prevent="cancelRenameMatchup"
              @blur="commitRenameMatchup"
            />
          </template>
          <template v-else>
            <span class="matchup-tab-name">{{ m }}</span>
            <span
              class="matchup-tab-remove"
              :title="'Remove ' + m"
              @click.stop="onRemoveMatchup(m, $event)"
            >&times;</span>
          </template>
        </button>

        <template v-if="addingMatchup">
          <input
            ref="newMatchupInput"
            type="text"
            class="matchup-tab-rename"
            v-model="newMatchup"
            placeholder="Matchup name"
            aria-label="New matchup name"
            @keydown.enter.prevent="commitAddMatchup"
            @keydown.esc.prevent="cancelAddMatchup"
            @blur="commitAddMatchup"
          />
        </template>
        <template v-else>
          <button
            type="button"
            class="matchup-tab matchup-tab-add"
            @click="beginAddMatchup"
          >+ Add matchup</button>
        </template>
      </div>

      <div class="matchup-focus">
        <header class="matchup-focus-header">
          <template v-if="activeMatchup">
            <span class="matchup-focus-label">vs</span>
            <span class="matchup-focus-name">{{ activeMatchup }}</span>
            <span
              class="matchup-focus-balance"
              :class="{ 'net-ok': balanceFor(activeMatchup) === 0, 'net-bad': balanceFor(activeMatchup) !== 0 }"
            >
              IN {{ inTotal(activeMatchup) }} &middot; OUT {{ outTotal(activeMatchup) }}
              <template v-if="balanceFor(activeMatchup) !== 0">
                &middot; off by {{ balanceFor(activeMatchup) > 0 ? '+' + balanceFor(activeMatchup) : balanceFor(activeMatchup) }}
              </template>
              <template v-else>
                &middot; balanced
              </template>
            </span>
          </template>
          <template v-else>
            <span class="matchup-focus-name">Decklist</span>
            <span class="matchup-focus-balance matchup-focus-hint">
              Add a matchup above to start planning.
            </span>
          </template>
        </header>

        <div class="guide-table-wrap">
          <table class="guide-table">
            <thead>
              <tr>
                <th class="card-col">Card</th>
                <th class="matchup-plan-col">Plan</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(section, si) in sections" :key="'sec-' + si">
                <tr v-if="section.isDivider" class="section-row sideboard-divider">
                  <td colspan="2">Sideboard</td>
                </tr>
                <tr v-else class="section-row">
                  <td colspan="2">{{ section.bucket }}</td>
                </tr>
                <tr v-for="row in section.rows" :key="'r-' + si + '-' + row.name">
                  <th class="card-col">
                    <button
                      v-if="row.card"
                      type="button"
                      class="card-preview-icon"
                      :title="'Preview ' + row.name"
                      :aria-label="'Preview ' + row.name"
                      @mouseenter="onCardHover(row, $event)"
                      @mousemove="onCardHoverMove($event)"
                      @mouseleave="onCardHoverEnd"
                      @click.stop
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </button>
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
                    class="toggle-cell"
                    :class="activeMatchup ? cellClass(row.name, activeMatchup) : 'toggle-cell-idle'"
                    @click="activeMatchup && onCellClick(row.name, $event)"
                    @contextmenu="activeMatchup && onCellContext(row.name, $event)"
                    :title="activeMatchup ? 'Left-click to cycle. Right-click for partial counts.' : 'Add a matchup above to plan this card.'"
                  >
                    <template v-if="activeMatchup">
                      <span>{{ cellLabel(row.name, activeMatchup) }}</span>
                      <span
                        v-if="entryFor(row.name, activeMatchup)"
                        class="edit-hint"
                        @click="onEditChip(row.name, $event)"
                        title="Edit partial count"
                      >&#9998;</span>
                    </template>
                    <template v-else>
                      <span class="toggle-cell-placeholder">&mdash;</span>
                    </template>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
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