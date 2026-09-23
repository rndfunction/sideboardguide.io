// PNG export for a DOM element using html2canvas from CDN.
// Loads the library on demand (so it's not a startup cost).

const CDN_URL = "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js";
let loadingPromise = null;

function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CDN_URL;
    s.async = true;
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error("Failed to load html2canvas"));
    document.head.appendChild(s);
  });
  return loadingPromise;
}

/**
 * Render a DOM element to a PNG and trigger download.
 * @param {HTMLElement} el
 * @param {string} filename
 */
export async function exportElementToPng(el, filename) {
  if (!el) throw new Error("No element to export");
  const html2canvas = await loadHtml2Canvas();
  const canvas = await html2canvas(el, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false
  });
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename || "deck-title.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}