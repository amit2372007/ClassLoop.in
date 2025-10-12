const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const commentSchema = Schema({
    comment: {
        type: String,
        require: true
    },
    author: {
       type: Schema.Types.ObjectId,
       ref: "User"
    },
    like: {
        type: Number,
        default: 0
    },
    postId: {
        type: Schema.Types.ObjectId,
        ref: "Post"
    }
});

const Comments = mongoose.model("Comment" , commentSchema);

module.exports = Comments;