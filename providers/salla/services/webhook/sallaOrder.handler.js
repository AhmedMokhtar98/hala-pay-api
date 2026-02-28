const YallaPayOrder = require("../../../../models/order/order.model");

async function handleSallaOrder(payload) {
  const order = payload?.data;
  if (!order) return;

  const existing = await YallaPayOrder.findOne({
    providerOrderId: String(order.id),
  });

  if (!existing) return; // ignore normal store orders

  existing.status = order.status;
  existing.isPaid = order.payment_status === "paid";
  existing.raw = order;

  await existing.save();

  console.log("✅ YallaPay Order Updated:", order.id);
}

module.exports = { handleSallaOrder };