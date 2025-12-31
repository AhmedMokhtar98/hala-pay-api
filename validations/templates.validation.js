const Joi = require('joi');

module.exports = {
  templateValidationData: {
    body: Joi.object().required().keys({
      nameAr: Joi.string().required().messages({
        'string.base': 'Name in Arabic must be a string',
        'any.required': 'Name in Arabic is required',
      }),
      nameEn: Joi.string().required().messages({
        'string.base': 'Name in English must be a string',
        'any.required': 'Name in English is required',
      }),
      category: Joi.string().required().messages({
        'string.base': 'Category must be a string',
        'any.required': 'Category is required',
      }),
      type: Joi.string().required().messages({
        'string.base': 'Type must be a string',
        'any.required': 'Type is required',
      }),
      tags: Joi.array().items(Joi.string()).min(1).required().messages({
        'array.base': 'Tags must be an array',
        'any.required': 'Tags are required',
        'array.min': 'Please select at least one tag',
      }),
      price: Joi.number().positive().messages({
        'number.base': 'Price must be a number',
        'number.positive': 'Price must be greater than 0',
      }),
      discount: Joi.number().min(0).max(100).messages({
        'number.base': 'Discount must be a number',
        'number.min': 'Discount cannot be negative',
        'number.max': 'Discount cannot be more than 100',
      }),
      priceDiscounted: Joi.number().positive().messages({
        'number.base': 'Price After Discount must be a number',
        'number.positive': 'Price After Discount must be greater than 0',
      }),
      description: Joi.array().items(
        Joi.object({
          textAr: Joi.string().required().messages({
            'string.base': 'Description in Arabic must be a string',
            'any.required': 'Description in Arabic is required',
          }),
          textEn: Joi.string().required().messages({
            'string.base': 'Description in English must be a string',
            'any.required': 'Description in English is required',
          }),
        })
      ).min(1).required().messages({
        'array.base': 'Description must be an array',
        'any.required': 'Description is required',
        'array.min': 'At least one description is required',
      }),
      creationDate: Joi.date().required().messages({
        'date.base': 'Creation date must be a valid date',
        'any.required': 'Creation date is required',
      }),
      isActive: Joi.boolean().messages({
        'boolean.base': 'isActive must be a boolean',
      }),
      isTopDeal: Joi.boolean().messages({
        'boolean.base': 'isTopDeal must be a boolean',
      }),
      isTrending: Joi.boolean().messages({
        'boolean.base': 'isTrending must be a boolean',
      }),
    }),
  },

  templateValidationDataUpdate: {
    body: Joi.object().optional().keys({
      nameAr: Joi.string().optional().messages({
        'string.base': 'Name in Arabic must be a string',
      }),
      nameEn: Joi.string().optional().messages({
        'string.base': 'Name in English must be a string',
      }),
      category: Joi.string().optional().messages({
        'string.base': 'Category must be a string',
      }),
      type: Joi.string().optional().messages({
        'string.base': 'Type must be a string',
      }),
      tags: Joi.array().items(Joi.string()).min(1).optional().messages({
        'array.base': 'Tags must be an array',
        'array.min': 'Please select at least one tag',
      }),
      price: Joi.number().positive().optional().messages({
        'number.base': 'Price must be a number',
        'number.positive': 'Price must be greater than 0',
      }),
      discount: Joi.number().min(0).max(100).optional().messages({
        'number.base': 'Discount must be a number',
        'number.min': 'Discount cannot be negative',
        'number.max': 'Discount cannot be more than 100',
      }),
      priceDiscounted: Joi.number().positive().optional().messages({
        'number.base': 'Price After Discount must be a number',
        'number.positive': 'Price After Discount must be greater than 0',
      }),
      description: Joi.array().items(
        Joi.object({
          textAr: Joi.string().optional().messages({
            'string.base': 'Description in Arabic must be a string',
          }),
          textEn: Joi.string().optional().messages({
            'string.base': 'Description in English must be a string',
          }),
        })
      ).min(1).optional().messages({
        'array.base': 'Description must be an array',
        'array.min': 'At least one description is required',
      }),
      image: Joi.any().optional(),
      images: Joi.array().items(Joi.any()).optional(),
      creationDate: Joi.date().optional().messages({
        'date.base': 'Creation date must be a valid date',
      }),
      isActive: Joi.boolean().optional().messages({
        'boolean.base': 'isActive must be a boolean',
      }),
      isTopDeal: Joi.boolean().optional().messages({
        'boolean.base': 'isTopDeal must be a boolean',
      }),
      isTrending: Joi.boolean().optional().messages({
        'boolean.base': 'isTrending must be a boolean',
      }),
    }),
  },

  templateValidationImage: {
    body: Joi.object().required().keys({
      image: Joi.string().messages({
        'string.base': 'Image must be a string',
      }),
    }),
  },
};
