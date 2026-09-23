// Save/load guide state to localStorage + text export + preset matchups.
// Saved shape: { version, savedAt, rawText, matchups, plan, deckName, format }

const SAVE_KEY = "mtg-deck-guide:saved";
const FORMAT_KEY = "mtg-deck-guide:format";

// Presets are curated, ordered lists of common matchups per format.
// Add new formats here and they'll show up in the toolbar dropdown.
export const PRESET_MATCHUPS = {
  Pauper: [
    "Mono-Red Burn",
    "Mono-Blue Terror",
    "Kuldotha Red",
    "Affinity",
    "Bogles",
    "Elves",
    "Familiars",
    "Cycle Storm",
    "Dimir Control",
    "Grixis Affinity",
    "Caw-Gates",
    "Jeskai Ephemerate",
    "Terror",
    "Golgari Gardens",
    "Izzet Faeries"
  ],
  Modern: [
    "Murktide", "Jund Saga", "Living End", "Tron", "Amulet Titan",
    "Burn", "Domain Zoo", "Yawgmoth", "Scam", "Rhinos"
  ],
  Legacy: [
    "Delver", "Reanimator", "Doomsday", "Sneak and Show", "Lands",
    "Death and Taxes", "ANT", "Elves", "Painter", "8-Cast"
  ],
  Pioneer: [
    "Rakdos Midrange", "Mono-Green Devotion", "Azorius Control",
    "Izzet Phoenix", "Amalia Combo", "Lotus Field", "Greasefang",
    "Mono-White Humans", "Enigmatic Fires"
  ],
  Standard: [
    "Mono-Red", "Azorius Control", "Domain Ramp", "Golgari Midrange",
    "Boros Aggro", "Dimir Midrange", "Toxic", "Mono-Black"
  ],
  Commander: [
    "Aggro", "Control", "Combo", "Midrange", "Stax", "Group Hug", "Voltron"
  ]
};

// Ordered list of format names for dropdowns.
export const FORMAT_LIST = Object.keys(PRESET_MATCHUPS);

// Default format for first-time users.
export const DEFAULT_FORMAT = "Pauper";

/**
 * Read the last-used format from localStorage, or fall back to DEFAULT_FORMAT.
 */
export function getLastFormat() {
  try {
    const v = localStorage.getItem(FORMAT_KEY);
    if (v && PRESET_MATCHUPS[v]) return v;
  } catch (_) {}
  return DEFAULT_FORMAT;
}

/**
 * Persist the last-used format.
 */
export function setLastFormat(format) {
  try {
    if (format && PRESET_MATCHUPS[format]) {
      localStorage.setItem(FORMAT_KEY, format);
    }
  } catch (_) {}
}

/**
 * Title-case a string with awareness of common MTG conventions:
 *  - "mono-red burn"          -> "Mono-Red Burn"
 *  - "jund saga"              -> "Jund Saga"
 *  - "grixis affinity"        -> "Grixis Affinity"
 *  - "8-cast"                 -> "8-Cast"
 *  - "ANT"                    -> "ANT"   (all-caps input preserved)
 *  - "uw control"             -> "UW Control"
 *  - "the rock"               -> "The Rock"
 * Small words (of, the, and, etc.) are lowercased unless first.
 * Hyphenated segments are capitalized individually.
 */
const SMALL_WORDS = new Set(["of", "the", "and", "a", "an", "in", "on", "at", "to", "for", "vs", "or"]);
const KNOWN_UPPER = new Set(["uw", "ub", "ur", "ug", "wb", "wr", "wg", "br", "bg", "rg", "wug", "wub", "ubr", "brg", "rwg", "bant", "grixis", "jund", "naya", "esper", "abzan", "mardu", "sultai", "temur"]);

function capitalizeSegment(seg) {
  if (!seg) return seg;
  // If the segment is already fully uppercase and 2-4 letters, keep it.
  if (seg.length <= 4 && seg === seg.toUpperCase() && /^[A-Z0-9]+$/.test(seg)) {
    return seg;
  }
  // Color-pair shorthands like "uw", "bg" -> "UW", "BG".
  const low = seg.toLowerCase();
  if (KNOWN_UPPER.has(low) && low.length <= 3) {
    return low.toUpperCase();
  }
  // Otherwise, capitalize first char, lowercase rest.
  return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
}

export function titleCase(input) {
  if (!input || typeof input !== "string") return "";
  const s = input.trim();
  if (!s) return "";
  // Split on spaces; keep hyphens inside words.
  const words = s.split(/\s+/);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const raw = words[i];
    // Split on hyphen so "mono-red" -> ["mono", "red"]
    const parts = raw.split("-");
    const cappedParts = parts.map((p, idx) => {
      // Keep things like "8" intact.
      if (/^\d+$/.test(p)) return p;
      // Preserve small words unless first word and it's a real word (not color code).
      if (idx === 0 && i > 0 && SMALL_WORDS.has(p.toLowerCase())) return p.toLowerCase();
      if (i > 0 && idx === 0 && SMALL_WORDS.has(p.toLowerCase())) return p.toLowerCase();
      return capitalizeSegment(p);
    });
    out.push(cappedParts.join("-"));
  }
  return out.join(" ");
}

export function saveGuide(state) {
  const payload = {
    version: 1,
    savedAt: Date.now(),
    rawText: state.rawText || "",
    matchups: Array.isArray(state.matchups) ? state.matchups : [],
    plan: state.plan || {},
    deckName: state.deckName || "",
    format: state.format || null
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return { ok: true, savedAt: payload.savedAt };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function loadGuide() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function clearSaved() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}

