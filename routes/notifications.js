const express = require("express");
const router = express.Router();

const { isLoggedIn } = require("../middleware.js");
const notificationController = require("../controllers/notification.js");

router.get("/", isLoggedIn, notificationController.renderNotificationPage);
router.put("/mark-all-read", isLoggedIn, notificationController.markAllRead);
router.delete(
  "/delete/:id",
  isLoggedIn,
  notificationController.deleteNotification,
);

module.exports = router;
