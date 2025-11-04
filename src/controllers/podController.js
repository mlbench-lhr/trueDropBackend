const Milestones = require("../models/Milestones");
const User = require("../models/User");
const UsersMilestones = require("../models/UsersMilestones");
const logger = require("../utils/logger");

async function createPod(req, res, next) {
  try {
    const frequencyInNumber = { daily: 1, weekly: 7, monthly: 30 };
    const userId = req.user.userId;
    const userFromDb = await User.findById(userId);
    const milestones = await UsersMilestones.find({
      userId,
      completedOn: { $exists: true },
    })
      .sort({ createdAt: -1 })
      .populate("milestoneId")
      .lean();

    let nextMilestones = null;
    if (milestones[0]?.milestoneId?.nextMilestone) {
      nextMilestones = await Milestones.findOne({
        _id: milestones[0]?.milestoneId?.nextMilestone,
      }).lean();
    }
    console.log("nextMilestones-----", nextMilestones);

    const totalSoberDays = milestones.reduce(
      (sum, m) => sum + (m.soberDays || 0),
      0
    );
    const totalMoneySaved = milestones.reduce(
      (sum, m) => sum + (m.moneySaved || 0),
      0
    );

    let nextTotalMoneySaved = 0;
    if (nextMilestones?.dayCount) {
      nextTotalMoneySaved =
        (nextMilestones?.dayCount /
          frequencyInNumber[userFromDb?.goal?.frequency]) *
        userFromDb?.goal?.amount;
    }

    return res.status(200).json({
      status: true,
      message: "Totals retrieved successfully",
      data: {
        total: {
          soberDays: totalSoberDays,
          moneySaved: totalMoneySaved,
        },
        next: {
          willSave: nextTotalMoneySaved,
        },
      },
    });
  } catch (err) {
    logger.error("Get totals error", err);
    next(err);
  }
}

module.exports = { createPod };
