// config/passport.js
const passport = require("passport");
const SallaAPIFactory = require("@salla.sa/passport-strategy");

const SallaAPI = new SallaAPIFactory({
  clientID: process.env.SALLA_CLIENT_ID,
  clientSecret: process.env.SALLA_CLIENT_SECRET,
  callbackURL: process.env.SALLA_REDIRECT_URI, // e.g. https://your-domain.com/salla/auth/callback
});

passport.use(SallaAPI.getPassportStrategy());

module.exports = { passport, SallaAPI };
