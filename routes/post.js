const express = require("express");
const router = express.Router();

const { isLoggedIn, isNotDemo } = require("../middleware.js");
const postController = require("../controllers/post.js");

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post(
  "/new",
  isNotDemo,
  upload.single("image"),
  isLoggedIn,
  postController.createPost,
);
router.delete("/delete/:id", isNotDemo, isLoggedIn, postController.deletePost);
router.get("/edit/:id", isNotDemo, isLoggedIn, postController.editPostPage);
router.put("/edit/:id", isNotDemo, isLoggedIn, postController.editPost);
router.get("/:id", isLoggedIn, postController.viewPost);
router.post("/comment/:id", isNotDemo, isLoggedIn, postController.addComment);
router.post("/:id/like", isNotDemo, isLoggedIn, postController.likePost);
module.exports = router;
