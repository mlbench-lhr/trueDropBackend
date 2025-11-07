const Pod = require("../models/Pod");
const User = require("../models/User");
const UsersMilestones = require("../models/UsersMilestones");
const logger = require("../utils/logger");

async function createPod(req, res, next) {
  try {
    const { name, description, members, privacyLevel } = req.body;
    const userId = req.user.userId;
    const dataToSave = new Pod({
      name,
      description,
      privacyLevel,
      members: [...members, userId],
      createdBy: userId,
    });
    const createdPod = await dataToSave.save();
    let populatedPod = await Pod.findById(createdPod._id)
      .populate("members", "firstName lastName userName profilePicture")
      .populate("createdBy", "firstName lastName userName profilePicture")
      .lean();
    const getSoberDays = async (user) => {
      const milestones = await UsersMilestones.find({
        userId: user._id,
        completedOn: { $exists: true },
      }).lean();
      const totalSoberDays = milestones.reduce(
        (sum, m) => sum + (m.soberDays || 0),
        0
      );
      return { ...user, soberDays: totalSoberDays };
    };
    populatedPod.members = await Promise.all(
      populatedPod.members.map((member) => getSoberDays(member))
    );
    populatedPod.createdBy = await getSoberDays(populatedPod.createdBy);

    return res.status(201).json({
      status: true,
      message: "Pod added successfully",
      data: populatedPod,
    });
  } catch (err) {
    logger.error("Add pod error", err);
    next(err);
  }
}
async function editPod(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, members, privacyLevel } = req.body;

    const pod = await Pod.findById(id);
    if (!pod) {
      return res.status(404).json({ status: false, message: "Pod not found" });
    }
    if (name) pod.name = name;
    if (description) pod.description = description;
    if (privacyLevel) pod.privacyLevel = privacyLevel;
    if (members && Array.isArray(members)) pod.members = members;

    const updatedPod = await pod.save();

    return res.status(200).json({
      status: true,
      message: "Pod updated successfully",
      data: updatedPod,
    });
  } catch (err) {
    logger.error("Edit pod error", err);
    next(err);
  }
}
async function joinPod(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const pod = await Pod.findById(id)
      .populate(
        "createdBy",
        "firstName lastName userName profilePicture location"
      )
      .populate(
        "members",
        "firstName lastName userName profilePicture location"
      );
    if (!pod) {
      return res.status(404).json({ status: false, message: "Pod not found" });
    }
    if (!pod.members.includes(userId)) {
      pod.members.push(userId);
    }
    const updatedPod = await pod.save();
    return res.status(200).json({
      status: true,
      message: "Pod updated successfully",
      data: updatedPod,
    });
  } catch (err) {
    logger.error("Edit pod error", err);
    next(err);
  }
}

// DELETE POD
async function deletePod(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const pod = await Pod.findById(id);
    if (!pod) {
      return res.status(404).json({ status: false, message: "Pod not found" });
    }

    await Pod.findByIdAndDelete(id);

    return res.status(200).json({
      status: true,
      message: "Pod deleted successfully",
    });
  } catch (err) {
    logger.error("Delete pod error", err);
    next(err);
  }
}

async function getPods(req, res, next) {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchQuery = req.query.search || "";
    const radiusInKm = 1;
    const skip = (page - 1) * limit;
    const currentUser = await User.findById(userId).select("location");
    if (
      !currentUser ||
      !currentUser.location ||
      !currentUser.location.lat ||
      !currentUser.location.long
    ) {
      return res.status(400).json({
        status: false,
        message: "User location not found. Please update your location.",
      });
    }
    const userLat = currentUser.location.lat;
    const userLong = currentUser.location.long;
    const yourPods = await Pod.find({ members: { $in: [userId] } })
      .populate("members", "firstName lastName userName profilePicture")
      .populate("createdBy", "firstName lastName userName profilePicture")
      .sort({ lastActiveTime: -1, createdAt: -1 });
    const userPodIds = yourPods.map((pod) => pod._id);
    const availablePodsQuery = {
      privacyLevel: "public",
      _id: { $nin: userPodIds },
    };
    if (searchQuery) {
      availablePodsQuery.name = { $regex: searchQuery, $options: "i" };
    }
    const publicPodsWithCreators = await Pod.find(availablePodsQuery)
      .populate({
        path: "createdBy",
        select: "firstName lastName userName profilePicture location",
      })
      .populate("members", "firstName lastName userName profilePicture")
      .lean();
    const availablePodsWithDistance = publicPodsWithCreators
      .map((pod) => {
        if (
          !pod.createdBy ||
          !pod.createdBy.location ||
          !pod.createdBy.location.lat ||
          !pod.createdBy.location.long
        ) {
          return null;
        }
        const creatorLat = pod.createdBy.location.lat;
        const creatorLong = pod.createdBy.location.long;
        const distance = calculateDistance(
          userLat,
          userLong,
          creatorLat,
          creatorLong
        );
        return {
          ...pod,
          distance: distance,
        };
      })
      .filter((pod) => pod !== null && pod.distance <= radiusInKm)
      .sort((a, b) => a.distance - b.distance);
    const totalItems = availablePodsWithDistance.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedAvailablePods = availablePodsWithDistance.slice(
      skip,
      skip + limit
    );
    return res.status(200).json({
      status: true,
      message: "Pods retrieved successfully",
      data: {
        yourPods: yourPods,
        availablePods: paginatedAvailablePods,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalItems,
          itemsPerPage: limit,
        },
      },
    });
  } catch (err) {
    logger.error("Get pods error", err);
    next(err);
  }
}
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

async function searchUsers(req, res, next) {
  try {
    const userId = req.user.userId;
    const { search } = req.query;

    const filter = { _id: { $ne: userId } };

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter).select(
      "_id firstName lastName userName profilePicture"
    );

    const usersWithSoberDays = await Promise.all(
      users.map(async (user) => {
        const milestones = await UsersMilestones.find({
          userId: user._id,
          completedOn: { $exists: true },
        }).lean();

        const totalSoberDays = milestones.reduce(
          (sum, m) => sum + (m.soberDays || 0),
          0
        );

        return {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          profilePicture: user.profilePicture || null,
          soberDays: totalSoberDays,
        };
      })
    );

    return res.status(200).json({
      status: true,
      message: "Users fetched successfully",
      data: usersWithSoberDays,
    });
  } catch (err) {
    logger.error("Search users error:", err);
    next(err);
  }
}

module.exports = {
  createPod,
  getPods,
  searchUsers,
  editPod,
  deletePod,
  joinPod,
};
