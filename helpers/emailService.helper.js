const sgMail = require('@sendgrid/mail');
const jwtHelper = require("../helpers/jwt.helper")
const { supportEmailTemplate, passwordResetEmailTemplate, subscriptionPaymentTemplate, subscriptionPaymentText, emailVerificationTemplate } = require('../utils/emailTemplates');
require('dotenv').config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

require('dotenv').config(); // Load .env variables

const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
      host: 'mail.privateemail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 20000 // 20 seconds
    });
};


const transporter = createTransporter();


exports.sendEmailVerificationLink = async ({ email, emailToken }) => {
  const mailOptions = {
    from: 'Hostwover Team <info@hostwover.com>', // Display name + email
    to: email,
    subject: 'Email Verification',
    text: `Please click the following link to verify your email: ${emailToken}`,
    html: `<p>Please click the following link to verify your email: <a href="${emailToken}">${emailToken}</a></p>`,
    html: emailVerificationTemplate({ emailToken }), // Use imported template

  };
  try {
      // Send the email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
        console.log('Error details: ', error); // Log the detailed error for debugging
        return res.status(500).send('Error sending email.');
        }
        return {
          success: true,
          code: 201, // 201 for success
          message: i18n.__("Registration successful! Please check your email to verify.")
        };
      });
  } catch (error) {
      console.error('Error sending email:', error.response.body); // Log the detailed error
      return {
          success: false,
          code: 500, // Return 500 for any email sending failure
          message: 'Failed to send email',
      };
  }
};



exports.sendSupportEmailToCompany = async ({ name, company, email, phone, inquiryType, message }) => {
  const msg = {
      to: 'info@blue202labs.com',
      from: {
        email: 'info@blue202labs.com', // Your verified email address
        name: 'Ticketeer Support' // The display name you want to show
      },
      subject: 'New Support Request',
      html: supportEmailTemplate({ name, company, email, phone, inquiryType, message }), // Use imported template
  };
  
  try {
      await sgMail.send(msg);
      return {
          success: true,
          code: 201, // 201 for success
          message: 'Email sent successfully',
      };
  } catch (error) {
      console.error('Error sending email:', error.response.body); // Log the detailed error
      return {
          success: false,
          code: 500, // Return 500 for any email sending failure
          message: 'Failed to send email',
      };
  }
};


exports.sendPasswordResetEmailToClient = async ({ email }) => {
  const token = jwtHelper.generateToken({email}, "1d")
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const msg = {
    to: email,
    from: {
      email: 'info@blue202labs.com', // Your verified email address
      name: 'Ticketeer Team' // The display name you want to show
    },
    subject: 'Password Reset Request',
    text: `You have requested to reset your password. Please click the button below to reset your password. This link is valid for 1 hour.`,
    html: passwordResetEmailTemplate({ resetLink }), // Use imported template
};
  try {
      await sgMail.send(msg);
      return {
        success: true,
        code: 201, // 201 for success
        message: 'Email sent successfully',
    };
  } catch (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, code: 500, message: 'Failed to send password reset email.' };
  }
};
exports.sendSubscriptionPaymentEmail = async ({ totalPrice, invoiceUrl, customer_name, email, plan, tierDuration, subscriptionStartDate, subscriptionEndDate  }) => {
  const msg = {
    to: email,
    from: {
      email: 'info@blue202labs.com', // Your verified email address
      name: 'Ticketeer Team' // The display name you want to show
    },
    subject: 'Ticketeer Subscription Payment Confirmation',
    text:subscriptionPaymentText({totalPrice, invoiceUrl, customer_name, plan, tierDuration, subscriptionStartDate, subscriptionEndDate}),
    html: subscriptionPaymentTemplate({totalPrice, invoiceUrl, customer_name, plan, tierDuration, subscriptionStartDate, subscriptionEndDate})
    };

  try {
    await sgMail.send(msg);
    return {
      success: true,
      code: 201, // 201 for success
      message: 'Email sent successfully',
    };
  } catch (error) {
    console.error('Error sending subscription payment email:', error);
    return { success: false, code: 500, message: 'Failed to send subscription payment email.' };
  }
};


// __________________________________________________________________________________________________//

exports.sendMultipleEmails = async ({ data }) => {
  // Extract email addresses and send emails
  const emailPromises = data.map(async (row) => {
    if (row.email) { // Ensure the email field exists
      const msg = {
        to: row.email,
        from: {
          email: 'info@blue202labs.com', // Your verified email address
          name: 'Ticketeer Team' // The display name you want to show
        },
        subject: 'Invitation',
        text: `Hi ${row.firstName},\n\nElvouchers offers gift vouchers for your favorite stores. Join us today for a seamless shopping experience!`,
        html: subscriptionPaymentTemplate({ name: row.firstName + ' ' + row.lastName })
      };

      try {
        await sgMail.send(msg);
        console.log(`Email sent to ${row.email}`);
      } catch (error) {
        console.error(`Error sending email to ${row.email}:`, error);
      }
    }
  });

  try {
    await Promise.all(emailPromises);
    return { success: true, message: 'Emails sent successfully.' };
  } catch (error) {
    console.error('Error processing emails:', error);
    return { success: false, message: 'Error processing emails.' };
  }
};
