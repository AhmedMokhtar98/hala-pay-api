// services/products/normalizeFilters.js
const { toPositiveInt } = require("../../../utils/helpers");

function normalizeProductsFilters(q = {}) {
  const page = toPositiveInt(q.page, 1);
  const limit = Math.min(100, Math.max(1, toPositiveInt(q.limit ?? q.per_page ?? q.perPage, 20)));

  const keyword = String(q.keyword ?? q.search ?? q.q ?? "").trim();
  const category = q.category ?? q.category_id ?? q.categoryId;
  const status = String(q.status ?? "").trim().toLowerCase();

  const sync = String(q.sync ?? "0") === "1";
  const syncPageAll = String(q.syncPageAll ?? "0") === "1";

  return { page, limit, keyword, category, status, sync, syncPageAll };
}

module.exports = { normalizeProductsFilters };