const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const classRequestSchema = Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: "Class",
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

const classRequest = mongoose.model("classRequest", classRequestSchema);
module.exports = classRequest;
