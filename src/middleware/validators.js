const Joi = require("joi");

exports.register = () =>
  Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    password: Joi.string().min(8).required(),
    alcoholType: Joi.string().required(),
    improvement: Joi.array().items(Joi.string().required()).required(),
    goal: Joi.object({
      amount: Joi.number().required(),
      frequency: Joi.string().required(),
      goalType: Joi.string().required(),
      onAverage: Joi.string().optional(),
      actualGoal: Joi.string().optional(),
    }).required(),
  });

exports.login = () =>
  Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  });

exports.refresh = () =>
  Joi.object({
    refreshToken: Joi.string().required(),
  });

exports.logout = () =>
  Joi.object({
    refreshToken: Joi.string().required(),
  });
