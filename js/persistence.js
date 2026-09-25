// Save/load guide state to localStorage + text export + preset matchups.
// Saved shape: { version, savedAt, rawText, matchups, plan, deckName, format }

const SAVE_KEY = "mtg-deck-guide:saved";
const FORMAT_KEY = "mtg-deck-guide:format";

// Presets are curated, ordered lists of common matchups per format.
// At runtime, these are refreshed from /presets.json by loadPresets().
// If that fetch fails, we keep whatever's here as the built-in fallback.
let PRESET_MATCHUPS = {
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

// ---------------------------------------------------------------------------
// Preset loading from /presets.json
// ---------------------------------------------------------------------------

let presetsLoaded = false;

/**
 * Fetch /presets.json and merge its format lists into PRESET_MATCHUPS.
 * Safe to call multiple times — subsequent calls are no-ops once a
 * successful load has happened.
 */
export async function loadPresets() {
  if (presetsLoaded) return PRESET_MATCHUPS;
  try {
    const res = await fetch("presets.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && data.formats && typeof data.formats === "object") {
      const clean = {};
      for (const [fmt, list] of Object.entries(data.formats)) {
        if (Array.isArray(list)) {
          clean[fmt] = list.filter((s) => typeof s === "string" && s.trim());
        }
      }
      if (Object.keys(clean).length) {
        // Merge into the existing map (keep any built-in formats the
        // JSON doesn't mention).
        for (const [fmt, list] of Object.entries(clean)) {
          PRESET_MATCHUPS[fmt] = list;
        }
      }
    }
    presetsLoaded = true;
  } catch (_) {
    // Keep the built-in fallback; don't mark as loaded so a retry is possible.
  }
  return PRESET_MATCHUPS;
}

// Default format for first-time users.
const DEFAULT_FORMAT = "Pauper";

/**
 * Read the last-used format from localStorage, or fall back to DEFAULT_FORMAT.
 */
export function getLastFormat() {
  try {
    const v = localStorage.getItem(FORMAT_KEY);
    if (v) return v;
  } catch (_) {}
  return DEFAULT_FORMAT;
}

/**
 * Persist the last-used format.
 */
export function setLastFormat(format) {
  try {
    if (format) {
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

function saveGuide(state) {
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

function loadGuide() {
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

function clearSaved() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Share format (.json)
// ---------------------------------------------------------------------------
//
// A portable, versioned snapshot of a sideboard guide. Designed so a future
// repository can consume or produce these files unchanged.
//
// {
//   "format": "mtg-sideboard-guide",
//   "version": 1,
//   "generator": "Sideboard Guide Builder",
//   "createdAt": "2026-09-24T15:00:00.000Z",
//   "deck": { "name": "...", "format": "Pauper", "archetype": "...", "rawText": "..." },
//   "matchups": ["Mono-Red Burn", ...],
//   "plan": { "Card Name": { "Matchup": { "dir": "in"|"out", "count": N } } },
//   "titleCard": { "color": "#hex", "fontKey": "...", "symbol": "...", "texture": "...", "intensity": "..." }
// }

const SHARE_FORMAT = "mtg-sideboard-guide";
const SHARE_VERSION = 1;

/**
 * Build the share payload object from current app state.
 */
export function buildSharePayload(state) {
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    generator: "Sideboard Guide Builder",
    createdAt: new Date().toISOString(),
    deck: {
      name: state.deckName || "",
      format: state.format || "",
      archetype: state.archetype || "",
      rawText: state.rawText || ""
    },
    matchups: Array.isArray(state.matchups) ? state.matchups.slice() : [],
    plan: state.plan ? JSON.parse(JSON.stringify(state.plan)) : {},
    titleCard: {
      color: state.titleColor || null,
      fontKey: state.titleFontKey || null,
      symbol: state.titleSymbol || null,
      texture: state.titleTexture || null,
      intensity: state.titleTextureIntensity || null
    }
  };
}

/**
 * Serialize and trigger a .json download.
 */
export function downloadShare(state, filename) {
  const payload = buildSharePayload(state);
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (state.deckName || "sideboard-guide")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  a.href = url;
  a.download = (filename || safe) + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate and parse a share file. Returns the parsed object on success,
 * or { error: "..." } on failure.
 */
export function parseShare(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { error: "Not a valid JSON file." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { error: "File is empty or malformed." };
  }
  if (parsed.format !== SHARE_FORMAT) {
    return { error: "Not a Sideboard Guide file." };
  }
  if (typeof parsed.version !== "number" || parsed.version > SHARE_VERSION) {
    return { error: "This file was made by a newer version. Update the app and try again." };
  }
  if (!parsed.deck || typeof parsed.deck.rawText !== "string") {
    return { error: "File is missing deck data." };
  }
  return parsed;
}

