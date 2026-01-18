// validations/client.validation.js
const Joi = require("joi");

const joiOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: true,
};

/* ------------------------------ Phone Validators ------------------------------ */
/**
 * phoneCode example: +20, +966
 * phoneNumber example: 1097005710
 * - phoneCode: must start with + then digits only
 * - phoneNumber: digits only
 * - update: if one of them exists in body, the other must exist too
 */

const makePhoneCodeSchema = ({
  required = false,
  requiredKey = "errors.requiredPhoneCode",
  emptyKey = "errors.emptyPhoneCode",
  invalidKey = "errors.validPhoneCode",
  minKey = "errors.phoneCodeTooShort",
  maxKey = "errors.phoneCodeTooLong",
  MIN_DIGITS = 1,
  MAX_DIGITS = 4,
} = {}) => {
  let schema = Joi.string()
    .trim()
    .pattern(/^\+\d+$/)
    .custom((value, helpers) => {
      const digitsCount = value.length - 1; // exclude '+'
      if (digitsCount < MIN_DIGITS) return helpers.error("string.min");
      if (digitsCount > MAX_DIGITS) return helpers.error("string.max");
      return value;
    }, "phoneCode length")
    .messages({
      "string.base": invalidKey,
      "string.pattern.base": invalidKey,
      "string.empty": emptyKey,
      "any.required": requiredKey,
      "string.min": minKey,
      "string.max": maxKey,
    });

  return required ? schema.required() : schema.optional();
};

const makePhoneNumberSchema = ({
  required = false,
  requiredKey = "errors.requiredPhoneNumber",
  emptyKey = "errors.emptyPhoneNumber",
  invalidKey = "errors.validPhoneNumber",
  minKey = "errors.phoneNumberTooShort",
  maxKey = "errors.phoneNumberTooLong",
  MIN_DIGITS = 7,
  MAX_DIGITS = 15,
} = {}) => {
  let schema = Joi.string()
    .trim()
    .pattern(/^\d+$/)
    .custom((value, helpers) => {
      const digitsCount = value.length;
      if (digitsCount < MIN_DIGITS) return helpers.error("string.min");
      if (digitsCount > MAX_DIGITS) return helpers.error("string.max");
      return value;
    }, "phoneNumber length")
    .messages({
      "string.base": invalidKey,
      "string.pattern.base": invalidKey,
      "string.empty": emptyKey,
      "any.required": requiredKey,
      "string.min": minKey,
      "string.max": maxKey,
    });

  return required ? schema.required() : schema.optional();
};

// ✅ if phoneCode exists => phoneNumber required, and vice versa (for update)
const phonePairPresenceRule = (obj, helpers) => {
  const hasCode = Object.prototype.hasOwnProperty.call(obj, "phoneCode");
  const hasNumber = Object.prototype.hasOwnProperty.call(obj, "phoneNumber");

  if (!hasCode && !hasNumber) return obj;

  if (hasCode && !hasNumber) {
    return helpers.error("object.with", { main: "phoneCode", peer: "phoneNumber" });
  }
  if (!hasCode && hasNumber) {
    return helpers.error("object.with", { main: "phoneNumber", peer: "phoneCode" });
  }

  return obj;
};

