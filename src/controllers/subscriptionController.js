// controllers/subscriptionController.js
const crypto = require("crypto");
const axios = require("axios");
const Subscription = require("../models/Subscription");
const User = require("../models/User"); // ✅ Import User model

// PayFast Configuration
const PAYFAST_CONFIG = {
  merchantId: "30891881",
  merchantKey: "tkfsxuucbmqeu",
  passphrase: "Truedrop123456",
  baseUrl: "https://www.payfast.co.za/eng/process", // Production URL
  apiUrl: "https://api.payfast.co.za/subscriptions",
};

// Valid PayFast IP addresses for webhook verification (Production)
const PAYFAST_IPS = [
  "197.97.145.144",
  "197.97.145.145",
  "197.97.145.146",
  "197.97.145.147",
  "197.97.145.148",
];

// Subscription Plans Configuration
const PLANS = {
  free: {
    amount: 0,
    frequency: 0,
    cycles: 0,
    name: "Free Plan",
    isFree: true,
  },
  monthly: {
    amount: 5,
    frequency: 3, // billing frequency in months
    cycles: 0, // 0 = recurring indefinitely
    name: "Monthly Plan",
  },
  premium: {
    amount: 26.99,
    frequency: 3, // billing frequency in months
    cycles: 0,
    name: "Premium Plan",
  },
};

// Helper: Generate PayFast Signature
// CRITICAL: Parameters must be in PayFast's specified order, NOT alphabetically!
const generateSignature = (data, passphrase = "") => {
  let pfOutput = "";

  for (let key in data) {
    if (
      data.hasOwnProperty(key) &&
      data[key] !== "" &&
      data[key] !== null &&
      data[key] !== undefined
    ) {
      // URL encode the value properly
      const encodedValue = encodeURIComponent(
        data[key].toString().trim()
      ).replace(/%20/g, "+");
      pfOutput += `${key}=${encodedValue}&`;
    }
  }

  pfOutput = pfOutput.slice(0, -1);

  if (passphrase) {
    pfOutput += `&passphrase=${encodeURIComponent(passphrase.trim())}`;
  }

  return crypto.createHash("md5").update(pfOutput).digest("hex");
};

// Helper: Verify PayFast IP
const verifyPayFastIP = (ip) => {
  return PAYFAST_IPS.includes(ip);
};

// Helper: Verify PayFast Data
const verifyPayFastData = (pfData, signature, passphrase = "") => {
  const tempData = { ...pfData };
  delete tempData.signature;
  const calculatedSignature = generateSignature(tempData, passphrase);
  return calculatedSignature === signature;
};

// 1. GET SUBSCRIPTION URL
exports.getSubscriptionURL = async (req, res) => {
  try {
    const { userId, planType, deviceType } = req.body;

    // Validate inputs
    if (!userId || !planType) {
      return res.status(400).json({
        success: false,
        message: "userId and planType are required",
      });
    }

    if (!PLANS[planType]) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan type. Choose: free, monthly, or premium",
      });
    }

    // ✅ Fetch real user data from database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Validate user has required data for paid subscriptions
    const plan = PLANS[planType];

    if (!plan.isFree && !user.email) {
      return res.status(400).json({
        success: false,
        message: "User email is required for paid subscriptions",
      });
    }

    // **HANDLE FREE PLAN** - No PayFast needed
    if (plan.isFree) {
      const subscription = await Subscription.create({
        userId,
        plan: planType,
        price: 0,
        currency: "ZAR",
        status: "active", // Free is immediately active
        deviceType: deviceType || "android",
        paymentId: null,
        lastPaymentDate: new Date(),
        nextBillingDate: null, // Free has no billing
      });

      return res.json({
        success: true,
        message: "Free plan activated",
        subscriptionId: subscription._id,
        plan: planType,
        amount: 0,
        paymentUrl: null, // No payment needed
      });
    }

    // **PAID PLANS** - Continue with PayFast
    const subscription = await Subscription.create({
      userId,
      plan: planType,
      price: plan.amount,
      currency: "ZAR",
      status: "pending",
      deviceType: deviceType || "android",
    });

    const subscriptionId = subscription._id || "SUB_" + Date.now();

    // ✅ Use real user data with fallbacks
    const paymentData = {
      merchant_id: PAYFAST_CONFIG.merchantId,
      merchant_key: PAYFAST_CONFIG.merchantKey,
      return_url: `${process.env.FRONTEND_URL}/subscription/success?subscriptionId=${subscriptionId}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel?subscriptionId=${subscriptionId}`,
      notify_url: `${process.env.BACKEND_URL}/api/subscription/webhook`,
      name_first: user.firstName || user.userName || "User",
      name_last: user.lastName || "",
      email_address: user.email,
      m_payment_id: subscriptionId,
      amount: plan.amount.toFixed(2),
      item_name: plan.name,
      item_description: `${plan.name} Subscription`,
      custom_str1: userId,
      custom_str2: planType,
      custom_str3: subscriptionId,
      subscription_type: "1",
      billing_date: new Date().toISOString().split("T")[0],
      recurring_amount: plan.amount.toFixed(2),
      frequency: plan.frequency.toString(),
      cycles: plan.cycles.toString(),
      email_confirmation: "1",
      confirmation_address: user.email,
    };

    const signature = generateSignature(paymentData, PAYFAST_CONFIG.passphrase);
    paymentData.signature = `<${signature}>`;

    const urlParams = new URLSearchParams(paymentData).toString();
    const paymentUrl = `${PAYFAST_CONFIG.baseUrl}?${urlParams}`;

    res.json({
      success: true,
      paymentUrl,
      subscriptionId,
      plan: planType,
      amount: plan.amount,
    });
  } catch (error) {
    console.error("Error generating subscription URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate payment URL",
      error: error.message,
    });
  }
};

