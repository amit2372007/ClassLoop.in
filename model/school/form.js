const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const formSchema = new Schema({
    title: { type: String, required: true },
    description: String,
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    
    // The actual questions
    questions: [{
        questionText: { type: String, required: true },
        questionType: { 
            type: String, 
            enum: ["text", "multiple_choice", "checkbox", "dropdown"], 
            default: "text" 
        },
        options: [String], // Only used for choice-based questions
        isRequired: { type: Boolean, default: false }
    }],
    responses: [{ type: Schema.Types.ObjectId, ref: "FormResponse" }],
    isOpen: { type: Boolean, default: true },
    expiresAt: Date
}, { timestamps: true });

module.exports = mongoose.model("Form", formSchema);