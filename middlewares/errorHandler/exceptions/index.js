// middlewares/errorHandler/exceptions/index.js

class HttpException extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} messageKeyOrText - either an i18n key (errors.*) or custom text
   * @param {Array|null} errors - optional array of error details
   * @param {Object} extraData - optional extra data
   */
  constructor(status, messageKeyOrText, errors = null, extraData = {}) {
    super(messageKeyOrText);

    this.success = false;
    this.status = status;
    this.messageKeyOrText = messageKeyOrText; // either key or custom text
    this.errors = errors;
    this.extraData = extraData;

    // Detect if the message should be translated
    // If it starts with "errors." → translate via i18n, else treat as custom text
    this.isCustomMessage =
      typeof messageKeyOrText !== "string" || !messageKeyOrText.startsWith("errors.");
  }
}

// Common HTTP status codes
const ERROR_STATUS_CODE = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  UNPROCESSABLE_ENTITY: 422,
};

// Specific Exceptions
class NotFoundException extends HttpException {
  constructor(messageKeyOrText = "errors.not_found", extraData = {}) {
    super(ERROR_STATUS_CODE.NOT_FOUND, messageKeyOrText, null, extraData);
  }
}

class BadRequestException extends HttpException {
  constructor(messageKeyOrText = "errors.bad_request", extraData = {}) {
    super(ERROR_STATUS_CODE.BAD_REQUEST, messageKeyOrText, null, extraData);
  }
}

class UnauthorizedException extends HttpException {
  constructor(messageKeyOrText = "errors.unauthorized", extraData = {}) {
    super(ERROR_STATUS_CODE.UNAUTHORIZED, messageKeyOrText, null, extraData);
  }
}

class ForbiddenException extends HttpException {
  constructor(messageKeyOrText = "errors.forbidden", extraData = {}) {
    super(ERROR_STATUS_CODE.FORBIDDEN, messageKeyOrText, null, extraData);
  }
}

class ConflictException extends HttpException {
  constructor(messageKeyOrText = "errors.conflict", extraData = {}) {
    super(ERROR_STATUS_CODE.CONFLICT, messageKeyOrText, null, extraData);
  }
}

class UnprocessableEntityException extends HttpException {
  constructor(errors = [], messageKeyOrText = "errors.unprocessable_entity") {
    super(ERROR_STATUS_CODE.UNPROCESSABLE_ENTITY, messageKeyOrText, errors);
  }
}

class InternalServerErrorException extends HttpException {
  constructor(messageKeyOrText = "errors.internal_server_error", extraData = {}) {
    super(ERROR_STATUS_CODE.INTERNAL_SERVER_ERROR, messageKeyOrText, null, extraData);
  }
}

module.exports = {
  HttpException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  UnprocessableEntityException,
};
