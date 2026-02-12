const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const noticeSchema = new Schema({
    school: { 
        type: Schema.Types.ObjectId, 
        ref: "School", 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    content: { 
        type: String, 
        required: true 
    },
    // The "Target" logic
    audience: { 
        type: String, 
        enum: ["all", "teachers", "students", "specific_class"], 
        default: "all" 
    },
    // If audience is "specific_class", this field is used
    targetClass: { 
        type: Schema.Types.ObjectId, 
        ref: "Class" 
    },
    author: { 
        type: Schema.Types.ObjectId, 
        ref: "User" 
    }, // Principal or Admin
    priority: { 
        type: String, 
        enum: ["low", "medium", "high"], 
        default: "medium" 
    },
    expiresAt: { 
        type: Date 
    }, // Auto-hide old notices
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model("Notice", noticeSchema);