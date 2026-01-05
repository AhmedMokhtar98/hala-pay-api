// -------------------------------
// src/repositories/sallaToken.repo.js
// -------------------------------
const SallaStoreToken = require("../models/SallaStoreToken.model");

exports.findByStoreId = async (storeId) => {
  return SallaStoreToken.findOne({ storeId });
};

exports.upsertByStoreId = async (storeId, payload) => {
  return SallaStoreToken.updateOne(
    { storeId },
    { $set: { storeId, ...payload } },
    { upsert: true }
  );
};

exports.listConnected = async () => {
  return SallaStoreToken.find({})
    .select({ storeId: 1, expiresAt: 1, scope: 1, merchant: 1, updatedAt: 1 })
    .lean();
};

exports.deleteByStoreId = async (storeId) => {
  return SallaStoreToken.deleteOne({ storeId });
};

