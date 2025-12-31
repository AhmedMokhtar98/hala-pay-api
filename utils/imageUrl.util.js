const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();
 const generateImageLocation = (collection, _id, filename) => {
    // console.log("filename",filename);
    const randomKey = crypto.randomBytes(16).toString('hex'); // Generate a random 16-byte key and convert it to a hexadecimal string
    return {key:randomKey ,Location:`${process.env.SERVER_URL}/uploads/${collection}/${_id}/${filename}`};
  };
module.exports = generateImageLocation