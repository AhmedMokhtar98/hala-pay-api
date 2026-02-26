// ==============================
// middleware/normalizeMultiStatus.js
// ==============================
module.exports = function normalizeMultiStatus(req, res, next) {
  const v = req.query?.status;

  const toParts = (val) => {
    if (val === undefined || val === null) return [];
    if (Array.isArray(val)) return val.flatMap(toParts);

    // support if something already set it as {$in:[...]}
    if (typeof val === "object" && val.$in && Array.isArray(val.$in)) {
      return val.$in.map(String).map((x) => x.trim()).filter(Boolean);
    }

    const s = String(val).trim();
    if (!s) return [];

    // funded+purchased -> arrives as "funded purchased"
    // funded,purchased -> "funded,purchased"
    return s
      .split(/[+\s,|]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  };

  const parts = toParts(v);

  if (parts.length > 1) req.query.status = { $in: parts };
  else if (parts.length === 1) req.query.status = parts[0];
  else delete req.query.status;

  next();
};