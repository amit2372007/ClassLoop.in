const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const schoolRequestSchema = Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: "School",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "blocked"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const schoolRequest = mongoose.model("schoolRequest", schoolRequestSchema);
module.exports = schoolRequest;
