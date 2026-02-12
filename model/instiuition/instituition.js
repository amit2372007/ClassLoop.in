const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const instituitionSchema = Schema({
    name: {
        type: String,
        require: true
    },
    Departments: [
        {
        type: Schema.Types.ObjectId,
        ref: "department"
    },
    ],
    address: {
        type: String,
    },
    email: {
        type: String,
    },
    posts: [
        {
        type: Schema.Types.ObjectId,
        ref: "post" 
    },
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }

});

const instituition = mongoose.model("instituition" , instituitionSchema);

module.exports = instituition;

