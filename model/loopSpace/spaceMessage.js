const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const spaceMessageSchema = new Schema({
    content: { type: String, required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    loopSpace: { type: Schema.Types.ObjectId, ref: "LoopSpace", required: true },
    messageType: { 
        type: String, 
        enum: ["text", "attachment", "doubt_ref"], 
        default: "text" 
    },
    // For DoubtBin references
    doubtRef: { type: Schema.Types.ObjectId, ref: "Doubt" }
}, { timestamps: true });

module.exports = mongoose.model("SpaceMessage", spaceMessageSchema);