const Posts = require("../model/post.js");
const Users = require("../model/User.js");
const Message = require("../model/message.js");
const Connection = require("../model/connection/connection.js");

module.exports.renderHomePage = async (req, res) => {
  // Get current user and populate necessary data
  let currentUser = undefined;
  let connectionRequestCount = 0;

  if (req.user) {
    currentUser = await Users.findById(req.user._id)
      .populate({ path: "loopSpace", limit: 2 })
      .populate({ path: "synced", limit: 5 })
      .populate({ path: "doubt", limit: 3, sort: { createdAt: -1 } });

    connectionRequestCount = await Connection.countDocuments({
      receiver: req.user._id,
      status: "pending",
    }).limit(10);
  } else {
    return res.redirect("/"); // Added return to prevent further execution
  }

  // Always fetch posts for the main feed
  const allPosts = await Posts.find({})
    .sort({ createdAt: -1 })
    .populate("owner")
    .skip(0)
    .limit(15);

  let Receiver = null;
  let isChatting = false;
  let messages = [];

  const requestedChatId = req.query.chatId;

  if (requestedChatId) {
    Receiver = await Users.findById(requestedChatId);

    if (Receiver) {
      isChatting = true;
      messages = await Message.find({
        $or: [
          { sender: currentUser._id, receiver: Receiver._id },
          { sender: Receiver._id, receiver: currentUser._id },
        ],
      }).sort({ createdAt: 1 });

      await Message.updateMany(
        { sender: Receiver._id, receiver: currentUser._id, isRead: false },
        { $set: { isRead: true } },
      );
    } else {
      req.flash("error", "The specified chat user could not be found.");
    }
  }

  // Set up dictionaries to hold data for the view
  let unreadCounts = {};
  let lastMessages = {};
  let lastMessageDates = {}; // NEW: Keep track of timestamps for sorting

  // Consolidated loop for getting unread counts and last messages
  if (currentUser && currentUser.synced && currentUser.synced.length > 0) {
    for (let syncedUser of currentUser.synced) {
      // 1. Get unread count (Fixed receiver to use _id)
      const count = await Message.countDocuments({
        sender: syncedUser._id,
        receiver: currentUser._id,
        isRead: false,
      });
      unreadCounts[syncedUser._id] = count;

      // 2. Get the last message
      const lastMsg = await Message.findOne({
        $or: [
          { sender: currentUser._id, receiver: syncedUser._id },
          { sender: syncedUser._id, receiver: currentUser._id },
        ],
      }).sort({ createdAt: -1 });

      // 3. Store the message content AND the timestamp
      if (lastMsg) {
        lastMessages[syncedUser._id] = lastMsg.content;
        lastMessageDates[syncedUser._id] = lastMsg.createdAt.getTime(); // Get raw milliseconds
      } else {
        lastMessages[syncedUser._id] = "No messages yet";
        lastMessageDates[syncedUser._id] = 0; // Push to bottom if no messages exist
      }
    }

    // 4. SORT the synced array dynamically based on the last message timestamp
    currentUser.synced.sort((a, b) => {
      // Sorts descending: highest timestamp (newest) comes first
      return lastMessageDates[b._id] - lastMessageDates[a._id];
    });
  }

  let view = "feed";

  // Render the view
  res.render("./webpage/home.ejs", {
    allPosts,
    currentUser,
    isChatting,
    connectionRequestCount,
    Receiver,
    messages,
    unreadCounts,
    lastMessages,
    view,
  });
};

// Add this below your renderHomePage function
module.exports.fetchMorePosts = async (req, res) => {
  try {
    // Grab the requested page number from the URL (defaults to 2)
    const page = parseInt(req.query.page) || 2;
    const limit = 15;
    const skipAmount = (page - 1) * limit;

    // Fetch the next batch of 20 posts
    const morePosts = await Posts.find({})
      .sort({ createdAt: -1 })
      .populate("owner")
      .skip(skipAmount)
      .limit(limit);
    console.log(morePosts);
    // Send the data back as JSON
    res.status(200).json({
      success: true,
      posts: morePosts,
      hasMore: morePosts.length === limit, // If we got 20, there might be more
    });
  } catch (error) {
    console.error("Error fetching more posts:", error);
    res.status(500).json({ success: false, message: "Error loading posts" });
  }
};
