const mongoose = require("mongoose");
const { Schema } = mongoose;

const chatSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  msg: { type: String, required: false },
  sentAt: { type: Date, default: Date.now },
});

const PodSchema = new Schema(
  {
    name: { type: String, required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    description: { type: String, required: false },
    privacyLevel: { type: String, enum: ["public", "private"] },
    lastActiveTime: { type: Date, default: null },
    lastMessageTime: { type: Date, default: null },
    chat: [chatSchema],
  },
  { timestamps: true }
);

// Index for faster queries
PodSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("UserPod", PodSchema);
