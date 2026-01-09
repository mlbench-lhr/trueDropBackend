const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const validate = require("../middleware/validate");
const validators = require("../middleware/validators");
const { getAllFields } = require("../controllers/fieldController");

router.post(
  "/register",
  validate(validators.register),
  authController.register
);
router.post("/login", validate(validators.login), authController.login);
router.post(
  "/socialLoginSignUp",
  validate(validators.socialAuth),
  authController.socialAuth
);
router.post(
  "/forgot-password",
  validate(validators.forgotPassword),
  authController.forgotPassword
);
router.post(
  "/verify-reset-code",
  validate(validators.verifyResetCode),
  authController.verifyResetCode
);
router.post(
  "/reset-password",
  validate(validators.resetPassword),
  authController.resetPassword
);
router.get("/getFields", getAllFields);
router.post("/logout", authController.logout);
module.exports = router;
