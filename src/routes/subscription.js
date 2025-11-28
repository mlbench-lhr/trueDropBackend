// routes/payfastRoutes.js
const express = require("express");
const router = express.Router();
const {
  createSubscription,
  handleIPN,
  getSubscriptionStatus,
} = require("../controllers/subscriptionController");

router.post("/subscription/create", createSubscription);
router.post("/payfast/ipn", handleIPN);
router.get("/subscription/status", getSubscriptionStatus);

module.exports = router;
