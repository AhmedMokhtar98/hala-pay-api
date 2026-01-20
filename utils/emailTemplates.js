// emailTemplates.js
const moment = require('moment');
require('dotenv').config();

// Utility function to format ISO date using Moment.js
const formatDate = (isoDate) => {
  return moment(isoDate).format('DD/MM/YYYY');
};

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

// utils/emailTemplates.js (or wherever you keep templates)
// utils/emailTemplates.js

exports.otpPasswordResetEmailTemplate = ({
  otp,
  expiresInMinutes = 5,
  brandName = "YallaPay",
  supportEmail = "It@yallapayapp.com",
  // ✅ Put your public logo URL here (must be an absolute URL for email clients)
  // Example: https://api.yallapayapp.com/images/logo.png
  logoUrl = process.env.APP_PUBLIC_URL + "/public/logo.png",
  // ✅ Theme (black + light green)
  theme = {
    bg: "#050B07",          // near-black background
    card: "#0B120D",        // dark card
    border: "#163021",      // dark green border
    text: "#E7F7EE",        // soft light text
    muted: "#A7C8B6",       // muted green/gray
    green: "#7CFFB2",       // light green accent
    greenDark: "#18C77A",   // stronger green
  },
}) => {
  const code = String(otp || "").trim();
  const safeOtp = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const year = new Date().getFullYear();

  return `
  <div style="margin:0;padding:0;background:${theme.bg};">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">

      <!-- Header / Brand -->
      <div style="text-align:center;margin-bottom:16px;font-family:Arial,sans-serif;">
        <div style="display:inline-block;padding:10px 14px;border-radius:14px;background:rgba(124,255,178,.08);border:1px solid ${theme.border};">
          <img
            src="${logoUrl}"
            alt="${brandName} logo"
            width="120"
            style="display:block;width:120px;max-width:100%;height:auto;object-fit:contain;"
          />
        </div>
        <div style="margin-top:10px;font-size:13px;color:${theme.muted};letter-spacing:.2px;">
          ${brandName}
        </div>
      </div>

      <!-- Card -->
      <div style="background:${theme.card};border:1px solid ${theme.border};border-radius:16px;padding:22px;box-shadow:0 14px 40px rgba(0,0,0,.35);font-family:Arial,sans-serif;color:${theme.text};">

        <!-- Title -->
        <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:${theme.text};">
          Password reset code
        </h2>

        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${theme.muted};">
          We received a request to reset your password. Use the code below to continue.
        </p>

        <!-- OTP Box -->
        <div style="text-align:center;margin:18px 0 10px;">
          <div style="display:inline-block;padding:14px 18px;border-radius:14px;background:rgba(124,255,178,.10);border:1px solid ${theme.border};">
            <div style="letter-spacing:8px;font-weight:900;font-size:28px;color:${theme.green};">
              ${safeOtp}
            </div>
          </div>

          <p style="margin:12px 0 0;font-size:13px;color:${theme.muted};">
            This code expires in
            <strong style="color:${theme.text};">${expiresInMinutes} minutes</strong>.
          </p>
        </div>

        <!-- Security note -->
        <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(24,199,122,.08);border:1px solid ${theme.border};">
          <p style="margin:0;font-size:13px;line-height:1.6;color:${theme.muted};">
            If you didn’t request this, you can safely ignore this email — your password will remain unchanged.
          </p>
        </div>

        <hr style="border:none;border-top:1px solid rgba(124,255,178,.14);margin:18px 0;" />

        <!-- Help -->
        <div style="font-size:12px;line-height:1.7;color:${theme.muted};">
          Need help? Contact us at
          <a href="mailto:${supportEmail}" style="color:${theme.green};text-decoration:none;font-weight:700;">
            ${supportEmail}
          </a>
        </div>

      </div>

      <!-- Footer -->
      <div style="text-align:center;font-family:Arial,sans-serif;margin-top:14px;color:rgba(167,200,182,.75);font-size:12px;line-height:1.6;">
        <p style="margin:0;">© ${year} ${brandName}. All rights reserved.</p>
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