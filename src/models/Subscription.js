// models/Subscription.js (MongoDB Schema Example)
const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  deviceType: { type: String, enum: ["android", "apple"], required: false },
  paymentId: { type: String }, // PayFast token
  plan: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: "ZAR" },
  status: {
    type: String,
    enum: ["pending", "active", "cancelled", "expired", "failed"],
    default: "pending",
  },
  nextBillingDate: { type: Date },
  lastPaymentDate: { type: Date },
  cancelledAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
