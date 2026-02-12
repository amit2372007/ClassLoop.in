const express = require("express");
const router = express.Router();

const {isLoggedIn} = require("../middleware.js");
const postController = require("../controllers/post.js");

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


router.post("/new", upload.single("image"), isLoggedIn, postController.createPost);
router.delete("/delete/:id" , isLoggedIn, postController.deletePost);
router.get("/edit/:id" , isLoggedIn, postController.editPostPage);
router.put("/edit/:id" , isLoggedIn, postController.editPost);
router.get("/:id" ,isLoggedIn, postController.viewPost);
router.post("/comment/:id" , isLoggedIn, postController.addComment);
router.post("/:id/like" , isLoggedIn, postController.likePost);
module.exports = router;