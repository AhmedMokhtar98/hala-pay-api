// validations/group.client.validation.js
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
  Params / Query (MATCH ROUTES)
----------------------------- */

// ✅ params: /groups/:groupId
const groupIdParams = Joi.object({
  _id: objectId.required().messages({
    "any.required": "errors.requiredGroupId",
  }),
})
  .options(joiOptions)
  .unknown(false);

// ✅ strict query: only ?groupId=...
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
    CREATE (CLIENT)
    body: product + name
    - creator MUST NOT be sent from client (comes from auth)
  ----------------------------- */
  createGroupValidation: {
    params: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),

    body: Joi.object({
      product: objectId.required().messages({
        "any.required": "errors.requiredProduct",
      }),

      // creator is NOT allowed from client
      creator: Joi.any().forbidden().messages({
        "any.unknown": "errors.creator_not_allowed",
      }),

      name: nameRequired,
      description: description.optional(),
      image: image.optional(),

      // optional on create (you can remove these if you don't want client to send them)
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
    GET /groups/:groupId
    PUT /groups/:groupId
    DELETE /groups/:groupId
  ----------------------------- */
  groupIdParamsValidation: {
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: groupIdParams,
  },

  /* -----------------------------
    UPDATE (CLIENT)
  ----------------------------- */
  updateGroupValidation: {
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: groupIdParams,

    body: Joi.object({
      name: nameOptional,
      description: description.optional(),
      image: image.optional(),

      product: objectId.optional(),

      targetAmount: nonNegNumber.optional(),
      collectedAmount: nonNegNumber.optional(),

      status: statusEnum.optional(),
      deadLine: deadLine.optional(),
      isActive: isActive.optional(),

      // prevent sending creator from client
      creator: Joi.any().forbidden().messages({
        "any.unknown": "errors.creator_not_allowed",
      }),
    })
      .min(1)
      .messages({ "object.min": "errors.emptyBody" })
      .options(joiOptions)
      .unknown(false),
  },

  /* -----------------------------
    DELETE (CLIENT)
  ----------------------------- */
  deleteGroupValidation: {
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: Joi.object({}).options(joiOptions).unknown(true),
    params: groupIdParams,
  },

  /* -----------------------------
    IMAGE endpoints (STRICT QUERY)
    PUT    /groups/image?groupId=...
    DELETE /groups/image/remove?groupId=...
  ----------------------------- */
  uploadGroupImageValidation: {
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: groupIdQuery,
  },

  removeGroupImageValidation: {
    params: Joi.object({}).options(joiOptions).unknown(false),
    body: Joi.object({}).options(joiOptions).unknown(true),
    query: groupIdQuery,
  },
};
