// providers/common/providerUtils.js
function toPositiveInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function normalizeText(x) {
  if (x == null) return "";
  return String(x).trim();
}

/**
 * Unified statuses:
 * - active | draft | archived
 */
function normalizeUnifiedStatus(x) {
  const s = String(x || "").toLowerCase().trim();
  if (!s) return "";
  if (["active", "draft", "archived"].includes(s)) return s;
  // accept common aliases
  if (["enabled", "published", "sale"].includes(s)) return "active";
  if (["disabled", "hidden"].includes(s)) return "draft";
  return s; // unknown, adapter may decide
}

module.exports = {
  toPositiveInt,
  clampInt,
  normalizeText,
  normalizeUnifiedStatus,
};