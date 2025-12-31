const Joi = require("joi");

module.exports = {
  createAdminValidation: {
    body: Joi.object({
      name: Joi.string().required().messages({
        "string.base": "errors.validName",
        "any.required": "errors.requiredName",
      }),

      userName: Joi.string().required().empty().messages({
        "string.base": "errors.validUsername",
        "any.required": "errors.requiredUsername",
        "string.empty": "errors.emptyUsername",
      }),

      password: Joi.string().required().empty().messages({
        "string.base": "errors.validPassword",
        "any.required": "errors.requiredPassword",
        "string.empty": "errors.emptyPassword",
      }),

      image: Joi.object().optional().messages({
        "object.base": "errors.validImage",
      }),

      permission: Joi.string().optional().messages({
        "string.base": "errors.validPermissions",
      }),

      role: Joi.string().optional().messages({
        "string.base": "errors.validRole",
      }),

      isActive: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsActive",
      }),

      session: Joi.object().optional().messages({
        "object.base": "errors.validSession",
      }),
    }),
  },

  updateAdminValidation: {
    body: Joi.object({
      name: Joi.string().optional().messages({
        "string.base": "errors.validName",
      }),

      userName: Joi.string().optional().empty().messages({
        "string.base": "errors.validUsername",
        "string.empty": "errors.emptyUsername",
      }),

      permission: Joi.string().optional().messages({
        "string.base": "errors.validPermissions",
      }),

      role: Joi.string().optional().messages({
        "string.base": "errors.validRole",
      }),

      isActive: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsActive",
      }),

      session: Joi.object().optional().messages({
        "object.base": "errors.validSession",
      }),
    }),
  },

  loginValidation: {
    body: Joi.object({
      userName: Joi.string().required().empty().messages({
        "string.base": "errors.validUsername",
        "any.required": "errors.requiredUsername",
        "string.empty": "errors.emptyUsername",
      }),

      password: Joi.string().required().empty().messages({
        "string.base": "errors.validPassword",
        "any.required": "errors.requiredPassword",
        "string.empty": "errors.emptyPassword",
      }),
    }),
  },

  resetPasswordValidation: {
    body: Joi.object({
      userName: Joi.string().optional().empty().messages({
        "string.base": "errors.validUsername",
        "string.empty": "errors.emptyUsername",
      }),

      newPassword: Joi.string().required().empty().messages({
        "string.base": "errors.validPassword",
        "any.required": "errors.requiredPassword",
        "string.empty": "errors.emptyPassword",
      }),
    }),
  },
};
