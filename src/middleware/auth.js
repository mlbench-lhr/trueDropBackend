const jwtService = require("../services/jwtService");

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(200).json({ error: "No token provided" });
  const token = header;
  try {
    const decoded = jwtService.verifyAccess(token);
    req.user = { userId: decoded.userId, email: decoded.email };
    return next();
  } catch (err) {
    return res.status(200).json({ error: "Invalid or expired token" });
  }
};
