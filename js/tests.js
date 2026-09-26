// Lightweight in-browser test runner for the Sideboard Guide Builder.
//
// No framework, no build step, no dependencies. Open /tests.html after
// serving the repo over HTTP and see a green/red list. The runner also
// exposes window.__runTests() so it can be invoked from DevTools or a
// future headless CI runner.
//
// The tests here focus on the modules most likely to regress silently:
//   - parser.js       (maindeck/sideboard heuristic)
//   - persistence.js  (titleCase, share round-trip, parseShare errors)
//   - archetype.js    (signature -> tribe -> color+archetype)
//   - store.js        (plan keys, migration, copy counting)
//
// store.js has a Vue dependency (window.Vue.reactive), so it is only
// exercised when Vue is present on the page. tests.html loads Vue from
// the same CDN the app uses, so this is normally true.

import { parseDecklist, sumCounts, uniqueNames } from "./parser.js";
import {
  titleCase,
  buildSharePayload,
  parseShare
} from "./persistence.js";
import { identifyDeck } from "./archetype.js";
// store.js is imported statically rather than via dynamic import() inside
// runStoreTests(). The test page runs inside an iframe whose base URL is
// about:srcdoc, and dynamic imports there resolve relative to that base
// rather than to this file's real location, producing an empty module
// namespace. Static imports go through the same resolver as the other
// three modules above, which work correctly.
import {
  store,
  normalizePlanKeys,
  cycleCard,
  setCardPlan,
  addMatchup,
  renameMatchup,
  removeMatchup
} from "./store.js";

// ---------------------------------------------------------------------------
// Tiny harness
// ---------------------------------------------------------------------------

const results = [];
let currentSuite = "(no suite)";

export function suite(name, fn) {
  currentSuite = name;
  try {
    fn();
  } catch (err) {
    results.push({
      suite: name,
      name: "(suite threw)",
      ok: false,
      message: String((err && err.stack) || err)
    });
  }
}

export function test(name, fn) {
  try {
    fn();
    results.push({ suite: currentSuite, name: name, ok: true });
  } catch (err) {
    results.push({
      suite: currentSuite,
      name: name,
      ok: false,
      message: String((err && err.message) || err)
    });
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

export function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error((msg || "values differ") + " -- expected " + e + ", got " + a);
  }
}

export function assertThrows(fn, match, msg) {
  let threw = null;
  try { fn(); } catch (err) { threw = err; }
  if (!threw) throw new Error((msg || "expected throw") + " -- nothing was thrown");
  if (match && !String(threw.message || threw).includes(match)) {
    throw new Error((msg || "wrong error") + " -- got: " + String(threw.message || threw));
  }
}

// ---------------------------------------------------------------------------
// Synchronous suites
// ---------------------------------------------------------------------------
//
// All synchronous tests are registered inside registerSyncSuites() rather
// than at module top level, so that runAll() can call it after clearing
// the results array on every run. Running them at import time would make
// them disappear on the second run (results is wiped, then only the
// async suites re-run).

