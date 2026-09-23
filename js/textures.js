// Optional textures for the title card. Each is a self-contained inline
// SVG data URI, layered over the background gradient with a blend mode
// so the color still shows through.
//
// Textures are parameterized by an intensity multiplier. Stroke opacity,
// sheen alpha, and line weight all scale together, so a single texture
// can be "Subtle", "Medium", or "Bold" without authoring three variants.
//
// --- DESIGN PRINCIPLE ---
// Only geometric patterns. Organic shapes (leaves, flames, feathers)
// don't read as themselves when tiled at title-card scale — they become
// visual noise. Geometry reads cleanly because it's about structure.
// Organic motifs belong in borders, not fills.
//
// --- TILING RULE ---
// Every texture must be fully tileable. Two ways to achieve it:
//   * Use a purely geometric pattern whose lines/shapes align to the
//     tile boundaries (Grid, Waves, Diamonds, Chevrons, Circles,
//     Crosses, Triangles, Hexagons).
//   * Or duplicate any edge-crossing shape by +/- tileSize (Chrome).
//
// --- HOW TO ADD A NEW TEXTURE ---
// 1. Write a function above BUILDERS that takes `f` (the intensity factor)
//    and returns an SVG string. Use op(base, f) for opacity and
//    w(base, f, bump) for stroke width. Make sure it tiles.
// 2. Register it in BUILDERS as { key: yourFunction }.
// 3. Add an entry to TEXTURE_OPTIONS as { key, label }.

function svgDataUri(svg) {
  return "url(\"data:image/svg+xml;utf8," + encodeURIComponent(svg) + "\")";
}

export const INTENSITY_OPTIONS = [
  { key: "subtle", label: "Subtle",  factor: 0.6 },
  { key: "medium", label: "Medium",  factor: 1.5 },
  { key: "bold",   label: "Bold",    factor: 2.4 }
];

function factorFor(key) {
  const found = INTENSITY_OPTIONS.find((o) => o.key === key);
  return found ? found.factor : 1.5;
}

const clamp = (n) => Math.max(0, Math.min(1, n));
const op = (base, f) => clamp(base * f).toFixed(2);
const w = (base, f, bump) => (base + (f - 1) * (bump || 0.2)).toFixed(2);

// --- Chrome -----------------------------------------------------------
// Diagonal brushed-metal streaks. Tiles because the streak lines run
// from edge to edge at a consistent angle and offset.
// Affinity, Artifacts, Izzet.
function buildChrome(f) {
  const la = op(0.20, f);
  const da = op(0.12, f);
  const hi = op(0.18, f);
  const lo = op(0.04, f);
  const sw = w(0.5, f, 0.2);
  const dw = w(0.4, f, 0.15);
  const W = 40, H = 40;

  const lightLines = [];
  const darkLines = [];
  for (let i = -2; i <= 2; i++) {
    const offset = i * 10;
    lightLines.push('<line x1="' + offset + '" y1="0" x2="' + (offset + H) + '" y2="' + H + '"/>');
    darkLines.push('<line x1="' + (offset + 5) + '" y1="0" x2="' + (offset + 5 + H) + '" y2="' + H + '"/>');
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">',
    '<defs><linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="rgba(255,255,255,' + hi + ')"/>',
    '<stop offset="0.5" stop-color="rgba(255,255,255,' + lo + ')"/>',
    '<stop offset="1" stop-color="rgba(255,255,255,' + hi + ')"/>',
    '</linearGradient></defs>',
    '<rect width="' + W + '" height="' + H + '" fill="url(#sheen)"/>',
    '<g stroke="rgba(255,255,255,' + la + ')" stroke-width="' + sw + '">',
    lightLines.join(""),
    '</g>',
    '<g stroke="rgba(0,0,0,' + da + ')" stroke-width="' + dw + '">',
    darkLines.join(""),
    '</g>',
    '</svg>'
  ].join("");
}

