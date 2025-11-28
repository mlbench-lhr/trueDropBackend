// models/Subscription.js
import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    planId: { type: String, required: true },
    amount: Number,
    status: { type: String, default: "PENDING" }, // PENDING / ACTIVE / CANCELLED / FAILED
    payfastId: String,
    paymentHistory: Array,
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
