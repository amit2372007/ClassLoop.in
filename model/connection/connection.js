const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const connectionSchema = Schema({
   sender: {
        type: Schema.Types.ObjectId,    
        ref: "User",
        required: true  
   },
   receiver: {
        type: Schema.Types.ObjectId,    
        ref: "User",
        required: true  
   },
   status: {    
        type: String,    
        enum: ["pending", "accepted", "rejected" , "blocked"],    
        default: "pending"  
    },          
    createdAt: {            
        type: Date,
        default: Date.now
    }
});

const Connection = mongoose.model("Connection", connectionSchema);
module.exports = Connection;