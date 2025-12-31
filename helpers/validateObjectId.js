const mongoose = require('mongoose');
const { BadRequestException } = require('../middlewares/errorHandler/exceptions');

const validateObjectId = (idPath = 'id') => {
    return (req, res, next) => {
        // Extract the ID from the specified path (params, body, or query)
        const _id = req.params[idPath] || req.body[idPath] || req.query[idPath];
        // Check if the ID is valid
        if (_id && !mongoose.Types.ObjectId.isValid(_id)) {
            throw new BadRequestException(("errors.invalid_id"));
        }
        // If the ID is valid or not needed, proceed to the next middleware or route handler
        next();
    };
};

module.exports = validateObjectId;
