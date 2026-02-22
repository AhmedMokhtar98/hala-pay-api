// jobs/groupsDeadline.job.js
const cron = require("node-cron");
const Group = require("../models/group/group.model.js");

const DEFAULT_EXPR = "0 0 * * *"; // daily at 00:00
const DEFAULT_TZ = "Africa/Cairo";

let task = null;

/**
 * Close expired groups:
 * - status: "active"
 * - deadLine <= now
 * ✅ updates ONLY: status -> "closed"
 * ❌ does NOT touch isActive
 */
async function closeExpiredGroupsOnce(tag = "run") {
  const now = new Date();

  const res = await Group.updateMany(
    {
      status: "active",
      deadLine: { $ne: null, $lte: now },
    },
    {
      $set: { status: "closed" },
    }
  );

  const matched = res?.matchedCount ?? 0;
  const modified = res?.modifiedCount ?? 0;

  console.log(
    `[groupsDeadlineJob:${tag}] closed=${modified} matched=${matched} at ${now.toISOString()}`
  );

  return { matched, modified, now };
}

/**
 * Start cron job:
 * - run once on startup (default true)
 * - run daily at 00:00 (Africa/Cairo)
 */
function startGroupsDeadlineJob(options = {}) {
  const expr = options.expr || process.env.GROUPS_DEADLINE_CRON || DEFAULT_EXPR;
  const timezone = options.timezone || process.env.GROUPS_DEADLINE_TZ || DEFAULT_TZ;

  const runOnStart =
    options.runOnStart ??
    (String(process.env.GROUPS_DEADLINE_RUN_ON_START || "true").toLowerCase() === "true");

  // prevent double-start
  if (task) {
    console.log("ℹ️ [groupsDeadlineJob] already running");
    return task;
  }

  // ✅ Run once on startup (after DB is connected)
  if (runOnStart) {
    closeExpiredGroupsOnce("startup").catch((err) =>
      console.error("[groupsDeadlineJob:startup] ❌ error:", err)
    );
  }

  task = cron.schedule(
    expr,
    async () => {
      try {
        await closeExpiredGroupsOnce("scheduled");
      } catch (err) {
        console.error("[groupsDeadlineJob:scheduled] ❌ error:", err);
      }
    },
    { timezone }
  );

  console.log(`✅ [groupsDeadlineJob] scheduled="${expr}" TZ="${timezone}" runOnStart=${runOnStart}`);
  return task;
}

/**
 * Stop cron job (graceful shutdown)
 */
async function stopGroupsDeadlineJob() {
  try {
    if (task) {
      task.stop();
      task = null;
      console.log("✅ [groupsDeadlineJob] stopped");
    }
  } catch (err) {
    console.error("❌ [groupsDeadlineJob] stop error:", err);
  }
}

module.exports = {
  startGroupsDeadlineJob,
  stopGroupsDeadlineJob,
  closeExpiredGroupsOnce,
};