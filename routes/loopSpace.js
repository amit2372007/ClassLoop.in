const express = require("express");
const router = express.Router();

const { isLoggedIn } = require("../middleware.js");
const loopSpaceController = require("../controllers/loopSpace.js");

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get("/:id", isLoggedIn, loopSpaceController.indivLoopSpace);
router.post(
  "/assignments/:id/upload",
  isLoggedIn,
  upload.single("assignmentFile"),
  loopSpaceController.uploadAssignment,
);
router.get(
  "/submit-form/:formId",
  isLoggedIn,
  loopSpaceController.renderFormSubmitPage,
);
router.post("/form/:formId/submit", isLoggedIn, loopSpaceController.formSubmit);

router.post(
  "/:id/application",
  isLoggedIn,
  loopSpaceController.submitApplication,
);
router.delete(
  "/application/:id",
  isLoggedIn,
  loopSpaceController.deleteApplication,
);
module.exports = router;
