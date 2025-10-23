const Joi = require('joi');

exports.register = () => Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

exports.login = () => Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

exports.refresh = () => Joi.object({
  refreshToken: Joi.string().required()
});

exports.logout = () => Joi.object({
  refreshToken: Joi.string().required()
});
