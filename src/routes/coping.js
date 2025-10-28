const express = require("express");
const router = express.Router();
const copingController = require("../controllers/copingController");
const validate = require("../middleware/validate");
const validators = require("../middleware/validators");
const auth = require("../middleware/auth");

// Create a new coping entry
router.post(
  "/add",
  auth,
  validate(validators.addCoping),
  copingController.addCoping
);

// Get all coping entries
router.get("/getAll", auth, copingController.getAllCopings);

// Update a coping entry
router.put(
  "/:copingId",
  auth,
  validate(validators.updateCoping),
  copingController.updateCoping
);

// Delete a coping entry
router.delete("/:copingId", auth, copingController.deleteCoping);

module.exports = router;
