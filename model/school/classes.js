const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const classSchema = Schema({
  className: {
    type: Number,
    required: true,
  },
  section: {
    type: String,
    required: true,
  },
  session: {
    // Essential for tracking different years
    type: String,
    required: true,
    default: "2025-26",
  },
  QRCode: {
    url: String,
    fileId: String,
  },
  students: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  teachers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  school: {
    type: Schema.Types.ObjectId,
    ref: "School",
    required: true,
  },
  classTeacher: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  subjects: [
    {
      name: String,
      teacher: { type: Schema.Types.ObjectId, ref: "User" },
    },
  ],
  // Links to other features
  timetable: [
    {
      day: {
        type: String,
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
      },
      slots: [
        {
          subject: String,
          startTime: String,
          endTime: String,
        },
      ],
    },
  ],
});

const Class = mongoose.model("Class", classSchema);

module.exports = Class;
