const logger = require("../utils/logger");

module.exports = function (err, req, res, next) {
  logger.error(err);
  if (err && err.name === "ValidationError") {
    return res
      .status(200)
      .json({ error: "ValidationError", details: err.message });
  }
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ error: message });
};
