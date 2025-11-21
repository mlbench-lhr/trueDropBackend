const Journal = require("../models/Journal");
const logger = require("../utils/logger");

// Create a new journal entry
async function addJournal(req, res, next) {
  try {
    const { journals } = req.body;
    const userId = req.user.userId;

    if (!journals || !Array.isArray(journals) || journals.length === 0) {
      return res.status(200).json({
        status: false,
        message:
          "Journals array is required and must contain at least one entry",
        data: null,
      });
    }

    // Validate each journal entry
    for (const journal of journals) {
      if (!journal.feeling || !journal.description) {
        return res.status(200).json({
          status: false,
          message: "Each journal entry must have feeling and description",
          data: null,
        });
      }
    }

    // Prepare journal entries with userId
    const journalEntries = journals.map((journal) => ({
      userId,
      feeling: journal.feeling,
      description: journal.description,
    }));

    // Insert all journals at once
    const createdJournals = await Journal.insertMany(journalEntries);

    return res.status(200).json({
      status: true,
      message: `${createdJournals.length} journal ${
        createdJournals.length === 1 ? "entry" : "entries"
      } created successfully`,
      data: createdJournals.map((journal) => ({
        _id: journal._id,
        userId: journal.userId,
        feeling: journal.feeling,
        description: journal.description,
        createdAt: journal.createdAt,
        updatedAt: journal.updatedAt,
      })),
    });
  } catch (err) {
    logger.error("Add journal error", err);
    next(err);
  }
}

// Get all journal entries for the authenticated user
async function getAllJournals(req, res, next) {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const journals = await Journal.find({ userId })
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Journal.countDocuments({ userId });

    return res.status(200).json({
      status: true,
      message: "Journals retrieved successfully",
      data: {
        journals,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (err) {
    logger.error("Get journals error", err);
    next(err);
  }
}

// Update a journal entry
async function updateJournal(req, res, next) {
  try {
    const { journalId } = req.params;
    const { feeling, description } = req.body;
    const userId = req.user.userId;

    if (!feeling && !description) {
      return res.status(200).json({
        status: false,
        message: "At least one field (feeling or description) is required",
        data: null,
      });
    }

    const journal = await Journal.findOne({ _id: journalId, userId });

    if (!journal) {
      return res.status(200).json({
        status: false,
        message: "Journal entry not found",
        data: null,
      });
    }

    if (feeling) journal.feeling = feeling;
    if (description) journal.description = description;

    await journal.save();

    return res.status(200).json({
      status: true,
      message: "Journal entry updated successfully",
      data: {
        journal: {
          _id: journal._id,
          userId: journal.userId,
          feeling: journal.feeling,
          description: journal.description,
          createdAt: journal.createdAt,
          updatedAt: journal.updatedAt,
        },
      },
    });
  } catch (err) {
    logger.error("Update journal error", err);
    next(err);
  }
}

// Delete a journal entry
async function deleteJournal(req, res, next) {
  try {
    const { journalId } = req.params;
    const userId = req.user.userId;

    const journal = await Journal.findOneAndDelete({ _id: journalId, userId });

    if (!journal) {
      return res.status(200).json({
        status: false,
        message: "Journal entry not found",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Journal entry deleted successfully",
      data: null,
    });
  } catch (err) {
    logger.error("Delete journal error", err);
    next(err);
  }
}

module.exports = {
  addJournal,
  getAllJournals,
  updateJournal,
  deleteJournal,
};
