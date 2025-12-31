const cors = (req, res, next) => {
  try {
    // Check for the allowed token and process logic as needed
    if (req.url === "/" || req.url === "") {
      return next();
    }

    // Allow access to the Stripe webhook without token validation
    if (req.url === "/api/v1/payment/webhook") {
      return next();
    }

    // // If the request is an API request and has the correct token
    // if (req.url.startsWith("/api") && req.headers["x-app-token"] === "Hostwover-team") {
    //   return next();
    // }

    // If none of the above conditions are met, return 403 Forbidden
    // if (req.url.startsWith("/api")) {
    //   return res.status(403).json({ success: false, error: "forbidden", code: 403 });
    // }

    // If everything checks out, continue to the next middleware
    return next();
  } catch (err) {
    console.log(`Error: ${err.message}`);
    return res.status(500).json({ success: false, error: "internalServerError", code: 500 });
  }
};

module.exports = cors;
