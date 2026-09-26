// MTG decklist parser.
// Handles common formats:
//   4 Lightning Bolt
//   4x Lightning Bolt
//   4 Lightning Bolt (2X2)
//   Sideboard
//   3x Force of Will
//   // comments and blank lines ignored
// Returns { mainboard: [{count, name, set?}], sideboard: [...], unparsed: [...] }

const COUNT_NAME = /^(\d+)\s*[xX]?\s+(.+?)\s*$/;
const SIDEBOARD_HEADERS = /^(sideboard|sb|side board)\s*:?\s*$/i;
const SECTION_HEADERS = /^(maindeck|main deck|main|deck)\s*:?\s*$/i;
const COMMENT_LINE = /^\s*(\/\/|#|$)/;

/**
 * Parse a decklist string into mainboard/sideboard arrays.
 *
 * Supports two sideboard conventions:
 *   1. Explicit header line: "Sideboard" / "SB:" (highest priority)
 *   2. Blank-line-separated tail block (MTGGoldfish / Arena style), where
 *      the trailing block sums to <= 20 cards and the leading block sums to
 *      a plausible maindeck (>= 40). This avoids false positives on Arena
 *      exports that use blank lines for type grouping.
 */
export function parseDecklist(text) {
  const rawLines = (text || "").split(/\r?\n/);

  // First pass: split into "runs" of non-blank, non-comment lines while
  // remembering whether an explicit sideboard header appeared.
  const runs = [];        // array of arrays of raw line strings
  let current = [];
  let explicitSideboardSeen = false;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();

    if (!line) {
      if (current.length) { runs.push(current); current = []; }
      continue;
    }
    if (COMMENT_LINE.test(line)) continue;
    if (SIDEBOARD_HEADERS.test(line)) {
      explicitSideboardSeen = true;
      if (current.length) { runs.push(current); current = []; }
      continue;
    }
    if (SECTION_HEADERS.test(line)) {
      if (current.length) { runs.push(current); current = []; }
      continue;
    }
    current.push(line);
  }
  if (current.length) runs.push(current);

  // Decide which runs are main vs side.
  // - If explicitSideboardSeen: the LAST run is sideboard, everything else main.
  // - Otherwise: if there are exactly 2 runs, and the second sums to a small
  //   number (<= 20) while the first sums to >= 40, treat run 2 as sideboard.
  // - Else: everything is main.
  let mainRunIndexes = [];
  let sideRunIndexes = [];

  if (explicitSideboardSeen) {
    if (runs.length >= 2) {
      sideRunIndexes = [runs.length - 1];
      mainRunIndexes = runs.slice(0, -1).map((_, i) => i);
    } else if (runs.length === 1) {
      mainRunIndexes = [0];
    }
  } else if (runs.length === 2) {
    const firstSum = sumLineCounts(runs[0]);
    const secondSum = sumLineCounts(runs[1]);
    if (secondSum > 0 && secondSum <= 20 && firstSum >= 40) {
      mainRunIndexes = [0];
      sideRunIndexes = [1];
    } else {
      mainRunIndexes = [0, 1];
    }
  } else if (runs.length > 2) {
    // Ambiguous — assume all maindeck to be safe.
    mainRunIndexes = runs.map((_, i) => i);
  } else if (runs.length === 1) {
    mainRunIndexes = [0];
  }

  const mainboard = [];
  const sideboard = [];
  const unparsed = [];

  const processRun = (lines, target) => {
    for (const line of lines) {
      const match = line.match(COUNT_NAME);
      if (!match) { unparsed.push(line); continue; }

      const count = parseInt(match[1], 10);
      let rest = match[2];

      // Strip trailing set/collector info: "Lightning Bolt (2X2) 117"
      // and foil marker "*F*" / "FOIL".
      //
      // Set codes appear in both uppercase (MTGO, older Arena exports:
      // "2X2") and lowercase (Arena, Moxfield, MTGGoldfish: "thb", "mh1").
      // The character class and the `i` flag together accept both.
      let set = null;
      const setMatch = rest.match(/^(.+?)\s+\(([A-Za-z0-9]{2,6})\)(?:\s+\S+)?\s*$/i);
      if (setMatch) {
        rest = setMatch[1];
        set = setMatch[2];
      }
      rest = rest.replace(/\s*\*F\*|\s*\bFOIL\b/gi, "").trim();

      if (!rest) { unparsed.push(line); continue; }

      // `set` is parsed and retained but not displayed today. It is kept
      // on the entry deliberately: a future feature may let a guide's
      // author pick a specific printing (custom art), and the set code is
      // the only key that distinguishes one printing of a card from
      // another. It also survives in rawText, but parsing it here means
      // that feature would not have to re-parse every stored guide. See
      // the note in docs/data-model.md on retained-but-unused fields.
      target.push({ count, name: rest, set });
    }
  };

  for (const i of mainRunIndexes) processRun(runs[i], mainboard);
  for (const i of sideRunIndexes) processRun(runs[i], sideboard);

  return { mainboard, sideboard, unparsed };
}

