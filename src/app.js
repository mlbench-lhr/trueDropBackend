const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const journalRoutes = require("./routes/journal");
const errorHandler = require("./middleware/errorHandler");

const app = express();
// Add this line to skip body parsing for multipart requests
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
app.use(cors());

app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found" });
});

app.use(errorHandler);

module.exports = app;