// --- Diamonds ---------------------------------------------------------
// Rotated-square lattice forming a diamond checker. Tiles because the
// diamond vertices sit exactly on tile boundaries.
// Equipment, Voltron, Artifacts, Izzet.
function buildDiamonds(f) {
  const fillA = op(0.10, f);
  const strokeA = op(0.24, f);
  const sw = w(0.55, f, 0.2);
  const W = 40, H = 40;

  // A single diamond centered at (W/4, H/4), (3W/4, H/4), etc., so the
  // pattern repeats every W x H. Use half-diamonds at edges + wrap
  // copies for seamless tiling.
  const diamond = (cx, cy, s) =>
    '<path d="M' + cx + ' ' + (cy - s) +
    ' L' + (cx + s) + ' ' + cy +
    ' L' + cx + ' ' + (cy + s) +
    ' L' + (cx - s) + ' ' + cy + ' Z"/>';

  const s = 14;
  const cells = [
    { cx: W / 2, cy: H / 2, s }
  ];

  // Wrap-copies for diamonds that extend past the tile.
  const drawn = [];
  for (const c of cells) {
    drawn.push(c);
    if (c.cx - c.s < 0) drawn.push({ cx: c.cx + W, cy: c.cy, s: c.s });
    if (c.cx + c.s > W) drawn.push({ cx: c.cx - W, cy: c.cy, s: c.s });
    if (c.cy - c.s < 0) drawn.push({ cx: c.cx, cy: c.cy + H, s: c.s });
    if (c.cy + c.s > H) drawn.push({ cx: c.cx, cy: c.cy - H, s: c.s });
    if (c.cx - c.s < 0 && c.cy - c.s < 0) drawn.push({ cx: c.cx + W, cy: c.cy + H, s: c.s });
    if (c.cx + c.s > W && c.cy - c.s < 0) drawn.push({ cx: c.cx - W, cy: c.cy + H, s: c.s });
    if (c.cx - c.s < 0 && c.cy + c.s > H) drawn.push({ cx: c.cx + W, cy: c.cy - H, s: c.s });
    if (c.cx + c.s > W && c.cy + c.s > H) drawn.push({ cx: c.cx - W, cy: c.cy - H, s: c.s });
  }

  const paths = drawn.map((c) => diamond(c.cx, c.cy, c.s)).join("");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">',
    '<g fill="rgba(255,255,255,' + fillA + ')">' + paths + '</g>',
    '<g fill="none" stroke="rgba(255,255,255,' + strokeA + ')" stroke-width="' + sw + '" stroke-linejoin="round">' + paths + '</g>',
    '</svg>'
  ].join("");
}

// --- Chevrons ---------------------------------------------------------
// Angular zig-zag stripes. Tiles because each chevron starts and ends at
// the same y at x=0 and x=W, and rows stack at fixed y intervals.
// Burn, Red, Aggro, Rakdos.
function buildChevrons(f) {
  const s = op(0.24, f);
  const s2 = op(0.14, f);
  const sw = w(0.7, f, 0.25);
  const W = 60, H = 30;

  // A chevron: V-shape spanning full tile width. Row y offset steps by 10
  // so three chevrons fit in one 30px tile.
  const chevron = (y) =>
    '<path d="M0 ' + y + ' L' + (W / 2) + ' ' + (y - 8) + ' L' + W + ' ' + y + '"/>';

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">',
    '<g fill="none" stroke="rgba(255,255,255,' + s + ')" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round">',
    chevron(10),
    chevron(20),
    chevron(30),
    '</g>',
    '<g fill="none" stroke="rgba(255,255,255,' + s2 + ')" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round">',
    chevron(15),
    chevron(25),
    '</g>',
    '</svg>'
  ].join("");
}

// --- Circles ----------------------------------------------------------
// Regular polka-dot grid. Tiles because circles sit at tile centers with
// their radius less than the tile half-width.
// Tokens, Counters, Merfolk, Simic.
function buildCircles(f) {
  const fillA = op(0.16, f);
  const strokeA = op(0.26, f);
  const sw = w(0.5, f, 0.2);
  const W = 40, H = 40;

  const r = 10;
  const dot = (cx, cy) =>
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';

  // Four dots per tile, offset so it reads as a proper polka-dot grid.
  const cells = [
    { cx: W / 4, cy: H / 4 },
    { cx: (3 * W) / 4, cy: H / 4 },
    { cx: W / 4, cy: (3 * H) / 4 },
    { cx: (3 * W) / 4, cy: (3 * H) / 4 }
  ];

  const paths = cells.map((c) => dot(c.cx, c.cy)).join("");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">',
    '<g fill="rgba(255,255,255,' + fillA + ')">' + paths + '</g>',
    '<g fill="none" stroke="rgba(255,255,255,' + strokeA + ')" stroke-width="' + sw + '">' + paths + '</g>',
    '</svg>'
  ].join("");
}

