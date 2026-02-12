// controllers/socketController.js
const Message = require("../model/message");
const Posts = require("../model/post");
const Users = require("../model/User");
const Connection = require("../model/connection/connection");
const Doubts = require("../model/DoubtBin/doubt");
const Answers = require("../model/DoubtBin/answer");
const SpaceMessage = require("../model/loopSpace/spaceMessage");

// Keep this variable here so it persists in memory
const userSocketMap = {};

// --- HANDLERS ---

const registerUser = (socket, userId) => {
  userSocketMap[userId] = socket.id;
  console.log(`User registered: ${userId} with socket ${socket.id}`);
};

const handleUserMessage = async (io, socket, data) => {
  try {
    const newMessage = new Message({
      sender: data.senderId,
      receiver: data.receiverId,
      content: data.content,
    });
    await newMessage.save();

    const messageToSend = {
      _id: newMessage._id,
      content: newMessage.content,
      sender: newMessage.sender,
      receiver: newMessage.receiver,
      createdAt: newMessage.createdAt,
    };

    // Send to sender
    socket.emit("receive-message", messageToSend);

    // Send to receiver
    const receiverSocketId = userSocketMap[data.receiverId];
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("receive-message", messageToSend);
    }
  } catch (err) {
    console.error("Message Error:", err);
  }
};

const handleLikePost = async (io, socket, data) => {
  try {
    const { postId, userId } = data;
    const post = await Posts.findById(postId);
    if (!post) return;

    const hasLiked = post.like && post.like.includes(userId);
    let updatedPost;

    if (hasLiked) {
      updatedPost = await Posts.findByIdAndUpdate(
        postId,
        { $pull: { like: userId } },
        { new: true },
      );
    } else {
      updatedPost = await Posts.findByIdAndUpdate(
        postId,
        { $addToSet: { like: userId } },
        { new: true },
      );
    }

    if (updatedPost) {
      io.emit("update_likes", {
        postId: postId,
        newCount: updatedPost.like.length,
      });
    }
  } catch (err) {
    console.error("Like Error:", err);
  }
};

const handleSyncRequest = async (io, socket, data) => {
  try {
    const { senderId, targetId } = data;
    const existingRequest = await Connection.findOne({
      sender: senderId,
      receiver: targetId,
    });
    if (existingRequest) return;

    const newConnection = new Connection({
      sender: senderId,
      receiver: targetId,
      status: "pending",
    });
    await newConnection.save();

    const receiverSocketId = userSocketMap[targetId];
    if (receiverSocketId) {
      const senderInfo =
        await Users.findById(senderId).select("name profilePic");
      io.to(receiverSocketId).emit("new_sync_request", {
        message: `${senderInfo.name} wants to sync with you!`,
        sender: senderInfo,
      });
    }
  } catch (err) {
    console.error("Sync Request Error:", err);
  }
};

const handleCastVote = async (io, socket, { type, targetType, id, userId }) => {
  try {
    const Model = targetType === "doubt" ? Doubts : Answers;
    const item = await Model.findById(id);
    if (!item) return;

    let action = "";
    if (type === "up") {
      item.downvote.pull(userId);
      if (item.upvote.includes(userId)) {
        item.upvote.pull(userId);
        action = "removed";
      } else {
        item.upvote.push(userId);
        action = "upvoted";
      }
    } else {
      item.upvote.pull(userId);
      if (item.downvote.includes(userId)) {
        item.downvote.pull(userId);
        action = "removed";
      } else {
        item.downvote.push(userId);
        action = "downvoted";
      }
    }
    await item.save();

    io.emit("vote_confirmed", {
      id,
      targetType,
      upvotes: item.upvote.length,
      downvotes: item.downvote.length,
      voterId: userId,
      action,
    });
  } catch (err) {
    console.error("Vote Error:", err);
  }
};

const handleLoopSpaceMessage = async (io, socket, data) => {
  const { content, senderId, spaceId } = data;
  const newMessage = new SpaceMessage({
    content,
    sender: senderId,
    loopSpace: spaceId,
  });
  await newMessage.save();
  const populatedMessage = await newMessage.populate(
    "sender",
    "name profilePic",
  );
  io.to(spaceId).emit("receive_message", populatedMessage);
};

const handleDisconnect = (socket) => {
  for (const [userId, socketId] of Object.entries(userSocketMap)) {
    if (socketId === socket.id) {
      delete userSocketMap[userId];
      break;
    }
  }
  console.log(`Socket disconnected: ${socket.id}`);
};

// Export everything
module.exports = {
  registerUser,
  handleUserMessage,
  handleLikePost,
  handleSyncRequest,
  handleCastVote,
  handleLoopSpaceMessage,
  handleDisconnect,
};
