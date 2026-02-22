const mongoose = require("mongoose");
const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    // 1. Link to the specific school (Crucial if ClassLoop hosts multiple schools)
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      // e.g., "March Tuition Fee - Rahul", "Jan Salary - Dr. Sarah"
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // 2. The Flow of Money
    type: {
      type: String,
      enum: ["INCOME", "EXPENSE"],
      required: true,
    },

    // 3. Financial Categories
    category: {
      type: String,
      enum: [
        "FEE_COLLECTION",
        "TEACHER_SALARY",
        "STAFF_SALARY",
        "TRANSPORT_FUEL",
        "MAINTENANCE",
        "EVENT_FUNDS",
        "MISC",
      ],
      required: true,
    },

    // 4. Dynamic References (Who is the money attached to?)
    // If it's a fee, link the student. If it's a salary, link the teacher/staff.
    relatedUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 5. Audit Trail (Who recorded this transaction?)
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Usually the Principal or Accountant
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"],
      default: "CASH",
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },

    // Allows you to backdate or schedule future transactions
    transactionDate: {
      type: Date,
      default: Date.now,
    },

    receiptNumber: {
      type: String, // Useful for printing actual fee receipts
    },
    description: {
      type: String,
      trim: true,
    },
  },

  { timestamps: true },
);

module.exports = mongoose.model("Transaction", transactionSchema);
