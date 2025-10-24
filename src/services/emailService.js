const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || smtp.gmail.com,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "mlbenchpvtltd@gmail.com",
    pass: process.env.SMTP_PASS || "dgfs cswg wlsq axbw",
  },
});

async function sendVerificationCode(email, code) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Truedrop" <mlbenchpvtltd@gmail.com>',
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
    return true;
  } catch (error) {
    logger.error("Email send error", error);
    return false;
  }
}

module.exports = {
  sendVerificationCode,
};
