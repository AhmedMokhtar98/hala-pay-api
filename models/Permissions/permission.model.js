const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
    admins: {
        type: [String],
        default: []
      },
      roles: {
        type: [String],
        default: []
      },
      permissions: {
        type: [String],
        default: []
      },
      templates: {
        type: [String],
        default: []
      }
}, { _id: false }); // _id: false to prevent creation of subdocument id

module.exports = PermissionSchema;  // Export only the schema
