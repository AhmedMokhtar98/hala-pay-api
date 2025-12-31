const joi = require("joi");

module.exports = {
  planCreateValidation: {
    body: joi.object().required().keys({
      type: joi.string().valid("vps", "shared").required(), // Matches the `type` field
      nameAr: joi.string().min(3).max(50).required(), // Arabic name validation
      nameEn: joi.string().min(3).max(50).required(), // English name validation
      descriptionAr: joi.string().min(3).max(500).required(), // Arabic name validation
      descriptionEn: joi.string().min(3).max(500).required(), // English name validation
      monthlyFees: joi.number().min(0).required(), // Monthly fees
      yearlyFees: joi.number().min(0).required(), // Yearly fees
      monthlyFeesBefore: joi.number().min(0).required(), // Discounted monthly fees
      yearlyFeesBefore: joi.number().min(0).required(), // Discounted yearly fees
      features: joi.object().required().keys({
        cpu: joi.number().integer().min(1).required(), // CPUs in cores
        ram: joi.number().integer().min(1).required(), // RAM in GB
        storage: joi.number().integer().min(10).required(), // Storage in GB
        bandwidth: joi.number().integer().min(1).required(), // Bandwidth in TB
        websites: joi.number()
          .integer()
          .min(1),
          // .when(joi.ref('..type'), { is: "shared", then: joi.required() }), // Websites required for shared hosting
        backups: joi.boolean().optional(), // Backups
        ssl: joi.boolean().optional(), // SSL support
        rootAccess: joi.boolean()
          .when(joi.ref('..type'), { is: "vps", then: joi.optional() }), // Root access for VPS
        managedSupport: joi.boolean().optional(), // Managed support
        security: joi.string().optional(), // Security description
        dedicatedSupport: joi.boolean().optional(), // Dedicated support
        array: joi.array().items(joi.any()).optional(), // Optional array
      }),
    }),
  },

  planUpdateValidation: {
    body: joi.object().keys({
      type: joi.string().valid("vps", "shared").optional(), // Optional type
      nameAr: joi.string().min(3).max(50).optional(), // Optional Arabic name
      nameEn: joi.string().min(3).max(50).optional(), // Optional English name
      descriptionAr: joi.string().min(3).max(500).required(), // Arabic name validation
      descriptionEn: joi.string().min(3).max(500).required(), // English name validation
      monthlyFees: joi.number().min(0).optional(), // Optional monthly fees
      yearlyFees: joi.number().min(0).optional(), // Optional yearly fees
      monthlyFeesBefore: joi.number().min(0).optional(), // Optional discounted monthly fees
      yearlyFeesBefore: joi.number().min(0).optional(), // Optional discounted yearly fees
      features: joi.object().keys({
        cpu: joi.number().integer().min(1).optional(), // Optional CPUs
        ram: joi.number().integer().min(1).optional(), // Optional RAM
        storage: joi.number().integer().min(10).optional(), // Optional storage
        bandwidth: joi.number().integer().min(1).optional(), // Optional bandwidth
        websites: joi.number()
          .integer()
          .min(1)
          .when(joi.ref('..type'), { is: "shared", then: joi.optional() }), // Optional websites for shared
        backups: joi.boolean().optional(), // Optional backups
        ssl: joi.boolean().optional(), // Optional SSL
        rootAccess: joi.boolean(),
          // .when(joi.ref('..type'), { is: "vps", then: joi.optional() }), // Optional root access for VPS
        managedSupport: joi.boolean().optional(), // Optional managed support
        security: joi.string().optional().trim(), // Optional security
        dedicatedSupport: joi.boolean().optional(), // Optional dedicated support
        array: joi.array().items(joi.any()).optional(), // Optional array
      }),
    }),
  },
};
