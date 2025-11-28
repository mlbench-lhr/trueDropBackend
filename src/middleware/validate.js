module.exports = function validate(schemaFn) {
  return (req, res, next) => {
    try {
      const schema = schemaFn();
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return res.status(200).json({
          status: 200,
          message: error.details?.[0]?.message || "validation error",
          data: [],
        });
      }
      req.body = value;
      return next();
    } catch (err) {
      next(err);
    }
  };
};
