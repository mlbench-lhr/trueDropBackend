const mongoose = require("mongoose");
const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    userId: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    to: [{ type: String, required: true }],
    type: {
      type: String,
      required: true,
      enum: [
        "chat",
        "milestone",
        "pod",
        "coping",
        "wallet",
        "profile",
        "journal",
      ],
    },
    notification: {
      title: { type: String, required: true },
      body: { type: String, required: true },
    },
  },
  { timestamps: true }
);

// Index for faster queries
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
