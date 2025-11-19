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

    // Find or create user milestone
    let userMilestone = await UsersMilestones.findOne({
      userId,
      milestoneId,
    }).populate(
      "milestoneId",
      "frequency tag title description dayCount nextMilestone _id"
    );

    let milestoneForResponse = {};

    if (userMilestone) {
      // Update existing milestone
      milestoneForResponse = userMilestone.milestoneId;
      userMilestone.soberDays = soberDays;
      userMilestone.moneySaved = moneySaved;

      // Mark as completed if soberDays threshold is met
      if (soberDays >= milestoneForResponse.dayCount) {
        userMilestone.completedOn = new Date();
      }

      // Update completedOn if provided in payload
      if (completedOn) {
        userMilestone.completedOn = completedOn;
      }

      await userMilestone.save();
    } else {
      // Create new milestone entry
      const milestoneFromDb = await Milestones.findById(milestoneId).select(
        "frequency tag title description dayCount nextMilestone _id"
      );
      milestoneForResponse = milestoneFromDb;

      let completedOnValue = null;
      if (soberDays >= milestoneFromDb.dayCount) {
        completedOnValue = new Date();
      } else if (completedOn) {
        completedOnValue = completedOn;
      }

      userMilestone = new UsersMilestones({
        userId,
        milestoneId,
        completedOn: completedOnValue,
        soberDays,
        moneySaved,
      });
      await userMilestone.save();
    }

    let currentMilestone = null;
    let nextMilestone = null;
    let completedMilestoneRef = null;

    // Handle completedMilestoneId logic (Case 3)
    if (completedMilestoneId && completedDate) {
      await UsersMilestones.findOneAndUpdate(
        {
          userId: userId,
          milestoneId: completedMilestoneId,
        },
        {
          completedOn: new Date(completedDate),
        },
        { upsert: true, new: true }
      );

      // Fetch the completed milestone
      completedMilestoneRef = await Milestones.findById(
        completedMilestoneId
      ).select("_id frequency tag title description dayCount nextMilestone");

      // Get the 2 milestones after the completed milestone
      if (completedMilestoneRef) {
        // First milestone after completed
        if (completedMilestoneRef.nextMilestone) {
          currentMilestone = await Milestones.findById(
            completedMilestoneRef.nextMilestone
          ).select(
            "_id frequency tag title description dayCount nextMilestone"
          );
        } else {
          // Create first milestone if it doesn't exist
          currentMilestone = await createNextMilestone(completedMilestoneRef);
        }

        // Create or get UserMilestone for currentMilestone
        let currentUserMilestone = await UsersMilestones.findOne({
          userId,
          milestoneId: currentMilestone._id,
        });

        if (!currentUserMilestone) {
          currentUserMilestone = new UsersMilestones({
            userId,
            milestoneId: currentMilestone._id,
            completedOn: null,
            soberDays: 0,
            moneySaved: 0,
          });
          await currentUserMilestone.save();
        }

        // Second milestone after completed
        if (currentMilestone) {
          if (currentMilestone.nextMilestone) {
            nextMilestone = await Milestones.findById(
              currentMilestone.nextMilestone
            ).select(
              "_id frequency tag title description dayCount nextMilestone"
            );
          } else {
            // Create second milestone if it doesn't exist
            nextMilestone = await createNextMilestone(currentMilestone);
          }

          // Create or get UserMilestone for nextMilestone
          if (nextMilestone) {
            let nextUserMilestone = await UsersMilestones.findOne({
              userId,
              milestoneId: nextMilestone._id,
            });

            if (!nextUserMilestone) {
              nextUserMilestone = new UsersMilestones({
                userId,
                milestoneId: nextMilestone._id,
                completedOn: null,
                soberDays: 0,
                moneySaved: 0,
              });
              await nextUserMilestone.save();
            }
          }
        }
      }
    } else {
      // Regular flow (Case 1 & 2)
      currentMilestone = milestoneForResponse;

      // If current milestone is completed, advance to next
      if (userMilestone.completedOn && currentMilestone.nextMilestone) {
        const tempNext = await Milestones.findById(
          currentMilestone.nextMilestone
        ).select("_id frequency tag title description dayCount nextMilestone");

        if (tempNext) {
          currentMilestone = tempNext;

          // Create or get UserMilestone for currentMilestone
          let currentUserMilestone = await UsersMilestones.findOne({
            userId,
            milestoneId: currentMilestone._id,
          });

          if (!currentUserMilestone) {
            currentUserMilestone = new UsersMilestones({
              userId,
              milestoneId: currentMilestone._id,
              completedOn: null,
              soberDays: 0,
              moneySaved: 0,
            });
            await currentUserMilestone.save();
          }

          // Get next milestone
          if (tempNext.nextMilestone) {
            nextMilestone = await Milestones.findById(
              tempNext.nextMilestone
            ).select(
              "_id frequency tag title description dayCount nextMilestone"
            );
          } else {
            // Create next milestone if it doesn't exist
            nextMilestone = await createNextMilestone(tempNext);
          }

          // Create or get UserMilestone for nextMilestone
          if (nextMilestone) {
            let nextUserMilestone = await UsersMilestones.findOne({
              userId,
              milestoneId: nextMilestone._id,
            });

            if (!nextUserMilestone) {
              nextUserMilestone = new UsersMilestones({
                userId,
                milestoneId: nextMilestone._id,
                completedOn: null,
                soberDays: 0,
                moneySaved: 0,
              });
              await nextUserMilestone.save();
            }
          }
        }
      } else if (currentMilestone.nextMilestone) {
        // Current milestone not completed, just get next milestone
        nextMilestone = await Milestones.findById(
          currentMilestone.nextMilestone
        ).select("_id frequency tag title description dayCount nextMilestone");

        if (!nextMilestone) {
          // Create next milestone if it doesn't exist
          nextMilestone = await createNextMilestone(currentMilestone);
        }

        // Create or get UserMilestone for nextMilestone
        if (nextMilestone) {
          let nextUserMilestone = await UsersMilestones.findOne({
            userId,
            milestoneId: nextMilestone._id,
          });

          if (!nextUserMilestone) {
            nextUserMilestone = new UsersMilestones({
              userId,
              milestoneId: nextMilestone._id,
              completedOn: null,
              soberDays: 0,
              moneySaved: 0,
            });
            await nextUserMilestone.save();
          }
        }
      } else {
        // Create next milestone if current doesn't have one
        nextMilestone = await createNextMilestone(currentMilestone);

        // Create UserMilestone for the newly created nextMilestone
        if (nextMilestone) {
          let nextUserMilestone = new UsersMilestones({
            userId,
            milestoneId: nextMilestone._id,
            completedOn: null,
            soberDays: 0,
            moneySaved: 0,
          });
          await nextUserMilestone.save();
        }
      }
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

// Helper function to create next milestone
async function createNextMilestone(previousMilestone) {
  const newDayCount =
    previousMilestone.dayCount + getDayIncrement(previousMilestone.frequency);

  const newMilestone = new Milestones({
    frequency: previousMilestone.frequency,
    title: `${newDayCount} Days Milestone`,
    tag: `${newDayCount}-days`,
    description: `Completed ${newDayCount} days of sobriety`,
    dayCount: newDayCount,
    nextMilestone: null,
  });

  await newMilestone.save();

  // Update previous milestone's nextMilestone reference
  await Milestones.findByIdAndUpdate(previousMilestone._id, {
    nextMilestone: newMilestone._id,
  });

  return newMilestone;
}

// Helper function to get day increment based on frequency
function getDayIncrement(frequency) {
  const increments = {
    daily: 1,
    weekly: 7,
    monthly: 30,
  };
  return increments[frequency] || 1;
}

// Helper function to create next milestone
async function createNextMilestone(previousMilestone) {
  const newDayCount =
    previousMilestone.dayCount + getDayIncrement(previousMilestone.frequency);

  const newMilestone = new Milestones({
    frequency: previousMilestone.frequency,
    title: `${newDayCount} Days Milestone`,
    tag: `${newDayCount}-days`,
    description: `Completed ${newDayCount} days of sobriety`,
    dayCount: newDayCount,
    nextMilestone: null,
  });

  await newMilestone.save();

  // Update previous milestone's nextMilestone reference
  await Milestones.findByIdAndUpdate(previousMilestone._id, {
    nextMilestone: newMilestone._id,
  });

  return newMilestone;
}

// Helper function to get day increment based on frequency
function getDayIncrement(frequency) {
  const increments = {
    daily: 1,
    weekly: 7,
    monthly: 30,
  };
  return increments[frequency] || 1;
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
    const {
      page = 1,
      limit = 10,
      sortBy = "dayCount",
      order = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const filter = {
      userId,
      completedOn: { $exists: true, $ne: null },
    };
    const total = await UsersMilestones.countDocuments(filter);
    const milestones = await UsersMilestones.find(filter)
      .select("milestoneId completedOn -_id")
      .populate("milestoneId", "tag description title _id dayCount")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const milestoneForResponse = milestones.map((item) => ({
      _id: item?.milestoneId?._id,
      title: item?.milestoneId?.title,
      tag: item?.milestoneId?.tag,
      description: item?.milestoneId?.description,
      dayCount: item?.milestoneId?.dayCount,
      completedOn: item?.completedOn || null,
    }));
    return res.status(200).json({
      status: true,
      message: "Milestones retrieved successfully",
      data: {
        milestones: milestoneForResponse,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
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
