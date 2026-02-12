const express = require("express");
const router = express.Router();

const {isLoggedIn} = require("../middleware.js");
const doubtBinController = require("../controllers/doubtBin.js");

router.get("/", doubtBinController.renderDoubtBinPage);

router.get("/ask-doubt", isLoggedIn, doubtBinController.renderDoubtForm);

router.post("/ask-doubt", isLoggedIn, doubtBinController.addNewDoubt);

router.get("/myDoubt" , isLoggedIn , doubtBinController.myDoubt);

router.get("/:id", doubtBinController.viewDoubtDetails);

router.delete("/deleteDoubt/:id", isLoggedIn, doubtBinController.deleteDoubt);



router.post("/answer/:id", isLoggedIn, doubtBinController.addAnswerToDoubt);



router.delete("/:questionId/:answerId" , isLoggedIn, doubtBinController.deleteAnswer);




module.exports = router;