/* ------------------------------ Exports ------------------------------ */
module.exports = {
  createClientValidation: {
    body: Joi.object({
      firstName: Joi.string().trim().required().messages({
        "string.base": "errors.validFirstName",
        "string.empty": "errors.requiredFirstName",
        "any.required": "errors.requiredFirstName",
      }),

      lastName: Joi.string().trim().required().messages({
        "string.base": "errors.validLastName",
        "string.empty": "errors.requiredLastName",
        "any.required": "errors.requiredLastName",
      }),

      email: Joi.string()
        .trim()
        .email({ minDomainSegments: 2 })
        .required()
        .messages({
          "string.base": "errors.validEmail",
          "string.email": "errors.validEmail",
          "string.empty": "errors.emptyEmail",
          "any.required": "errors.requiredEmail",
        }),

      // ✅ phone split (required)
      phoneCode: makePhoneCodeSchema({
        required: true,
        MIN_DIGITS: 1,
        MAX_DIGITS: 4,
        requiredKey: "errors.requiredPhoneCode",
        emptyKey: "errors.emptyPhoneCode",
        invalidKey: "errors.validPhoneCode",
        minKey: "errors.phoneCodeTooShort",
        maxKey: "errors.phoneCodeTooLong",
      }),

      phoneNumber: makePhoneNumberSchema({
        required: true,
        MIN_DIGITS: 7,
        MAX_DIGITS: 15,
        requiredKey: "errors.requiredPhoneNumber",
        emptyKey: "errors.emptyPhoneNumber",
        invalidKey: "errors.validPhoneNumber",
        minKey: "errors.phoneNumberTooShort",
        maxKey: "errors.phoneNumberTooLong",
      }),

      password: Joi.string().trim().min(6).required().messages({
        "string.base": "errors.validPassword",
        "string.empty": "errors.emptyPassword",
        "string.min": "errors.passwordTooShort",
        "any.required": "errors.requiredPassword",
      }),

      image: Joi.object().optional().messages({
        "object.base": "errors.validImage",
      }),

      // if you want "must be true" use .valid(true)
      agreeToTerms: Joi.boolean().valid(true).required().messages({
        "boolean.base": "errors.validAgreeToTerms",
        "any.only": "errors.requiredAgreeToTerms",
        "any.required": "errors.requiredAgreeToTerms",
      }),

      os: Joi.string().trim().optional().messages({
        "string.base": "errors.validOS",
      }),

      isActive: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsActive",
      }),

      isEmailVerified: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsEmailVerified",
      }),

      isPhoneVerified: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsPhoneVerified",
      }),

      birthDate: Joi.date().optional().messages({
        "date.base": "errors.validBirthDate",
      }),

      joinDate: Joi.date().optional().messages({
        "date.base": "errors.validJoinDate",
      }),
    }).options(joiOptions),
  },

  updateClientValidation: {
    body: Joi.object({
      firstName: Joi.string().trim().optional().messages({
        "string.base": "errors.validFirstName",
        "string.empty": "errors.validFirstName",
      }),

      lastName: Joi.string().trim().optional().messages({
        "string.base": "errors.validLastName",
        "string.empty": "errors.validLastName",
      }),

      email: Joi.string()
        .trim()
        .email({ minDomainSegments: 2 })
        .optional()
        .messages({
          "string.base": "errors.validEmail",
          "string.email": "errors.validEmail",
          "string.empty": "errors.emptyEmail",
        }),

      // ✅ phone split (optional, but must come together)
      phoneCode: makePhoneCodeSchema({
        required: false,
        MIN_DIGITS: 1,
        MAX_DIGITS: 4,
        emptyKey: "errors.emptyPhoneCode",
        invalidKey: "errors.validPhoneCode",
        minKey: "errors.phoneCodeTooShort",
        maxKey: "errors.phoneCodeTooLong",
      }),

      phoneNumber: makePhoneNumberSchema({
        required: false,
        MIN_DIGITS: 7,
        MAX_DIGITS: 15,
        emptyKey: "errors.emptyPhoneNumber",
        invalidKey: "errors.validPhoneNumber",
        minKey: "errors.phoneNumberTooShort",
        maxKey: "errors.phoneNumberTooLong",
      }),

      os: Joi.string().trim().optional().messages({
        "string.base": "errors.validOS",
      }),

      password: Joi.string().trim().min(6).optional().messages({
        "string.base": "errors.validPassword",
        "string.empty": "errors.emptyPassword",
        "string.min": "errors.passwordTooShort",
      }),

      image: Joi.object().optional().messages({
        "object.base": "errors.validImage",
      }),

      isActive: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsActive",
      }),

      agreeToTerms: Joi.boolean().optional().messages({
        "boolean.base": "errors.validAgreeToTerms",
      }),

      isEmailVerified: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsEmailVerified",
      }),

      isPhoneVerified: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsPhoneVerified",
      }),

      birthDate: Joi.date().optional().messages({
        "date.base": "errors.validBirthDate",
      }),

      joinDate: Joi.date().optional().messages({
        "date.base": "errors.validJoinDate",
      }),
    })
      .min(1)
      .custom(phonePairPresenceRule, "phone pair presence")
      .messages({
        "object.min": "errors.noFieldsToUpdate",
        "object.with": "errors.phoneBothRequired"
      })
      .options(joiOptions),
  },

  loginClientValidation: {
    body: Joi.object({
      email: Joi.string()
        .trim()
        .email({ minDomainSegments: 2 })
        .required()
        .messages({
          "string.base": "errors.validEmail",
          "string.email": "errors.validEmail",
          "string.empty": "errors.emptyEmail",
          "any.required": "errors.requiredEmail",
        }),

      password: Joi.string().trim().required().messages({
        "string.base": "errors.validPassword",
        "string.empty": "errors.emptyPassword",
        "any.required": "errors.requiredPassword",
      }),
    }).options(joiOptions),
  },

  resetClientPasswordValidation: {
    body: Joi.object({
      email: Joi.string()
        .trim()
        .email({ minDomainSegments: 2 })
        .optional()
        .messages({
          "string.base": "errors.validEmail",
          "string.email": "errors.validEmail",
          "string.empty": "errors.emptyEmail",
        }),

      newPassword: Joi.string().trim().min(6).required().messages({
        "string.base": "errors.validPassword",
        "string.empty": "errors.emptyPassword",
        "string.min": "errors.passwordTooShort",
        "any.required": "errors.requiredPassword",
      }),
    }).options(joiOptions),
  },
};
