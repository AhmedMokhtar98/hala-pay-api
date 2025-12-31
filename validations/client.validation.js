const Joi = require("joi");

module.exports = {
  createClientValidation: {
    body: Joi.object({
      firstName: Joi.string().required().messages({
        "string.base": "errors.validFirstName",
        "any.required": "errors.requiredFirstName",
      }),

      lastName: Joi.string().required().messages({
        "string.base": "errors.validLastName",
        "any.required": "errors.requiredLastName",
      }),

      email: Joi.string()
        .email({ minDomainSegments: 2 })
        .required()
        .messages({
          "string.email": "errors.validEmail",
          "any.required": "errors.requiredEmail",
        }),

      phoneNumber: Joi.string().required().messages({
        "string.base": "errors.validPhone",
        "any.required": "errors.requiredPhone",
      }),

      password: Joi.string().required().empty().messages({
        "string.base": "errors.validPassword",
        "any.required": "errors.requiredPassword",
        "string.empty": "errors.emptyPassword",
      }),

      image: Joi.object().optional().messages({
        "object.base": "errors.validImage",
      }),

      agreeToTerms: Joi.boolean().required().messages({
        "boolean.base": "errors.validAgreeToTerms",
        "any.required": "errors.requiredAgreeToTerms",
      }),
      os: Joi.string().optional().messages({
        "string.base": "errors.validOS",
      }),

      isActive: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsActive",
      }),

      isEmailVerified: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsEmailVerified",
      }),

      joinDate: Joi.date().optional().messages({
        "date.base": "errors.validJoinDate",
      }),
    }),
  },

  updateClientValidation: {
    body: Joi.object({
      firstName: Joi.string().optional().messages({
        "string.base": "errors.validFirstName",
      }),

      lastName: Joi.string().optional().messages({
        "string.base": "errors.validLastName",
      }),

      email: Joi.string()
        .email({ minDomainSegments: 2 })
        .optional()
        .messages({
          "string.email": "errors.validEmail",
        }),

      phoneNumber: Joi.string().optional().messages({
        "string.base": "errors.validPhone",
      }),

      os: Joi.string().optional().messages({
        "string.base": "errors.validOS",
      }),

      password: Joi.string().optional().min(6).messages({
        "string.base": "errors.validPassword",
        "string.empty": "errors.emptyPassword",
        "string.min": "errors.passwordTooShort"
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
    }),
  },

  loginClientValidation: {
    body: Joi.object({
      email: Joi.string()
        .email({ minDomainSegments: 2 })
        .required()
        .empty()
        .messages({
          "string.email": "errors.validEmail",
          "any.required": "errors.requiredEmail",
          "string.empty": "errors.emptyEmail",
        }),

      password: Joi.string().required().empty().messages({
        "string.base": "errors.validPassword",
        "any.required": "errors.requiredPassword",
        "string.empty": "errors.emptyPassword",
      }),
    }),
  },

  resetClientPasswordValidation: {
    body: Joi.object({
      email: Joi.string()
        .email({ minDomainSegments: 2 })
        .optional()
        .empty()
        .messages({
          "string.email": "errors.validEmail",
          "string.empty": "errors.emptyEmail",
        }),

      newPassword: Joi.string().required().empty().messages({
        "string.base": "errors.validPassword",
        "any.required": "errors.requiredPassword",
        "string.empty": "errors.emptyPassword",
      }),
    }),
  },
};
