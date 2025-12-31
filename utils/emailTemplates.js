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

exports.passwordResetEmailTemplate = ({ resetLink }) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #0046B3;">Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password. Please click the button below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
    <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
    <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; margin-top: 20px; background-color: #007BFF; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Your Password</a>
    <p style="margin-top: 20px;">If the button doesn't work, please copy and paste the following link into your browser:</p>
    <p><a href="${resetLink}" style="color: #007BFF;">${resetLink}</a></p>
    <p>Thank you,</p>
    <p>The Blue202 Labs Team</p>
  </div>
`;




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