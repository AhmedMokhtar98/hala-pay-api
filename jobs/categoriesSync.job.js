const cron = require("node-cron");
const Stores = require("../models/store/store.model");
const Categories = require("../models/category/category.model");
const { getProviderAdapter } = require("../providers");

const DEFAULT_EXPR = "0 2 * * *";
const DEFAULT_TZ = "Africa/Cairo";

let task = null;

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

async function fetchAllProviderCategories({
  adapter,
  store,
  perPage,
  maxPages,
  maxRequests,
  delayMs,
}) {
  const all = [];

  let page = 1;
  let reqCount = 0;

  while (true) {
    reqCount++;
    if (reqCount > maxRequests) throw new Error("Exceeded maxRequests");

    if (maxPages !== "all" && page > maxPages) break;

    const resp = await adapter.listCategories({
      store,
      filters: { page, limit: perPage },
    });

    const list = Array.isArray(resp?.result) ? resp.result : [];
    if (!list.length) break;

    all.push(...list);

    if (list.length < perPage) break;

    page++;
    if (delayMs) await sleep(delayMs);
  }

  return all;
}

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
  if (typeof adapter.listCategories !== "function") {
    return { skipped: true, reason: "adapter has no listCategories" };
  }

  const perPage = envInt("CATEGORIES_SYNC_LIMIT", 100);
  const maxPages = envAllOrInt("CATEGORIES_SYNC_MAX_PAGES", "all");
  const maxRequests = envInt("CATEGORIES_SYNC_MAX_REQUESTS", 2000);
  const delayMs = envInt("CATEGORIES_SYNC_DELAY_MS", 200);

  const list = await fetchAllProviderCategories({
    adapter,
    store,
    perPage,
    maxPages,
    maxRequests,
    delayMs,
  });

  for (const c of list) {
    await Categories.updateOne(
      {
        store: store._id,
        provider: providerName,
        providerCategoryId: c.providerCategoryId,
      },
      {
        $set: {
          store: store._id,
          provider: providerName,
          providerCategoryId: c.providerCategoryId,
          nameEn: c.name,
          nameAr: c.name,
          image: c.image,
          isActive: true,
        },
      },
      { upsert: true }
    );
  }

  return {
    store: `${providerName}:${store.provider.storeId}`,
    fetched: list.length,
  };
}

async function runCategoriesSyncOnce(tag = "run") {
  if (!envBool("CATEGORIES_SYNC_ENABLED", false)) {
    console.log(`[categoriesSyncJob:${tag}] disabled`);
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

  console.log(`[categoriesSyncJob:${tag}] start stores=${stores.length}`);

  for (const store of stores) {
    try {
      const res = await syncOneStore(store);
      console.log(`[categoriesSyncJob:${tag}] ✅`, res);
      ok++;
    } catch (err) {
      fail++;
      console.error(`[categoriesSyncJob:${tag}] ❌`, err.message);
    }
  }

  console.log(`[categoriesSyncJob:${tag}] done ok=${ok} fail=${fail}`);
}

function startCategoriesSyncJob() {
  if (!envBool("CATEGORIES_SYNC_ENABLED", false)) return null;

  const expr = process.env.CATEGORIES_SYNC_CRON || DEFAULT_EXPR;

  runCategoriesSyncOnce("startup").catch(console.error);

  task = cron.schedule(
    expr,
    async () => {
      await runCategoriesSyncOnce("scheduled");
    },
    { timezone: DEFAULT_TZ }
  );

  return task;
}

async function stopCategoriesSyncJob() {
  if (task) task.stop();
}

module.exports = {
  startCategoriesSyncJob,
  stopCategoriesSyncJob,
  runCategoriesSyncOnce,
};