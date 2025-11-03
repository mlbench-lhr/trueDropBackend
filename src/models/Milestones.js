const mongoose = require("mongoose");
const { Schema } = mongoose;

const MilestonesSchema = new Schema(
  {
    frequency: { type: String, required: true },
    title: { type: String, required: true },
    tag: { type: String, required: true },
    description: { type: String, required: true },
    dayCount: { type: Number, required: true },
    nextMilestone: { type: Schema.Types.ObjectId},
  },
  { timestamps: true }
);

// Index for faster queries
MilestonesSchema.index({ frequency: 1, createdAt: -1 });

module.exports = mongoose.model("Milestones", MilestonesSchema);
