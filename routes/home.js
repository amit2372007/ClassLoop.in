const express = require("express");
const router = express.Router();

const { isLoggedIn } = require("../middleware.js");
const homeController = require("../controllers/home.js");
const searchController = require("../controllers/search.js");

router.get("/", isLoggedIn, homeController.renderHomePage);
router.get("/search", isLoggedIn, searchController.globalSearch);

module.exports = router;
