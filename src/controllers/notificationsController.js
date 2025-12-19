const { GoogleAuth } = require("google-auth-library");
const logger = require("../utils/logger");
const Notifications = require("../models/Notifications");
const User = require("../models/User");
const connectDB = require("../db/mongo");
const UsersMilestones = require("../models/UsersMilestones");
const Subscription = require("../models/Subscription");

const PROJECT_ID = process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

async function sendAlert(deviceToken, title, body) {
  const payload = {
    message: {
      token: deviceToken,
      notification: {
        title,
        body,
      },
    },
  };

  const auth = new GoogleAuth({
    credentials: {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
    },
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const response = await fetch(FCM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken.token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log("FCM RESPONSE:", data);
  return data;
}

async function sendNotification(req, res, next) {
  try {
    await connectDB();
    const { userId, title, body, type } = req.body;
    const users = await User.find({ _id: { $in: userId } })
      .select("fcmDeviceTokens")
      .lean();

    const tokens = users.flatMap((u) => u.fcmDeviceTokens || []);

    const saved = await Notifications.create({
      to: tokens,
      notification: { title, body },
      type,
      userId,
    });
    await Promise.all(tokens.map((token) => sendAlert(token, title, body)));
    return res.status(200).json({
      status: true,
      message: "notification sent successfully",
      data: saved,
    });
  } catch (err) {
    logger.error("Send notification error", err);
    next(err);
  }
}

async function getNotification(req, res, next) {
  try {
    await connectDB();
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    // Get total count
    const total = await Notifications.countDocuments({ userId });

    // Get paginated notifications
    const notifications = await Notifications.find({ userId })
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return res.status(200).json({
      status: true,
      message: `notifications fetched successfully`,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (err) {
    logger.error("Get notification error", err);
    next(err);
  }
}

module.exports = {
  sendNotification,
  getNotification,
  runCheckinReminderCron,
  runSubscriptionReminderCron,
};

async function runCheckinReminderCron(req, res, next) {
  try {
    await connectDB();

    const token = req.query.token || req.headers["x-cron-token"];
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
        data: null,
      });
    }

    const userIds = await UsersMilestones.distinct("userId");
    if (!userIds || userIds.length === 0) {
      return res.status(200).json({
        status: true,
        message: "No users with milestones found",
        data: { users: 0, tokens: 0 },
      });
    }

    const users = await User.find({ _id: { $in: userIds } })
      .select("fcmDeviceTokens")
      .lean();
    const tokens = users.flatMap((u) => u.fcmDeviceTokens || []);

    const title = "Daily Check-in Reminder";
    const body = "Don't forget to check in to your milestone today.";

    const saved = await Notifications.create({
      to: tokens,
      notification: { title, body },
      type: "milestone",
      userId: userIds,
    });

    await Promise.all(tokens.map((t) => sendAlert(t, title, body)));

    return res.status(200).json({
      status: true,
      message: "Check-in reminders processed",
      data: { users: userIds.length, tokens: tokens.length, notificationId: saved._id },
    });
  } catch (err) {
    logger.error("Check-in cron error", err);
    next(err);
  }
}

async function runSubscriptionReminderCron(req, res, next) {
  try {
    await connectDB();

    const token = req.query.token || req.headers["x-cron-token"];
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
        data: null,
      });
    }

    const addDays = (date, days) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };
    const startOfDayUTC = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));

    const now = new Date();
    const target = addDays(now, 3);
    const start = startOfDayUTC(target);
    const end = addDays(start, 1);

    const subs = await Subscription.find({
      status: "active",
      plan: { $in: ["monthly", "yearly"] },
      nextBillingDate: { $gte: start, $lt: end },
    }).lean();

    if (!subs || subs.length === 0) {
      return res.status(200).json({
        status: true,
        message: "No subscriptions due in 3 days",
        data: { users: 0, tokens: 0 },
      });
    }

    const userIds = subs.map((s) => s.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select("fcmDeviceTokens")
      .lean();
    const tokens = users.flatMap((u) => u.fcmDeviceTokens || []);

    const title = "Subscription Renewal Reminder";
    const body = "Your subscription renews in 3 days. Please ensure payment is set.";

    const saved = await Notifications.create({
      to: tokens,
      notification: { title, body },
      type: "wallet",
      userId: userIds,
    });

    await Promise.all(tokens.map((t) => sendAlert(t, title, body)));

    return res.status(200).json({
      status: true,
      message: "Subscription renewal reminders processed",
      data: { users: userIds.length, tokens: tokens.length, notificationId: saved._id },
    });
  } catch (err) {
    logger.error("Subscription cron error", err);
    next(err);
  }
}
