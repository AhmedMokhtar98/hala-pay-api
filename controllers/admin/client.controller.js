const clientRepo = require("../../models/client/client.repo");



exports.create = async (req, res)=>{
    const operationResultObject = await clientRepo.create(req.body);
    return res.status(operationResultObject.code).json(operationResultObject);
}



exports.list = async (req, res)=>{
    const filterObject = req.query;
    const operationResultObject = await clientRepo.list(filterObject, { password: 0 }, {});
    return res.status(operationResultObject.code).json(operationResultObject);
}

exports.get = async (req, res)=>{
    const {id} = req.params;
    const operationResultObject = await clientRepo.get(id);
    return res.status(operationResultObject.code).json(operationResultObject);    
}

exports.update = async (req, res)=>{
    const {id} = req.params;
    const operationResultObject = await clientRepo.update(id, req.body);
    return res.status(operationResultObject.code).json(operationResultObject);
}

exports.remove = async (req, res)=>{
    const {id} = req.params;
    const operationResultObject = await clientRepo.remove(id);
    return res.status(operationResultObject.code).json(operationResultObject);
}


