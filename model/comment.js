const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// 1. DEFINE THE REPLY STRUCTURE (Sub-document)
const replySchema = new Schema({
    content: {
        type: String,
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    likes: [
        {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// 2. DEFINE THE MAIN COMMENT SCHEMA
const commentSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    postId: {
        type: Schema.Types.ObjectId,
        ref: "Post"
    },
    likes: [
        {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    // IMPORTANT: Change this from [Schema.Types.ObjectId] to [replySchema]
    reply: [replySchema], 
    
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Comments = mongoose.model("Comment", commentSchema);
module.exports = Comments;