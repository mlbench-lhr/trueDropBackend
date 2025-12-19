const mongoose = require("mongoose");
const { Schema } = mongoose;

const FieldSchema = new Schema({
  name: { type: String, required: true },
  field: { type: String, required: true },
  isOther: { type: Boolean },
});

module.exports = mongoose.model("Field", FieldSchema);
