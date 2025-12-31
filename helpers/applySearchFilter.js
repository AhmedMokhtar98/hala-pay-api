// src/utils/applySearchFilter.js
/**
 * Adds a global case-insensitive text search across multiple fields.
 * Consumes `filterObject.search` and converts to `$or` with regex.
 */
module.exports = function applySearchFilter(filterObject = {}, searchFields = []) {
  const search = filterObject.search;
  delete filterObject.search;

  if (
    !search ||
    typeof search !== "string" ||
    search.trim() === "" ||
    !Array.isArray(searchFields) ||
    searchFields.length === 0
  ) {
    return filterObject;
  }

  const s = search.trim();
  const regex = new RegExp(s, "i");

  const orConditions = searchFields.map((field) => ({ [field]: regex }));

  return {
    ...filterObject,
    $or: orConditions,
  };
};
