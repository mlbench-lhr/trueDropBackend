const express = require("express");
const router = express.Router();
const walletController = require("../controllers/walletController");
const auth = require("../middleware/auth");

router.get("/getSaveAndSober", auth, walletController.getSaveAndSober);

module.exports = router;
