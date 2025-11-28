const mongoose = require("mongoose");
const logger = require("../utils/logger");
let isConnected = false;

module.exports = async function connectDB() {
  if (isConnected) return;
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI not provided");
  mongoose.set("strictQuery", false);
  try {
    await mongoose.connect(process.env.MONGO_URI, {});
    isConnected = true;
    logger.info("MongoDB connected");
    mongoose.connection.on("error", (err) =>
      logger.error("MongoDB error", err)
    );
  } catch (err) {
    logger.error("MongoDB connection failed", err);
    throw err;
  }
};
