const User = require("../models/User");
const passwordService = require("../services/passwordService");
const jwtService = require("../services/jwtService");
const logger = require("../utils/logger");
const emailService = require("../services/emailService");
const crypto = require("crypto");
const Fields = require("../models/Fields");
const Milestones = require("../models/Milestones");
const UsersMilestones = require("../models/UsersMilestones");
const connectDB = require("../db/mongo");

function calculateAllowCheckIn(previousMilestoneCompletedOn) {
  if (!previousMilestoneCompletedOn) {
    return true; // If there's no previous milestone completion, allow check-in
  }
  const now = new Date();
  const completedDate = new Date(previousMilestoneCompletedOn);
  const timeDiff = now - completedDate;
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

  return daysDiff >= 1; // true if at least 1 day has passed
}

async function updateFcmDeviceToken(user, fcmDeviceToken) {
  try {
    await connectDB();
    if (!fcmDeviceToken) return user; // ignore empty tokens

    // If field is missing, initialize as empty array
    if (!Array.isArray(user.fcmDeviceTokens)) {
      user.fcmDeviceTokens = [];
    }

    // Add only if not already stored
    if (!user.fcmDeviceTokens.includes(fcmDeviceToken)) {
      user.fcmDeviceTokens.push(fcmDeviceToken);
      await user.save();
    }

    return user;
  } catch (err) {
    console.error("Error updating FCM token:", err);
    return user;
  }
}

// Add this import at the top of your file
const Subscription = require("../models/Subscription"); // Adjust path as needed

// Helper function to create free subscription
async function createFreeSubscription(userId) {
  try {
    const freeSubscription = await Subscription.create({
      userId: userId.toString(),
      plan: "free",
      price: 0,
      currency: "ZAR",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return freeSubscription;
  } catch (error) {
    logger.error("Error creating free subscription:", error);
    throw error;
  }
}

// Traditional Email/Password Registration
async function register(req, res, next) {
  try {
    await connectDB();
    const { email, password, userName, firstName, lastName, fcmDeviceToken } =
      req.body;

    // Validate required fields
    if (!email || !password || !userName || !firstName || !lastName) {
      return res.status(200).json({
        status: false,
        message:
          "Email, password, userName, firstName, and lastName are required",
        data: null,
      });
    }

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(200).json({
        status: false,
        message: "Email already registered",
        data: null,
      });
    }

    // Hash password and create user
    const passwordHash = await passwordService.hashPassword(password);
    const user = await User.create({
      email,
      passwordHash,
      userName,
      firstName,
      lastName,
      provider: "local",
      isEmailVerified: false,
      tokenVersion: 0,
    });

    // ⬇️ Create free subscription for new user
    await createFreeSubscription(user._id);

    // ⬇️ Update FCM token here
    await updateFcmDeviceToken(user, fcmDeviceToken);
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = jwtService.signAccess(payload);

    return res.status(200).json({
      status: true,
      message: "User registered successfully",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          alcoholType: null,
          improvement: [],
          goal: null,
          provider: user.provider,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
          location: user.location?.lat
            ? user.location
            : {
                lat: 0,
                long: 0,
              },
          bio: user.bio,
        },
        token: accessToken,
      },
    });
  } catch (err) {
    logger.error("Register error", err);
    next(err);
  }
}

