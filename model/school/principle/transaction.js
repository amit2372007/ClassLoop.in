// models/Transaction.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const transactionSchema = new Schema(
  {
    // 1. Linking (Who is paying for what?)
    feeRecord: {
      type: Schema.Types.ObjectId,
      ref: "MonthlyFee", // Links to the specific monthly bill
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 2. Payment Details
    amount: {
      type: Number,
      required: true,
      min: 1, // Minimum payment of 1 unit
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Online", "Cheque", "Bank Transfer"],
      required: true,
    },

    // 3. External Reference (For online gateways like Razorpay/Stripe)
    transactionId: {
      type: String,
      unique: true,
      sparse: true, // Allows null/undefined if it's a cash payment
    },

    // 4. Status
    status: {
      type: String,
      enum: ["Success", "Failed", "Pending", "Refunded"],
      default: "Success",
    },

    // 5. Audit
    date: {
      type: Date,
      default: Date.now,
    },
    collectedBy: {
      // If paid in cash at school office
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String, // e.g., "Paid by father via cheque"
  },
  { timestamps: true },
);

module.exports = mongoose.model("Transaction", transactionSchema);
