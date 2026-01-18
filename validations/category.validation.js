// validations/category.validation.js
const Joi = require("joi");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.base": "errors.validObjectId",
    "string.pattern.base": "errors.invalidObjectId",
  });

const storeId9 = Joi.string()
  .pattern(/^\d{9}$/)
  .messages({
    "string.base": "errors.validStoreId",
    "string.pattern.base": "errors.storeIdMustBe9Digits",
  });

const boolQuery = Joi.boolean()
  .truthy("true", "1")
  .falsy("false", "0")
  .messages({
    "boolean.base": "errors.validBoolean",
  });

module.exports = {
  createCategoryValidation: {
    params: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    body: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),

      name: Joi.string().trim().min(1).required().messages({
        "string.base": "errors.validCategoryName",
        "string.min": "errors.categoryNameMin",
        "any.required": "errors.requiredCategoryName",
      }),

      description: Joi.string().allow("").optional().messages({
        "string.base": "errors.validCategoryDescription",
      }),
    })
      .or("store", "storeId")
      .messages({
        "object.missing": "errors.requiredStoreOrStoreId",
      }),
  },

  listCategoriesValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),

      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(200).optional(),

      search: Joi.string().allow("").optional(),
      q: Joi.string().allow("").optional(),
      keyword: Joi.string().allow("").optional(),

      sort: Joi.string().allow("").optional(),
      populateStore: boolQuery.optional(),
    }).unknown(true),
  },

  categoryIdParamsValidation: {
    body: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    params: Joi.object({
      categoryId: objectId.required().messages({
        "any.required": "errors.requiredCategoryId",
      }),
    }),
  },

  updateCategoryValidation: {
    query: Joi.object({}).unknown(true),
    params: Joi.object({
      categoryId: objectId.required().messages({
        "any.required": "errors.requiredCategoryId",
      }),
    }),
    body: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),

      name: Joi.string().trim().min(1).optional().messages({
        "string.base": "errors.validCategoryName",
        "string.min": "errors.categoryNameMin",
      }),

      description: Joi.string().allow("").optional().messages({
        "string.base": "errors.validCategoryDescription",
      }),
    })
      .min(1)
      .messages({
        "object.min": "errors.emptyBody",
      }),
  },

  deleteCategoryValidation: {
    body: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    params: Joi.object({
      categoryId: objectId.required().messages({
        "any.required": "errors.requiredCategoryId",
      }),
    }),
  },

  // ✅ upload image endpoint: PUT /categories/image?categoryId=...
  uploadCategoryImageValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true), // IMPORTANT so your helper doesn't crash
    query: Joi.object({
      categoryId: objectId.required().messages({
        "any.required": "errors.requiredCategoryId",
      }),
    }),
  },

  // ✅ remove image endpoint: PUT /categories/image/remove?categoryId=...
  removeCategoryImageValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true), // IMPORTANT so your helper doesn't crash
    query: Joi.object({
      categoryId: objectId.required().messages({ "any.required": "errors.requiredCategoryId", }),
    }),
  },
};
