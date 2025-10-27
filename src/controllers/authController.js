const User = require("../models/User");
const passwordService = require("../services/passwordService");
const jwtService = require("../services/jwtService");
const logger = require("../utils/logger");
const emailService = require("../services/emailService");
const crypto = require("crypto");
const Fields = require("../models/Fields");

// Traditional Email/Password Registration
async function register(req, res, next) {
  try {
    const { email, password, name, alcoholType, improvement, goal } = req.body;

    // Validate required fields
    if (!email || !password || !name || !alcoholType || !improvement || !goal) {
      return res.status(400).json({
        status: false,
        message:
          "All fields are required (email, password, name, alcoholType, improvement, goal)",
        data: null,
      });
    }

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        status: false,
        message: "Email already registered",
        data: null,
      });
    }

    // Hash password and create user
    const passwordHash = await passwordService.hashPassword(password);
    const user = await User.create({
      email,
      passwordHash,
      name,
      alcoholType,
      improvement,
      goal,
      provider: "local",
      isEmailVerified: false,
    });

    // Generate tokens
    const alcoholField = await Fields.findById(user.alcoholType).lean();
    const improvementFields = await Fields.find({
      _id: { $in: user.improvement },
    }).lean();

    const alcoholTypeName = alcoholField ? alcoholField.name : null;
    const improvementNames = improvementFields.map((f) => f.name);
    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = jwtService.signAccess(payload);
    const refreshToken = jwtService.signRefresh(payload);

    return res.status(201).json({
      status: true,
      message: "User registered successfully",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          alcoholType: alcoholTypeName,
          improvement: improvementNames,
          goal: user.goal,
          provider: user.provider,
          profilePicture: user.profilePicture,
        },
        token: accessToken,
      },
    });
  } catch (err) {
    logger.error("Register error", err);
    next(err);
  }
}

// Traditional Email/Password Login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: false,
        message: "Email and password required",
        data: null,
      });
    }

    // Find user and verify it's a local account
    const user = await User.findOne({ email, provider: "local" });
    if (!user) {
      return res.status(401).json({
        status: false,
        message: "Invalid credentials",
        data: null,
      });
    }

    // Compare password
    const match = await passwordService.comparePassword(
      password,
      user.passwordHash
    );
    if (!match) {
      return res.status(401).json({
        status: false,
        message: "Invalid credentials",
        data: null,
      });
    }

    // Generate tokens
    const alcoholField = await Fields.findById(user.alcoholType).lean();
    const improvementFields = await Fields.find({
      _id: { $in: user.improvement },
    }).lean();

    const alcoholTypeName = alcoholField ? alcoholField.name : null;
    const improvementNames = improvementFields.map((f) => f.name);
    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = jwtService.signAccess(payload);

    return res.status(200).json({
      status: true,
      message: "Login successful",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          alcoholType: alcoholTypeName,
          improvement: improvementNames,
          goal: user.goal,
          provider: user.provider,
          profilePicture: user.profilePicture,
        },
        token: accessToken,
      },
    });
  } catch (err) {
    logger.error("Login error", err);
    next(err);
  }
}