// --- Waves -----------------------------------------------------------
// Overlapping sine-like arcs spanning the full tile width. Tiles
// naturally because each arc starts and ends at the same y at x=0 and
// x=W, and the next row is offset in y only.
// Merfolk, Blue, Simic, Mono-Blue.
function buildWaves(f) {
  const s = op(0.20, f);
  const s2 = op(0.14, f);
  const sw = w(0.8, f, 0.3);
  const W = 80, H = 80;

  const wave = (y, amp) =>
    '<path d="M0 ' + y +
    ' Q' + (W / 4) + ' ' + (y - amp) + ' ' + (W / 2) + ' ' + y +
    ' Q' + (W * 0.75) + ' ' + (y + amp) + ' ' + W + ' ' + y + '"/>';

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">',
    '<g fill="none" stroke="rgba(255,255,255,' + s + ')" stroke-width="' + sw + '" stroke-linecap="round">',
    wave(20, 8),
    wave(40, 8),
    wave(60, 8),
    '</g>',
    '<g fill="none" stroke="rgba(255,255,255,' + s2 + ')" stroke-width="' + sw + '" stroke-linecap="round">',
    wave(30, 8),
    wave(50, 8),
    '</g>',
    '</svg>'
  ].join("");
}

// --- Grid -------------------------------------------------------------
// Geometric lattice. Tiles perfectly because every line ends on the tile
// boundary, and the diagonal cross-hatch does too.
// Generic, Colorless, Tron, Artifacts.
function buildGrid(f) {
  const s = op(0.18, f);
  const s2 = op(0.10, f);
  const sw = w(0.6, f, 0.2);
  const W = 40, H = 40;
  const step = 20;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">',
    '<g stroke="rgba(255,255,255,' + s + ')" stroke-width="' + sw + '">',
    '<line x1="0" y1="0" x2="' + W + '" y2="0"/>',
    '<line x1="0" y1="' + step + '" x2="' + W + '" y2="' + step + '"/>',
    '<line x1="0" y1="' + H + '" x2="' + W + '" y2="' + H + '"/>',
    '<line x1="0" y1="0" x2="0" y2="' + H + '"/>',
    '<line x1="' + step + '" y1="0" x2="' + step + '" y2="' + H + '"/>',
    '<line x1="' + W + '" y1="0" x2="' + W + '" y2="' + H + '"/>',
    '</g>',
    '<g stroke="rgba(255,255,255,' + s2 + ')" stroke-width="' + sw + '">',
    '<line x1="0" y1="0" x2="' + W + '" y2="' + H + '"/>',
    '<line x1="' + W + '" y1="0" x2="0" y2="' + H + '"/>',
    '</g>',
    '</svg>'
  ].join("");
}

// --- Hexagons --------------------------------------------------------
// Solid honeycomb using pointy-top hexagons. Tiles into a rectangular
// grid cleanly.
// Works for Artifacts, Colorless, Tron, Generic, Equipment.
function buildHexagons(f) {
  const fillA = op(0.14, f);
  const strokeA = op(0.28, f);
  const sw = w(0.5, f, 0.2);

  const R = 20;
  const hexW = Math.sqrt(3) * R;
  const rowPitch = 1.5 * R;
  const W = hexW;
  const H = rowPitch * 2;

  const hexPath = (cx, cy) => {
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      pts.push((cx + R * Math.cos(a)).toFixed(2) + "," + (cy + R * Math.sin(a)).toFixed(2));
    }
    return "M" + pts.join(" L") + " Z";
  };

  const cells = [
    { cx: W / 2, cy: R },
    { cx: W,     cy: R + rowPitch },
    { cx: 0,     cy: R + rowPitch },
    { cx: W / 2, cy: R + 2 * rowPitch }
  ];

  const drawn = [];
  for (const c of cells) {
    drawn.push(c);
    if (c.cx <= 0)          drawn.push({ cx: c.cx + W, cy: c.cy });
    if (c.cx >= W)          drawn.push({ cx: c.cx - W, cy: c.cy });
    if (c.cy <= R - 1)      drawn.push({ cx: c.cx, cy: c.cy + H });
    if (c.cy >= H - R + 1)  drawn.push({ cx: c.cx, cy: c.cy - H });
    if (c.cx <= 0 && c.cy <= R)  drawn.push({ cx: c.cx + W, cy: c.cy + H });
    if (c.cx >= W && c.cy <= R)  drawn.push({ cx: c.cx - W, cy: c.cy + H });
  }

  const paths = drawn.map((c) => '<path d="' + hexPath(c.cx, c.cy) + '"/>').join("");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W.toFixed(2) + '" height="' + H + '" viewBox="0 0 ' + W.toFixed(2) + ' ' + H + '">',
    '<g fill="rgba(255,255,255,' + fillA + ')">' + paths + '</g>',
    '<g fill="none" stroke="rgba(255,255,255,' + strokeA + ')" stroke-width="' + sw + '" stroke-linejoin="round">' + paths + '</g>',
    '</svg>'
  ].join("");
}

