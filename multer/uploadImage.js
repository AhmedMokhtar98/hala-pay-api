// middlewares/uploadImage.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { BadRequestException, UnprocessableEntityException } = require("../middlewares/errorHandler/exceptions");

// ✅ FIX: since this file is already inside /middlewares


/* ------------------------------ Helpers ------------------------------ */
function safeSegment(v) {
  return String(v || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function randomFileName(bytes = 18) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function isValidObjectIdHex24(id) {
  return /^[0-9a-fA-F]{24}$/.test(String(id || "").trim());
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeUnlink(p) {
  if (!p) return;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}

/**
 * Resolve id from:
 * - query[idParam]
 * - params[idParam]
 * - body[idParam]
 * - user._id (if enabled)
 */
function resolveId(req, idParam, { allowFromUser = false } = {}) {
  const fromQuery = req?.query?.[idParam];
  if (fromQuery) return String(fromQuery);

  const fromParams = req?.params?.[idParam];
  if (fromParams) return String(fromParams);

  const fromBody = req?.body?.[idParam];
  if (fromBody) return String(fromBody);

  if (allowFromUser && req?.user?._id) return String(req.user._id);

  return "";
}

/* ------------------------------ Multer Uploader ------------------------------ */
/**
 * Dynamic uploader:
 * Saves to: public/images/<module>/<id>/
 *
 * Returns:
 *  - uploader.single(fieldName)
 *  - uploader.array(fieldName,maxCount)
 *
 * ✅ Converts MulterError + custom validation into your HttpExceptions
 * so your errorMiddleware translates them instead of 500.
 */
function uploadImage(opts = {}) {
  const {
    module,
    idParam = "id",
    allowIdFromUser = false,
    requireObjectId = false,

    maxSizeMB = 5,
    baseDir = "public/images",
    nameBytes = 18,

    allowedMime = ["image/jpeg", "image/png", "image/webp"],
    allowedExt = [".jpg", ".jpeg", ".png", ".webp"],
  } = opts;

  if (!module) throw new Error("uploadImage: opts.module is required");

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const mod = safeSegment(module);

        const rawId = resolveId(req, idParam, { allowFromUser: allowIdFromUser });
        const id = safeSegment(rawId);

        if (!id) {
          return cb(new BadRequestException("errors.clientId_required"), null);
        }

        if (requireObjectId && !isValidObjectIdHex24(rawId)) {
          return cb(
            new UnprocessableEntityException("errors.validId"),
            null
          );
        }

        const dir = path.join(process.cwd(), baseDir, mod, id);
        ensureDir(dir);
        cb(null, dir);
      } catch (e) {
        cb(e, null);
      }
    },

    filename: (req, file, cb) => {
      const originalExt = path.extname(file.originalname || "").toLowerCase();
      const ext = allowedExt.includes(originalExt) ? originalExt : ".webp";
      cb(null, `${randomFileName(nameBytes)}${ext}`);
    },
  });

  function fileFilter(req, file, cb) {
    try {
      if (!file?.mimetype) {
        return cb(
          new UnprocessableEntityException("errors.image_file_required"),
          false
        );
      }

      if (!allowedMime.includes(file.mimetype)) {
        return cb(
          new UnprocessableEntityException("errors.invalidImageFormat"),
          false
        );
      }

      const ext = path.extname(file.originalname || "").toLowerCase();
      if (!allowedExt.includes(ext)) {
        return cb(
          new UnprocessableEntityException("errors.invalidImageFormat"),
          false
        );
      }

      cb(null, true);
    } catch (e) {
      cb(e, false);
    }
  }

  const m = multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  });

  function wrap(multerMw, { requireFile = true } = {}) {
    return (req, res, next) => {
      multerMw(req, res, (err) => {
        // ✅ success
        if (!err) {
          if (requireFile && !req.file) {
            return next(
              new UnprocessableEntityException([{ field: "image", message: "errors.image_file_required" }])
            );
          }
          return next();
        }

        // ✅ Already HttpException
        if (err?.status && err?.messageKeyOrText) return next(err);

        // ✅ Multer errors
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return next(
              new UnprocessableEntityException("errors.image_field_name_must_be_image")
            );
          }

          if (err.code === "LIMIT_FILE_SIZE") {
            safeUnlink(req?.file?.path);
            return next(
              new UnprocessableEntityException("errors.imageTooLarge")
            );
          }

          return next(
            new UnprocessableEntityException("errors.invalidImageUpload")
          );
        }

        // unknown
        return next(err);
      });
    };
  }

  return {
    _multer: m,
    single: (fieldName = "image") => wrap(m.single(fieldName), { requireFile: true }),
    array: (fieldName = "image", maxCount = 1) => wrap(m.array(fieldName, maxCount), { requireFile: true }),
  };
}

/* ------------------------------ Delete helper (stores example) ------------------------------ */
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
