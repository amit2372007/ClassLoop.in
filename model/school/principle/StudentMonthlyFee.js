const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const monthlyFeeSchema = new Schema(
  {
    // 1. Linking Data
    student: {
      type: Schema.Types.ObjectId,
      ref: "User", // Assuming your student model is 'User'
      required: true,
      index: true, // Helps in searching fees by student
    },
    admissionNo: {
      type: String,
      required: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
    },
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
    },

    // 2. Time Period
    month: {
      type: String, // e.g., "November" or use numbers 1-12
      required: true,
      enum: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
    },
    year: {
      type: Number,
      required: true,
      default: new Date().getFullYear(),
    },

    // 3. Financial Breakdown
    feeComponents: [
      {
        name: { type: String, required: true }, // e.g., "Tuition Fee", "Bus Fee"
        amount: { type: Number, required: true, min: 0 },
      },
    ],

    // 4. Payment Calculations
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      reason: String, // e.g., "Scholarship", "Sibling Discount"
      amount: { type: Number, default: 0 },
    },
    fine: {
      amount: { type: Number, default: 0 },
      reason: String, // e.g., "Late Payment"
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 5. Status & Tracking
    status: {
      type: String,
      enum: ["Pending", "Partial", "Paid", "Overdue", "Waived"],
      default: "Pending",
      index: true, // Vital for "Who hasn't paid?" queries
    },
    dueDate: {
      type: Date,
      required: true,
    },

    // 6. Payment History (Embedded for quick access)
    transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],

    // 7. Audit
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // ID of the Principal/Admin who generated this
    },
  },
  {
    timestamps: true,
  },
);

// === CRITICAL INDEX ===
// This prevents creating two fee records for "Amit Kumar" for "November 2025"
monthlyFeeSchema.index({ student: 1, month: 1, year: 1 }, { unique: true });

// === VIRTUAL FOR BALANCE ===
// Calculates how much is left to pay on the fly
monthlyFeeSchema.virtual("balanceDue").get(function () {
  const total = this.totalAmount + this.fine.amount - this.discount.amount;
  return Math.max(0, total - this.amountPaid);
});

module.exports = mongoose.model("MonthlyFee", monthlyFeeSchema);
