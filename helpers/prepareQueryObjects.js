/**
 * prepareQueryObjects.js
 * 
 * Normalize query params into:
 *  - filterObject: pure Mongo filter (no page/limit/sort)
 *  - sortObject: { field: 1 | -1 }
 *  - pageNumber, limitNumber: sanitized numbers
 * 
 * Usage: 
 * const { filterObject, sortObject, pageNumber, limitNumber } = prepareQueryObjects(req.query);
 */

module.exports = function prepareQueryObjects(rawFilter = {}, rawSort = {}, options = {}) {
  const {
    defaultSort = "-createdAt", // default sorting if none provided
    allowAllFields = false, // if true, allows sorting by any field in query
  } = options;

  const filterObject = { ...rawFilter };

  // Pagination
  const pageNumber = Math.max(Number(filterObject.page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(filterObject.limit) || 10, 1), 100);

  const sortParam = filterObject.sort; // e.g., "-monthlyFees" or "name"

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

/**
 * Build a MongoDB sort object from a string like "-fieldName"
 * Supports any field if allowAllFields = true
 */
function buildSort(sortExpr, allowAllFields = false) {
  if (!sortExpr) return {};

  let field = sortExpr;
  let direction = 1;

  if (sortExpr.startsWith("-")) {
    field = sortExpr.slice(1);
    direction = -1;
  }

  // Only allow alphanumeric, dot, and underscore field names
  if (!allowAllFields && !field.match(/^[\w.]+$/)) {
    return {};
  }

  return { [field]: direction };
}
