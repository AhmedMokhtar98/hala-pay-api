const productRepo = require("../../models/product/product.repo");


exports.list = async (req, res) => {
        const filterObject = req.query;
        const pageNumber = req.query.page || 1, limitNumber = req.query.limit || 10;
        const operationResultObject = await productRepo.list(filterObject, {}, {}, req.query.store_id);
        return res.status(operationResultObject.code).json(operationResultObject);
}
