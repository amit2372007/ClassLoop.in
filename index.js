if(process.env.NODE_ENV != "production") {
    require('dotenv').config();
};

const express = require("express");
const app = express();
const ejsMate = require("ejs-mate");
const path = require("path");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const flash = require("connect-flash");
const session = require("express-session");
const ExpressError = require("./utils/ExpressError");
const wrapAsync = require("./utils/wrapAsync.js");

const {isLoggedIn} = require("./middleware.js");

const  port = 3000;
const dbUrl = "mongodb://127.0.0.1:27017/bfgiSpot";
const Posts = require("./model/post");
const Users = require("./model/User");
const Comments = require("./model/comment");
const { error } = require('console');

let sessionOption = {
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
            maxAge:   7 * 24 * 60 * 60 * 1000,
            httpOnly: true
        },
};

app.set("views" , path.join(__dirname , "views"));
app.set("view engine" , "ejs");
app.use(express.static(path.join(__dirname , "public")));
app.use(express.urlencoded({extended : true}));
app.use(methodOverride('_method'));
app.engine('ejs' , ejsMate);

main()
    .then((res)=>{
        console.log("connection succesfull");
    })
    .catch(err => console.log(err));

async function main() {
  await mongoose.connect(dbUrl);
}

app.use(session(sessionOption));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
 

passport.use(new LocalStrategy(Users.authenticate()));
passport.serializeUser(Users.serializeUser());
passport.deserializeUser(Users.deserializeUser());

app.use((req,res,next)=>{
   res.locals.success = req.flash("success");
   res.locals.error = req.flash("error");
   res.locals.currUser = req.user;
   next();
});


app.get("/home" ,async (req,res)=>{
    const allPosts = await Posts.find({}).sort({ createdAt: -1 }).populate("owner");
    res.render("./webpage/home.ejs" ,{allPosts});
});

app.get("/new-post",isLoggedIn , (req,res)=>{
    res.render("./webpage/createPost.ejs")
});

//createPost
app.post("/createPost" , async(req,res)=>{
    let newPost = new Posts(req.body.post);
    newPost.owner = req.user._id;
    req.user.post.push(newPost._id);
    await newPost.save();
    await req.user.save();
    req.flash("success" , "Uploaded a new Post");
    res.redirect("/home");
});
//delete post route 
app.delete("/post/:id/delete",isLoggedIn , async(req,res)=>{
    let currUserId = req.user._id;
    const Post = await Posts.findById(req.params.id);
    if(!Post.owner.equals(currUserId)){
        req.flash("error" , "You do not have permission to delete this post");
        return res.redirect("/home");
    }
    
    try{
        await Comments.deleteMany({postId: req.params.id});
        await Users.findByIdAndUpdate(currUserId, { $pull: { post: Post._id } });
        await Posts.findByIdAndDelete(req.params.id);
        req.flash("success" , "Post Deleted Successfully");
        res.redirect("/home");
    } catch(err){
        console.log("unable to find Post");
        res.redirect("/");
    }
});

app.get("/post/:id/edit" ,async (req,res)=>{
    let {id} = req.params;
    try{
      const Post = await Posts.findById(id);
      res.render("./webpage/editPost.ejs" , {Post});
    } catch(err) {
      res.send("Can'nt find Post");
    }
});

// //edit route
app.put("/post/:id/edit" , async(req,res)=>{
    try{
        let {id} = req.params;
        let updatedPost = await Posts.findByIdAndUpdate(id , req.body.post);
        req.flash("success" , "Post edited Successfully");
        res.redirect("/home");
    } catch(err){
        console.log("unable to find Post");
        res.redirect("/home");
    }
});


//show post
app.get("/post/:id" , async(req,res)=>{
    try{
        let {id} = req.params;
        let Post = await Posts.findById(id).populate({path: "comments" ,
                                                         populate : {
                                                          path: "author",
                                                        }})
                                                        .populate("owner");
        req.flash("success" , "Post created Successfully");
        res.render("./webpage/post.ejs" , {Post});
    } catch(err){
        console.log("unable to find Post");
        res.redirect("/");
    }
});

