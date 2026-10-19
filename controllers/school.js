const Schools = require("../model/school/school.js");
const Class = require("../model/school/classes.js");
const Users = require("../model/User.js");
const LoopSpace = require("../model/loopSpace/loopSpace.js");
const Notification = require("../model/notification/notification.js");
const schoolRequest = require("../model/school/principle/schoolReq.js");
const FeeStructure = require("../model/school/principle/feeStructure.js");
const MonthlyFee = require("../model/school/principle/StudentMonthlyFee.js");
const Employee = require("../model/school/principle/employee.js");
const SalaryRecord = require("../model/school/principle/employeeSalaryRec.js");
const DailyStaffAttendance = require("../model/school/principle/staffAttendance.js");
const QRCode = require("qrcode");
const ImageKit = require("imagekit");

const mongoose = require("mongoose");
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

module.exports.renderTeacherProfile = async (req, res) => {
  try {
    const teacherId = req.params.id;

    // 1. Fetch the teacher's base profile data
    const teacher = await Users.findById(teacherId).lean();

    if (!teacher) {
      req.flash("error", "Teacher profile not found!");
      return res.redirect("/school?tab=Teachers");
    }

    // 2. Fetch the corresponding HR Employee document
    const employee = await Employee.findOne({ staffId: teacherId }).lean();

    // 3. Merge Employee data into the teacher object for the EJS view
    if (employee) {
      teacher.basicSalary = employee.basicSalary;
      teacher.employeeId = employee.employeeId;
      teacher.designation = employee.designation;
      teacher.department = employee.department;
      teacher.joiningDate = employee.dateOfJoining;
      teacher.phone = employee.phone || teacher.phone; // Override with HR phone if exists
      teacher.location = employee.address || teacher.location;
      teacher.experience = employee.experienceYears
        ? `${employee.experienceYears} Years Experience`
        : "Fresher";

      // Map schema's bank details to what EJS expects
      if (employee.bankDetails) {
        teacher.bankDetails = {
          bankName: employee.bankDetails.bankName,
          accountHolder: employee.bankDetails.accountHolderName, // mapped from schema
          accountNumber: employee.bankDetails.accountNumber,
          ifscCode: employee.bankDetails.ifscCode,
        };
      }

      // Sync status (Ensures EJS gets a consistent lowercase 'suspended' or 'active')
      teacher.status = employee.status === "Suspended" ? "suspended" : "active";
    }

    // 4. Find if the teacher is a Class Teacher for any class
    const assignedClass = await Class.findOne({ classTeacher: teacherId })
      .select("className section")
      .lean();
    teacher.assignedClass = assignedClass || null;

    // 5. Find all subjects this teacher is teaching across all classes
    const classesTeaching = await Class.find({ "subjects.teacher": teacherId })
      .select("subjects")
      .lean();

    const subjectSet = new Set();
    classesTeaching.forEach((cls) => {
      cls.subjects.forEach((subject) => {
        if (
          subject.teacher &&
          subject.teacher.toString() === teacherId.toString()
        ) {
          subjectSet.add(subject.name);
        }
      });
    });
    teacher.assignedSubjects = Array.from(subjectSet);

    // 6. Fetch Monthly Attendance for the Teacher
    const currentDate = new Date();
    const selectedMonth =
      parseInt(req.query.month) || currentDate.getMonth() + 1; // 1 to 12
    const selectedYear = parseInt(req.query.year) || currentDate.getFullYear();

    // Format target month as 'YYYY-MM' for matching string dates ('YYYY-MM-DD')
    const monthString = String(selectedMonth).padStart(2, "0");
    const datePattern = new RegExp(`^${selectedYear}-${monthString}`);

    // Query daily attendance documents containing this teacher's record for the month
    const attendanceRecords = await DailyStaffAttendance.find({
      "records.staffId": teacherId,
      date: { $regex: datePattern },
    })
      .sort({ date: -1 }) // Most recent first
      .lean();

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let halfDayCount = 0;

    // Extract teacher's specific status for each daily record and compute statistics
    const attendanceLogs = attendanceRecords.map((doc) => {
      const teacherRecord = doc.records.find(
        (rec) => rec.staffId.toString() === teacherId.toString(),
      );
      const status = teacherRecord ? teacherRecord.status : "N/A";

      if (status === "Present") presentCount++;
      else if (status === "Absent") absentCount++;
      else if (status === "Leave") leaveCount++;
      else if (status === "Half-Day") halfDayCount++;

      return {
        date: doc.date,
        status: status,
      };
    });

    const totalWorkingDays = attendanceLogs.length;
    const effectivePresent = presentCount + halfDayCount * 0.5;
    const rate =
      totalWorkingDays > 0
        ? ((effectivePresent / totalWorkingDays) * 100).toFixed(1)
        : "0.0";

    const attendanceStats = {
      totalWorkingDays,
      presentCount,
      absentCount,
      leaveCount,
      halfDayCount,
      rate,
    };

    res.render("./school/renderTeacherProfile.ejs", {
      teacher,
      attendanceStats,
      attendanceLogs,
      selectedMonth,
      selectedYear,
    });
  } catch (error) {
    console.error("Error rendering teacher profile:", error);
    req.flash("error", "Something went wrong while loading the profile.");
    res.redirect("/school?tab=Teachers");
  }
};

