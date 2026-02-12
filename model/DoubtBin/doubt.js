const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const doubtSchema = Schema({
    title: {
        type: String,
        required: true,
        trim: true, // Removes unnecessary whitespace
        minlength: [10, "Title must be at least 10 characters long"],
        maxlength: [150, "Title cannot exceed 150 characters"]
    },
    description:{
        type: String,
        required: true,
        minlength: [30, "Please explain your doubt in at least 30 characters"],
        maxlength: [5000, "Description is too long (max 5000 characters)"]
    },
    tags: [
        {
            type: String,
            trim: true,
            lowercase: true
        }
    ],
    author: {
        type: Schema.Types.ObjectId,
        ref : "User"
    },
    upvote: [
        {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    downvote: [
        {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    views: {
        type: Number,
        default: 0
    },
    isResolved: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    answers: [
        {
            type: Schema.Types.ObjectId,
            ref: "Answer"
        }
    ]
    
});

const Doubt = mongoose.model("Doubt" , doubtSchema);

module.exports = Doubt;