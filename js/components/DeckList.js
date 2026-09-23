// DeckList: plain two-column listing of maindeck and sideboard contents,
// grouped by card type then sorted by CMC then name.
// Distinct from SideboardGuide (which is matchup IN/OUT grids).

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

const DeckList = {
  props: {
    deck: { type: Object, required: true }
  },
  computed: {
    main() { return this.grouped(this.deck.mainboard || []); },
    side() { return this.grouped(this.deck.sideboard || []); },
    mainTotal() {
      return (this.deck.mainboard || []).reduce((a, e) => a + e.count, 0);
    },
    sideTotal() {
      return (this.deck.sideboard || []).reduce((a, e) => a + e.count, 0);
    }
  },
  methods: {
    grouped(list) {
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
    }
  },
  template: `
    <section class="deck-list">
      <div class="deck-list-cols">
        <div class="deck-list-col">
          <h3>Maindeck <span class="deck-list-total">({{ mainTotal }})</span></h3>
          <div v-for="section in main" :key="'m-' + section.bucket" class="deck-list-section">
            <h4 class="deck-list-section-head">{{ section.bucket }}</h4>
            <ul class="deck-list-rows">
              <li v-for="row in section.rows" :key="'m-' + row.name">
                <span class="card-count-badge">{{ row.count }}</span>{{ row.name }}
              </li>
            </ul>
          </div>
        </div>
        <div class="deck-list-col">
          <h3>Sideboard <span class="deck-list-total">({{ sideTotal }})</span></h3>
          <div v-if="side.length">
            <div v-for="section in side" :key="'s-' + section.bucket" class="deck-list-section">
              <h4 class="deck-list-section-head">{{ section.bucket }}</h4>
              <ul class="deck-list-rows">
                <li v-for="row in section.rows" :key="'s-' + row.name">
                  <span class="card-count-badge">{{ row.count }}</span>{{ row.name }}
                </li>
              </ul>
            </div>
          </div>
          <p v-else class="deck-list-empty">No sideboard cards.</p>
        </div>
      </div>
    </section>
  `
};

export default DeckList;