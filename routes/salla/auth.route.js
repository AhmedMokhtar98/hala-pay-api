// routes/salla/auth.route.js
const { Router } = require("express");
const {passport} = require("../../utils/passport.js");
const router = Router();

// Step 1 – redirect to Salla
router.get(
  "/",
  passport.authenticate("salla", {
    scope: ["offline_access"], // ok for refresh token
  })
);

// Step 2 – callback from Salla
router.get(
  "/callback",
  passport.authenticate("salla", { session: false }),
  (req, res) => {
    // req.user now contains store_id, access_token, refresh_token
    console.log("Connected store:", req.user);
    res.send("Salla store connected successfully!");
  }
);


module.exports = router;
