const Posts = require("../model/post.js");
const Users = require("../model/User.js");
const Message = require("../model/message.js");
const Connection = require("../model/connection/connection.js")


module.exports.renderHomePage = async (req,res)=>{
    // Get current user and populate necessary data
    let currentUser = undefined;
    let connectionRequestCount = 0;
    if(req.user) {
        // Assuming 'Users' is your Mongoose model for User
        currentUser = await Users.findById(req.user._id).populate("loopSpace").populate("synced").populate("doubt");
        connectionRequestCount = await Connection.countDocuments({
            receiver: req.user._id,
            status: "pending"
        });
    } else {
        res.redirect("/");
    }

    // Always fetch posts for the main feed
    const allPosts = await Posts.find({}).sort({ createdAt: -1 }).populate("owner");

    // Check if the route was requested with a chat recipient ID (from the chat list)
    let Receiver = null;
    let isChatting = false;
    let messages = [];

    // This section handles when the user clicks a chat link (e.g., /home?chatId=...)
    const requestedChatId = req.query.chatId; 

    if (requestedChatId) {
        // 1. Fetch the requested Receiver data
        // Assuming 'Users' is your Mongoose model for User
        Receiver = await Users.findById(requestedChatId); 
        
        if (Receiver) {
            isChatting = true;
            messages = await Message.find({
                $or: [
                    // Messages sent by me to receiver
                    { sender: currentUser._id, receiver: Receiver._id },
                    // Messages sent by receiver to me
                    { sender: Receiver._id, receiver: currentUser._id }
                ]
            }).sort({ createdAt: 1 }); // **CRITICAL: Sort by 1 (ascending) for chronological order**
            
            await Message.updateMany(
            { sender: Receiver._id, receiver: currentUser._id, isRead: false },
            { $set: { isRead: true } }
            );

            
        } else {
            // Handle case where receiver ID is invalid
            req.flash("error", "The specified chat user could not be found.");
        }
    }

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

    if (currentUser && currentUser.synced.length > 0) {
    for (let synced of currentUser.synced) {
        const count = await Message.countDocuments({
            sender: synced._id,
            receiver: currentUser._id,
            isRead: false
        });
        unreadCounts[synced._id] = count;
    }
    }

    let view = "feed";
    // Render the view, passing all necessary data
    res.render("./webpage/home.ejs" ,{
        allPosts, 
        currentUser, 
        isChatting,  
        connectionRequestCount,   // Boolean flag to show/hide chat window in EJS
        Receiver,        // The Receiver user object
        messages,
        unreadCounts,
        lastMessages,
        view
    });
};