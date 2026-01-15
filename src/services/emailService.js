const logger = require("../utils/logger");
const { Resend } = require("resend");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM || process.env.SMTP_FROM || "mlbenchpvtltd@gmail.com";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
console.log("resend-----", resend);

async function sendVerificationCode(email, code) {
  try {
    logger.info("Attempting to send email to:", email);

    if (!resend) {
      logger.error("Resend client not initialized. Missing RESEND_API_KEY.");
      return false;
    }

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Password Reset Verification Code",
      html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Use the verification code below:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
    });
    const res = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Password Reset Verification Code",
      html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Use the verification code below:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
    });
    console.log("res------", res);

    if (error) {
      logger.error("Email send error:", error.message || error);
      return false;
    }

    logger.info("Email sent successfully", data && data.id);
    return true;
  } catch (error) {
    logger.error("Email send error:", error.message);
    return false;
  }
}

module.exports = {
  sendVerificationCode,
};
