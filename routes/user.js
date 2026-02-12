const express = require("express");
const router = express.Router();
const passport = require("passport");



const {isLoggedIn} = require("../middleware.js");
const userController = require("../controllers/user.js");

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get("/signup", userController.renderSignup);
router.get('/check-username', userController.checkUsername);
router.post("/signup", userController.signup);
router.get("/login", userController.loginRender);
router.post("/login",
             passport.authenticate("local" , {failureRedirect: "/user/login", failureFlash: true}),
             userController.login
            );
router.get("/logout", userController.logout);
router.get("/profile", isLoggedIn , userController.userProfile);
router.get("/find", userController.findUsers);
router.get("/forgetPassword", userController.renderForgetPassword);
router.post("/request-reset-otp", userController.requestPasswordReset);
router.post("/verify-reset-otp", userController.verifyResetOTP);
router.post("/update-password", userController.updatePassword);
router.get("/sync-requests" , isLoggedIn , userController.syncRequestsRender);
router.post("/accept-sync/:connectionId" , isLoggedIn , userController.acceptSync);
router.post("/reject-sync/:connectionId" , isLoggedIn , userController.rejectSync);
router.delete("/unsync/:userId" , isLoggedIn , userController.unsyncUser);
router.post("/sync/:receiverId" , isLoggedIn , userController.syncRequest);
router.get("/:id", isLoggedIn , userController.randomUserProfile);
router.delete("/revoke/:requestId" , isLoggedIn , userController.revokeRequest);
router.delete("/delete-account/:id" , isLoggedIn , userController.deleteAccount);
router.post("/update-photo" , isLoggedIn ,upload.single('image') , userController.updatePicture);

router.post("/send-otp", userController.generateOTP);


module.exports = router;