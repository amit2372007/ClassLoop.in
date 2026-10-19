const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const employeeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    address: String,
    phone: Number,

    staffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    employeeId: {
      type: String,
      unique: true,
      trim: true,
    },

    designation: {
      type: String,
      required: true,
      trim: true, // e.g., "Senior Science Teacher", "Head Librarian", "Driver"
    },
    department: {
      type: String,
      required: true,
      enum: [
        "Teaching Staff",
        "School Administration",
        "Maintainance & Support Staff",
        "Security & Transport Staff",
        "Food & Hospitality Staff",
        "Technical and Library Staff",
      ],
    },

    // 3. HR & Payroll Information
    dateOfJoining: {
      type: Date,
      required: true,
    },
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String, // Crucial for Indian banking transfers
      bankName: String,
    },

    documents: {
      aadharNumber: String,
      panNumber: String,
    },

    // 5. Academic Specifics (Only applicable if the employee is a teacher)
    qualifications: [
      {
        type: String, // e.g., "B.Tech CSE", "B.Ed", "M.Sc Mathematics"
      },
    ],
    experienceYears: {
      type: Number,
      default: 0,
    },

    // 6. Current Status
    status: {
      type: String,
      enum: ["Active", "On Leave", "Resigned", "Terminated", "Suspended"],
      default: "Active",
    },

    // Optional: Track physical assets given to the employee
    assignedAssets: [
      {
        assetName: String, // e.g., "Staff Laptop", "Locker Key"
        assetId: String,
        dateIssued: Date,
      },
    ],
  },
  { timestamps: true },
);

const Employee = mongoose.model("Employee", employeeSchema);

module.exports = Employee;
