// middlewares/uploadImage.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

function safeSegment(v) {
  // prevent path traversal + weird chars
  return String(v || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function randomFileName(bytes = 18) {
  // letters + numbers (base64url) => no + / =
  return crypto.randomBytes(bytes).toString("base64url"); // e.g. "aZ3k..._Q"
}

/**
 * Dynamic multer uploader:
 * Saves to: public/images/<module>/<id>/
 *
 * @param {Object} opts
 * @param {string} opts.module - e.g. "stores", "products"
 * @param {string} opts.idParam - e.g. "storeId", "productId" (from req.params)
 * @param {number} [opts.maxSizeMB=5]
 * @param {string} [opts.baseDir="public/images"] - relative to project root
 * @param {number} [opts.nameBytes=18] - randomness size (bigger = longer)
 */
function uploadImage(opts = {}) {
  const {
    module,
    idParam,
    maxSizeMB = 5,
    baseDir = "public/images",
    nameBytes = 18,
  } = opts;

  if (!module) throw new Error("uploadImage: opts.module is required");
  if (!idParam) throw new Error("uploadImage: opts.idParam is required");

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const mod = safeSegment(module);
      const id = safeSegment(req.query?.[idParam]);

      if (!id) return cb(new Error(`${idParam} is required in query`), null);

      const dir = path.join(process.cwd(), baseDir, mod, id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || "") || ".jpg").toLowerCase();
      const name = `${randomFileName(nameBytes)}${ext}`; // ✅ random letters+numbers
      cb(null, name);
    },
  });

  function fileFilter(req, file, cb) {
    if (!file?.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  }

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  });
}




function deleteOldStoreLogoIfExists({ storeId, oldUrl, newFileName }) {
  if (!oldUrl || typeof oldUrl !== "string") return;

  const prefix = `/images/stores/${storeId}/`;
  if (!oldUrl.startsWith(prefix)) return;

  const oldFileName = oldUrl.split("/").pop();
  if (!oldFileName || oldFileName === newFileName) return;

  const oldPath = path.join(process.cwd(), "public", "images", "stores", storeId, oldFileName);
  try {
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  } catch (_) {}
}




module.exports = { uploadImage, deleteOldStoreLogoIfExists };
