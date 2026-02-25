const express = require("express");
const router = express.Router();

const { isLoggedIn, isNotDemo } = require("../middleware.js");
const doubtBinController = require("../controllers/doubtBin.js");

router.get("/", doubtBinController.renderDoubtBinPage);

router.get("/ask-doubt", isLoggedIn, doubtBinController.renderDoubtForm);

router.post(
  "/ask-doubt",
  isNotDemo,
  isLoggedIn,
  doubtBinController.addNewDoubt,
);

router.get("/myDoubt", isNotDemo, isLoggedIn, doubtBinController.myDoubt);

router.get("/:id", doubtBinController.viewDoubtDetails);

router.delete(
  "/deleteDoubt/:id",
  isNotDemo,
  isLoggedIn,
  doubtBinController.deleteDoubt,
);

router.post(
  "/answer/:id",
  isNotDemo,
  isLoggedIn,
  doubtBinController.addAnswerToDoubt,
);

router.delete(
  "/:questionId/:answerId",
  isNotDemo,
  isLoggedIn,
  doubtBinController.deleteAnswer,
);

module.exports = router;
