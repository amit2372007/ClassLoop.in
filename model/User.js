const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = Schema({
   name: {
      type: String,
      require: true
   },
   post: [
      {
       type: Schema.Types.ObjectId,
       ref: "Post"
      },
   ],
   phone: {
      type: Number,
      require: true
   },
   following: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      },
   ],
   followers: [
      {
         type: Schema.Types.ObjectId,
         ref: "User"
      }
   ],
   createdAt: {
      type: Date,
      default: Date.now
   },
   bio: {
      type: String,
      require: true
   },
   profilePic: {
      type: String,
      default: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8cHJvZmlsZSUyMHBpY3R1cmV8ZW58MHx8MHx8fDA%3D"
   }
}); 

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User" , userSchema);

module.exports = User;