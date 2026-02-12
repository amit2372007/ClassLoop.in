require('dotenv').config();
const mongoose = require("mongoose");
const User = require("./model/User.js"); 

const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/classLoop";

mongoose.connect(dbUrl).then(async () => {
    console.log("Connected. Checking all users...");
    const users = await User.find({});
    
    for (let user of users) {
        console.log(`Checking User: ${user.name}`);
        
        // Check if instituition exists at all
        if (!user.instituition) {
            console.log(`-> Fixing missing object for ${user.name}`);
            user.instituition = { school: null, class: null };
        } else {
            console.log(`-> Instituition exists: School ID is ${user.instituition.school}`);
        }

        await user.save();
    }
    console.log("Done.");
    process.exit();
}).catch(err => console.error(err));