// Client-side PDF export for the print cards.
//
// Loads html2canvas-pro (fork of html2canvas with mix-blend-mode support,
// which the title card's textures and borders use) and jsPDF from CDN,
// then renders each .print-card element as a section of a Letter-sized
// PDF laid out 2-across, matching the print preview's arrangement.

const H2C_CDN = "https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/dist/html2canvas-pro.min.js";
const JSPDF_CDN = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";

let loaded = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // If already present, resolve.
    const existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      if (existing.dataset.loaded === "1") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load " + src)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = "1"; resolve(); };
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

async function ensureLibs() {
  if (loaded) return loaded;
  loaded = (async () => {
    await loadScript(H2C_CDN);
    await loadScript(JSPDF_CDN);
    const html2canvas = window.html2canvas;
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!html2canvas || !jsPDFCtor) {
      throw new Error("PDF libraries failed to initialize");
    }
    return { html2canvas, jsPDFCtor };
  })();
  return loaded;
}

const MM_PER_IN = 25.4;
const LETTER_MM = { w: 8.5 * MM_PER_IN, h: 11 * MM_PER_IN };
const MARGIN_MM = 6;
const GAP_MM = 4;

/**
 * Render an array of DOM elements (.print-card) as a Letter-sized PDF,
 * laid out 2-across. Each card is rasterized at 2x scale for crispness.
 *
 * @param {HTMLElement[]} cardEls
 * @param {string} filename
 * @param {function} onProgress  optional (done, total)
 */
export async function exportCardsToPdf(cardEls, filename, onProgress) {
  const { html2canvas, jsPDFCtor } = await ensureLibs();

  const pdf = new jsPDFCtor({
    unit: "mm",
    format: "letter",
    orientation: "portrait"
  });

  // Usable area for the two-column grid of cards.
  const usableW = LETTER_MM.w - 2 * MARGIN_MM;
  const usableH = LETTER_MM.h - 2 * MARGIN_MM;

  // Compute card dimensions in mm from the on-screen element's px size
  // (which is what the browser laid out at the real physical size).
  // We measure the FIRST card. All cards are the same size.
  if (!cardEls.length) {
    throw new Error("No cards to export");
  }

  // Card physical dimensions are set by CSS at 2.62in x 3.64in.
  const CARD_MM = { w: 2.62 * MM_PER_IN, h: 3.64 * MM_PER_IN };

  // How many fit per row / page?
  const perRow = Math.max(1, Math.floor((usableW + GAP_MM) / (CARD_MM.w + GAP_MM)));
  const perCol = Math.max(1, Math.floor((usableH + GAP_MM) / (CARD_MM.h + GAP_MM)));
  const perPage = perRow * perCol;

  let page = 0;
  for (let i = 0; i < cardEls.length; i++) {
    const el = cardEls[i];
    const slot = i % perPage;

    if (slot === 0 && i > 0) {
      pdf.addPage();
      page++;
    }

    const col = slot % perRow;
    const row = Math.floor(slot / perRow);

    const x = MARGIN_MM + col * (CARD_MM.w + GAP_MM);
    const y = MARGIN_MM + row * (CARD_MM.h + GAP_MM);

    // Rasterize this card at high DPI.
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 3,
      useCORS: true,
      logging: false
    });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    // Draw a thin border rect under the image so cards stand out on
    // white paper.
    pdf.setDrawColor(120, 120, 120);
    pdf.setLineWidth(0.2);
    pdf.rect(x, y, CARD_MM.w, CARD_MM.h);

    pdf.addImage(dataUrl, "JPEG", x, y, CARD_MM.w, CARD_MM.h, undefined, "FAST");

    if (onProgress) onProgress(i + 1, cardEls.length);
  }

  pdf.save(filename || "sideboard-guide.pdf");
}