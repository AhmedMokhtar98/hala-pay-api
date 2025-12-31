// middlewares/errorHandler/errorMiddleware.js
module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  const errorCode = err.messageKeyOrText || "errors.internal_server_error";

  // ✅ fallback: if err.errors is null, use extraData
  const errors = err.errors || (Object.keys(err.extraData || {}).length ? err.extraData : null);

  // Translate safely
  let message = errorCode;
  if (req && typeof req.__ === "function") {
    try {
      message = req.__(errorCode);
    } catch {
      message = errorCode;
    }
  }

  res.status(status).json({
    status,
    success: false,
    message,
    errors, // ✅ now includes { module, permissions } for permission errors
  });
};
