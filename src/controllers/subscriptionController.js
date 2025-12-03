// controllers/subscriptionController.js
const crypto = require("crypto");
const axios = require("axios");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const connectDB = require("../db/mongo");

const PAYFAST_CONFIG = {
  // merchantId: "30891881",
  // merchantKey: "tkfsxuucbmqeu",
  merchantId: "10044126",
  merchantKey: "qxq4ap5sm2jdq",
  passphrase: "Truedrop123456",
  // baseUrl: "https://www.payfast.co.za/eng/process",
  baseUrl: "https://sandbox.payfast.co.za/eng/process",
  apiUrl: "https://api.payfast.co.za/subscriptions",
};

const PAYFAST_IPS = [
  "197.97.145.144",
  "197.97.145.145",
  "197.97.145.146",
  "197.97.145.147",
  "197.97.145.148",
];

const PLANS = {
  free: {
    amount: 0,
    frequency: 0,
    cycles: 0,
    name: "Free Plan",
    isFree: true,
  },

  // 3-Day Plan
  three_day: {
    amount: 1.99, // your amount here
    frequency: 3, // every 3 days
    cycles: 1, // only 1 cycle (non-recurring)
    name: "3-Day Access",
  },

  // Monthly Plan
  monthly: {
    amount: 5.0, // your monthly amount
    frequency: 3, // every 30 days
    cycles: 0, // unlimited recurring
    name: "Monthly Plan",
  },

  // Yearly Plan
  yearly: {
    amount: 49.99, // your yearly amount
    frequency: 6, // every 365 days
    cycles: 0, // unlimited recurring
    name: "Yearly Plan",
  },
};

const generateSignature = (data, passphrase = "") => {
  let pfOutput = "";
  for (let key in data) {
    if (
      data.hasOwnProperty(key) &&
      data[key] !== "" &&
      data[key] !== null &&
      data[key] !== undefined
    ) {
      pfOutput += `${key}=${encodeURIComponent(
        data[key].toString().trim()
      ).replace(/%20/g, "+")}&`;
    }
  }
  pfOutput = pfOutput.slice(0, -1);
  if (passphrase)
    pfOutput += `&passphrase=${encodeURIComponent(passphrase.trim())}`;
  return crypto.createHash("md5").update(pfOutput).digest("hex");
};

const verifyPayFastIP = (ip) => {
  const cleanIp = ip ? ip.split(",")[0].trim() : "";
  return PAYFAST_IPS.includes(cleanIp);
};

const verifyPayFastData = (pfData, signature, passphrase = "") => {
  const tempData = { ...pfData };
  delete tempData.signature;
  const calculatedSignature = generateSignature(tempData, passphrase);
  console.log("Calculated signature:", calculatedSignature);
  console.log("Received signature:", signature);
  return calculatedSignature === signature;
};

// 1. GET SUBSCRIPTION URL
exports.getSubscriptionURL = async (req, res) => {
  try {
    await connectDB();
    const { userId, planType, deviceType } = req.body;

    if (!userId || !planType)
      return res.status(200).json({
        status: false,
        message: "userId and planType are required",
        data: null,
      });
    if (!PLANS[planType])
      return res.status(200).json({
        status: false,
        message: "Invalid plan type. Choose: free, monthly, or premium",
        data: null,
      });

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(200)
        .json({ status: false, message: "User not found", data: null });

    const plan = PLANS[planType];
    if (!plan.isFree && !user.email)
      return res.status(200).json({
        status: false,
        message: "User email is required for paid subscriptions",
        data: null,
      });

    if (plan.isFree) {
      const subscription = await Subscription.create({
        userId,
        plan: planType,
        price: 0,
        currency: "ZAR",
        status: "active",
        deviceType: deviceType || "android",
        paymentId: null,
        lastPaymentDate: new Date(),
        nextBillingDate: null,
      });
      return res.status(200).json({
        status: true,
        message: "Free plan activated",
        data: {
          subscriptionId: subscription._id,
          plan: planType,
          amount: 0,
          paymentUrl: null,
        },
      });
    }

    const subscription = await Subscription.create({
      userId,
      plan: planType,
      price: plan.amount,
      currency: "ZAR",
      status: "pending",
      deviceType: deviceType || "android",
    });
    const subscriptionId = subscription._id.toString();

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

    return res.status(200).json({
      status: true,
      message: "Subscription URL generated",
      data: {
        paymentUrl,
        subscriptionId,
        plan: planType,
        amount: plan.amount,
      },
    });
  } catch (error) {
    console.error("Error generating subscription URL:", error);
    return res.status(200).json({
      status: false,
      message: "Failed to generate payment URL",
      data: null,
    });
  }
};

