const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Helper to prevent floating-point bugs
const priceSetter = (val) =>
  typeof val === "number" ? Math.round(val * 100) / 100 : val;

const feeStructureSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    classLink: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    frequency: {
      type: String,
      enum: ["Monthly", "Yearly", "One-Time"],
      default: "Monthly",
    },
    components: [
      {
        name: { type: String, required: true },
        amount: { type: Number, required: true, min: 0, set: priceSetter },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0, set: priceSetter },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.FeeStructure ||
  mongoose.model("FeeStructure", feeStructureSchema);
