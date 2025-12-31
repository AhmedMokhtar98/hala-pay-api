const { sendSupportEmailToCompany, sendPasswordResetEmailToClient } = require("../../helpers/emailService.helper");
const clientRepo = require("../../models/client/client.repo");
const UserModel = require("../../models/client/client.model")
const bcrypt = require('bcrypt');
let jwt = require("jsonwebtoken")

const i18n = require('i18n');
exports.support = async (req, res) => {
    try {
        const { name, company, email, phone, inquiryType, message } = req.body;
        const result = await sendSupportEmailToCompany({ name, company, email, phone, inquiryType, message });
        console.log("result", result);

        // Use result.code as the status code, and result as the body
        if (result.success) {
            return res.status(result.code || 200).json(result); // Return the status code from result
        } else {
            return res.status(500).json(result); // Handle email failure
        }
    } catch (err) {
        console.log(`err.message`, err.message);
        return res.status(500).json({
            success: false,
            code: 500,
            error: i18n.__("internalServerError"),
        });
    }
};



exports.passwordResetRequest = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if the email exists in the database
        const user = await clientRepo.get({ email }, { password: 0 });
        // const user = await clientRepo.findOne({ email }); // Modify based on your database setup (e.g., MongoDB, Sequelize)
        if (user?.code === 404) {
            return res.status(user.code).json(user);
        }
        // Email exists, proceed to send the password reset email
        const result = await sendPasswordResetEmailToClient({ email });
        // Use result.code as the status code, and result as the body
        if (result.success) {
            return res.status(result.code || 200).json(result); // Return the status code from result
        } else {
            return res.status(500).json(result); // Handle email failure
        }
    } catch (err) {
        console.log(`err.message`, err.message);
        return res.status(500).json({
            success: false,
            code: 500,
            error: i18n.__("internalServerError"),
        });
    }
};



// Reset password with a valid JWT token

exports.resetPassword = async (req, res) => {
    const { token } = req.query;  // The token is passed via query string
    const { newPassword } = req.body;

    try {
        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        const email = decoded.email;

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 5); // 5 is the salt rounds

        // Update the user's password in the database using findOneAndUpdate
        const user = await UserModel.findOneAndUpdate(
            { email }, // Query to find the user by email
            { $set: { password: hashedPassword } }, // Update the password field
            { new: true } // Return the updated document
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('Password reset successfully for user:', email);
        return res.status(200).json({ success: true, message: 'Password reset successfully.' });
    } catch (err) {
        console.error('Error resetting password:', err);
        return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    }
};



exports.emailVerify = async (req, res) => {
    try {
      const token = req.query.token;
  
      // Decode and verify the token
      const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
  
      // Find the user by email from the decoded token
      let user = await UserModel.findOne({ email: decoded.email });
  
      if (!user) { return res.status(400).json({ success: false, message: 'Invalid token' }); }
  
      // Check if the email is already verified
      if (user.isEmailVerified) { return res.status(200).json({ success: true, message: 'Email is already verified' }); }
      
      // Update only the isEmailVerified field
      await UserModel.updateOne(
        { email: decoded.email }, 
        { $set: { isEmailVerified: true } }  // Use update to prevent modifying other fields
      );
  
      // Respond with success
      return res.status(200).json({ success: true, message: "Email verified successfully" });
      
    } catch (error) {
      console.error(error); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  };