function registerSyncSuites() {

// ---------------------------------------------------------------------------
// parser.js
// ---------------------------------------------------------------------------

suite("parser: explicit Sideboard header", () => {
  test("splits on 'Sideboard' header", () => {
    const r = parseDecklist(
      "4 Lightning Bolt\n4 Lava Spike\n\nSideboard\n3 Pyroblast\n2 Smash to Smithereens"
    );
    assertEq(r.mainboard.length, 2, "main count");
    assertEq(r.sideboard.length, 2, "side count");
    assertEq(sumCounts(r.mainboard), 8, "main cards");
    assertEq(sumCounts(r.sideboard), 5, "side cards");
  });

  test("accepts 'SB:' shorthand", () => {
    const r = parseDecklist("4 Lightning Bolt\nSB:\n3 Pyroblast");
    assertEq(r.mainboard.length, 1);
    assertEq(r.sideboard.length, 1);
  });
});

suite("parser: blank-line tail block heuristic", () => {
  test("treats a small trailing block as sideboard", () => {
    const mainLines = [];
    for (let i = 0; i < 15; i++) mainLines.push("4 Card" + i);
    const text = mainLines.join("\n") + "\n\n3 SideA\n2 SideB";
    const r = parseDecklist(text);
    assertEq(r.mainboard.length, 15, "15 main entries");
    assertEq(r.sideboard.length, 2, "2 side entries");
  });

  test("treats two large blocks as all-main", () => {
    // Two blocks both summing to >= 40 -> both main.
    const blockA = "4 A\n4 B\n4 C\n4 D\n4 E\n4 F\n4 G\n4 H\n4 I\n4 J"; // 40
    const blockB = "4 K\n4 L\n4 M\n4 N\n4 O\n4 P\n4 Q\n4 R\n4 S\n4 T"; // 40
    const r = parseDecklist(blockA + "\n\n" + blockB);
    assertEq(r.sideboard.length, 0, "no sideboard inferred");
    assertEq(r.mainboard.length, 20, "all main");
  });
});

suite("parser: card line forms", () => {
  test("handles '4x Name'", () => {
    const r = parseDecklist("4x Lightning Bolt");
    assertEq(r.mainboard[0].name, "Lightning Bolt");
    assertEq(r.mainboard[0].count, 4);
  });

  test("strips set code and collector number", () => {
    const r = parseDecklist("4 Lightning Bolt (2X2) 117");
    assertEq(r.mainboard[0].name, "Lightning Bolt");
    assertEq(r.mainboard[0].set, "2X2");
  });

  test("ignores // comments and blank lines", () => {
    const r = parseDecklist("// comment\n\n4 Lightning Bolt");
    assertEq(r.mainboard.length, 1);
  });
});

suite("parser: uniqueNames", () => {
  test("dedupes names across main and side", () => {
    const r = parseDecklist("4 Lightning Bolt\n\nSideboard\n4 Lightning Bolt");
    const names = uniqueNames(r);
    assertEq(names.length, 1);
    assertEq(names[0], "Lightning Bolt");
  });
});

// ---------------------------------------------------------------------------
// persistence.js: titleCase
// ---------------------------------------------------------------------------

suite("titleCase", () => {
  test("capitalizes each word", () => {
    assertEq(titleCase("jund saga"), "Jund Saga");
  });
  test("handles hyphenated words", () => {
    assertEq(titleCase("mono-red burn"), "Mono-Red Burn");
  });
  test("preserves all-caps acronyms", () => {
    assertEq(titleCase("ANT"), "ANT");
  });
  test("uppercases color-pair shorthands", () => {
    assertEq(titleCase("uw control"), "UW Control");
  });
  test("keeps small words lowercase (not first)", () => {
    assertEq(titleCase("the rock"), "The Rock");
  });
  test("returns empty string for empty input", () => {
    assertEq(titleCase(""), "");
    assertEq(titleCase(null), "");
  });
});

// ---------------------------------------------------------------------------
// persistence.js: share round-trip + error cases
// ---------------------------------------------------------------------------

suite("share format", () => {
  test("buildSharePayload sets format + version", () => {
    const p = buildSharePayload({
      deckName: "Test Deck",
      format: "Pauper",
      archetype: "Mono-Red",
      rawText: "4 Lightning Bolt",
      matchups: ["A"],
      plan: { "4@main": { A: { dir: "out", count: 4 } } }
    });
    assertEq(p.format, "mtg-sideboard-guide");
    assertEq(p.version, 1);
    assertEq(p.deck.name, "Test Deck");
  });

  test("round-trips through parseShare", () => {
    const p = buildSharePayload({
      deckName: "Test Deck",
      format: "Pauper",
      archetype: "Mono-Red",
      rawText: "4 Lightning Bolt",
      matchups: ["A"],
      plan: {}
    });
    const parsed = parseShare(JSON.stringify(p));
    assert(!parsed.error, "no error on valid file");
    assertEq(parsed.deck.name, "Test Deck");
    assertEq(parsed.matchups, ["A"]);
  });

  test("parseShare rejects non-JSON", () => {
    const r = parseShare("not json");
    assert(r.error, "has error");
  });

  test("parseShare rejects wrong format", () => {
    const r = parseShare(JSON.stringify({ format: "other", version: 1, deck: { rawText: "" } }));
    assert(r.error, "has error");
  });

  test("parseShare rejects newer version", () => {
    const r = parseShare(JSON.stringify({
      format: "mtg-sideboard-guide",
      version: 999,
      deck: { rawText: "" }
    }));
    assert(r.error, "has error");
  });

  test("parseShare rejects missing deck.rawText", () => {
    const r = parseShare(JSON.stringify({
      format: "mtg-sideboard-guide",
      version: 1,
      deck: {}
    }));
    assert(r.error, "has error");
  });
});

// ---------------------------------------------------------------------------
// archetype.js
// ---------------------------------------------------------------------------

function enrichedFrom(mainNames, sideNames) {
  const mk = (name) => ({ name: name, count: 4, card: { name: name, cmc: 1, type_line: "Creature", colors: ["R"], color_identity: ["R"], oracle_text: "", mana_cost: "{R}" } });
  const mainboard = (mainNames || []).map(mk);
  const sideboard = (sideNames || []).map(mk);
  return {
    mainboard: mainboard,
    sideboard: sideboard,
    stats: { colors: ["R"], totalMain: mainboard.length * 4 }
  };
}

suite("archetype: signature cards", () => {
  test("recognizes Amulet Titan by Amulet of Vigor", () => {
    const e = enrichedFrom(["Amulet of Vigor", "Primeval Titan", "Forest"], []);
    assertEq(identifyDeck(e), "Amulet Titan");
  });
  test("recognizes Murktide by Murktide Regent", () => {
    const e = enrichedFrom(["Murktide Regent", "Dragon's Rage Channeler"], []);
    assertEq(identifyDeck(e), "Murktide");
  });
});

suite("archetype: fallback", () => {
  test("returns a non-empty string for an unknown deck", () => {
    const e = enrichedFrom(["Random Bear", "Random Wolf"], []);
    const name = identifyDeck(e);
    assert(typeof name === "string" && name.length > 0, "got a name");
  });
  test("returns 'Untitled Deck' for null input", () => {
    assertEq(identifyDeck(null), "Untitled Deck");
  });
});

} // end registerSyncSuites

