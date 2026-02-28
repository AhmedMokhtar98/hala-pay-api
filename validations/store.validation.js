const Joi = require("joi");

module.exports = {
  // POST /api/v1/admin/store
  createStoreValidation: {
    body: Joi.object({
      businessName: Joi.string()
        .trim()
        .min(2)
        .required()
        .messages({
          "string.base": "errors.validBusinessName",
          "string.empty": "errors.requiredBusinessName",
          "string.min": "errors.businessNameTooShort",
          "any.required": "errors.requiredBusinessName",
        }),

      provider: Joi.object({
        name: Joi.string()
          .valid("internal") // 🔥 manual only
          .required()
          .messages({
            "any.only": "errors.invalidProvider",
            "any.required": "errors.requiredProvider",
          }),

        domain: Joi.string()
          .allow("", null)
          .trim()
          .optional()
          .messages({
            "string.base": "errors.validDomain",
          }),
      }).required().messages({
        "any.required": "errors.requiredProviderObject",
      }),
    }),
  },

  // GET /api/v1/admin/store/:storeId
  storeIdParamsValidation: {
    params: Joi.object({
      storeId: Joi.string()
        .pattern(/^\d{9}$/)
        .required()
        .messages({
          "string.base": "errors.validStoreId",
          "string.pattern.base": "errors.storeIdMustBe9Digits",
          "any.required": "errors.requiredStoreId",
        }),
    }),
  },
};