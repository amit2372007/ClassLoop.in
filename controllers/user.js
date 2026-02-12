
const Users = require("../model/User.js");
const Posts = require("../model/post.js");
const Connection = require("../model/connection/connection.js");
const OtpLimit = require("../model/otp.js");
const axios = require("axios");
const OTP_KEY = process.env.OTP_API_KEY;
const OTP_TEMPLATE_NAME = process.env.OTP_TEMPLATE_NAME;



const ImageKit = require("imagekit");

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

module.exports.renderSignup = (req,res)=>{
     res.render("./user/createId.ejs" , );
};

module.exports.signup = async (req, res, next) => {
    try {
        let { username, name, phone, password, bio, location, otp } = req.body;
        const sessionId = req.session.otpSessionId;

        // 1. Validate that the OTP session exists
        if (!sessionId) {
            req.flash("error", "OTP Session expired. Please request a new OTP.");
            return res.redirect("/user/signup");
        }

        // 2. Verify OTP with 2Factor API
        // Ensure OTP_Key is defined in your controller or pulled from process.env
        const OTP_Key = process.env.OTP_API_KEY; 
        const verifyUrl = `https://2factor.in/API/V1/${OTP_Key}/SMS/VERIFY/${sessionId}/${otp}`;

        try {
            const verifyRes = await axios.get(verifyUrl);
            
            // Check if OTP matched
            if (verifyRes.data.Status !== "Success" || verifyRes.data.Details !== "OTP Matched") {
                req.flash("error", "Invalid OTP. Please check the code sent to your phone.");
                return res.redirect("/user/signup");
            }
        } catch (axiosError) {
            // Handle cases where the API might be down or the session is invalid
            req.flash("error", "Verification service error. Please try again later.");
            return res.redirect("/user/signup");
        }

        // 3. Register User with Passport-Local-Mongoose
        const newUser = new Users({ username, name, phone, bio, location });
        const newRegister = await Users.register(newUser, password);

        // 4. Log the user in immediately after successful registration
        req.login(newRegister, async (err) => {
            if (err) return next(err);

            // Set user to active (verified)
            req.user.isActive = true;
            await req.user.save();

            // Clear the OTP session ID from the session for security
            delete req.session.otpSessionId;

            req.flash("success", `Hey! ${req.user.name}, your account was created successfully.`);
            res.redirect("/home");
        });

    } catch (e) {
        // Handle UserExistsError or other Mongoose validation errors
        req.flash("error", e.message);
        res.redirect("/user/signup");
    }
};

module.exports.generateOTP = (async (req, res) => {
    const { phone } = req.body;
    const now = new Date();

    let alreadyUser = await Users.findOne({phone: phone});

    if(alreadyUser) {
    return  res.status(400).json({ 
            success: false, 
            message: "Phone number already registered." 
        });
    }

   // 1. Check if this phone number already has a tracking record
    let tracker = await OtpLimit.findOne({ phone });

    if (tracker) {
        // Block if they have already sent 2 OTPs today
        if (tracker.attempts >= 2) {
            return res.status(429).json({ 
                success: false, 
                message: "Daily limit reached. Try again in 24 hours." 
            });
        }
    }


    // Replace 'YourTemplateName' with the actual Template Name from your 2Factor dashboard
    const templateName = process.env.OTP_TEMPLATE_NAME; 
    
    // Updated URL structure to specify the SMS template
    const url = `https://2factor.in/API/V1/${OTP_KEY}/SMS/${phone}/AUTOGEN/${templateName}`;
    
    const response = await axios.get(url);
    
    if (response.data.Status === "Success") {
        req.session.otpSessionId = response.data.Details; 
        return res.json({ success: true, message: "SMS OTP sent successfully" });
    }
    
    res.status(400).json({ 
        success: false, 
        message: response.data.Details || "Failed to send SMS" 
    });
});


