const bcrypt = require("bcryptjs");
const SALT_ROUNDS = 12;

function validatePasswordInput(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be string with minimum length 8');
  }
}

async function hashPassword(password) {
  validatePasswordInput(password);
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  if (typeof hash !== 'string' || !hash) throw new Error('Invalid hash');
  validatePasswordInput(password);
  return await bcrypt.compare(password, hash);
}

module.exports = { hashPassword, comparePassword };
