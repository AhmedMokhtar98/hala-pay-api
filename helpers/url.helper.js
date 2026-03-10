// utils/url.helper.js

const APP_PUBLIC_URL = String(process.env.APP_PUBLIC_URL || "")
  .trim()
  .replace(/\/+$/, "");

function normalizeAssetUrl(path) {
  if (!path || typeof path !== "string") return path;

  const value = path.trim();
  if (!value) return value;

  // Keep absolute URLs unchanged
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  // Return original value if env is missing
  if (!APP_PUBLIC_URL) {
    return value;
  }

  return `${APP_PUBLIC_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

function normalizeFields(obj = {}, fields = []) {
  if (!obj || typeof obj !== "object") return obj;

  const copy = { ...obj };

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(copy, field)) {
      copy[field] = normalizeAssetUrl(copy[field]);
    }
  }

  return copy;
}

module.exports = {
  normalizeAssetUrl,
  normalizeFields,
};

