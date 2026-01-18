const Joi = require("joi");

module.exports = {
  // POST /api/v1/admin/store
  createStoreValidation: {
    body: Joi.object({
      businessName: Joi.string().optional().messages({
        "string.base": "errors.validBusinessName",
      }),
    }),
  },

  // GET /api/v1/admin/store/:storeId
  storeIdParamsValidation: {
    params: Joi.object({
      storeId: Joi.string()
        .pattern(/^\d{9}$/) // 9 digits like your generated storeId
        .required()
        .messages({
          "string.base": "errors.validStoreId",
          "string.pattern.base": "errors.storeIdMustBe9Digits",
          "any.required": "errors.requiredStoreId",
        }),
    }),
  },

};
