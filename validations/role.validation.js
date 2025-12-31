const joi = require("joi");

module.exports = {

    createRoleValidation: {
        body: joi.object().required().keys({
            name: joi.string().optional().empty().messages({
                "string.base": "validNameString",
                "string.empty": "emptyNameString",
            }),
            permissions: joi.object().required().messages({
                "object.base": "validPermissionsObject",
                "any.required": "requiredPermissionsObject",
            }),
        }),
    },


    updateRoleValidation: {
        body: joi.object().optional().keys({
            name: joi.string().optional().empty().messages({
                "string.base": "validNameString",
                "string.empty": "emptyNameString",
            }),
            permissions: joi.object().required().messages({
                "object.base": "validPermissionsObject",
                "any.required": "requiredPermissionsObject",
            }),
        })
    }
    
}