module.exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      req.flash("error", "Password must be at least 6 characters long.");
      return res.redirect(`/school/teacher/${id}`);
    }

    const teacher = await Users.findById(id);
    if (!teacher) {
      req.flash("error", "Teacher account not found.");
      return res.redirect("/school?tab=Teachers");
    }

    // Passport-Local-Mongoose setPassword method
    if (typeof teacher.setPassword === "function") {
      await teacher.setPassword(newPassword);
      await teacher.save();
    } else {
      // Direct field assignment if not using passport-local-mongoose plugin
      teacher.password = newPassword;
      await teacher.save();
    }

    req.flash(
      "success",
      `Password successfully updated for ${teacher.name || "teacher"}.`,
    );
    return res.redirect(`/school/teacher/${id}`);
  } catch (error) {
    console.error("Error resetting teacher password:", error);
    req.flash("error", "Failed to reset password. Please try again.");
    return res.redirect(`/school/teacher/${req.params.id || ""}`);
  }
};

module.exports.toggleTeacherStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'suspend' or 'activate'

    const user = await Users.findById(id);
    if (!user) {
      req.flash("error", "Teacher account not found.");
      return res.redirect("/school?tab=Teachers");
    }

    const isSuspending = action === "suspend";

    const booleanVal = user.isSuspended;
    // 1. Update User model (isActive boolean flag)
    user.isSuspended = !booleanVal;
    await user.save();

    // 2. Sync HR Employee record status (if Employee doc exists)
    await Employee.findOneAndUpdate(
      { staffId: id },
      { status: isSuspending ? "Suspended" : "Active" },
    );

    // 3. Set Flash message and Redirect back to profile
    const message = isSuspending
      ? `Teacher account for ${user.name} has been suspended.`
      : `Teacher account for ${user.name} has been reactivated successfully.`;

    req.flash("success", message);
    return res.redirect(`/school/teacher/${id}`);
  } catch (error) {
    console.error("Error toggling teacher status:", error);
    req.flash("error", "Something went wrong while updating teacher status.");
    return res.redirect(`/school/teacher/${req.params.id || ""}`);
  }
};
module.exports.deleteClass = async (req, res) => {
  try {
    const classId = req.params.id;

    // 1. Find the class first to get the associated school ID
    const classToDelete = await Class.findById(classId);

    if (!classToDelete) {
      req.flash("error", "Class not found!");
      return res.redirect("back");
    }

    const schoolId = classToDelete.school;

    // 2. Remove the class ID from the School's 'classes' array
    if (schoolId) {
      await Schools.findByIdAndUpdate(schoolId, {
        $pull: { classes: classId },
      });
    }

    // 3. Delete the class document itself
    await Class.findByIdAndDelete(classId);

    // 4. Send success response and redirect
    req.flash("success", "Class and associated data deleted successfully.");
    res.redirect("/school"); // Or redirect to a specific route like "/school/classes"
  } catch (error) {
    console.error("Error deleting class:", error);
    req.flash("error", "Something went wrong while deleting the class.");
    res.redirect("back");
  }
};

