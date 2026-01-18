const moment = require("moment");


const generatePassword = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars[randomIndex];
  }
  return password;
};

const expiresAtFromSeconds = (expiresIn) => {
 if (expiresIn === null || expiresIn === undefined) return new Date();

  // number or numeric string => treat as seconds
  if (typeof expiresIn === "number" || /^\d+$/.test(String(expiresIn).trim())) {
    const sec = Number(expiresIn);
    return moment().add(sec, "seconds").toDate();
  }

  // "1h 1m 1d" => moment.duration needs "1h1m1d"
  const normalized = String(expiresIn).trim().replace(/\s+/g, "");

  const dur = moment.duration(normalized);
  const ms = dur.asMilliseconds();

  if (!Number.isFinite(ms) || ms <= 0) return new Date(); // or throw

  return moment().add(dur).toDate();
};

const isExpiringSoon = (expiresAt, skewSeconds = 60) => {
  const exp = new Date(expiresAt).getTime();
  return exp - Date.now() <= skewSeconds * 1000;
}

/* ---------------- helpers ---------------- */
const toPositiveInt = (v, fallback) =>  {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

const normalizeText = (v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

const pickPagination = (data, { page, per_page, listLen }) => {
  const p = data?.pagination || {};
  return {
    count: p?.total ?? listLen ?? 0,
    limit: p?.perPage ?? per_page,
    page: p?.currentPage ?? page,
  };
}

const random9Digits = () => {
  // 100000000 .. 999999999
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

module.exports = { generatePassword, expiresAtFromSeconds, isExpiringSoon, toPositiveInt, normalizeText, pickPagination, random9Digits };
