const logger = require("../utils/logger");
const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM =
  process.env.SMTP_FROM || process.env.EMAIL_FROM || "mlbenchpvtltd@gmail.com";

function createTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendVerificationCode(email, code) {
  try {
    logger.info("Attempting to send email to:", email);

    const transporter = createTransport();

    const info = await transporter.sendMail({
      from: SMTP_FROM,
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

    logger.info("Email sent successfully", info.messageId);
    return true;
  } catch (error) {
    logger.error("Email send error:", error.message);
    return false;
  }
}

module.exports = {
  sendVerificationCode,
};