module.exports.saveStaffAttendance = async (req, res) => {
  try {
    const { date, records } = req.body;

    if (!date || !records) {
      req.flash(
        "error",
        "Invalid submission. Missing date or attendance records.",
      );
      return res.redirect("/school?tab=Attendance");
    }

    const school = await Schools.findOne({ principle: req.user._id });
    if (!school) {
      req.flash("error", "Unauthorized: School record not found.");
      return res.redirect("/school?tab=Attendance");
    }

    // 1. Convert form data object into array format
    const formattedRecords = Object.entries(records).map(([staffId, data]) => ({
      staffId: staffId,
      onModel: data.model,
      status: data.status,
    }));

    // 2. Save ONE single daily attendance document
    await DailyStaffAttendance.create({
      school: school._id,
      date: date,
      records: formattedRecords,
      recordedBy: req.user._id,
    });

    req.flash("success", `Complete attendance for ${date} saved successfully.`);
    return res.redirect(`/school?tab=Attendance&date=${date}`);
  } catch (error) {
    console.error("Error saving daily attendance:", error);

    if (error.code === 11000) {
      req.flash(
        "error",
        `Attendance for ${req.body.date} has already been submitted.`,
      );
    } else {
      req.flash("error", "Failed to save attendance.");
    }

    return res.redirect("/school?tab=Attendance");
  }
};
module.exports.renderSchoolDashboard = async (req, res) => {
  try {
    const activeTab = req.query.tab || "Dashboard"; // Default to Dashboard
    const Principle = await Users.findById(req.user._id);

    // 1. Global Data
    const schoolData = await Schools.findOne({
      principle: req.user._id,
    }).populate("teachers");

    // Initialize variables (Default Safe Values)
    let stats = { totalCollected: 0, pendingDues: 0, collectionPercentage: 0 }; // Initialize with 0s
    let defaulters = [];
    let recentPayments = [];
    let allStudents = [];
    let allTeachers = [];
    let allClasses = [];
    let allEmployees = [];
    let availableStaff = [];
    let employeeStats = {
      total: 0,
      it: 0,
      admin: 0,
      security: 0,
      maintenance: 0,
    };

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
          populate: [
            { path: "students.student", model: "User" },
            { path: "classTeacher" }, // <--- Added to populate class teacher details
          ],
        });
        allStudents = schoolData.classes.flatMap((c) => c.students);
        allTeachers = schoolData.teachers;
        allClasses = schoolData.classes;

        // B. Fetch Fee Stats (Needed for Dashboard Widgets)
        const dashFeeData = await calculateFeeStats();
        stats = dashFeeData.stats;
        break;

      case "Attendance":
        // 1. Fetch Teachers for the Academic Tab
        await schoolData.populate({
          path: "teachers",
          select: "name profilePic email role",
        });
        allTeachers = schoolData.teachers || [];

        // 2. Fetch Employees for the Non-Academic Tab
        allEmployees = await Employee.find({
          school: schoolData._id,
          role: { $nin: ["Teacher", "Teaching", "Admin", "Administration"] },
          department: {
            $nin: [
              "Teaching Staff",
              "School Administration",
              "Admin",
              "Academic",
              "Sports/Physical Education",
            ],
          },
        }).select("name role department profilePic employeeId");

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
        // 1. Populate teachers and classes (with classTeacher reference)
        await schoolData.populate("teachers");
        await schoolData.populate({
          path: "classes",
          select: "className section classTeacher",
        });

        allTeachers = schoolData.teachers || [];
        allClasses = schoolData.classes || [];

        // 2. Calculate dynamic teacher stats
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const newHiresCount = allTeachers.filter(
          (teacher) =>
            teacher.createdAt && new Date(teacher.createdAt) >= thirtyDaysAgo,
        ).length;

        // Pass custom teacher stats to res.render if needed
        teacherStats = {
          total: allTeachers.length,
          inactive: allTeachers.filter((t) => !t.isActive).length,
          newHires: newHiresCount,
        };
        break;

      case "Students":
        await schoolData.populate({
          path: "classes",
          populate: { path: "students.student", model: "User" },
        });
        allStudents = schoolData.classes.flatMap((c) => c.students);
        break;

      case "Employees":
        // 1. Fetch all employees belonging to this school
        allEmployees = await Employee.find({
          school: schoolData._id,
        });

        // 2. Fetch available staff using the School model
        const schoolWithStaff = await Schools.findById(schoolData._id).populate(
          "teachers",
        );
        availableStaff = schoolWithStaff.teachers || []; // Extract the array so .forEach() works in EJS

        // 3. Calculate counts for each department for the stats cards
        employeeStats = {
          total: allEmployees.length,
          it: allEmployees.filter((e) => e.department === "IT Support").length,
          admin: allEmployees.filter((e) => e.department === "Administration")
            .length,
          security: allEmployees.filter((e) => e.department === "Security")
            .length,
          maintenance: allEmployees.filter(
            (e) => e.department === "Maintenance",
          ).length,
        };
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

      //Employees
      allEmployees,
      employeeStats,
      availableStaff,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/home");
  }
};

module.exports.renderClassProfile = async (req, res) => {
  try {
    const { id } = req.params; // Expecting route like /school/class/:id

    // 1. Fetch class and deeply populate all references
    const classroom = await Class.findById(id)
      .populate("classTeacher", "name email phone avatar designation") // Class teacher details
      .populate("teachers", "name email phone avatar designation") // Assigned teachers
      .populate({
        path: "subjects.teacher",
        select: "name email avatar",
      })
      .populate({
        path: "students.student",
        select:
          "name email phone avatar rollNo gender feeStatus pendingAmount attendancePercentage parentPhone",
      })
      .populate("school", "name code address");

    if (!classroom) {
      req.flash?.("error", "Classroom not found.");
      return res.redirect("/school/dashboard");
    }

    // 2. Compute Fee Defaulter Stats dynamically
    const feeDefaulters = classroom.students.filter(
      (item) => item.student && item.student.feeStatus === "Pending",
    );

    const totalPendingFee = feeDefaulters.reduce(
      (sum, item) => sum + (item.student.pendingAmount || 0),
      0,
    );

    // 3. Compute Student & Gender Stats
    const totalStudents = classroom.students.length;
    const maxCapacity = classroom.capacity || 40; // Default capacity to 40 if not set in schema

    const genderStats = classroom.students.reduce(
      (acc, item) => {
        const gender = item.student?.gender?.toLowerCase();
        if (gender === "male") acc.male++;
        else if (gender === "female") acc.female++;
        else acc.other++;
        return acc;
      },
      { male: 0, female: 0, other: 0 },
    );

    // 4. Compute Attendance Summary (Placeholder / Derived metric)
    const averageAttendance =
      totalStudents > 0
        ? Math.round(
            classroom.students.reduce(
              (acc, item) => acc + (item.student?.attendancePercentage || 85),
              0,
            ) / totalStudents,
          )
        : 0;

    // 5. Render EJS view with all calculated data
    res.render("school/classProfileDashboard", {
      classroom,
      stats: {
        totalStudents,
        totalFeeDefaulters: feeDefaulters.length,
        totalPendingFee,
        averageAttendance,
        genderStats,
      },
      feeDefaultersList: feeDefaulters,
    });
  } catch (error) {
    console.error("Error rendering class profile:", error);
    req.flash?.("error", "Failed to load classroom profile.");
    res
      .status(500)
      .render("error", { message: "Server error loading classroom data." });
  }
};

