const express = require("express");
const router = express.Router();

const { isLoggedIn, isPrinciple } = require("../middleware.js");
const schoolController = require("../controllers/school.js");

router.get("/", isPrinciple, schoolController.renderSchoolDashboard);
router.get("/createClass", isPrinciple, schoolController.renderCreateClassForm);
router.post("/createClass", isPrinciple, schoolController.createClass);

module.exports = router;
