const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const assignmentSchema = new Schema({
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    subject: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    attachments: [String], // URLs to PDF/Images
    dueDate: { type: Date, required: true },
    postedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // Track who has submitted
    submissions: [
        {
            student: { type: Schema.Types.ObjectId, ref: "User" },
            fileUrl: String,
            fileId : String, // Cloud storage file ID
            submittedAt: { type: Date, default: Date.now },
            grade: String,
            feedback: String,
        },
    ],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Assignment", assignmentSchema);
