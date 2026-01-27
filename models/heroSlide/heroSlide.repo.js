// heroSlide.repo.js
const fs = require("fs");
const path = require("path");

const applySearchFilter = require("../../helpers/applySearchFilter");
const prepareQueryObjects = require("../../helpers/prepareQueryObjects");

const {
  BadRequestException,
  NotFoundException,
  ConflictException,
} = require("../../middlewares/errorHandler/exceptions");

const heroSlideModel = require("./heroSlide.model");

const PUBLIC_DIR = path.join(process.cwd(), "public");
const HERO_DIR = path.join(PUBLIC_DIR, "images", "hero-slides");

/** Escape regex special chars */
function escapeRegExp(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalize multilingual field */
function normLangField(v = {}) {
  return {
    en: String(v?.en || "").trim(),
    ar: String(v?.ar || "").trim(),
  };
}

/** Parse date safely (null allowed) */
function parseNullableDate(value) {
  if (value === undefined) return undefined; // do not touch
  if (value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "__INVALID_DATE__";
  return d;
}

/* ---------------------------
  CRUD
--------------------------- */

exports.createHeroSlide = async (payload = {}) => {
  const title = normLangField(payload.title);
  const subtitle = normLangField(payload.subtitle);

  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);

  const startAt = parseNullableDate(payload.startAt);
  const endAt = parseNullableDate(payload.endAt);

  if (!title.en) throw new BadRequestException("errors.requiredTitle");

  if (startAt === "__INVALID_DATE__") throw new BadRequestException("errors.invalidStartAt");
  if (endAt === "__INVALID_DATE__") throw new BadRequestException("errors.invalidEndAt");

  if (startAt && endAt && startAt > endAt) {
    throw new BadRequestException("errors.invalidDateRange");
  }

  // Optional: avoid duplicate title.en (case-insensitive)
  const existing = await heroSlideModel.findOne({
    "title.en": { $regex: `^${escapeRegExp(title.en)}$`, $options: "i" },
  });

  if (existing) throw new ConflictException("errors.heroSlideTitleExists");

  const doc = await heroSlideModel.create({
    title,
    subtitle,
    isActive,
    store: payload.store,
    category: payload.category,
    startAt: startAt === undefined ? null : startAt,
    endAt: endAt === undefined ? null : endAt,
  });

  return { success: true, code: 201, result: doc };
};

exports.listHeroSlides = async (filterObject = {}, selectionObject = {}, sortObject = {}) => {
  const {
    filterObject: normalizedFilter,
    sortObject: normalizedSort,
    pageNumber,
    limitNumber,
  } = prepareQueryObjects(filterObject, sortObject, {
    sortableFields: ["createdAt", "startAt", "endAt"],
    defaultSort: "-createdAt",
  });

  const finalFilter = applySearchFilter(normalizedFilter, [
    "title.en",
    "title.ar",
    "subtitle.en",
    "subtitle.ar",
  ]);

  const query = heroSlideModel
    .find(finalFilter)
    .select(selectionObject)
    .populate("store", "businessName storeId logo")
    .populate("category", "nameEn nameAr descriptionEn descriptionAr image isActive")
    .sort(normalizedSort)
    .limit(limitNumber)
    .skip((pageNumber - 1) * limitNumber);

  const [slides, count] = await Promise.all([
    query.lean(),
    heroSlideModel.countDocuments(finalFilter),
  ]);

  return { success: true, code: 200, result: slides, count, page: pageNumber, limit: limitNumber };
};

exports.getHeroSlide = async (slideId) => {
  const doc = await heroSlideModel.findById(slideId).lean();
  if (!doc) throw new NotFoundException("errors.heroSlideNotFound");
  return { success: true, code: 200, result: doc };
};

exports.updateHeroSlide = async (slideId, body = {}) => {
  const updated = await heroSlideModel.findByIdAndUpdate(
    slideId,
    body,          
    { new: true } 
  );

  if (!updated) {
    throw new NotFoundException("errors.heroSlideNotFound");
  }

  return {
    success: true,
    code: 200,
    result: updated,
  };
};

exports.deleteHeroSlide = async (_id, deletePermanently = false) => {
  if (!_id) throw new BadRequestException("errors.invalidId");

  if (deletePermanently) {
    const deleted = await heroSlideModel.findByIdAndDelete(_id).lean();
    if (!deleted) throw new NotFoundException("errors.heroSlideNotFound");
    return { success: true, code: 200, result: { message: "success.record_deleted" } };
  }

  const updated = await heroSlideModel
    .findOneAndUpdate({ _id, isActive: true }, { isActive: false }, { new: true })
    .lean();

  if (!updated) throw new NotFoundException("errors.heroSlideNotFound");

  return { success: true, code: 200, result: { message: "success.record_disabled" } };
};

/* ---------------------------
  Active slides "now"
--------------------------- */

exports.listActiveHeroSlidesNow = async () => {
  const now = new Date();

  const filter = {
    isActive: true,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
    ],
  };

  const slides = await heroSlideModel
    .find(filter)
    .sort({ createdAt: -1 }) // ✅ no position
    .lean();

  return { success: true, code: 200, result: slides, count: slides.length };
};

