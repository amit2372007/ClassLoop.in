const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const salaryRecordSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    month: { type: String, required: true }, // e.g., "March"
    year: { type: Number, required: true },
    baseAmount: { type: Number, required: true }, // From Employee.basicSalary
    bonuses: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 }, // e.g., unpaid leaves
    netSalary: { type: Number, required: true }, // base + bonuses - deductions
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
    paymentDate: Date,
    transactionId: String, // For bank reference
  },
  { timestamps: true },
);

// Ensure an employee only gets one salary record per month/year
salaryRecordSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("SalaryRecord", salaryRecordSchema);