/**
 * Sum the numeric counts of lines that look like "4 Card Name".
 * Used as a cheap size heuristic when deciding main vs side.
 */
function sumLineCounts(lines) {
  let total = 0;
  for (const line of lines) {
    const m = line.match(COUNT_NAME);
    if (m) total += parseInt(m[1], 10) || 0;
  }
  return total;
}

/**
 * Sum counts of a list.
 */
export function sumCounts(entries) {
  return entries.reduce((acc, e) => acc + e.count, 0);
}

/**
 * Unique card names across main+side.
 */
export function uniqueNames(parsed) {
  const names = new Set();
  for (const e of parsed.mainboard) names.add(e.name);
  for (const e of parsed.sideboard) names.add(e.name);
  return Array.from(names);
}

/**
 * Parse an MTGO .dek file (XML) into the same shape parseDecklist returns:
 * { mainboard: [{ count, name }], sideboard: [...], unparsed: [...] }.
 *
 * The .dek format carries a CatID (an internal MTGO card id that would
 * need a database to resolve) AND a Name attribute with the card's
 * printed name in plain text. We only need the name, so no database is
 * required. Every <Cards> element looks like:
 *
 *   <Cards CatID="72474" Quantity="4" Sideboard="false" Name="Faerie Seer"/>
 *
 * Quantity and Sideboard give the count and the board; Name gives the
 * card. Attribute order is not guaranteed, so we read attributes by
 * name rather than by position.
 *
 * Returns { error } instead of the normal shape when the input is not
 * parseable as XML, so the caller can show a friendly message.
 */
export function parseDek(xmlText) {
  const text = String(xmlText || "").trim();
  if (!text) {
    return { error: "The file is empty." };
  }

  // DOMParser is available in every browser. It is used instead of a
  // regex because attribute order, quoting, and whitespace are not
  // guaranteed, and a real XML parser handles all of that correctly.
  if (typeof DOMParser === "undefined") {
    return { error: "This environment cannot parse XML." };
  }

  let doc;
  try {
    doc = new DOMParser().parseFromString(text, "text/xml");
  } catch (err) {
    return { error: "The file could not be read as XML." };
  }

  // A malformed XML document yields a <parsererror> element rather than
  // throwing. Detect it explicitly.
  if (doc.querySelector("parsererror")) {
    return { error: "The file is not valid .dek XML." };
  }

  const cards = doc.querySelectorAll("Cards");
  if (!cards.length) {
    return { error: "No cards found in the .dek file." };
  }

  const mainboard = [];
  const sideboard = [];
  const unparsed = [];

  for (const node of cards) {
    const name = (node.getAttribute("Name") || "").trim();
    const qtyRaw = node.getAttribute("Quantity") || "";
    const isSide = (node.getAttribute("Sideboard") || "").toLowerCase() === "true";
    const count = parseInt(qtyRaw, 10);

    if (!name || !count || count <= 0) {
      // Keep the raw XML of the offending card so the caller can show
      // something if it wants to.
      unparsed.push(node.outerHTML || name || "(unnamed card)");
      continue;
    }

    (isSide ? sideboard : mainboard).push({ count, name, set: null });
  }

  if (!mainboard.length && !sideboard.length) {
    return { error: "No readable cards found in the .dek file." };
  }

  return { mainboard, sideboard, unparsed };
}

/**
 * Render a parsed deck ({ mainboard, sideboard }) back to the plain-text
 * decklist format that parseDecklist understands. Used to convert a .dek
 * into the app's normal text representation, so the textarea shows an
 * editable list and everything downstream works unchanged.
 */
export function toDecklistText(parsed) {
  if (!parsed || (!parsed.mainboard && !parsed.sideboard)) return "";
  const lines = [];
  for (const e of parsed.mainboard || []) {
    lines.push(e.count + " " + e.name);
  }
  const side = parsed.sideboard || [];
  if (side.length) {
    lines.push("");
    lines.push("Sideboard");
    for (const e of side) {
      lines.push(e.count + " " + e.name);
    }
  }
  return lines.join("\n");
}