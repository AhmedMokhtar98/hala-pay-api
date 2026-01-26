// validations/category.validation.js
const Joi = require("joi");

const joiOptions = {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
};

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
  Category fields (match schema)
----------------------------- */

// ✅ NOW REQUIRED (on create)
const nameEnRequired = Joi.string()
  .trim()
  .min(1)
  .required()
  .messages({
    "string.base": "errors.validCategoryNameEn",
    "string.empty": "errors.emptyCategoryNameEn",
    "string.min": "errors.emptyCategoryNameEn",
    "any.required": "errors.requiredCategoryNameEn",
  });

const nameArRequired = Joi.string()
  .trim()
  .min(1)
  .required()
  .messages({
    "string.base": "errors.validCategoryNameAr",
    "string.empty": "errors.emptyCategoryNameAr",
    "string.min": "errors.emptyCategoryNameAr",
    "any.required": "errors.requiredCategoryNameAr",
  });

// ✅ Optional versions (for update)
const nameEnOptional = Joi.string().trim().min(1).optional().messages({
  "string.base": "errors.validCategoryNameEn",
  "string.empty": "errors.emptyCategoryNameEn",
  "string.min": "errors.emptyCategoryNameEn",
});

const nameArOptional = Joi.string().trim().min(1).optional().messages({
  "string.base": "errors.validCategoryNameAr",
  "string.empty": "errors.emptyCategoryNameAr",
  "string.min": "errors.emptyCategoryNameAr",
});

const descriptionEn = Joi.string().trim().allow("").messages({
  "string.base": "errors.validCategoryDescriptionEn",
});

const descriptionAr = Joi.string().trim().allow("").messages({
  "string.base": "errors.validCategoryDescriptionAr",
});

const image = Joi.string().trim().allow("").messages({
  "string.base": "errors.validCategoryImage",
});

const isActive = Joi.boolean().messages({
  "boolean.base": "errors.validIsActive",
});

/* -----------------------------
  Params / Query
----------------------------- */

const categoryIdParams = Joi.object({
  categoryId: objectId.required().messages({
    "any.required": "errors.requiredCategoryId",
  }),
})
  .options(joiOptions)
  .unknown(false);

const categoryIdQuery = Joi.object({
  categoryId: objectId.required().messages({
    "any.required": "errors.requiredCategoryId",
  }),
})
  .options(joiOptions)
  .unknown(false);

/* -----------------------------
  Exports
----------------------------- */

module.exports = {
  /* -----------------------------
    CREATE
    body: store + nameEn + nameAr (both required)
  ----------------------------- */
  createCategoryValidation: {
    params: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),

    body: Joi.object({
      store: objectId.required().messages({
        "any.required": "errors.requiredStore",
      }),

      // ✅ both required
      nameEn: nameEnRequired,
      nameAr: nameArRequired,

      descriptionEn: descriptionEn.optional(),
      descriptionAr: descriptionAr.optional(),
      image: image.optional(),
      isActive: isActive.optional(),
    })
      .options(joiOptions)
      .unknown(false),
  },

  /* -----------------------------
    LIST
  ----------------------------- */
  listCategoriesValidation: {
    params: Joi.object({}).options(joiOptions).unknown(true),
    body: Joi.object({}).options(joiOptions).unknown(true),

    query: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),

      isActive: boolQuery.optional(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(200).optional(),

      search: Joi.string().trim().allow("").optional(),
      q: Joi.string().trim().allow("").optional(),
      keyword: Joi.string().trim().allow("").optional(),

      sort: Joi.string().trim().allow("").optional(),
      populateStore: boolQuery.optional(),
    })
      .options(joiOptions)
      .unknown(true),
  },

  /* -----------------------------
    PARAMS
  ----------------------------- */
  categoryIdParamsValidation: {
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: categoryIdParams,
  },

  /* -----------------------------
    UPDATE
    body: any field (min 1)
    - names are optional, but if sent they must be non-empty
  ----------------------------- */
  updateCategoryValidation: {
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: categoryIdParams,

    body: Joi.object({
      store: objectId.optional(),

      nameEn: nameEnOptional,
      nameAr: nameArOptional,

      descriptionEn: descriptionEn.optional(),
      descriptionAr: descriptionAr.optional(),
      image: image.optional(),
      isActive: isActive.optional(),
    })
      .min(1)
      .messages({ "object.min": "errors.emptyBody" })
      .options(joiOptions)
      .unknown(false),
  },

  /* -----------------------------
    DELETE
  ----------------------------- */
  deleteCategoryValidation: {
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: categoryIdParams,
  },

  /* -----------------------------
    IMAGE endpoints
    PUT /categories/image?categoryId=...
    PUT /categories/image/remove?categoryId=...
  ----------------------------- */
  uploadCategoryImageValidation: {
    params: Joi.object({}).options(joiOptions).unknown(true),
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: categoryIdQuery,
  },

  removeCategoryImageValidation: {
    params: Joi.object({}).options(joiOptions).unknown(true),
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: categoryIdQuery,
  },
};
