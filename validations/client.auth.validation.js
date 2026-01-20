// validations/client.validation.js
const Joi = require("joi");

const joiOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: true,
};

const requiredString = (requiredKey, invalidKey) =>
  Joi.string()
    .trim()
    .min(1)
    .required()
    .messages({
      "string.base": invalidKey,
      "string.empty": requiredKey,
      "string.min": requiredKey,
      "any.required": requiredKey,
    });

const optionalString = (invalidKey) =>
  Joi.string()
    .trim()
    .min(1)
    .optional()
    .messages({
      "string.base": invalidKey,
      "string.empty": invalidKey,
      "string.min": invalidKey,
    });

/**
 * ✅ Phone Code validator (like +20, +966, +1)
 * - Must start with "+"
 * - digits only after +
 * - length checks excluding "+"
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
      const digitsCount = value.length - 1; // exclude "+"
      if (digitsCount < MIN_DIGITS) return helpers.error("string.min");
      if (digitsCount > MAX_DIGITS) return helpers.error("string.max");
      return value;
    }, "phoneCode length validation")
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

/**
 * ✅ Phone Number validator (like 1097005710)
 * - digits only (no +)
 * - length checks
 */
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
    }, "phoneNumber length validation")
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

/**
 * ✅ Helper: validate phone pair (code + number)
 * - If one is sent, the other MUST be sent
 * - Use this for updateValidation so you don't get partial phone updates
 */
const phonePairPresenceRule = (obj, helpers) => {
  const hasCode = typeof obj.phoneCode !== "undefined";
  const hasNumber = typeof obj.phoneNumber !== "undefined";

  // both missing => ok
  if (!hasCode && !hasNumber) return obj;

  // one missing => error
  if (hasCode && !hasNumber) {
    return helpers.error("object.with", { main: "phoneCode", peer: "phoneNumber" });
  }
  if (!hasCode && hasNumber) {
    return helpers.error("object.with", { main: "phoneNumber", peer: "phoneCode" });
  }

  return obj;
};

