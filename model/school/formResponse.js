const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const responseSchema = new Schema({
    form: { type: Schema.Types.ObjectId, ref: "Form", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    answers: [{
        questionId: { type: Schema.Types.ObjectId, required: true }, // Links to the question in Form model
        value: Schema.Types.Mixed // Can store String for text or Array for checkboxes
    }]
}, { timestamps: true });

module.exports = mongoose.model("FormResponse", responseSchema);