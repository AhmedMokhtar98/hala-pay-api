const cron = require("node-cron");
const Stores = require("../models/store/store.model");
const Products = require("../models/product/product.model");
const { getProviderAdapter } = require("../providers");

const DEFAULT_EXPR = "0 1 * * *";
const DEFAULT_TZ = "Africa/Cairo";

let task = null;

/* =========================
   ENV HELPERS
========================= */

function envBool(name, def = false) {
  const v = process.env[name];
  if (v == null) return def;
  return String(v).trim() === "1" || String(v).toLowerCase() === "true";
}

function envInt(name, def) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function envAllOrInt(name, defInt) {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  if (!v) return defInt;
  if (v === "all" || v === "-1" || v === "0") return "all";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : defInt;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* =========================
   FETCH PROVIDER PAGES
========================= */

async function fetchAllProviderProducts({
  adapter,
  store,
  perPage,
  maxPages,
  maxRequests,
  delayMs,
}) {
  const all = [];
  const fetchedIds = new Set();

  let page = 1;
  let reqCount = 0;

  while (true) {
    reqCount++;
    if (reqCount > maxRequests) {
      throw new Error(`Exceeded maxRequests=${maxRequests}`);
    }

    if (maxPages !== "all" && page > maxPages) break;

    const resp = await adapter.listProducts({
      store,
      filters: { page, limit: perPage },
    });

    const list = Array.isArray(resp?.result) ? resp.result : [];
    if (!list.length) break;

    for (const item of list) {
      const id = String(item.providerProductId || "");
      if (id) fetchedIds.add(id);
      all.push(item);
    }

    if (list.length < perPage) break;

    page++;
    if (delayMs) await sleep(delayMs);
  }

  return { all, fetchedIds };
}

/* =========================
   MARK MISSING INACTIVE
========================= */

async function markMissingInactive(storeId, provider, fetchedIds) {
  await Products.updateMany(
    {
      store: storeId,
      provider,
      providerProductId: { $nin: Array.from(fetchedIds) },
      isActive: true,
    },
    { $set: { isActive: false } }
  );
}

/* =========================
   SYNC ONE STORE
========================= */

async function syncOneStore(store) {
  const providerName = String(store?.provider?.name || "")
    .toLowerCase()
    .trim();

  if (!providerName) {
    return { skipped: true, reason: "missing provider name" };
  }

  if (!store?.auth?.accessToken) {
    return { skipped: true, reason: "missing accessToken" };
  }

  if (store?.auth?.expiresAt && new Date(store.auth.expiresAt) <= new Date()) {
    return { skipped: true, reason: "token expired" };
  }

  const adapter = getProviderAdapter(providerName);

  const perPage = envInt("PRODUCTS_SYNC_LIMIT", 100);
  const maxPages = envAllOrInt("PRODUCTS_SYNC_MAX_PAGES", "all");
  const maxRequests = envInt("PRODUCTS_SYNC_MAX_REQUESTS", 5000);
  const delayMs = envInt("PRODUCTS_SYNC_DELAY_MS", 250);
  const markMissing = envBool("PRODUCTS_SYNC_MARK_MISSING_INACTIVE", false);

  const { all, fetchedIds } = await fetchAllProviderProducts({
    adapter,
    store,
    perPage,
    maxPages,
    maxRequests,
    delayMs,
  });

  let inserted = 0;
  let updated = 0;

  for (const p of all) {
    const res = await Products.updateOne(
      {
        store: p.store,
        provider: p.provider,
        providerProductId: p.providerProductId,
      },
      { $set: p },
      { upsert: true }
    );

    if (res.upsertedCount) inserted++;
    else if (res.modifiedCount) updated++;
  }

  if (markMissing && maxPages === "all") {
    await markMissingInactive(store._id, providerName, fetchedIds);
  }

  return {
    store: `${providerName}:${store.provider.storeId}`,
    fetched: all.length,
    inserted,
    updated,
  };
}

/* =========================
   RUN ONCE
========================= */

async function runProductsSyncOnce(tag = "run") {
  if (!envBool("PRODUCTS_SYNC_ENABLED", false)) {
    console.log(`[productsSyncJob:${tag}] disabled`);
    return;
  }

  const q = {
    isActive: true,
    "provider.name": { $ne: "manual" },
    "auth.accessToken": { $type: "string", $ne: "" },
    "auth.expiresAt": { $gt: new Date() },
  };

  const stores = await Stores.find(q).lean();

  let ok = 0;
  let fail = 0;

  console.log(`[productsSyncJob:${tag}] start stores=${stores.length}`);

  for (const store of stores) {
    try {
      const res = await syncOneStore(store);
      if (res?.skipped) {
        console.log(`[productsSyncJob:${tag}] ⏭ skipped`, res);
        ok++;
      } else {
        console.log(`[productsSyncJob:${tag}] ✅`, res);
        ok++;
      }
    } catch (err) {
      fail++;
      console.error(`[productsSyncJob:${tag}] ❌`, err.message);
    }
  }

  console.log(`[productsSyncJob:${tag}] done ok=${ok} fail=${fail}`);
}

/* =========================
   CRON CONTROL
========================= */

function startProductsSyncJob() {
  if (!envBool("PRODUCTS_SYNC_ENABLED", false)) return null;

  const expr = process.env.PRODUCTS_SYNC_CRON || DEFAULT_EXPR;

  runProductsSyncOnce("startup").catch(console.error);

  task = cron.schedule(
    expr,
    async () => {
      await runProductsSyncOnce("scheduled");
    },
    { timezone: DEFAULT_TZ }
  );

  return task;
}

async function stopProductsSyncJob() {
  if (task) task.stop();
}

module.exports = {
  startProductsSyncJob,
  stopProductsSyncJob,
  runProductsSyncOnce,
};