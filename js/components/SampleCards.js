// SampleCards: static mock previews of the three card types the app produces.
// Shown in the preview pane on the initial (empty) view so new users see
// what they're building toward. Uses a hardcoded Burn-style sample.

const SampleCards = {
  data() {
    return {
      sampleTitle: {
        name: "Mono-Red Burn",
        subtitle: "Mono-Red Aggro",
        pips: ["R"]
      },
      sampleMainboard: [
        { count: 4, name: "Monastery Swiftspear" },
        { count: 4, name: "Soul-Scar Mage" },
        { count: 4, name: "Lightning Bolt" },
        { count: 4, name: "Lava Spike" },
        { count: 4, name: "Rift Bolt" },
        { count: 4, name: "Skewer the Critics" },
        { count: 4, name: "Eidolon of the Great Revel" },
        { count: 3, name: "Searing Blaze" },
        { count: 4, name: "Mountain" },
        { count: 4, name: "Arid Mesa" },
        { count: 4, name: "Scalding Tarn" },
        { count: 4, name: "Ramunap Ruins" },
        { count: 3, name: "Fiery Islet" },
        { count: 8, name: "Snow-Covered Mountain" }
      ],
      sampleSideboard: [
        { count: 4, name: "Roiling Vortex" },
        { count: 3, name: "Skullcrack" },
        { count: 3, name: "Blood Moon" },
        { count: 3, name: "Anger of the Gods" },
        { count: 2, name: "Deflecting Palm" }
      ],
      sampleMatchups: ["Murktide", "Jund", "Amulet Titan", "Rhinos"],
      samplePlan: {
        "Murktide": [
          { count: 3, name: "Searing Blaze", dir: "out", amount: 3 },
          { count: 3, name: "Roiling Vortex", dir: "in", amount: 3 }
        ],
        "Jund": [
          { count: 2, name: "Lava Spike", dir: "out", amount: 2 },
          { count: 2, name: "Skullcrack", dir: "in", amount: 2 }
        ],
        "Amulet Titan": [
          { count: 4, name: "Monastery Swiftspear", dir: "out", amount: 4 },
          { count: 3, name: "Blood Moon", dir: "in", amount: 3 }
        ],
        "Rhinos": [
          { count: 3, name: "Eidolon of the Great Revel", dir: "out", amount: 3 },
          { count: 3, name: "Anger of the Gods", dir: "in", amount: 3 }
        ]
      }
    };
  },
  computed: {
    sampleMainRows() {
      // Two-column balance for the checklist sample.
      return this.sampleMainboard;
    },
    sampleSideRows() {
      return this.sampleSideboard;
    }
  },
  template: `
    <div class="sample-cards" aria-hidden="true">
      <p class="sample-cards-caption">You'll get three printable 3x4 cards:</p>

      <div class="sample-cards-row">
        <!-- Title card (no date) -->
        <div class="print-card print-title-card sample-mini" :style="{ background: 'radial-gradient(circle at 50% 40%, #8a2a1a 0%, #5a1a10 100%)' }">
          <div class="ptc-top">
            <span class="ptc-pips">
              <span class="ptc-pip ptc-pip-R">R</span>
            </span>
          </div>
          <div class="ptc-watermark" style="color: rgba(247,247,242,0.18);">R</div>
          <div class="ptc-center">
            <div class="ptc-name" style="color: #f7f7f2; font-family: 'Cinzel', serif; font-size: 14pt;">{{ sampleTitle.name }}</div>
            <div class="ptc-subtitle" style="color: rgba(247,247,242,0.7); font-size: 7pt;">{{ sampleTitle.subtitle }}</div>
          </div>
        </div>

        <!-- Checklist card: maindeck + sideboard in one, like the real one -->
        <div class="print-card print-list-card sample-mini">
          <header class="pc-header">
            <div class="pc-title" style="font-size: 10pt;">{{ sampleTitle.name }}</div>
            <div class="pc-sub">
              <span class="pc-format" style="font-size: 6pt;">Maindeck + Sideboard &middot; 75</span>
            </div>
          </header>
          <div class="pl-body">
            <div class="pl-columns">
              <ul class="pl-col" style="font-size: 5pt;">
                <li v-for="(row, i) in sampleMainRows.slice(0, 8)" :key="'sl-' + i" class="pl-row">
                  <span class="pl-count">{{ row.count }}</span>
                  <span class="pl-name">{{ row.name }}</span>
                </li>
              </ul>
              <ul class="pl-col" style="font-size: 5pt;">
                <li v-for="(row, i) in sampleMainRows.slice(8)" :key="'sr-' + i" class="pl-row">
                  <span class="pl-count">{{ row.count }}</span>
                  <span class="pl-name">{{ row.name }}</span>
                </li>
              </ul>
            </div>
            <div class="pl-section-divider">
              <span class="pl-section-divider-label">Sideboard &middot; 15</span>
            </div>
            <div class="pl-columns">
              <ul class="pl-col" style="font-size: 5pt;">
                <li v-for="(row, i) in sampleSideRows.slice(0, 3)" :key="'ssl-' + i" class="pl-row">
                  <span class="pl-count">{{ row.count }}</span>
                  <span class="pl-name">{{ row.name }}</span>
                </li>
              </ul>
              <ul class="pl-col" style="font-size: 5pt;">
                <li v-for="(row, i) in sampleSideRows.slice(3)" :key="'ssr-' + i" class="pl-row">
                  <span class="pl-count">{{ row.count }}</span>
                  <span class="pl-name">{{ row.name }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Matchup card -->
        <div class="print-card sample-mini">
          <header class="pc-header">
            <div class="pc-title" style="font-size: 10pt;">{{ sampleTitle.name }}</div>
            <div class="pc-sub">
              <span class="pc-format" style="font-size: 6pt;">Sideboard guide</span>
            </div>
          </header>
          <table class="pc-table" style="font-size: 5.5pt;">
            <thead>
              <tr>
                <th class="pc-col-card">Card</th>
                <th v-for="m in sampleMatchups" :key="m" class="pc-col-mu">{{ m }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(mu, mi) in sampleMatchups" :key="'mu-' + mi">
                <tr v-for="(row, ri) in samplePlan[mu]" :key="'mr-' + mi + '-' + ri" :class="{ 'pc-row-side': row.dir === 'in' }">
                  <td class="pc-col-card">
                    <span class="pc-count">{{ row.count }}</span>{{ row.name }}
                  </td>
                  <td v-for="m2 in sampleMatchups" :key="'c-' + mi + '-' + ri + '-' + m2" class="pc-cell" :class="row.dir === 'in' ? 'pc-in' : 'pc-out'">
                    <template v-if="m2 === mu">{{ row.dir === 'in' ? '+' + row.amount : '-' + row.amount }}</template>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

export default SampleCards;