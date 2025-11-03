const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserMilestonesSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    milestoneId: {
      type: Schema.Types.ObjectId,
      ref: "Milestones",
      required: true,
    },
    completedOn: { type: Date, required: false, default: null },
    soberDays: { type: Number, required: false, default: 0 },
    moneySaved: { type: Number, required: false, default: 0 },
  },
  { timestamps: true }
);

// Index for faster queries
UserMilestonesSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("UserMilestones", UserMilestonesSchema);
