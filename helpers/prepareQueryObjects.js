// ==============================
// utils/prepareQueryObjects.js
// ==============================
/**
 * prepareQueryObjects.js
 *
 * Normalize query params into:
 *  - filterObject: pure Mongo filter (no page/limit/sort)
 *  - sortObject: { field: 1 | -1 }
 *  - pageNumber, limitNumber: sanitized numbers
 */
module.exports = function prepareQueryObjects(rawFilter = {}, rawSort = {}, options = {}) {
  const {
    defaultSort = "-createdAt",
    allowAllFields = false,
  } = options;

  // ✅ deep-clone to preserve operators like {$in: [...]}
  const filterObject =
    typeof structuredClone === "function"
      ? structuredClone(rawFilter)
      : JSON.parse(JSON.stringify(rawFilter));

  // Pagination
  const pageNumber = Math.max(Number(filterObject.page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(filterObject.limit) || 10, 1), 100);

  const sortParam = filterObject.sort;

  // Clean special params
  delete filterObject.page;
  delete filterObject.limit;
  delete filterObject.sort;

  // Build sort object
  let sortObject = {};
  if (rawSort && Object.keys(rawSort).length > 0) {
    sortObject = rawSort;
  } else {
    sortObject = buildSort(sortParam || defaultSort, allowAllFields);
  }

  return {
    filterObject,
    sortObject,
    pageNumber,
    limitNumber,
  };
};

function buildSort(sortExpr, allowAllFields = false) {
  if (!sortExpr) return {};

  let field = sortExpr;
  let direction = 1;

  if (sortExpr.startsWith("-")) {
    field = sortExpr.slice(1);
    direction = -1;
  }

  if (!allowAllFields && !field.match(/^[\w.]+$/)) {
    return {};
  }

  return { [field]: direction };
}