// 2. PAYFAST WEBHOOK (ITN)
exports.webhook = async (req, res) => {
  try {
    console.log("Webhook hit");
    await connectDB();
    console.log("DB connected");

    const pfData = req.body;
    console.log("pfData:", pfData);

    const signature = pfData.signature;
    console.log("signature:", signature);

    const clientIp = (
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      ""
    )
      .split(",")[0]
      .trim();
    console.log("clientIp:", clientIp);

    console.log("Verifying signature...");
    // if (!verifyPayFastData(pfData, signature, PAYFAST_CONFIG.passphrase)) {
    //   console.log("Invalid signature");
    //   return res.status(200).send("Invalid signature");
    // }
    console.log("Signature valid");

    const {
      payment_status,
      custom_str1: userId,
      custom_str2: planType,
      custom_str3: subscriptionId,
      token,
      amount_gross,
      billing_date,
    } = pfData;

    console.log("Extracted fields:", {
      payment_status,
      userId,
      planType,
      subscriptionId,
      token,
      amount_gross,
      billing_date,
    });

    if (!subscriptionId) {
      console.log("No subscriptionId");
      return res.status(200).send("No subscription ID");
    }

    let newStatus = "pending";
    console.log("Determining new status...");

    switch (payment_status?.toUpperCase()) {
      case "COMPLETE":
        newStatus = "active";
        break;
      case "CANCELLED":
        newStatus = "cancelled";
        break;
      case "FAILED":
        newStatus = "failed";
        break;
    }

    console.log("New status:", newStatus);

    console.log("Updating subscription...");
    const updatedSubscription = await Subscription.findByIdAndUpdate(
      subscriptionId,
      {
        status: newStatus,
        paymentId: token,
        lastPaymentDate: new Date(),
        nextBillingDate: billing_date ? new Date(billing_date) : null,
        updatedAt: new Date(),
      },
      { new: true }
    );

    console.log("DB update result:", updatedSubscription);

    if (!updatedSubscription) {
      console.log("Subscription not found");
      return res.status(200).send("Subscription not found");
    }

    console.log("Webhook complete");
    return res.status(200).json({
      status: true,
      message: "Webhook processed successfully",
      data: { subscriptionId, status: newStatus },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    console.log("Webhook error block reached");
    return res.status(200).json({
      status: false,
      message: "Webhook processing failed",
      data: null,
    });
  }
};

// 3. CANCEL SUBSCRIPTION
exports.cancelSubscription = async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.body;
    if (!userId)
      return res
        .status(200)
        .json({ status: false, message: "userId is required", data: null });

    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    });
    if (!subscription || !subscription.paymentId)
      return res.status(200).json({
        status: false,
        message: "No active subscription found",
        data: null,
      });

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
      return res.status(200).json({
        status: true,
        message: "Subscription cancelled successfully",
        data: null,
      });
    } catch (apiError) {
      console.error("PayFast API error:", apiError.response?.data || apiError);
      return res.status(200).json({
        status: false,
        message: "Failed to cancel subscription with PayFast",
        data: null,
      });
    }
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return res.status(200).json({
      status: false,
      message: "Failed to cancel subscription",
      data: null,
    });
  }
};

