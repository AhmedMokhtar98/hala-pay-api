// validations/product.validation.js
const Joi = require("joi");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.base": "errors.validObjectId",
    "string.pattern.base": "errors.invalidObjectId",
  });

const objectIdOrNull = Joi.alternatives()
  .try(objectId, Joi.valid(null))
  .messages({
    "string.base": "errors.validObjectId",
    "string.pattern.base": "errors.invalidObjectId",
  });

const boolValue = Joi.boolean()
  .truthy("true", "1")
  .falsy("false", "0")
  .messages({
    "boolean.base": "errors.validBoolean",
  });

const stringAllowEmpty = Joi.string().trim().allow("");

const priceSchemaValidation = Joi.object({
  amount: Joi.number().min(0).optional().messages({
    "number.base": "errors.validPrice",
    "number.min": "errors.validPrice",
  }),
  currency: Joi.string().trim().min(1).optional().messages({
    "string.base": "errors.validCurrency",
    "string.empty": "errors.validCurrency",
  }),
});

const productCategoryValidation = Joi.object({
  providerCategoryId: stringAllowEmpty.optional(),
  name: stringAllowEmpty.optional(),
  nameEn: stringAllowEmpty.optional(),
  nameAr: stringAllowEmpty.optional(),
  categoryRef: objectIdOrNull.optional(),
});

const variantValidation = Joi.object({
  providerVariantId: stringAllowEmpty.optional(),
  sku: stringAllowEmpty.optional(),
  name: stringAllowEmpty.optional(),

  price: priceSchemaValidation.optional(),
  compareAtPrice: priceSchemaValidation.optional(),

  stock: Joi.number().min(0).optional().messages({
    "number.base": "errors.validStock",
    "number.min": "errors.validStock",
  }),
  unlimited: boolValue.optional(),
  isAvailable: boolValue.optional(),

  options: Joi.any().optional(),
});

const ratingValidation = Joi.object({
  count: Joi.number().min(0).optional().messages({
    "number.base": "errors.validRatingCount",
    "number.min": "errors.validRatingCount",
  }),
  rate: Joi.number().min(0).optional().messages({
    "number.base": "errors.validRatingRate",
    "number.min": "errors.validRatingRate",
  }),
});

const urlsValidation = Joi.object({
  admin: stringAllowEmpty.optional(),
  customer: stringAllowEmpty.optional(),
  product_card: stringAllowEmpty.optional(),
});

const createOrUpdateBodySchema = Joi.object({
  store: objectId.optional().messages({
    "string.base": "errors.validStoreId",
    "string.pattern.base": "errors.invalidStoreId",
  }),

  provider: Joi.string().trim().min(1).optional().messages({
    "string.base": "errors.validProvider",
    "string.empty": "errors.validProvider",
  }),
  providerProductId: stringAllowEmpty.optional(),

  name: stringAllowEmpty.optional().messages({
    "string.base": "errors.validProductName",
  }),
  description: Joi.string().allow("").optional().messages({
    "string.base": "errors.validProductDescription",
  }),

  images: Joi.array().items(Joi.string().trim()).optional().messages({
    "array.base": "errors.validProductImages",
  }),
  mainImage: stringAllowEmpty.optional().messages({
    "string.base": "errors.validImageUrl",
  }),
  thumbnail: stringAllowEmpty.optional().messages({
    "string.base": "errors.validImageUrl",
  }),

  priceBefore: priceSchemaValidation.optional(),
  price: priceSchemaValidation.optional(),
  salePrice: priceSchemaValidation.optional(),

  stock: Joi.number().min(0).optional().messages({
    "number.base": "errors.validStock",
    "number.min": "errors.validStock",
  }),

  unlimited: boolValue.optional(),
  isAvailable: boolValue.optional(),
  isActive: boolValue.optional(),

  status: stringAllowEmpty.optional(),
  sku: stringAllowEmpty.optional(),

  categories: Joi.array().items(productCategoryValidation).optional().messages({
    "array.base": "errors.validCategories",
  }),

  variants: Joi.array().items(variantValidation).optional().messages({
    "array.base": "errors.validVariants",
  }),

  rating: ratingValidation.optional(),

  discount: Joi.number().min(0).optional().messages({
    "number.base": "errors.validDiscount",
    "number.min": "errors.validDiscount",
  }),

  urls: urlsValidation.optional(),

  weight: Joi.number().min(0).optional().messages({
    "number.base": "errors.validWeight",
    "number.min": "errors.validWeight",
  }),

  weightUnit: stringAllowEmpty.optional(),

  raw: Joi.any().optional(),
});

module.exports = {
  createProductValidation: {
    params: Joi.object({}).unknown(true),
    query: Joi.object({}).unknown(true),
    body: createOrUpdateBodySchema
      .fork(["store", "provider"], (schema) => schema.required())
      .messages({
        "any.required": "errors.requiredField",
      }),
  },

  listProductsValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      store: objectId.optional(),
      provider: Joi.string().trim().optional(),
      providerProductId: Joi.string().trim().optional(),

      // for filtering nested categories
      categoryRef: objectId.optional(),
      category: objectId.optional(), // alias if your controller still uses "category"

      isActive: boolValue.optional(),
      isAvailable: boolValue.optional(),
      unlimited: boolValue.optional(),

      status: Joi.string().trim().optional(),
      sku: Joi.string().trim().optional(),

      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(200).optional(),

      search: Joi.string().allow("").optional(),
      q: Joi.string().allow("").optional(),
      keyword: Joi.string().allow("").optional(),

      sort: Joi.string().allow("").optional(),
      populate: boolValue.optional(),

      minPrice: Joi.number().min(0).optional(),
      maxPrice: Joi.number().min(0).optional(),
      minStock: Joi.number().min(0).optional(),
      maxStock: Joi.number().min(0).optional(),
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
    body: createOrUpdateBodySchema.min(1).messages({
      "object.min": "errors.emptyBody",
    }),
  },

  deleteProductValidation: {
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      deletePermanently: boolValue.optional(),
    }).unknown(true),
    params: Joi.object({
      productId: objectId.required().messages({
        "any.required": "errors.requiredProductId",
      }),
    }),
  },

  uploadProductImagesValidation: {
    params: Joi.object({}).unknown(true),
    body: Joi.object({}).unknown(true),
    query: Joi.object({
      productId: objectId.required().messages({
        "any.required": "errors.requiredProductId",
      }),
    }),
  },

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