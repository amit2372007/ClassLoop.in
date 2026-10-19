const mongoose = require("mongoose");

const dailyStaffAttendanceSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schools",
      required: true,
    },
    date: {
      type: String, // Stored as 'YYYY-MM-DD'
      required: true,
    },
    records: [
      {
        staffId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          refPath: "records.onModel",
        },
        onModel: {
          type: String,
          required: true,
          enum: ["User", "Employee"],
        },
        status: {
          type: String,
          required: true,
          enum: ["Present", "Absent", "Half-Day", "Leave"],
        },
      },
    ],
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// Unique index guarantees ONLY 1 document exists per school per date
dailyStaffAttendanceSchema.index({ school: 1, date: 1 }, { unique: true });

module.exports = mongoose.model(
  "DailyStaffAttendance",
  dailyStaffAttendanceSchema,
);
