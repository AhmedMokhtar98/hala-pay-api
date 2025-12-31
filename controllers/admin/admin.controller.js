const i18n = require('i18n');
const adminRepo = require("../../models/admin/admin.repo");


exports.createAdmin = async (req, res) => {
        const operationResultObject = await adminRepo.create(req.body);
        if (operationResultObject.success) delete operationResultObject.result.password;
        return res.status(operationResultObject.code).json(operationResultObject);
}


exports.listAdmins = async (req, res) => {
        const filterObject = req.query;
        const operationResultObject = await adminRepo.list(filterObject, { password: 0 }, {});
        return res.status(operationResultObject.code).json(operationResultObject);
}


exports.getAdmin = async (req, res) => {
        const adminId = req.params.id;
        const operationResultObject = await adminRepo.get(adminId);
        return res.status(operationResultObject.code).json(operationResultObject);
}


exports.updateAdmin = async (req, res) => {
        const operationResultObject = await adminRepo.update(req.params.id, req.body);
        return res.status(operationResultObject.code).json(operationResultObject);
}


exports.updateAdminRole = async (req, res) => {
        const operationResultObject = await adminRepo.update(req.params.id, { permission: req.body.permission, $unset: { token: 1 } });
        return res.status(operationResultObject.code).json(operationResultObject);
}


exports.removeAdmin = async (req, res) => {
        const { id } = req.params;     
        const permanent = req.body.permanent;
        const operationResultObject = await adminRepo.remove(id, permanent);
        return res.status(operationResultObject.code).json(operationResultObject);
}



exports.resetPassword = async (req, res) => {
        const operationResultObject = await adminRepo.resetPassword(req.body.email, req.body.newPassword);
        return res.status(operationResultObject.code).json(operationResultObject);
}
