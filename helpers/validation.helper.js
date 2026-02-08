// helpers/validation.helper.js
const Joi = require("joi");

const DEFAULT_OPTIONS = {
  abortEarly: false,  // collect all errors
  allowUnknown: false // block unknown fields
};

// helper: validate one part and return { value, error }
function validatePart(schemaPart, data) {
  if (!schemaPart) return { value: data, error: null };

  // schemaPart is expected to be a Joi schema (e.g. Joi.object(...))
  return schemaPart.validate(data, DEFAULT_OPTIONS);
}

// helper: map joi details to your desired shape + translate via req.__
function mapJoiErrorsToResponse(req, joiError) {
  const details = joiError?.details || [];
  return details.map((detail) => ({
    field: Array.isArray(detail.path) && detail.path.length ? detail.path.join(".") : "body",
    message:
      typeof req.__ === "function"
        ? req.__(detail.message) // detail.message is your key string
        : detail.message,
  }));
}

module.exports = (schema = {}) => {
  return (req, res, next) => {
    try {
      // ✅ Validate params (if provided)
      if (schema.params) {
        const { error, value } = validatePart(schema.params, req.params);
        if (error) {
          const errors = mapJoiErrorsToResponse(req, error);
          return res.status(422).json({
            success: false,
            message:
              typeof req.__ === "function"
                ? req.__("errors.validation_failed")
                : "Validation failed",
            code: 422,
            errors,
          });
        }
        req.params = value;
      }

      // ✅ Validate query (if provided)
      if (schema.query) {
        const { error, value } = validatePart(schema.query, req.query);
        if (error) {
          const errors = mapJoiErrorsToResponse(req, error);
          return res.status(422).json({
            success: false,
            message:
              typeof req.__ === "function"
                ? req.__("errors.validation_failed")
                : "Validation failed",
            code: 422,
            errors,
          });
        }
        req.query = value;
      }

      // ✅ Validate body (if provided)
      if (schema.body) {
        const { error, value } = validatePart(schema.body, req.body);
        if (error) {
          const errors = mapJoiErrorsToResponse(req, error);
          return res.status(422).json({
            success: false,
            message:
              typeof req.__ === "function"
                ? req.__("errors.validation_failed")
                : "Validation failed",
            code: 422,
            errors,
          });
        }
        req.body = value;
      }

      return next();
    } catch (err) {
      console.error("Joi Validation Error:", err);

      return res.status(400).json({
        success: false,
        message:
          typeof req.__ === "function" ? req.__("errors.badRequest") : "Bad request",
        code: 400,
        errors: null,
      });
    }
  };
};
