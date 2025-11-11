const Coping = require("../models/Coping");
const logger = require("../utils/logger");

// Create a new coping entry
async function addCoping(req, res, next) {
  try {
    const { copings } = req.body;
    const userId = req.user.userId;

    if (!copings || !Array.isArray(copings) || copings.length === 0) {
      return res.status(400).json({
        status: false,
        message:
          "Copings array is required and must contain at least one entry",
        data: null,
      });
    }

    // Validate feeling enum
    for (const coping of copings) {
      if (!coping.feeling || !coping.strategy || !coping.description) {
        return res.status(400).json({
          status: false,
          message:
            "Each coping entry must include feeling, strategy, and description",
          data: null,
        });
      }
    }

    const copingEntries = copings.map((c) => ({
      userId,
      feeling: c.feeling,
      strategy: c.strategy,
      description: c.description,
    }));

    const createdCopings = await Coping.insertMany(copingEntries);

    return res.status(201).json({
      status: true,
      message: `${createdCopings.length} coping ${
        createdCopings.length === 1 ? "entry" : "entries"
      } created successfully`,
      data: createdCopings.map((c) => ({
        _id: c._id,
        feeling: c.feeling,
        strategy: c.strategy,
        description: c.description,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
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
      feeling,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    // Build query filter
    const filter = { userId };
    if (feeling) {
      filter.feeling = feeling;
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
    const { feeling, strategy, description } = req.body;
    const userId = req.user.userId;

    if (!feeling && !strategy && !description) {
      return res.status(400).json({
        status: false,
        message:
          "At least one field (feeling, strategy, or description) is required",
        data: null,
      });
    }

    const coping = await Coping.findOne({ _id: copingId, userId });

    if (!coping) {
      return res.status(404).json({
        status: false,
        message: "Coping entry not found",
        data: null,
      });
    }

    if (feeling) coping.feeling = feeling;
    if (strategy) coping.strategy = strategy;
    if (description) coping.description = description;

    await coping.save();

    return res.status(200).json({
      status: true,
      message: "Coping entry updated successfully",
      data: {
        coping: {
          _id: coping._id,
          feeling: coping.feeling,
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
