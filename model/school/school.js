const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const schoolSchema = Schema({
    name: {
        type: String,
        required: true
    },
    address: {
        city: String,
        state: String,
        pincode: Number
    },
    email: {
        type: String,
        required: true,
        unique: true    
    },
    phone:{
        type: Number,
    },
    principle: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    teachers: [
        {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    classes: [
        {
            type: Schema.Types.ObjectId,
            ref: "Class"
        }
    ],
    status: { 
        type: String, 
        enum: ["active", "suspended", "pending"], 
        default: "active" 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }

});

const School = mongoose.model("School" , schoolSchema);

module.exports = School;