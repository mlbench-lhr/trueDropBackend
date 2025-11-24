const User = require("../models/User");
const jwtService = require("../services/jwtService");
const logger = require("../utils/logger");
const Fields = require("../models/Fields");
const cloudinary = require("../config/cloudinary"); // You'll need to configure this
const streamifier = require("streamifier"); // npm install streamifier

async function editProfile(req, res, next) {
  console.log("req---------", req.file);

  try {
    const { userName, firstName, lastName, bio } = req.body;
    const userId = req.user.userId; // Assuming you have auth middleware that sets req.user

    // Validate required fields
    if (!userName || !firstName || !lastName) {
      return res.status(200).json({
        status: false,
        message: "userName, firstName, lastName are required",
        data: null,
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "User not found",
        data: null,
      });
    }

    // Check if username is taken by another user
    if (userName !== user.userName) {
      const existingUserName = await User.findOne({
        userName,
        _id: { $ne: userId },
      });
      if (existingUserName) {
        return res.status(409).json({
          status: false,
          message: "Username already taken",
          data: null,
        });
      }
    }

    // Handle profile picture upload if provided
    let profilePictureUrl = user.profilePicture;

    if (req.file) {
      try {
        // Upload to Cloudinary using stream
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "profile_pictures",
              public_id: `user_${userId}_${Date.now()}`,
              resource_type: "image",
              transformation: [
                { width: 500, height: 500, crop: "limit" },
                { quality: "auto" },
              ],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );

          streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
        });

        // Delete old profile picture from Cloudinary if exists
        if (user.profilePicture && user.profilePicture.includes("cloudinary")) {
          const publicId = user.profilePicture
            .split("/")
            .slice(-2)
            .join("/")
            .split(".")[0];
          await cloudinary.uploader
            .destroy(publicId)
            .catch((err) =>
              logger.warn("Failed to delete old profile picture", err)
            );
        }

        profilePictureUrl = uploadResult.secure_url;
      } catch (uploadError) {
        logger.error("Cloudinary upload error", uploadError);
        return res.status(500).json({
          status: false,
          message: "Failed to upload profile picture",
          data: null,
        });
      }
    }

    // Update user profile
    user.userName = userName;
    user.firstName = firstName;
    user.lastName = lastName;
    user.bio = bio;
    user.profilePicture = profilePictureUrl;

    await user.save();

    // Fetch related fields if they exist
    let alcoholTypeName = null;
    let improvementNames = [];
    let alcoholTypeIds = null;
    let improvementNamesIds = [];

    if (user.alcoholType) {
      const alcoholField = await Fields.findById(user.alcoholType).lean();
      alcoholTypeName = alcoholField ? alcoholField.name : null;
      alcoholTypeIds = alcoholField ? alcoholField._id : null;
    }

    if (user.improvement && user.improvement.length > 0) {
      const improvementFields = await Fields.find({
        _id: { $in: user.improvement },
      }).lean();
      improvementNames = improvementFields.map((f) => f.name);
      improvementNamesIds = improvementFields.map((f) => f._id);
    }

    // Generate new access token with updated info
    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = jwtService.signAccess(payload);

    return res.status(200).json({
      status: true,
      message: "Profile updated successfully",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          bio: user.bio,
          alcoholType: alcoholTypeName,
          improvement: improvementNames,
          alcoholIds: alcoholTypeIds || null,
          improvementIds: improvementNamesIds || null,
          goal: user.goal,
          provider: user.provider,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
        },
        token: accessToken,
      },
    });
  } catch (err) {
    logger.error("Profile update error", err);
    next(err);
  }
}
const passwordService = require("../services/passwordService");

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(200).json({
        status: false,
        message: "Current password and new password are required",
        data: null,
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "User not found",
        data: null,
      });
    }

    // Check if user is a local provider (has password)
    if (user.provider !== "local") {
      return res.status(200).json({
        status: false,
        message: "Password change is only available for local accounts",
        data: null,
      });
    }

    // Verify current password
    const isPasswordValid = await passwordService.comparePassword(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(200).json({
        status: false,
        message: "Current password is incorrect",
        data: null,
      });
    }

    // Check if new password is same as current password
    const isSamePassword = await passwordService.comparePassword(
      newPassword,
      user.passwordHash
    );

    if (isSamePassword) {
      return res.status(200).json({
        status: false,
        message: "New password must be different from current password",
        data: null,
      });
    }

    // Hash and update new password
    user.passwordHash = await passwordService.hashPassword(newPassword);
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Password changed successfully",
      data: null,
    });
  } catch (err) {
    logger.error("Change password error", err);
    next(err);
  }
}
async function updateLocation(req, res, next) {
  try {
    const { location } = req.body;
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "User not found",
        data: null,
      });
    }
    user.location = location;
    await user.save();
    return res.status(200).json({
      status: true,
      message: "Location updated successfully",
      data: { location },
    });
  } catch (err) {
    logger.error("location update error", err);
    next(err);
  }
}

async function deleteAccount(req, res, next) {
  try {
    const userId = req.user.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({
        status: false,
        message: "User not found",
        data: null,
      });
    }

    // Delete profile picture from Cloudinary if exists
    if (user.profilePicture && user.profilePicture.includes("cloudinary")) {
      try {
        const publicId = user.profilePicture
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0];
        await cloudinary.uploader.destroy(publicId);
        logger.info(`Deleted profile picture for user ${userId}`);
      } catch (cloudinaryError) {
        logger.warn(
          `Failed to delete profile picture for user ${userId}`,
          cloudinaryError
        );
        // Continue with account deletion even if image deletion fails
      }
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    logger.info(`User account deleted: ${userId}`);

    return res.status(200).json({
      status: true,
      message: "Account deleted successfully",
      data: null,
    });
  } catch (err) {
    logger.error("Delete account error", err);
    next(err);
  }
}
module.exports = {
  deleteAccount,
  changePassword,
  editProfile,
  updateLocation,
};
