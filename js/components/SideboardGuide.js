// Sideboard guide: matchup columns, card rows, per-copy IN/OUT plans.
//
// Cell interaction:
//   Left-click  -> cycle null -> IN(all) -> OUT(all) -> null
//   Right-click -> open numeric popover (or the small pencil chip when planned)
//   Popover     -> IN: 1..N / OUT: 1..N / Clear, closes on outside click or Escape
//
// Plan shape (from store): plan[cardName][matchup] = { dir: "in"|"out", count: N }
// Legacy string values ("in"/"out") are tolerated on read.

function manaSymbols(manaCost) {
  if (!manaCost) return [];
  const syms = [];
  const re = /\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(manaCost)) !== null) {
    syms.push(m[1]);
  }
  return syms;
}

const SideboardGuide = {
  props: {
    deck: { type: Object, required: true },
    matchups: { type: Array, default: () => [] },
    plan: { type: Object, default: () => ({}) }
  },
  emits: ["add-matchup", "rename-matchup", "remove-matchup", "toggle-card", "set-card-plan"],
  data() {
    return {
      newMatchup: "",
      popover: null, // { cardName, matchup, top, left, flipUp } or null
      renamingMatchup: null,
      renameDraft: ""
    };
  },
  computed: {
    mainRows() {
      return this.rowsFor(this.deck.mainboard || []);
    },
    sideRows() {
      return this.rowsFor(this.deck.sideboard || []);
    },
    copiesByName() {
      // Map of card name -> total copies across main + side.
      const m = new Map();
      const add = (list) => {
        for (const e of list) {
          m.set(e.name, (m.get(e.name) || 0) + e.count);
        }
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
    rowsFor(list) {
      const byName = new Map();
      for (const e of list) {
        const key = e.name;
        if (!byName.has(key)) {
          byName.set(key, { name: e.name, count: 0, card: e.card });
        }
        byName.get(key).count += e.count;
      }
      return Array.from(byName.values());
    },
    copiesFor(cardName) {
      return this.copiesByName.get(cardName) || 1;
    },

    /**
     * Normalize a plan entry to { dir, count } | null.
     */
    entryFor(cardName, matchup) {
      const cardPlan = this.plan[cardName];
      if (!cardPlan) return null;
      const entry = cardPlan[matchup];
      if (!entry) return null;
      if (typeof entry === "string") {
        return { dir: entry, count: this.copiesFor(cardName) };
      }
      return entry;
    },

    cellLabel(cardName, matchup) {
      const e = this.entryFor(cardName, matchup);
      if (!e) return "";
      // Always show the count next to IN/OUT so the reader can act without
      // recalling how many copies the deck plays.
      const dirLabel = e.dir === "in" ? "IN" : "OUT";
      return dirLabel + " " + e.count;
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

    isPartial(cardName, matchup) {
      const e = this.entryFor(cardName, matchup);
      if (!e) return false;
      return e.count < this.copiesFor(cardName);
    },

    /**
     * Left-click: cycle. Right-click: open popover.
     */
    onCellClick(cardName, matchup, evt, section) {
      // If the popover is already open for this cell, do nothing
      // (let the popover's own click handlers manage it).
      if (this.popover && this.popover.cardName === cardName && this.popover.matchup === matchup) {
        return;
      }
      this.closePopover();
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

    openPopover(cardName, matchup, cellEl) {
      if (!cellEl) return;
      const rect = cellEl.getBoundingClientRect();
      const popW = 200;
      const popH = 120; // approximate
      const viewH = window.innerHeight;
      const viewW = window.innerWidth;

      let top = rect.bottom + window.scrollY + 4;
      let flipUp = false;
      if (rect.bottom + popH > viewH - 10) {
        top = rect.top + window.scrollY - popH - 4;
        flipUp = true;
      }
      let left = rect.left + window.scrollX;
      if (left + popW > viewW - 10) {
        left = Math.max(4, viewW - popW - 10);
      }

      this.popover = { cardName, matchup, top, left, flipUp };
    },

    closePopover() {
      this.popover = null;
    },

    onPopoverPick(dir, count) {
      if (!this.popover) return;
      this.$emit("set-card-plan", this.popover.cardName, this.popover.matchup, dir, count);
      this.closePopover();
    },

    onPopoverClear() {
      if (!this.popover) return;
      this.$emit("set-card-plan", this.popover.cardName, this.popover.matchup, null, 0);
      this.closePopover();
    },

    onDocumentClick(evt) {
      if (!this.popover) return;
      // If the click was inside the popover, let the popover handle it.
      const pop = this.$refs.popover;
      if (pop && pop.contains(evt.target)) return;
      this.closePopover();
    },

    onDocumentKey(evt) {
      if (evt.key === "Escape") this.closePopover();
    },

    onAddMatchup() {
      const name = this.newMatchup.trim();
      if (!name) return;
      this.$emit("add-matchup", name);
      this.newMatchup = "";
    },

    onRemoveMatchup(name) {
      this.closePopover();
      this.$emit("remove-matchup", name);
    },

    beginRenameMatchup(name, evt) {
      evt.stopPropagation();
      this.renamingMatchup = name;
      this.renameDraft = name;
      this.$nextTick(() => {
        const input = this.$refs.renameInput;
        const el = Array.isArray(input) ? input[0] : input;
        if (el && el.focus) el.focus();
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

    /**
     * Net totals for a section, summing counts. E.g. "+3 / -2".
     */
    sectionSummary(section, matchup) {
      const rows = section === "main" ? this.mainRows : this.sideRows;
      let inCount = 0;
      let outCount = 0;
      for (const r of rows) {
        const e = this.entryFor(r.name, matchup);
        if (!e) continue;
        if (e.dir === "in") inCount += e.count;
        else if (e.dir === "out") outCount += e.count;
      }
      if (!inCount && !outCount) return "";
      const parts = [];
      if (inCount) parts.push("+" + inCount);
      if (outCount) parts.push("-" + outCount);
      return parts.join(" / ");
    },

    /**
     * Net change to maindeck size for a matchup.
     * In-main + in-side (moved in) = net gain; out-main - out-side = net loss.
     * Useful sanity check that should net to 0.
     */
    netMainChange(matchup) {
      let net = 0;
      for (const r of this.mainRows) {
        const e = this.entryFor(r.name, matchup);
        if (!e) continue;
        if (e.dir === "in") net += e.count;
        else if (e.dir === "out") net -= e.count;
      }
      return net;
    }
  },
  template: `
    <section class="sideboard-guide">
      <h3>Sideboard Guide</h3>
      <p style="color:#555;font-size:0.9rem;">
        Click a cell to cycle: blank &rarr; IN (all) &rarr; OUT (all) &rarr; blank.
        Right-click a cell to set a partial count (e.g. board out only 2 of 4).
      </p>

      <div class="matchup-header">
        <div class="matchup-input">
          <label class="usa-sr-only" for="matchup-new">Add matchup</label>
          <input
            id="matchup-new"
            type="text"
            v-model="newMatchup"
            placeholder="e.g. Mono-Red Burn, Affinity, Bogles"
            @keydown.enter.prevent="onAddMatchup"
          />
          <button type="button" class="usa-button usa-button--outline" @click="onAddMatchup">Add matchup</button>
        </div>
      </div>

      <div v-if="!matchups.length" class="empty-state">
        No matchups yet. Add one above to start building the guide.
      </div>

      <div v-else class="guide-table-wrap">
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
                      @click.stop="onRemoveMatchup(m)"
                    >&times;</button>
                  </template>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="section-row">
              <td :colspan="matchups.length + 1">Maindeck</td>
            </tr>
            <tr v-for="row in mainRows" :key="'m-' + row.name">
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
                :key="'m-' + row.name + '-' + m"
                class="toggle-cell"
                :class="cellClass(row.name, m)"
                @click="onCellClick(row.name, m, $event, 'main')"
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
            </tr>

            <tr class="section-row">
              <td :colspan="matchups.length + 1">Sideboard</td>
            </tr>
            <tr v-for="row in sideRows" :key="'s-' + row.name">
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
                :key="'s-' + row.name + '-' + m"
                class="toggle-cell"
                :class="cellClass(row.name, m)"
                @click="onCellClick(row.name, m, $event, 'side')"
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
            </tr>

            <tr class="section-row">
              <td :colspan="matchups.length + 1">Net totals (main should equal side)</td>
            </tr>
            <tr>
              <th class="card-col">Main &plusmn;</th>
              <td v-for="m in matchups" :key="'nm-' + m" style="text-align:center;">
                {{ sectionSummary('main', m) || '&mdash;' }}
              </td>
            </tr>
            <tr>
              <th class="card-col">Side &plusmn;</th>
              <td v-for="m in matchups" :key="'ns-' + m" style="text-align:center;">
                {{ sectionSummary('side', m) || '&mdash;' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating popover for partial plan counts -->
      <div
        v-if="popover"
        ref="popover"
        class="plan-popover"
        :style="{ top: popover.top + 'px', left: popover.left + 'px', position: 'absolute' }"
        @click.stop
      >
        <h5>{{ popover.cardName }} &middot; {{ popover.matchup }}</h5>
        <div class="plan-popover-row">
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
        <div class="plan-popover-row">
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

export default SideboardGuide;