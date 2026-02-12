const express = require("express");
const router = express.Router();

const {isLoggedIn} = require("../middleware.js");
const commentController = require("../controllers/comment.js");

router.post("/reply/:postId/:commentId" , isLoggedIn ,commentController.replyOnComment);
router.post("/:commentId/like" , isLoggedIn , commentController.likeComment);
router.delete("/delete/:postId/:commentId" , isLoggedIn , commentController.deleteComment);


module.exports = router;