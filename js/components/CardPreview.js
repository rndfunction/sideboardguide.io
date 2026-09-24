// CardPreview: a global floating overlay that shows a card's Scryfall image
// on hover. Any component can trigger it by setting store.hoveredCard and
// store.hoveredCardPos. Mounted once at the top of #app.

import { store } from "../store.js";

const OFFSET = 18;      // px away from the cursor
const PREVIEW_W = 240;  // px wide preview

const CardPreview = {
  computed: {
    card() {
      return store.hoveredCard;
    },
    image() {
      if (!this.card) return "";
      return this.card.image_normal || this.card.image_small || "";
    },
    name() {
      return this.card ? this.card.name : "";
    },
    style() {
      const pos = store.hoveredCardPos || { x: 0, y: 0 };
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      // Flip horizontally if too close to the right edge.
      const w = PREVIEW_W;
      const h = PREVIEW_W * 1.4; // rough aspect ratio (MTG card 88:61)
      let left = pos.x + OFFSET;
      let top = pos.y + OFFSET;
      if (left + w > viewW - 8) left = pos.x - w - OFFSET;
      if (top + h > viewH - 8) top = Math.max(8, viewH - h - 8);
      return {
        top: top + "px",
        left: left + "px",
        width: w + "px"
      };
    }
  },
  template: `
    <div
      v-if="card"
      class="card-preview"
      :style="style"
      aria-hidden="true"
    >
      <img
        v-if="image"
        :src="image"
        :alt="name"
        class="card-preview-img"
      />
      <div v-else class="card-preview-empty">
        <div class="card-preview-name">{{ name }}</div>
        <div class="card-preview-note">No image available</div>
      </div>
    </div>
  `
};

export default CardPreview;