module.exports.createClass = async (req, res) => {
  try {
    const { className, section, session, classTeacher } = req.body;

    // 1. Extract school ID safely
    const schoolId = req.user?.instituition?.school || req.user?.school;
    if (!schoolId) {
      req.flash("error", "School context does not exist.");
      return res.redirect("/school");
    }

    // 2. Validate required fields & ObjectId format
    if (
      !className ||
      !section ||
      !session ||
      !classTeacher ||
      !mongoose.Types.ObjectId.isValid(classTeacher)
    ) {
      req.flash(
        "error",
        "Please select a valid faculty member and fill all required fields.",
      );
      return res.redirect("/school");
    }

    // 3. Create new Class document
    const newClass = new Class({
      className: String(className).trim(),
      section: String(section).trim(),
      session: String(session).trim(),
      school: schoolId,
      classTeacher: classTeacher, // Primary Class Teacher (User ObjectId)
      teachers: [classTeacher], // Add teacher to class array
    });

    // 4. Save to MongoDB
    await newClass.save();

    // 5. Update School document using $addToSet (prevents duplicates)
    await Schools.findByIdAndUpdate(
      schoolId,
      {
        $addToSet: {
          classes: newClass._id,
          teachers: classTeacher,
        },
      },
      { new: true },
    );

    req.flash("success", `Class ${className}-${section} created successfully!`);
    return res.redirect("/school");
  } catch (error) {
    console.error("Error creating class:", error);
    req.flash("error", "Something went wrong while creating the class.");
    return res.redirect("/school");
  }
};

/**
 * Assign or Update Class Teacher for an existing Class
 */
module.exports.assignClassTeacher = async (req, res) => {
  try {
    const { classId, teacherId } = req.body;

    if (
      !classId ||
      !teacherId ||
      !mongoose.Types.ObjectId.isValid(classId) ||
      !mongoose.Types.ObjectId.isValid(teacherId)
    ) {
      req.flash("error", "Invalid Class or Teacher selection.");
      return res.redirect("/school");
    }

    // Update Class document
    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      {
        $set: { classTeacher: teacherId },
        $addToSet: { teachers: teacherId },
      },
      { new: true },
    );

    if (!updatedClass) {
      req.flash("error", "Class not found.");
      return res.redirect("/school");
    }

    // Ensure teacher is in the school record
    if (updatedClass.school) {
      await Schools.findByIdAndUpdate(updatedClass.school, {
        $addToSet: { teachers: teacherId },
      });
    }

    req.flash("success", "Class teacher updated successfully!");
    return res.redirect("/school");
  } catch (error) {
    console.error("Error assigning teacher:", error);
    req.flash("error", "Something went wrong while assigning teacher.");
    return res.redirect("/school");
  }
};

module.exports.addTeacher = async (req, res) => {
  try {
    const { name, phone, designation, password, employeeId } = req.body;

    // 1. Basic Validation
    if (!name || !phone || !designation || !password) {
      req.flash("error", "All required fields must be filled.");
      return res.redirect("/school?tab=Teachers");
    }

    // 2. Generate the exact Username (Name without spaces + Phone)
    // E.g., "Amit Kumar" + "983903244" -> "amitkumar983903244"
    const sanitizedName = name.replace(/\s+/g, "").toLowerCase();
    const generatedUsername = `${sanitizedName}${phone}`;

    // 3. Ensure the Principal's account is properly linked to a school
    const schoolId = req.user?.instituition?.school;
    if (!schoolId) {
      req.flash(
        "error",
        "Action Denied: Your principal profile is not linked to a school.",
      );
      return res.redirect("/school?tab=Teachers");
    }

    // 4. Instantiate the New Teacher Object
    const newTeacher = new Users({
      name: name.trim(),
      phone: phone,
      username: generatedUsername, // Passport-local-mongoose uses this field
      designation: designation,
      employeeId: employeeId ? employeeId.trim() : "",
      instituition: {
        school: schoolId,
        // Class will be null initially; can be assigned later
      },
      isVerified: true, // Automatically verified since the Principal is creating it
      isActive: true, // Ready to log into the system immediately
    });

    // 5. Register User using Passport-Local-Mongoose (Handles hashing the TempPassword)
    const registeredTeacher = await Users.register(newTeacher, password);

    // Optional: If your School model has a 'teachers' array, uncomment the line below to push the ID
    await Schools.findByIdAndUpdate(schoolId, {
      $push: { teachers: registeredTeacher._id },
    });

    // 6. Success Response
    req.flash(
      "success",
      `${name} added successfully! Their login username is: ${generatedUsername}`,
    );

    // Redirect back to the Principal's Teacher Directory
    res.redirect("/school?tab=Teachers");
  } catch (err) {
    console.error("Error adding teacher:", err);

    // --- ERROR HANDLING SYSTEM ---

    // 1. Handle Mongoose Unique Index Errors (e.g., Phone number already exists)
    if (err.name === "MongoServerError" && err.code === 11000) {
      const duplicateField = Object.keys(err.keyValue)[0];
      if (duplicateField === "phone") {
        req.flash(
          "error",
          "A user with this phone number is already registered.",
        );
      } else {
        req.flash("error", `${duplicateField} already exists in the system.`);
      }
    }
    // 2. Handle Passport-Local-Mongoose Specific Errors (e.g., Username conflict)
    else if (err.name === "UserExistsError") {
      req.flash("error", "A user with this generated username already exists.");
    }
    // 3. Fallback for validation or generic server errors
    else {
      req.flash(
        "error",
        "An unexpected error occurred while adding the teacher.",
      );
    }

    // Redirect back to the form with the error flash message
    res.redirect("/school?tab=Teachers");
  }
};

