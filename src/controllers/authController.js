const User = require("../models/User");
const passwordService = require("../services/passwordService");
const jwtService = require("../services/jwtService");
const logger = require("../utils/logger");

async function register(req, res, next) {
  try {
    const { email, password, name, alcoholType, improvement, createdAt, goal } =
      req.body;

    if (!email || !password)
      return res.status(400).json({
        status: false,
        message: "Email and password required",
        data: null,
      });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({
        status: false,
        message: "Email already registered",
        data: null,
      });

    const passwordHash = await passwordService.hashPassword(password);
    const user = await User.create({
      email,
      passwordHash,
      name,
      alcoholType,
      improvement,
      createdAt,
      goal,
    });

    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = jwtService.signAccess(payload);
    const refreshToken = jwtService.signRefresh(payload);

    return res.status(201).json({
      status: true,
      message: "User registered successfully",
      data: {
        user,
        tokens: {
          accessToken,
          expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "7d",
        },
      },
    });
  } catch (err) {
    logger.error("Register error", err);
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({
        status: false,
        message: "Email and password required",
        data: null,
      });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(401)
        .json({ status: false, message: "Invalid credentials", data: null });

    const match = await passwordService.comparePassword(
      password,
      user.passwordHash
    );
    if (!match)
      return res
        .status(401)
        .json({ status: false, message: "Invalid credentials", data: null });

    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = jwtService.signAccess(payload);
    const refreshToken = jwtService.signRefresh(payload);

    return res.status(200).json({
      status: true,
      message: "Login successful",
      data: {
        user: user,
        tokens: {
          accessToken,
          expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "7d",
        },
      },
    });
  } catch (err) {
    logger.error("Login error", err);
    next(err);
  }
}

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
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "7d",
        },
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

module.exports = { register, login, refresh, logout };
