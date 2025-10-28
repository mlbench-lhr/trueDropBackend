const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const validate = require("../middleware/validate");
const validators = require("../middleware/validators");

const multer = require("multer");
const auth = require("../middleware/auth");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.put(
  "/editProfile",
  upload.single("profilePicture"),
  auth,
  validate(validators.editProfile),
  profileController.editProfile
);

router.put(
  "/changePassword",
  auth,
  validate(validators.changePassword),
  profileController.changePassword
);
module.exports = router;
