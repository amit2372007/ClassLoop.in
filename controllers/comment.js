const Posts = require("../model/post.js");
const Comments = require("../model/comment.js");
const Users = require("../model/User.js");
const Message = require("../model/message.js");

module.exports.likeComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const comment = await Comments.findById(commentId);
        
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        // Check if user already liked the comment
        const userIndex = comment.likes.indexOf(req.user._id);
        let isLiked = false;

        if (userIndex === -1) {
            comment.likes.push(req.user._id);
            isLiked = true;
        } else {
            comment.likes.splice(userIndex, 1);
            isLiked = false;
        }

        await comment.save();

        // Send JSON back to the frontend
        res.json({ 
            success: true, 
            likeCount: comment.likes.length, 
            isLiked: isLiked 
        });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

module.exports.deleteComment = async (req, res) => {
    try {
        const { postId, commentId } = req.params;

        // 1. Remove the comment reference from the Post
        await Posts.findByIdAndUpdate(postId, { $pull: { comments: commentId } });

        // 2. Find and delete the actual comment
        const comment = await Comments.findById(commentId);
        
        // Security check: only author can delete
        if (!comment.author.equals(req.user._id)) {
            req.flash("error", "You do not have permission to delete this comment");
            return res.redirect(`/post/${postId}`);
        }

        await Comments.findByIdAndDelete(commentId);

        req.flash("success", "Comment deleted successfully");
        res.redirect(`/post/${postId}`);
    } catch (err) {
        console.error("Delete Comment Error:", err);
        req.flash("error", "Failed to delete comment");
        res.redirect("back");
    }
};


module.exports.replyOnComment = async (req, res) => {
    console.log("router Hit");
    const { commentId } = req.params;
    const { content } = req.body;

    try {
        // 1. Find the parent comment
        const parentComment = await Comments.findById(commentId);
        
        if (!parentComment) {
            return res.status(404).json({ success: false, message: "Parent comment not found" });
        }

        // 2. Create the reply object
        const newReply = {
            content,
            author: req.user._id, 
            createdAt: new Date(),
            likes: [] // Initialize empty likes array
        };

        // 3. Push and Save
        parentComment.reply.push(newReply);
        await parentComment.save();

        // 4. Optional: Populate the author of the LAST reply (the one we just added)
        // This is useful if you want to append the comment via JS without reloading
        const populatedComment = await Comments.findById(commentId)
            .populate('reply.author', 'name profilePic');
        
        const latestReply = populatedComment.reply[populatedComment.reply.length - 1];

        res.status(200).json({ 
            success: true, 
            reply: latestReply 
        });
    } catch (error) {
        console.error("Reply Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};