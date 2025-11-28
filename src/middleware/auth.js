const jwtService = require("../services/jwtService");
const User = require("../models/User");
const connectDB = require("../db/mongo");

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(200).json({
      status: false,
      message: "Your session has been expired, please login again",
      data: null,
    });
  }
  const token = header;
  try {
    await connectDB();
    const decoded = jwtService.verifyAccess(token);
    const user = await User.findById(decoded.userId).select(
      "tokenVersion email"
    );
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "Your session has been expired, please login again",
        data: null,
      });
    }
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(200).json({
        status: false,
        message: "Your session has been expired, please login again",
        data: null,
      });
    }
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };
    return next();
  } catch (err) {
    return res.status(200).json({
      status: false,
      message: "Invalid or expired token",
      data: null,
    });
  }
};
