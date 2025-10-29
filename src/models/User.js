const mongoose = require("mongoose");
const { Schema } = mongoose;

const goalSchema = new Schema({
  amount: { type: Number, required: false },
  frequency: {
    type: String,
    required: false,
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
  firstName: { type: String },
  bio: { type: String },
  lastName: { type: String },
  userName: { type: String, required: true },
  passwordHash: { type: String, required: false },
  provider: {
    type: String,
    default: "local",
    required: true,
  },
  providerId: { type: String, required: false },
  isEmailVerified: { type: Boolean, default: false },
  profilePicture: { type: String, required: false, default: null },
  alcoholType: { type: String, required: false }, // ✅ Changed from required: true to false
  improvement: [{ type: String, required: false }], // ✅ Changed from required: true to false
  goal: { type: goalSchema, required: false }, // ✅ Changed from required: true to false
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
