const joi = require('joi');
module.exports = {
    createPortValidation : {
        body: joi.object().required().keys({
            port: joi.number()
                .integer()
                .min(1)
                .max(65535) // Port numbers must be in the range of 1-65535
                .required()
                .messages({
                    'number.base': 'Port must be a valid number.',
                    'number.integer': 'Port must be an integer.',
                    'number.min': 'Port must be at least 1.',
                    'number.max': 'Port must be at most 65535.',
                    'any.required': 'Port is a required field.'
                }),

            ip: joi.string()
                .ip({ version: ['ipv4', 'ipv6'], cidr: 'forbidden' }) // Validates IPv4 or IPv6
                .required()
                .messages({
                    'string.base': 'IP must be a valid string.',
                    'string.ip': 'IP must be a valid IPv4 or IPv6 address.',
                    'any.required': 'IP is a required field.'
                })
        })
    },

    updatePortValidation: {
        body: joi.object().required().keys({
            port: joi.number()
                .integer()
                .min(1)
                .max(65535) // Port numbers must be in the range of 1-65535
                .required()
                .messages({
                    'number.base': 'Port must be a valid number.',
                    'number.integer': 'Port must be an integer.',
                    'number.min': 'Port must be at least 1.',
                    'number.max': 'Port must be at most 65535.',
                    'any.required': 'Port is a required field.'
                }),

            ip: joi.string()
                .ip({ version: ['ipv4', 'ipv6'], cidr: 'forbidden' }) // Validates IPv4 or IPv6
                .required()
                .messages({
                    'string.base': 'IP must be a valid string.',
                    'string.ip': 'IP must be a valid IPv4 or IPv6 address.',
                    'any.required': 'IP is a required field.'
                })
        })
    },
};
