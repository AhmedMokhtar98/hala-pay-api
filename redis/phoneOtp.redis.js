// ./repos/clientAuthOtp.repo.js
"use strict";

const otpGenerator = require("otp-generator");
const { connectRedis } = require("../redis/redis.config");
const { UnauthorizedException } = require("../middlewares/errorHandler/exceptions");
const { sendWhatsAppOtp } = require("../helpers/sendWhatsAppMessage");

// ✅ Use your nodemailer/OAuth helper (the one we created)
const { sendOTPPasswordResetEmailToClient } = require("../helpers/emailService.helper");
// must include: sendOTPPasswordResetEmailToClient({ email, otp })

const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 300); // 5 min
const OTP_EMAIL_TTL_SECONDS = Number(process.env.OTP_EMAIL_TTL_SECONDS || OTP_TTL_SECONDS);

const normalize = (v) => String(v || "").trim().replace(/\s+/g, "");

// -----------------------
// Redis Keys
// -----------------------
const otpKeyPhone = (phoneCode, phoneNumber) =>
  `otp:login:phone:${normalize(phoneCode)}:${normalize(phoneNumber)}`;

const otpKeyEmail = (email) => `otp:login:email:${String(email || "").trim().toLowerCase()}`;

// -----------------------
// OTP generator
// -----------------------
function generateOtp(length = 6) {
  return otpGenerator.generate(length, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
}

/**
 * ✅ Send OTP to PHONE (WhatsApp for now) + store in Redis with TTL
 * NOTE: For production, consider hashing OTP in Redis.
 */
exports.sendOTP = async (phoneCode, phoneNumber) => {
  const pc = normalize(phoneCode);
  const pn = normalize(phoneNumber);

  if (!pc) return { success: false, code: 400, message: "errors.requiredPhoneCode" };
  if (!pn) return { success: false, code: 400, message: "errors.requiredPhoneNumber" };

  const redis = await connectRedis();

  const otp = generateOtp(6);
  await redis.set(otpKeyPhone(pc, pn), otp, { EX: OTP_TTL_SECONDS });

  // TODO: integrate SMS provider
  // await smsProvider.send({ to: `${pc}${pn}`, message: `Your OTP is ${otp}` });

  // WhatsApp
  await sendWhatsAppOtp({ to: `${pc}${pn}`, otp });

  // DEV ONLY
  if (String(process.env.NODE_ENV || "").toLowerCase() !== "production") {
    console.log("📩 OTP PHONE (DEV ONLY):", { to: `${pc}${pn}`, otp });
  }

  return {
    success: true,
    code: 200,
    message: "success.otp_sent",
    result: { phoneCode: pc, phoneNumber: pn }, // no otp in prod response
  };
};

/**
 * ✅ Verify OTP for PHONE (compares and consumes)
 */
exports.verifyLoginOTP = async (phoneCode, phoneNumber, otp, keepOtp = false) => {
  const pc = normalize(phoneCode);
  const pn = normalize(phoneNumber);
  const code = normalize(otp);

  if (!pc) throw new UnauthorizedException("errors.requiredPhoneCode");
  if (!pn) throw new UnauthorizedException("errors.requiredPhoneNumber");
  if (!code) throw new UnauthorizedException("errors.requiredOtp");

  const redis = await connectRedis();
  const key = otpKeyPhone(pc, pn);
  const stored = await redis.get(key);

  if (!stored) throw new UnauthorizedException("errors.otp_expired");
  if (stored !== code) throw new UnauthorizedException("errors.otp_invalid");

  if (!keepOtp) await redis.del(key);

  return { success: true, code: 200 };
};

// =====================================================================
// ✅ EMAIL OTP (Generate + Send + Verify) — added
// =====================================================================

/**
 * ✅ Send OTP to EMAIL + store in Redis with TTL
 * Intended for: password reset, email login, verification flows, etc.
 */
exports.sendEmailOTP = async (email, lang) => {
  const em = String(email || "").trim().toLowerCase();
  if (!em) return { success: false, code: 400, message: "errors.requiredEmail" };

  const redis = await connectRedis();

  const otp = generateOtp(6);
  await redis.set(otpKeyEmail(em), otp, { EX: OTP_EMAIL_TTL_SECONDS });

  // Send via your nodemailer helper
  // NOTE: this function should send the OTP template we created earlier
  const mailRes = await sendOTPPasswordResetEmailToClient({ email: em, otp , lang});

  if (!mailRes?.success) {
    // optional: delete OTP if sending fails to avoid "ghost" OTPs
    await redis.del(otpKeyEmail(em));
    return {
      success: false,
      code: 500,
      message: "errors.email_send_failed",
    };
  }

  // DEV ONLY
  if (String(process.env.NODE_ENV || "").toLowerCase() !== "production") {
    console.log("📩 OTP EMAIL (DEV ONLY):", { email: em, otp });
  }

  return {
    success: true,
    code: 200,
    message: "success.otp_sent",
    result: { email: em }, // no otp in prod response
  };
};

/**
 * ✅ Verify OTP for EMAIL (compares and consumes)
 */
exports.verifyEmailOTP = async (email, otp, keepOtp = false) => {
  const em = String(email || "").trim().toLowerCase();
  const code = normalize(otp);

  if (!em) throw new UnauthorizedException("errors.requiredEmail");
  if (!code) throw new UnauthorizedException("errors.requiredOtp");

  const redis = await connectRedis();
  const key = otpKeyEmail(em);
  const stored = await redis.get(key);

  if (!stored) throw new UnauthorizedException("errors.otp_expired");
  if (stored !== code) throw new UnauthorizedException("errors.otp_invalid");

  if (!keepOtp) await redis.del(key);

  return { success: true, code: 200 };
};
