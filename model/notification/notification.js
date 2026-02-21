const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
  // The person receiving the notification
  receiver: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // The person who triggered the notification (null for system alerts)
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  // Category of notification
  type: {
    type: String,
    enum: [
      "LIKE",
      "COMMENT",
      "ATTENDANCE",
      "ASSIGNMENT",
      "NOTICE",
      "DOUBT_SOLVED",
      "EXAM",
      "APPLICATION",
      "REQUEST_REJECT",
      "REQUEST_APPROVED"
    ],
    required: true,
  },
  // The message to be displayed
  message: {
    type: String,
    required: true,
  },
  // Link to redirect the user when they click the notification
  link: {
    type: String,
    default: "/home",
  },
  // To track if the user has seen it
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000, // Automatically delete notifications after 30 days (60*60*24*30)
  },
});

// Indexing for faster retrieval of a user's latest notifications
notificationSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
