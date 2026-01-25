// models/client/client.auth.repo.js

const { ConflictException, UnauthorizedException, BadRequestException } = require("../../middlewares/errorHandler/exceptions");
const bcrypt = require("bcrypt");
const Client = require("./client.model");
const jwtHelper = require("../../helpers/jwt.helper");
const { sendOTP, verifyLoginOTP, sendEmailOTP, verifyEmailOTP } = require("../../redis/phoneOtp.redis");


const SAFE_SELECT = { password: 0, __v: 0 };

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

exports.emailCheck = async (email) => {
  email = normalizeEmail(email);
  const exists = await Client.findOne({ email }).select({ _id: 1 }).lean();
  if (exists)  { throw new ConflictException("errors.email_used");};
  return {
    success: true,
    code: 200,
  };
};

exports.phoneCheck = async (phoneCode, phoneNumber) => {
  phoneCode = String(phoneCode || "").trim();
  phoneNumber = String(phoneNumber || "").trim();

  // ✅ Unique as a pair (phoneCode + phoneNumber)
  const exists = await Client.findOne({ phoneCode, phoneNumber })
    .select({ _id: 1 })
    .lean();

  if (exists) {
    throw new ConflictException("errors.phone_used");
  }

  return {
    success: true,
    code: 200,
  };
};

exports.verifyOTP = async (phoneCode, phoneNumber, email, otp) => {
  phoneCode = String(phoneCode || "").trim();
  phoneNumber = String(phoneNumber || "").trim();
  email = normalizeEmail(email);
  otp = String(otp || "").trim();

  if (email) {
    await verifyEmailOTP(email, otp);
    return {
      success: true,
      code: 200,
      message: "success.otp_verified",
    };
  }
  else {
    await verifyLoginOTP(phoneCode, phoneNumber, otp, true); // keepOtp = true
    return {
      success: true,
      code: 200,
      message: "success.otp_verified",
    };
  }
};

exports.register = async (payload = {}) => {
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const email = normalizeEmail(payload.email);
  const phoneCode = String(payload.phoneCode || "").trim();
  const phoneNumber = String(payload.phoneNumber || "").trim();
  const password = String(payload.password || "").trim();
  const otp = String(payload.otp || "").trim();

  // ✅ normalize fcm token once
  const fcmToken = String(payload.fcmToken || "").trim();
  const fcmTokens = fcmToken ? [fcmToken] : [];
  
  // ✅ email uniqueness
  const exists = await Client.findOne({ email }).select({ _id: 1 }).lean();
  if (exists) {
    throw new ConflictException("errors.email_used");
  }

  // ✅ OTP verify
  await verifyLoginOTP(phoneCode, phoneNumber, otp);


  // ✅ phone uniqueness
  const existsPhone = await Client.findOne({ phoneCode, phoneNumber }).select({ _id: 1 }).lean();
  if (existsPhone) {
    throw new ConflictException("errors.phone_used");
  }

  // ✅ create client (no extra save needed for fcm)
  const result = await Client.create({
    firstName,
    lastName,
    email,
    phoneNumber,
    phoneCode,
    password, // hashed by pre('save')
    birthDate: payload.birthDate ? new Date(payload.birthDate) : undefined,
    os: String(payload.os || ""),
    agreeToTerms: true,
    isPhoneVerified: true, // since OTP verified
    fcmToken: fcmTokens, // ✅ stored as array
  });

  // ✅ token (keep it lean; don't put fcmToken in JWT unless you really need it)
  const token = jwtHelper.generateToken({
    _id: result._id,
    firstName: result.firstName,
    lastName: result.lastName,
    email: result.email,
    isPhoneVerified: result.isPhoneVerified,
    isEmailVerified: result.isEmailVerified,
    isActive: result.isActive,
    phoneCode: result.phoneCode,
    phoneNumber: result.phoneNumber,
    birthDate: result.birthDate,
    role: "client",
  });

  // ✅ fetch safe client data
  const client = await Client.findById(result._id).select(SAFE_SELECT).lean();

  // ✅ RETURN fcmToken in response (even if SAFE_SELECT doesn't include it)
  return {
    success: true,
    code: 201,
    message: "success.registered_successfully",
    result: {
      client: {
        ...client,
        fcmToken: result.fcmToken, // ✅ guaranteed returned
      },
    },
    token,
  };
};

exports.sendOTP = async (phoneCode, phoneNumber, email) => {
  if (email) {
    email = normalizeEmail(email);
    const result = await sendEmailOTP(email);
    return {
      success: true,
      code: 200,
      message: "success.otp_sent_and_valid_5_minutes",
      result: result.result, // includes otp for dev purposes
    };
  }
  else {
    phoneCode = String(phoneCode || "").trim();
    phoneNumber = String(phoneNumber || "").trim();
    const result =await sendOTP(phoneCode, phoneNumber);
    return {
      success: true,
      code: 200,
      message: "success.otp_sent_and_valid_5_minutes",
      result: result.result, // includes otp for dev purposes
    };
  }
};


