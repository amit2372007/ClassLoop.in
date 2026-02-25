const express = require("express");
const router = express.Router();

const { isLoggedIn, isNotDemo } = require("../middleware.js");
const loopSpaceController = require("../controllers/loopSpace.js");

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get("/:id", isLoggedIn, loopSpaceController.indivLoopSpace);
router.post(
  "/assignments/:id/upload",
  isNotDemo,
  isLoggedIn,
  upload.single("assignmentFile"),
  loopSpaceController.uploadAssignment,
);
router.get(
  "/submit-form/:formId",
  isLoggedIn,
  loopSpaceController.renderFormSubmitPage,
);
router.post(
  "/form/:formId/submit",
  isNotDemo,
  isLoggedIn,
  loopSpaceController.formSubmit,
);

router.post(
  "/:id/application",
  isNotDemo,
  isLoggedIn,
  loopSpaceController.submitApplication,
);
router.delete(
  "/application/:id",
  isNotDemo,
  isLoggedIn,
  loopSpaceController.deleteApplication,
);
module.exports = router;
