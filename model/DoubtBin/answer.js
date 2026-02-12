const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const answerSchema = Schema({
    content:{
        type: String,
        required: true,
        trim: true,
        minlength: [5, "Answer is too short. Please provide more detail."],
        maxlength: [10000, "Answer cannot exceed 10,000 characters"]
    },
    doubtId: {
        type: Schema.Types.ObjectId,
        ref: "Doubt",
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
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
    isAccepted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Answer = mongoose.model("Answer" , answerSchema);

module.exports = Answer;