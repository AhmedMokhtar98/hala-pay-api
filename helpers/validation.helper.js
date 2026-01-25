// helpers/validation.helper.js
module.exports = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.body.validate(req.body, {
        abortEarly: false,   // collect all errors
        allowUnknown: false  // block unknown fields
      });

      if (!error) {
        req.body = value; // sanitized body
        return next();
      }

      // Map Joi errors → i18n messages using req.__
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: typeof req.__ === "function" 
          ? req.__(detail.message) // translate key using current locale
          : detail.message // fallback
      }));

      return res.status(422).json({
        success: false,
        message: typeof req.__ === "function" 
          ? req.__("errors.validation_failed") 
          : "Validation failed",
        code: 422,
        errors
      });

    } catch (err) {
      console.error("Joi Validation Error:", err);

      return res.status(400).json({
        success: false,
        message: typeof req.__ === "function" 
          ? req.__("errors.badRequest") 
          : "Bad request",
        code: 400,
        errors: null
      });
    }
  };
};