module.exports.renderQRCode = async (req, res) => {
  try {
    let school = await Schools.findOne({ principle: req.user._id });

    if (!school) {
      req.flash("error", "School data not found.");
      return res.redirect("/school");
    }

    if (!school.QRCode || !school.QRCode.url) {
      req.flash("error", "QR Code has not been generated for this school yet.");
      return res.redirect("/school");
    }

    let principleId = school.principle._id;
    let principle = await Users.findById(principleId).populate("profilePic");

    const joinLink = `https://www.classloop.in/school/joinSchool/${school._id}`;

    res.render("./school/QRCode.ejs", { school, joinLink, principle });
  } catch (err) {
    console.error("QR Render Error:", err);
    req.flash("error", "Failed to load QR Code page");
    res.redirect("/school");
  }
};

module.exports.addStaffRequest = async (req, res) => {
  try {
    // 1. Extract the exact properties from the objects
    // (Assuming your route is something like /request/:classId)
    const { schoolId } = req.params;
    const school = await Schools.findById(schoolId);
    if (!school) {
      req.flash("error", "No School Found !");
      res.redirect("/home");
    }
    // (Assuming your frontend form sends an input named "studentId")
    const staffId = req.user._id;

    const newSchoolRequest = new schoolRequest({
      receiver: schoolId,
      sender: staffId,
    });

    // 2. Add 'await' to ensure the document actually saves to MongoDB
    await newSchoolRequest.save();

    req.flash("success", `Staff request sent to ${school.name} successfully!`);
    return res.redirect("/home");
  } catch (error) {
    console.error("Add Student Request Error:", error);
    req.flash("error", "Something went wrong.");
    return res.redirect("/home");
  }
};

module.exports.renderTeacherReq = async (req, res) => {
  try {
    // 1. Get the Principal's school (Use findOne to get an Object, not an Array)
    const school = await Schools.findOne({ principle: req.user._id });

    if (!school) {
      req.flash("error", "School not found.");
      return res.redirect("/school");
    }

    // 2. Fetch all pending requests for this school
    // We .populate("sender") so we can access the applicant's name, email, and profile pic
    const staffRequests = await schoolRequest
      .find({
        receiver: school._id,
        status: "pending", // Assuming you only want to see actionable requests
      })
      .populate("sender")
      .sort({ createdAt: -1 });

    res.render("./school/StaffReq.ejs", {
      school,
      requests: staffRequests,
      currUser: req.user,
    });
  } catch (err) {
    console.error("Error loading teacher requests:", err);
    req.flash("error", "Failed to load requests.");
    res.redirect("/school");
  }
};

