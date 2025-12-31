// decryptPasswordMiddleware.js
const CryptoJS = require("crypto-js");

// ✅ Put this in env in real deployments
const SECRET_KEY_ENCRYPTION = process.env.SECRET_KEY_ENCRYPTION || "HalaPay@2024#EncryptionKey!";
const ENV = process.env.ENV || "dev";

/**
 * This matches CryptoJS passphrase encryption:
 * CryptoJS.AES.encrypt(plainText, SECRET).toString()
 *
 * Ciphertext often starts with "U2FsdGVkX1" (Base64 for "Salted__")
 */
function decryptAesPassphrase(cipherText) {

  if (typeof cipherText !== "string" || !cipherText.trim()) {
    throw new Error("CIPHERTEXT_EMPTY_OR_NOT_STRING");
  }

  // If ciphertext came via x-www-form-urlencoded, "+" can become " "
  const normalized = cipherText.trim().replace(/ /g, "+");
  console.log("Normalized SECRET_KEY_ENCRYPTION:", SECRET_KEY_ENCRYPTION); // Debug log
  const bytes = CryptoJS.AES.decrypt(normalized, SECRET_KEY_ENCRYPTION);
  const plain = bytes.toString(CryptoJS.enc.Utf8);

  // CryptoJS returns "" when key/format is wrong (or ciphertext corrupted)
  if (!plain) throw new Error("BAD_CIPHERTEXT_OR_KEY");
  console.log("Decrypted password:", plain); // Debug log

  return plain;
}

/** Recursively walk req.body and decrypt any field whose key includes "password" */
function decryptPasswordsDeep(value) {
  if (!value) return value;

  // arrays
  if (Array.isArray(value)) {
    return value.map(decryptPasswordsDeep);
  }

  // objects
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      const v = value[key];

      if (key.toLowerCase().includes("password")) {
        // only decrypt string values
        if (typeof v === "string") {
          value[key] = decryptAesPassphrase(v);
        }
      } else {
        value[key] = decryptPasswordsDeep(v);
      }
    }

    return value;

  }

  // primitives
  return value;
}

function decryptPasswordMiddleware(req, res, next) {
  try {
    if (ENV === "test") return next();
    if (!req.body || typeof req.body !== "object") return next();
    decryptPasswordsDeep(req.body);

    return next();
  } catch (err) {
    return res.status(400).json({
      message: "Invalid encrypted password",
      error: err.message,
    });
  }
}

module.exports = decryptPasswordMiddleware;
