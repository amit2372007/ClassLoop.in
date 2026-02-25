const express = require("express");
const router = express.Router();
const passport = require("passport");

const { isLoggedIn, isNotDemo } = require("../middleware.js");
const userController = require("../controllers/user.js");

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get(
  "/demo/login",
  (req, res, next) => {
    req.body = req.body || {};

    // 2. Now you can safely set the properties
    req.body.username = "demo_student";
    req.body.password = "fdsghsd2@23423";

    // 3. Continue with authentication
    passport.authenticate("local", {
      failureRedirect: "/user/login",
      failureFlash: true,
    })(req, res, next);
  },
  userController.login,
);

router.get("/signup", userController.renderSignup);
router.get("/check-username", userController.checkUsername);
router.post("/signup", userController.signup);
router.get("/login", userController.loginRender);
router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/user/login",
    failureFlash: true,
  }),
  userController.login,
);
router.get("/logout", userController.logout);
router.get("/profile", isLoggedIn, userController.userProfile);
router.get("/find", userController.findUsers);
router.get("/forgetPassword", userController.renderForgetPassword);
router.get(
  "/editProfile",
  isNotDemo,
  isLoggedIn,
  userController.editProfilePage,
);
router.put("/editProfile", isNotDemo, isLoggedIn, userController.editProfile);
router.post("/request-reset-otp", userController.requestPasswordReset);
router.post("/verify-reset-otp", userController.verifyResetOTP);
router.post("/update-password", userController.updatePassword);
router.get("/sync-requests", isLoggedIn, userController.syncRequestsRender);
router.post(
  "/accept-sync/:connectionId",
  isNotDemo,
  isLoggedIn,
  userController.acceptSync,
);
router.post(
  "/reject-sync/:connectionId",
  isNotDemo,
  isLoggedIn,
  userController.rejectSync,
);
router.delete(
  "/unsync/:userId",
  isNotDemo,
  isLoggedIn,
  userController.unsyncUser,
);
router.post(
  "/sync/:receiverId",
  isNotDemo,
  isLoggedIn,
  userController.syncRequest,
);
router.get("/:id", isLoggedIn, userController.randomUserProfile);
router.delete(
  "/revoke/:requestId",
  isNotDemo,
  isLoggedIn,
  userController.revokeRequest,
);
router.delete(
  "/delete-account/:id",
  isNotDemo,
  isLoggedIn,
  userController.deleteAccount,
);
router.post(
  "/update-photo",
  isNotDemo,
  isLoggedIn,
  upload.single("image"),
  userController.updatePicture,
);

router.post("/send-otp", userController.generateOTP);

module.exports = router;
