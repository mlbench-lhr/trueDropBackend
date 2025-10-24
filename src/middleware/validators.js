const Joi = require("joi");

exports.register = () =>
  Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    password: Joi.string().min(8).required(),
    alcoholType: Joi.string().required(),
    improvement: Joi.array().items(Joi.string()).min(1).required(),
    goal: Joi.object({
      amount: Joi.number().required(),
      frequency: Joi.string().required(),
      goalType: Joi.string().required(),
      onAverage: Joi.string().optional().allow(""),
      actualGoal: Joi.string().optional().allow(""),
    }).required(),
  });

exports.login = () =>
  Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  });

exports.socialRegister = () =>
  Joi.object({
    provider: Joi.string().valid("google", "facebook", "apple").required(),
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
      onAverage: Joi.string().optional().allow(""),
      actualGoal: Joi.string().optional().allow(""),
    }).required(),
  });

exports.socialLogin = () =>
  Joi.object({
    provider: Joi.string().valid("google", "facebook", "apple").required(),
    providerId: Joi.string().required(),
    email: Joi.string().email().optional(), // Optional fallback for matching
  });
exports.refresh = () =>
  Joi.object({
    refreshToken: Joi.string().required(),
  });

exports.logout = () =>
  Joi.object({
    refreshToken: Joi.string().required(),
  });
