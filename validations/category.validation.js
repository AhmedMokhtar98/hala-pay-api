// validations/category.validation.js
const Joi = require("joi");

/* -----------------------------
  Shared primitives
----------------------------- */

const objectId = Joi.string()
  .trim()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.base": "errors.validObjectId",
    "string.empty": "errors.invalidObjectId",
    "string.pattern.base": "errors.invalidObjectId",
  });

const storeId9 = Joi.string()
  .trim()
  .pattern(/^\d{9}$/)
  .messages({
    "string.base": "errors.validStoreId",
    "string.empty": "errors.storeIdMustBe9Digits",
    "string.pattern.base": "errors.storeIdMustBe9Digits",
  });

const boolQuery = Joi.boolean()
  .truthy("true", "1", 1)
  .falsy("false", "0", 0)
  .messages({ "boolean.base": "errors.validBoolean" });

/* -----------------------------
  Category fields (NEW schema)
----------------------------- */

const nameEn = Joi.string().trim().allow("").messages({
  "string.base": "errors.validCategoryNameEn",
});

const nameAr = Joi.string().trim().allow("").messages({
  "string.base": "errors.validCategoryNameAr",
});

const descriptionEn = Joi.string().trim().allow("").messages({
  "string.base": "errors.validCategoryDescriptionEn",
});

const descriptionAr = Joi.string().trim().allow("").messages({
  "string.base": "errors.validCategoryDescriptionAr",
});

const storeRef = Joi.object({
  store: objectId.optional(),
  storeId: storeId9.optional(),
})
  .or("store", "storeId")
  .messages({
    "object.missing": "errors.requiredStoreOrStoreId",
  });

/**
 * atLeastOneName:
 * - require at least one of nameEn/nameAr to be non-empty after trim
 */
const atLeastOneName = (schema) =>
  schema.custom((value, helpers) => {
    const en = String(value?.nameEn || "").trim();
    const ar = String(value?.nameAr || "").trim();
    if (!en && !ar) return helpers.error("object.missing");
    return value;
  }, "require nameEn or nameAr (non-empty)")
  // map the custom error to your i18n key
  .messages({ "object.missing": "errors.requiredCategoryName" });

/* -----------------------------
  Reusable param/query schemas
----------------------------- */

const categoryIdParams = Joi.object({
  categoryId: objectId.required().messages({
    "any.required": "errors.requiredCategoryId",
  }),
});

const categoryIdQuery = Joi.object({
  categoryId: objectId.required().messages({
    "any.required": "errors.requiredCategoryId",
  }),
});

module.exports = {
  /* -----------------------------
    CREATE
    body: store/storeId + nameEn/nameAr (+ descs)
  ----------------------------- */
  createCategoryValidation: {
    params: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    body: atLeastOneName(
      storeRef.keys({
        nameEn,
        nameAr,
        descriptionEn: descriptionEn.optional(),
        descriptionAr: descriptionAr.optional(),
      })
    ),
  },

  /* -----------------------------
    LIST
  ----------------------------- */
  listCategoriesValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),

      isActive: boolQuery.optional(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(200).optional(),

      // your helpers support any of these
      search: Joi.string().allow("").optional(),
      q: Joi.string().allow("").optional(),
      keyword: Joi.string().allow("").optional(),

      sort: Joi.string().allow("").optional(),
      populateStore: boolQuery.optional(),
    }).unknown(true),
  },

  /* -----------------------------
    PARAMS
  ----------------------------- */
  categoryIdParamsValidation: {
    body: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    params: categoryIdParams,
  },

  /* -----------------------------
    UPDATE
    body: any of fields (min 1)
  ----------------------------- */
  updateCategoryValidation: {
    query: Joi.object({}).unknown(true),
    params: categoryIdParams,
    body: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),

      nameEn: nameEn.optional(),
      nameAr: nameAr.optional(),
      descriptionEn: descriptionEn.optional(),
      descriptionAr: descriptionAr.optional(),
    })
      .min(1)
      .messages({ "object.min": "errors.emptyBody" }),
  },

  /* -----------------------------
    DELETE
  ----------------------------- */
  deleteCategoryValidation: {
    body: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    params: categoryIdParams,
  },

  /* -----------------------------
    IMAGE endpoints
    PUT /categories/image?categoryId=...
    PUT /categories/image/remove?categoryId=...
  ----------------------------- */
  uploadCategoryImageValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true), // IMPORTANT so your helper doesn't crash
    query: categoryIdQuery,
  },

  removeCategoryImageValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true), // IMPORTANT so your helper doesn't crash
    query: categoryIdQuery,
  },
};
