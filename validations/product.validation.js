// validations/product.validation.js
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
  createProductValidation: {
    params: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    body: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),

      category: objectId.required().messages({
        "string.base": "errors.validCategoryId",
        "string.pattern.base": "errors.invalidCategoryId",
        "any.required": "errors.requiredCategoryId",
      }),

      name: Joi.string().trim().min(1).required().messages({
        "string.base": "errors.validProductName",
        "string.min": "errors.productNameMin",
        "any.required": "errors.requiredProductName",
      }),

      description: Joi.string().allow("").optional().messages({
        "string.base": "errors.validProductDescription",
      }),

      images: Joi.array().items(Joi.string().trim()).optional().messages({
        "array.base": "errors.validProductImages",
      }),

      priceBefore: Joi.number().min(0).optional().messages({
        "number.base": "errors.validPriceBefore",
        "number.min": "errors.validPriceBefore",
      }),

      price: Joi.number().min(0).optional().messages({
        "number.base": "errors.validPrice",
        "number.min": "errors.validPrice",
      }),

      stock: Joi.number().integer().min(0).optional().messages({
        "number.base": "errors.validStock",
        "number.integer": "errors.validStock",
        "number.min": "errors.validStock",
      }),

      discount: Joi.number().min(0).max(100).optional().messages({
        "number.base": "errors.validDiscount",
        "number.min": "errors.validDiscount",
        "number.max": "errors.validDiscount",
      }),

      isActive: boolQuery.optional(),
    })
      .or("store", "storeId")
      .messages({
        "object.missing": "errors.requiredStoreOrStoreId",
      }),
  },

  listProductsValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),
      category: objectId.optional(),
      isActive: boolQuery.optional(),

      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(200).optional(),

      search: Joi.string().allow("").optional(),
      q: Joi.string().allow("").optional(),
      keyword: Joi.string().allow("").optional(),

      sort: Joi.string().allow("").optional(),
      populate: boolQuery.optional(),

      minPrice: Joi.number().min(0).optional(),
      maxPrice: Joi.number().min(0).optional(),
      minStock: Joi.number().integer().min(0).optional(),
    }).unknown(true),
  },

  productIdParamsValidation: {
    body: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    params: Joi.object({
      productId: objectId.required().messages({
        "any.required": "errors.requiredProductId",
      }),
    }),
  },

  updateProductValidation: {
    query: Joi.object({}).unknown(true),
    params: Joi.object({
      productId: objectId.required().messages({
        "any.required": "errors.requiredProductId",
      }),
    }),
    body: Joi.object({
      store: objectId.optional(),
      storeId: storeId9.optional(),
      category: objectId.optional(),

      name: Joi.string().trim().min(1).optional().messages({
        "string.base": "errors.validProductName",
        "string.min": "errors.productNameMin",
      }),

      description: Joi.string().allow("").optional().messages({
        "string.base": "errors.validProductDescription",
      }),

      images: Joi.array().items(Joi.string().trim()).optional().messages({
        "array.base": "errors.validProductImages",
      }),

      priceBefore: Joi.number().min(0).optional().messages({
        "number.base": "errors.validPriceBefore",
        "number.min": "errors.validPriceBefore",
      }),

      price: Joi.number().min(0).optional().messages({
        "number.base": "errors.validPrice",
        "number.min": "errors.validPrice",
      }),

      stock: Joi.number().integer().min(0).optional().messages({
        "number.base": "errors.validStock",
        "number.integer": "errors.validStock",
        "number.min": "errors.validStock",
      }),

      discount: Joi.number().min(0).max(100).optional().messages({
        "number.base": "errors.validDiscount",
        "number.min": "errors.validDiscount",
        "number.max": "errors.validDiscount",
      }),

      isActive: boolQuery.optional(),
    })
      .min(1)
      .messages({
        "object.min": "errors.emptyBody",
      }),
  },

  deleteProductValidation: {
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      deletePermanently: boolQuery.optional(),
    }).unknown(true),
    params: Joi.object({
      productId: objectId.required().messages({
        "any.required": "errors.requiredProductId",
      }),
    }),
  },

  // ✅ upload multiple images: PUT /products/images?productId=...
  uploadProductImagesValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      productId: objectId.required().messages({
        "any.required": "errors.requiredProductId",
      }),
    }),
  },

  // ✅ remove one image: PUT /products/images/remove?productId=...&imageUrl=...
  removeProductImageValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      productId: objectId.required().messages({
        "any.required": "errors.requiredProductId",
      }),
      imageUrl: Joi.string().min(1).required().messages({
        "string.base": "errors.validImageUrl",
        "any.required": "errors.requiredImageUrl",
      }),
    }),
  },

  // ✅ clear all images: PUT /products/images/clear?productId=...
  clearProductImagesValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      productId: objectId.required().messages({
        "any.required": "errors.requiredProductId",
      }),
    }),
  },
};
