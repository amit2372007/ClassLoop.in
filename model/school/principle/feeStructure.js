// models/FeeStructure.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const feeStructureSchema = new Schema(
  {
    name: {
      type: String,
      required: true, // e.g., "Class 10 Standard Fee - 2025"
    },
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    // Link to your existing Class model
    classLink: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    // The Breakdown
    components: [
      {
        name: { type: String, required: true }, // "Tuition Fee", "Computer Lab"
        amount: { type: Number, required: true },
      },
    ],

    totalAmount: { type: Number, required: true }, // Sum of components
    isActive: { type: Boolean, default: true }, // Toggle off to stop using it
  },
  { timestamps: true },
);

module.exports = mongoose.model("FeeStructure", feeStructureSchema);
