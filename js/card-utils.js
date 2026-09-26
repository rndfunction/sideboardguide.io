// Small shared helpers for the print card components.

/**
 * Hard-cut a long card name to fit a sleeve-sized card. We deliberately
 * do NOT add an ellipsis: every character on a small card is precious,
 * and readers recognize a truncated name without the "...".
 *
 * @param {string} name  raw card name
 * @param {number} max   maximum characters to keep
 * @returns {string}
 */
export function truncateCardName(name, max) {
  if (!name) return "";
  const limit = (typeof max === "number" && max > 0) ? max : 26;
  if (name.length <= limit) return name;
  return name.slice(0, limit);
}