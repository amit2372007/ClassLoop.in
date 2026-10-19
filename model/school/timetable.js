// models/Timetable.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema for individual period slots
const slotSchema = new Schema({
  periodNumber: {
    type: Number,
    required: true, // e.g., 1, 2, 3...
  },
  slotType: {
    type: String,
    enum: ["lecture", "lab", "recess", "assembly", "free"],
    default: "lecture",
  },
  subject: {
    type: String,
    trim: true,
    required: function () {
      return this.slotType === "lecture" || this.slotType === "lab";
    },
  },
  teacher: {
    type: Schema.Types.ObjectId,
    ref: "User", // Links to Subject Teacher
  },
  roomNo: {
    type: String,
    default: "Classroom",
  },
  startTime: {
    type: String, // e.g., "09:00"
    required: true,
  },
  endTime: {
    type: String, // e.g., "09:45"
    required: true,
  },
});

// Schema for daily schedules
const dayScheduleSchema = new Schema({
  day: {
    type: String,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    required: true,
  },
  slots: [slotSchema],
});

// Main Timetable Schema
const timetableSchema = new Schema(
  {
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      unique: true, // One timetable per class per session
    },
    session: {
      type: String,
      required: true,
      default: "2025-26",
    },
    weeklySchedule: [dayScheduleSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Timetable", timetableSchema);
