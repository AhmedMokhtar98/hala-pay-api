// helpers/email.helper.js
'use strict';

require("dotenv").config();
const nodemailer = require("nodemailer");
const jwtHelper = require("../helpers/jwt.helper");

const {
  supportEmailTemplate,
  passwordResetEmailTemplate,
  subscriptionPaymentTemplate,
  subscriptionPaymentText,
  emailVerificationTemplate,
  otpPasswordResetEmailTemplate,
} = require("../utils/emailTemplates");

/* =========================================
   1) SMTP Transporter (PrivateEmail)
   ========================================= */
function createTransporter() {
  const host = (process.env.EMAIL_HOST || "mail.privateemail.com").trim();
  const port = Number(process.env.EMAIL_PORT || 465);
  const secure = String(process.env.EMAIL_SECURE ?? "true") === "true";

  const user = (process.env.EMAIL_USER || "").trim();
  const pass = (process.env.EMAIL_PASS || "").trim();

  if (!user || !pass) {
    console.warn("⚠️ Missing EMAIL_USER / EMAIL_PASS in .env");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure, // true for 465 SSL, false for 587 STARTTLS
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });
}

const transporter = createTransporter();

/* =========================================
   2) Helpers
   ========================================= */
function normalizeFrom(from) {
  // Default: YallaPay Team <It@yallapayapp.com>
  return (
    (from && String(from).trim()) ||
    (process.env.EMAIL_FROM && String(process.env.EMAIL_FROM).trim()) ||
    "YallaPay Team <It@yallapayapp.com>"
  );
}

function safeError(err) {
  return {
    message: err?.message,
    code: err?.code,
    response: err?.response,
    responseCode: err?.responseCode,
    command: err?.command,
  };
}

/**
 * Generic mail sender (Promise-based)
 * @param {Object} args
 * @param {string|string[]} args.to
 * @param {string} args.subject
 * @param {string} [args.text]
 * @param {string} [args.html]
 * @param {string} [args.from]
 */
async function sendMail({ to, subject, text, html, from }) {
  if (!to) throw new Error("Missing `to`");
  if (!subject) throw new Error("Missing `subject`");

  const mailOptions = {
    from: normalizeFrom(from),
    to,
    subject,
    text,
    html,
  };

  const info = await transporter.sendMail(mailOptions);

  return {
    ok: true,
    messageId: info?.messageId,
    accepted: info?.accepted || [],
    rejected: info?.rejected || [],
    response: info?.response,
  };
}

/* =========================================
   3) Exports (Nodemailer version)
   ========================================= */

exports.sendEmailVerificationLink = async ({ email, emailToken }) => {
  try {
    await sendMail({
      to: email,
      subject: "Email Verification",
      text: `Please click the following link to verify your email: ${emailToken}`,
      html: emailVerificationTemplate({ emailToken }),
      from: "YallaPay Team <It@yallapayapp.com>",
    });

    return {
      success: true,
      code: 201,
      message: "Registration successful! Please check your email to verify.",
    };
  } catch (error) {
    console.error("Error sending verification email:", safeError(error));
    return { success: false, code: 500, message: "Failed to send email" };
  }
};

exports.sendSupportEmailToCompany = async ({
  name,
  company,
  email,
  phone,
  inquiryType,
  message,
}) => {
  try {
    await sendMail({
      to: "It@yallapayapp.com", // send support requests to your inbox
      subject: "New Support Request",
      html: supportEmailTemplate({ name, company, email, phone, inquiryType, message }),
      from: "YallaPay Support <It@yallapayapp.com>",
    });

    return { success: true, code: 201, message: "Email sent successfully" };
  } catch (error) {
    console.error("Error sending support email:", safeError(error));
    return { success: false, code: 500, message: "Failed to send email" };
  }
};

exports.sendPasswordResetEmailToClient = async ({ email }) => {
  try {
    const token = jwtHelper.generateToken({ email }, "1d");
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendMail({
      to: email,
      subject: "Password Reset Request",
      text:
        "You have requested to reset your password. Please click the button below to reset your password.",
      html: passwordResetEmailTemplate({ resetLink }),
      from: "YallaPay Team <It@yallapayapp.com>",
    });

    return { success: true, code: 201, message: "Email sent successfully" };
  } catch (error) {
    console.error("Error sending password reset email:", safeError(error));
    return { success: false, code: 500, message: "Failed to send password reset email." };
  }
};



exports.sendOTPPasswordResetEmailToClient = async ({ email, otp, lang }) => {
  try {
    if (!otp) throw new Error("Missing `otp`");

    await sendMail({
      to: email,
      subject: "Password Reset OTP",
      text: `Your password reset OTP is: ${otp}`,
      html: otpPasswordResetEmailTemplate({ otp, lang }), // ensure template supports { otp }
      from: "YallaPay Team <It@yallapayapp.com>",
    });

    return { success: true, code: 201, message: "Email sent successfully" };
  } catch (error) {
    console.error("Error sending OTP reset email:", safeError(error));
    return { success: false, code: 500, message: "Failed to send OTP email." };
  }
};

exports.sendSubscriptionPaymentEmail = async ({
  totalPrice,
  invoiceUrl,
  customer_name,
  email,
  plan,
  tierDuration,
  subscriptionStartDate,
  subscriptionEndDate,
}) => {
  try {
    await sendMail({
      to: email,
      subject: "Subscription Payment Confirmation",
      text: subscriptionPaymentText({
        totalPrice,
        invoiceUrl,
        customer_name,
        plan,
        tierDuration,
        subscriptionStartDate,
        subscriptionEndDate,
      }),
      html: subscriptionPaymentTemplate({
        totalPrice,
        invoiceUrl,
        customer_name,
        plan,
        tierDuration,
        subscriptionStartDate,
        subscriptionEndDate,
      }),
      from: "YallaPay Team <It@yallapayapp.com>",
    });

    return { success: true, code: 201, message: "Email sent successfully" };
  } catch (error) {
    console.error("Error sending subscription payment email:", safeError(error));
    return { success: false, code: 500, message: "Failed to send subscription payment email." };
  }
};

exports.sendMultipleEmails = async ({ data }) => {
  try {
    const rows = Array.isArray(data) ? data : [];

    const emailPromises = rows.map(async (row) => {
      if (!row?.email) return;

      const fullName = `${row.firstName || ""} ${row.lastName || ""}`.trim();

      try {
        await sendMail({
          to: row.email,
          subject: "Invitation",
          text: `Hi ${row.firstName || ""},\n\nJoin us today for a seamless shopping experience!`,
          html: subscriptionPaymentTemplate({ name: fullName }),
          from: "YallaPay Team <It@yallapayapp.com>",
        });
        console.log(`✅ Email sent to ${row.email}`);
      } catch (error) {
        console.error(`❌ Error sending email to ${row.email}:`, safeError(error));
      }
    });

    await Promise.all(emailPromises);

    return { success: true, message: "Emails sent successfully." };
  } catch (error) {
    console.error("Error processing emails:", safeError(error));
    return { success: false, message: "Error processing emails." };
  }
};

/* =========================================
   4) Optional: export sendMail too
   ========================================= */
exports._sendMail = sendMail;
exports._transporter = transporter;
