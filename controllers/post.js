const Notification = require("../model/notification/notification.js");
const Posts = require("../model/post.js");
const Comments = require("../model/comment.js");
const Users = require("../model/User.js");
const Message = require("../model/message.js");
const Connection = require("../model/connection/connection.js");
const ImageKit = require("imagekit");

// Initialize ImageKit
const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


module.exports.createPost = async (req, res) => {
    if (!req.user) {
        req.flash("error", "Please Log in to Post");
        return res.redirect("/login");
    }

    try {
        let newPost = new Posts(req.body.post);
        newPost.owner = req.user._id;

        // 1. Check if a file was uploaded via Multer
        if (req.file) {
            const uploadResponse = await imagekit.upload({
                file: req.file.buffer, // Image data from memory
                fileName: `post_${Date.now()}.jpg`, // Unique name for the file
                folder: "/classloop_posts" // Organize files in your ImageKit dashboard
            });

            newPost.image = {
                url: uploadResponse.url,
                fileId: uploadResponse.fileId
            };
        }

        // 3. Update User and Post collections
        req.user.post.push(newPost._id);
        await newPost.save();
        await req.user.save();

        req.flash("success", "Uploaded a new Post");
        res.redirect("/home");

    } catch (err) {
        console.error("Error creating post:", err);
        req.flash("success", "Something went wrong while uploading.");
        res.redirect("/home");
    }
};

module.exports.deletePost = async (req, res) => {
    let currUserId = req.user._id;
    
    // 1. Find the post first to get the ImageKit fileId
    const post = await Posts.findById(req.params.id);

    if (!post) {
        req.flash("error", "Post not found");
        return res.redirect("/home");
    }

    // 2. Authorization check
    if (!post.owner.equals(currUserId)) {
        req.flash("error", "You do not have permission to delete this post");
        return res.redirect("/home");
    }

    try {
        // 3. Delete image from ImageKit server (if it exists)
        // Assuming your schema saves the image ID as 'post.image.fileId'
        if (post.image && post.image.fileId) {
            await imagekit.deleteFile(post.image.fileId);
        }

        // 4. Clean up MongoDB
        // Delete associated comments
        await Comments.deleteMany({ postId: req.params.id });
        
        // Remove post reference from the User's post array
        await Users.findByIdAndUpdate(currUserId, { $pull: { post: post._id } });
        
        // Delete the post document itself
        await Posts.findByIdAndDelete(req.params.id);

        req.flash("success", "Post deleted successfully");
        res.redirect("/home");

    } catch (err) {
        console.error("Error during deletion:", err);
        req.flash("error", "Something went wrong while deleting.");
        res.redirect("/home");
    }
};

module.exports.editPostPage = async (req,res)=>{
    let {id} = req.params;
    try{
      const Post = await Posts.findById(id);
      res.render("./webpage/editPost.ejs" , {Post});
    } catch(err) {
      res.send("Can'nt find Post");
    }
};

module.exports.editPost = async(req,res)=>{
    try{
        let {id} = req.params;
        let updatedPost = await Posts.findByIdAndUpdate(id , req.body.post);
        req.flash("success" , "Post edited Successfully");
        res.redirect("/home");
    } catch(err){
        console.log("unable to find Post");
        res.redirect("/home");
    }
};

module.exports.viewPost = async(req,res)=>{
    let currentUser = undefined;
    let {id} = req.params;

    let Post = await Posts.findById(id)
    .populate("owner") // Populates the Post Creator
    .populate({
        path: "comments", // Look into the 'comments' array in Post Schema
        populate: {
            path: "author reply.author", // Look into Comment author AND Reply author
            select: "name profilePic"    // Grab specific user info
        }
    });
    if(!Post) {
        req.flash("error" , "Unable to find Post!");
        res.redirect("/home");
    }

    // Change this line in your controller:
let Comment = await Comments.find({ postId: Post._id })
    .populate("author") // Populates the comment author
    .populate({
        path: "reply.author", // This is the missing piece for your EJS!
        select: "name profilePic"
    });

        let connectionRequestCount = 0;
    if(req.user) {
        // Assuming 'Users' is your Mongoose model for User
        currentUser = await Users.findById(req.user._id).populate("synced").populate("doubt").populate("loopSpace");
        connectionRequestCount = await Connection.countDocuments({
                    receiver: req.user._id,
                    status: "pending"
                });
    } else {
        res.redirect("/");
    }

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
    let view = "post;"
    // Render the view, passing all necessary data
    res.render("./webpage/home.ejs" ,{ 
        currentUser, 
        Post,
        Comment,
        isChatting,
        connectionRequestCount,     // Boolean flag to show/hide chat window in EJS
        Receiver,        // The Receiver user object
        messages,
        unreadCounts,
        lastMessages,
        view
    });
};

module.exports.addComment = async (req, res) => {
    try {
        let { id } = req.params;
        let post = await Posts.findById(id);

        if (!post) {
            req.flash("error", "Post not found!");
            return res.redirect("/home");
        }

        let newComment = new Comments({
            content: req.body.content, 
            author: req.user._id,
            postId: post._id
        });

        post.comments.push(newComment._id);

        await newComment.save();
        await post.save();

        console.log("Post Author ID:", post.owner);
        console.log("Current User ID:", req.user._id);

        // Check if author exists and user is NOT commenting on their own post
        if (post.owner && !post.owner.equals(req.user._id)) {
            console.log("Creating notification..."); 
            const notif = new Notification({
                receiver: post.owner,
                sender: req.user._id,
                type: "COMMENT",
                message: `${req.user.name} commented on your post`,
                link: `/post/${post._id}`,
            });
            await notif.save();
            console.log("Notification saved to DB!");
        } // <--- Added the missing closing brace here

        req.flash("success", "Comment added successfully!");
        res.redirect(`/post/${id}`); // Redirect moved outside the IF block

    } catch (err) {
        console.error("Comment Error:", err);
        req.flash("error", "Failed to add comment.");
        res.redirect(`/post/${req.params.id}`);
    }
};

module.exports.likePost = async (req, res) => {
    try {
        let { id } = req.params;
        let userId = req.user._id;
        let post = await Posts.findById(id);

        if (!post) {
            return res.status(404).json({ error: "Post Not Found" });
        }

        let hasLiked = post.like.includes(userId);
        let updatedPost;

        if (hasLiked) {
            // User is "unliking" the post
            updatedPost = await Posts.findByIdAndUpdate(
                id,
                { $pull: { like: userId } },
                { new: true } // 'new: true' returns the updated document
            );
        } else {
            // User is "liking" the post
            updatedPost = await Posts.findByIdAndUpdate(
                id,
                { $addToSet: { like: userId } },
                { new: true }
            );

            // --- LIKE NOTIFICATION LOGIC START ---
            if (post.owner && !post.owner._id.equals(userId)) {
                await new Notification({
                    receiver: post.owner._id,
                    sender: userId,
                    type: "LIKE",
                    message: `${req.user.name} liked your post`,
                    link: `/post/${post._id}`
                }).save();
            }
        }

        // Send back the new data as JSON
        res.json({
            likeCount: updatedPost.like.length,
            isLiked: !hasLiked // The new 'isLiked' status is the opposite of the old one
        });

    } catch (err) {
        console.error("Like route error:", err);
        res.status(500).json({ error: "Something went wrong." });
    }
};