module.exports.acceptRequest = async (req, res) => {
  try {
    const requestId = req.params.id;

    console.log(requestId);
    const schoolReq = await schoolRequest.findById(requestId);
    console.log(schoolReq);
    if (!schoolReq) {
      req.flash("error", "Request not found.");
      return res.redirect("/school/teacher-requests");
    }

    const staff = await Users.findById(schoolReq.sender);
    const school = await Schools.findOne({ principle: req.user._id });
    console.log(staff, school);
    if (!staff || !school) {
      req.flash("error", "Data missing. Cannot approve request.");
      return res.redirect("/school/teacher-requests");
    }

    schoolReq.status = "accepted";
    await schoolReq.save();

    if (!staff.instituition) staff.instituition = {};
    staff.instituition.school = school._id;
    staff.designation = "faculty";
    await staff.save();

    // C. Add the Teacher to the School's Faculty Array
    // We check if they are already in the array to prevent duplicates
    if (!school.teachers) school.teachers = [];
    if (!school.teachers.includes(staff._id)) {
      school.teachers.push(staff._id);
      await school.save();
    }

    // D. Send a Success Notification to the Teacher
    const newNotif = new Notification({
      sender: school._id,
      receiver: staff._id,
      type: "REQUEST_APPROVED",
      message: `Welcome to ${school.name}! Your joining request has been officially approved by the ${req.user.name}.`,
      isRead: false,
    });
    await newNotif.save();

    // --- FINISH ---
    req.flash(
      "success",
      `${staff.name} has been successfully added to your faculty!`,
    );
    return res.redirect("/school/teacher-requests");
  } catch (err) {
    console.error("Accept Teacher Request Error:", err);
    req.flash("error", "An error occurred while approving the teacher.");
    return res.redirect("/school/teacher-requests");
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
      return res.redirect("/school");
    }

    const school = await Schools.findOne({ principle: req.user._id });
    const schoolId = school._id;

    // 2. Teacher Validation (with added return statement)
    let Teacher = null;
    if (classTeacherId) {
      Teacher = await Users.findById(classTeacherId);
      if (!Teacher) {
        req.flash("error", "No such user exist");
        return res.redirect("/school"); // Critical: return stops execution
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
      return res.redirect("/school");
    } catch (qrError) {
      console.error("Error generating QR code:", qrError);
      req.flash("error", "Class created, but failed to generate QR code.");
      return res.redirect("/school");
    }
  } catch (err) {
    console.error("Class Creation Error:", err);
    req.flash("error", "Failed to create class. Please check your inputs.");
    return res.redirect("/school");
  }
};

module.exports.addEmployee = async (req, res) => {
  try {
    // 1. Destructure fields from body
    const {
      staffId,
      name,
      phone,
      address,
      employeeId,
      designation,
      department,
      dateOfJoining,
      basicSalary,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      aadharNumber,
      panNumber,
    } = req.body;

    // 2. Identify the school by logged-in Principal
    const school = await Schools.findOne({ principle: req.user._id });
    if (!school) {
      req.flash("error", "Unauthorized: School record not found.");
      return res.redirect("/school?tab=Employees");
    }

    // Clean staffId: assign value only if non-empty string, else undefined
    const validStaffId = staffId && staffId.trim() !== "" ? staffId : undefined;

    // 3. Create the Employee document
    const newEmployee = new Employee({
      school: school._id,
      staffId: validStaffId,
      name,
      phone,
      address,
      employeeId,
      designation,
      department,
      dateOfJoining,
      basicSalary,
      bankDetails: {
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
      },
      documents: {
        aadharNumber,
        panNumber,
      },
      qualifications: req.body.qualifications
        ? req.body.qualifications.split(",")
        : [],
      experienceYears: req.body.experienceYears || 0,
    });

    school.Employee.push(newEmployee);
    await newEmployee.save();
    await school.save();

    req.flash(
      "success",
      `Successfully registered ${name} as Employee in ${school.name}.`,
    );
    return res.redirect("/school?tab=Employees");
  } catch (err) {
    console.error("Employee Registration Error:", err);

    if (err.code === 11000) {
      req.flash("error", "The Employee ID already exists in the system.");
    } else {
      req.flash(
        "error",
        "Failed to register employee. Check your data and try again.",
      );
    }

    return res.redirect("/school?tab=Employees");
  }
};

module.exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Verify the principal and get their school
    const school = await Schools.findOne({ principle: req.user._id });
    if (!school) {
      req.flash("error", "Unauthorized: School record not found.");
      return res.redirect("/school?tab=Employees");
    }

    // 2. Find and delete the employee FIRST
    const deletedEmployee = await Employee.findOneAndDelete({
      _id: id,
      school: school._id,
    });

    // 3. Handle case where employee doesn't exist
    if (!deletedEmployee) {
      req.flash(
        "error",
        "Employee not found or you do not have permission to delete them.",
      );
      return res.redirect("/school?tab=Employees");
    }

    if (school.Employee.includes(id)) {
      school.Employee.pull(id);
      await school.save();
    }

    // 5. Success redirect
    req.flash(
      "success",
      `Successfully removed ${deletedEmployee.name} from the system.`,
    );
    return res.redirect("/school?tab=Employees");
  } catch (error) {
    console.error("Delete Employee Error:", error);
    req.flash(
      "error",
      "An error occurred while trying to delete the employee.",
    );
    return res.redirect("/school?tab=Employees");
  }
};

