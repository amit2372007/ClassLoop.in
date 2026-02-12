const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const postsSchema = Schema({
   owner: {
      type: Schema.Types.ObjectId,
      ref: "User"
   },
   description: {
      type: String,
      require: true
   },
   image: {
      url: String,
      fileId: String
   },
   like: [
      {
            type: Schema.Types.ObjectId,
            ref: "User"
      }
   ],
   comments: [
      {
            type: Schema.Types.ObjectId,
            ref: "Comment"
      }
   ],
   createdAt: {
      type: Date,
      default: Date.now
   }

}); 

const Post = mongoose.model("Post" , postsSchema);

module.exports = Post;