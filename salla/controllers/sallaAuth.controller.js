// salla/controllers/sallaAuth.controller.js
const sallaAuthRepo = require("../repos/sallaAuth.repo");

exports.startAuth = async (req, res) => {
  const operationResultObject = await sallaAuthRepo.startAuth();

  if (operationResultObject.cookie) {
    const { name, value, options } = operationResultObject.cookie;
    res.cookie(name, value, options);
  }

  if (operationResultObject.redirectUrl) {
    return res.redirect(operationResultObject.redirectUrl);
  }

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.callback = async (req, res) => {
  const operationResultObject = await sallaAuthRepo.callback({
    query: req.query,
    cookies: req.cookies,
  });

  if (operationResultObject.clearCookieName) {
    res.clearCookie(operationResultObject.clearCookieName);
  }

  if (operationResultObject.redirectUrl) {
    return res.redirect(operationResultObject.redirectUrl);
  }

  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.status = async (req, res) => {
  const operationResultObject = await sallaAuthRepo.status();
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.refresh = async (req, res) => {
  const { storeId } = req.params;
  const operationResultObject = await sallaAuthRepo.refresh(storeId);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.disconnect = async (req, res) => {
  const { storeId } = req.params;
  const operationResultObject = await sallaAuthRepo.disconnect(storeId);
  return res.status(operationResultObject.code).json(operationResultObject);
};



