const Notification = require("../model/notification/notification.js")
const Doubts = require("../model/DoubtBin/doubt.js");
const Answers = require("../model/DoubtBin/answer.js");    
const Users = require("../model/User.js"); 
const { formatDistanceToNow } = require("../middleware.js");


module.exports.renderDoubtBinPage = async (req, res) => {
    try {
        // 1. Fetch all doubts (Your existing logic)
        let doubts = await Doubts.find({})
            .populate("author", "name profilePic designation") 
            .sort({ createdAt: -1 });

        // 2. Aggregate Top 5 Tags
        const topTags = await Doubts.aggregate([
            { $unwind: "$tags" }, // Break the tags array into individual strings
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // 3. Aggregate Top 5 Authors (Contributors)
        const topAuthors = await Doubts.aggregate([
    // 1. Group by author and count their doubts
    { $group: { _id: "$author", doubtCount: { $sum: 1 } } },
    
    // 2. Sort by most doubts and take the top 5
    { $sort: { doubtCount: -1 } },
    { $limit: 5 },
    
    // 3. Join with the Users collection
    {
        $lookup: {
            from: "users", // must match the actual name of your collection in MongoDB (usually lowercase plural)
            localField: "_id",
            foreignField: "_id",
            as: "details"
        }
    },
    
    // 4. Flatten the 'details' array
    { $unwind: "$details" },
    
    // 5. Project only what you need (name, profilePic, coverPic, etc.)
    {
        $project: {
            doubtCount: 1,
            "details.name": 1,
            "details.profilePic": 1,
            "details.coverPic": 1,
            "details.designation": 1
        }
    }
]);
        const activeTab = req.query.tab || "DoubtBin"
        let totalDoubts = await Doubts.countDocuments({});
        
        res.render("./doubtBin/doubtBin.ejs", { 
            doubts, 
            activeTab,
            totalDoubts, 
            topTags, 
            topAuthors, 
            currentUser: req.user,
        });

    } catch (err) {
        console.error("DoubtBin Error:", err);
        req.flash("error", "Could not load DoubtBin.");
        res.redirect("/home");
    }
};

module.exports.myDoubt = async (req, res) => {
    try {
        let doubts = await Doubts.find({ author: req.user._id })
                                 .populate("author")
                                 .sort({_id: -1});
        let view = "myDoubt";
        res.render("./doubtBin/doubtBin.ejs", { doubts, view });
    } catch (err) {
        req.flash("error" , "Can'nt get your Doubts")
        console.error("Error fetching user doubts:", err);
        res.status(500).send("Server Error");
    }
};


module.exports.renderDoubtForm = (req,res)=>{
    try{
       if(!req.user) {
        req.flash("error" , "Please Login to Post a new Doubt!");
        return res.redirect('/user/login');
       }
       res.render("./doubtBin/askDoubt.ejs");
    } catch(err){
       req.flash("error" , err);
    }
     
   };

module.exports.addNewDoubt = async(req,res)=>{
    
     try{
       if(req.user) {
        const { title, description, tag1, tag2, tag3 } = req.body;

        const tagsArray = [tag1, tag2, tag3].filter(tag => tag && tag.trim() !== "");

        const newDoubt = new Doubts({
            title: title,
            description: description,
            tags: tagsArray,      
            author: req.user._id,           
        });
         req.user.doubt.push(newDoubt._id);
        await req.user.save();
        await newDoubt.save();
        
        req.flash("success" , `${req.user.name} your Doubt is uploaded successfully!`);
        
        res.redirect("/doubtBin");
       }
     } catch(err) {
        if (err.name === 'ValidationError') {
            // Get the first validation error message
            const message = Object.values(err.errors).map(val => val.message);
            req.flash("error", message[0]); 
            return res.redirect("/doubtBin/new");
        }
        res.status(500).send("Server Error");
    
     }
   };

module.exports.viewDoubtDetails = async(req,res)=>{
    try{
        if(!req.user) {
        req.flash("error" , "Please Login to View a  Doubt!");
        return res.redirect('/user/login');
       }

      let {id} = req.params;
      let Doubt = await Doubts.findByIdAndUpdate(id
        , { $inc: {views: 1} },
          {new : true}
     ).populate("author")
      let answers = await Answers.find({doubtId: Doubt.id}).populate("author");
     let currentUser = req.user;
     res.render("./doubtBin/indivDoubt.ejs" , {Doubt , currentUser , answers});
    } catch(err) {
      req.flash("error" , err);
      console.log(err)
      return res.redirect('/doubtBin');
    }
     
   };

module.exports.deleteDoubt = async(req,res)=>{
        let { id } = req.params;
        
        try{
            let Doubt = await Doubts.findById(id);
            if(req.user._id.equals(Doubt.author._id)) {
                for(let answerId of Doubt.answers) {
                    await Answers.findByIdAndDelete(answerId);
                }
                await Doubts.findByIdAndDelete(id);
                await Users.findByIdAndUpdate(req.user._id , {$pull: {doubt: Doubt._id}});
                req.flash("success" , "Doubt Deleted Successfully!");
                res.redirect("/doubtBin");
            } else {
                req.flash("error" , "You are not authorized to delete this doubt");
                return res.redirect("/doubtBin");
            }

        } catch(err) {
            req.flash("error" , "Failed! to delete Doubt");
            res.redirect("/doubtBin");
        }
    };

module.exports.upvoteDoubt = async(req,res)=>{
    let { id } = req.params;
    let userId = req.user._id; // Assuming you have user authentication

    const doubt = await Doubts.findByIdAndUpdate(id, 
        { $addToSet: { upvote: userId }, $pull: { downvote: userId } }, 
        { new: true }
    );
    res.json({ upvotes: doubt.upvote.length, downvotes: doubt.downvote.length });
   };

module.exports.downvoteDoubt = async (req, res) => {
    let { id } = req.params;
    let userId = req.user._id;

    const doubt = await Doubts.findByIdAndUpdate(id, 
        { $addToSet: { downvote: userId }, $pull: { upvote: userId } }, 
        { new: true }
    );

    res.json({ upvotes: doubt.upvote.length, downvotes: doubt.downvote.length });
};

module.exports.addAnswerToDoubt = async (req, res) => {
    let { id } = req.params;
    try {
        let { content } = req.body;

        // 1. Find the doubt first to know who the author is
        let doubt = await Doubts.findById(id);

        if (!doubt) {
            req.flash("error", "Doubt not found!");
            return res.redirect("/doubtBin");
        }

        // 2. Create and save the new answer
        let newAnswer = new Answers({
            content: content,
            doubtId: id,
            author: req.user._id
        });
        await newAnswer.save();

        // 3. Update the doubt with the new answer ID
        await Doubts.findByIdAndUpdate(id, { $push: { answers: newAnswer._id } });

        // 4. --- DOUBT NOTIFICATION LOGIC ---
        // Only notify if the author exists and is NOT the person answering
        if (doubt.author && !doubt.author.equals(req.user._id)) {
            await new Notification({
                receiver: doubt.author,
                sender: req.user._id,
                type: "DOUBT_SOLVED", // This matches your ejs if-condition
                message: `${doubt.title}`,
                link: `/doubtBin/${id}`
            }).save();
        }

        req.flash("success", "Answer Uploaded Successfully!");
        res.redirect(`/doubtBin/${id}`);
    } catch (err) {
        console.error("Doubt Answer Error:", err);
        req.flash("error", "Failed to upload, Try Again");
        res.redirect(`/doubtBin/${req.params.id}`);
    }
};

module.exports.upvoteAnswer = async(req,res)=>{
    console.log("Upvote route hit");
      try {
        const { answerId } = req.params;
        const userId = req.user._id;

        const answer = await Answers.findByIdAndUpdate(answerId,
            { $addToSet: { upvote: userId }, $pull: { downvote: userId } },
            { new: true }
        );

        if (!answer) return res.status(404).json({ error: 'Answer not found' });

        res.json({ upvotes: answer.upvote.length, downvotes: answer.downvote.length });
    } catch (err) {
        console.error('Answer upvote error:', err);
        res.status(500).json({ error: "Something went wrong" });
    }
   };

module.exports.downvoteAnswer = async (req, res) => {
    try {
        const { answerId } = req.params;
        const userId = req.user._id;

        const answer = await Answers.findByIdAndUpdate(answerId,
            { $addToSet: { downvote: userId }, $pull: { upvote: userId } },
            { new: true }
        );

        if (!answer) return res.status(404).json({ error: 'Answer not found' });

        res.json({ upvotes: answer.upvote.length, downvotes: answer.downvote.length });
    } catch (err) {
        console.error('Answer downvote error:', err);
        res.status(500).json({ error: "Something went wrong" });
    }
   };

module.exports.deleteAnswer = async(req,res)=>{
      let {questionId , answerId} = req.params;
      console.log(questionId , answerId);
      try{
        await Answers.findByIdAndDelete(answerId);
        await Doubts.findByIdAndUpdate(questionId, {$pull: {answers: answerId}});
        req.flash("success" , "Answer Deleted Successfully!");
        res.redirect(`/doubtBin/${questionId}`);
    } catch(err) {
        req.flash("error" , "Failed! to delete Answer");
        res.redirect(`/doubtBin/${questionId}`);
    }
   };
 

