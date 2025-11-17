const { GoogleAuth } = require("google-auth-library");
const logger = require("../utils/logger");
const Notifications = require("../models/Notifications");

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
    const userId = req.body.userId;
    const body = req.body;
    const sendAlertRes = await sendAlert(body.to, body.title, body.body);
    if (sendAlertRes?.error) {
      return res.status(400).json({
        status: true,
        message: `failed to send notification`,
        data: body,
      });
    }

    const notificationSavedInDb = new Notifications({
      to: body.to,
      notification: {
        title: body.title,
        body: body.body,
      },
      type: body.type,
      userId: userId,
    });
    await notificationSavedInDb.save();
    return res.status(200).json({
      status: true,
      message: `notification sent successfully`,
      data: {
        to: notificationSavedInDb.to,
        notification: notificationSavedInDb.notification,
        data: notificationSavedInDb.notification,
      },
    });
  } catch (err) {
    logger.error("Add pod error", err);
    next(err);
  }
}

async function getNotification(req, res, next) {
  try {
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
};
