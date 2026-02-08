// models/suggest/suggest.repo.js
const productModel = require("../product/product.model");
const storeModel = require("../store/store.model");
const categoryModel = require("../category/category.model");

const escapeRegex = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseTypes = (type) => {
  if (!type) return ["product", "store", "category"]; // default all
  const raw = Array.isArray(type) ? type.join(",") : String(type);
  const list = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const allowed = new Set(["product", "store", "category"]);
  const cleaned = [...new Set(list)].filter((t) => allowed.has(t));
  return cleaned.length ? cleaned : ["product", "store", "category"];
};

exports.searchAll = async ({ q, type, limit = 12, perType = 6 }) => {
  try {
    const query = String(q || "").trim();
    if (!query) return { success: true, code: 200, result: [] };

    const rx = new RegExp(escapeRegex(query), "i");
    const types = parseTypes(type);

    const tasks = [];

    if (types.includes("product")) {
      tasks.push(
        productModel
          .find({
            $and: [{ isActive: true }, { $or: [{ name: rx }, { search: rx }] }],
          })
          .limit(perType)
          .select("name images store category")
          .lean()
          .then((rows) => rows.map((x) => ({ ...x, __type: "product" })))
      );
    }

    if (types.includes("store")) {
      tasks.push(
        storeModel
          .find({
            $and: [
              { isActive: true },
              { $or: [{ businessName: rx }, { storeId: rx }, { search: rx }] },
            ],
          })
          .limit(perType)
          .select("businessName storeId logo")
          .lean()
          .then((rows) => rows.map((x) => ({ ...x, __type: "store" })))
      );
    }

    if (types.includes("category")) {
      tasks.push(
        categoryModel
          .find({
            $and: [
              // ✅ remove this line if category doesn't have isActive
              { isActive: true },
              { $or: [{ nameEn: rx }, { nameAr: rx }, { search: rx }] },
            ],
          })
          .limit(perType)
          .select("nameEn nameAr image store")
          .lean()
          .then((rows) => rows.map((x) => ({ ...x, __type: "category" })))
      );
    }

    const chunks = await Promise.all(tasks);
    const merged = chunks.flat();

    // total cap
    const result = merged.slice(0, limit);

    return { success: true, code: 200, result };
  } catch (e) {
    return { success: false, code: 500, message: "Suggest failed", error: e?.message };
  }
};