//comment save 
app.post("/post/:id/comment" , async (req,res)=>{
    let {id} = req.params;
    let Post = await Posts.findById(id);

    let newCommentText = req.body.comments.comment;
    let newComment = new Comments({comment: newCommentText});
   
    newComment.author = req.user._id;
    newComment.postId = Post._id;
    Post.comments.push(newComment);

    await newComment.save();
    await Post.save();
    
    req.flash("success" , "Comment added successfully!");
    res.redirect(`/post/${id}`);
});

//signup page render
app.get("/signup" , (req,res)=>{
     res.render("./user/createId.ejs");
});

//signup
app.post("/signup" ,async (req,res)=>{
   try{
        let {username ,name , phone , password , bio , profilePic} = req.body;
        const newUser = new Users({username ,name , phone , bio , profilePic});
        const newRegister = await Users.register(newUser , password);
        req.login(newRegister ,(err)=>{
        req.flash("success" , `Hey! ${req.user.name} your Account created Successfully`);
        res.redirect("/home");
        });   
    } catch(e){
        res.send(e)
        res.redirect("/signup");
    };
});

//login page render
app.get("/login" , (req,res)=>{
       res.render("./user/login.ejs");
});

//login
app.post(
    "/login",
    passport.authenticate("local" , {failureRedirect: "/login", failureFlash: true}),
    async(req,res)=>{

    req.flash("success" , `Welcome Back! ${req.user.username}`);
    // let redirectUrl =  res.locals.redirectUrl || "/listings";
    res.redirect("/home");
});

//logout
app.get("/logout" , 
(req,res,next)=>{
       req.logout((err)=>{
       if(err) {
        return next(err);
       };
    req.flash("success" , "Logged Out Successfully");
    res.redirect("/home");
    });
});

//Post Like
app.post("/post/:id/like" ,isLoggedIn, async(req,res)=>{
    try{
       let {id} = req.params;
       let userId = req.user._id;
       let Post = await Posts.findById(id);

       if(!Post) {
         req.flash("error" , "Post Not Found");
         res.redirect("/home");
       }

       let hasLiked = Post.like.includes(userId);
       if(hasLiked) {
         await Posts.findByIdAndUpdate(id, { $pull: { like: userId } });
       } else{
        await Posts.findByIdAndUpdate(id, { $addToSet: { like: userId } });
       }

    res.redirect(`/post/${id}`);
    } catch(err){
        req.flash("error", "Something went wrong.");
        res.redirect(`/post/${id}`);
    }
});

//render user interface

app.get("/profile", isLoggedIn ,async(req,res)=>{
    let User = await req.user.populate("post");
    res.render("./user/profile.ejs" , {User});
});

//all users route
app.get("/users",isLoggedIn , async(req,res)=>{
     let allUsers = await Users.find({});
     res.render("./user/findUsers.ejs" , {allUsers});
});

//Follw a user route
app.get("/follow/:id", isLoggedIn, async(req,res)=>{
     let {id} = req.params;
     let User = await Users.findById(id);
     let currUser = req.user;
     let currUserId = req.user._id;
     const referrerUrl = req.get('Referer');
     console.log(referrerUrl);

     if(!User) {
        req.flash("error" , "User not Found" );
        res.render("/home");
     }

     let hasFollowed = User.followers.includes(currUserId);

     if(hasFollowed) {
        await Users.findByIdAndUpdate(id, { $pull: { followers: currUserId } });
        await Users.findByIdAndUpdate(currUserId, { $pull: { following: User._id } });
        res.redirect(`${referrerUrl}`);
     } else{
        User.followers.push(currUserId);
        currUser.following.push(User._id);
        await currUser.save();
        await User.save();
        res.redirect(`${referrerUrl}`);
     }
});

//find User-->
app.get("/user/:id" , async(req,res)=>{
    let {id} = req.params;
    let User = await Users.findById(id).populate("post");
    res.render("./user/userProfile.ejs" , {User});
});


// ExpressError Class-->
app.use((req , res , next)=>{
    next(new ExpressError(404 , "Page not Found!"));
});

// Custom Error Handling
app.use((err , req , res, next)=>{
    let {statusCode=500 , message="something went wrong"} = err;
    res.render("error.ejs" , {err});
});

app.listen(port , ()=>{
   console.log(`App is listning to port: ${port}`);
});