// SOCIAL AUTH
async function socialAuth(req, res, next) {
  try {
    await connectDB();
    const {
      provider,
      providerId,
      email,
      userName,
      firstName,
      lastName,
      profilePicture,
      fcmDeviceToken,
    } = req.body;

    const loginEmail = email || `${provider}_${providerId}@noemail.local`;

    // Check if user exists with this provider and providerId
    let user = await User.findOne({ provider, providerId });
    let message, statusCode;
    let isNewUser = false; // Track if this is a new user

    if (!user) {
      // Try matching by email (from any provider)
      const existingByEmail = await User.findOne({ email: loginEmail });

      if (existingByEmail) {
        // User exists with same email but different provider - just log them in
        user = existingByEmail;
        message = "Login successful";
        statusCode = 200;
      } else {
        const resolvedUserName =
          userName ||
          (firstName || lastName
            ? [firstName, lastName].filter(Boolean).join(" ").trim()
            : (email ? email.split("@")[0] : `${provider}_${String(providerId).slice(-6)}`));

        user = await User.create({
          email: loginEmail,
          userName: resolvedUserName,
          firstName,
          lastName,
          provider,
          providerId,
          profilePicture,
          isEmailVerified: true,
          tokenVersion: 0,
        });

        isNewUser = true; // Mark as new user
        message = "User registered successfully";
        statusCode = 200;
      }
    } else {
      // User exists with same provider and providerId
      message = "Login successful";
      statusCode = 200;
    }

    // ⬇️ Create free subscription for new users
    if (isNewUser) {
      await createFreeSubscription(user._id);
    }

    await updateFcmDeviceToken(user, fcmDeviceToken);

    user.tokenVersion += 1;
    await user.save();
    const alcoholField = user.alcoholType
      ? await Fields.findById(user.alcoholType).lean()
      : null;
    const improvementFields =
      user.improvement?.length > 0
        ? await Fields.find({ _id: { $in: user.improvement } }).lean()
        : [];

    const alcoholTypeName = alcoholField ? alcoholField.name : null;
    const improvementNames = improvementFields.map((f) => f.name);
    const alcoholTypeIds = alcoholField ? alcoholField._id : null;
    const improvementIds = improvementFields.map((f) => f._id);

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = jwtService.signAccess(payload);

    const milestones = await Milestones.find({
      frequency: user?.goal?.frequency,
    })
      .sort({ createdAt: 1 })
      .select("tag description title _id dayCount frequency")
      .limit(2)
      .lean();

    const isUserHasMilestones = await UsersMilestones.find({
      userId: user._id,
      completedOn: null,
    })
      .populate("milestoneId")
      .sort({ milestoneId: 1 });
    const lastCompletedMilestone = await UsersMilestones.findOne({
      userId: user._id,
      completedOn: { $ne: null },
    })
      .sort({ completedOn: -1 })
      .lean();
    const userMilestonesToStore = [
      {
        userId: user._id,
        milestoneId: milestones?.[0]?._id,
      },
      {
        userId: user._id,
        milestoneId: milestones?.[1]?._id,
      },
    ];
    if (isUserHasMilestones.length < 1 && user?.goal?.frequency) {
      userMilestonesSavedInDb = await UsersMilestones.insertMany(
        userMilestonesToStore
      );
    }
    return res.status(statusCode).json({
      status: true,
      message,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          alcoholType: alcoholTypeName || null,
          improvement: improvementNames || null,
          alcoholIds: alcoholTypeIds || null,
          improvementIds: improvementIds || null,
          goal: user.goal || null,
          provider: user.provider,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
          location: user.location?.lat
            ? user.location
            : {
                lat: 0,
                long: 0,
              },
          bio: user.bio,
          milestones: null,
          isActiveMilestone: isUserHasMilestones.length > 0 ? true : false,
        },
        token: accessToken,
      },
    });
  } catch (err) {
    logger.error("Social auth error", err);
    next(err);
  }
}

