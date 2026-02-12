const express = require("express");
const router = express.Router();

const {isLoggedIn} = require("../middleware.js");
const chatController = require("../controllers/chat.js");


router.get("/" , isLoggedIn , chatController.viewChats);

module.exports = router;