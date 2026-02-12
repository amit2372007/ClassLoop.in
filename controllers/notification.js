const Notification = require("../model/notification/notification");

module.exports.renderNotificationPage = async (req, res) => {
  try {
    // 2. Now .populate("sender") will know what "Users" refers to
    const notifications = await Notification.find({ receiver: req.user._id })
      .sort({ createdAt: -1 })
      .populate("sender", "name profilePic");

    res.render("notification/notification.ejs", { notifications });

    // Mark as read after rendering
    // await Notification.updateMany(
    //     { receiver: req.user._id, isRead: false },
    //     { $set: { isRead: true } }
    // );
  } catch (err) {
    console.error(err);
    res.redirect("/home");
  }
};

module.exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { receiver: req.user._id, isRead: false },
      { $set: { isRead: true } },
    );
    await Notification.deleteMany({ receiver: req.user._id });
    req.flash("success", "All Notification deleted");
    res.redirect("/home");
  } catch (err) {
    req.flash("success", "All Notification deleted");
    res.redirect("/notifications");
  }
};

module.exports.deleteNotification = async (req, res) => {
  try {
    let { id } = req.params;
    await Notification.findByIdAndDelete(id);

    // Return 200 OK so the frontend knows to remove the element
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
