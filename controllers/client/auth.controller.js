const i18n = require('i18n');
const clientRepo = require("../../models/client/client.repo");
const jwtHelper = require("../../helpers/jwt.helper");
const { sendEmailVerificationLink } = require('../../helpers/emailService.helper');
// const sgMail = require('@sendgrid/mail');
// const { sendEmailVerificationLink } = require('../../helpers/emailService.helper');
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.register = async (req, res) => {
    try {
        // Encrypt password
        const operationResultObject = await clientRepo.create(req.body);
        if (!operationResultObject.success) return res.status(operationResultObject.code).json(operationResultObject)

        const payloadObject = {
            _id: operationResultObject.result._id,
            firstName: operationResultObject.result.firstName,
            lastName: operationResultObject.result.lastName,
            email: operationResultObject.result.email,
            phone:operationResultObject.result.phone,
            image:operationResultObject.result.image,
            isEmailVerified:operationResultObject.result.email,
            isActive:operationResultObject.result.isActive,
            joinDate: operationResultObject.result.joinDate,
            subscriptions: operationResultObject.result.subscriptions,
            role: "client"
        };

        const token = jwtHelper.generateToken(payloadObject, "1d");
        // await clientRepo.updateDirectly(operationResultObject.result._id, { token });
        const resultCopy = JSON.parse(JSON.stringify(operationResultObject.result));

         // Remove sensitive information from the copy
         delete resultCopy.password;
         delete resultCopy.token;
 
        const email = operationResultObject.result.email
          // Create verification token
        const emailToken = jwtHelper.generateToken({ email }, '1h');
        // Send verification email
        await sendEmailVerificationLink({email , emailToken });
        return res.status(202).json({
            success: true,
            code: 201, // 201 for success
            message: i18n.__("Registration successful! Please check your email to verify.")
        });
    } catch (err) {
        console.log(`err.message controller`, err.message);
        return res.status(500).json({
            success: false,
            code: 500,
            error: i18n.__("internalServerError")
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const operationResultObject = await clientRepo.comparePassword(email, password);
        console.log(operationResultObject)

        if (!operationResultObject.success) {
            return res.status(operationResultObject.code).json(operationResultObject);
        }

        // Payload object for the token
        const payloadObject = {
            _id: operationResultObject.result._id,
            firstName: operationResultObject.result.firstName,
            lastName: operationResultObject.result.lastName,
            email: operationResultObject.result.email,
            phone: operationResultObject.result.phone,
            image: operationResultObject.result.image,
            isEmailVerified: operationResultObject.result.isEmailVerified, // Fix: Use correct property for email verification status
            isActive: operationResultObject.result.isActive,
            joinDate: operationResultObject.result.joinDate,
            subscriptions: operationResultObject.result.subscriptions,
            role: "client"
        };

        // Declare token variable outside the blocks to avoid reference errors
        let token;

        // Handle inactive account
        if (!operationResultObject.result.isActive) {
            payloadObject.tokenType = "temp";
            token = jwtHelper.generateToken(payloadObject, "1d");
            await clientRepo.updateDirectly(operationResultObject.result._id, { token });
            delete operationResultObject.result["password"];
            delete operationResultObject.result["token"];
            return res.status(401).json({
                success: false,
                code: 401,
                error: res.__("Your account is inactive. Please contact the administrator."),
            });
        }

        // Handle unverified email
        if (!operationResultObject.result.isEmailVerified) {
            const emailToken = jwtHelper.generateToken({ email: operationResultObject.result.email }, '1h');
            await sendEmailVerificationLink({email , emailToken });
            return res.status(408).json({
                success: false,
                code: 408,
                message: "Email not verified yet, check your mail inbox to verify",
                // token: emailToken // Send the email verification token, not the main token
            });
        }

        // Generate the token for an active and verified user
        token = jwtHelper.generateToken(payloadObject, "1d");
        await clientRepo.updateDirectly(operationResultObject.result._id, { token });
        delete operationResultObject.result["password"];
        delete operationResultObject.result["token"];
        
        return res.status(operationResultObject.code).json({ token, ...operationResultObject, message: i18n.__("loginSuccess") });

    } catch (err) {
        console.log("Error:", err.message);
        return res.status(500).json({
            success: false,
            code: 500,
            error: i18n.__("internalServerError")
        });
    }
};


exports.loginAsGuest = async (req, res) => {
    try {
        let payload = { _id: "guest", nameEn: "Guest", nameAr: "زائر", role: "client" }
        const token = jwtHelper.generateToken(payload);
        return res.status(200).json({ token, success: true, code: 200, result: { ...payload } })

    } catch (err) {
        console.log(`err.message`, err.message);
        return res.status(500).json({
            success: false,
            code: 500,
            error: i18n.__("internalServerError")
        });
    }
}

