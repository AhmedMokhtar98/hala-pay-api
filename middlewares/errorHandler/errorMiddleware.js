// middlewares/errorHandler/errorMiddleware.js
module.exports = (err, req, res, next) => {
  const status = err?.status || 500;

  // ✅ main message key (or custom)
  const errorKey = err?.messageKeyOrText || "errors.internal_server_error";

  // translate main message (fallback)
  let mainMessage = errorKey;
  if (req && typeof req.__ === "function") {
    try {
      mainMessage = req.__(errorKey);
    } catch (_) {
      mainMessage = errorKey;
    }
  }

  // ✅ normalize errors
  let rawErrors =
    err?.errors ||
    (Object.keys(err?.extraData || {}).length ? err.extraData : null);

  // ---------- Convert different shapes into: [{ field, message }] ----------
  let errorsArray = [];

  // 1) errors is ARRAY already: [{field,message}]
  if (Array.isArray(rawErrors)) {
    errorsArray = rawErrors.map((e) => ({
      field: e?.field || "body",
      message: e?.message,
    }));
  }

  // 2) errors is STRING: treat as general error message
  else if (typeof rawErrors === "string") {
    errorsArray = [{ field: "body", message: rawErrors }];
  }

  // 3) errors is OBJECT: map keys => fields
  else if (rawErrors && typeof rawErrors === "object") {
    errorsArray = Object.entries(rawErrors).map(([k, v]) => ({
      field: k,
      message: v,
    }));
  }

  // ---------- Translate each error message if it's a key ----------
  if (req && typeof req.__ === "function") {
    errorsArray = errorsArray.map((e) => {
      let msg = e.message;

      if (typeof msg === "string") {
        // if msg is an i18n key, translate it
        try {
          msg = req.__(msg);
        } catch (_) {}
      }

      return { ...e, message: msg };
    });
  }

  // ✅ Your desired response format
  return res.status(status).json({
    success: false,
    message:
      status === 422
        ? (req && typeof req.__ === "function"
            ? req.__("errors.validation_failed")
            : "Validation failed")
        : mainMessage,
    code: status,
    errors: errorsArray.length ? errorsArray : null,
  });
};
