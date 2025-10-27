const mongoose = require("mongoose");
const { Schema } = mongoose;

const goalSchema = new Schema({
  amount: { type: Number, required: false },
  frequency: {
    type: String,
    required: false,
    enum: ["daily", "weekly", "monthly"],
  },
  goalType: { type: String, required: false },
  onAverage: { type: Number, required: false },
  actualGoal: { type: Number, required: false },
});

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  userName: { type: String, required: true },
  passwordHash: { type: String, required: false },
  provider: {
    type: String,
    enum: ["local", "google", "facebook", "apple"],
    default: "local",
    required: true,
  },
  providerId: { type: String, required: false },
  isEmailVerified: { type: Boolean, default: false },
  profilePicture: { type: String, required: false, default: null },
  alcoholType: { type: String, required: true },
  improvement: [{ type: String, required: true }],
  goal: { type: goalSchema, required: true },
  createdAt: { type: Date, default: Date.now },
  resetPasswordToken: { type: String, required: false },
  resetPasswordExpires: { type: Date, required: false },
});
UserSchema.index(
  { provider: 1, providerId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { providerId: { $exists: true, $ne: null } },
  }
);

module.exports = mongoose.model("User", UserSchema);
