// middlewares/errorHandler/index.js
const {
  InternalServerErrorException,
  HttpException,
  BadRequestException,
} = require("./exceptions");

const errorHandler = (method) => {
  return async (req, res, next) => {
    try {
      await method(req, res, next);
    } catch (error) {
      let exception;

      // ✅ 1) Handle Mongoose invalid ObjectId (CastError)
      if (error?.name === "CastError" && error?.kind === "ObjectId") {
        // you can return invalidObjectId (already in your locales)
        exception = new BadRequestException("errors.invalidObjectId");
      }

      // ✅ 2) Optional: handle Mongoose ValidationError nicely
      else if (error?.name === "ValidationError") {
        // Build field => messageKeyOrText map (keep messages as-is or map to keys)
        const extraData = {};
        for (const [field, val] of Object.entries(error.errors || {})) {
          extraData[field] = val?.message || "errors.validation_failed";
        }

        exception = new BadRequestException("errors.validation_failed", extraData);
      }

      // ✅ 3) Your current behavior
      else if (error instanceof HttpException) {
        exception = error;
      } else {
        console.error("Unexpected Error:", error);
        exception = new InternalServerErrorException("errors.internal_server_error");
      }

      next(exception);
    }
  };
};

module.exports = errorHandler;
