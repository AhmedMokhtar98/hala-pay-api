// emailTemplates.js
const moment = require('moment');
require('dotenv').config();

// Utility function to format ISO date using Moment.js
const formatDate = (isoDate) => {
  return moment(isoDate).format('DD/MM/YYYY');
};

const joinUrl = (base, path) => {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
};

// Small HTML safety
const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");


exports.supportEmailTemplate = ({ name, company, email, phone, inquiryType, message }) => `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h2 style="text-align: center; color: #4A90E2;">New Support Request</h2>
    <p style="font-size: 16px; color: #555;">You have received a new support request with the following details:</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <tr>
        <td style="padding: 10px; background-color: #f9f9f9; font-weight: bold;">Name:</td>
        <td style="padding: 10px;">${name}</td>
      </tr>
      <tr>
        <td style="padding: 10px; background-color: #f9f9f9; font-weight: bold;">Company:</td>
        <td style="padding: 10px;">${company}</td>
      </tr>
      <tr>
        <td style="padding: 10px; background-color: #f9f9f9; font-weight: bold;">Email:</td>
        <td style="padding: 10px;">${email}</td>
      </tr>
      <tr>
        <td style="padding: 10px; background-color: #f9f9f9; font-weight: bold;">Phone:</td>
        <td style="padding: 10px;">${phone}</td>
      </tr>
      <tr>
        <td style="padding: 10px; background-color: #f9f9f9; font-weight: bold;">Inquiry Type:</td>
        <td style="padding: 10px;">${inquiryType}</td>
      </tr>
      <tr>
        <td style="padding: 10px; background-color: #f9f9f9; font-weight: bold;">Message:</td>
        <td style="padding: 10px;">${message}</td>
      </tr>
    </table>
    <p style="margin-top: 30px; text-align: center; font-size: 14px; color: #888;">This email was generated automatically. Please do not reply.</p>
  </div>
`;


