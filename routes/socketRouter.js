// routes/socketRouter.js
const socketController = require("../controllers/socket");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Register
    socket.on("register", (userId) =>
      socketController.registerUser(socket, userId),
    );

    // Chat
    socket.on("user-message", (data) =>
      socketController.handleUserMessage(io, socket, data),
    );

    // Likes
    socket.on("like_post", (data) =>
      socketController.handleLikePost(io, socket, data),
    );

    // Sync Requests
    socket.on("send_sync_request", (data) =>
      socketController.handleSyncRequest(io, socket, data),
    );

    // Voting (DoubtBin)
    socket.on("cast_vote", (data) =>
      socketController.handleCastVote(io, socket, data),
    );

    // LoopSpace (Groups)
    socket.on("join_space", (spaceId) => socket.join(spaceId));
    socket.on("send_message", (data) =>
      socketController.handleLoopSpaceMessage(io, socket, data),
    );

    // Cleanup
    socket.on("disconnect", () => socketController.handleDisconnect(socket));
  });
};