module.exports.requestPasswordReset = async (req, res) => {
    try {
        const { phone } = req.body;
        const user = await Users.findOne({ phone: phone });

        if (!user) {
            return res.status(404).json({ success: false, message: "No account found." });
        }

        // Rate Limiting
        let tracker = await OtpLimit.findOne({ phone: phone });
        if (tracker && tracker.attempts >= 2) {
            return res.status(429).json({ success: false, message: "Limit reached. Try tomorrow." });
        }

        const url = `https://2factor.in/API/V1/${OTP_KEY}/SMS/${phone}/AUTOGEN/${OTP_TEMPLATE_NAME}`;
        const response = await axios.get(url);

        if (response.data.Status === "Success") {
            req.session.otpSessionId = response.data.Details;
            req.session.resetPhone = phone;
            // Ensure session is saved before responding
            req.session.save(() => {
                return res.json({ success: true, message: "OTP sent!" });
            });
        }
    } catch (err) {
    if (err.response) {
        // This will tell you EXACTLY what 2Factor didn't like
        console.error("2Factor Error Data:", err.response.data);
        return res.status(400).json({ 
            success: false, 
            message: err.response.data.Details || "API Error" 
        });
    }
    res.status(500).json({ success: false, message: "SMS Service Down" });
}
};

module.exports.verifyResetOTP = async (req, res) => {
    const { otp } = req.body;
    const sessionId = req.session.otpSessionId;

    if (!sessionId) return res.status(400).json({ success: false, message: "Session expired." });

    try {
        const url = `https://2factor.in/API/V1/${OTP_KEY}/SMS/VERIFY/${sessionId}/${otp}`;
        const response = await axios.get(url);

        if (response.data.Status === "Success") {
            req.session.isPhoneVerified = true;
            req.session.save(() => {
                return res.json({ success: true });
            });
        } else {
            res.status(400).json({ success: false, message: "Wrong OTP" });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

module.exports.updatePassword = async (req, res) => {
    const { password } = req.body;
    const phone = req.session.resetPhone;

    if (!req.session.isPhoneVerified) return res.status(403).json({ success: false });

    try {
        const user = await Users.findOne({ phone: phone });
        // Passport-Local-Mongoose helper
        await user.setPassword(password);
        await user.save();

        req.session.isPhoneVerified = false;
        req.session.save(() => {
            res.json({ success: true });
        });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};



module.exports.checkUsername = async (req, res) => {
    try {
        const { username } = req.query;
        // Search for user in your database
        const user = await Users.findOne({ username: username.toLowerCase() });
        
        res.json({ exists: !!user });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports.loginRender = (req,res)=>{
       res.render("./user/login.ejs");
};

module.exports.login = async(req,res)=>{
    req.user.isActive = true;
    await req.user.save();
    req.flash("success" , `Welcome Back! ${req.user.username}`);
    // let redirectUrl =  res.locals.redirectUrl || "/listings";
    let redirectUrl = req.session.redirectUrl || "/home" ;
    delete req.session.redirectUrl;
    res.redirect(redirectUrl);
};

module.exports.renderForgetPassword = (req,res)=>{
    res.render("./user/forgetPassword.ejs");
}

module.exports.logout = async(req,res,next)=>{
    req.user.isActive = false;
    await req.user.save(); 
       req.logout((err)=>{
       if(err) {
        return next(err);
       };
      
    req.flash("success" , "Logged Out Successfully");
    res.redirect("/");
    });
};

module.exports.userProfile = async (req, res) => {
    try {
        if (!req.user) {
            req.flash("error", "Please Login!");
            return res.redirect('/user/login');
        }

        let allPosts = await Posts.find({ owner: req.user._id })
            .populate("owner") // Populating owner for avatar/name in feed
            .sort({ createdAt: -1 });

        let currentUser = await Users.findById(req.user._id)
            .populate("synced")
            .populate({
                path: "instituition",
                populate: {
                    path: "class",
                    populate: { path: "school" }
                }
            });

        res.render("./user/profile.ejs", { allPosts, currentUser });
    } catch (error) {
        console.error("Error loading profile:", error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports.randomUserProfile = async (req, res) => {
    try {
        let { id } = req.params;

        // 1. Redirect if viewing own profile
        if (req.user._id.equals(id)) {
            return res.redirect("/user/profile");
        }

        // 2. Fetch the user we are visiting
        // We name it 'profileUser' to keep it distinct from the logged-in user
        let profileUser = await Users.findById(id)
            .populate("synced")
            .populate({
                path: "instituition",
                populate: {
                    path: "class",
                    populate: { path: "school" }
                }
            });

        if (!profileUser) {
            req.flash("error", "User not found.");
            return res.redirect("/home");
        }

        // 3. FIX: Check if they are already synced
        // Use 'profileUser' instead of 'currentUser' here
        const isSynced = req.user.synced.some(syncedId => syncedId.equals(profileUser._id));

        // 4. Check for pending requests
        const pendingRequest = await Connection.findOne({
            sender: req.user._id,
            receiver: profileUser._id,
            status: 'pending'
        });

        // 5. Fetch posts
        let allPosts = await Posts.find({ owner: id }).sort({ createdAt: -1 });

        // 6. Render - Passing 'profileUser' as 'currentUser' so your EJS works
        res.render("./user/userProfile.ejs", { 
            currentUser: profileUser, 
            allPosts, 
            pendingRequest, 
            isSynced, 
            currUser: req.user 
        });
        
    } catch (err) {
        console.error("Profile Error:", err);
        res.status(500).send("Internal Server Error");
    }
};

module.exports.revokeRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const request = await Connection.findById(requestId);
        
        // Safety check: Only the sender can revoke their own request
        if (!request || !request.sender.equals(req.user._id)) {
            req.flash("error", "Unauthorized or request not found");
            return res.redirect("back");
        }

        await Connection.findByIdAndDelete(requestId);
        
        req.flash("success", "Connection request revoked successfully");
        
        // REDIRECT CHOICE: 
        // Redirect back to the 'Sent' tab on the sync-requests page
        res.redirect("/user/sync-requests?tab=sent"); 
        
    } catch (err) {
        console.error("Revoke Error:", err);
        req.flash("error", "Something went wrong while revoking the request");
        res.redirect("/home");
    }
};

module.exports.findUsers = async(req,res)=>{
     let allUsers = await Users.find({});
     res.render("./user/findUsers.ejs" , {allUsers});
};

module.exports.syncRequest = async(req,res)=>{    
       let {receiverId} = req.params;
       let sender = req.user._id;
       let connection = await Connection.findOne({sender, receiver: receiverId});
       if(connection && connection.status === "pending") {
           connection.status = "accepted";
           await connection.save();
       } else if(!connection) {
           let newConnection = new Connection({
               sender,
               receiver: receiverId,
               status: "pending"
           });
           await newConnection.save();
       }
       req.flash("success" , `Request send Successfully!`);
       res.redirect("/user/" + receiverId);
   };
   
module.exports.syncRequestsRender = async (req, res) => {
    const userId = req.user._id;
    const { tab = 'received' } = req.query; // Get active tab from URL

    // 1. Fetch Received Requests
    let receivedRequests = await Connection.find({ receiver: userId, status: "pending" }).populate("sender");

    // 2. Fetch Sent Requests (Outgoing)
    let sentRequests = await Connection.find({ sender: userId, status: "pending" }).populate("receiver");

    // CRITICAL: Fetch the user and populate the 'synced' array with friend data
    const userDoc = await Users.findById(userId).populate("synced");
    const myNetwork = userDoc.synced || [];

    // 4. Loop Suggestion Algorithm (Discovery)
    // Strategy: Show users who are NOT the current user and NOT in a pending/accepted connection
    const existingConnections = await Connection.find({
        $or: [{ sender: userId }, { receiver: userId }]
    });
    
    const connectedUserIds = existingConnections.map(conn => 
        conn.sender.equals(userId) ? conn.receiver : conn.sender
    );
    connectedUserIds.push(userId); // Don't suggest myself

    let loopSuggestions = await Users.find({
        _id: { $nin: connectedUserIds },
        college: req.user.college // Basic algorithm: same college first
    }).limit(5);

    res.render("./user/syncRequests.ejs", { 
        receivedRequests, 
        sentRequests, 
        myNetwork,
        loopSuggestions,
        activeTab: tab ,
        currUser: req.user
    });
};

module.exports.acceptSync = async(req,res)=>{      
         let {connectionId} = req.params;
         let connection = await Connection.findByIdAndUpdate(connectionId , {status: "accepted"  });
         let receiver = await Users.findById(connection.receiver);
         let sender = await Users.findById(connection.sender);
            receiver.synced.push(sender._id);
            sender.synced.push(receiver._id);
            await receiver.save();
            await sender.save();
            await Connection.findByIdAndDelete(connectionId);
            req.flash("success" , `${sender.name}! is Added to your Connection`)
            res.redirect("/user/sync-requests");
    };
module.exports.rejectSync = async(req,res)=>{
       let {connectionId} = req.params;
         await Connection.findByIdAndDelete(connectionId);
         req.flash("success" , `Request Declined Successfully!`);
         res.redirect("/user/sync-requests"); 
    };
module.exports.unsyncUser = async (req, res) => {
    let { userId } = req.params;
    let user = await Users.findById(userId);
    let currentUser = await Users.findById(req.user._id);

    if (user && currentUser) {
        // 1. Remove IDs from both 'synced' arrays
        currentUser.synced.pull(userId);
        user.synced.pull(req.user._id);
        
        await currentUser.save();
        await user.save();

        req.flash("success", `Unsynced with ${user.name}`);
    }

    // Redirect back to the network tab
    res.redirect("/user/sync-requests?tab=network");
};
    
//delete account
module.exports.deleteAccount = async(req,res)=>{
    try{
       let {id} = req.params;
       let user = await Users.findById(id).populate('post');;

       if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/user/profile");
        }
       //deleting post image from imagekit
       if (user.post && user.post.length > 0) {
            for (let post of user.post) {
                if (post.image && post.image.fileId) {
                    try {
                        await imagekit.deleteFile(post.image.fileId);
                    } catch (err) {
                        console.log(`Post image delete failed for ${post._id}: ${err.message}`);
                    }
                }
            }
        }
            // Delete post documents from MongoDB
            await Posts.deleteMany({ _id: { $in: user.post } });
        


         // 2. Delete Profile Picture from ImageKit (if not default)
        if (user.profilePic && user.profilePic.fileId && user.profilePic.fileId !== "default") {
            try {
                await imagekit.deleteFile(user.profilePic.fileId);
            } catch (err) {
                console.log(`profilePic delete failed: ${err.message}`);
            }
        }

        // 3. Delete Cover Picture from ImageKit (if not default)
        if (user.coverPic && user.coverPic.fileId && user.coverPic.fileId !== "default") {
            try {
                await imagekit.deleteFile(user.coverPic.fileId);
            } catch (err) {
                console.log(`coverPic delete failed: ${err.message}`);
            }
        }

        // 4. Final Database Cleanup
        await Users.findByIdAndDelete(id);

        // 5. Logout the user after deletion
        req.logout((err) => {
            if (err) return next(err);
            req.flash("success", "Your ClassLoop account has been deleted.");
            res.redirect("/user/signup"); 
        });

       
    } catch(err) {
       console.error("Account Deletion Error:", err);
        req.flash("error", "An error occurred while deleting your account.");
        res.redirect("/user/profile");
    }
};

module.exports.updatePicture = async (req, res) => {
    try {
        if (!req.file) {
            req.flash("error", "No image selected. Please try again.");
            return res.redirect("/user/profile");
        }

        // Trim to prevent whitespace errors
        const uploadType = req.body.uploadType ? req.body.uploadType.trim() : null; 
        const user = await Users.findById(req.user._id);

        if (!user || !uploadType) {
            req.flash("error", "User or Upload Type not found.");
            return res.redirect("/user/profile");
        }

        // 1. Identify target and extract old ID
        const targetField = uploadType === 'profile' ? 'profilePic' : 'coverPic';
        const userData = user.toObject(); // Convert to plain object for safer access
        const oldFileId = userData[targetField] ? userData[targetField].fileId : null;

        console.log(`Target: ${targetField} | Old File ID: ${oldFileId}`);

        // 2. Delete the OLD image from ImageKit
        if (oldFileId && oldFileId !== "default") {
            try {
                await imagekit.deleteFile(oldFileId);
                console.log(`✅ Deleted old ${uploadType} image: ${oldFileId}`);
            } catch (delErr) {
                // If it's a 404, the file was already gone; otherwise, log the error
                console.error("❌ ImageKit Deletion Failed:", delErr.message);
            }
        }

        // 3. Upload the NEW image
        const uploadResponse = await imagekit.upload({
            file: req.file.buffer,
            fileName: `${uploadType}_${user._id}_${Date.now()}.jpg`,
            folder: "classLoop_User"
        });

        // 4. Update MongoDB with the new nested object
        const updateObject = {
            [targetField]: {
                url: uploadResponse.url,
                fileId: uploadResponse.fileId
            }
        };

        await Users.findByIdAndUpdate(user._id, { $set: updateObject });
        
        req.flash("success", `Updated ${uploadType} picture!`);
        res.redirect("/user/profile");

    } catch (err) {
        req.flash("error", "Internal Server Error.");
        res.redirect("/user/profile");
    }
};