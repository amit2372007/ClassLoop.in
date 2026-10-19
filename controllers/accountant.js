const mongoose = require("mongoose");
const Users = require("../model/User.js"); // Adjust model paths as per your project
const Class = require("../model/school/classes.js");
const MonthlyFee = require("../model/school/principle/StudentMonthlyFee.js");
const Transaction = require("../model/school/principle/transaction.js"); // Optional, for tracking successful payments

// 1. Render Dashboard & Fee Counter View
module.exports.renderDashboard = async (req, res) => {
  try {
    // --- PUT THIS LOG AT THE VERY TOP ---
    console.log("=== RENDER DASHBOARD HIT ===");
    console.log("Full req.query:", req.query);
    console.log("req.query.Tab:", req.query.Tab);
    console.log("req.query.tab:", req.query.tab);
    const activeTab = req.query.Tab || "Dashboard";
    const schoolId = req.user?.instituition?.school; // Tenant boundary isolation

    if (!schoolId) {
      req.flash("error", "School identification missing from your account.");
      return res.redirect("/user/login");
    }

    // Always fetch classes for the school (needed in dropdowns across Fee Counter)
    const classes = await Class.find({ school: schoolId })
      .select("className section")
      .sort({ className: 1, section: 1 });

    // Initial payload object passed to EJS view
    const viewData = {
      activeTab,
      classes,
      stats: {
        totalStudents: 0,
        totalCollected: 0,
        totalPending: 0,
        dailyCollection: 0,
      },
      feeRecords: [],
      recentTransactions: [], // Container for recent 5 desk transactions
      query: req.query, // Pass query to frontend for direct links (e.g., ?studentId=123)
    };

    // --- TAB 1: DASHBOARD OVERVIEW ---
    if (activeTab === "Dashboard") {
      viewData.stats.totalStudents = await Users.countDocuments({
        "instituition.school": schoolId,
        designation: "student",
      });

      const financialStats = await MonthlyFee.aggregate([
        { $match: { school: schoolId } },
        {
          $group: {
            _id: "$status", // e.g., "Paid", "Pending", "Overdue"
            totalAmount: { $sum: "$totalAmount" },
          },
        },
      ]);

      financialStats.forEach((stat) => {
        if (stat._id === "Paid")
          viewData.stats.totalCollected = stat.totalAmount;
        if (stat._id === "Pending" || stat._id === "Overdue") {
          viewData.stats.totalPending += stat.totalAmount;
        }
      });

      viewData.feeRecords = await MonthlyFee.find({ school: schoolId })
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate("student", "name admissionNumber username")
        .populate("class", "className section");
    }

    // --- TAB 2: FEE COUNTER ---
    else if (activeTab === "FeeCounter") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      console.log("===== DEBUGGING FEE COUNTER =====");
      console.log(
        "1. Current School ID from req.user:",
        schoolId,
        "Type:",
        typeof schoolId,
      );
      console.log("2. Start of Day Timestamp:", startOfDay);

      // Check how many total transactions exist in the database regardless of school/status
      const totalInDb = await Transaction.countDocuments({});
      const successTodayInDb = await Transaction.countDocuments({
        status: "Success",
        date: { $gte: startOfDay },
      });
      console.log(
        `3. DB Check -> Total Txns in DB: ${totalInDb} | Successful Txns Today (All Schools): ${successTodayInDb}`,
      );

      // Ensure schoolId is a proper Mongoose ObjectId for aggregation matching
      const schoolObjId = new mongoose.Types.ObjectId(schoolId);

      // 1. Calculate Today's Collection from successful Transactions
      const dailyStats = await Transaction.aggregate([
        {
          $match: {
            status: "Success",
            date: { $gte: startOfDay },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "student",
            foreignField: "_id",
            as: "studentDoc",
          },
        },
        { $unwind: "$studentDoc" },
        {
          $match: {
            "studentDoc.instituition.school": schoolObjId, // Using explicit ObjectId
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]);

      console.log("4. Aggregation Daily Stats Result:", dailyStats);
      viewData.stats.dailyCollection = dailyStats[0]?.total || 0;

      // 2. Fetch Recent Transactions for the Desk Widget
      const recentTxns = await Transaction.find({ status: "Success" })
        .sort({ date: -1 })
        .populate({
          path: "student",
          select: "name admissionNumber phone instituition",
        })
        .populate({
          path: "feeRecord",
          select: "month year totalAmount",
        })
        .limit(10);

      console.log(
        `5. Fetched ${recentTxns.length} raw transactions before school filtering.`,
      );

      // Filter out transactions where student or school doesn't match
      viewData.recentTransactions = recentTxns
        .filter((txn) => {
          if (!txn.student) return false;
          const txnSchoolId = txn.student.instituition?.school?.toString();
          return txnSchoolId === schoolId.toString();
        })
        .slice(0, 5)
        .map((txn) => ({
          _id: txn._id,
          transactionId: txn.transactionId,
          totalAmount: txn.amount,
          paymentMethod: txn.paymentMethod,
          status: txn.status,
          createdAt: txn.date || txn.createdAt,
          paymentRemarks: txn.remarks,
          month: txn.feeRecord?.month || "N/A",
          year: txn.feeRecord?.year || "",
          student: {
            name: txn.student?.name || "Student",
            admissionNumber: txn.student?.admissionNumber || "N/A",
            phone: txn.student?.phone || "",
          },
        }));

      console.log(
        "6. Final Filtered Recent Transactions Count:",
        viewData.recentTransactions.length,
      );
      console.log("=================================");
    }

    res.render("accountant/dashboard", viewData);
  } catch (error) {
    console.error("Dashboard Render Error:", error);
    req.flash("error", "Failed to load dashboard.");
    res.redirect("back");
  }
};
// 2. API: Fetch Students by Class (For Dropdown)
module.exports.getStudentsByClass = async (req, res) => {
  try {
    const schoolId = req.user?.instituition?.school;
    const { classId } = req.params;

    const students = await Users.find({
      "instituition.school": schoolId,
      "instituition.class": classId,
      designation: "student",
    }).select("name admissionNumber _id");

    res.json({ success: true, students });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch students" });
  }
};

// 3. API: Search Single Student & Fetch Pending Fees
module.exports.searchStudent = async (req, res) => {
  try {
    const schoolId = req.user?.instituition?.school;
    const { type, query } = req.query;

    if (!query)
      return res.json({ success: false, message: "Search query required" });

    // Build secure filter
    let filter = { "instituition.school": schoolId, designation: "student" };
    if (type === "adm") filter.admissionNumber = query;
    else if (type === "class")
      filter._id = query; // Dropdown sends student _id
    else if (type === "username") filter.username = query;
    else return res.json({ success: false, message: "Invalid search type" });

    // Find Student
    const student = await Users.findOne(filter).populate(
      "instituition.class",
      "className section",
    );

    if (!student) {
      return res.json({
        success: false,
        message: "No student found matching this criteria.",
      });
    }

    // Find Pending Fees
    const pendingFees = await MonthlyFee.find({
      student: student._id,
      school: schoolId,
      status: { $in: ["Pending", "Overdue"] },
    });
    // Map the database document accurately to the frontend
    const formattedFees = pendingFees.map((fee) => ({
      id: fee._id,
      month: fee.month,
      year: fee.year,
      // Create a nice summary string of what components make up this bill
      componentsSummary: fee.feeComponents
        .map((c) => `${c.name} (₹${c.amount})`)
        .join(", "),
      amount: Number(fee.totalAmount) || 0,
      fine: Number(fee.fine?.amount) || 0,
      discount: Number(fee.discount?.amount) || 0,
    }));

    res.json({
      success: true,
      student: {
        id: student._id,
        name: student.name,
        admNo: student.admissionNumber || "N/A",
        class: student.instituition?.class
          ? `${student.instituition.class.className} ${student.instituition.class.section}`
          : "N/A",
        father: student.parentDetails?.fatherName || "N/A",
        mobile: student.parentDetails?.phone || "N/A",
        avatar:
          student.profilePic ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=0ea5e9&color=fff`,
      },
      fees: formattedFees,
    });
  } catch (error) {
    console.error("Search Student Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during search." });
  }
};

// --- API: SETTLE MULTIPLE FEES & CREATE AUDIT TRANSACTIONS ---
module.exports.settleMultipleFees = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.instituition?.school;
    const staffId = req.user?._id;

    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      req.flash("error", "Unauthorized: School identification missing.");
      return res.redirect("/accountant?Tab=FeeCounter");
    }

    const { studentId, feeIds, discount, method, transactionId, remarks } =
      req.body;

    // 1. Validation
    if (
      !studentId ||
      !feeIds ||
      !Array.isArray(feeIds) ||
      feeIds.length === 0
    ) {
      await session.abortTransaction();
      session.endSession();
      req.flash(
        "error",
        "Invalid settlement request: No fee records selected.",
      );
      return res.redirect("/accountant?Tab=FeeCounter");
    }

    // 2. Fetch pending fee records securely within school boundaries
    const feesToSettle = await MonthlyFee.find({
      _id: { $in: feeIds },
      student: studentId,
      school: schoolId,
      status: { $ne: "Paid" },
    }).session(session);

    if (feesToSettle.length === 0) {
      await session.abortTransaction();
      session.endSession();
      req.flash("error", "Selected fee records not found or already settled.");
      return res.redirect("/accountant?Tab=FeeCounter");
    }

    // 3. Normalize Payment Method to match Transaction schema enum: ["Cash", "Online", "Cheque", "Bank Transfer"]
    let normalizedMethod = "Cash";
    const mLower = (method || "").toLowerCase();
    if (
      mLower.includes("upi") ||
      mLower.includes("online") ||
      mLower.includes("card")
    ) {
      normalizedMethod = "Online";
    } else if (mLower.includes("cheque")) {
      normalizedMethod = "Cheque";
    } else if (mLower.includes("transfer") || mLower.includes("bank")) {
      normalizedMethod = "Bank Transfer";
    }

    // 4. Handle sparse unique transactionId (prevent empty string duplicate key errors in MongoDB)
    const sanitizedTxnId =
      transactionId && transactionId.trim() !== ""
        ? transactionId.trim()
        : undefined;

    // Distribute any global discount proportionately across the settled fee months
    const totalSelectedDue = feesToSettle.reduce((sum, f) => {
      const fineAmt = f.fine?.amount || 0;
      return sum + f.totalAmount + fineAmt - (f.discount?.amount || 0);
    }, 0);

    const globalDiscount = Number(discount) || 0;

    let createdTransactionIds = [];

    // 5. Process each monthly fee record and create corresponding Transaction
    for (let fee of feesToSettle) {
      const fineAmt = fee.fine?.amount || 0;
      const existingDisc = fee.discount?.amount || 0;
      const recordDue = fee.totalAmount + fineAmt - existingDisc;

      // Proportionate discount share for this specific record
      const recordDiscountShare =
        globalDiscount > 0 && totalSelectedDue > 0
          ? Math.round((recordDue / totalSelectedDue) * globalDiscount * 100) /
            100
          : 0;

      const netPayable = Math.max(0, recordDue - recordDiscountShare);

      // Update MonthlyFee record
      fee.amountPaid = (fee.amountPaid || 0) + netPayable;
      fee.status = "Paid";

      if (globalDiscount > 0) {
        fee.discount = {
          reason: remarks
            ? `Desk Settlement Discount: ${remarks}`
            : "Desk Settlement Discount",
          amount: existingDisc + recordDiscountShare,
        };
      }

      // Create Audit Transaction Record
      const newTransaction = new Transaction({
        feeRecord: fee._id,
        student: studentId,
        amount: netPayable,
        paymentMethod: normalizedMethod,
        transactionId: sanitizedTxnId, // Sparse unique field
        status: "Success",
        date: new Date(),
        collectedBy: staffId,
        remarks: remarks || `Fee settlement for ${fee.month} ${fee.year}`,
      });

      const savedTxn = await newTransaction.save({ session });
      createdTransactionIds.push(savedTxn._id);

      // Link transaction back to MonthlyFee
      fee.transactions.push(savedTxn._id);
      await fee.save({ session });
    }

    // 6. Commit Transaction Session
    await session.commitTransaction();
    session.endSession();

    req.flash(
      "success",
      `Successfully settled ${feesToSettle.length} fee record(s)! Transactions recorded.`,
    );
    return res.redirect("/accountant?Tab=FeeCounter");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Settle Fees Critical Error:", err);

    // Handle specific duplicate transaction ID error gracefully
    if (err.code === 11000) {
      req.flash(
        "error",
        "Transaction ID / UTR number already exists in system records. Please use a unique reference.",
      );
    } else {
      req.flash(
        "error",
        "Server error occurred while processing fee settlement.",
      );
    }

    return res.redirect("/accountant?Tab=FeeCounter");
  }
};

// View/Print/Download Fee Receipt Controller
module.exports.viewReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.instituition?.school;

    // Fetch transaction with deep population for School, Student, Class, and Fee Record
    const transaction = await Transaction.findById(id)
      .populate({
        path: "student",
        select: "name admissionNumber phone instituition",
        populate: [
          { path: "instituition.school", model: "School" },
          { path: "instituition.class", model: "Class" },
        ],
      })
      .populate("feeRecord")
      .populate("collectedBy", "name designation");

    if (!transaction) {
      req.flash("error", "Transaction receipt not found.");
      return res.redirect("/accountant/dashboard?tab=FeeCounter");
    }

    // Tenant boundary verification
    const txnSchool = transaction.student?.instituition?.school;
    const txnSchoolId = txnSchool?._id
      ? txnSchool._id.toString()
      : txnSchool?.toString();

    if (schoolId && txnSchoolId && txnSchoolId !== schoolId.toString()) {
      req.flash("error", "Unauthorized access to transaction record.");
      return res.redirect("/accountant?tab=FeeCounter");
    }

    res.render("./accountant/receipt.ejs", { transaction, school: txnSchool });
  } catch (err) {
    console.error("Receipt Generation Error:", err);
    req.flash("error", "Failed to generate receipt.");
    res.redirect("/accountant?tab=FeeCounter");
  }
};
// 4. API: Settle Fees
// module.exports.settleFees = async (req, res) => {
//   try {
//     const schoolId = req.user?.instituition?.school;
//     const { studentId, feeIds, discount, method, remarks } = req.body;

//     if (!feeIds || feeIds.length === 0) {
//       return res.json({
//         success: false,
//         message: "No fees selected for settlement.",
//       });
//     }

//     // Fetch the specific fees strictly matching the student and school to prevent manipulation
//     const feesToUpdate = await MonthlyFee.find({
//       _id: { $in: feeIds },
//       student: studentId,
//       school: schoolId,
//       status: { $ne: "Paid" },
//     });

//     if (feesToUpdate.length === 0) {
//       return res.json({
//         success: false,
//         message: "Fees not found or already paid.",
//       });
//     }

//     // Process payments (In production, wrap this in a Mongoose Transaction session)
//     let totalPaid = 0;

//     for (let fee of feesToUpdate) {
//       const payableAmount = fee.amount + (fee.fine || 0);
//       totalPaid += payableAmount;

//       fee.status = "Paid";
//       fee.paymentMethod = method;
//       fee.paymentDate = new Date();
//       fee.transactionRemarks = remarks || "";
//       // Optional: distribute discount logic here if needed across fee heads

//       await fee.save();
//     }

//     res.json({
//       success: true,
//       message: `Payment of ₹${(totalPaid - (discount || 0)).toLocaleString("en-IN")} settled successfully!`,
//     });
//   } catch (error) {
//     console.error("Payment Settlement Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error during payment processing.",
//     });
//   }
// };
