const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const resourceSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    resourceType: {
        type: String,
        enum: ["Notes", "PYQ", "Video", "Assignment Solution", "Other"],
        default: "Notes"
    },
    // For external links (YouTube, Drive, etc.)
    externalLink: {
        type: String,
        required: true
    },
    subject: {
        type: String, // Or ObjectId ref to a Subject model
        required: true
    },
    class: {
        type: Schema.Types.ObjectId,
        ref: "Class", // Links to the specific class/community
        required: true
    },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Resource", resourceSchema);