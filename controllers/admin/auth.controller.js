const adminRepo = require("../../models/admin/admin.repo");

exports.login = async (req, res) => {
    const resultOperation = await adminRepo.login(req.body);
    return res.status(resultOperation.code).json(resultOperation);
};

exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    const resultOperation = await adminRepo.refreshToken(refreshToken);
    return res.status(resultOperation.code).json(resultOperation);
}