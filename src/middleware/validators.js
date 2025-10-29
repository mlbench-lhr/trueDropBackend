const Joi = require("joi");

exports.register = () =>
  Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    userName: Joi.string().required(),
    password: Joi.string().min(8).required(),
  });

exports.login = () =>
  Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  });

exports.socialRegister = () =>
  Joi.object({
    provider: Joi.string().required(),
    providerId: Joi.string().required(),
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    profilePicture: Joi.string().uri().optional().allow("", null),
    alcoholType: Joi.string().required(),
    improvement: Joi.array().items(Joi.string()).min(1).required(),
    goal: Joi.object({
      amount: Joi.number().required(),
      frequency: Joi.string().required(),
      goalType: Joi.string().required(),
      onAverage: Joi.number().optional(),
      actualGoal: Joi.number().optional(),
    }).required(),
  });

exports.socialLogin = () =>
  Joi.object({
    provider: Joi.string().required(),
    providerId: Joi.string().required(),
    email: Joi.string().email().optional(), // Optional fallback for matching
  });
exports.socialAuth = () =>
  Joi.object({
    provider: Joi.string().required(),
    providerId: Joi.string().required(),
    email: Joi.string().email().required(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    userName: Joi.string().optional(),
    profilePicture: Joi.string().uri().optional().allow("", null),
  });
exports.addUserDetails = () =>
  Joi.object({
    alcoholType: Joi.string().required(),
    improvement: Joi.array().items(Joi.string()).min(1).required(),
    goal: Joi.object({
      amount: Joi.number().required(),
      frequency: Joi.string().required(),
      goalType: Joi.string().optional(),
      onAverage: Joi.number().optional(),
      actualGoal: Joi.number().optional(),
    }).required(),
  });
exports.refresh = () =>
  Joi.object({
    refreshToken: Joi.string().required(),
  });

exports.logout = () =>
  Joi.object({
    refreshToken: Joi.string().required(),
  });
exports.forgotPassword = () =>
  Joi.object({
    email: Joi.string().email().required(),
  });

exports.verifyResetCode = () =>
  Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).required(),
  });

exports.resetPassword = () =>
  Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).required(),
    newPassword: Joi.string().min(8).required(),
  });

exports.editProfile = () =>
  Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    userName: Joi.string().required(),
    bio: Joi.string().optional(),
  });
exports.changePassword = () =>
  Joi.object({
    currentPassword: Joi.string().required().min(6),
    newPassword: Joi.string().required().min(6),
  });
exports.deleteAccount = () =>
  Joi.object({
    password: Joi.string().when("$provider", {
      is: "local",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  });
// Add to your validators file

exports.addJournal = () =>
  Joi.object({
    journals: Joi.array()
      .items(
        Joi.object({
          feeling: Joi.string().required(),
          description: Joi.string().required(),
        })
      )
      .min(1)
      .required(),
  });

exports.updateJournal = () =>
  Joi.object({
    feeling: Joi.string().optional(),
    description: Joi.string().optional(),
  }).min(1); // At least one field must be present

exports.addCoping = () =>
  Joi.object({
    tag: Joi.string().required(),
    title: Joi.string().required(),
    strategy: Joi.string().required(),
    description: Joi.string().required(),
  });

exports.updateCoping = () =>
  Joi.object({
    tag: Joi.string().required(),
    title: Joi.string().required(),
    strategy: Joi.string().required(),
    description: Joi.string().required(),
  }).min(1); // At least one field must be present
