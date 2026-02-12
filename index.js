if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const http = require("http");
const express = require("express");
const app = express();
const { Server } = require("socket.io");

const server = http.createServer(app);
const ImageKit = require("imagekit");
const multer = require("multer");

const ejsMate = require("ejs-mate");
const path = require("path");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const flash = require("connect-flash");
const session = require("express-session");
const axios = require("axios");
const ExpressError = require("./utils/ExpressError");
const wrapAsync = require("./utils/wrapAsync.js");

const {
  isLoggedIn,
  countNotification,
  formatDistanceToNow,
} = require("./middleware.js");

const port = 3000;
const dbUrl = "mongodb://127.0.0.1:27017/bfgiSpot";
//loopSpace
const LoopSpace = require("./model/loopSpace/loopSpace.js");
const SpaceMessage = require("./model/loopSpace/spaceMessage.js");
//models
const Posts = require("./model/post");
const Users = require("./model/User");
const Comments = require("./model/comment");
const Message = require("./model/message.js");
const Notification = require("./model/notification/notification.js");
//DoubtBin models
const Doubts = require("./model/DoubtBin/doubt.js");
const Answers = require("./model/DoubtBin/answer.js");
// School model
const Schools = require("./model/school/school.js");
const Class = require("./model/school/classes.js");
const Notice = require("./model/school/notice.js");
const Attendance = require("./model/school/attendance.js");
const Form = require("./model/school/form.js");
const FormResponse = require("./model/school/formResponse.js");
const Assignment = require("./model/school/assignment.js");
const Resources = require("./model/school/resourse.js");
// Connection model

let Connection = require("./model/connection/connection.js");
// All routes
const home = require("./routes/home.js");
const doubtBin = require("./routes/doubtBin.js");
const post = require("./routes/post.js");
const user = require("./routes/user.js");
const comment = require("./routes/comment.js");
const chat = require("./routes/chat.js");
//school routes
const school = require("./routes/school.js");
const teacher = require("./routes/teacher.js");
const { error } = require("console");
//loopSpace Routes
const loopSpace = require("./routes/loopSpace.js");
//notifications routes
const notification = require("./routes/notifications.js");
//Socket Routes
const socketRouter = require("./routes/socketRouter.js");

const upload = multer({ storage: multer.memoryStorage() });

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const OTP_Key = process.env.OTP_API_KEY;

let sessionOption = {
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);

main()
  .then((res) => {
    console.log("connection succesfull");
  })
  .catch((err) => console.log(err));

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

app.use(async (req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  res.locals.formatDistanceToNow = formatDistanceToNow;
  res.locals.currPath = req.path;
  next();
});

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
socketRouter(io);

app.use(countNotification);

app.use("/home", home);
app.use("/doubtBin", doubtBin);
app.use("/post", post);
app.use("/user", user);
app.use("/comment", comment);
app.use("/chat", chat);
app.use("/teacher", teacher);
app.use("/loopSpace", loopSpace);
app.use("/notifications", notification);
app.use("/school", school);

app.get("/", (req, res) => {
  res.render("./webpage/info.ejs");
});

app.get("/admin", isLoggedIn, async (req, res) => {
  if (!req.user.designation === "admin") {
    req.flash("error", "Authorization Failed!");
    req.redirect("/home");
  }
  let schools = await Schools.find({});
  res.render("./admin/adminDashboard.ejs", { schools });
});

app.get("/admin/addschool", isLoggedIn, async (req, res) => {
  if (!req.user.designation === "admin") {
    req.flash("error", "Authorization Failed!");
    req.redirect("/home");
  }
  res.render("./admin/addSchoolForm.ejs");
});

app.post("/admin/addSchool", async (req, res) => {
  try {
    // 1. Extract data from the form
    const { name, email, phone, address, id: principalId } = req.body;

    // 2. Create the new school in the database
    const newSchool = new Schools({
      name: name,
      email: email,
      phone: phone, // This matches the field we added to the School model earlier
      location: `${address.city}, ${address.state}`, // Combining for your location string
      address: {
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      principle: principalId, // Linking the Principal's User ID
    });

    await newSchool.save();

    // 3. Update the Principal's user record
    // We link this school to the user and change their designation
    await Users.findByIdAndUpdate(principalId, {
      "instituition.school": newSchool._id,
      designation: "principle",
    });

    req.flash("success", "Created a new School");
    res.redirect("/admin");
  } catch (err) {
    req.flash("error", `error : ${err}`);
    console.error("Error creating school:", err);
    res.status(500).send("Server Error: Could not create school.");
  }
});

app.get("/beta-version", (req, res) => {
  req.flash("error", "Page under Maintenance!");
  const backURL = req.header("Referer") || "/";
  res.redirect(backURL);
});

// ExpressError Class-->
app.use((req, res, next) => {
  next(new ExpressError(404, "Page not Found!"));
});

// Custom Error Handling
// app.js (or your middleware file)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";
  // Set the status on the response so the browser knows it's an error
  res.status(statusCode).render("error.ejs", { err, statusCode, message });
});

server.listen(port, () => {
  console.log(`🚀 Server (HTTP + Socket.IO) running on port: ${port}`);
});
