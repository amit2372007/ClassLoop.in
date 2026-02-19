const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = Schema({
  //User Details
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: Number,
    required: true,
    unique: true,
  },
  bio: {
    type: String,
    default: "Not specified",
  },
  location: {
    type: String,
    default: "Not specified",
  },
  designation: {
    type: String,
    required: true,
    default: "other",
    enum: ["student", "teacher", "principle", "admin", "classTeacher","other"],
  },
  skills: [
    {
      type: String,
      min: 3,
      max: 10
    }
  ],

  //social media
  post: [
    {
      type: Schema.Types.ObjectId,
      ref: "Post",
    },
  ],
  synced: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  profilePic: {
    url: {
      type: String,
      default: "https://ik.imagekit.io/xcrdwi6be/classloop_avatars/9434619.jpg",
    },
    fileId: {
      type: String,
      default: "default",
    },
  },
  coverPic: {
    url: {
      type: String,
      default:
        "https://ik.imagekit.io/xcrdwi6be/classloop_avatars/freepik__fun-cartoonstyle-group-of-small-student-avatars-ch__31011.jpeg",
    },
    fileId: {
      type: String,
      default: "default",
    },
  },
  loopSpace: [
    {
      type: Schema.Types.ObjectId,
      ref: "LoopSpace",
    },
  ],
  doubt: [
    {
      type: Schema.Types.ObjectId,
      ref: "Doubt",
    },
  ],

  //instituition
  rollNumber: Number,
  employeeId: String,
  instituition: {
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
    },
    class: {
      // Add this!
      type: Schema.Types.ObjectId,
      ref: "Class",
    },
  },
  isVerified: { type: Boolean, default: false }, // Verified by school admin

  createdAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

module.exports = User;
