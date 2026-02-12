const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    date: { type: Date, default: Date.now },
    records: [
        {
            student: { type: Schema.Types.ObjectId, ref: "User" },
            status: { 
                type: String, 
                enum: ["Present", "Absent", "Late", "Leave"], 
                default: "Present" 
            },
            remarks: String // e.g., "Medical leave"
        }
    ],
    takenBy: { type: Schema.Types.ObjectId, ref: "User" } // The teacher who marked it
});

// Indexing date and class for faster searching
attendanceSchema.index({ date: 1, class: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);