// 2. PAYFAST WEBHOOK (ITN - Instant Transaction Notification)
exports.webhook = async (req, res) => {
  try {
    const pfData = req.body;
    const signature = pfData.signature;
    const clientIp =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    console.log("PayFast Webhook Received:", pfData);

    // 1. Verify IP Address
    if (!verifyPayFastIP(clientIp)) {
      console.error("Invalid PayFast IP:", clientIp);
      return res.status(403).send("Invalid IP");
    }

    // 2. Verify Signature
    if (!verifyPayFastData(pfData, signature, PAYFAST_CONFIG.passphrase)) {
      console.error("Invalid signature");
      return res.status(403).send("Invalid signature");
    }

    // 3. Verify payment status with PayFast server
    try {
      const response = await axios.post(
        "https://www.payfast.co.za/eng/query/validate",
        new URLSearchParams(pfData).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      if (response.data !== "VALID") {
        console.error("PayFast validation failed");
        return res.status(400).send("Invalid payment");
      }
    } catch (error) {
      console.error("PayFast validation error:", error);
      return res.status(500).send("Validation failed");
    }

    // 4. Process the payment
    const {
      payment_status,
      custom_str1: userId,
      custom_str2: planType,
      custom_str3: subscriptionId,
      token,
      amount_gross,
      billing_date,
    } = pfData;

    // Update subscription in database
    await Subscription.findByIdAndUpdate(subscriptionId, {
      status: payment_status.toLowerCase(),
      paymentId: token,
      lastPaymentDate: new Date(),
      nextBillingDate: billing_date,
      updatedAt: new Date(),
    });

    // Handle different payment statuses
    switch (payment_status) {
      case "COMPLETE":
        console.log(`Subscription activated for user ${userId}`);
        break;

      case "CANCELLED":
        console.log(`Subscription cancelled for user ${userId}`);
        break;

      case "FAILED":
        console.log(`Payment failed for user ${userId}`);
        break;

      default:
        console.log(`Unknown status: ${payment_status}`);
    }

    // Respond to PayFast
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Webhook processing failed");
  }
};

// 3. CANCEL SUBSCRIPTION
exports.cancelSubscription = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    });

    if (!subscription || !subscription.paymentId) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    const cancelData = {
      merchant_id: PAYFAST_CONFIG.merchantId,
      version: "v1",
      timestamp: new Date().toISOString(),
    };

    const cancelSignature = generateSignature(
      cancelData,
      PAYFAST_CONFIG.passphrase
    );

    try {
      await axios.put(
        `${PAYFAST_CONFIG.apiUrl}/${subscription.paymentId}/cancel`,
        {},
        {
          headers: {
            "merchant-id": PAYFAST_CONFIG.merchantId,
            version: "v1",
            timestamp: cancelData.timestamp,
            signature: cancelSignature,
          },
        }
      );

      await Subscription.findByIdAndUpdate(subscription._id, {
        status: "cancelled",
        cancelledAt: new Date(),
      });

      res.json({
        success: true,
        message: "Subscription cancelled successfully",
      });
    } catch (apiError) {
      console.error("PayFast API error:", apiError.response?.data || apiError);
      res.status(500).json({
        success: false,
        message: "Failed to cancel subscription with PayFast",
        error: apiError.response?.data,
      });
    }
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message,
    });
  }
};

// 4. RENEW SUBSCRIPTION
exports.renewSubscription = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ["expired", "cancelled"] },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No subscription found to renew",
      });
    }

    res.json({
      success: true,
      message: "Please create a new subscription",
      action: "create_new_subscription",
    });
  } catch (error) {
    console.error("Renew subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to renew subscription",
      error: error.message,
    });
  }
};

// 5. GET SUBSCRIPTION
exports.getSubscription = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const subscription = await Subscription.findOne({ userId }).sort({
      createdAt: -1,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No subscription found",
      });
    }

    res.json({
      success: true,
      subscription: {
        deviceType: subscription.deviceType,
        paymentId: subscription.paymentId,
        plan: subscription.plan,
        price: subscription.price,
        currency: subscription.currency,
        status: subscription.status,
        created: subscription.createdAt,
        nextBillingDate: subscription.nextBillingDate,
      },
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get subscription",
      error: error.message,
    });
  }
};
