// Helpers for the printable title card:
//   - curated font list (loaded from Google Fonts on demand)
//   - default background color per deck color identity
//   - persistence for user picks (color, font)

const STORAGE_KEY = "mtg-deck-guide:title-card-prefs";
const FONTS_LOADED = new Set();
const GF_BASE = "https://fonts.googleapis.com/css2";

// Curated set of Google Fonts with MTG-friendly vibes. Each entry has
// the CSS font-family stack to apply, plus the Google Fonts query to load.
// Keep this list short so the picker stays usable.
export const FONT_OPTIONS = [
  {
    key: "cinzel",
    label: "Cinzel",
    family: "'Cinzel', 'Trajan Pro', serif",
    query: "Cinzel:wght@400;700"
  },
  {
    key: "cormorant",
    label: "Cormorant Garamond",
    family: "'Cormorant Garamond', Georgia, serif",
    query: "Cormorant+Garamond:wght@400;700"
  },
  {
    key: "playfair",
    label: "Playfair Display",
    family: "'Playfair Display', Georgia, serif",
    query: "Playfair+Display:wght@400;700;900"
  },
  {
    key: "marcellus",
    label: "Marcellus",
    family: "'Marcellus', Georgia, serif",
    query: "Marcellus"
  },
  {
    key: "unifraktur",
    label: "UnifrakturCook",
    family: "'UnifrakturCook', 'Luminari', fantasy",
    query: "UnifrakturCook:wght@700"
  },
  {
    key: "medievalsharp",
    label: "MedievalSharp",
    family: "'MedievalSharp', 'Luminari', fantasy",
    query: "MedievalSharp"
  },
  {
    key: "rajdhani",
    label: "Rajdhani",
    family: "'Rajdhani', 'Segoe UI', sans-serif",
    query: "Rajdhani:wght@400;600;700"
  },
  {
    key: "inter",
    label: "Inter",
    family: "'Inter', system-ui, sans-serif",
    query: "Inter:wght@400;700;900"
  },
  {
    key: "system",
    label: "System",
    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    query: null
  }
];

// Background palette per color identity. Keyed by sorted color string
// (e.g. "G", "WU", ""). Falls back to a neutral dark slate.
const COLOR_BACKGROUNDS = {
  "": "#3a3a4a",
  "W": "#8a8778",
  "U": "#1e4a7a",
  "B": "#1a1a1a",
  "R": "#8a2a1a",
  "G": "#1e5a2a",
  "WU": "#3a5a7a",
  "WB": "#4a3a4a",
  "WR": "#8a4a3a",
  "WG": "#5a7a4a",
  "UB": "#1a3a5a",
  "UR": "#5a3a6a",
  "UG": "#1a5a5a",
  "BR": "#5a2a2a",
  "BG": "#2a3a2a",
  "RG": "#6a4a2a",
  "WUB": "#3a3a5a",
  "WUR": "#7a4a5a",
  "WUG": "#4a6a5a",
  "WBR": "#5a3a3a",
  "WBG": "#3a4a3a",
  "WRG": "#6a5a3a",
  "UBR": "#3a2a4a",
  "UBG": "#2a4a4a",
  "URG": "#3a4a4a",
  "BRG": "#3a3a2a",
  "WUBR": "#4a3a4a",
  "WUBG": "#3a4a4a",
  "WURG": "#5a4a4a",
  "WBRG": "#4a3a3a",
  "UBRG": "#2a3a4a",
  "WUBRG": "#6a5a3a"
};

// Letter glyphs used as the giant watermark, in MTG flavor.
const COLOR_LETTERS = { W: "W", U: "U", B: "B", R: "R", G: "G" };

function sortedColorKey(colors) {
  if (!colors || !colors.length) return "";
  return colors.slice().sort().join("");
}

/**
 * Pick a default background color for a deck based on its color identity.
 */
export function defaultColorForDeck(enriched) {
  const colors = (enriched && enriched.stats && enriched.stats.colors) || [];
  const key = sortedColorKey(colors);
  return COLOR_BACKGROUNDS[key] || COLOR_BACKGROUNDS[""];
}

/**
 * Pick a default font key. Cinzel for a fantasy feel.
 */
export function defaultFontKey() {
  return "cinzel";
}

/**
 * Return the primary color letter(s) to use as a watermark.
 * - Single color: that letter.
 * - Multicolor: the most "iconic" one — heuristic: B > U > R > G > W
 *   (darker/stronger colors read better as a watermark).
 */
export function primaryWatermarkLetter(colors) {
  if (!colors || !colors.length) return "";
  const priority = ["B", "U", "R", "G", "W"];
  for (const c of priority) {
    if (colors.includes(c)) return COLOR_LETTERS[c] || c;
  }
  return colors[0];
}

/**
 * Load a Google Font by key. Idempotent — only injects the <link> once.
 */
export function loadFont(fontKey) {
  const font = FONT_OPTIONS.find((f) => f.key === fontKey);
  if (!font || !font.query) return;
  if (FONTS_LOADED.has(fontKey)) return;
  FONTS_LOADED.add(fontKey);

  // Google Fonts CSS loads the actual font file only when used.
  const linkId = "gfont-" + fontKey;
  if (document.getElementById(linkId)) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = GF_BASE + "?family=" + font.query + "&display=swap";
  document.head.appendChild(link);
}

/**
 * Load every font in the list — used so the picker can show real previews.
 */
export function loadAllFonts() {
  for (const f of FONT_OPTIONS) loadFont(f.key);
}

/**
 * Look up a font definition by key. Falls back to system.
 */
export function getFont(fontKey) {
  return FONT_OPTIONS.find((f) => f.key === fontKey) || FONT_OPTIONS[FONT_OPTIONS.length - 1];
}

// --- Persistence -----------------------------------------------------------

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearPrefs() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}