const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const loopSpaceSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    members: [
        {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    ],          
    admin: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },  
    class: { 
        type: Schema.Types.ObjectId, 
        ref: "Class", 
        required: true 
    },
    school: { 
        type: Schema.Types.ObjectId, 
        ref: "School", 
        required: true 
    },
    category: { 
        type: String, 
        enum: ["ClassRoom", "Administration", "Staff", "General"],    
        required: true
    },
    feed: [
        {
            itemType: { 
                type: String, 
                enum: ["Notice", "Assignment", "Poll", "Form" , "Attendance" , "Resource"], 
            },
            // Dynamic reference based on itemType
            itemRef: { 
                type: Schema.Types.ObjectId, 
                refPath: "feed.itemType" 
            },
            createdAt: { type: Date, default: Date.now }
        }
    ],
    // Dedicated DoubtBin Section
    doubtBin: [
        {
            type: Schema.Types.ObjectId,
            ref: "Doubt",
        }
    ],
    // Quick Files for the Sidebar
    resources: [
        {
            name: String,
            url: String,
            fileType: String,
            uploadedAt: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

// Indexing for faster class-based lookups
loopSpaceSchema.index({ class: 1 });

module.exports = mongoose.model("LoopSpace", loopSpaceSchema);