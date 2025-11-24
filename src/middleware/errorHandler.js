const logger = require("../utils/logger");

module.exports = function (err, req, res, next) {
  logger.error(err);
  if (err && err.name === "ValidationError") {
    return res
      .status(200)
      .json({ status: false, message: err.message, data: [] });
  }
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(200).json({ status: false, message: message, data: null });
};
