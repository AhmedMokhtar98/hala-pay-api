const Joi = require("joi");

const joiOptions = {
  abortEarly: false,
  stripUnknown: false,
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

const posNumber = Joi.number().positive().messages({
  "number.base": "errors.validAmount",
  "number.positive": "errors.invalidAmount",
});

const paymentMethod = Joi.string()
  .trim()
  .valid("testing", "credit_card", "paypal", "bank_transfer", "wallet")
  .messages({
    "string.base": "errors.validPaymentMethod",
    "any.only": "errors.invalidPaymentMethod",
  });

const requestTransactionStatus = Joi.string()
  .trim()
  .valid("success", "failed")
  .messages({
    "string.base": "errors.validTransactionStatus",
    "any.only": "errors.invalidTransactionStatus",
  });

/* -----------------------------
  Params
----------------------------- */

const groupTopUpParams = Joi.object({
  groupId: objectId.required().messages({
    "any.required": "errors.requiredGroupId",
  }),
})
  .options(joiOptions)
  .unknown(false);

/* -----------------------------
  Exports
----------------------------- */

module.exports = {
  topUpGroupValidation: {
    params: groupTopUpParams,
    query: Joi.object({}).options(joiOptions).unknown(true),

    body: Joi.object({
      amount: posNumber.required().messages({
        "any.required": "errors.requiredAmount",
      }),

      transactionStatus: requestTransactionStatus.required().messages({
        "any.required": "errors.requiredTransactionStatus",
      }),

      method: paymentMethod.optional(),

      note: Joi.string().trim().allow("").optional().messages({
        "string.base": "errors.validNote",
      }),
    })
      .options(joiOptions)
      .unknown(false),
  },
};