// --- Triangles -------------------------------------------------------
// Equilateral triangle lattice (up/down alternating).
// Works for Rogues, Aggro, Izzet, Tempo, Ninjas.
function buildTriangles(f) {
  const s = op(0.20, f);
  const s2 = op(0.32, f);
  const sw = w(0.55, f, 0.2);

  const L = 40;
  const h = L * Math.sqrt(3) / 2;
  const W = L;
  const H = 2 * h;

  const up = (x, y) => "M" + x + "," + y + " L" + (x + L / 2) + "," + (y - h) + " L" + (x + L) + "," + y + " Z";
  const down = (x, y) => "M" + x + "," + y + " L" + (x + L / 2) + "," + (y + h) + " L" + (x + L) + "," + y + " Z";

  const paths = [];
  paths.push('<path d="' + up(0, H) + '"/>');
  paths.push('<path d="' + up(W / 2, H) + '"/>');
  paths.push('<path d="' + down(0, H) + '"/>');
  paths.push('<path d="' + down(W / 2, H) + '"/>');

  const yTop = H - h;
  paths.push('<path d="' + up(0, yTop) + '"/>');
  paths.push('<path d="' + up(W / 2, yTop) + '"/>');
  paths.push('<path d="' + down(0, yTop) + '"/>');
  paths.push('<path d="' + down(W / 2, yTop) + '"/>');

  paths.push('<path d="' + up(-W, H) + '"/>');
  paths.push('<path d="' + up(W, H) + '"/>');
  paths.push('<path d="' + down(-W, H) + '"/>');
  paths.push('<path d="' + down(W, H) + '"/>');
  paths.push('<path d="' + up(-W, yTop) + '"/>');
  paths.push('<path d="' + up(W, yTop) + '"/>');
  paths.push('<path d="' + down(-W, yTop) + '"/>');
  paths.push('<path d="' + down(W, yTop) + '"/>');

  const joined = paths.join("");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W.toFixed(2) + '" height="' + H.toFixed(2) + '" viewBox="0 0 ' + W.toFixed(2) + ' ' + H.toFixed(2) + '">',
    '<g fill="rgba(255,255,255,' + s + ')">' + joined + '</g>',
    '<g fill="none" stroke="rgba(255,255,255,' + s2 + ')" stroke-width="' + sw + '" stroke-linejoin="round">' + joined + '</g>',
    '</svg>'
  ].join("");
}

