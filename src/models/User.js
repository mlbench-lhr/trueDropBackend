const mongoose = require("mongoose");
const { Schema } = mongoose;

const goalSchema = new Schema({
  amount: { type: Number, required: true },
  frequency: { type: String, required: true },
  goalType: { type: String, required: true },
  onAverage: { type: String, required: false },
  actualGoal: { type: String, required: false },
});

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  alcoholType: { type: String, required: true },
  improvement: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now },
  goal: goalSchema,
});

module.exports = mongoose.model("User", UserSchema);
