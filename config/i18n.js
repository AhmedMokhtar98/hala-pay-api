const i18n = require("i18n");
const path = require("path");

i18n.configure({
  locales: ["en", "ar"],
  defaultLocale: "en",
  directory: path.join(__dirname, "locales"), // must exist
  objectNotation: true,
  autoReload: true,
  updateFiles: false,
});

module.exports = i18n;
