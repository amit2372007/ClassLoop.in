const express = require("express");
const router = express.Router();
const passport = require("passport");

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { isLoggedIn, isTeacher } = require("../middleware.js");
const teacherController = require("../controllers/teacher.js");

router.get("/", isLoggedIn, isTeacher, teacherController.teacherDashboard);
router.get(
  "/addStudent",
  isLoggedIn,
  isTeacher,
  teacherController.addStudentPage,
);
router.get(
  "/addAssignment",
  isLoggedIn,
  isTeacher,
  teacherController.createAssignmentPage,
);
router.get(
  "/Attendance-Insights",
  isLoggedIn,
  isTeacher,
  teacherController.getAttendanceInsights,
);
router.get(
  "/addResource",
  isLoggedIn,
  isTeacher,
  teacherController.addResourcePage,
);
router.post(
  "/addResource",
  isLoggedIn,
  isTeacher,
  teacherController.addResource,
);
router.post("/addStudent", isLoggedIn, isTeacher, teacherController.addStudent);
router.post(
  "/submitAttendance",
  isLoggedIn,
  isTeacher,
  teacherController.submitAttendance,
);
router.post("/addSubject", isLoggedIn, isTeacher, teacherController.addSubject);
// Use .single() and match the "name" attribute of your EJS file input
router.post(
  "/addAssignment",
  isLoggedIn,
  isTeacher,
  upload.single("attachments"),
  teacherController.createAssignment,
);
router.post("/addNotice", isLoggedIn, isTeacher, teacherController.addNotice);
router.post("/createForm", isLoggedIn, isTeacher, teacherController.createForm);
router.get(
  "/previewForms",
  isLoggedIn,
  isTeacher,
  teacherController.previewAllForms,
);

router.get(
  "/form/:formId/responses",
  isLoggedIn,
  isTeacher,
  teacherController.viewFormResponses,
);

router.get(
  "/response/:responseId",
  isLoggedIn,
  isTeacher,
  teacherController.viewIndividualResponseDetails,
);

router.delete(
  "/form/:formId/delete",
  isLoggedIn,
  isTeacher,
  teacherController.deleteForm,
);

router.delete(
  "/assignment/:id",
  isLoggedIn,
  isTeacher,
  teacherController.deleteAssignment,
);

router.patch(
  "/assignment/:assignmentId/grade/:submissionId",
  isLoggedIn,
  isTeacher,
  teacherController.submitGrade,
);

router.get(
  "/addExamPage",
  isLoggedIn,
  isTeacher,
  teacherController.addExamPage,
);

router.post(
  "/exams/initialize",
  isLoggedIn,
  isTeacher,
  teacherController.createExam,
);

router.post(
  "/exams/save",
  isLoggedIn,
  isTeacher,
  teacherController.saveExamMarks,
);

router.post(
  "/application/:id",
  isLoggedIn,
  teacherController.updateApplicationStatus,
);

module.exports = router;
