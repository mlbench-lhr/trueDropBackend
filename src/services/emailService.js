const { Resend } = require("resend");
const logger = require("../utils/logger");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationCode(email, code) {
  try {
    logger.info("Attempting to send email to:", email);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "mlbenchpvtltd@gmail.com",
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
    logger.info("Email sent successfully");
    return true;
  } catch (error) {
    logger.error("Email send error:", error.message);
    return false;
  }
}

module.exports = {
  sendVerificationCode,
};
