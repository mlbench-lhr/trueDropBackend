const express = require("express");
const router = express.Router();
const podController = require("../controllers/podController");
const auth = require("../middleware/auth");

router.post("/createPod", auth, podController.createPod);

module.exports = router;
