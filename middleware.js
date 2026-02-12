const Notification = require("./model/notification/notification.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    //redirect url save
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "Please Login");
    return res.redirect("/user/login");
  }
  next();
};

module.exports.countNotification = async (req, res, next) => {
  res.locals.unreadCount = 0; // Default to 0 for guests
  if (req.user) {
    try {
      res.locals.unreadCount = await Notification.countDocuments({
        receiver: req.user._id,
        isRead: false,
      });
    } catch (err) {
      console.error("Notification Middleware Error:", err);
    }
  }
  next();
};

module.exports.formatDistanceToNow = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString();
};

module.exports.isTeacher = (req, res, next) => {
  // 1. Check if user is logged in (using your existing logic)
  if (!req.isAuthenticated()) {
    req.flash("error", "You must be logged in first!");
    return res.redirect("/login");
  }

  // 2. Check for teacher designations
  // We check for both 'teacher' and 'classTeacher' based on your model's enums
  const authorizedRoles = ["teacher", "classTeacher"];

  if (!authorizedRoles.includes(req.user.designation)) {
    req.flash(
      "error",
      "Access Denied: This action requires Teacher permissions.",
    );
    return res.redirect("/home"); // Redirect to student home if they aren't a teacher
  }

  next(); // User is a teacher, proceed to the controller
};

module.exports.isPrinciple = (req, res, next) => {
  // 1. Check if user is logged in (using your existing logic)
  if (!req.isAuthenticated()) {
    req.flash("error", "You must be logged in first!");
    return res.redirect("/login");
  }

  // 2. Check for teacher designations
  // We check for both 'teacher' and 'classTeacher' based on your model's enums
  const authorizedRoles = ["teacher", "classTeacher", "principle"];

  if (!authorizedRoles.includes(req.user.designation)) {
    req.flash(
      "error",
      "Access Denied: This action requires Teacher permissions.",
    );
    return res.redirect("/home"); // Redirect to student home if they aren't a teacher
  }

  next(); // User is a teacher, proceed to the controller
};
