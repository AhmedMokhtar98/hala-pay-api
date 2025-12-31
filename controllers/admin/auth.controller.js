const adminRepo = require("../../models/admin/admin.repo");

exports.login = async (req, res) => {
    const resultOperation = await adminRepo.login(req.body);
    return res.status(resultOperation.code).json(resultOperation);
};