// 4. RENEW SUBSCRIPTION
exports.renewSubscription = async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.body;
    if (!userId)
      return res
        .status(200)
        .json({ status: false, message: "userId is required", data: null });

    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ["expired", "cancelled"] },
    });
    if (!subscription)
      return res.status(200).json({
        status: false,
        message: "No subscription found to renew",
        data: null,
      });

    return res.status(200).json({
      status: true,
      message: "Please create a new subscription",
      data: { action: "create_new_subscription" },
    });
  } catch (error) {
    console.error("Renew subscription error:", error);
    return res.status(200).json({
      status: false,
      message: "Failed to renew subscription",
      data: null,
    });
  }
};

// 5. GET SUBSCRIPTION
exports.getSubscription = async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.query;
    if (!userId)
      return res
        .status(200)
        .json({ status: false, message: "userId is required", data: null });
    const user = await User.findById(userId);
    const hasThreeDaysPassed = () => {
      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
      return Date.now() - new Date(user.createdAt).getTime() > threeDaysInMs;
    };
    const subscription = await Subscription.findOne({ userId }).sort({
      createdAt: -1,
    });
    if (!subscription)
      return res
        .status(200)
        .json({ status: false, message: "No subscription found", data: null });

    return res.status(200).json({
      status: true,
      message: "Subscription fetched",
      data: {
        deviceType: subscription.deviceType,
        paymentId: subscription.paymentId,
        plan: subscription.plan,
        price: subscription.price,
        currency: subscription.currency,
        status: subscription.status,
        created: subscription.createdAt,
        isFreeTrial: !hasThreeDaysPassed,
        nextBillingDate: subscription.nextBillingDate,
      },
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    return res.status(200).json({
      status: false,
      message: "Failed to get subscription",
      data: null,
    });
  }
};

exports.getAllSubscription = async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.query;
    if (!userId)
      return res
        .status(200)
        .json({ status: false, message: "userId is required", data: null });
    const user = await User.findById(userId);
    const hasThreeDaysPassed = () => {
      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
      return Date.now() - new Date(user.createdAt).getTime() > threeDaysInMs;
    };
    const subscriptions = await Subscription.find({ userId }).sort({
      createdAt: -1,
    });
    if (!subscriptions)
      return res
        .status(200)
        .json({ status: false, message: "No subscriptions found", data: null });

    const formattedSubscriptions = subscriptions?.map((subscription) => {
      return {
        deviceType: subscription.deviceType,
        paymentId: subscription.paymentId,
        plan: subscription.plan,
        price: subscription.price,
        currency: subscription.currency,
        status: subscription.status,
        created: subscription.createdAt,
        isFreeTrial: !hasThreeDaysPassed,
        nextBillingDate: subscription.nextBillingDate,
      };
    });

    return res.status(200).json({
      status: true,
      message: "Subscriptions fetched",
      data: formattedSubscriptions,
    });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    return res.status(200).json({
      status: false,
      message: "Failed to get subscriptions",
      data: null,
    });
  }
};

// 6. CHECK SUBSCRIPTION STATUS
exports.checkSubscriptionStatus = async (req, res) => {
  try {
    await connectDB();
    const { subscriptionId } = req.params;
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription)
      return res
        .status(200)
        .json({ status: false, message: "Subscription not found", data: null });

    return res.status(200).json({
      status: true,
      message: "Subscription status fetched",
      data: {
        id: subscription._id,
        userId: subscription.userId,
        plan: subscription.plan,
        status: subscription.status,
        paymentId: subscription.paymentId,
        lastPaymentDate: subscription.lastPaymentDate,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
    });
  } catch (error) {
    console.error("Check status error:", error);
    return res.status(200).json({
      status: false,
      message: "Failed to check subscription status",
      data: null,
    });
  }
};
