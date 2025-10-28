const mongoose = require("mongoose");
const { Schema } = mongoose;

const JournalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    feeling: {
      type: String,
      required: true,
      enum: ["good", "weekly", "monthly"],
    },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

// Index for faster queries
JournalSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Journal", JournalSchema);
