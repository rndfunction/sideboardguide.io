// PrintTitleCard: a 3in x 4in decorative cover card for the deck.
// Portrait orientation. Pretty, not functional — meant to be the "cover"
// on the back of the checklist card.
//
// Props:
//   deckName  : string (the title text)
//   subtitle  : string (e.g. the full archetype name, shown smaller)
//   colors    : array of single-letter color codes (e.g. ["G"] or ["W","U"])
//   fontKey   : which font to use (see titlecard.js FONT_OPTIONS)
//   bgColor   : hex background color, e.g. "#1e5a2a"
//   watermarkLetter : optional override; defaults to primaryWatermarkLetter(colors)

import { getFont, primaryWatermarkLetter, loadFont } from "../titlecard.js";
import { symbolSources } from "../manasymbols.js";

const PrintTitleCard = {
  props: {
    deckName: { type: String, default: "Untitled Deck" },
    subtitle: { type: String, default: "" },
    colors: { type: Array, default: () => [] },
    fontKey: { type: String, default: "cinzel" },
    bgColor: { type: String, default: "#3a3a4a" },
    watermarkLetter: { type: String, default: "" }
  },
  computed: {
    font() {
      return getFont(this.fontKey);
    },
    fontFamily() {
      return this.font.family;
    },
    watermark() {
      if (this.watermarkLetter) return this.watermarkLetter;
      return primaryWatermarkLetter(this.colors || []);
    },
    /**
     * If the deck has a WUBRG identity, we use the primary color's mana
     * symbol as the giant watermark. Colorless/unknown decks fall back to
     * the letter-based watermark.
     */
    watermarkPip() {
      const letter = this.watermark;
      if (!letter || !/^[WUBRG]$/.test(letter)) return null;
      const src = symbolSources(letter);
      return { letter, primary: src.primary, fallback: src.fallback };
    },
    /** White or black text, whichever contrasts better with the bg. */
    textColor() {
      return this.isDarkBg(this.bgColor) ? "#f7f7f2" : "#1a1a2e";
    },
    /** Slightly muted version of textColor for the subtitle. */
    subtitleColor() {
      return this.isDarkBg(this.bgColor) ? "rgba(247,247,242,0.7)" : "rgba(26,26,46,0.7)";
    },
    /** Watermark is a translucent version of the text color. */
    watermarkColor() {
      return this.isDarkBg(this.bgColor)
        ? "rgba(247,247,242,0.18)"
        : "rgba(26,26,46,0.15)";
    },
    /** Auto-shrink the deck name based on length. */
    nameStyle() {
      const n = this.deckName || "";
      let size = "34pt";
      if (n.length > 14) size = "28pt";
      if (n.length > 22) size = "22pt";
      if (n.length > 32) size = "17pt";
      if (n.length > 44) size = "14pt";
      return {
        fontSize: size,
        fontFamily: this.fontFamily,
        color: this.textColor
      };
    },
    subtitleStyle() {
      return {
        fontFamily: this.fontFamily,
        color: this.subtitleColor
      };
    },
    watermarkStyle() {
      return {
        fontFamily: this.fontFamily,
        color: this.watermarkColor
      };
    },
    backgroundStyle() {
      // Subtle vertical gradient using the base color, darkened slightly at
      // the top and bottom for a "card sleeve" effect.
      const base = this.bgColor;
      const dark = this.shadeColor(base, -0.25);
      return {
        background: "radial-gradient(circle at 50% 40%, " + base + " 0%, " + dark + " 100%)",
        color: this.textColor
      };
    },
    pips() {
      // Each pip is a real mana symbol image, with a fallback for offline.
      return (this.colors || [])
        .filter((c) => /^[WUBRG]$/.test(c))
        .map((c) => {
          const src = symbolSources(c);
          return {
            letter: c,
            primary: src.primary,
            fallback: src.fallback
          };
        });
    },
    dateLabel() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    }
  },
  watch: {
    fontKey: {
      immediate: true,
      handler(k) { loadFont(k); }
    }
  },
  methods: {
    /**
     * Relative luminance test: is this color perceived as "dark"?
     * Accepts 3- or 6-digit hex.
     */
    isDarkBg(hex) {
      if (!hex) return true;
      const c = hex.replace("#", "");
      let r, g, b;
      if (c.length === 3) {
        r = parseInt(c[0] + c[0], 16);
        g = parseInt(c[1] + c[1], 16);
        b = parseInt(c[2] + c[2], 16);
      } else {
        r = parseInt(c.slice(0, 2), 16);
        g = parseInt(c.slice(2, 4), 16);
        b = parseInt(c.slice(4, 6), 16);
      }
      // sRGB relative luminance, simple approximation.
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return lum < 0.55;
    },
    /**
     * Darken (amount < 0) or lighten (amount > 0) a hex color by a factor.
     */
    shadeColor(hex, amount) {
      if (!hex) return "#000000";
      const c = hex.replace("#", "");
      const num = parseInt(c.length === 3
        ? c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
        : c, 16);
      let r = (num >> 16) & 0xff;
      let g = (num >> 8) & 0xff;
      let b = num & 0xff;
      const adjust = (v) => {
        const nv = Math.round(v + 255 * amount);
        return Math.max(0, Math.min(255, nv));
      };
      r = adjust(r); g = adjust(g); b = adjust(b);
      return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    },
    pipClass(letter) {
      return "ptc-pip ptc-pip-" + letter;
    },
    onPipError(evt, pip) {
      // Fall back to the inline data URI if the CDN image fails to load
      // (e.g. CSP in the FORGE preview sandbox).
      const img = evt.target;
      if (pip.fallback && img.src !== pip.fallback) {
        img.src = pip.fallback;
      }
    }
  },
  template: `
    <div class="print-card print-title-card" :style="backgroundStyle">
      <div class="ptc-top">
        <span v-if="pips.length" class="ptc-pips">
          <img
            v-for="pip in pips"
            :key="pip.letter"
            class="ptc-pip-img"
            :src="pip.primary || pip.fallback"
            :alt="pip.letter + ' mana'"
            @error="onPipError($event, pip)"
          />
        </span>
      </div>

      <img
        v-if="watermarkPip"
        class="ptc-watermark-img"
        :src="watermarkPip.primary || watermarkPip.fallback"
        :alt="watermarkPip.letter + ' mana watermark'"
        aria-hidden="true"
        @error="onPipError($event, watermarkPip)"
      />
      <div v-else class="ptc-watermark" :style="watermarkStyle" aria-hidden="true">{{ watermark }}</div>

      <div class="ptc-center">
        <div class="ptc-name" :style="nameStyle">{{ deckName }}</div>
        <div v-if="subtitle" class="ptc-subtitle" :style="subtitleStyle">{{ subtitle }}</div>
      </div>
    </div>
  `
};

export default PrintTitleCard;