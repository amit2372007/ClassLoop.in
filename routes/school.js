const express = require("express");
const router = express.Router();

const { isLoggedIn, isPrinciple } = require("../middleware.js");
const schoolController = require("../controllers/school.js");

router.get("/", isPrinciple, schoolController.renderSchoolDashboard);
router.get("/createClass", isPrinciple, schoolController.renderCreateClassForm);
router.post("/createClass", isPrinciple, schoolController.createClass);
router.get(
  "/feeStructure",
  isPrinciple,
  schoolController.renderFeeStructurePage,
);
router.post(
  "/create-fee-structure",
  isPrinciple,
  schoolController.createFeeStructure,
);

router.post(
  "/generate-monthly-fees",
  isLoggedIn,
  isPrinciple,
  schoolController.generateMonthlyFees,
);
module.exports = router;
