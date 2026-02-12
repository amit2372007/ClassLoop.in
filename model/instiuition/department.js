const mongoose = require("mongoose");
const instituition = require("./instituition");
const Schema = mongoose.Schema;

const departmentSchema = Schema({
      name: {
        type: String,
        require: true
      },
      batch: [
        {
        type: Schema.Types.ObjectId,
        ref: "batch"
        },
    ],
      admin: {
        type: Schema.Types.ObjectId,
        ref: "user"
      },
      instituition:{
        type: Schema.Types.ObjectId,
        ref: "instituition"
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
});

const Department = mongoose.model("Department" , departmentSchema);

module.exports = Department;