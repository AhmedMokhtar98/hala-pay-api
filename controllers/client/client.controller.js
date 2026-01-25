const i18n = require('i18n');
const clientRepo = require("../../models/client/client.repo");

exports.getClient = async (req, res) => {
    const _id = req?.user?._id || null;
        const operationResultObject = await clientRepo.get(_id);
        return res.status(operationResultObject.code).json(operationResultObject);
}


exports.updateClient = async (req, res) => {
    const operationResultObject = await clientRepo.update(req.user._id, req.body);
    return res.status(operationResultObject.code).json(operationResultObject);
}

exports.updatePhoneNumber = async (req, res) => {
    const operationResultObject = await clientRepo.updatePhoneNumber(req.user._id, req.body);
    return res.status(operationResultObject.code).json(operationResultObject);
}

exports.updatePassword = async (req, res) => {
    const operationResultObject = await clientRepo.updatePassword(req.user._id, req.body);
    return res.status(operationResultObject.code).json(operationResultObject);
}

exports.uploadImage = async (req, res) => {
  const clientId = req.user._id;
  const file = req.file;

  const op = await clientRepo.uploadClientImage(clientId, file);
  return res.status(op.code).json(op);
}

exports.deleteImage = async (req, res) => {
  const clientId = req.user._id;
    const op = await clientRepo.removeClientImage(clientId);
    return res.status(op.code).json(op);
}


exports.removeClient = async (req, res) => {
    try {
        const operationResultObject = await clientRepo.remove(req.query._id);
        return res.status(operationResultObject.code).json(operationResultObject);
    } catch (err) {
        console.log(`err.message`, err.message);
        return res.status(500).json({
            success: false,
            code: 500,
            error: i18n.__("internalServerError")
        });
    }
}


exports.removeAccount = async (req, res) => {
        const operationResultObject = await clientRepo.removeAccount(req.user._id);
        return res.status(operationResultObject.code).json(operationResultObject);
}



exports.resetPassword = async (req, res) => {
    try {
        const operationResultObject = await clientRepo.resetPassword(req.body.email, req.body.newPassword);
        return res.status(operationResultObject.code).json(operationResultObject);

    } catch (err) {
        console.log(`err.message`, err.message);
        return res.status(500).json({
            success: false,
            code: 500,
            error: i18n.__("internalServerError")
        });
    }

}



// exports.uploadImage = async (req, res) => {
//     try {
//         if (!req.files || req.files.length < 1) return res.status(404).json({ success: false, code: 404, error: i18n.__("fileNotRecieved") });

//         const existingObject = await clientRepo.find({ _id: req.query._id })
//         let oldImageObject = (existingObject.success && existingObject.result.image) ? (existingObject.result.image) : false

//         if (oldImageObject) await batchRepo.create({ filesToDelete: [oldImageObject.key] })

//         let operationResultArray = await s3StorageHelper.uploadFilesToS3("clients", req.files)
//         if (!operationResultArray.success) return res.status(500).json({
//             success: false,
//             code: 500,
//             error: i18n.__("internalServerError")
//         });
//         let operationResultObject = await clientRepo.updateDirectly(req.query._id, { image: operationResultArray.result[0] });

//         const token = jwtHelper.generateToken(operationResultObject?.result, "1d")

//         return res.status(operationResultObject.code).json({newData:operationResultObject, token:token});

//     } catch (err) {
//         console.log(`err.message`, err.message);
//         res.status(500).json({
//             success: false,
//             code: 500,
//             error: i18n.__("internalServerError")
//         });
//     }
// }


// exports.deleteImage = async (req, res) => {
//     try {
//         const existingObject = await clientRepo.find({ _id: req.query._id })
//         let imageObject = (existingObject.success && existingObject.result.image) ? (existingObject.result.image) : false
//         if (imageObject) await batchRepo.create({ filesToDelete: [imageObject.key] })
//         const operationResultObject = await clientRepo.updateDirectly(req.query._id, { $unset: { image: 1 } });
//         const token = jwtHelper.generateToken(operationResultObject?.result, "1d")
//         return res.status(operationResultObject.code).json({newData:operationResultObject, token:token});

//     } catch (err) {
//         console.log(`err.message`, err.message);
//         return res.status(500).json({
//             success: false,
//             code: 500,
//             error: i18n.__("internalServerError")
//         });
//     }
// }