// SOCIAL AUTH
async function socialAuth(req, res, next) {
  try {
    const {
      provider,
      providerId,
      email,
      name,
      profilePicture,
      alcoholType,
      improvement,
      goal,
    } = req.body;

    // Check if user exists
    let user = await User.findOne({ provider, providerId });
    let message, statusCode;

    if (!user) {
      // Try matching by email
      const existingByEmail = await User.findOne({ email });

      if (existingByEmail) {
        return res.status(409).json({
          status: false,
          message: `Email already registered with ${existingByEmail.provider} provider`,
          data: null,
        });
      }

      // If required registration fields are missing
      if (!name || !alcoholType || !improvement || !goal) {
        return res.status(400).json({
          status: false,
          message:
            "New users must provide name, alcoholType, improvement, and goal",
          data: null,
        });
      }

      // Register new user
      user = await User.create({
        email,
        name,
        provider,
        providerId,
        profilePicture,
        alcoholType,
        improvement,
        goal,
        isEmailVerified: true,
      });

      message = "User registered successfully";
      statusCode = 201;
    } else {
      message = "Login successful";
      statusCode = 200;
    }

    // Get readable field names
    const alcoholField = await Fields.findById(user.alcoholType).lean();
    const improvementFields = await Fields.find({
      _id: { $in: user.improvement },
    }).lean();

    const alcoholTypeName = alcoholField ? alcoholField.name : null;
    const improvementNames = improvementFields.map((f) => f.name);

    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = jwtService.signAccess(payload);

    return res.status(statusCode).json({
      status: true,
      message,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          alcoholType: alcoholTypeName,
          improvement: improvementNames,
          goal: user.goal,
          provider: user.provider,
          profilePicture: user.profilePicture,
        },
        token: accessToken,
      },
    });
  } catch (err) {
    logger.error("Social auth error", err);
    next(err);
  }
}
module.exports = { login, socialAuth };

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res
        .status(400)
        .json({ status: false, message: "Refresh token required", data: null });

    let decoded;
    try {
      decoded = jwtService.verifyRefresh(refreshToken);
    } catch (e) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid refresh token", data: null });
    }

    const user = await User.findById(decoded.userId);
    if (!user)
      return res
        .status(401)
        .json({ status: false, message: "User not found", data: null });

    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = jwtService.signAccess(payload);
    const newRefreshToken = jwtService.signRefresh(payload);

    return res.status(200).json({
      status: true,
      message: "Token refreshed successfully",
      data: {
        token: accessToken,
      },
    });
  } catch (err) {
    logger.error("Refresh error", err);
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res
        .status(400)
        .json({ status: false, message: "Refresh token required", data: null });

    try {
      jwtService.verifyRefresh(refreshToken);
    } catch (e) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid refresh token", data: null });
    }

    return res
      .status(200)
      .json({ status: true, message: "Logged out successfully", data: null });
  } catch (err) {
    logger.error("Logout error", err);
    next(err);
  }
}

// Send verification code
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    logger.info("Forgot password request for:", email);

    if (!email) {
      return res.status(400).json({
        status: false,
        message: "Email is required",
        data: null,
      });
    }

    const user = await User.findOne({ email, provider: "local" });
    logger.info("User found:", !!user);
    if (!user) {
      // For security, don't reveal if email exists
      return res.status(200).json({
        status: true,
        message: "If the email exists, a verification code has been sent",
        data: null,
      });
    }

    // Generate 6-digit code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Hash the code before storing
    const hashedCode = crypto
      .createHash("sha256")
      .update(verificationCode)
      .digest("hex");

    // Set expiry to 10 minutes
    user.resetPasswordToken = hashedCode;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    logger.info("Token saved, sending email...");

    // Send email
    const emailSent = await emailService.sendVerificationCode(
      email,
      verificationCode
    );
    logger.info("Email sent:", emailSent);

    if (!emailSent) {
      return res.status(500).json({
        status: false,
        message: "Failed to send verification code. Please try again.",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Verification code sent to your email",
      data: null,
    });
  } catch (err) {
    logger.error("Forgot password error", err);
    next(err);
  }
}

// Verify code
async function verifyResetCode(req, res, next) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        status: false,
        message: "Email and verification code are required",
        data: null,
      });
    }

    const user = await User.findOne({
      email,
      provider: "local",
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired verification code",
        data: null,
      });
    }

    // Hash the provided code and compare
    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

    if (hashedCode !== user.resetPasswordToken) {
      return res.status(400).json({
        status: false,
        message: "Invalid verification code",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Verification code is valid",
      data: { email },
    });
  } catch (err) {
    logger.error("Verify reset code error", err);
    next(err);
  }
}

// Reset password
async function resetPassword(req, res, next) {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        status: false,
        message: "Email, verification code, and new password are required",
        data: null,
      });
    }

    const user = await User.findOne({
      email,
      provider: "local",
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired verification code",
        data: null,
      });
    }

    // Verify code
    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

    if (hashedCode !== user.resetPasswordToken) {
      return res.status(400).json({
        status: false,
        message: "Invalid verification code",
        data: null,
      });
    }

    // Update password
    user.passwordHash = await passwordService.hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Password reset successfully",
      data: null,
    });
  } catch (err) {
    logger.error("Reset password error", err);
    next(err);
  }
}

// Add to module.exports
module.exports = {
  register,
  login,
  logout,
  refresh,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  socialAuth,
};
