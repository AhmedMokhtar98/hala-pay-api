// providers/salla/sallaAdapter.js
const { sallaRequest } = require("./sallaApi");
const {
  toPositiveInt,
  clampInt,
  normalizeText,
  normalizeUnifiedStatus,
} = require("../common/providerUtils");

function mapSallaProductToUnified(p, { storeObjectId }) {
  const images = Array.isArray(p?.images)
    ? p.images.map((x) => x?.url).filter(Boolean)
    : [];

  const unlimited = Boolean(p?.unlimited_quantity);
  let stock = 0;

  if (Array.isArray(p?.skus) && p.skus.length) {
    const nums = p.skus
      .map((s) => Number(s?.stock_quantity || 0))
      .filter((n) => Number.isFinite(n));
    stock = nums.length ? Math.max(...nums) : 0;
  } else if (p?.quantity != null) {
    const q = Number(p.quantity);
    stock = Number.isFinite(q) ? q : 0;
  }

  const currency =
    p?.price?.currency ||
    p?.taxed_price?.currency ||
    p?.regular_price?.currency ||
    "SAR";

  const categoriesArr = Array.isArray(p?.categories) ? p.categories : [];
  const categories = categoriesArr.map((c) => ({
    providerCategoryId: c?.id != null ? String(c.id) : "",
    name: c?.name || "",
    categoryRef: null,
  }));

  const unifiedStatus = p?.is_available ? "active" : "draft";

  return {
    store: storeObjectId,
    provider: "salla",
    providerProductId: String(p?.id),

    name: p?.name || "",
    description: p?.description || "",

    urls: {
      customer: p?.urls?.customer || p?.url || "",
      admin: p?.urls?.admin || "",
      product_card: p?.urls?.product_card || "",
    },

    thumbnail: p?.thumbnail || "",
    mainImage: p?.main_image || "",
    images: [p?.main_image, p?.thumbnail, ...images].filter(Boolean),

    price: { amount: Number(p?.price?.amount || 0) || 0, currency },
    priceBefore: { amount: Number(p?.regular_price?.amount || 0) || 0, currency },
    salePrice: { amount: Number(p?.sale_price?.amount || 0) || 0, currency },

    stock,
    unlimited,
    isAvailable: Boolean(p?.is_available),

    status: unifiedStatus,

    categories,

    sku: p?.sku || "",
    weight: Number(p?.weight || 0) || 0,
    weightUnit: p?.weight_type || "kg",

    rating: {
      count: Number(p?.rating?.count || 0) || 0,
      rate: Number(p?.rating?.rate || 0) || 0,
    },

    raw: p,
    isActive: true,
  };
}

async function listProducts({ store, filters }) {
  const page = toPositiveInt(filters.page, 1);
  const per_page = clampInt(toPositiveInt(filters.limit ?? filters.per_page ?? filters.perPage, 20), 1, 100);

  const keyword = normalizeText(filters.keyword || filters.search || filters.q);
  const category = filters.category ?? filters.category_id ?? filters.categoryId;

  // unified status (active/draft/archived)
  const unifiedStatus = normalizeUnifiedStatus(filters.status);

  // ---- Build Salla params
  const params = { page, per_page };
  if (keyword) params.keyword = keyword;
  if (category != null && String(category).trim() !== "") params.category = String(category).trim();

  /**
   * ✅ IMPORTANT:
   * Salla rejected "status=active" in your logs (422 invalid status id).
   * So we DO NOT send status to Salla unless you know the exact accepted values.
   * We'll do local filtering instead.
   */
  // if (unifiedStatus) params.status = ... (only if you have correct mapping)

  const resp = await sallaRequest({
    storeId: store.provider.storeId, // provider storeId
    method: "GET",
    path: "/admin/v2/products",
    params,
  });
  console.log("Salla API response:", { status: resp?.status, dataKeys: resp?.data ? Object.keys(resp.data) : null });

  const payload = resp?.data || {};
  const rawList = payload?.data || payload?.result || [];

  let list = rawList.map((p) =>
    mapSallaProductToUnified(p, { storeObjectId: store._id })
  );

  // local filter by status
  if (unifiedStatus === "active") {
    list = list.filter((x) => x.isAvailable === true);
  } else if (unifiedStatus === "draft") {
    list = list.filter((x) => x.isAvailable === false);
  }

  // local filter by category if needed (robust)
  if (category != null && String(category).trim() !== "") {
    const cid = String(category).trim();
    list = list.filter((x) => Array.isArray(x.categories) && x.categories.some((c) => String(c.providerCategoryId) === cid));
  }

  // meta
  const count =
    payload?.pagination?.total ??
    payload?.meta?.total ??
    payload?.count ??
    list.length;

  return {
    success: true,
    code: 200,
    result: list,
    count: Number(count) || list.length,
    page,
    limit: per_page,
  };
}

async function listCategories({ store, filters }) {
  const page = toPositiveInt(filters?.page, 1);
  const per_page = clampInt(
    toPositiveInt(filters?.limit ?? filters?.per_page ?? 100, 100),
    1,
    100
  );

  const resp = await sallaRequest({
    storeId: store.provider.storeId,
    method: "GET",
    path: "/admin/v2/categories",
    params: { page, per_page },
  });

  const payload = resp?.data || {};
  const rawList = payload?.data || [];

  const list = rawList.map((c) => ({
    providerCategoryId: String(c?.id),
    name: c?.name || "",
    image: c?.image || null,
    raw: c,
  }));

  const count =
    payload?.pagination?.total ??
    payload?.meta?.total ??
    list.length;

  return {
    success: true,
    code: 200,
    result: list,
    count: Number(count) || list.length,
    page,
    limit: per_page,
  };
}
const sallaAdapter = {
  name: "salla",
  listProducts,
  listCategories,
};

module.exports = { sallaAdapter, };