// ---------------------------------------------------------------------------
// store.js (only if Vue is present on the page)
// ---------------------------------------------------------------------------

export async function runStoreTests() {
  if (typeof window === "undefined" || !window.Vue || !window.Vue.reactive) {
    results.push({
      suite: "store (skipped)",
      name: "Vue not present on page",
      ok: true,
      message: "Load tests.html, which pulls Vue from the same CDN as the app."
    });
    return;
  }

  suite("store: normalizePlanKeys", () => {
    const enriched = {
      mainboard: [{ name: "Lightning Bolt", count: 4, card: null }],
      sideboard: [{ name: "Pyroblast", count: 3, card: null }],
      stats: { colors: ["R"], totalMain: 4 }
    };

    test("legacy main key becomes name@main", () => {
      const out = normalizePlanKeys(
        { "Lightning Bolt": { "Matchup A": { dir: "out", count: 4 } } },
        enriched
      );
      assert(out["Lightning Bolt@main"], "main key present");
      assert(!out["Lightning Bolt"], "legacy key gone");
      assertEq(out["Lightning Bolt@main"]["Matchup A"].count, 4);
    });

    test("legacy side key becomes name@side", () => {
      const out = normalizePlanKeys(
        { "Pyroblast": { "Matchup A": { dir: "in", count: 3 } } },
        enriched
      );
      assert(out["Pyroblast@side"], "side key present");
      assert(!out["Pyroblast"], "legacy key gone");
    });

    test("card in both sections duplicates to both", () => {
      const both = {
        mainboard: [{ name: "Lightning Bolt", count: 4, card: null }],
        sideboard: [{ name: "Lightning Bolt", count: 4, card: null }],
        stats: {}
      };
      const out = normalizePlanKeys(
        { "Lightning Bolt": { "A": { dir: "out", count: 4 } } },
        both
      );
      assert(out["Lightning Bolt@main"], "main variant");
      assert(out["Lightning Bolt@side"], "side variant");
    });

    test("already-suffixed keys pass through untouched", () => {
      const out = normalizePlanKeys(
        { "Lightning Bolt@main": { "A": { dir: "out", count: 4 } } },
        enriched
      );
      assert(out["Lightning Bolt@main"], "still present");
      assertEq(out["Lightning Bolt@main"]["A"].count, 4);
    });

    test("input object is not mutated", () => {
      const original = { "Lightning Bolt": { "A": { dir: "out", count: 4 } } };
      const snapshot = JSON.stringify(original);
      normalizePlanKeys(original, enriched);
      assertEq(JSON.stringify(original), snapshot, "input unchanged");
    });

    test("stale entry for unknown card is dropped", () => {
      const out = normalizePlanKeys(
        { "Nonexistent Card": { "A": { dir: "out", count: 1 } } },
        enriched
      );
      assertEq(Object.keys(out).length, 0, "nothing kept");
    });

    test("null enriched returns a deep clone of input", () => {
      const inp = { "Lightning Bolt": { "A": { dir: "out", count: 4 } } };
      const out = normalizePlanKeys(inp, null);
      assertEq(Object.keys(out), Object.keys(inp));
      assert(out["Lightning Bolt"] !== inp["Lightning Bolt"], "cloned");
    });
  });

  suite("store: cycleCard + setCardPlan", () => {
    // Seed a minimal enriched deck so the plan helpers have something.
    store.enriched = {
      mainboard: [{ name: "Lightning Bolt", count: 4, card: null }],
      sideboard: [{ name: "Pyroblast", count: 3, card: null }],
      stats: { colors: ["R"], totalMain: 4 }
    };
    store.plan = {};

    test("cycleCard sets OUT on main", () => {
      cycleCard("Lightning Bolt", "Matchup A", "main");
      const entry = store.plan["Lightning Bolt@main"]["Matchup A"];
      assertEq(entry.dir, "out");
      assertEq(entry.count, 4);
    });

    test("cycleCard clears on second call", () => {
      cycleCard("Lightning Bolt", "Matchup A", "main");
      const entry = store.plan["Lightning Bolt@main"]["Matchup A"];
      assert(entry === undefined, "cleared");
    });

    test("cycleCard sets IN on side", () => {
      cycleCard("Pyroblast", "Matchup A", "side");
      const entry = store.plan["Pyroblast@side"]["Matchup A"];
      assertEq(entry.dir, "in");
      assertEq(entry.count, 3);
    });

    test("setCardPlan clamps count to copies", () => {
      setCardPlan("Lightning Bolt", "Matchup B", "out", 99, "main");
      const entry = store.plan["Lightning Bolt@main"]["Matchup B"];
      assertEq(entry.count, 4);
    });

    test("setCardPlan with dir=null clears", () => {
      setCardPlan("Lightning Bolt", "Matchup B", null, 0, "main");
      const entry = store.plan["Lightning Bolt@main"]["Matchup B"];
      assert(entry === undefined, "cleared");
    });
  });

  suite("store: matchup helpers", () => {
    store.matchups = [];
    test("addMatchup title-cases and dedupes", () => {
      addMatchup("mono-red burn");
      addMatchup("Mono-Red Burn");
      assertEq(store.matchups.length, 1);
      assertEq(store.matchups[0], "Mono-Red Burn");
    });
    test("renameMatchup migrates plan entries", () => {
      store.plan["Lightning Bolt@main"] = { "Mono-Red Burn": { dir: "out", count: 4 } };
      renameMatchup("Mono-Red Burn", "Affinity");
      assertEq(store.plan["Lightning Bolt@main"]["Affinity"].count, 4);
      assert(store.plan["Lightning Bolt@main"]["Mono-Red Burn"] === undefined);
    });
    test("removeMatchup drops plan entries", () => {
      removeMatchup("Affinity");
      assert(store.plan["Lightning Bolt@main"]["Affinity"] === undefined);
    });
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runAll() {
  // Wipe any previous results, then re-run every suite from scratch.
  // registerSyncSuites() is what actually registers the synchronous
  // parser / persistence / archetype tests; runStoreTests() handles the
  // Vue-dependent store tests. Both push into the same results array.
  results.length = 0;
  registerSyncSuites();
  await runStoreTests();
  return results.slice();
}