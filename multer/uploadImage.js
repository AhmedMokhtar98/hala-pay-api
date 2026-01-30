// middlewares/uploadImage.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  BadRequestException,
  UnprocessableEntityException,
} = require("../middlewares/errorHandler/exceptions");

/* ------------------------------ Helpers ------------------------------ */
function safeSegment(v) {
  return String(v || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
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

function safeUnlinkMany(files) {
  if (!files) return;

  // single file object
  if (files?.path) return safeUnlink(files.path);

  // array of files
  if (Array.isArray(files)) {
    for (const f of files) safeUnlink(f?.path);
    return;
  }

  // fields object: { fieldName: [files...] }
  if (typeof files === "object") {
    for (const k of Object.keys(files)) {
      const arr = files[k];
      if (Array.isArray(arr)) for (const f of arr) safeUnlink(f?.path);
    }
  }
}

/**
 * Resolve id from:
 * - query[idParam] OR query._id OR query.id
 * - params[idParam] OR params._id OR params.id
 * - body[idParam] OR body._id OR body.id
 * - user._id (if enabled)
 *
 * ✅ supports idParam as string OR array of strings
 */
function resolveId(req, idParam, { allowFromUser = false } = {}) {
  const candidates = Array.isArray(idParam) ? idParam : [idParam];

  // ✅ always allow common aliases (so ?_id= works even if idParam="id")
  const keys = Array.from(new Set([...candidates.filter(Boolean), "_id", "id"]));

  const pick = (obj) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    }
    return "";
  };

  const fromQuery = pick(req?.query);
  if (fromQuery) return fromQuery;

  const fromParams = pick(req?.params);
  if (fromParams) return fromParams;

  const fromBody = pick(req?.body);
  if (fromBody) return fromBody;

  if (allowFromUser && req?.user?._id) return String(req.user._id);

  return "";
}

/* ------------------------------ Multer Uploader ------------------------------ */
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
          return cb(new UnprocessableEntityException("errors.validId"), null);
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
        return cb(new UnprocessableEntityException("errors.image_file_required"), false);
      }

      if (!allowedMime.includes(file.mimetype)) {
        return cb(new UnprocessableEntityException("errors.invalidImageFormat"), false);
      }

      const ext = path.extname(file.originalname || "").toLowerCase();
      if (!allowedExt.includes(ext)) {
        return cb(new UnprocessableEntityException("errors.invalidImageFormat"), false);
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

  /**
   * ✅ wrap supports:
   * - single: req.file
   * - array: req.files (array)
   * - fields: req.files[fieldName] (array per field)
   */
  function wrap(multerMw, { requireFile = true, mode = "single", fieldName = "image" } = {}) {
    return (req, res, next) => {
      multerMw(req, res, (err) => {
        // success
        if (!err) {
          if (requireFile) {
            if (mode === "single") {
              if (!req.file) {
                return next(
                  new UnprocessableEntityException([
                    { field: fieldName, message: "errors.image_file_required" },
                  ])
                );
              }
            }

            if (mode === "array") {
              if (!Array.isArray(req.files) || req.files.length === 0) {
                return next(
                  new UnprocessableEntityException([
                    { field: fieldName, message: "errors.image_file_required" },
                  ])
                );
              }
            }

            if (mode === "fields") {
              const bucket = req.files?.[fieldName];
              if (!Array.isArray(bucket) || bucket.length === 0) {
                return next(
                  new UnprocessableEntityException([
                    { field: fieldName, message: "errors.image_file_required" },
                  ])
                );
              }
            }
          }

          return next();
        }

        // your custom exceptions
        if (err?.status && err?.messageKeyOrText) {
          // best-effort cleanup
          safeUnlinkMany(req?.file);
          safeUnlinkMany(req?.files);
          return next(err);
        }

        // multer errors
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            // cleanup
            safeUnlinkMany(req?.file);
            safeUnlinkMany(req?.files);

            return next(
              new UnprocessableEntityException("errors.image_field_name_must_be_image")
            );
          }

          if (err.code === "LIMIT_FILE_SIZE") {
            // cleanup all uploaded files (single/array/fields)
            safeUnlinkMany(req?.file);
            safeUnlinkMany(req?.files);

            return next(new UnprocessableEntityException("errors.imageTooLarge"));
          }

          // cleanup
          safeUnlinkMany(req?.file);
          safeUnlinkMany(req?.files);

          return next(new UnprocessableEntityException("errors.invalidImageUpload"));
        }

        // unknown error: cleanup
        safeUnlinkMany(req?.file);
        safeUnlinkMany(req?.files);

        return next(err);
      });
    };
  }

  return {
    _multer: m,

    // ✅ single file: field "image"
    single: (fieldName = "image") =>
      wrap(m.single(fieldName), { requireFile: true, mode: "single", fieldName }),

    // ✅ multiple files under same field (e.g. "images")
    array: (fieldName = "images", maxCount = 10) =>
      wrap(m.array(fieldName, maxCount), { requireFile: true, mode: "array", fieldName }),

    // ✅ multiple fields each may have multiple files
    fields: (fieldsConfig = [{ name: "images", maxCount: 10 }]) =>
      // NOTE: requireFile default true for first field in config
      wrap(m.fields(fieldsConfig), {
        requireFile: true,
        mode: "fields",
        fieldName: fieldsConfig?.[0]?.name || "images",
      }),
  };
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
