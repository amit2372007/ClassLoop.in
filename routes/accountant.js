const express = require("express");
const router = express.Router();

const { isAccountant } = require("../middleware.js");
const accountantController = require("../controllers/accountant.js");

// Accountant Dashboard Entry Point
router.get("/", isAccountant, accountantController.renderDashboard);
router.get("/receipt/:id", isAccountant, accountantController.viewReceipt);

// Fee Counter API Endpoints
router.get(
  "/api/search-student",
  isAccountant,
  accountantController.searchStudent,
);

router.get(
  "/api/students-by-class/:classId",
  isAccountant,
  accountantController.getStudentsByClass,
);

router.post(
  "/api/settle-fees",
  isAccountant,
  accountantController.settleMultipleFees,
);

// router.post("/api/settle-fees", isAccountant, accountantController.settleFees);

module.exports = router;