module.exports.editEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Destructure all flat fields submitted by the HTML form
    const {
      name,
      phone,
      address,
      employeeId,
      designation,
      department,
      dateOfJoining,
      status,
      basicSalary,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      qualifications,
      experienceYears,
      aadharNumber,
      panNumber,
    } = req.body;

    // 1. Verify the principal and get their school
    const school = await Schools.findOne({ principle: req.user._id });
    if (!school) {
      req.flash("error", "Unauthorized: School record not found.");
      return res.redirect("/school?tab=Employees");
    }

    // 2. Structure the data to match your nested Mongoose schema
    const updateData = {
      name,
      phone,
      address,
      employeeId,
      designation,
      department,
      dateOfJoining,
      status,
      basicSalary,
      experienceYears,
      // Convert comma-separated string back into an array
      qualifications: qualifications
        ? qualifications
            .split(",")
            .map((q) => q.trim())
            .filter((q) => q)
        : [],
      // Re-nest bank details
      bankDetails: {
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
      },
      // Re-nest documents
      documents: {
        aadharNumber,
        panNumber,
      },
    };

    // 3. Find and update the employee
    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: id, school: school._id },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    // 4. Handle case where employee doesn't exist
    if (!updatedEmployee) {
      req.flash(
        "error",
        "Employee not found or you do not have permission to update them.",
      );
      return res.redirect("/school?tab=Employees");
    }

    // 5. Success redirect
    req.flash(
      "success",
      `Successfully updated ${updatedEmployee.name} in the system.`,
    );
    return res.redirect("/school?tab=Employees");
  } catch (error) {
    console.error("Edit Employee Error:", error);
    req.flash(
      "error",
      "An error occurred while trying to update the employee.",
    );
    return res.redirect("/school?tab=Employees");
  }
};

