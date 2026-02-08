// validations/group.validation.js
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

const nonNegNumber = Joi.number().min(0).messages({
  "number.base": "errors.validNumber",
  "number.min": "errors.mustBeGteZero",
});

/* -----------------------------
  Group fields (match schema)
----------------------------- */

const nameRequired = Joi.string().trim().min(1).required().messages({
  "string.base": "errors.validGroupName",
  "string.empty": "errors.emptyGroupName",
  "string.min": "errors.emptyGroupName",
  "any.required": "errors.requiredGroupName",
});

const nameOptional = Joi.string().trim().min(1).optional().messages({
  "string.base": "errors.validGroupName",
  "string.empty": "errors.emptyGroupName",
  "string.min": "errors.emptyGroupName",
});

const description = Joi.string().trim().allow("").messages({
  "string.base": "errors.validGroupDescription",
});

const image = Joi.string().trim().allow("").messages({
  "string.base": "errors.validGroupImage",
});

const statusEnum = Joi.string()
  .trim()
  .valid("active", "closed", "deleted", "funded", "purchased")
  .messages({
    "string.base": "errors.validGroupStatus",
    "any.only": "errors.validGroupStatus",
  });

const deadLine = Joi.date().allow(null).messages({
  "date.base": "errors.validDeadLine",
});

const isActive = Joi.boolean().messages({
  "boolean.base": "errors.validIsActive",
});

/* -----------------------------
  Params / Query
----------------------------- */

// ✅ params: /groups/:_id
const groupIdParams = Joi.object({
  _id: objectId.required().messages({
    "any.required": "errors.requiredGroupId",
  }),
})
  .options(joiOptions)
  .unknown(false);

// ✅ strict query: only ?_id=...
const groupIdQuery = Joi.object({
  _id: objectId.required().messages({
    "any.required": "errors.requiredGroupId",
  }),
})
  .options(joiOptions)
  .unknown(false);

/* -----------------------------
  Exports
----------------------------- */

module.exports = {
  /* -----------------------------
    CREATE
    body: product + name
  ----------------------------- */
  createGroupValidation: {
    params: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),

    body: Joi.object({
      product: objectId.required().messages({
        "any.required": "errors.requiredProduct",
      }),
      store: objectId.required().messages({
        "any.required": "errors.requiredStore",
      }),
      creator: objectId.required().messages({
        "any.required": "errors.requiredCreator",
      }),
      targetAmount: nonNegNumber.required().messages({
        "number.base": "errors.validTargetAmount",
        "number.min": "errors.validTargetAmount",
        "any.required": "errors.requiredTargetAmount",
      }),
      contributors: Joi.array()
        .items(
          Joi.object({
            client: objectId.required().messages({
              "any.required": "errors.requiredContributorClientId",
            }),
            paidAmount: nonNegNumber.optional(),
            paidAt: Joi.date().allow(null).messages({
              "date.base": "errors.validContributorPaidAt",
            }),
            transactionStatus: Joi.boolean().optional(),
          }).messages({
            "object.base": "errors.validContributor",
          })
        )
        .optional(),

      name: nameRequired,
      description: description.optional(),
      image: image.optional(),

      collectedAmount: nonNegNumber.optional(),
      status: statusEnum.optional(),
      deadLine: deadLine.optional(),
      isActive: isActive.optional(),
    })
      .options(joiOptions)
      .unknown(false),
  },

  /* -----------------------------
    PARAMS VALIDATION
    Used for routes like:
    GET /groups/:_id
    PUT /groups/:_id
    DELETE /groups/:_id
  ----------------------------- */
  groupIdParamsValidation: {
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: groupIdParams,
  },

  /* -----------------------------
    UPDATE
    body: any field (min 1)
  ----------------------------- */
  updateGroupValidation: {
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: groupIdParams,

    body: Joi.object({
      name: nameOptional,
      description: description.optional(),
      image: image.optional(),
      store: objectId.optional(),
      creator: objectId.optional(),
      contributors: Joi.array()
        .items(
          Joi.object({
            client: objectId.required().messages({
              "any.required": "errors.requiredContributorClientId",
            }),
            paidAmount: nonNegNumber.optional(),
            paidAt: Joi.date().allow(null).messages({
              "date.base": "errors.validContributorPaidAt",
            }),
            transactionStatus: Joi.boolean().optional(),
          }).messages({
            "object.base": "errors.validContributor",
          })
        )
        .optional(),
      product: objectId.optional(),

      targetAmount: nonNegNumber.optional(),
      collectedAmount: nonNegNumber.optional(),

      status: statusEnum.optional(),
      deadLine: deadLine.optional(),
      isActive: isActive.optional(),
    })
      .min(1)
      .messages({ "object.min": "errors.emptyBody" })
      .options(joiOptions)
      .unknown(false),
  },

  /* -----------------------------
    DELETE
  ----------------------------- */
  deleteGroupValidation: {
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: groupIdParams,
  },

  /* -----------------------------
    IMAGE endpoints (STRICT QUERY)
    PUT    /groups/image?_id=...
    DELETE /groups/image?_id=...
    (or /groups/image/remove?_id=... if you still keep it)
    - strict: query must contain ONLY _id and must be valid ObjectId
  ----------------------------- */
  uploadGroupImageValidation: {
    params: Joi.object({}).options(joiOptions).unknown(false),
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: groupIdQuery,
  },

  removeGroupImageValidation: {
    params: Joi.object({}).options(joiOptions).unknown(false),
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: groupIdQuery,
  },
};
