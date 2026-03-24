// controllers/payment/payment.controller.js
"use strict";

const paymentRepo = require("../../models/payment/payment.repo");

exports.list = async (req, res) => {
  const filterObject = req.query || {};
  console.log("Filter object:", filterObject);

  const operationResultObject = await paymentRepo.list( filterObject, {}, {} );

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.get = async (req, res) => {
  const { id } = req.params;

  const operationResultObject = await paymentRepo.get(id);

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.remove = async (req, res) => {
  const { id } = req.params;

  const permanent =
    req.body?.permanent === true ||
    req.body?.permanent === "true" ||
    req.body?.permanent === 1 ||
    req.body?.permanent === "1";

  const operationResultObject = await paymentRepo.remove(id, permanent);

  return res.status(operationResultObject.code).json(operationResultObject);
};