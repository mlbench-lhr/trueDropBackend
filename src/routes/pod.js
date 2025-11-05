const express = require("express");
const router = express.Router();
const podController = require("../controllers/podController");
const auth = require("../middleware/auth");

router.post("/createPod", auth, podController.createPod);
router.put("/editPod/:id", auth, podController.editPod);
router.delete("/deletePod/:id", auth, podController.deletePod);
router.get("/searchUsers", auth, podController.searchUsers);

module.exports = router;