// Add User Details (alcoholType, improvement, goal)
async function addUserDetails(req, res, next) {
  try {
    await connectDB();
    const { improvement, goal, isOther } = req.body;
    let alcoholType = req.body?.alcoholType;
    const userId = req.user.userId;

    // Validate required fields
    if (!goal) {
      return res.status(200).json({
        status: false,
        message: "goal is required",
        data: null,
      });
    }

    // Validate goal structure
    if (!goal.amount || !goal.frequency) {
      return res.status(200).json({
        status: false,
        message:
          "goal must include amount, frequency, goalType, onAverage, and actualGoal",
        data: null,
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (
      (!alcoholType || !improvement) &&
      (!user.alcoholType || !user?.improvement || user?.improvement?.length < 1)
    ) {
      return res.status(200).json({
        status: false,
        message: "alcoholType and improvement are required",
        data: null,
      });
    }
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "User not found",
        data: null,
      });
    }
    if (isOther) {
      const addAlcoholType = await Fields.create({
        isOther: true,
        field: "alcoholType",
        name: alcoholType,
      });
      alcoholType = addAlcoholType._id;
    }

    // Update user with details
    user.alcoholType = alcoholType;
    user.improvement = improvement;
    user.goal = goal;
    await user.save();

    // Get readable field names
    const alcoholField = await Fields.findById(user.alcoholType).lean();
    const improvementFields = await Fields.find({
      _id: { $in: user.improvement },
    }).lean();

    const alcoholTypeName = alcoholField ? alcoholField.name : null;
    const improvementNames = improvementFields.map((f) => f.name);
    const alcoholTypeIds = alcoholField ? alcoholField._id : null;
    const improvementIds = improvementFields.map((f) => f._id);

    // Generate new token
    const payload = { userId: user._id.toString(), email: user.email };
    const milestones = await Milestones.find({
      frequency: user?.goal?.frequency,
    })
      .sort({ createdAt: 1 })
      .select("tag description title _id dayCount")
      .limit(2)
      .lean();
    const isUserHasMilestones = await UsersMilestones.find({
      userId: userId,
      completedOn: null,
    })
      .populate("milestoneId")
      .sort({ milestoneId: 1 });
    const lastCompletedMilestone = await UsersMilestones.findOne({
      userId: user._id,
      completedOn: { $ne: null },
    })
      .sort({ completedOn: -1 })
      .lean();
    const userMilestonesToStore = [
      {
        userId: userId,
        milestoneId: milestones?.[0]?._id,
      },
      {
        userId: userId,
        milestoneId: milestones?.[1]?._id,
      },
    ];
    if (isUserHasMilestones.length < 1) {
      userMilestonesSavedInDb = await UsersMilestones.insertMany(
        userMilestonesToStore
      );
    }

    return res.status(200).json({
      status: true,
      message: "User details added successfully",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          alcoholType: alcoholTypeName || null,
          improvement: improvementNames || null,
          alcoholIds: alcoholTypeIds || null,
          improvementIds: improvementIds || null,
          goal: user.goal || null,
          provider: user.provider,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
          bio: user.bio,
          location: user.location?.lat
            ? user.location
            : {
                lat: 0,
                long: 0,
              },
          milestones: null,
        },
      },
    });
  } catch (err) {
    logger.error("Add user details error", err);
    next(err);
  }
}

// Traditional Email/Password Login
async function login(req, res, next) {
  try {
    await connectDB();
    const { email, password, fcmDeviceToken } = req.body;

    if (!email || !password) {
      return res.status(200).json({
        status: false,
        message: "Email and password required",
        data: null,
      });
    }

    // Find user and verify it's a local account
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "This email does not exists",
        data: null,
      });
    }
    if (user.provider !== "local") {
      return res.status(200).json({
        status: false,
        message: "This email is registered using social login.",
        data: null,
      });
    }

    // Compare password
    const match = await passwordService.comparePassword(
      password,
      user.passwordHash
    );
    if (!match) {
      return res.status(200).json({
        status: false,
        message: "Wrong Password",
        data: null,
      });
    }
    await updateFcmDeviceToken(user, fcmDeviceToken);

    console.log("user.tokenVersion-----", user.tokenVersion);
    user.tokenVersion += 1;
    await user.save();
    const alcoholField = await Fields.findById(user.alcoholType).lean();
    const improvementFields = await Fields.find({
      _id: { $in: user.improvement },
    }).lean();

    const alcoholTypeName = alcoholField ? alcoholField.name : null;
    const improvementNames = improvementFields.map((f) => f.name);
    const alcoholTypeIds = alcoholField ? alcoholField._id : null;
    const improvementIds = improvementFields.map((f) => f._id);
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = jwtService.signAccess(payload);
    const milestones = await Milestones.find({
      frequency: user?.goal?.frequency,
    })
      .sort({ createdAt: 1 })
      .select("tag description title _id dayCount frequency")
      .limit(2)
      .lean();
    const isUserHasMilestones = await UsersMilestones.find({
      userId: user._id,
      completedOn: null,
    })
      .populate("milestoneId")
      .sort({ milestoneId: 1 });
    const lastCompletedMilestone = await UsersMilestones.findOne({
      userId: user._id,
      completedOn: { $ne: null },
    })
      .sort({ completedOn: -1 })
      .lean();
    const userMilestonesToStore = [
      {
        userId: user._id,
        milestoneId: milestones?.[0]?._id,
      },
      {
        userId: user._id,
        milestoneId: milestones?.[1]?._id,
      },
    ];
    if (isUserHasMilestones.length < 1 && user?.goal?.frequency) {
      userMilestonesSavedInDb = await UsersMilestones.insertMany(
        userMilestonesToStore
      );
    }

    return res.status(200).json({
      status: true,
      message: "Login successful",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          alcoholType: alcoholTypeName || null,
          improvement: improvementNames || null,
          alcoholIds: alcoholTypeIds || null,
          improvementIds: improvementIds || null,
          goal: user.goal || null,
          provider: user.provider,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
          location: user.location?.lat
            ? user.location
            : {
                lat: 0,
                long: 0,
              },
          bio: user.bio,
          milestones: null,
          isActiveMilestone: isUserHasMilestones.length > 0 ? true : false,
        },
        token: accessToken,
      },
    });
  } catch (err) {
    logger.error("Login error", err);
    next(err);
  }
}