exports.otpPasswordResetEmailTemplate = ({
  otp,
  expiresInMinutes = 5,
  brandName = "YallaPay",
  supportEmail = "It@yallapayapp.com",
  logoUrl = joinUrl(process.env.APP_PUBLIC_URL, "public/logo.png"),

  // ✅ pass "ar" for Arabic, otherwise "en"
  lang = "en",

  theme = {
    pageBg: "#F6FFF9",
    cardBg: "#FFFFFF",
    border: "#E7F0EA",
    text: "#0F172A",
    muted: "#64748B",
    green: "#18C77A",
    green2: "#7CFFB2",
    glow: "rgba(24,199,122,.22)",
    logoBg: "#FFFFFF",
    logoBorder: "#EEF2F7",
    softPanel: "#F8FAFC",
  },
}) => {
  const safeOtp = escapeHtml(String(otp || "").trim());
  const year = new Date().getFullYear();

  const isAr = String(lang || "").toLowerCase().startsWith("ar");
  const dir = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";

  const t = isAr
    ? {
        badge: "رمز التحقق",
        title: "رمز إعادة تعيين كلمة المرور",
        desc: `استخدم رمز التحقق لمرة واحدة أدناه لإعادة تعيين كلمة المرور. ينتهي خلال`,
        minutes: "دقائق",
        codeLabel: "رمز التحقق",
        dontShare: "لأمانك، لا تشارك هذا الرمز مع أي شخص.",
        ignore:
          "إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان. لن يتم تغيير كلمة المرور.",
        help: "تحتاج مساعدة؟ تواصل معنا على",
      }
    : {
        badge: "Security verification",
        title: "Password reset code",
        desc: `Use the one-time code below to reset your password. This code expires in`,
        minutes: "minutes",
        codeLabel: "One-time code",
        dontShare: "For your security, don’t share this code with anyone.",
        ignore:
          "If you didn’t request a password reset, you can safely ignore this email. Your password will remain unchanged.",
        help: "Need help?",
      };

  // For Arabic digits spacing sometimes looks odd — keep OTP in LTR block
  const otpDirectionStyle = "direction:ltr;unicode-bidi:bidi-override;";

  return `
  <div style="margin:0;padding:0;background:${theme.pageBg};">
    <div style="max-width:640px;margin:0 auto;padding:36px 16px;font-family:Arial,sans-serif;" dir="${dir}">

      <div style="max-width:560px;margin:0 auto;background:${theme.cardBg};border:1px solid ${theme.border};border-radius:22px;overflow:hidden;box-shadow:0 22px 70px rgba(15,23,42,.12);">

        <!-- Header -->
        <div style="padding:26px 22px 18px;text-align:center;background:linear-gradient(180deg, rgba(24,199,122,.14), rgba(124,255,178,.06));border-bottom:1px solid ${theme.border};">
          <div style="display:inline-block;padding:10px 14px;border-radius:16px;background:${theme.logoBg};border:1px solid ${theme.logoBorder};box-shadow:0 10px 24px rgba(15,23,42,.10);">
            <img
              src="${logoUrl}"
              alt="${escapeHtml(brandName)} logo"
              width="120"
              style="display:block;border:0;outline:none;text-decoration:none;width:120px;max-width:100%;height:auto;object-fit:contain;"
            />
          </div>

          <div style="margin-top:10px;font-size:12px;color:${theme.muted};letter-spacing:.16em;text-transform:uppercase;">
            ${t.badge}
          </div>

          <h1 style="margin:10px 0 0;font-size:20px;line-height:1.25;color:${theme.text};">
            ${t.title}
          </h1>

          <p style="margin:10px auto 0;max-width:440px;font-size:14px;line-height:1.7;color:${theme.muted};">
            ${t.desc}
            <strong style="color:${theme.text};"> ${expiresInMinutes} ${t.minutes}</strong>.
          </p>
        </div>

        <!-- Body -->
        <div style="padding:22px;text-align:center;">

          <div style="margin:0 auto;max-width:460px;padding:18px 14px;border-radius:18px;border:1px solid ${theme.border};background:linear-gradient(180deg, rgba(24,199,122,.10), rgba(124,255,178,.05));box-shadow:0 12px 28px ${theme.glow};">
            <div style="font-size:12px;color:${theme.muted};letter-spacing:.18em;text-transform:uppercase;">
              ${t.codeLabel}
            </div>

            <div style="margin-top:12px;display:inline-block;padding:14px 18px;border-radius:16px;background:#ffffff;border:1px solid ${theme.border};">
              <div style="${otpDirectionStyle} letter-spacing:10px;font-weight:900;font-size:32px;line-height:1;color:${theme.green};">
                ${safeOtp}
              </div>
            </div>

            <div style="margin-top:12px;font-size:12px;color:${theme.muted};">
              ${t.dontShare}
            </div>
          </div>

          <div style="margin:16px auto 0;max-width:460px;padding:14px 14px;border-radius:16px;background:${theme.softPanel};border:1px solid ${theme.border};text-align:${align};">
            <p style="margin:0;font-size:13px;line-height:1.7;color:${theme.muted};">
              ${t.ignore}
            </p>
          </div>

          <div style="margin:18px auto 0;max-width:460px;padding-top:16px;border-top:1px solid ${theme.border};font-size:12px;line-height:1.7;color:${theme.muted};text-align:${align};">
            ${t.help}
            <a href="mailto:${supportEmail}" style="color:${theme.green};text-decoration:none;font-weight:700;">
              ${supportEmail}
            </a>
          </div>

        </div>
      </div>

      <div style="text-align:center;margin-top:14px;color:#94A3B8;font-size:12px;line-height:1.6;">
        <p style="margin:0;">© ${year} ${escapeHtml(brandName)}. All rights reserved.</p>
      </div>

    </div>
  </div>
  `;
};




exports.emailVerificationTemplate = ({ emailToken }) => 
   `
    <div style="font-family: Arial, sans-serif; background-color: #f7f7f7; padding: 20px; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);">
        <div style="background-color: #00c36e; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Hostwover</h1>
          <p style="margin: 0; font-size: 16px;">Verify your account</p>
        </div>
        <div style="padding: 20px;">
          <h2 style="font-size: 22px; color: #333;">Welcome to Hostwover!</h2>
          <p style="font-size: 16px; color: #555;">
            Hi there! Thank you for signing up with Hostwover. You're just one click away from verifying your account. 
          </p>
          <p style="font-size: 16px; color: #555;">
            Click the button below to verify your email and get started:
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.FRONTEND_URL}/email/verify?token=${emailToken}" 
               style="display: inline-block; padding: 15px 30px; font-size: 16px; color: white; background-color: black; border-radius: 5px; text-decoration: none;">
              Verify Your Account
            </a>
          </div>
          <p style="font-size: 16px; color: #555;">
            If you did not sign up for a Hostwover account, please ignore this email or contact our support team for assistance.
          </p>
        </div>
        <div style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #888; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Hostwover. All rights reserved.</p>
        </div>
      </div>
    </div>`;


