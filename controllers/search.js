const User = require("../model/User");
const LoopSpace = require("../model/loopSpace/loopSpace");
const Post = require("../model/post");
const Doubt = require("../model/DoubtBin/doubt");

module.exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query; // Get the search term from the URL (?q=...)

    if (!q) {
      req.flash("error", "Please enter a search term.");
      return res.redirect("back");
    }

    // Create a Case-Insensitive Regex
    const regex = new RegExp(q, "i");

    // Run queries in parallel for speed
    const [users, spaces, posts, doubts] = await Promise.all([
      // 1. Search Users (Name or Username)
      User.find({
        $or: [{ name: regex }, { username: regex }],
      })
        .limit(10)
        .select("name username profilePic designation"),

      // 2. Search LoopSpaces (Name)
      LoopSpace.find({ name: regex }).limit(10),

      // 3. Search Posts (Content/Caption)
      Post.find({ description: regex })
        .populate("owner", "name profilePic")
        .limit(10),

      // 4. Search Doubts (Question)
      Doubt.find({ title: regex }).populate("author", "name").limit(10),
    ]);

    res.render("./search/searchResults.ejs", {
      query: q,
      users,
      spaces,
      posts,
      doubts,
      searchQuery: q, // To keep the input filled
    });
  } catch (err) {
    console.error("Search Error:", err);
    req.flash("error", "Search failed.");
    res.redirect("/home");
  }
};
