// Mana symbol rendering utilities.
//
// We have two sources for symbols:
//   1. Scryfall's CDN (https://svgs.scryfall.io/card-symbols/X.svg) — preferred
//      when the network allows it. Zero bundle cost.
//   2. Inline data URIs for the five WUBRG basics — used as a fallback when
//      the CDN isn't reachable (e.g. FORGE's preview sandbox enforces a CSP
//      that doesn't include svgs.scryfall.io).
//
// Call renderManaSymbol(letter) to get an <img> element with the right src
// and an onerror fallback to the inline data URI.

// Compact WUBRG SVGs (single path per color, scaled to 24x24 viewBox).
// These are hand-simplified glyphs, not the official WotC art — adequate
// for a small badge in the UI, not for print. The print card continues to
// use the styled color circles it already has.
const INLINE_SYMBOLS = {
  W: "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f0ece1" stroke="#8a8778" stroke-width="1"/><text x="12" y="17" font-family="Georgia,serif" font-size="13" font-weight="700" text-anchor="middle" fill="#333">W</text></svg>'
  ),
  U: "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#4a90d9" stroke="#2a5a9a" stroke-width="1"/><text x="12" y="17" font-family="Georgia,serif" font-size="13" font-weight="700" text-anchor="middle" fill="#fff">U</text></svg>'
  ),
  B: "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1a1a1a" stroke="#000" stroke-width="1"/><text x="12" y="17" font-family="Georgia,serif" font-size="13" font-weight="700" text-anchor="middle" fill="#fff">B</text></svg>'
  ),
  R: "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#d9462b" stroke="#8a2a1a" stroke-width="1"/><text x="12" y="17" font-family="Georgia,serif" font-size="13" font-weight="700" text-anchor="middle" fill="#fff">R</text></svg>'
  ),
  G: "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#2f7a3d" stroke="#1a4a24" stroke-width="1"/><text x="12" y="17" font-family="Georgia,serif" font-size="13" font-weight="700" text-anchor="middle" fill="#fff">G</text></svg>'
  )
};

const SCRYFALL_BASE = "https://svgs.scryfall.io/card-symbols/";

/**
 * Return the Scryfall CDN URL for a symbol letter, or null if we don't
 * have a URL for it.
 */
export function scryfallSymbolUrl(letter) {
  if (!letter) return null;
  const key = String(letter).toUpperCase();
  if (!/^[WUBRG]$/.test(key)) return null;
  return SCRYFALL_BASE + key + ".svg";
}

/**
 * Return an inline data URI for a symbol letter, or null.
 */
export function inlineSymbolDataUri(letter) {
  if (!letter) return null;
  const key = String(letter).toUpperCase();
  return INLINE_SYMBOLS[key] || null;
}

/**
 * Best-effort best source: prefer Scryfall CDN, but expose the fallback.
 * Consumers that render <img> should set onerror to swap to the fallback.
 */
export function symbolSources(letter) {
  return {
    primary: scryfallSymbolUrl(letter),
    fallback: inlineSymbolDataUri(letter)
  };
}

/**
 * Build an <img> element for a mana symbol. The onerror handler swaps
 * to the inline data URI if the CDN fails (e.g. CSP block in the FORGE
 * preview sandbox).
 */
export function createManaImg(letter, sizePx) {
  const { primary, fallback } = symbolSources(letter);
  const img = document.createElement("img");
  img.alt = String(letter || "").toUpperCase() + " mana";
  img.className = "mana-symbol-img";
  img.width = sizePx || 14;
  img.height = sizePx || 14;
  if (primary) img.src = primary;
  else if (fallback) img.src = fallback;
  img.onerror = () => {
    if (fallback && img.src !== fallback) {
      img.src = fallback;
    }
  };
  return img;
}

/**
 * Given a mana cost string like "{1}{U}{B}", return an array of
 * image descriptors: [{ letter, alt }].
 */
export function parseManaCost(manaCost) {
  if (!manaCost) return [];
  const out = [];
  const re = /\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(manaCost)) !== null) {
    out.push({ letter: m[1], alt: m[1] });
  }
  return out;
}