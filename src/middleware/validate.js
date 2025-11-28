module.exports = function validate(schemaFn) {
  return (req, res, next) => {
    try {
      const schema = schemaFn();
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const rawMsg = error.details?.[0]?.message || "validation error";
        const message = rawMsg.replace(/"/g, "");
        return res.status(200).json({
          status: false,
          message,
          data: null,
        });
      }
      req.body = value;
      return next();
    } catch (err) {
      next(err);
    }
  };
};
