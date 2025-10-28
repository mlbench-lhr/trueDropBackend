const logger = require("../utils/logger");

const BREVO_API_KEY = process.env.BREVO_API_KEY; // Add to .env
const EMAIL_FROM = process.env.EMAIL_FROM || "mlbenchpvtltd@gmail.com";

async function sendVerificationCode(email, code) {
  try {
    logger.info("Attempting to send email to:", email);

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: EMAIL_FROM, name: "ML Bench" },
        to: [{ email }],
        subject: "Password Reset Verification Code",
        htmlContent: `
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
      }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message || "Failed to send email");

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
