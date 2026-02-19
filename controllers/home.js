const Posts = require("../model/post.js");
const Users = require("../model/User.js");
const Message = require("../model/message.js");
const Connection = require("../model/connection/connection.js");

module.exports.renderHomePage = async (req, res) => {
  try {
    const redisClient = global.redis; 
    const publicFeedKey = "feed:all_posts";

    let currentUser = undefined;
    let connectionRequestCount = 0;

    if (req.user) {
      const userProfileKey = `user:profile:${req.user._id}`;
      let cachedUserData = null;
      if (redisClient) {
        cachedUserData = await redisClient.get(userProfileKey);
      }

      if (cachedUserData) {
        const parsedData = JSON.parse(cachedUserData);
        currentUser = parsedData.currentUser;
        connectionRequestCount = parsedData.connectionRequestCount;

        // Fix Dates for DoubtBin
        if (currentUser.doubt) {
          currentUser.doubt.forEach(d => {
            d.createdAt = new Date(d.createdAt);
          });
        }
      } else {
        currentUser = await Users.findById(req.user._id)
          .populate({ path: "loopSpace", limit: 2 })
          .populate({ path: "synced", limit: 5 })
          .populate({ path: "doubt", limit: 3, sort: { createdAt: -1 } });

        connectionRequestCount = await Connection.countDocuments({
          receiver: req.user._id,
          status: "pending",
        }).limit(10);

        if (redisClient) {
          await redisClient.set(userProfileKey, JSON.stringify({ currentUser, connectionRequestCount }), 'EX', 300);
        }
      }
    } else {
      return res.redirect("/");
    }

    let allPosts;
    let cachedFeed = null;
    if (redisClient) {
      cachedFeed = await redisClient.get(publicFeedKey);
    }

    if (cachedFeed) {
      allPosts = JSON.parse(cachedFeed);
      // Fix Dates for Posts
      allPosts.forEach(post => {
        if (post.createdAt) post.createdAt = new Date(post.createdAt);
      });
    } else {
      allPosts = await Posts.find({})
        .sort({ createdAt: -1 })
        .populate("owner")
        .limit(15);
      
      if (redisClient) {
        await redisClient.set(publicFeedKey, JSON.stringify(allPosts), 'EX', 60);
      }
    }

    let Receiver = null, isChatting = false, messages = [];
    const requestedChatId = req.query.chatId;

    if (requestedChatId) {
      Receiver = await Users.findById(requestedChatId);
      if (Receiver) {
        isChatting = true;
        messages = await Message.find({
          $or: [
            { sender: currentUser._id.toString(), receiver: Receiver._id.toString() },
            { sender: Receiver._id.toString(), receiver: currentUser._id.toString() },
          ],
        }).sort({ createdAt: 1 });

        await Message.updateMany(
          { sender: Receiver._id, receiver: currentUser._id, isRead: false },
          { $set: { isRead: true } },
        );
        if (redisClient) await redisClient.del(`user:unread:${req.user._id}`);
      }
    }

    let unreadCounts = {}, lastMessages = {}, lastMessageDates = {};
    const unreadKey = `user:unread:${req.user._id}`;
    let cachedUnreads = null;
    if (redisClient) cachedUnreads = await redisClient.get(unreadKey);

    if (cachedUnreads) {
      const parsedUnreads = JSON.parse(cachedUnreads);
      unreadCounts = parsedUnreads.unreadCounts;
      lastMessages = parsedUnreads.lastMessages;
      lastMessageDates = parsedUnreads.lastMessageDates;
    } else if (currentUser && currentUser.synced?.length > 0) {
      for (let syncedUser of currentUser.synced) {
        const syncedId = syncedUser._id.toString();
        const currentId = currentUser._id.toString();

        unreadCounts[syncedId] = await Message.countDocuments({
          sender: syncedId,
          receiver: currentId,
          isRead: false,
        });

        const lastMsg = await Message.findOne({
          $or: [{ sender: currentId, receiver: syncedId }, { sender: syncedId, receiver: currentId }],
        }).sort({ createdAt: -1 });

        if (lastMsg) {
          lastMessages[syncedId] = lastMsg.content;
          lastMessageDates[syncedId] = new Date(lastMsg.createdAt).getTime(); // Fix for .getTime()
        } else {
          lastMessages[syncedId] = "No messages yet";
          lastMessageDates[syncedId] = 0;
        }
      }
      if (redisClient) {
        await redisClient.set(unreadKey, JSON.stringify({ unreadCounts, lastMessages, lastMessageDates }), 'EX', 120);
      }
    }

    if (currentUser?.synced) {
      currentUser.synced.sort((a, b) => (lastMessageDates[b._id.toString()] || 0) - (lastMessageDates[a._id.toString()] || 0));
    }

    res.render("./webpage/home.ejs", {
      allPosts, currentUser, isChatting, connectionRequestCount,
      Receiver, messages, unreadCounts, lastMessages, view: "feed"
    });
  } catch (err) {
    console.error("Redis/Route Error:", err);
    res.redirect("/");
  }
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
