const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const examSchema = new Schema({
    examName: {
        type: String,
        required: true, // e.g., "Mid-Term 2026" or "Unit Test 1"
        trim: true
    },
    subject: {
        type: String,
        required: true // e.g., "Mathematics"
    },
    totalMarks: {
        type: Number,
        required: true
    },
    examDate: {
        type: Date,
        default: Date.now
    },
    class: {
        type: Schema.Types.ObjectId,
        ref: "LoopSpace", // Links to the specific classroom
        required: true
    },
    teacher: {
        type: Schema.Types.ObjectId,
        ref: "User", // The teacher who created the entry
        required: true
    },
    // The actual marks for each student
    results: [{
        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        marksObtained: {
            type: Number,
            required: true,
            min: 0
        },
        remarks: {
            type: String,
            trim: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Validation to ensure marksObtained doesn't exceed totalMarks
examSchema.path('results').schema.pre('validate', function(next) {
    const parent = this.ownerDocument();
    if (this.marksObtained > parent.totalMarks) {
        return next(new Error('Obtained marks cannot be greater than total marks.'));
    }
    next();
});

module.exports = mongoose.model("Exam", examSchema);