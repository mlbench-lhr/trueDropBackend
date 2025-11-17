const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const journalRoutes = require("./routes/journal");
const copingRoutes = require("./routes/coping");
const milestoneRoutes = require("./routes/milestones");
const walletRoutes = require("./routes/wallet");
const podRoutes = require("./routes/pod");
const notificationRoutes = require("./routes/notifications");
const errorHandler = require("./middleware/errorHandler");

const app = express();
app.use((req, res, next) => {
  if (req.is("multipart/form-data")) {
    console.log("this------");
    return next();
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/journal", journalRoutes);
app.use("/api/coping", copingRoutes);
app.use("/api/milestone", milestoneRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/pod", podRoutes);
app.use("/api/notifications", notificationRoutes);
app.use(cors());

app.use((req, res, next) => {
  res.status(404).json({ error: "404 Not Found" });
});

app.use(errorHandler);

module.exports = app;
