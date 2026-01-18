// ./redis/redis.config.js
const { createClient } = require("redis");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Load env (server vs local)
const SERVER_ENV_PATH = "/var/www/hala-pay-api/.env";
const LOCAL_ENV_PATH = path.resolve(__dirname, "../.env");

function loadEnv() {
  const envPath = fs.existsSync(SERVER_ENV_PATH) ? SERVER_ENV_PATH : LOCAL_ENV_PATH;
  if (!process.env.__ENV_LOADED__) {
    dotenv.config({ path: envPath });
    process.env.__ENV_LOADED__ = "true";
    console.log(fs.existsSync(SERVER_ENV_PATH) ? "🌍 Loaded SERVER .env for Redis" : "💻 Loaded LOCAL .env for Redis");
  }
}
loadEnv();

function maskRedisUrl(url) {
  return url.replace(/redis(s)?:\/\/([^@]+)@/i, (m, s) => `redis${s ? "s" : ""}://****:****@`);
}

const REDIS_URL = (process.env.REDIS_URL || "").trim();

if (!REDIS_URL) {
  console.error("❌ REDIS_URL is missing. Set REDIS_URL in .env");
}

let redisClient = createClient({
  url: REDIS_URL,
  socket: {
    connectTimeout: 8000,
    reconnectStrategy: (retries) => {
      if (retries > 15) return new Error("Redis reconnect retries exhausted");
      return Math.min(200 * retries, 3000);
    },
  },
});

redisClient.on("connect", () => console.log("🧩 Redis connecting..."));
redisClient.on("ready", () => console.log("✅ Redis is ready"));
redisClient.on("reconnecting", () => console.log("🔄 Redis reconnecting..."));
redisClient.on("end", () => console.log("🛑 Redis connection closed"));
redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err?.message || err));

console.log("🔑 Redis Target:", REDIS_URL ? maskRedisUrl(REDIS_URL) : "NOT SET");

async function connectRedis() {
  if (redisClient.isOpen) return redisClient;
  await redisClient.connect();
  await redisClient.ping();
  return redisClient;
}

async function disconnectRedis() {
  try {
    if (redisClient?.isOpen) await redisClient.quit();
  } catch (err) {
    console.error("❌ Redis quit error:", err?.message || err);
  }
}

module.exports = { redisClient, connectRedis, disconnectRedis };
