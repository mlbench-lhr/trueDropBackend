const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const validators = require('../middleware/validators');

router.post('/register', validate(validators.register), authController.register);
router.post('/login', validate(validators.login), authController.login);
router.post('/socialLoginSignUp', validate(validators.socialAuth), authController.socialAuth);
router.post('/logout', validate(validators.logout), authController.logout);
router.post('/forgot-password', validate(validators.forgotPassword), authController.forgotPassword);
router.post('/verify-reset-code', validate(validators.verifyResetCode), authController.verifyResetCode);
router.post('/reset-password', validate(validators.resetPassword), authController.resetPassword);

module.exports = router;