/* ---------------------------
  Image Upload (STRING) + Remove
  Folder: /public/images/hero-slides/:slideId/:filename
--------------------------- */

exports.uploadHeroSlideImage = async (slideId, file) => {
  if (!slideId) {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
    throw new BadRequestException("errors.requiredHeroSlideId");
  }

  if (!file?.filename) {
    throw new BadRequestException("errors.requiredImage");
  }

  const doc = await heroSlideModel.findById(slideId);
  if (!doc) {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
    throw new NotFoundException("errors.heroSlideNotFound");
  }

  const imageUrl = `/images/hero-slides/${slideId}/${file.filename}`;

  // delete old file (only if inside our folder)
  const oldUrl = doc.image;
  const prefix = `/images/hero-slides/${slideId}/`;

  if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith(prefix)) {
    const oldFileName = oldUrl.split("/").pop();
    if (oldFileName && oldFileName !== file.filename) {
      const oldAbsPath = path.join(HERO_DIR, String(slideId), oldFileName);
      if (fs.existsSync(oldAbsPath)) {
        try { fs.unlinkSync(oldAbsPath); } catch (_) {}
      }
    }
  }

  doc.image = imageUrl;
  await doc.save();

  return {
    success: true,
    code: 200,
    message: "success.hero_slide_image_updated",
    result: { heroSlideId: String(doc._id), imageUrl },
  };
};

exports.removeHeroSlideImage = async (slideId) => {
  if (!slideId) throw new BadRequestException("errors.requiredHeroSlideId");

  const doc = await heroSlideModel.findById(slideId);
  if (!doc) throw new NotFoundException("errors.heroSlideNotFound");

  const oldUrl = doc.image;
  const prefix = `/images/hero-slides/${slideId}/`;

  if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith(prefix)) {
    const oldFileName = oldUrl.split("/").pop();
    if (oldFileName) {
      const oldAbsPath = path.join(HERO_DIR, String(slideId), oldFileName);
      if (fs.existsSync(oldAbsPath)) {
        try { fs.unlinkSync(oldAbsPath); } catch (_) {}
      }
    }

    // cleanup empty folder (best effort)
    try {
      const dir = path.join(HERO_DIR, String(slideId));
      if (fs.existsSync(dir)) {
        const remaining = fs.readdirSync(dir);
        if (!remaining.length) fs.rmdirSync(dir);
      }
    } catch (_) {}
  }

  doc.image = "";
  await doc.save();

  return {
    success: true,
    code: 200,
    message: "success.hero_slide_image_removed",
    result: { heroSlideId: String(doc._id), imageUrl: "" },
  };
};