// Text Template
exports.subscriptionPaymentText = ({ totalPrice, invoiceUrl, customer_name, plan, tierDuration, subscriptionStartDate, subscriptionEndDate }) => 
  `Dear ${customer_name},
  Thank you for subscribing to our ${plan} plan with Ticketeer!

  Here are the details of your subscription:

  - Plan: ${plan}
  - Tier Duration: ${tierDuration}ly
  - Subscription Start Date: ${formatDate(subscriptionStartDate)}
  - Subscription End Date: ${formatDate(subscriptionEndDate)}
  - Total Amount: $${(totalPrice / 100).toFixed(2)} USD
  - Invoice URL: ${invoiceUrl}

  You can view and download your invoice here: ${invoiceUrl}

  We appreciate your business and are excited to have you on board! If you have any questions or need assistance, feel free to reach out to our support team.

  Best regards,
  The Ticketeer Team
`;

// HTML Template
exports.subscriptionPaymentTemplate = ({ totalPrice, invoiceUrl, customer_name, plan, tierDuration, subscriptionStartDate, subscriptionEndDate }) => `
  <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
    <h2 style="text-align: center; color: #007BFF;">Thank You for Subscribing!</h2>
    <p>Dear <strong>${customer_name}</strong>,</p>
    <p style="font-size: 16px;">
      We are thrilled to welcome you to our <strong>${plan}</strong> plan with Ticketeer! Your subscription has been activated successfully, and we are excited to have you on board.
    </p>
    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
      <h3 style="color: #007BFF; text-align: center;">Subscription Details</h3>
      <ul style="list-style-type: none; padding: 0;">
        <li><strong>Plan:</strong> ${plan}</li>
        <li><strong>Tier Duration:</strong> ${tierDuration}ly</li>
        <li><strong>Subscription Start Date:</strong> ${formatDate(subscriptionStartDate)}</li>
        <li><strong>Subscription End Date:</strong> ${formatDate(subscriptionEndDate)}</li>
        <li><strong>Total Amount:</strong> $${(totalPrice / 100).toFixed(2)} USD</li>
        <li><strong>Invoice URL:</strong> <a href="${invoiceUrl}" style="color: #007BFF; text-decoration: none;">View Invoice</a></li>
      </ul>
    </div>
    <p>
      You can view and download your invoice by clicking the button below:
    </p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${invoiceUrl}" style="background-color: #007BFF; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Invoice</a>
    </div>
    <p>
      If you have any questions or need assistance, feel free to reach out to our support team at any time. We're here to help!
    </p>
    <p style="text-align: center; font-size: 14px; color: #777;">
      Best regards,<br/>
      <strong>The Ticketeer Team</strong>
    </p>
  </div>
`;



// Custom Mail Template
exports.subscriptionPaymentTemplate = ({ name }) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header img {
            width: 80%;
            margin: auto 10%;
            border-radius: 8px 8px 0 0;
        }
        .join-us {
            text-align: center;
            margin: 20px 0;
        }
        .join-us a {
            background-color: #ff8f00;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://ticketeer-bucket.s3.amazonaws.com/public/PUBLIC/logo.png" alt="Ticketeer Logo" class="logo">
        </div>

        <h2>Dear ${name},</h2>

        <p>
            Elvouchers is a startup determined to serve all fellow clients with gift vouchers for their favorite stores. If you’re one of the many people who hasn’t already figured out what to get certain people on your list, or simply refuse to shop in a physical store, there’s one solid solution to your holiday gift-giving: Elvouchers.
        </p>
        <p>
            Customers simply visit the platform and select the brand of preference and are given an option to purchase an e-gift card or a physical gift card. Essentially, e-gift cards are delivered digitally through email and consist of a unique identification barcode, which can later be redeemed in-store or on the store website. While physical gift cards are delivered with a courier to a specified destination, and can later be redeemed in-store or on the store website.
        </p>
        <p>
            All participating stores will be provided personalized physical gift cards and e-gift card designs created by the Elvouchers design team. All gift cards processed through the system are subject to a 7.5% fee. Each participating store will receive training on how to operate the system and will be provided with 24/7 customer support by local technical operatives.
        </p>
        
        <div class="join-us">
            <a href=${process.env.FRONTEND_URL}>Join Us Today</a>
        </div>

        <p>
            Warm Regards,<br>
            Nour Abdelaziz<br>
            CEO & Co-Founder of Elvouchers
        </p>

        <div class="footer">
            &copy; 2024 Elvouchers. All rights reserved.
        </div>
    </div>
</body>
</html>
`;