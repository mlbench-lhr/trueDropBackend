// controllers/subscriptionController.js
const crypto = require("crypto");
const axios = require("axios");
const Subscription = require("../models/Subscription");

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
  "3-day": { amount: 9.99, frequency: 3, cycles: 0, name: "3-Day Trial" },
  monthly: { amount: 5, frequency: 3, cycles: 0, name: "Monthly Plan" },
  yearly: { amount: 299.99, frequency: 6, cycles: 0, name: "Yearly Plan" },
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
    const { userId, planType } = req.body;

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
        message: "Invalid plan type. Choose: 3-day, monthly, or yearly",
      });
    }

    const plan = PLANS[planType];

    // Get user details from your database
    // const user = await User.findById(userId);
    // For now, using placeholder
    const user = {
      email: "user@example.com", // Replace with actual user email
      firstName: "John",
      lastName: "Doe",
    };

    // Create subscription in your database first
    const subscription = await Subscription.create({
      userId,
      plan: planType,
      price: plan.amount,
      currency: "ZAR",
      status: "pending",
      deviceType: req.body.deviceType || "android",
    });

    const subscriptionId = subscription._id || "SUB_" + Date.now();

    // CRITICAL: Build payment data in PayFast's EXACT order
    // Order matters! Follow https://developers.payfast.co.za/docs#step_1_form_fields
    const paymentData = {
      // Merchant details (MUST be first)
      merchant_id: PAYFAST_CONFIG.merchantId,
      merchant_key: PAYFAST_CONFIG.merchantKey,

      // URLs
      return_url: `${process.env.FRONTEND_URL}/subscription/success?subscriptionId=${subscriptionId}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel?subscriptionId=${subscriptionId}`,
      notify_url: `${process.env.BACKEND_URL}/api/subscription/webhook`,

      // Buyer details
      name_first: user.firstName,
      name_last: user.lastName,
      email_address: user.email,

      // Transaction details
      m_payment_id: subscriptionId,
      amount: plan.amount.toFixed(2),
      item_name: plan.name,
      item_description: `${plan.name} Subscription`,

      // Custom fields
      custom_str1: userId,
      custom_str2: planType,
      custom_str3: subscriptionId,

      // Subscription-specific fields
      subscription_type: "1",
      billing_date: new Date().toISOString().split("T")[0],
      recurring_amount: plan.amount.toFixed(2),
      frequency: plan.frequency.toString(),
      cycles: plan.cycles.toString(),

      // Email confirmations
      email_confirmation: "1",
      confirmation_address: user.email,
    };

    // Generate signature AFTER building the complete data object
    // Generate signature
    const signature = generateSignature(paymentData, PAYFAST_CONFIG.passphrase);

    // LOG BOTH SIGNATURES (using RAW values like the function does)
    console.log("=== SIGNATURE DEBUG ===");
    console.log(
      "Payment Data String:",
      Object.entries(paymentData)
        .map(([k, v]) => `${k}=${v.toString().trim().replace(/ /g, "+")}`)
        .join("&") + `&passphrase=${PAYFAST_CONFIG.passphrase}`
    );
    console.log("Generated Signature:", signature);
    console.log("======================");

    paymentData.signature = `<${signature}>`;

    // Build payment URL
    const urlParams = new URLSearchParams(paymentData).toString();
    const paymentUrl = `${PAYFAST_CONFIG.baseUrl}?${urlParams}`;

    // Debug logging (remove in production)
    console.log(
      "Payment Data (before signature):",
      JSON.stringify(paymentData, null, 2)
    );
    console.log("Generated Signature:", signature);
    console.log("Payment URL:", paymentUrl);

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
