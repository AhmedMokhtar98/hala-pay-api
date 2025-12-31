const express = require("express");
const connectDB = require("./db.js");
const dotenv = require("dotenv");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors");
const {passport} = require("./utils/passport.js");
const i18n = require("./config/i18n");
const errorMiddleware = require("./middlewares/errorHandler/errorMiddleware.js");
const routes = require("./routes/index.route.js");
const session = require("express-session"); // ADD THIS
const decryptPasswordMiddleware = require("./middlewares/decryptPassword.js");
const translateResponseMiddleware = require("./middlewares/errorHandler/translate-response.middleware.js");

dotenv.config();
const app = express();

// -------------------------
// Logging
// -------------------------
app.use(morgan("combined"));
app.use(cors());
app.use(passport.initialize());
app.use(i18n.init);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" }
  })
); // ← ADD THIS
// -------------------------
// Locale middleware
// -------------------------
app.use((req, res, next) => {
  const langHeader = req.headers["accept-language"];
  const lang = langHeader ? langHeader.substring(0,2).toLowerCase() : null;
  req.setLocale(lang && ["en","ar"].includes(lang) ? lang : i18n.getLocale());
  next();
});

// -------------------------
// Views
// -------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// -------------------------
// Normal body parsing (JSON) for non-webhook routes
// -------------------------
app.use((req, res, next) => {
  // Exclude webhook route from JSON parsing
  if (req.originalUrl.startsWith("/api/v1/webhook")) return next();
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/v1/webhook")) return next();
  express.urlencoded({ extended: true })(req, res, next);
});
app.use(decryptPasswordMiddleware);

// -------------------------
// Routes
// -------------------------
app.get("/", (req, res) => res.render("view"));
app.use(translateResponseMiddleware);

// Mount API routes (includes webhook)
app.use("/api/v1", routes);

// -------------------------
// Global error handling
// -------------------------
app.use(errorMiddleware);

// -------------------------
// Database & server start
// -------------------------
connectDB();
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
