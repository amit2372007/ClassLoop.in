const express = require("express");
const router = express.Router();

const { isLoggedIn, isNotDemo } = require("../middleware.js");
const commentController = require("../controllers/comment.js");

router.post(
  "/reply/:postId/:commentId",
  isNotDemo,
  isLoggedIn,
  commentController.replyOnComment,
);
router.post(
  "/:commentId/like",
  isNotDemo,
  isLoggedIn,
  commentController.likeComment,
);
router.delete(
  "/delete/:postId/:commentId",
  isNotDemo,
  isLoggedIn,
  commentController.deleteComment,
);

module.exports = router;
