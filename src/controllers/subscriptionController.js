// controllers/payfastController.js
import { generateSignature, validateIPNSignature } from "../../lib/payfast.js";
import { Subscription } from "../models/Subscription.js";
import connectDB from "../db/mongo.js";

const {
  PAYFAST_MERCHANT_ID,
  PAYFAST_MERCHANT_KEY,
  PAYFAST_PASSPHRASE,
  PAYFAST_RETURN_URL,
  PAYFAST_CANCEL_URL,
  PAYFAST_NOTIFY_URL,
} = process.env;

/* =========================================================
   1. CREATE SUBSCRIPTION & GET PAYMENT URL
   ========================================================= */
export const createSubscription = async (req, res) => {
  try {
    await connectDB();
    const { userId, planId, amount } = req.body;

    const subscription = await Subscription.create({
      userId,
      planId,
      amount,
      status: "PENDING",
    });

    const params = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: PAYFAST_RETURN_URL,
      cancel_url: PAYFAST_CANCEL_URL,
      notify_url: PAYFAST_NOTIFY_URL,
      amount,
      item_name: "Subscription",
      subscription_type: 1,
      billing_date: new Date().toISOString().split("T")[0],
      recurring_amount: amount,
      frequency: 3, // monthly
      cycles: 0, // unlimited
      custom_int1: subscription._id.toString(),
    };

    params.signature = generateSignature(params, PAYFAST_PASSPHRASE);

    const queryString = Object.keys(params)
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join("&");

    return res.json({
      paymentUrl: `https://sandbox.payfast.co.za/eng/process?${queryString}`,
      subscriptionId: subscription._id,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to create subscription" });
  }
};

/* =========================================================
   2. IPN HANDLER (PayFast → Backend)
   ========================================================= */
export const handleIPN = async (req, res) => {
  try {
    await connectDB();
    const ipnData = req.body;

    const isValid = validateIPNSignature(ipnData, PAYFAST_PASSPHRASE);
    if (!isValid) return res.status(400).send("Invalid signature");

    const subscriptionId = ipnData.custom_int1;
    const paymentStatus = ipnData.payment_status;

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) return res.status(404).send("Subscription not found");

    // Update based on PayFast status
    if (paymentStatus === "COMPLETE") {
      subscription.status = "ACTIVE";
    } else if (paymentStatus === "CANCELLED") {
      subscription.status = "CANCELLED";
    }

    subscription.paymentHistory.push(ipnData);
    await subscription.save();

    return res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("IPN Error");
  }
};

/* =========================================================
   3. GET USER SUBSCRIPTION STATUS
   ========================================================= */
export const getSubscriptionStatus = async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.query;

    const subscription = await Subscription.findOne({ userId }).sort({
      createdAt: -1,
    });

    if (!subscription) return res.json({ status: "NO_SUBSCRIPTION" });

    return res.json({
      status: subscription.status,
      planId: subscription.planId,
      subscriptionId: subscription._id,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch status" });
  }
};
