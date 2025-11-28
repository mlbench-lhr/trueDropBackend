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

    // Check if user exists with this provider and providerId
    let user = await User.findOne({ provider, providerId });
    let message, statusCode;

    if (!user) {
      // Try matching by email (from any provider)
      const existingByEmail = await User.findOne({ email });

      if (existingByEmail) {
        // User exists with same email but different provider - just log them in
        user = existingByEmail;
        message = "Login successful";
        statusCode = 200;
      } else {
        // Completely new user - create account without additional details
        if (!userName) {
          return res.status(200).json({
            status: false,
            message: "userName is required for new users",
            data: null,
          });
        }

        // Register new user
        user = await User.create({
          email,
          userName,
          firstName,
          lastName,
          provider,
          providerId,
          profilePicture,
          isEmailVerified: true,
          tokenVersion: 0,
        });

        message = "User registered successfully";
        statusCode = 200;
      }
    } else {
      // User exists with same provider and providerId
      message = "Login successful";
      statusCode = 200;
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
      .sort({ createdAt: 1 });
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
    let userMilestonesSavedInDb = {
      currentMilestone: { ...milestones[0], soberDays: 0 },
      nextMilestone: { ...milestones[1], soberDays: 0 },
    };
    if (isUserHasMilestones.length < 1 && user?.goal?.frequency) {
      userMilestonesSavedInDb = await UsersMilestones.insertMany(
        userMilestonesToStore
      );
    }
    const respMilestones = {
      currentMilestone: {
        _id:
          isUserHasMilestones[0]?.milestoneId?._id ||
          milestones[0]?._id ||
          null,
        frequency:
          isUserHasMilestones[0]?.milestoneId?.frequency ||
          milestones[0]?.frequency ||
          null,
        tag: isUserHasMilestones[0]?.milestoneId?.tag || milestones[0]?.tag,
        title:
          isUserHasMilestones[0]?.milestoneId?.title || milestones[0]?.title,
        description:
          isUserHasMilestones[0]?.milestoneId?.description ||
          milestones[0]?.description,
        dayCount:
          isUserHasMilestones[0]?.milestoneId?.dayCount ||
          milestones[0]?.dayCount,
        completedOn:
          isUserHasMilestones?.[0]?.completedOn ||
          userMilestonesSavedInDb[0]?.completedOn ||
          null,
        moneySaved:
          isUserHasMilestones?.[0]?.moneySaved ||
          userMilestonesSavedInDb[0]?.moneySaved ||
          0,
        updatedAt:
          isUserHasMilestones?.[0]?.soberDays > 0 ||
          userMilestonesSavedInDb[0]?.soberDays > 0
            ? isUserHasMilestones?.[0]?.updatedAt ||
              userMilestonesSavedInDb[0]?.updatedAt ||
              null
            : null,
        soberDays:
          isUserHasMilestones?.[0]?.soberDays ||
          userMilestonesSavedInDb[0]?.soberDays ||
          0,
      },
      nextMilestone: {
        _id:
          isUserHasMilestones[1]?.milestoneId?._id ||
          milestones[1]?._id ||
          null,
        frequency:
          isUserHasMilestones[1]?.milestoneId?.frequency ||
          milestones[1]?.frequency ||
          null,
        tag: isUserHasMilestones[1]?.milestoneId?.tag || milestones[1]?.tag,
        title:
          isUserHasMilestones[1]?.milestoneId?.title || milestones[1]?.title,
        description:
          isUserHasMilestones[1]?.milestoneId?.description ||
          milestones[1]?.description,
        dayCount:
          isUserHasMilestones[1]?.milestoneId?.dayCount ||
          milestones[1]?.dayCount,
        completedOn:
          isUserHasMilestones?.[1]?.completedOn ||
          userMilestonesSavedInDb[1]?.completedOn ||
          null,
        moneySaved:
          isUserHasMilestones?.[1]?.moneySaved ||
          userMilestonesSavedInDb[1]?.moneySaved ||
          0,
        updatedAt:
          isUserHasMilestones?.[1]?.soberDays > 0 ||
          userMilestonesSavedInDb[1]?.soberDays > 0
            ? isUserHasMilestones?.[1]?.updatedAt ||
              userMilestonesSavedInDb[1]?.updatedAt ||
              null
            : null,
        soberDays:
          isUserHasMilestones?.[1]?.soberDays ||
          userMilestonesSavedInDb[1]?.soberDays ||
          0,
      },
    };
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
          milestones: user?.goal?.frequency ? respMilestones : null,
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
    const { alcoholType, improvement, goal } = req.body;
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
    const accessToken = jwtService.signAccess(payload);
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
      .sort({ createdAt: 1 });

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
    let userMilestonesSavedInDb = {
      currentMilestone: { ...milestones[0], soberDays: 0 },
      nextMilestone: { ...milestones[1], soberDays: 0 },
    };
    if (isUserHasMilestones.length < 1) {
      userMilestonesSavedInDb = await UsersMilestones.insertMany(
        userMilestonesToStore
      );
    }
    const respMilestones = {
      currentMilestone: {
        _id:
          isUserHasMilestones[0]?.milestoneId?._id ||
          milestones[0]?._id ||
          null,
        frequency:
          isUserHasMilestones[0]?.milestoneId?.frequency ||
          milestones[0]?.frequency ||
          null,
        tag: isUserHasMilestones[0]?.milestoneId?.tag || milestones[0]?.tag,
        title:
          isUserHasMilestones[0]?.milestoneId?.title || milestones[0]?.title,
        description:
          isUserHasMilestones[0]?.milestoneId?.description ||
          milestones[0]?.description,
        dayCount:
          isUserHasMilestones[0]?.milestoneId?.dayCount ||
          milestones[0]?.dayCount,
        completedOn:
          isUserHasMilestones?.[0]?.completedOn ||
          userMilestonesSavedInDb[0]?.completedOn ||
          null,
        moneySaved:
          isUserHasMilestones?.[0]?.moneySaved ||
          userMilestonesSavedInDb[0]?.moneySaved ||
          0,
        updatedAt:
          isUserHasMilestones?.[0]?.soberDays > 0 ||
          userMilestonesSavedInDb[0]?.soberDays > 0
            ? isUserHasMilestones?.[0]?.updatedAt ||
              userMilestonesSavedInDb[0]?.updatedAt ||
              null
            : null,
        soberDays:
          isUserHasMilestones?.[0]?.soberDays ||
          userMilestonesSavedInDb[0]?.soberDays ||
          0,
      },
      nextMilestone: {
        _id:
          isUserHasMilestones[1]?.milestoneId?._id ||
          milestones[1]?._id ||
          null,
        frequency:
          isUserHasMilestones[1]?.milestoneId?.frequency ||
          milestones[1]?.frequency ||
          null,
        tag: isUserHasMilestones[1]?.milestoneId?.tag || milestones[1]?.tag,
        title:
          isUserHasMilestones[1]?.milestoneId?.title || milestones[1]?.title,
        description:
          isUserHasMilestones[1]?.milestoneId?.description ||
          milestones[1]?.description,
        dayCount:
          isUserHasMilestones[1]?.milestoneId?.dayCount ||
          milestones[1]?.dayCount,
        completedOn:
          isUserHasMilestones?.[1]?.completedOn ||
          userMilestonesSavedInDb[1]?.completedOn ||
          null,
        moneySaved:
          isUserHasMilestones?.[1]?.moneySaved ||
          userMilestonesSavedInDb[1]?.moneySaved ||
          0,
        updatedAt:
          isUserHasMilestones?.[1]?.soberDays > 0 ||
          userMilestonesSavedInDb[1]?.soberDays > 0
            ? isUserHasMilestones?.[1]?.updatedAt ||
              userMilestonesSavedInDb[1]?.updatedAt ||
              null
            : null,
        soberDays:
          isUserHasMilestones?.[1]?.soberDays ||
          userMilestonesSavedInDb[1]?.soberDays ||
          0,
      },
    };
    console.log("respMilestones----------------------", respMilestones);

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
          milestones: respMilestones,
        },
        token: accessToken,
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
    const user = await User.findOne({ email, provider: "local" });
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "This email does not exists",
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
      .sort({ createdAt: 1 });
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
    let userMilestonesSavedInDb = {
      currentMilestone: { ...milestones[0], soberDays: 0 },
      nextMilestone: { ...milestones[1], soberDays: 0 },
    };
    if (isUserHasMilestones.length < 1 && user?.goal?.frequency) {
      userMilestonesSavedInDb = await UsersMilestones.insertMany(
        userMilestonesToStore
      );
    }
    let respMilestones = {
      currentMilestone: {
        _id:
          isUserHasMilestones[0]?.milestoneId?._id ||
          milestones[0]?._id ||
          null,
        frequency:
          isUserHasMilestones[0]?.milestoneId?.frequency ||
          milestones[0]?.frequency ||
          null,
        tag: isUserHasMilestones[0]?.milestoneId?.tag || milestones[0]?.tag,
        title:
          isUserHasMilestones[0]?.milestoneId?.title || milestones[0]?.title,
        description:
          isUserHasMilestones[0]?.milestoneId?.description ||
          milestones[0]?.description,
        dayCount:
          isUserHasMilestones[0]?.milestoneId?.dayCount ||
          milestones[0]?.dayCount,
        completedOn:
          isUserHasMilestones?.[0]?.completedOn ||
          userMilestonesSavedInDb[0]?.completedOn ||
          null,
        moneySaved:
          isUserHasMilestones?.[0]?.moneySaved ||
          userMilestonesSavedInDb[0]?.moneySaved ||
          0,
        updatedAt:
          isUserHasMilestones?.[0]?.soberDays > 0 ||
          userMilestonesSavedInDb[0]?.soberDays > 0
            ? isUserHasMilestones?.[0]?.updatedAt ||
              userMilestonesSavedInDb[0]?.updatedAt ||
              null
            : null,
        soberDays:
          isUserHasMilestones?.[0]?.soberDays ||
          userMilestonesSavedInDb[0]?.soberDays ||
          0,
      },
      nextMilestone: {
        _id:
          isUserHasMilestones[1]?.milestoneId?._id ||
          milestones[1]?._id ||
          null,
        frequency:
          isUserHasMilestones[1]?.milestoneId?.frequency ||
          milestones[1]?.frequency ||
          null,
        tag: isUserHasMilestones[1]?.milestoneId?.tag || milestones[1]?.tag,
        title:
          isUserHasMilestones[1]?.milestoneId?.title || milestones[1]?.title,
        description:
          isUserHasMilestones[1]?.milestoneId?.description ||
          milestones[1]?.description,
        dayCount:
          isUserHasMilestones[1]?.milestoneId?.dayCount ||
          milestones[1]?.dayCount,
        completedOn:
          isUserHasMilestones?.[1]?.completedOn ||
          userMilestonesSavedInDb[1]?.completedOn ||
          null,
        moneySaved:
          isUserHasMilestones?.[1]?.moneySaved ||
          userMilestonesSavedInDb[1]?.moneySaved ||
          0,
        updatedAt:
          isUserHasMilestones?.[1]?.soberDays > 0 ||
          userMilestonesSavedInDb[1]?.soberDays > 0
            ? isUserHasMilestones?.[1]?.updatedAt ||
              userMilestonesSavedInDb[1]?.updatedAt ||
              null
            : null,
        soberDays:
          isUserHasMilestones?.[1]?.soberDays ||
          userMilestonesSavedInDb[1]?.soberDays ||
          0,
      },
    };

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
          milestones: user?.goal?.frequency ? respMilestones : null,
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

// Add to module.exports
module.exports = {
  register,
  login,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  socialAuth,
  addUserDetails,
};
