const Coping = require("../models/Coping");
const logger = require("../utils/logger");

// Create a new coping entry
async function addCoping(req, res, next) {
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

    const coping = new Coping({
      userId,
      tag,
      title,
      strategy,
      description,
    });

    await coping.save();

    return res.status(201).json({
      status: true,
      message: "Coping entry created successfully",
      data: {
        coping: {
          _id: coping._id,
          tag: coping.tag,
          title: coping.title,
          strategy: coping.strategy,
          description: coping.description,
          createdAt: coping.createdAt,
          updatedAt: coping.updatedAt,
        },
      },
    });
  } catch (err) {
    logger.error("Add coping error", err);
    next(err);
  }
}

// Get all coping entries for the authenticated user
async function getAllCopings(req, res, next) {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      tag,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    // Build query filter
    const filter = { userId };
    if (tag) {
      filter.tag = tag;
    }

    const copings = await Coping.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Coping.countDocuments(filter);

    return res.status(200).json({
      status: true,
      message: "Copings retrieved successfully",
      data: {
        copings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (err) {
    logger.error("Get copings error", err);
    next(err);
  }
}

// Update a coping entry
async function updateCoping(req, res, next) {
  try {
    const { copingId } = req.params;
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

    const coping = await Coping.findOne({ _id: copingId, userId });

    if (!coping) {
      return res.status(404).json({
        status: false,
        message: "Coping entry not found",
        data: null,
      });
    }

    if (tag) coping.tag = tag;
    if (title) coping.title = title;
    if (strategy) coping.strategy = strategy;
    if (description) coping.description = description;

    await coping.save();

    return res.status(200).json({
      status: true,
      message: "Coping entry updated successfully",
      data: {
        coping: {
          _id: coping._id,
          tag: coping.tag,
          title: coping.title,
          strategy: coping.strategy,
          description: coping.description,
          createdAt: coping.createdAt,
          updatedAt: coping.updatedAt,
        },
      },
    });
  } catch (err) {
    logger.error("Update coping error", err);
    next(err);
  }
}

// Delete a coping entry
async function deleteCoping(req, res, next) {
  try {
    const { copingId } = req.params;
    const userId = req.user.userId;

    const coping = await Coping.findOneAndDelete({ _id: copingId, userId });

    if (!coping) {
      return res.status(404).json({
        status: false,
        message: "Coping entry not found",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Coping entry deleted successfully",
      data: null,
    });
  } catch (err) {
    logger.error("Delete coping error", err);
    next(err);
  }
}

module.exports = {
  addCoping,
  getAllCopings,
  updateCoping,
  deleteCoping,
};
