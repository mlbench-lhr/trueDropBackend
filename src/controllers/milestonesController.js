const Milestones = require("../models/Milestones");
const logger = require("../utils/logger");

// Create a new milestones entry
async function addMilestones(req, res, next) {
  try {
    const { tag, title, strategy, description } = req.body;
    const userId = req.user.userId;

    if (!tag || !title || !strategy || !description) {
      return res.status(400).json({
        status: false,
        message: "Tag, title, strategy, and description are required",
        data: null,
      });
    }

    // Validate tag enum
    const validTags = ["Quick Relief", "Get Moving", "Inner Peace"];
    if (!validTags.includes(tag)) {
      return res.status(400).json({
        status: false,
        message:
          "Invalid tag. Must be one of: Quick Relief, Get Moving, Inner Peace",
        data: null,
      });
    }

    const milestones = new Milestones({
      userId,
      tag,
      title,
      strategy,
      description,
    });

    await milestones.save();

    return res.status(201).json({
      status: true,
      message: "Milestones entry created successfully",
      data: {
        milestones: {
          _id: milestones._id,
          tag: milestones.tag,
          title: milestones.title,
          strategy: milestones.strategy,
          description: milestones.description,
          createdAt: milestones.createdAt,
          updatedAt: milestones.updatedAt,
        },
      },
    });
  } catch (err) {
    logger.error("Add milestones error", err);
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
      .sort({ createdAt: -1 })
      .select("tag description title _id")
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

// Update a milestones entry
async function updateMilestones(req, res, next) {
  try {
    const { milestonesId } = req.params;
    const { tag, title, strategy, description } = req.body;
    const userId = req.user.userId;

    if (!tag && !title && !strategy && !description) {
      return res.status(400).json({
        status: false,
        message:
          "At least one field (tag, title, strategy, or description) is required",
        data: null,
      });
    }

    // Validate tag enum if provided
    if (tag) {
      const validTags = ["Quick Relief", "Get Moving", "Inner Peace"];
      if (!validTags.includes(tag)) {
        return res.status(400).json({
          status: false,
          message:
            "Invalid tag. Must be one of: Quick Relief, Get Moving, Inner Peace",
          data: null,
        });
      }
    }

    const milestones = await Milestones.findOne({ _id: milestonesId, userId });

    if (!milestones) {
      return res.status(404).json({
        status: false,
        message: "Milestones entry not found",
        data: null,
      });
    }

    if (tag) milestones.tag = tag;
    if (title) milestones.title = title;
    if (strategy) milestones.strategy = strategy;
    if (description) milestones.description = description;

    await milestones.save();

    return res.status(200).json({
      status: true,
      message: "Milestones entry updated successfully",
      data: {
        milestones: {
          _id: milestones._id,
          tag: milestones.tag,
          title: milestones.title,
          strategy: milestones.strategy,
          description: milestones.description,
          createdAt: milestones.createdAt,
          updatedAt: milestones.updatedAt,
        },
      },
    });
  } catch (err) {
    logger.error("Update milestones error", err);
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
  addMilestones,
  getAllMilestones,
  updateMilestones,
  deleteMilestones,
};
