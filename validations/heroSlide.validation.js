// validations/heroSlide.validation.js
const Joi = require("joi");

const joiOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: false,
};
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.base": "errors.validObjectId",
    "string.pattern.base": "errors.invalidObjectId",
  });

/* ------------------------------ Helpers ------------------------------ */

const makeLangSchema = ({
  requiredEn = false,
  requiredKeyEn = "errors.requiredEnglishTitle",
  emptyKeyEn = "errors.emptyEnglishTitle",
  baseKey = "errors.validLangObject",
  validEnKey = "errors.validEnglishText",
  validArKey = "errors.validArabicText",
} = {}) => {
  const enSchema = Joi.string().trim().messages({
    "string.base": validEnKey,
    "string.empty": emptyKeyEn,
    "any.required": requiredKeyEn,
  });

  const arSchema = Joi.string().trim().allow("").messages({
    "string.base": validArKey,
  });

  return Joi.object({
    en: requiredEn ? enSchema.required() : enSchema.optional(),
    ar: arSchema.optional(),
  })
    .messages({
      "object.base": baseKey,
    })
    .unknown(false);
};

// Date: allow null, ISO string, timestamp, or Date; invalid => custom key
const makeNullableDateSchema = ({
  invalidKey = "errors.invalidDate",
} = {}) =>
  Joi.date()
    .allow(null)
    .messages({
      "date.base": invalidKey,
    });

/* ------------------------------ Exports ------------------------------ */

module.exports = {
  // ✅ Create
  createHeroSlideValidation: {
    body: Joi.object({
      title: makeLangSchema({
        requiredEn: true,
        requiredKeyEn: "errors.requiredTitle",
        emptyKeyEn: "errors.requiredTitle",
        validEnKey: "errors.validTitle",
        validArKey: "errors.validTitle",
        baseKey: "errors.validTitle",
      }).required(),

      subtitle: makeLangSchema({
        requiredEn: false,
        requiredKeyEn: "errors.validSubtitle",
        emptyKeyEn: "errors.validSubtitle",
        validEnKey: "errors.validSubtitle",
        validArKey: "errors.validSubtitle",
        baseKey: "errors.validSubtitle",
      })
        .optional()
        .default({ en: "", ar: "" }),


      startAt: makeNullableDateSchema({ invalidKey: "errors.invalidStartAt" }).optional(),
      endAt: makeNullableDateSchema({ invalidKey: "errors.invalidEndAt" }).optional(),

      isActive: Joi.boolean().optional().messages({
        "boolean.base": "errors.validIsActive",
      }),
      store: objectId.optional(),

      category: objectId.required().messages({
        "string.base": "errors.validCategoryId",
        "string.pattern.base": "errors.invalidCategoryId",
        "any.required": "errors.requiredCategoryId",
      }),
    })
      .custom((obj, helpers) => {
        // ✅ validate date range if both provided & not null
        if (obj.startAt && obj.endAt) {
          const s = new Date(obj.startAt);
          const e = new Date(obj.endAt);
          if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s > e) {
            return helpers.error("any.invalid");
          }
        }
        return obj;
      }, "date range")
      .messages({
        "any.invalid": "errors.invalidDateRange",
        "object.unknown": "errors.fieldNotAllowed",
      })
      .options(joiOptions),
  },

  // ✅ Update (at least 1 field)
 updateHeroSlideValidation: {
  query: Joi.object({
    _id: objectId
      .required()
      .messages({ "any.required": "errors.requiredHeroSlideId" }),
  }).options(joiOptions),

  body: Joi.object({
    title: makeLangSchema({
      requiredEn: false,
      requiredKeyEn: "errors.requiredTitle",
      emptyKeyEn: "errors.requiredTitle",
      validEnKey: "errors.validTitle",
      validArKey: "errors.validTitle",
      baseKey: "errors.validTitle",
    }).optional(),

    subtitle: makeLangSchema({
      requiredEn: false,
      requiredKeyEn: "errors.validSubtitle",
      emptyKeyEn: "errors.validSubtitle",
      validEnKey: "errors.validSubtitle",
      validArKey: "errors.validSubtitle",
      baseKey: "errors.validSubtitle",
    }).optional(),

    startAt: makeNullableDateSchema({ invalidKey: "errors.invalidStartAt" }).optional(),
    endAt: makeNullableDateSchema({ invalidKey: "errors.invalidEndAt" }).optional(),

    isActive: Joi.boolean()
      .optional()
      .messages({ "boolean.base": "errors.validIsActive" }),
    store: objectId.optional(),
    category: objectId.optional(),
  })
    .min(1) // ✅ at least one field in body
    .custom((obj, helpers) => {
      // ✅ only validate range if BOTH keys are present in request body
      const hasStart = Object.prototype.hasOwnProperty.call(obj, "startAt");
      const hasEnd = Object.prototype.hasOwnProperty.call(obj, "endAt");

      if (!hasStart || !hasEnd) return obj;

      // allow nulls
      if (!obj.startAt || !obj.endAt) return obj;

      const s = new Date(obj.startAt);
      const e = new Date(obj.endAt);

      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return obj;

      if (s > e) return helpers.error("any.invalid");

      return obj;
    }, "date range validation")
    .messages({
      "object.min": "errors.noFieldsToUpdate",
      "any.invalid": "errors.invalidDateRange",
      "object.unknown": "errors.fieldNotAllowed",
    })
    .options(joiOptions),
},

    // ✅ upload image endpoint: PUT /hero-slides/image?_id=...
    uploadHeroSlideImageValidation: {
      params: Joi.object({}).unknown(true),
      body: Joi.object({}).unknown(true), // IMPORTANT so your helper doesn't crash
      query: Joi.object({
        _id: objectId.required().messages({
          "any.required": "errors.requiredHeroSlideId",
        }),
      }),
    },
  
    // ✅ remove image endpoint: PUT /hero-slides/image/remove?_id=...
    removeHeroSlideImageValidation: {
      params: Joi.object({}).unknown(true),
      body: Joi.object({}).unknown(true), // IMPORTANT so your helper doesn't crash
      query: Joi.object({
        _id: objectId.required().messages({ "any.required": "errors.requiredHeroSlideId", }),
      }),
    },



};
