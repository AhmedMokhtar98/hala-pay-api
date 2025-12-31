const i18n = require('i18n');
const clientRepo = require("../../models/client/client.repo");
// const s3StorageHelper = require("../../utils/s3FileStorage.util")
// const batchRepo = require("../../models/batch/batch.repo");
const jwtHelper = require("../../helpers/jwt.helper")

exports.getClient = async (req, res) => {
    try {
        const operationResultObject = await clientRepo.get({ _id: req.query._id }, { password: 0, token: 0 });
        if(operationResultObject.code === 404 || operationResultObject.result.isActive === false){
            return res.status(403).json(operationResultObject);
        }
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


exports.updateClient = async (req, res) => {
    try {
        const operationResultObject = await clientRepo.update(req.query._id, req.body);
        const token = jwtHelper.generateToken(operationResultObject?.result, "1d")
        return res.status(operationResultObject.code).json({newData:operationResultObject, token:token});

    } catch (err) {
        console.log(`err.message`, err.message);
        return res.status(500).json({
            success: false,
            code: 500,
            error: i18n.__("internalServerError")
        });
    }
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