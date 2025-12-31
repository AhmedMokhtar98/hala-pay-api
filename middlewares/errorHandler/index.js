const { InternalServerErrorException, HttpException } = require("./exceptions");

const errorHandler = (method) => {
  return async (req, res, next) => {
    try {
      await method(req, res, next);
    } catch (error) {
      let exception;

      if (error instanceof HttpException) {
        exception = error;
      } else {
        console.error("Unexpected Error:", error);
        exception = new InternalServerErrorException("errors.internal_server_error");
      }

      next(exception); // pass to global error middleware
    }
  };
};

module.exports = errorHandler;
