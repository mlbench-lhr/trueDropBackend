const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const validators = require('../middleware/validators');

router.post('/register', validate(validators.register), authController.register);
router.post('/login', validate(validators.login), authController.login);
router.post('/social/register', validate(validators.socialRegister), authController.socialRegister);
router.post('/social/login', validate(validators.socialLogin), authController.socialLogin);
router.post('/logout', validate(validators.logout), authController.logout);

module.exports = router;
