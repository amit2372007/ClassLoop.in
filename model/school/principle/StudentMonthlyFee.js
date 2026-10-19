const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const priceSetter = (val) =>
  typeof val === "number" ? Math.round(val * 100) / 100 : val;

const monthlyFeeSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    admissionNo: { type: String, required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    month: { type: String, required: true },
    year: { type: Number, required: true },

    billingDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true },

    feeComponents: [
      {
        name: { type: String, required: true },
        amount: { type: Number, required: true, min: 0, set: priceSetter },
      },
    ],

    totalAmount: { type: Number, required: true, min: 0, set: priceSetter },

    discount: {
      reason: String,
      amount: { type: Number, default: 0, set: priceSetter },
    },
    fine: {
      amount: { type: Number, default: 0, set: priceSetter },
      reason: String,
    },
    amountPaid: { type: Number, default: 0, min: 0, set: priceSetter },

    status: {
      type: String,
      enum: ["Pending", "Partial", "Paid", "Overdue", "Waived"],
      default: "Pending",
      index: true,
    },

    transactions: [{ type: Schema.Types.ObjectId, ref: "Transaction" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Multi-Tenant Compound Unique Index
monthlyFeeSchema.index(
  { student: 1, month: 1, year: 1, school: 1 },
  { unique: true },
);

// Safe Virtual Balance Calculation
monthlyFeeSchema.virtual("balanceDue").get(function () {
  const fineAmount = this.fine?.amount || 0;
  const discountAmount = this.discount?.amount || 0;
  const total = this.totalAmount + fineAmount - discountAmount;
  return Math.max(0, priceSetter(total - (this.amountPaid || 0)));
});

module.exports =
  mongoose.models.MonthlyFee || mongoose.model("MonthlyFee", monthlyFeeSchema);
