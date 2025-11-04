const express = require("express");
const router = express.Router();
const milestonesController = require("../controllers/milestonesController");
const validate = require("../middleware/validate");
const validators = require("../middleware/validators");
const auth = require("../middleware/auth");

// Create a new milestones entry
router.post(
  "/updateMilestone",
  auth,
  validate(validators.updateMilestones),
  milestonesController.updateMilestones
);

// Get all milestones entries
router.get("/getAll", milestonesController.getAllMilestones);
router.get(
  "/getMilestoneHistory",
  auth,
  milestonesController.getMilestonesHistory
);

// Update a milestones entry
router.put(
  "/:milestonesId",
  auth,
  validate(validators.updateMilestones),
  milestonesController.updateMilestones
);

// Delete a milestones entry
router.delete("/:milestonesId", auth, milestonesController.deleteMilestones);

module.exports = router;
