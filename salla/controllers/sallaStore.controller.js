const { ensureValidAccessToken } = require("../services/sallaToken.service");
const sallaApiRepo = require("../repos/sallaApi.repo");

exports.getOrders = async (req, res) => {
  const { storeId } = req.params;

  const page = Number(req.query.page || 1);
  const per_page = Number(req.query.per_page || 20);

  const accessToken = await ensureValidAccessToken(storeId);

  const resp = await sallaApiRepo.request({
    accessToken,
    method: "GET",
    path: "/admin/v2/orders", // common Salla endpoint pattern
    params: { page, per_page },
  });

  return res.json({ success: true, result: resp.data });
};

exports.getProducts = async (req, res) => {
  const { storeId } = req.params;

  const page = Number(req.query.page || 1);
  const per_page = Number(req.query.per_page || 20);

  const accessToken = await ensureValidAccessToken(storeId);

  const resp = await sallaApiRepo.request({
    accessToken,
    method: "GET",
    path: "/admin/v2/products",
    params: { page, per_page },
  });

  return res.json({ success: true, result: resp.data });
};
