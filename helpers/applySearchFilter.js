// src/utils/applySearchFilter.js

/**
 * Adds a global case-insensitive text search across multiple fields.
 * Consumes `filterObject.search` and converts to `$or` with regex.
 */

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = function applySearchFilter(filterObject = {}, searchFields = []) {
  const clonedFilter = { ...(filterObject || {}) };
  const search = clonedFilter.search;
  delete clonedFilter.search;

  if (
    !search ||
    typeof search !== "string" ||
    search.trim() === "" ||
    !Array.isArray(searchFields) ||
    searchFields.length === 0
  ) {
    return clonedFilter;
  }

  const s = search.trim();
  const regex = new RegExp(escapeRegex(s), "i");

  const orConditions = searchFields.map((field) => ({ [field]: regex }));

  if (clonedFilter.$or) {
    const existingOr = Array.isArray(clonedFilter.$or) ? clonedFilter.$or : [clonedFilter.$or];
    delete clonedFilter.$or;

    return {
      ...clonedFilter,
      $and: [
        { $or: existingOr },
        { $or: orConditions },
      ],
    };
  }

  return {
    ...clonedFilter,
    $or: orConditions,
  };
};