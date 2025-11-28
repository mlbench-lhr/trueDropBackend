const Fields = require("../models/Fields");
const connectDB = require("../db/mongo");

// Get all fields grouped by type
async function getAllFields(req, res, next) {
  try {
    await connectDB();
    const fields = await Fields.find().lean();

    const grouped = fields.reduce((acc, field) => {
      if (!acc[field.field]) acc[field.field] = [];
      acc[field.field].push({
        _id: field._id,
        name: field.name,
      });
      return acc;
    }, {});

    return res.status(200).json({
      status: true,
      message: "Fields fetched successfully",
      data: grouped,
    });
  } catch (err) {
    console.error("Get all fields error:", err);
    next(err);
  }
}

module.exports = { getAllFields };
