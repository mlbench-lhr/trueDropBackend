const Milestones = require("../models/Milestones");
const User = require("../models/User");
const UsersMilestones = require("../models/UsersMilestones");
const logger = require("../utils/logger");

// Create a new milestones entry
async function updateMilestones(req, res, next) {
  try {
    const {
      milestoneId,
      soberDays,
      completedOn,
      completedMilestoneId,
      completedDate,
    } = req.body;
    const userId = req.user.userId;

    if (!milestoneId || !userId) {
      return res.status(400).json({
        status: false,
        message: "milestoneId and userId is required",
        data: null,
      });
    }
    const userFromDb = await User.findById(userId);
    const frequencyInNumber = { daily: 1, weekly: 7, monthly: 30 };
    const moneySaved =
      (soberDays / frequencyInNumber[userFromDb?.goal?.frequency]) *
      userFromDb?.goal?.amount;
    let userMilestone = await UsersMilestones.findOne({
      userId,
      milestoneId,
    }).populate(
      "milestoneId",
      "frequency tag title description dayCount nextMilestone _id"
    );
    let milestoneForResponse = {};
    if (userMilestone) {
      milestoneForResponse = userMilestone.milestoneId;
      userMilestone.soberDays = soberDays;
      userMilestone.completedOn = completedOn;
      userMilestone.moneySaved = moneySaved;
      if (soberDays >= milestoneForResponse.dayCount || completedOn) {
        userMilestone.completedOn = new Date();
      }
      await userMilestone.save();
    } else {
      const milestoneFromDb = await Milestones.findById(milestoneId).select(
        "frequency tag title description dayCount nextMilestone _id"
      );
      milestoneForResponse = milestoneFromDb;
      userMilestone = new UsersMilestones({
        userId,
        milestoneId,
        completedOn,
        soberDays,
        moneySaved,
      });
      await userMilestone.save();
    }
    let currentMilestone = milestoneForResponse;
    let nextMilestone = await Milestones.findById(
      currentMilestone.nextMilestone
    ).select("_id frequency tag title description dayCount nextMilestone");
    if (soberDays >= currentMilestone.dayCount || completedOn) {
      userMilestone.completedOn = new Date();
      currentMilestone = nextMilestone;
      if (nextMilestone?.nextMilestone) {
        nextMilestone = await Milestones.findById(
          nextMilestone.nextMilestone
        ).select("_id frequency tag title description dayCount");
      } else {
        nextMilestone = null;
      }
    }
    console.log("currentMilestone", currentMilestone);
    console.log("nextMilestone", nextMilestone);
    if (completedMilestoneId && completedDate) {
      let updateCompleted = await UsersMilestones.updateOne({
        userId: userId,
        milestoneId: completedMilestoneId,
        completedOn: completedDate,
      });
    }
    return res.status(201).json({
      status: true,
      message: "Milestone updated successfully",
      data: {
        currentMilestone: {
          _id: currentMilestone._id,
          frequency: currentMilestone.frequency,
          tag: currentMilestone.tag,
          title: currentMilestone.title,
          description: currentMilestone.description,
          dayCount: currentMilestone.dayCount,
          completedOn: userMilestone.completedOn,
          soberDays: userMilestone.soberDays,
          moneySaved: userMilestone.moneySaved,
          updatedAt: userMilestone.updatedAt,
        },
        nextMilestone: nextMilestone
          ? {
              _id: nextMilestone._id,
              frequency: nextMilestone.frequency,
              tag: nextMilestone.tag,
              title: nextMilestone.title,
              description: nextMilestone.description,
              dayCount: nextMilestone.dayCount,
            }
          : null,
      },
    });
  } catch (err) {
    logger.error("Add/Update milestones error", err);
    next(err);
  }
}

// Get all milestones entries for the authenticated user
async function getAllMilestones(req, res, next) {
  try {
    const { frequency } = req.query;
    console.log("frequency-------", frequency);
    const filter = { frequency: frequency };
    const milestones = await Milestones.find(filter)
      .sort({ createdAt: 1 })
      .select("tag description title _id dayCount")
      .lean();
    return res.status(200).json({
      status: true,
      message: "Milestones retrieved successfully",
      data: milestones,
    });
  } catch (err) {
    logger.error("Get milestones error", err);
    next(err);
  }
}

async function getMilestonesHistory(req, res, next) {
  try {
    const userId = req.user.userId;
    const milestones = await UsersMilestones.find({ userId: userId })
      .sort({ createdAt: 1 })
      .select("milestoneId -_id")
      .populate("milestoneId", "tag description title _id dayCount")
      .lean();
    const milestoneForResponse = milestones.map((item) => {
      return {
        _id: item?.milestoneId?._id,
        title: item?.milestoneId?.title,
        tag: item?.milestoneId?.tag,
        description: item?.milestoneId?.description,
        dayCount: item?.milestoneId?.dayCount,
        completedOn: item?.completedOn || null,
      };
    });
    return res.status(200).json({
      status: true,
      message: "Milestones retrieved successfully",
      data: milestoneForResponse,
    });
  } catch (err) {
    logger.error("Get milestones error", err);
    next(err);
  }
}

// Delete a milestones entry
async function deleteMilestones(req, res, next) {
  try {
    const { milestonesId } = req.params;
    const userId = req.user.userId;

    const milestones = await Milestones.findOneAndDelete({
      _id: milestonesId,
      userId,
    });

    if (!milestones) {
      return res.status(404).json({
        status: false,
        message: "Milestones entry not found",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Milestones entry deleted successfully",
      data: null,
    });
  } catch (err) {
    logger.error("Delete milestones error", err);
    next(err);
  }
}

module.exports = {
  updateMilestones,
  getAllMilestones,
  deleteMilestones,
  getMilestonesHistory,
};
