// salla/repos/salla.repo.js
const { default: axios } = require("axios");
const { toPositiveInt, normalizeText, pickPagination } = require("../../utils/helpers");
const { axiosRequest } = require("../services/axiosRequest.service");
const { ensureValidAccessToken } = require("../services/sallaToken.service");

// list products with pagination and search
exports.getProducts = async (filterObject, storeId) => {

  const page = toPositiveInt(filterObject.page, 1);
  const per_page = toPositiveInt(filterObject.limit, 20);
  // search can come from different frontend conventions
  const search = normalizeText(filterObject.search || filterObject.q || filterObject.keyword);
  const accessToken = await ensureValidAccessToken(storeId);
  const params = { page, per_page };

  // ✅ Salla commonly uses `keyword` for searching list endpoints
  // If your Salla environment expects `search` instead, just change `keyword` -> `search`
  if (search) params.keyword = search;

  const resp = await axiosRequest({
    accessToken,
    method: "GET",
    path: "/admin/v2/products",
    params,
  });

  // ✅ safe extraction
  const data = resp?.data || {};
  const list = data?.data || [];
  const meta = pickPagination(data, { page, per_page, listLen: list.length });
  return {
    success: true,
    code: 200,
    result: list,
    count: meta.count,
    page: meta.page,
    limit: meta.limit,
  };
};

// list orders with pagination and search
exports.getOrders = async (filterObject, storeId) => {

  const page = toPositiveInt(filterObject.page, 1);
  const per_page = toPositiveInt(filterObject.limit, 20);
  const accessToken = await ensureValidAccessToken(storeId);
  const resp = await axiosRequest({ accessToken, method: "GET", path: "/admin/v2/orders", params: { page, per_page }, });
  // ✅ return only resp.data (no circular JSON)
  const data = resp?.data || {};
  const list = data?.data || data?.result || []; // some endpoints differ
  const meta = pickPagination(data, { page, per_page, listLen: Array.isArray(list) ? list.length : 0 });
  return {
    success: true,
    code: 200,
    result: list,
    count: meta.count,
    page: meta.page,
    limit: meta.limit,
  };
};

exports.getStoreDetails = async (accessToken) => {
  const {data} = await axios.get("https://accounts.salla.sa/oauth2/user/info", {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 30_000,
  });
  return {
    success: true,
    code: 200,
    result: data?.data, // accounts endpoint commonly returns {data: ...}
  };
};
