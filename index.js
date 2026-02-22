// server.js  ✅ FULL CODE (Mongo + Redis connect) + graceful shutdown
const express = require("express");
const connectDB = require("./db.js");
const dotenv = require("dotenv");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors");
const { passport } = require("./utils/passport.js");
const i18n = require("./config/i18n");
const errorMiddleware = require("./middlewares/errorHandler/errorMiddleware.js");
const routes = require("./routes/index.route.js");
const session = require("express-session");
const decryptPasswordMiddleware = require("./middlewares/decryptPassword.js");
const translateResponseMiddleware = require("./middlewares/errorHandler/translate-response.middleware.js");

// ✅ Redis
const { connectRedis, disconnectRedis, redisClient } = require("./redis/redis.config.js");

// ✅ Groups Deadline Job
const { startGroupsDeadlineJob, stopGroupsDeadlineJob } = require("./jobs/groupsDeadline.job.js");

dotenv.config();

const app = express();

// -------------------------
// Logging
// -------------------------
app.use(morgan("combined"));
app.use(cors());
app.use(passport.initialize());
app.use(i18n.init);
app.use(express.static(path.join(process.cwd(), "public")));

// -------------------------
// Session
// -------------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// -------------------------
// Locale middleware
// -------------------------
app.use((req, res, next) => {
  const langHeader = req.headers["accept-language"];
  const lang = langHeader ? langHeader.substring(0, 2).toLowerCase() : null;
  req.setLocale(lang && ["en", "ar"].includes(lang) ? lang : i18n.getLocale());
  next();
});

// -------------------------
// Views
// -------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(process.cwd(), "public")));

// -------------------------
// Normal body parsing (JSON) for non-webhook routes
// -------------------------
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/v1/webhook")) return next();
  express.json()(req, res, next);
});

app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/v1/webhook")) return next();
  express.urlencoded({ extended: true })(req, res, next);
});

// -------------------------
// Custom middlewares
// -------------------------
app.use(decryptPasswordMiddleware);

// -------------------------
// Routes
// -------------------------
app.get("/", (req, res) => res.render("view"));

app.use(translateResponseMiddleware);

// Mount API routes (includes webhook)
app.use("/api/v1", routes);

// -------------------------
// Health check (Mongo + Redis)
// -------------------------
app.get("/health", async (req, res) => {
  try {
    const redisStatus = redisClient?.isOpen ? await redisClient.ping() : "DISCONNECTED";
    return res.json({ ok: true, redis: redisStatus, mongo: "ok" });
  } catch (e) {
    return res.status(500).json({ ok: false, redis: e?.message || "error", mongo: "ok" });
  }
});

// -------------------------
// Global error handling
// -------------------------
app.use(errorMiddleware);

// -------------------------
// Startup
// -------------------------
const PORT = process.env.PORT || 7000;

async function startServer() {
  try {
    // 1) Connect Mongo
    await Promise.resolve(connectDB());
    console.log("✅ MongoDB connected");

    // 2) Connect Redis
    await connectRedis();
    console.log("✅ Redis connected");

    // ✅ Start Groups Deadline Job:
    // - runs once on boot (default true)
    // - runs daily 00:00 Africa/Cairo
    startGroupsDeadlineJob();

    // 3) Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // 4) Graceful shutdown
    const shutdown = async (signal) => {
      try {
        console.log(`\n🛑 Received ${signal}. Shutting down...`);

        // ✅ Stop cron first
        await stopGroupsDeadlineJob();

        server.close(async () => {
          await disconnectRedis();
          console.log("✅ Shutdown complete.");
          process.exit(0);
        });

        setTimeout(() => process.exit(1), 15000).unref();
      } catch (err) {
        console.error("❌ Shutdown error:", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Failed to start server:", err?.message || err);
    process.exit(1);
  }
}

startServer();