// routes/subscription.js
const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscriptionController");

router.post("/getSubscriptionURL", subscriptionController.getSubscriptionURL);
router.post("/webhook", subscriptionController.webhook);
router.post("/cancelSubscription", subscriptionController.cancelSubscription);
router.post("/renewSubscription", subscriptionController.renewSubscription);
router.get("/getSubscription", subscriptionController.getSubscription);
router.post("/addSubscription", subscriptionController.addSubscription);
router.get("/getAllSubscriptions", subscriptionController.getAllSubscription);

module.exports = router;
