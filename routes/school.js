const express = require("express");
const router = express.Router();

const { isLoggedIn, isPrinciple } = require("../middleware.js");
const schoolController = require("../controllers/school.js");

router.get("/", isPrinciple, schoolController.renderSchoolDashboard);
router.get("/createClass", isPrinciple, schoolController.renderCreateClassForm);
router.get("/QRCode", isLoggedIn, isPrinciple, schoolController.renderQRCode);
router.get(
  "/joinSchool/:schoolId",
  isLoggedIn,
  schoolController.addStaffRequest,
);

router.get(
  "/teacher/:id",
  isLoggedIn,
  isPrinciple,
  schoolController.renderTeacherProfile,
);

router.get(
  "/teacher-requests",
  isLoggedIn,
  isPrinciple,
  schoolController.renderTeacherReq,
);

router.get(
  "/classProfile/:id",
  isLoggedIn,
  isPrinciple,
  schoolController.renderClassProfile,
);

router.delete(
  "/deleteClass/:id",
  isLoggedIn,
  isPrinciple,
  schoolController.deleteClass,
);
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

router.post(
  "/teacher-request/:id/approve",
  isLoggedIn,
  isPrinciple,
  schoolController.acceptRequest,
);

router.post(
  "/employee/add",
  isLoggedIn,
  isPrinciple,
  schoolController.addEmployee,
);

router.post(
  "/employee/generate-salary",
  isLoggedIn,
  isPrinciple,
  schoolController.generateMonthlyPayroll,
);

router.post(
  "/fees/remind",
  isLoggedIn,
  isPrinciple,
  schoolController.sendFeeReminder,
);

router.post(
  "/employee/:id/delete",
  isLoggedIn,
  isPrinciple,
  schoolController.deleteEmployee,
);

router.post(
  "/employee/:id/update",
  isLoggedIn,
  isPrinciple,
  schoolController.editEmployee,
);

router.post(
  "/teacher/add",
  isLoggedIn,
  isPrinciple,
  schoolController.addTeacher,
);

router.post(
  "/class/create",
  isLoggedIn,
  isPrinciple,
  schoolController.createClass,
);

router.post(
  "/class/assign-teacher",
  isLoggedIn,
  isPrinciple,
  schoolController.assignClassTeacher,
);

router.post(
  "/attendance/staff/save",
  isLoggedIn,
  isPrinciple,
  schoolController.saveStaffAttendance,
);
router.post(
  "/teachers/reset-password/:id",
  isLoggedIn,
  isPrinciple,
  schoolController.resetPassword,
);

// Route to handle teacher status toggle (Suspend / Reactivate)
router.post(
  "/teachers/toggle-status/:id",
  isLoggedIn,
  isPrinciple,
  schoolController.toggleTeacherStatus,
);

router.post(
  "/update-fee-structure",
  isLoggedIn,
  isPrinciple,
  schoolController.updateFeeStructure,
);
router.post(
  "/delete-fee-structure",
  isLoggedIn,
  isPrinciple,
  schoolController.deleteFeeStructure,
);
module.exports = router;
