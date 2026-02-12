const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const messageSchema = new Schema({
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
   
    receiver: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    image: {
        url: String,
        filename: String
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },

    isRead: {
        type: Boolean,
        default: false
    }
});

const Message = mongoose.model("Message" , messageSchema);

module.exports = Message;