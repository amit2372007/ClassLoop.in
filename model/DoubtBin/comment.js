const mongoose = require("moongose");

const Schema = mongoose.Schema;

const commentSchema = Schema({
    content: {
        type: String,
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    relatedto: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: "onModel",
    },
    onModel: {
        type: String,
        required: true,
        enum: ["answer" , "doubt"]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Comment = mongoose.model("Comment" , commentSchema);

module.exports = Comment;