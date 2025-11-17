const express = require("express");
const router = express.Router();
const notificationsController = require("../controllers/notificationsController");
const auth = require("../middleware/auth");

router.post(
  "/send-notification",
  auth,
  notificationsController.sendNotification
);
router.get("/all-notifications", auth, notificationsController.getNotification);

module.exports = router;