// --- Filigree Frame ---------------------------------------------------
// Ornate formal border: double-rule frame with scroll flourishes at each
// corner and a diamond medallion at the center of each edge. Reads as a
// crafted plaque or certificate frame — neutral enough for any deck.
function buildFiligreeFrame(f) {
  const strokeA = op(0.68, f);
  const accentA = op(0.55, f);
  const fillA = op(0.12, f);
  const outerW = w(1.0, f, 0.15);
  const innerW = w(0.5, f, 0.15);

  // Two concentric rectangles with rounded corners.
  const outer = "M 6 6 L 94 6 Q 96 6 96 8 L 96 92 Q 96 94 94 94 " +
    "L 6 94 Q 4 94 4 92 L 4 8 Q 4 6 6 6 Z";
  const inner = "M 10 10 L 90 10 Q 92 10 92 12 L 92 88 Q 92 90 90 90 " +
    "L 10 90 Q 8 90 8 88 L 8 12 Q 8 10 10 10 Z";

  // Corner flourish: a small scroll/curl made of two arcs meeting at a
  // point, drawn relative to the corner. Rotated for each of the 4 corners.
  const corner = (x, y, rot) =>
    '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')">' +
      // A pair of curled tendrils reaching into the card.
      '<path d="M 0 0 C 6 2 12 6 12 12" fill="none" ' +
        'stroke="rgba(255,255,255,' + accentA + ')" stroke-width="' + innerW + '" stroke-linecap="round"/>' +
      '<path d="M 0 0 C 2 6 6 12 12 12" fill="none" ' +
        'stroke="rgba(255,255,255,' + accentA + ')" stroke-width="' + innerW + '" stroke-linecap="round"/>' +
      // A tiny curling dot at the corner itself.
      '<circle cx="2" cy="2" r="1.4" fill="rgba(255,255,255,' + accentA + ')"/>' +
    '</g>';

  // Diamond medallion at the center of an edge.
  const diamond = (x, y, size) =>
    '<path d="M' + x + ' ' + (y - size) +
    ' L' + (x + size) + ' ' + y +
    ' L' + x + ' ' + (y + size) +
    ' L' + (x - size) + ' ' + y + ' Z" ' +
    'fill="rgba(255,255,255,' + fillA + ')" ' +
    'stroke="rgba(255,255,255,' + accentA + ')" stroke-width="' + innerW + '" stroke-linejoin="round"/>';

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">',
    // Outer + inner rules.
    '<path d="' + outer + '" fill="none" stroke="rgba(255,255,255,' + strokeA + ')" stroke-width="' + outerW + '" stroke-linejoin="round"/>',
    '<path d="' + inner + '" fill="none" stroke="rgba(255,255,255,' + strokeA + ')" stroke-width="' + innerW + '" stroke-linejoin="round"/>',
    // Corner flourishes.
    corner(10, 10, 0),
    corner(90, 10, 90),
    corner(90, 90, 180),
    corner(10, 90, 270),
    // Edge medallions.
    diamond(50, 6, 2.2),
    diamond(50, 94, 2.2),
    diamond(4, 50, 2.2),
    diamond(96, 50, 2.2),
    '</svg>'
  ].join("");
}

// --- Corners Frame ----------------------------------------------------
// Simple L-brackets in each corner. Minimal, formal. A safe default when
// you want a border that doesn't call attention to itself.
function buildCornersFrame(f) {
  const strokeA = op(0.72, f);
  const sw = w(1.0, f, 0.2);

  const bracket = (x, y, sx, sy) => {
    const armX = 14 * sx;
    const armY = 14 * sy;
    return '<path d="M' + x + ' ' + (y + armY) + ' L' + x + ' ' + y + ' L' + (x + armX) + ' ' + y + '"/>';
  };

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">',
    '<g fill="none" stroke="rgba(255,255,255,' + strokeA + ')" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">',
    bracket(5, 5, 1, 1),
    bracket(95, 5, -1, 1),
    bracket(5, 95, 1, -1),
    bracket(95, 95, -1, -1),
    '</g>',
    '</svg>'
  ].join("");
}

const BUILDERS = {
  chrome: buildChrome,
  diamonds: buildDiamonds,
  chevrons: buildChevrons,
  circles: buildCircles,
  waves: buildWaves,
  grid: buildGrid,
  hexagons: buildHexagons,
  triangles: buildTriangles,
  "filigree-frame": buildFiligreeFrame,
  "corners-frame": buildCornersFrame
};

// Each option may set `mode` to "frame" (full-card SVG, no tiling).
// Textures without a mode are treated as "tile" (repeating pattern).
export const TEXTURE_OPTIONS = [
  { key: "none", label: "None" },
  { key: "filigree-frame", label: "Filigree Frame", mode: "frame" },
  { key: "corners-frame", label: "Corners Frame", mode: "frame" },
  { key: "chrome", label: "Chrome" },
  { key: "diamonds", label: "Diamonds" },
  { key: "chevrons", label: "Chevrons" },
  { key: "circles", label: "Circles" },
  { key: "waves", label: "Waves" },
  { key: "grid", label: "Grid" },
  { key: "hexagons", label: "Hexagons" },
  { key: "triangles", label: "Triangles" }
];

/**
 * Return { image, mode } for a texture, or null if the key is unknown / "none".
 * `image` is a CSS background-image value; `mode` is "tile" or "frame".
 */
export function getTexture(key, intensity) {
  const builder = BUILDERS[key];
  if (!builder) return null;
  const opt = TEXTURE_OPTIONS.find((o) => o.key === key);
  const mode = (opt && opt.mode) || "tile";
  const f = factorFor(intensity || "medium");
  return { image: svgDataUri(builder(f)), mode };
}