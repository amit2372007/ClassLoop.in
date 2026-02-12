const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const applicationSchema = new Schema(
  {
    // 1. Who is asking?
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true, // vital for Class Teachers to filter "My Class Applications"
    },
    // 3. What are they asking for?
    type: {
      type: String,
      enum: [
        "Leave",
        "Bonafide Certificate",
        "Transfer Certificate",
        "Complaint",
        "Other",
      ],
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },

    // 4. Specific Data for Leaves
    dateRange: {
      from: { type: Date },
      to: { type: Date },
    },

    // 5. Attachments (e.g., Medical Certificate image URL from ImageKit)
    attachments: [
      {
        url: String,
        filename: String,
      },
    ],

    // 6. Approval Flow
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "In-Progress"],
      default: "Pending",
    },

    // Who acted on this? (Teacher or Principal)
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    // Teacher's feedback (e.g., "Rejected because exam is tomorrow")
    teacherRemarks: {
      type: String,
    },
  },
  { timestamps: true },
); // Automatically adds createdAt and updatedAt

module.exports = mongoose.model("Application", applicationSchema);
