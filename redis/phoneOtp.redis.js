// ./repos/clientAuthOtp.repo.js
"use strict";

const otpGenerator = require("otp-generator");
const { connectRedis } = require("../redis/redis.config");
const { UnauthorizedException } = require("../middlewares/errorHandler/exceptions");

const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 300); // 5 min

const normalize = (v) => String(v || "").trim().replace(/\s+/g, "");

const otpKey = (phoneCode, phoneNumber) =>
  `otp:login:${normalize(phoneCode)}:${normalize(phoneNumber)}`;

/**
 * ✅ Send OTP (stores raw OTP in Redis with TTL)
 * NOTE: For production, consider hashing OTP instead of storing raw.
 */
exports.sendLoginOTP = async (phoneCode, phoneNumber) => {
  const pc = normalize(phoneCode);
  const pn = normalize(phoneNumber);
  if (!pc) return { success: false, code: 400, message: "errors.requiredPhoneCode" };
  if (!pn) return { success: false, code: 400, message: "errors.requiredPhoneNumber" };

  const redis = await connectRedis();
  const otp = otpGenerator.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  await redis.set(otpKey(pc, pn), otp, { EX: OTP_TTL_SECONDS });

  // TODO: integrate SMS provider here
  // await smsProvider.send({ to: `${pc}${pn}`, message: `Your OTP is ${otp}` });

  // DEV ONLY
  console.log("📩 OTP (DEV ONLY):", { to: `${pc}${pn}`, otp });

  return {
    success: true,
    code: 200,
    message: "success.otp_sent",
    result: { phoneCode: pc, phoneNumber: pn, otp }, // otp included for DEV purposes only
  };
};

/**
 * ✅ Verify OTP (compares and consumes)
 */
exports.verifyLoginOTP = async (phoneCode, phoneNumber, otp, keepOtp = false) => {
  const pc = normalize(phoneCode);
  const pn = normalize(phoneNumber);
  const code = normalize(otp);

  if (!pc) throw new UnauthorizedException("errors.requiredPhoneCode");
  if (!pn) throw new UnauthorizedException("errors.requiredPhoneNumber");
  if (!code) throw new UnauthorizedException("errors.requiredOtp");

  const redis = await connectRedis();
  const key = otpKey(pc, pn);
  const stored = await redis.get(key);

  // ✅ Not found => expired (Redis auto-deletes on TTL)
  if (!stored) throw new UnauthorizedException("errors.otp_expired");

  // ✅ Wrong => do NOT delete (keep it until TTL expires)
  if (stored !== code) throw new UnauthorizedException("errors.otp_invalid");

  // ✅ Correct => delete only if you want to consume it
  if (!keepOtp) {
    await redis.del(key);
  }

  return { success: true, code: 200 };
};