module.exports = {
  // ✅ Check if email exists
  emailCheckValidation: {
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
    }).options(joiOptions),
  },

  /**
   * ✅ Check if phone exists (PAIR uniqueness)
   * body: { phoneCode: "+20", phoneNumber: "1097005710" }
   */
  phoneCheckExistValidation: {
    body: Joi.object({
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
    }).options(joiOptions),
  },

  // ✅ Register (create)
  registerValidation: {
    body: Joi.object({
      firstName: requiredString("errors.requiredFirstName", "errors.validFirstName"),
      lastName: requiredString("errors.requiredLastName", "errors.validLastName"),

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

      // ✅ required phone pair
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

      password: Joi.string()
        .trim()
        .min(6)
        .required()
        .messages({
          "string.base": "errors.validPassword",
          "string.empty": "errors.emptyPassword",
          "string.min": "errors.passwordTooShort",
          "any.required": "errors.requiredPassword",
        }),

      os: optionalString("errors.validOS"),

      birthDate: Joi.date().optional().messages({
        "date.base": "errors.validBirthDate",
      }),

      otp: Joi.string()
      .trim()
      .min(4) // change to 6 if your OTP is 6 digits
      .max(8) // adjust if needed
      .messages({
        "string.base": "errors.validOtp",
        "string.empty": "errors.emptyOtp",
        "string.min": "errors.validOtp",
        "string.max": "errors.validOtp",
        "any.required": "errors.requiredOtp",
      }),
      fcmToken: Joi
          .string()
          .required()
          .messages({
            "string.base": "errors.validFCMToken",
            "any.required": "errors.requiredFCMToken",
            "string.empty": "errors.emptyFCMToken",
    }),
    }).options(joiOptions),
    
  },

  // ✅ Update
  updateValidation: {
    body: Joi.object({
      firstName: optionalString("errors.validFirstName"),
      lastName: optionalString("errors.validLastName"),

      email: Joi.string()
        .trim()
        .email({ minDomainSegments: 2 })
        .optional()
        .messages({
          "string.base": "errors.validEmail",
          "string.email": "errors.validEmail",
          "string.empty": "errors.emptyEmail",
        }),

      // ✅ optional phone pair (but must come together)
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

      os: optionalString("errors.validOS"),

      password: Joi.string()
        .trim()
        .min(6)
        .optional()
        .messages({
          "string.base": "errors.validPassword",
          "string.empty": "errors.emptyPassword",
          "string.min": "errors.passwordTooShort",
        }),

      image: Joi.object().optional().messages({
        "object.base": "errors.validImage",
      }),

      birthDate: Joi.date().optional().messages({
        "date.base": "errors.validBirthDate",
      }),
    })
      // ✅ require at least 1 field
      .min(1)
      .messages({
        "object.min": "errors.noFieldsToUpdate",
      })
      // ✅ AND require phone pair together if one provided
      .custom(phonePairPresenceRule, "phone pair presence")
      .messages({
        // phoneCode provided without phoneNumber OR vice versa
        "object.with": "errors.phoneBothRequired"
      })
      .options(joiOptions),
  },

  sendOtpValidation: {
  body: Joi.object({
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
  })
    .options(joiOptions)
    .unknown(false),
},
  verifyOtpValidation: {
  body: Joi.object({
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

    otp: Joi.string()
      .trim()
      .min(4) // change to 6 if your OTP is 6 digits
      .max(8) // adjust if needed
      .messages({
        "string.base": "errors.validOtp",
        "string.empty": "errors.emptyOtp",
        "string.min": "errors.validOtp",
        "string.max": "errors.validOtp",
        "any.required": "errors.requiredOtp",
      }),
  })
    .options(joiOptions)
    .unknown(false),
},



  // ✅ Login
  loginValidation: {
    body: Joi.object({
    type: Joi.string()
      .trim()
      .valid("email", "phone")
      .required()
      .messages({
        "string.base": "errors.invalid_login_type",
        "any.only": "errors.invalid_login_type",
        "any.required": "errors.required_login_type",
      }),

    // ---------- EMAIL FLOW ----------
    email: Joi.string()
      .trim()
      .email({ minDomainSegments: 2 })
      .when("type", {
        is: "email",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "string.base": "errors.validEmail",
        "string.email": "errors.validEmail",
        "string.empty": "errors.emptyEmail",
        "any.required": "errors.requiredEmail",
        "any.unknown": "errors.email_not_allowed", // will appear when forbidden() hits (optional)
      }),

    password: Joi.string()
      .trim()
      .min(1)
      .when("type", {
        is: "email",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "string.base": "errors.validPassword",
        "string.empty": "errors.emptyPassword",
        "string.min": "errors.emptyPassword",
        "any.required": "errors.requiredPassword",
        "any.unknown": "errors.password_not_allowed",
      }),

    // ---------- PHONE FLOW ----------
    phoneCode: Joi.string()
      .trim()
      .when("type", {
        is: "phone",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "string.base": "errors.validPhoneCode",
        "string.empty": "errors.emptyPhoneCode",
        "any.required": "errors.requiredPhoneCode",
      }),

    phoneNumber: Joi.string()
      .trim()
      .when("type", {
        is: "phone",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "string.base": "errors.validPhoneNumber",
        "string.empty": "errors.emptyPhoneNumber",
        "any.required": "errors.requiredPhoneNumber",
      }),

    otp: Joi.string()
      .trim()
      .min(4) // change to 6 if your OTP is 6 digits
      .max(8) // adjust if needed
      .when("type", {
        is: "phone",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "string.base": "errors.validOtp",
        "string.empty": "errors.emptyOtp",
        "string.min": "errors.validOtp",
        "string.max": "errors.validOtp",
        "any.required": "errors.requiredOtp",
      }),

    fcmToken: Joi
          .string()
          .required()
          .messages({
            "string.base": "errors.validFCMToken",
            "any.required": "errors.requiredFCMToken",
            "string.empty": "errors.emptyFCMToken",
    }),
  })
    .options(joiOptions)
    .unknown(false), // ✅ blocks extra fields (recommended)
  },

  

  // ✅ Forgot password
  forgotPasswordValidation: {
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
    }).options(joiOptions),
  },

  // ✅ Reset password
  resetPasswordValidation: {
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

      newPassword: Joi.string()
        .trim()
        .min(6)
        .required()
        .messages({
          "string.base": "errors.validPassword",
          "string.empty": "errors.emptyPassword",
          "string.min": "errors.passwordTooShort",
          "any.required": "errors.requiredPassword",
        }),

      otp: Joi.string()
        .trim()
        .min(4) // change to 6 if your OTP is 6 digits
        .max(8) // adjust if needed
        .required()
        .messages({
          "string.base": "errors.validOtp",
          "string.empty": "errors.emptyOtp",
          "string.min": "errors.validOtp",
          "string.max": "errors.validOtp",
          "any.required": "errors.requiredOtp",
        }),
    }).options(joiOptions),
  },

  refreshTokenValidation: {
    body: Joi.object({
      refreshToken: Joi.string()
        .trim()
        .required()
        .messages({
          "string.base": "errors.validRefreshToken",
          "string.empty": "errors.emptyRefreshToken",
          "any.required": "errors.requiredRefreshToken",
        }),
    }).options(joiOptions),
  },
};