module.exports.generateMonthlyPayroll = async (req, res) => {
  try {
    // 1. Extract the selected month and year from the form
    const { month, year } = req.body;

    // 2. Authenticate the Principal and find their associated school
    const school = await Schools.findOne({ principle: req.user._id });
    if (!school) {
      req.flash("error", "Unauthorized: School record not found.");
      return res.redirect("/school?tab=Employees");
    }

    const activeEmployees = await Employee.find({
      school: school._id,
      status: "Active",
    });

    if (activeEmployees.length === 0) {
      req.flash("error", "No active employees found to generate payroll.");
      return res.redirect("/school?tab=Employees");
    }

    // 4. Counters to track our progress
    let generatedCount = 0;
    let skippedCount = 0;

    // 5. Loop through active employees and generate their salary records
    for (let emp of activeEmployees) {
      const newSalary = new SalaryRecord({
        employee: emp._id,
        school: school._id,
        month: month,
        year: year || new Date().getFullYear(),
        baseAmount: emp.basicSalary,
        netSalary: emp.basicSalary, // Net starts equal to base until deductions/bonuses are added
        paymentStatus: "Pending",
      });

      try {
        await newSalary.save();
        generatedCount++; // Success!
      } catch (e) {
        // Error code 11000 is MongoDB's duplicate key error.
        // If your schema has the unique compound index { employee: 1, month: 1, year: 1 },
        // this safely catches employees who already have a bill for this month.
        if (e.code === 11000) {
          skippedCount++;
        } else {
          throw e; // Throw unexpected errors to the main catch block
        }
      }
    }

    // 6. Provide a detailed success message to the Principal
    if (skippedCount > 0) {
      req.flash(
        "success",
        `Generated ${generatedCount} new salary records for ${month} ${year}. Skipped ${skippedCount} that were already generated.`,
      );
    } else {
      req.flash(
        "success",
        `Successfully generated payroll for all ${generatedCount} active employees for ${month} ${year}.`,
      );
    }

    return res.redirect("/school?tab=Employees");
  } catch (err) {
    console.error("Payroll Generation Error:", err);
    req.flash(
      "error",
      "An error occurred while generating the monthly payroll.",
    );
    return res.redirect("/school?tab=Employees");
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

const getMonthIndex = (monthString) => {
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
  return months.indexOf(monthString);
};

// 1. Create Fee Structure
module.exports.createFeeStructure = async (req, res) => {
  try {
    const { name, classLink, frequency, components } = req.body;

    const school = await Schools.findOne({ principle: req.user._id });
    if (!school) {
      req.flash("error", "School record not found.");
      return res.redirect("/school/feeStructure");
    }

    const parsedComponents =
      typeof components === "string" ? JSON.parse(components) : components;

    // Server-side calculation of total to prevent client manipulation
    const calculatedTotal = parsedComponents.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

    const newStructure = new FeeStructure({
      name,
      school: school._id,
      classLink,
      frequency: frequency || "Monthly",
      components: parsedComponents,
      totalAmount: Math.round(calculatedTotal * 100) / 100,
    });

    await newStructure.save();
    req.flash("success", "Fee Structure Created Successfully!");
    return res.redirect("/school/feeStructure");
  } catch (err) {
    console.error("Create Fee Structure Error:", err);
    req.flash("error", "Error creating fee structure.");
    return res.redirect("/school/feeStructure");
  }
};

// 2. Update Fee Structure
module.exports.updateFeeStructure = async (req, res) => {
  try {
    const { structureId, name, classLink, frequency, components } = req.body;

    const parsedComponents =
      typeof components === "string" ? JSON.parse(components) : components;

    // Server-side calculation of total
    const calculatedTotal = parsedComponents.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

    await FeeStructure.findByIdAndUpdate(
      structureId,
      {
        name,
        classLink,
        frequency,
        components: parsedComponents,
        totalAmount: Math.round(calculatedTotal * 100) / 100,
      },
      { new: true, runValidators: true },
    );

    req.flash("success", "Fee Structure Updated Successfully!");
    return res.redirect("/school/feeStructure");
  } catch (err) {
    console.error("Update Fee Structure Error:", err);
    req.flash("error", "Error updating fee structure.");
    return res.redirect("/school/feeStructure");
  }
};

// Delete Fee Structure
module.exports.deleteFeeStructure = async (req, res) => {
  try {
    const { structureId } = req.body;

    await FeeStructure.findByIdAndDelete(structureId);

    req.flash("success", "Fee Structure Deleted Successfully!");
    res.redirect("/school/feeStructure");
  } catch (err) {
    console.error(err);
    req.flash("error", "Error deleting fee structure.");
    res.redirect("/school/feeStructure");
  }
};

// 4. Bulk Monthly Fee Generation (Optimized with insertMany & billingDate)
module.exports.generateMonthlyFees = async (req, res) => {
  try {
    const { structureId, month, year } = req.body;

    const [structure, school] = await Promise.all([
      FeeStructure.findById(structureId),
      Schools.findOne({ principle: req.user._id }),
    ]);

    if (!structure) {
      req.flash("error", "Fee structure not found.");
      return res.redirect("/school/feeStructure");
    }

    const classData = await Class.findById(structure.classLink);
    if (!classData || !classData.students || classData.students.length === 0) {
      req.flash("error", "Class not found or has no active students.");
      return res.redirect("/school/feeStructure");
    }

    const billingYear = Number(year) || new Date().getFullYear();
    const monthIdx = getMonthIndex(month);

    if (monthIdx === -1) {
      req.flash("error", "Invalid month provided.");
      return res.redirect("/school/feeStructure");
    }

    // Create standard billingDate (1st of month) and dueDate (10th of month)
    const billingDate = new Date(billingYear, monthIdx, 1);
    const dueDate = new Date(billingYear, monthIdx, 10);

    const feesToInsert = classData.students.map((studentObj) => {
      const studentId = studentObj.student || studentObj._id || studentObj;
      const admissionNo =
        studentObj.admissionId || studentObj.admissionNo || "N/A";

      return {
        student: studentId,
        admissionNo: admissionNo,
        class: classData._id,
        school: school._id,
        month: month,
        year: billingYear,
        billingDate: billingDate,
        dueDate: dueDate,
        feeComponents: structure.components,
        totalAmount: structure.totalAmount,
        status: "Pending",
        createdBy: req.user._id,
      };
    });

    let generatedCount = 0;
    let skippedCount = 0;

    try {
      // Bulk insert ignoring duplicate index errors (code 11000)
      const result = await MonthlyFee.insertMany(feesToInsert, {
        ordered: false,
      });
      generatedCount = result.length;
    } catch (error) {
      if (
        error.code === 11000 ||
        (error.writeErrors && error.writeErrors.some((e) => e.code === 11000))
      ) {
        generatedCount = error.insertedDocs ? error.insertedDocs.length : 0;
        skippedCount = feesToInsert.length - generatedCount;
      } else {
        throw error;
      }
    }

    if (skippedCount > 0) {
      req.flash(
        "success",
        `Generated ${generatedCount} new bills. Skipped ${skippedCount} students who already have bills for ${month} ${billingYear}.`,
      );
    } else {
      req.flash(
        "success",
        `Successfully generated all ${generatedCount} fees for ${month} ${billingYear}!`,
      );
    }

    return res.redirect("/school/feeStructure");
  } catch (err) {
    console.error("Fee Generation Error:", err);
    req.flash("error", "Error generating monthly fees.");
    return res.redirect("/school/feeStructure");
  }
};

module.exports.sendFeeReminder = async (req, res) => {
  try {
    // 1. Extract the data sent from the hidden inputs in the EJS form
    const { studentId, month, amount } = req.body;

    if (!studentId) {
      req.flash("error", "Invalid student record. Cannot send reminder.");
      return res.redirect("back");
    }

    // 2. Find the school to get the exact School Name
    const school = await Schools.findOne({ principle: req.user._id });

    if (!school) {
      req.flash("error", "School data not found.");
      return res.redirect("back");
    }

    // 3. Construct the personalized message
    const reminderMessage = `Fee Reminder from ${school.name}: Your school fee for ${month} (₹${amount}) is currently pending. Please clear your dues.`;

    // 4. Create the new Notification using the "PENDING_FEE" type we designed
    const newReminder = new Notification({
      sender: school._id,
      receiver: studentId,
      type: "PENDING_FEE",
      message: reminderMessage,
      isRead: false,
    });

    // 5. Save to database
    await newReminder.save();

    // 6. Redirect back to the same page with a success flash message
    req.flash("success", "Fee reminder sent successfully.");
    return res.redirect("/school?tab=Fees");
  } catch (error) {
    console.error("Send Fee Reminder Error:", error);
    req.flash("error", "An error occurred while trying to send the reminder.");
    return res.redirect("/school?tab=Fees");
  }
};
