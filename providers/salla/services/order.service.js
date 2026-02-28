const YallaPayOrder = require("../../../models/order/order.model");
const { ensureValidAccessToken } = require("./sallaToken.service");
const axios = require("axios");

async function createYallaPayOrder({ group }) {
  const token = await ensureValidAccessToken(group.store);

  const product = await mongoose
    .model("products")
    .findById(group.product)
    .lean();

  if (!product) throw new Error("Product not found");

  const orderPayload = {
    customer: {
      first_name: "Yalla",
      last_name: "Pay",
      email: "orders@yallapay.app",
    },
    items: [
      {
        name: product.name,
        quantity: 1,
        price: group.targetAmount,
      },
    ],
  };

  const response = await axios.post(
    "https://api.salla.dev/admin/v2/orders",
    orderPayload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const providerOrderId = String(response.data?.data?.id || "");

  if (!providerOrderId) {
    throw new Error("Failed to create Salla order");
  }

  const order = await YallaPayOrder.create({
    group: group._id,
    store: group.store,
    product: group.product,
    providerOrderId,
    amount: group.targetAmount,
    rawResponse: response.data,
  });

  return order;
}

module.exports = { createYallaPayOrder };