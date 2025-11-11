const mongoose = require("mongoose");
const { Schema } = mongoose;

const CopingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    feeling: {
      type: String,
      required: true,
    },
    title: { type: String, required: false },
    strategy: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

// Index for faster queries
CopingSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Coping", CopingSchema);
