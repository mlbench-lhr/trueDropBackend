const jwt = require("jsonwebtoken");

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not defined`);
  return v;
}

const ACCESS_SECRET = () => getEnv("JWT_ACCESS_SECRET");
const ACCESS_EXPIRES = () => process.env.ACCESS_TOKEN_EXPIRES_IN || "7d";

function signAccess(payload) {
  if (!payload || !payload.userId)
    throw new Error("Invalid payload for access token");
  return jwt.sign(payload, ACCESS_SECRET(), { expiresIn: ACCESS_EXPIRES() });
}


function verifyAccess(token) {
  if (!token) throw new Error("Token required");
  return jwt.verify(token, ACCESS_SECRET());
}

module.exports = { signAccess, verifyAccess };
