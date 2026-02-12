const Posts = require("../model/post.js");
const Comments = require("../model/comment.js");
const Users = require("../model/User.js");
const Message = require("../model/message.js");

module.exports.viewChats = async (req, res) => {
    if (!req.user) {
        return res.redirect("/login");
    }

    try {
        // 1. Fetch current user and their "synced" friends list
        const currentUser = await Users.findById(req.user._id)
            .populate("synced")
            

        let Receiver = null;
        let isChatting = false;
        let messages = [];
        const requestedChatId = req.query.chatId;
     
        // 2. If a specific friend is clicked (?chatId=...)
        if (requestedChatId) {
            Receiver = await Users.findById(requestedChatId);
            
            if (Receiver) {
                isChatting = true;
                // Fetch only the conversation between these two users
                messages = await Message.find({
                    $or: [
                        { sender: currentUser._id, receiver: Receiver._id },
                        { sender: Receiver._id, receiver: currentUser._id }
                    ]
                }).sort({ createdAt: 1 });

                // Mark received messages as read
                await Message.updateMany(
                    { sender: Receiver._id, receiver: currentUser._id, isRead: false },
                    { $set: { isRead: true } }
                );
            }
        }

        // 3. Calculate unread counts for the sidebar notifications
        let unreadCounts = {};
        let lastMessages = {}; 
        if (currentUser.synced && currentUser.synced.length > 0) {
            for (let syncedUser of currentUser.synced) {
                const count = await Message.countDocuments({
                    sender: syncedUser._id,
                    receiver: currentUser,
                    isRead: false
                });
                unreadCounts[syncedUser._id] = count;

                const lastMsg = await Message.findOne({
            $or: [
                { sender: currentUser._id, receiver: syncedUser._id },
                { sender: syncedUser._id, receiver: currentUser._id }
            ]
        }).sort({ createdAt: -1 }); // Get the newest one

        lastMessages[syncedUser._id] = lastMsg ? lastMsg.content : "No messages yet";
            }
            
        }

        // 4. Render the page with all data
        res.render("./Chats/chats.ejs", {
            currentUser,
            isChatting,
            Receiver,
            messages,
            unreadCounts,
            lastMessages
        });

    } catch (err) {
        console.error("Error in GET /Chats:", err);
        req.flash("error" , "Can'nt Access Chats!")
        res.redirect("/home");
    }
};