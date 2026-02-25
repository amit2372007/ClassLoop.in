const Schools = require("../model/school/school.js");
const Class = require("../model/school/classes.js");
const Users = require("../model/User.js");
const LoopSpace = require("../model/loopSpace/loopSpace.js");
const FeeStructure = require("../model/school/principle/feeStructure.js");
const MonthlyFee = require("../model/school/principle/StudentMonthlyFee.js");
const QRCode = require("qrcode");
const ImageKit = require("imagekit");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports.renderSchoolDashboard = async (req, res) => {
  try {
    const activeTab = req.query.tab || "Dashboard"; // Default to Dashboard
    const Principle = await Users.findById(req.user._id);

    // 1. Global Data
    const schoolData = await Schools.findOne({ principle: req.user._id });

    // Initialize variables (Default Safe Values)
    let stats = { totalCollected: 0, pendingDues: 0, collectionPercentage: 0 }; // Initialize with 0s
    let defaulters = [];
    let recentPayments = [];
    let allStudents = [];
    let allTeachers = [];
    let allClasses = [];

    // === HELPER: Fee Calculation Logic (Used in both Dashboard & Fees) ===
    const calculateFeeStats = async () => {
      const fees = await MonthlyFee.find({ school: schoolData._id })
        .populate("student", "name profilePic")
        .populate("class", "className section")
        .sort({ updatedAt: -1 });

      let totalCollected = 0;
      let totalTarget = 0;
      let pendingDues = 0;

      fees.forEach((fee) => {
        const feeTotal =
          fee.totalAmount +
          (fee.fine?.amount || 0) -
          (fee.discount?.amount || 0);
        const balance = Math.max(0, feeTotal - (fee.amountPaid || 0));

        totalTarget += feeTotal;
        totalCollected += fee.amountPaid || 0;
        pendingDues += balance;

        fee.calculatedBalance = balance; // Attach for EJS usage
      });

      const collectionPercentage =
        totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0;

      return {
        fees,
        stats: { totalCollected, pendingDues, collectionPercentage },
      };
    };

    // 2. CONDITIONAL DATA FETCHING
    switch (activeTab) {
      case "Dashboard":
        // A. Fetch School Structure
        await schoolData.populate("teachers");
        await schoolData.populate("classes");
        await schoolData.populate({
          path: "classes",
          populate: { path: "students.student", model: "User" },
        });
        allStudents = schoolData.classes.flatMap((c) => c.students);
        allTeachers = schoolData.teachers;
        allClasses = schoolData.classes;

        // B. Fetch Fee Stats (Needed for Dashboard Widgets)
        const dashFeeData = await calculateFeeStats();
        stats = dashFeeData.stats;
        break;

      case "Fees":
        // A. Fetch Full Fee Data
        const feeData = await calculateFeeStats();
        stats = feeData.stats; // Update the stats object
        const allFees = feeData.fees;

        // B. Generate Specific Lists
        defaulters = allFees.filter((f) => f.calculatedBalance > 0).slice(0, 5);
        recentPayments = allFees.filter((f) => f.amountPaid > 0).slice(0, 4);
        break;

      case "Teachers":
        await schoolData.populate("teachers");
        allTeachers = schoolData.teachers;
        break;

      case "Students":
        await schoolData.populate({
          path: "classes",
          populate: { path: "students.student", model: "User" },
        });
        allStudents = schoolData.classes.flatMap((c) => c.students);
        break;

      default:
        break;
    }

    // 3. Render
    res.render("./school/Dashboard.ejs", {
      School: schoolData,
      activeTab: activeTab,
      currUser: req.user,
      Principle,

      // Data will be populated based on the switch case above
      allTeachers,
      allClasses,
      allStudents,
      stats, // Now available in BOTH Dashboard and Fees
      defaulters,
      recentPayments,
      Teachers: allTeachers,
      Students: allStudents,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/home");
  }
};

module.exports.renderCreateClassForm = (req, res) => {
  res.render("./school/createClassForm.ejs");
};

module.exports.createClass = async (req, res) => {
  try {
    const { className, section, session, classTeacherId } = req.body;

    // 1. Backend validation to ensure data exists before hitting the database
    if (!className || !section) {
      req.flash("error", "Class Name and Section are required.");
      return res.redirect("/school?tab=ManageClasses");
    }

    const school = await Schools.findOne({ principle: req.user._id });
    const schoolId = school._id;

    // 2. Teacher Validation (with added return statement)
    let Teacher = null;
    if (classTeacherId) {
      Teacher = await Users.findById(classTeacherId);
      if (!Teacher) {
        req.flash("error", "No such user exist");
        return res.redirect("/school?tab=ManageClasses"); // Critical: return stops execution
      }
    }

    // 3. Create and SAVE the new Class document FIRST
    const newClass = new Class({
      className: className,
      section: section,
      session: session,
      school: schoolId,
      classTeacher: classTeacherId || null,
      students: [],
    });

    // Save the class first. If this fails, the code jumps to catch() and nothing else is saved.
    const savedClass = await newClass.save();

    // 4. Create and save the LoopSpace now that the Class is safely stored
    const newSpace = new LoopSpace({
      name: `${className}-${section} Loop Space`,
      description: `Loop Space for Class ${className}-${section}`,
      class: savedClass._id,
      school: schoolId,
      category: "ClassRoom",
      admin: classTeacherId,
    });
    await newSpace.save();

    // 5. Update Teacher Data
    if (Teacher) {
      Teacher.designation = "classTeacher";
      Teacher.instituition.school = schoolId;
      Teacher.instituition.class = savedClass._id;
      await Teacher.save();
    }

    // 6. Update School Data
    await Schools.findByIdAndUpdate(schoolId, {
      $push: { classes: savedClass._id },
      $addToSet: { teachers: classTeacherId },
    });

    // 7. QR Code Generation Workflow
    try {
      const classId = savedClass._id;
      const joinLink = `https://www.classloop.in/teacher/joinClass/${classId}`;

      const qrBase64Data = await QRCode.toDataURL(joinLink);

      const imageKitResponse = await imagekit.upload({
        file: qrBase64Data,
        fileName: `class_qr_${classId}.png`,
        folder: "/ClassLoop/QRCodes",
      });

      const updatedClass = await Class.findById(classId);
      updatedClass.QRCode = {
        url: imageKitResponse.url,
        fileId: imageKitResponse.fileId,
      };
      await updatedClass.save();

      if (!updatedClass) {
        return res.status(404).json({
          error: "Class not found in the database after QR generation.",
        });
      }

      req.flash(
        "success",
        `Class ${className}-${section} created successfully!`,
      );
      return res.redirect("/school?tab=ManageClasses");
    } catch (qrError) {
      console.error("Error generating QR code:", qrError);
      req.flash("error", "Class created, but failed to generate QR code.");
      return res.redirect("/school?tab=ManageClasses");
    }
  } catch (err) {
    console.error("Class Creation Error:", err);
    req.flash("error", "Failed to create class. Please check your inputs.");
    return res.redirect("/school?tab=ManageClasses");
  }
};

module.exports.renderFeeStructurePage = async (req, res) => {
  try {
    // 1. Find the School
    const school = await Schools.findOne({ principle: req.user._id });

    // 2. Find Classes for this school
    const classes = await Class.find({ school: school._id });

    // 3. Find Existing Fee Structures (Populate classLink to get class name)
    const feeStructures = await FeeStructure.find({
      school: school._id,
    }).populate("classLink");

    res.render("./school/monthlyFeeStructure.ejs", {
      school,
      classes,
      feeStructures, // Passed to EJS
      currUser: req.user,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/home");
  }
};

module.exports.createFeeStructure = async (req, res) => {
  try {
    const { name, classLink, frequency, components, totalAmount } = req.body;

    const school = await Schools.findOne({ principle: req.user._id });

    const newStructure = new FeeStructure({
      name,
      school: school._id,
      classLink,
      frequency,
      components: JSON.parse(components), // Expecting JSON string from frontend
      totalAmount,
    });

    await newStructure.save();
    req.flash("success", "Fee Structure Created Successfully!");
    res.redirect("/school"); // Redirect back to the page
  } catch (err) {
    console.error(err);
    req.flash("error", "Error creating fee structure.");
    res.redirect("/school/feeStructure");
  }
};

module.exports.generateMonthlyFees = async (req, res) => {
  try {
    // You need to pass the month explicitly (e.g., from a dropdown "Generate for November")
    const { structureId, month, year } = req.body;

    // 1. Get the Template
    const structure = await FeeStructure.findById(structureId);

    // 2. Get the Class and populate student details
    const classData = await Class.findById(structure.classLink);

    const school = await Schools.findOne({ principle: req.user._id });

    // 3. Loop correctly through the class.students array
    // Remember: classData.students is [{ student: ObjectId, admissionId: String }, ...]
    for (let i = 0; i < classData.students.length; i++) {
      const studentObj = classData.students[i]; // This is the wrapper object

      const newFee = new MonthlyFee({
        student: studentObj.student,
        admissionNo: studentObj.admissionId,
        class: classData._id,
        school: school._id,
        month: month, // e.g., "November"
        year: year || new Date().getFullYear(),
        feeComponents: structure.components,
        totalAmount: structure.totalAmount,
        status: "Pending",
        dueDate: new Date(year, getMonthIndex(month), 10),
      });

      try {
        await newFee.save();
      } catch (e) {
        if (e.code === 11000)
          req.flash(
            "error",
            `Bill already exists for student ${studentObj.admissionId}`,
          );
        else throw e;
      }
    }

    req.flash("success", `Generated fees for ${month}!`);
    res.redirect("/school/feeStructure");
  } catch (err) {
    console.error(err);
    req.flash("error", "Error generating fees.");
    res.redirect("/school/feeStructure");
  }
};

// Helper for Date Object
function getMonthIndex(monthName) {
  const months = [
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
  ];
  return months.indexOf(monthName);
}
