const jwt = require("jsonwebtoken");

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not defined`);
  return v;
}

const ACCESS_SECRET = () => getEnv("JWT_ACCESS_SECRET");
const REFRESH_SECRET = () => getEnv("JWT_REFRESH_SECRET");
const ACCESS_EXPIRES = () => process.env.ACCESS_TOKEN_EXPIRES_IN || "7d";
const REFRESH_EXPIRES = () => process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

function signAccess(payload) {
  if (!payload || !payload.userId)
    throw new Error("Invalid payload for access token");
  return jwt.sign(payload, ACCESS_SECRET(), { expiresIn: ACCESS_EXPIRES() });
}

function signRefresh(payload) {
  if (!payload || !payload.userId)
    throw new Error("Invalid payload for refresh token");
  return jwt.sign(payload, REFRESH_SECRET(), { expiresIn: REFRESH_EXPIRES() });
}

function verifyAccess(token) {
  if (!token) throw new Error("Token required");
  return jwt.verify(token, ACCESS_SECRET());
}

function verifyRefresh(token) {
  if (!token) throw new Error("Token required");
  return jwt.verify(token, REFRESH_SECRET());
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