// Send verification code
async function forgotPassword(req, res, next) {
  try {
    await connectDB();
    const { email } = req.body;
    logger.info("Forgot password request for:", email);

    if (!email) {
      return res.status(200).json({
        status: false,
        message: "Email is required",
        data: null,
      });
    }

    const user = await User.findOne({ email, provider: "local" });
    logger.info("User found:", !!user);
    if (!user) {
      // For security, don't reveal if email exists
      return res.status(200).json({
        status: true,
        message: "If the email exists, a verification code has been sent",
        data: null,
      });
    }

    // Generate 4-digit code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Hash the code before storing
    const hashedCode = crypto
      .createHash("sha256")
      .update(verificationCode)
      .digest("hex");

    // Set expiry to 10 minutes
    user.resetPasswordToken = hashedCode;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    logger.info("Token saved, sending email...");

    // Send email
    const emailSent = await emailService.sendVerificationCode(
      email,
      verificationCode
    );
    logger.info("Email sent:", emailSent);

    if (!emailSent) {
      return res.status(500).json({
        status: false,
        message: "Failed to send verification code. Please try again.",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Verification code sent to your email",
      data: null,
    });
  } catch (err) {
    logger.error("Forgot password error", err);
    next(err);
  }
}

// Verify code
async function verifyResetCode(req, res, next) {
  try {
    await connectDB();
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(200).json({
        status: false,
        message: "Email and verification code are required",
        data: null,
      });
    }

    const user = await User.findOne({
      email,
      provider: "local",
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(200).json({
        status: false,
        message: "Invalid or expired verification code",
        data: null,
      });
    }

    // Hash the provided code and compare
    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

    if (hashedCode !== user.resetPasswordToken) {
      return res.status(200).json({
        status: false,
        message: "Invalid verification code",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Verification code is valid",
      data: { email },
    });
  } catch (err) {
    logger.error("Verify reset code error", err);
    next(err);
  }
}

// Reset password
async function resetPassword(req, res, next) {
  try {
    await connectDB();
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(200).json({
        status: false,
        message: "Email, verification code, and new password are required",
        data: null,
      });
    }

    const user = await User.findOne({
      email,
      provider: "local",
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(200).json({
        status: false,
        message: "Invalid or expired verification code",
        data: null,
      });
    }

    // Verify code
    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

    if (hashedCode !== user.resetPasswordToken) {
      return res.status(200).json({
        status: false,
        message: "Invalid verification code",
        data: null,
      });
    }

    // Update password
    user.passwordHash = await passwordService.hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Password reset successfully",
      data: null,
    });
  } catch (err) {
    logger.error("Reset password error", err);
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await connectDB();
    const { userId, fcmDeviceToken } = req.body;
    if (!userId || !fcmDeviceToken) {
      return res.status(200).json({
        status: false,
        message: "userId and fcmDeviceToken are required",
        data: null,
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "User not found",
        data: null,
      });
    }
    if (!Array.isArray(user.fcmDeviceTokens)) {
      user.fcmDeviceTokens = [];
    }
    const before = user.fcmDeviceTokens.length;
    user.fcmDeviceTokens = user.fcmDeviceTokens.filter((t) => t !== fcmDeviceToken);
    await user.save();
    return res.status(200).json({
      status: true,
      message: "Logout successful",
      data: { removed: before !== user.fcmDeviceTokens.length },
    });
  } catch (err) {
    logger.error("Logout error", err);
    next(err);
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  socialAuth,
  addUserDetails,
  logout,
};
