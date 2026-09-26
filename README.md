# Sideboard Guide Builder

A browser-based tool that turns a Magic: The Gathering decklist into a printable sideboard guide and a set of cards sized to fit inside a standard MTG sleeve (66.5mm x 92.5mm).

**Live at:** [sideboardguide.io](https://sideboardguide.io)

## Overview

Paste or upload a decklist. The app parses it, looks up card data on Scryfall (with a small offline fallback), auto-names the deck based on signature cards or creature tribe, and produces three kinds of printable cards:

- **Title card** - a decorative cover with the deck name, color gradient, and mana symbol watermark. Customizable background, font, symbol, texture, and intensity.
- **Checklist card** - maindeck and sideboard listed with counts. Ideal for verifying a borrowed deck.
- **Matchup guide cards** - one card per three matchups, showing which cards to board in or out with the exact number of copies.

## Using the app

Matchups appear as folder tabs at the top of the guide. Click a cell to cycle blank to OUT (for maindeck cards) or blank to IN (for sideboard cards). Right-click any cell to set a partial count. Every matchup's IN total should equal its OUT total for a legal plan. Hover the small image icon next to a card name to preview its Scryfall artwork.

## Saving, loading, and sharing

- **Save** stores the current decklist, matchups, plans, deck name, and title preferences in localStorage.
- **Load** restores that state.
- **Forget** clears the saved guide.
- **Export** downloads the full guide as a portable JSON file.
- **Import** loads a previously exported JSON file.

The JSON share format is versioned so a future repository feature can consume or produce these files without breaking backward compatibility.

## Printing and exporting

Two ways to get cards onto paper:

- **Print** - opens the browser's print dialog. Choose Actual Size so the 66.5mm x 92.5mm dimensions are preserved. Cards lay out 2-across on US Letter.
- **PDF** - generates a PDF client-side using html2canvas-pro and jsPDF and downloads it directly.

Toggle which cards print via the chips at the top of the print controls: Title, Decklist, Sideboard, Matchups.

## Running it locally

The app is a static site with no build step. Because it uses ES modules, it must be served over HTTP. From this directory, run any static server:

    python3 -m http.server 8000

Then open http://localhost:8000 in your browser.

## Deploying

It's a static site - any host works. On GitHub Pages, push to a repo and enable Pages (Settings -> Pages -> Deploy from branch). The included .nojekyll file prevents Jekyll processing. Netlify, Vercel, and Cloudflare Pages also work via drag-and-drop.

All external dependencies load over HTTPS, so the app works from any secure origin.

## Project structure

Entry point and styling:

- index.html - entry point
- css/app.css - styling (Forge dark theme + print rules)

Core modules:

- js/app.js - Vue app bootstrap
- js/store.js - reactive state + deck loading pipeline
- js/parser.js - decklist text parser
- js/scryfall.js - Scryfall client + local fallback
- js/carddb.js - offline fallback card database
- js/archetype.js - deck-name auto-detection
- js/persistence.js - save/load + JSON share format
- js/guides.js - community guide fetch/submit + archetype index
- js/guides-list.js - shared data layer for the two guide-list views
- js/githubauth.js - GitHub OAuth device flow
- js/card-utils.js - shared helpers for the print card components
- js/titlecard.js - title card helpers
- js/textures.js - tiling + frame textures
- js/manasymbols.js - mana symbol sources
- js/pdfexport.js - client-side PDF export

Components:

- js/components/ - Vue components
- js/components/ArchetypeView.js - archetype index view (Browse)

Tests and docs:

- tests.html - test runner page (open over HTTP)
- js/tests.js - assertions for parser, share format, store, index
- docs/data-model.md - the corpus model and why it is shaped this way
- docs/schema-rationale.md - short form of the above
- docs/archetype-index-spec.md - the archetypes.json contract

Fixtures:

- guides/ - bundled guide JSONs and the demo index
- guides/manifest.json - local mirror of the guide list
- guides/archetypes.demo.json - hand-computed index for the bundled
  guides, used in development before the GitHub Action produces a real
  archetypes.json. It is tried only after the remote and local real
  indexes are missing, and is labeled "index: demo" in the UI.

## Design notes

- **Forge palette.** Warm-cool dark theme with cream text and copper accent. The print cards stay black-on-white - they're going on paper.
- **Maindeck cards never board IN. Sideboard cards never board OUT.** The app enforces direction so the user only chooses how many copies.
- **Sideboard plans must balance.** Every matchup's IN total must equal its OUT total.
- **Land color identity is excluded from deck naming.** A Mono-Red deck with a Fiery Islet is still Mono-Red.
- **3 matchups per guide card.** Chosen for legibility at sleeve-sized dimensions.

## Notes

- **The archetype view runs on a fixture in development.** The Browse
  page's archetype grouping reads a derived `archetypes.json`, which is
  produced by a GitHub Action in the guides repository on every
  submission. That action is not yet wired up, so in the meantime the
  client falls back to `guides/archetypes.demo.json`, a hand-computed
  index for the bundled guides. The fallback order is remote index, then
  local index, then demo. The demo file is shadowed the moment a real
  index exists and can be deleted then. See
  `docs/archetype-index-spec.md` for the producer contract.
- **Network activity** is limited to four hosts:
  1. **api.scryfall.com** — card metadata lookups (no auth, no key).
  2. **cards.scryfall.io** — card images for the hover preview.
  3. **sideboardguide-auth.rndfunction.workers.dev** — Cloudflare Worker that relays the GitHub OAuth device-flow requests (GitHub's own login endpoints don't send CORS headers).
  4. **api.github.com** — only when the user clicks Submit, to open a PR against the community repository.
- All persistent state (decklist, matchups, plans, title card prefs) lives in the browser's localStorage. Nothing is sent anywhere unless you click Submit.
- Batches of 75 cards with 100ms between requests, in keeping with Scryfall's rate guidance.
- No API key required; Scryfall's public API is free and unauthenticated.

## Credits

Card data and images from [Scryfall](https://scryfall.com). Built with [Vue 3](https://vuejs.org/) and [USWDS](https://designsystem.digital.gov/). PDF export uses html2canvas-pro and jsPDF.
