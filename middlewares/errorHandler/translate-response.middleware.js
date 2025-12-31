// src/middlewares/translate-response.middleware.js
module.exports = function translateResponse(req, res, next) {
  const originalJson = res.json.bind(res);

  const shouldTranslate = (key) =>
    typeof key === "string" &&
    typeof req.__ === "function" &&
    (key.includes(".") || key.startsWith("errors.") || key.startsWith("success."));

  res.json = (body) => {
    try {
      // 1) If message is top-level -> translate top-level
      if (shouldTranslate(body?.message)) {
        const key = body.message;
        body.messageKey = key;
        body.message = req.__(key);
      }

      // 2) If message is inside result -> translate inside result
      if (body?.result && typeof body.result === "object" && shouldTranslate(body.result?.message)) {
        const key = body.result.message;
        body.result.messageKey = key;
        body.result.message = req.__(key);
      }
    } catch (e) {
      // don’t break response if translation fails
    }

    return originalJson(body);
  };

  next();
};
