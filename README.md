```header
/README.md #444 #replace
```
&#96;&#96;&#96;markdown
# MTG Deck Guide Builder

A browser-based tool that turns a Magic: The Gathering decklist into a
printable sideboard guide and a set of cards sized to fit inside a
standard MTG sleeve (66.5mm x 92.5mm) — so they slide cleanly into any
deckbox.

**Live at:** [sideboardguide.io](https://rndfunction.github.io/sideboardguide.io)

---

## What it does

Paste, upload, or drag-and-drop a decklist in any common plain-text
format (Moxfield, MTGGoldfish, MTG Arena, MTGO plain-text, or just lines
of `4 Card Name`). The app:

1. **Parses** the list, splitting maindeck from sideboard either at a
   `Sideboard` header line or at a blank-line break (the MTGGoldfish
   convention).
2. **Looks up** each unique card on [Scryfall](https://scryfall.com/docs/api)
   in batches of 75, caching results in localStorage for 7 days. Falls
   back to a small bundled database (`js/carddb.js`) when offline or when
   the network blocks the API.
3. **Auto-names** the deck by analyzing its contents:
   - **Signature cards** — a table of ~70 archetype-defining cards
     (Splinter Twin, Living End, Kuldotha Rebirth, Ragavan, etc.) mapped
     to recognizable deck names.
   - **Tribe detection** — if 30%+ of creatures share a subtype, uses
     that tribe (Elves, Goblins, etc.).
   - **Color + archetype heuristic** — last-resort fallback producing
     names like "Mono-Red Burn" or "Azorius Control".
4. **Produces three kinds of printable cards**, all sized to fit a
   standard sleeve:

   | Card | Purpose |
   |------|---------|
   | **Title card** | Decorative cover with the deck name, color pips, and a mana symbol watermark. Background color and font are customizable. |
   | **Checklist card** | Maindeck and sideboard listed with counts. Ideal for verifying a borrowed deck or checking a physical build. |
   | **Matchup guide cards** | One card per 3 matchups, showing which cards to board in or out with the exact number of copies. |

---

## Using the app

### Loading a decklist

- **Paste** directly into the textarea.
- **Upload** a `.txt` file via the sidebar button.
- **Drag and drop** a file onto the textarea.
- **Click "Paste from clipboard"** to grab whatever's already on your
  clipboard. (Note: this may be blocked by browsers in sandboxed preview
  environments — in production it works.)
- **Load example decklist** fills in a small sample for a quick tour.

### Building the sideboard guide

The matchup grid is the main working surface, in the left column.

1. Add matchups as columns via the **Quick-add** preset chips (Pauper,
   Modern, Legacy, Pioneer, Standard, Commander) or type your own.
2. Click a cell to cycle it:
   - **Maindeck card** → blank → OUT (all copies) → blank.
   - **Sideboard card** → blank → IN (all copies) → blank.
3. **Right-click** a cell (or click the pencil chip) to set a partial
   count — e.g. board out only 2 of 4 copies.
4. **Double-click** a matchup header to rename it. Plans migrate with
   the rename.
5. The **Board totals** row at the bottom shows IN / OUT / Balance per
   matchup — the balance number should read 0 for a valid plan.

### Customizing the title card

- **Color picker** — sets the background gradient. Defaults to a color
  derived from the deck's identity.
- **Font dropdown** — nine Google Fonts ranging from Cinzel (fantasy
  serif) to UnifrakturCook (blackletter).
- **Auto** button — resets the color to the deck's default.

Preferences persist in localStorage.

### Saving and loading

- **Save** stores the current decklist, matchups, plans, deck name, and
  title preferences in localStorage under `mtg-deck-guide:saved`.
- **Load** restores that state. The decklist is re-parsed and re-enriched.
- **Forget** clears the saved guide.

---

## Printing

The card preview pane on the right shows the cards at true physical size.
To print:

1. Click **Print** in the print-view controls.
2. In the browser print dialog, choose **Actual Size** (not "Fit to
   page") so the 66.5mm x 92.5mm dimensions are preserved.
3. Cards lay out **2 across** on US Letter paper.

Toggle which cards print via the chips at the top of the print controls:
**Title**, **Decklist**, **Sideboard**. All on by default.

**Tips for physical use:**

- The card size matches the inner sleeve dimension — cut along the
  outline and the card slides into a standard sleeve with a tiny bit of
  clearance.
- For a deckbox-ready result, fold or glue the title card to the back of
  the checklist card.
- If you have a printer with manual duplex, feed the sheet back in to
  print the title on the reverse of the checklist.

---

## Running it locally

The app is a static site with no build step. Because it uses ES modules,
it must be served over HTTP — opening `index.html` directly from the
file system will not work (the browser blocks module imports from
`file://` origins).

From this directory, run any static server:

&#96;&#96;&#96;
python3 -m http.server 8000
&#96;&#96;&#96;

or

&#96;&#96;&#96;
npx serve
&#96;&#96;&#96;

Then open [http://localhost:8000](http://localhost:8000).

---

## Deploying

It's a static site — any static host will work:

- **GitHub Pages** — push to a repo, enable Pages (Settings → Pages →
  Deploy from branch), done. The `.nojekyll` file in this repo
  prevents GitHub from running Jekyll over the files.
- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop the folder or
  connect the repo. No build command needed.
- **Any S3 / static bucket** — upload and serve.

All external dependencies (Vue, USWDS, Scryfall, Google Fonts) load over
HTTPS, so the app works from any secure origin.

---

## Project structure

&#96;&#96;&#96;
index.html              Entry point
css/app.css             All styling (Forge dark theme + print rules)
README.md               This file
importmap.json          Documentation of the shared Vue CDN URL
.nojekyll               Tells GitHub Pages to skip Jekyll

js/
  app.js                Vue app bootstrap
  store.js              Reactive state + deck loading pipeline
  parser.js             Decklist text parser
  scryfall.js           Scryfall client + local fallback
  carddb.js             Offline fallback card database
  archetype.js          Deck-name auto-detection
  persistence.js        Save/load + preset matchups
  titlecard.js          Title card helpers (colors, fonts)
  manasymbols.js        Mana symbol image sources
  exportimage.js        PNG export (unused, kept for future)

  components/
    DeckInput.js        Decklist textarea + file upload + paste
    GuideToolbar.js     Save/Load/Forget + format presets
    DeckGrid.js         The main matchup grid
    PrintView.js        Print card orchestrator
    PrintCard.js        Single matchup guide card
    PrintListCard.js    Checklist card
    PrintTitleCard.js   Decorative title card
    SampleCards.js      Empty-state previews (uses the real print components)

  (Unused files kept for reference:)
    components/TitleCard.js
    components/DeckList.js
    components/SideboardGuide.js
&#96;&#96;&#96;

---

## Design notes

- **"Forge" palette.** Warm-cool dark theme: deep cool-charcoal page
  background, warm off-black surfaces, cream text, copper accent.
  Contrast targets AA or better at every layer. The **print cards stay
  black-on-white** — they're going on paper.
- **Textarea is parchment.** The decklist input uses a light surface with
  near-black text, unlike the rest of the app, so the dense monospace
  content stays readable.
- **Maindeck cards never board IN. Sideboard cards never board OUT.**
  That's a design decision, not a bug: the app enforces the direction so
  the user only chooses how many copies, not which way.
- **3 matchups per guide card.** Chosen for legibility at the sleeve-sized
  dimensions.

---

## Notes

- **No API key required.** Scryfall's public API is free and
  unauthenticated.
- **Rate-limited politely.** Batches of 75 cards, 100ms between requests.
- **No data leaves your browser** except card lookups to Scryfall.
- **All state is local.** Decklists, matchups, plans, and preferences
  live in your browser's localStorage.
- **Case-sensitive hosts.** File paths are all lowercase; on a
  case-sensitive server (like GitHub Pages) this matters.
- **localStorage origin.** Preferences are keyed per-origin, so hosting
  at multiple URLs will produce separate saved states.

---

## Credits

- Card data: [Scryfall](https://scryfall.com)
- Mana symbols: [Scryfall SVG CDN](https://scryfall.com/docs/api)
- UI framework: [Vue 3](https://vuejs.org/) via unpkg
- Design system: [USWDS](https://designsystem.digital.gov/)
- Fonts: [Google Fonts](https://fonts.google.com/)

## License

_Add your license here._ (MIT is a friendly default for tools like this.)
&#96;&#96;&#96;
```

```javascript
//codebase #step-138
repo.replaceFile('#444', '/README.md');
```
