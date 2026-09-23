// PrintListCard: a 3in x 4in printable inventory card.
// Renders one or more sections stacked (e.g. Maindeck + Sideboard combined).
// Each section is a two-column list of "N Card Name" rows, balanced by row count.
// Black on white, no images.

const PrintListCard = {
  props: {
    deckName: { type: String, default: "Untitled Deck" },
    format: { type: String, default: "" },
    colors: { type: Array, default: () => [] },
    // sections: [{ title, total, rows: [{ name, count }] }, ...]
    sections: { type: Array, required: true }
  },
  computed: {
    fittedDeckName() {
      const n = this.deckName || "Untitled Deck";
      if (n.length <= 26) return { fontSize: "15pt" };
      if (n.length <= 34) return { fontSize: "13pt" };
      return { fontSize: "11pt" };
    },
    colorPips() {
      return (this.colors || []).join("");
    },
    headerLabel() {
      // "Maindeck · 60" for one section, "Maindeck + Sideboard · 75" for two.
      const titles = this.sections.map((s) => s.title).join(" + ");
      const total = this.sections.reduce((a, s) => a + (s.total || 0), 0);
      return titles + " \u00b7 " + total;
    },
    preparedSections() {
      // Attach column splits per section.
      return this.sections.map((s) => {
        const rows = s.rows || [];
        const half = Math.ceil(rows.length / 2);
        return {
          title: s.title,
          total: s.total || 0,
          left: rows.slice(0, half),
          right: rows.slice(half),
          empty: rows.length === 0
        };
      });
    }
  },
  methods: {
    shortName(name) {
      // Hard-cut long names rather than adding an ellipsis. Every character
      // on a 3in card is precious, and readers don't need the "..." to
      // recognize a truncated card name.
      if (!name) return "";
      if (name.length <= 28) return name;
      return name.slice(0, 28);
    }
  },
  template: `
    <div class="print-card print-list-card">
      <header class="pc-header">
        <div class="pc-title" :style="fittedDeckName">{{ deckName }}</div>
        <div class="pc-sub">
          <span class="pc-format">{{ headerLabel }}</span>
          <span v-if="colorPips" class="pc-pips">{{ colorPips }}</span>
        </div>
      </header>

      <div class="pl-body">
        <template v-for="(section, si) in preparedSections" :key="'sec-' + si">
          <div v-if="si > 0" class="pl-section-divider">
            <span class="pl-section-divider-label">{{ section.title }} &middot; {{ section.total }}</span>
          </div>
          <div v-if="section.empty && sections.length === 1" class="pl-empty">No cards.</div>
          <div v-else class="pl-columns">
            <ul class="pl-col">
              <li v-for="row in section.left" :key="'l-' + si + '-' + row.name" class="pl-row">
                <span class="pl-count">{{ row.count }}</span>
                <span class="pl-name">{{ shortName(row.name) }}</span>
              </li>
            </ul>
            <ul class="pl-col">
              <li v-for="row in section.right" :key="'r-' + si + '-' + row.name" class="pl-row">
                <span class="pl-count">{{ row.count }}</span>
                <span class="pl-name">{{ shortName(row.name) }}</span>
              </li>
            </ul>
          </div>
        </template>
      </div>
    </div>
  `
};

export default PrintListCard;