exports.login = async (payload = {}, type) => {
  const loginType = String(type || "").trim().toLowerCase();
  console.log("Login type:", type);
  // -----------------------
  // 1) Login by EMAIL (password)
  // -----------------------
  if (loginType === "email") {
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "").trim();
    const fcmToken = String(payload.fcmToken || "").trim();

    if (!email) throw new UnauthorizedException("errors.email_required");
    if (!password) throw new UnauthorizedException("errors.password_required");

    const result = await Client.findOne({ email });
    if (!result) throw new UnauthorizedException("errors.invalid_email_or_password");

    if (result.isActive === false) throw new UnauthorizedException("errors.account_inactive");
    if (result.isPhoneVerified === false) throw new UnauthorizedException("errors.account_phoneNotVerified");
    // if (result.isEmailVerified === false) throw new UnauthorizedException("errors.account_emailNotVerified");

    const passwordMatch = await bcrypt.compare(password, result.password);
    if (!passwordMatch) throw new UnauthorizedException("errors.invalid_email_or_password");

      // Optional: Update FCM token if provided
      if (fcmToken && !result.fcmToken.includes(fcmToken)) {
          result.fcmToken.push(fcmToken);
          await result.save();
      }

    const token = jwtHelper.generateToken({
      _id: result._id,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      isPhoneVerified: result.isPhoneVerified,
      isEmailVerified: result.isEmailVerified,
      isActive: result.isActive,
      phoneCode: result.phoneCode,
      phoneNumber: result.phoneNumber,
      birthDate: result.birthDate,
      role: "client",
    });



    const client = await Client.findById(result._id).select(SAFE_SELECT).lean();

    return {
      success: true,
      code: 200,
      message: "success.logged_in",
      result: { client },
      token,
    };
  }

  // -----------------------
  // 2) Login by PHONE (OTP only)
  // -----------------------
  if (loginType === "phone") {
    const phoneCode = String(payload.phoneCode || "").trim();
    const phoneNumber = String(payload.phoneNumber || "").trim();
    const otp = String(payload.otp || "").trim(); // ✅ required
    const fcmToken = String(payload.fcmToken || "").trim();

    if (!phoneCode) throw new UnauthorizedException("errors.phoneCode_required");
    if (!phoneNumber) throw new UnauthorizedException("errors.phoneNumber_required");
    if (!otp) throw new UnauthorizedException("errors.otp_required");

    const result = await Client.findOne({ phoneCode, phoneNumber });
    if (!result) throw new UnauthorizedException("errors.invalid_phone_or_otp");

    if (result.isActive === false) throw new UnauthorizedException("errors.account_inactive");

    // ✅ Verify OTP (implement this in your repo using Redis/DB)
    // Expected: { success: true } or throw UnauthorizedException("errors.otp_invalid")
    await verifyLoginOTP( phoneCode, phoneNumber, otp );

    // Optional: mark phone verified after successful OTP
    if (result.isPhoneVerified === false) {
      await Client.updateOne({ _id: result._id }, { $set: { isPhoneVerified: true } });
    }

    // Optional policy: require email verified or not (your choice)
    // if (result.isEmailVerified === false) throw new UnauthorizedException("errors.account_emailNotVerified");

    
      // Optional: Update FCM token if provided
      if (fcmToken && !result.fcmToken.includes(fcmToken)) {
          result.fcmToken.push(fcmToken);
          await result.save();
      }


    const token = jwtHelper.generateToken({
      _id: result._id,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      isPhoneVerified: result.isPhoneVerified,
      isEmailVerified: result.isEmailVerified,
      isActive: result.isActive,
      phoneCode: result.phoneCode,
      phoneNumber: result.phoneNumber,
      birthDate: result.birthDate,
      role: "client",
    });

    const client = await Client.findById(result._id).select(SAFE_SELECT).lean();

    return {
      success: true,
      code: 200,
      message: "success.logged_in",
      result: { client },
      token,
    };
  }

  throw new BadRequestException("errors.invalid_login_type");
};


exports.forgotPassword = async (email, locale) => {
  email = normalizeEmail(email);
  const client = await Client.findOne({ email });
  if (!client)  { throw new ConflictException("errors.email_not_found");};
  await sendEmailOTP(email, locale);
  return {
    success: true,
    code: 200,
    message: "success.password_reset_otp_sent",
  };
};


exports.resetPassword = async (email, otp, newPassword) => {
  email = normalizeEmail(email);
  const client = await Client.findOne({ email });
  if (!client)  { throw new ConflictException("errors.email_not_found");};

  // Verify OTP
  await verifyEmailOTP(email, otp);
  // Update password
  client.password = newPassword; // hashed by pre('save')
  await client.save();
  return {
    success: true,
    code: 200,
    message: "success.password_reset_successful",
  };
}


exports.refreshToken = async (refreshToken) => {
    const result = await jwtHelper.refreshAccessToken(refreshToken);
    return result
  
};