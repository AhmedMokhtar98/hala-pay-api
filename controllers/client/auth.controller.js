// controllers/client/auth.controller.js

const clientAuthRepo = require("../../models/client/client.auth.repo");
exports.emailCheck = async (req, res) => {
  const { email } = req.body;
  const operationResultObject = await clientAuthRepo.emailCheck(email);
  return res.status(operationResultObject.code).json(operationResultObject);
}
exports.phoneCheck = async (req, res) => {
  const { phoneCode, phoneNumber } = req.body;
  const operationResultObject = await clientAuthRepo.phoneCheck(phoneCode, phoneNumber);
  return res.status(operationResultObject.code).json(operationResultObject);
}

exports.sendOTP = async (req, res) => {
  const { phoneCode, phoneNumber } = req.body;
  const operationResultObject = await clientAuthRepo.sendOTP(phoneCode, phoneNumber);
  return res.status(operationResultObject.code).json(operationResultObject);
}
exports.verifyOTP = async (req, res) => {
  const { phoneCode, phoneNumber, otp } = req.body;
  const operationResultObject = await clientAuthRepo.verifyOTP(phoneCode, phoneNumber, otp);
  return res.status(operationResultObject.code).json(operationResultObject);
}
exports.register = async (req, res) => {
  const operationResultObject = await clientAuthRepo.register(req.body);
  return res.status(operationResultObject.code).json(operationResultObject);
};

exports.login = async (req, res) => {
  const { type: loginType, ...formData } = req.body || {}; // ✅ removes type from payload + keeps it as loginType
  const operationResultObject = await clientAuthRepo.login(formData, loginType);
  return res.status(operationResultObject.code).json(operationResultObject);
};


exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const lang = req.headers['accept-language'];
  const operationResultObject = await clientAuthRepo.forgotPassword(email, lang);
  return res.status(operationResultObject.code).json(operationResultObject);
}

exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const operationResultObject = await clientAuthRepo.resetPassword(email, otp, newPassword);
  return res.status(operationResultObject.code).json(operationResultObject);
}

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  const operationResultObject = await clientAuthRepo.refreshToken(refreshToken);
  return res.status(operationResultObject.code).json(operationResultObject);
}