const express = require("express");
const router = express.Router();
const journalController = require("../controllers/journalController");
const validate = require("../middleware/validate");
const validators = require("../middleware/validators");
const auth = require("../middleware/auth");

// Create a new journal entry
router.post(
  "/add",
  auth,
  validate(validators.addJournal),
  journalController.addJournal
);

// Get all journal entries
router.get("/getAll", auth, journalController.getAllJournals);

// Update a journal entry
router.put(
  "/:journalId",
  auth,
  validate(validators.updateJournal),
  journalController.updateJournal
);

// Delete a journal entry
router.delete("/:journalId", auth, journalController.deleteJournal);

module.exports = router;
