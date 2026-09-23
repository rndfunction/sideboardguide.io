// PrintCard: renders a single 3in x 4in sideboard guide card.
// Black on white. No images. Sized to fit 3x4in at print scale.

const PrintCard = {
  props: {
    deckName: { type: String, default: "Untitled Deck" },
    format: { type: String, default: "" },
    colors: { type: Array, default: () => [] },
    rows: { type: Array, required: true },
    matchups: { type: Array, required: true }
  },
  computed: {
    fittedDeckName() {
      const n = this.deckName || "Untitled Deck";
      if (n.length <= 22) return { fontSize: "18pt" };
      if (n.length <= 30) return { fontSize: "15pt" };
      if (n.length <= 40) return { fontSize: "13pt" };
      return { fontSize: "11pt" };
    },
    colorPips() {
      return (this.colors || []).join("");
    }
  },
  methods: {
    cellText(row, matchup) {
      const entry = row.planByMatchup && row.planByMatchup[matchup];
      if (!entry) return "";
      const sign = entry.dir === "in" ? "+" : "-";
      // Always include the count so the reader never has to do mental math
      // at the table. e.g. "+4" / "-2".
      return sign + entry.count;
    },
    cellClass(row, matchup) {
      const entry = row.planByMatchup && row.planByMatchup[matchup];
      if (!entry) return "";
      return entry.dir === "in" ? "pc-in" : "pc-out";
    },
    shortName(name) {
      // Hard-cut long names rather than adding an ellipsis. Every character
      // on a 3in card is precious, and readers don't need the "..." to
      // recognize a truncated card name.
      if (!name) return "";
      if (name.length <= 26) return name;
      return name.slice(0, 26);
    },
    rowKey(row) {
      return row.name;
    }
  },
  template: `
    <div class="print-card">
      <header class="pc-header">
        <div class="pc-title" :style="fittedDeckName">{{ deckName }}</div>
        <div class="pc-sub">
          <span v-if="format" class="pc-format">{{ format }}</span>
          <span v-if="colorPips" class="pc-pips">{{ colorPips }}</span>
        </div>
      </header>

      <table class="pc-table">
        <thead>
          <tr>
            <th class="pc-col-card">Card</th>
            <th v-for="m in matchups" :key="m" class="pc-col-mu">{{ m }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in rows" :key="rowKey(row)">
            <tr v-if="row.isSide && row.firstSide" class="pc-divider">
              <td :colspan="matchups.length + 1">Sideboard</td>
            </tr>
            <tr :class="{ 'pc-row-side': row.isSide }">
              <td class="pc-col-card">
                <span class="pc-count">{{ row.count }}</span>{{ shortName(row.name) }}
              </td>
              <td
                v-for="m in matchups"
                :key="m"
                class="pc-cell"
                :class="cellClass(row, m)"
              >{{ cellText(row, m) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  `
};

export default PrintCard;