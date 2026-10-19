const Notification = require("../model/notification/notification.js");
const Users = require("../model/User.js");
const Schools = require("../model/school/school.js");
const Class = require("../model/school/classes.js");
const Notice = require("../model/school/notice.js");
const Attendance = require("../model/school/attendance.js");
const Assignment = require("../model/school/assignment.js");
const Form = require("../model/school/form.js");
const Resource = require("../model/school/resourse.js");
const FormResponse = require("../model/school/formResponse.js");
const LoopSpace = require("../model/loopSpace/loopSpace.js");
const Exam = require("../model/school/exam.js");
const Application = require("../model/school/application.js");
const Timetable = require("../model/school/timetable.js");
const classRequest = require("../model/school/classRequest.js");
const ImageKit = require("imagekit");

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const multer = require("multer");
const assignment = require("../model/school/assignment.js");
const School = require("../model/school/school.js");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to match your frontend Username generator
const generateUsername = (name, phone) => {
  const currentYear = new Date().getFullYear();
  const cleanName = (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const cleanPhone = (phone || "").trim().replace(/\D/g, "");
  const phoneSuffix =
    cleanPhone.length >= 5 ? cleanPhone.slice(-5) : cleanPhone;
  return `${currentYear}${cleanName}${phoneSuffix}`;
};

exports.updateTimetableSlot = async (req, res) => {
  try {
    const classId = req.params.classId;
    const {
      day,
      slotType,
      periodNumber,
      roomNo,
      subject,
      teacherId,
      startTime,
      endTime,
    } = req.body;

    // 1. Find the existing timetable for this class
    let timetable = await Timetable.findOne({ class: classId });

    // If no timetable exists for this class yet, initialize a new one
    if (!timetable) {
      timetable = new Timetable({
        class: classId,
        session: "2025-26", // Optional: dynamically grab from req if needed
        weeklySchedule: [],
      });
    }

    // 2. Find the target day in the weekly schedule
    let daySchedule = timetable.weeklySchedule.find((d) => d.day === day);

    // If the day hasn't been added to the schedule yet, create it
    if (!daySchedule) {
      timetable.weeklySchedule.push({ day: day, slots: [] });
      daySchedule = timetable.weeklySchedule.find((d) => d.day === day);
    }

    // 3. Check if this specific period number already exists on this day
    const existingSlotIndex = daySchedule.slots.findIndex(
      (slot) => slot.periodNumber === Number(periodNumber),
    );

    // 4. Construct the slot data based on the form input
    const slotData = {
      periodNumber: Number(periodNumber),
      slotType: slotType,
      roomNo: roomNo ? roomNo.trim() : "Classroom",
      startTime: startTime,
      endTime: endTime,
      // Only attach subject and teacher if it's an academic slot (not recess)
      subject:
        slotType === "lecture" || slotType === "lab" ? subject : undefined,
      teacher:
        teacherId && (slotType === "lecture" || slotType === "lab")
          ? teacherId
          : undefined,
    };

    // 5. Update the existing slot, or push the new slot
    if (existingSlotIndex > -1) {
      daySchedule.slots[existingSlotIndex] = slotData;
    } else {
      daySchedule.slots.push(slotData);
      // Optional: Sort slots by period number so they remain in order
      daySchedule.slots.sort((a, b) => a.periodNumber - b.periodNumber);
    }

    // 6. Save changes to the database
    await timetable.save();

    // 7. Notify success and redirect back to the timetable page
    req.flash(
      "success",
      `${day} Period ${periodNumber} has been successfully updated.`,
    );
    res.redirect("/teacher?tab=Timetable"); // Or redirect explicitly: res.redirect(`/teacher/class/timetable/${classId}`)
  } catch (error) {
    console.error("Error updating timetable slot:", error);
    req.flash("error", "Failed to update timetable slot. Please try again.");
    res.redirect("/teacher?tab=Timetable");
  }
};
exports.toggleStudentSuspension = async (req, res) => {
  try {
    const studentId = req.params.id;

    // 1. Find the student in the database
    const student = await Users.findById(studentId);
    if (!student) {
      req.flash("error", "Student record not found.");
      return res.redirect(`/teacher/studentProfile/${studentId}`);
    }

    // 2. Toggle the suspension status
    student.isSuspended = !student.isSuspended;
    await student.save();

    // 3. Set feedback notification and redirect
    const statusMessage = student.isSuspended ? "suspended" : "unsuspended";
    req.flash(
      "success",
      `${student.name} has been successfully ${statusMessage}.`,
    );

    res.redirect(`/teacher/studentProfile/${studentId}`);
  } catch (error) {
    console.error("Error updating student suspension status:", error);
    req.flash("error", "Failed to update suspension status. Please try again.");
    res.redirect(`/teacher/studentProfile/${studentId}`);
  }
};

exports.resetStudentPassword = async (req, res) => {
  try {
    const studentId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim() === "") {
      req.flash("error", "Password field cannot be empty.");
      return res.redirect(`/teacher/studentProfile/${studentId}`);
    }

    const student = await Users.findById(studentId);
    if (!student) {
      req.flash("error", "Student record not found.");
      return res.redirect(`/teacher/studentProfile/${studentId}`);
    }

    await student.setPassword(newPassword);
    await student.save();

    req.flash("success", `Password successfully reset for ${student.name}.`);
    res.redirect(`/teacher/studentProfile/${studentId}`);
  } catch (error) {
    console.error("Error resetting student password:", error);
    req.flash("error", "Failed to reset password. Please try again.");
    res.redirect(`/teacher/studentProfile/${studentId}`);
  }
};

exports.updateStudentProfile = async (req, res) => {
  try {
    const studentId = req.params.id;
    const {
      name,
      phone,
      admissionNumber,
      location,
      profilePicUrl,
      isVerified,
    } = req.body;

    const schoolId = req.user?.instituition?.school;
    if (!schoolId) {
      req.flash("error", "Teacher School ID not found!");
      return res.redirect(`/teacher/studentProfile/${studentId}`);
    }

    const parsedAdmissionNo = admissionNumber ? Number(admissionNumber) : null;

    // Check if ANOTHER student in the same school already has this admission number
    if (parsedAdmissionNo) {
      const existingStudent = await Users.findOne({
        "instituition.school": schoolId,
        admissionNumber: parsedAdmissionNo,
        _id: { $ne: studentId }, // Exclude current student from the check
      });

      if (existingStudent) {
        req.flash(
          "error",
          `A student with Admission Number ${admissionNumber} already exists in this school!`,
        );
        return res.redirect(`/teacher/studentProfile/${studentId}`);
      }
    }
    // 1. Process form data
    const updateData = {
      name: name.trim(),
      phone: phone.trim(),
      admissionNumber: admissionNumber ? Number(admissionNumber) : null,
      location: location ? location.trim() : "",
      // If checkbox is checked, req.body.isVerified equals 'true'. If unchecked, it's undefined.
      isVerified: isVerified === "true",
    };

    // 2. Handle nested profilePic object
    if (profilePicUrl && profilePicUrl.trim() !== "") {
      updateData.profilePic = { url: profilePicUrl.trim() };
    }

    // 3. Update the database
    const updatedStudent = await Users.findByIdAndUpdate(
      studentId,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!updatedStudent) {
      // Assuming you are using connect-flash for UI notifications
      req.flash("error", "Student not found.");
      return res.redirect(`/teacher/studentProfile/${studentId}`);
    }

    // 4. Redirect on success
    req.flash("success", `${updatedStudent.name}'s profile has been updated.`);
    res.redirect(`/teacher/studentProfile/${studentId}`);
  } catch (error) {
    req.flash("error", "Failed to update student profile. Please try again.");
    res.redirect(`/teacher/studentProfile/${studentId}`);
  }
};

module.exports.renderStudentProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.instituition?.school;
    const currClass = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });
    const classId = currClass._id;

    // 1. Fetch the student
    const student = await Users.findById(id);
    if (!student) {
      req.flash("error", "Student Does Not Exist in ClassLoop");
      return res.redirect("/teacher?tab=Students");
    }

    // 2. Define the date range for the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const classAssignments = await Assignment.find({
      school: schoolId,
      class: classId,
    }).sort({ dueDate: 1 }); // Sort by upcoming due dates

    // 2. Filter assignments where THIS student is NOT in the submissions array
    const pendingAssignments = classAssignments.filter((assignment) => {
      return !assignment.submissions.some(
        (sub) => sub.student && sub.student.toString() === id.toString(),
      );
    });

    // 3. Metrics calculation
    const totalAssignment = classAssignments.length;
    const pendingCount = pendingAssignments.length;
    const totalSubmittedAssignments = totalAssignment - pendingCount;

    // 3. Fetch attendance documents for this student within the current month
    // MongoDB automatically searches inside the 'records' array for the matching student ObjectId
    const monthlyAttendanceDocs = await Attendance.find({
      school: schoolId,
      "records.student": id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // 4. Process the data for the EJS Calendar (1=Present, 2=Absent, 3=Leave)
    const attendanceMap = {};
    let presentCount = 0;
    const totalWorkingDays = monthlyAttendanceDocs.length;

    monthlyAttendanceDocs.forEach((doc) => {
      // Get the day of the month (1-31)
      const day = new Date(doc.date).getDate();

      // Find this specific student's subdocument in the records array
      const studentRecord = doc.records.find(
        (r) => r.student.toString() === id.toString(),
      );

      if (studentRecord) {
        // Map string statuses to EJS integer statuses
        if (
          studentRecord.status === "Present" ||
          studentRecord.status === "Late"
        ) {
          attendanceMap[day] = 1;
          presentCount++;
        } else if (studentRecord.status === "Absent") {
          attendanceMap[day] = 2;
        } else if (studentRecord.status === "Leave") {
          attendanceMap[day] = 3;
        }
      }
    });

    // 5. Calculate monthly percentage
    const attendancePercentage =
      totalWorkingDays > 0
        ? Math.round((presentCount / totalWorkingDays) * 100)
        : 0;

    //Recent Exams and scores
    // 1. Fetch exams for this class where the student has a result, sorted newest to oldest
    const rawExams = await Exam.find({
      class: classId,
      teacher: req.user._id,
      "results.student": id,
    }).sort({ examDate: -1 });

    // 2. Map the data to send only this specific student's marks to EJS
    const studentExams = rawExams.map((exam) => {
      const studentResult = exam.results.find(
        (r) => r.student.toString() === id.toString(),
      );

      // Calculate percentage safely
      const percentage =
        exam.totalMarks > 0
          ? Math.round((studentResult.marksObtained / exam.totalMarks) * 100)
          : 0;
      return {
        examName: exam.examName,
        subject: exam.subject,
        examDate: exam.examDate,
        totalMarks: exam.totalMarks,
        marksObtained: studentResult.marksObtained,
        percentage: percentage,
        remarks: studentResult.remarks,
      };
    });
    const latestExam = studentExams.length > 0 ? studentExams[0] : null;

    // 1. Calculate Overall Average
    let totalObtainedMarks = 0;
    let totalMaximumMarks = 0;

    studentExams.forEach((exam) => {
      totalObtainedMarks += exam.marksObtained;
      totalMaximumMarks += exam.totalMarks;
    });

    const overallAverage =
      totalMaximumMarks > 0
        ? Math.round((totalObtainedMarks / totalMaximumMarks) * 100)
        : 0;

    // 2. Determine Letter Grade based on the average
    let overallGrade = "N/A";
    if (totalMaximumMarks > 0) {
      if (overallAverage >= 90) overallGrade = "A+";
      else if (overallAverage >= 80) overallGrade = "A";
      else if (overallAverage >= 70) overallGrade = "B";
      else if (overallAverage >= 60) overallGrade = "C";
      else if (overallAverage >= 50) overallGrade = "D";
      else overallGrade = "F";
    }
    // 6. Render the view, passing the new dynamic attendance variables
    res.render("teacher/studentProfile.ejs", {
      student,
      currClass,
      attendanceMap: JSON.stringify(attendanceMap), // Stringify so JS can read it in EJS
      attendancePercentage,
      totalAssignment,
      totalSubmittedAssignments,
      pendingAssignments,
      studentExams,
      latestExam,
      overallAverage,
      overallGrade,
    });
  } catch (err) {
    console.error("Error rendering student profile:", err);
    req.flash("error", "An error occurred while loading the student profile.");
    res.redirect("/teacher?tab=Overview");
  }
};
// --- ADD MULTIPLE STUDENTS (BULK) ---
module.exports.addMultipleStudents = async (req, res) => {
  try {
    const { masterPassword, students } = req.body;
    const schoolId = req.user?.instituition?.school;

    // 1. Verify Teacher's Class
    const classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });

    if (!classRoom) {
      req.flash("error", "Cannot find your Class to add students.");
      return res.redirect("/teacher?tab=Students");
    }

    const newStudentEntries = [];
    let successCount = 0;
    let errorCount = 0;

    // 2. Loop through the array of students
    for (const studentData of students) {
      try {
        // Ensure empty rows submitted by accident are skipped
        if (!studentData.name || !studentData.phone) continue;

        // --- NEW LOGIC: Check for unique Admission Number in this school ---
        let parsedAdmissionNo = null;
        if (studentData.admissionNumber) {
          parsedAdmissionNo = Number(studentData.admissionNumber);

          const existingStudent = await Users.findOne({
            "instituition.school": schoolId,
            admissionNumber: parsedAdmissionNo,
          });

          if (existingStudent) {
            // Throwing an error here drops us directly into the catch block below,
            // skipping registration and properly incrementing the errorCount.
            throw new Error(
              `Admission Number ${studentData.admissionNumber} already exists in this school.`,
            );
          }
        }
        // -------------------------------------------------------------------

        const username = generateUsername(studentData.name, studentData.phone);

        const newStudent = new Users({
          username: username,
          name: studentData.name,
          phone: studentData.phone,
          admissionNumber: parsedAdmissionNo, // Save the properly parsed number
          designation: "student",
          instituition: {
            school: schoolId,
            class: classRoom._id,
          },
        });

        // Register user
        const registeredStudent = await Users.register(
          newStudent,
          masterPassword,
        );

        // Push object into temporary array formatted for your Class schema
        newStudentEntries.push({ student: registeredStudent._id });
        successCount++;
      } catch (studentErr) {
        console.error(`Error adding ${studentData.name}:`, studentErr.message);
        // Isolating try-catch inside the loop prevents 1 duplicate from failing the entire batch
        errorCount++;
      }
    }

    // 3. Batch push successful registrations to the Class model
    if (newStudentEntries.length > 0) {
      await Class.findByIdAndUpdate(classRoom._id, {
        $push: { students: { $each: newStudentEntries } },
      });
    }

    // 4. Flash accurate metrics back to the UI
    if (errorCount > 0) {
      req.flash(
        "warning", // Changed to warning since it's a partial success
        `${successCount} students added. ${errorCount} failed (likely duplicate phone or admission numbers).`,
      );
    } else {
      req.flash("success", `All ${successCount} students added successfully!`);
    }

    return res.redirect("/teacher?tab=Students");
  } catch (err) {
    console.error("Bulk Add Students Error:", err);
    req.flash("error", "Failed to process bulk upload.");
    return res.redirect("/teacher?tab=Students");
  }
};

// --- ADD SINGLE STUDENT ---
module.exports.addSingleStudent = async (req, res) => {
  try {
    const { name, phone, admissionNumber, password } = req.body;
    const schoolId = req.user?.instituition?.school;

    // Find the specific Class assigned to this teacher
    const classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });

    if (!classRoom) {
      req.flash("error", "Cannot find your Class to add the student.");
      return res.redirect("/teacher?tab=Students");
    }

    // --- NEW LOGIC: Check for unique Admission Number in this school ---
    let parsedAdmissionNo = null;
    if (admissionNumber) {
      parsedAdmissionNo = Number(admissionNumber);

      const existingStudent = await Users.findOne({
        "instituition.school": schoolId,
        admissionNumber: parsedAdmissionNo,
      });

      if (existingStudent) {
        req.flash(
          "error",
          `A student with Admission Number ${admissionNumber} already exists in your school!`,
        );
        return res.redirect("/teacher?tab=Students");
      }
    }
    // -------------------------------------------------------------------

    const username = generateUsername(name, phone);

    const newStudent = new Users({
      username: username, // Required by passport-local-mongoose
      name: name,
      phone: phone,
      admissionNumber: parsedAdmissionNo, // Save the properly parsed number
      designation: "student",
      instituition: {
        school: schoolId,
        class: classRoom._id,
      },
    });

    // Register securely hashes the password and saves the user
    const registeredStudent = await Users.register(newStudent, password);

    // Update the Class schema (matching your EJS structure: currClass.students.student)
    await Class.findByIdAndUpdate(classRoom._id, {
      $push: { students: { student: registeredStudent._id } },
    });

    req.flash(
      "success",
      `Student ${name} added successfully! Username: ${username}`,
    );
    return res.redirect("/teacher?tab=Students");
  } catch (err) {
    console.error("Add Single Student Error:", err);
    // Handle duplicate phone number or username errors gracefully
    req.flash("error", err.message || "Failed to add student.");
    return res.redirect("/teacher?tab=Students");
  }
};

module.exports.teacherDashboard = async (req, res) => {
  // 1. Authorization check
  if (req.user.designation !== "teacher") {
    req.flash("error", "Access Denied: Teachers only.");
    return res.redirect("/home");
  }

  try {
    const schoolId = req.user?.instituition?.school;

    if (!schoolId) {
      req.flash("error", "Institutional school details missing from profile.");
      return res.redirect("/home");
    }

    // 2. Pick the active tab (whitelisted, falls back to Overview)
    const validTabs = [
      "Overview",
      "Attendance",
      "Students",
      "Assignments",
      "Form",
      "Exam",
      "Resources",
      "Applications",
      "Timetable",
    ];
    const activeTab = validTabs.includes(req.query.tab)
      ? req.query.tab
      : "Overview";

    // 3. View variables with safe defaults.
    //    Declared INSIDE the function on purpose: module-level variables would be
    //    shared between every request/user. Only the active tab's case fills them.
    let attendancePercent = 0;
    let isMarked = false;
    let announcements = [];
    let notices = [];
    let assignments = [];
    let resources = [];
    let exams = [];
    let selectedExam = null;
    let selectedExamId = null;
    let application = [];
    let studentRequests = [];
    let timetable = null;

    // 4. Data needed on EVERY tab: the class + the school.
    //    The school's principal/teachers are only populated for Overview.
    const schoolQuery = Schools.findById(schoolId);
    if (activeTab === "Overview") {
      schoolQuery.populate([
        { path: "principle", select: "name profilePic" },
        { path: "teachers", select: "name profilePic email designation" },
      ]);
    }

    const [classData, currSchool] = await Promise.all([
      Class.findOne({ classTeacher: req.user._id, school: schoolId })
        .populate({ path: "subjects.teacher", select: "name profilePic" })
        .populate({ path: "classTeacher", select: "name profilePic" })
        .lean(),
      schoolQuery.lean(),
    ]);

    if (!classData) {
      req.flash("error", "No class is currently assigned to your profile.");
      return res.redirect("/home");
    }

    if (!currSchool) {
      req.flash("error", "No School Found!");
      return res.redirect("/home");
    }

    const classId = classData._id;
    const totalStudents = classData.students ? classData.students.length : 0;

    // COUNT in the database instead of loading every application
    const pendingApps = await Application.countDocuments({
      class: classId,
      status: { $in: ["Pending", "pending"] },
    });

    // Today's attendance (used by the Overview and Attendance tabs)
    const loadTodayAttendance = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const existingAttendance = await Attendance.findOne({
        class: classId,
        date: { $gte: startOfDay, $lte: endOfDay },
      }).lean();

      let percent = 0;
      if (existingAttendance && existingAttendance.records?.length > 0) {
        const presentCount = existingAttendance.records.filter(
          (r) => r.status === "Present",
        ).length;
        percent = Math.round(
          (presentCount / existingAttendance.records.length) * 100,
        );
      }
      return { percent, marked: !!existingAttendance };
    };

    // Populated student list (used by the Attendance, Students and Exam tabs)
    const loadClassStudents = async () => {
      const studentDoc = await Class.findById(classId)
        .select("students")
        .populate({
          path: "students.student",
          select: "name phone profilePic admissionNumber",
        })
        .lean();
      return studentDoc?.students ?? [];
    };

    // 5. Load ONLY the data the active tab needs
    switch (activeTab) {
      case "Attendance": {
        const [students, today] = await Promise.all([
          loadClassStudents(),
          loadTodayAttendance(),
        ]);
        classData.students = students;
        attendancePercent = today.percent;
        isMarked = today.marked;
        break;
      }

      case "Students": {
        classData.students = await loadClassStudents();
        break;
      }

      case "Assignments": {
        assignments = await Assignment.find({ class: classId })
          .populate("postedBy", "name profilePic")
          .populate({
            path: "submissions.student",
            select: "name profilePic",
          })
          .sort({ createdAt: -1 })
          .lean();
        break;
      }

      case "Form": {
        studentRequests = await classRequest
          .find({ receiver: classId })
          .populate("sender")
          .lean();
        break;
      }

      case "Exam": {
        // Exam.ejs lists the class students (name, profilePic) for marks entry
        let students;
        [exams, students] = await Promise.all([
          Exam.find({ class: classId }).sort({ examDate: -1 }).lean(),
          loadClassStudents(),
        ]);
        classData.students = students;

        // Only accept an examId that belongs to THIS class, else use the latest
        const requestedExam = exams.find(
          (e) => String(e._id) === String(req.query.examId),
        );
        const chosenExam = requestedExam || exams[0];
        selectedExamId = chosenExam ? String(chosenExam._id) : null;

        if (selectedExamId) {
          selectedExam = await Exam.findById(selectedExamId)
            .populate("results.student", "name profilePic")
            .lean();
        }
        break;
      }

      case "Resources": {
        resources = await Resource.find({ class: classId }).lean();
        break;
      }

      case "Applications": {
        application = await Application.find({ class: classId })
          .populate({
            path: "student",
            select: "name profilePic username email",
          })
          .populate({ path: "reviewedBy", select: "name" })
          .sort({ createdAt: -1 })
          .lean();
        break;
      }

      case "Timetable": {
        timetable = await Timetable.findOne({ class: classId })
          .populate("weeklySchedule.slots.teacher", "name profilePic")
          .lean();
        break;
      }

      case "Overview":
      default: {
        let today;
        [announcements, notices, today] = await Promise.all([
          Notice.find({
            school: schoolId, // was missing: notices from other schools could leak in
            $or: [
              { audience: "all" },
              { targetClass: classId },
              { audience: "teachers" },
            ],
          })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),

          Notice.find({ school: schoolId, targetClass: classId })
            .populate("author")
            .lean(),

          loadTodayAttendance(),
        ]);
        attendancePercent = today.percent;
        isMarked = today.marked;
        break;
      }
    }

    // 6. Render Dashboard (same variables the template already expects)
    return res.render("./teacher/Dashboard.ejs", {
      currClass: classData,
      attendancePercent: attendancePercent,
      announcements: announcements,
      totalStudents: totalStudents,
      pendingApps: pendingApps,
      isMarked: isMarked,
      assignments: assignments,
      activeTab: activeTab,
      currUser: req.user,
      currSchool: currSchool,
      exams: exams,
      resources: resources,
      selectedExam: selectedExam,
      selectedExamId: selectedExamId,
      application: application,
      request: studentRequests,
      notices: notices,
      timetable: timetable,
    });
  } catch (err) {
    console.error("Teacher Dashboard Error:", err);
    res.status(500).send("Internal Server Error");
  }
};

module.exports.addStudentPage = async (req, res) => {
  if (req.user.designation !== "classTeacher") {
    // Match your model's enum spelling
    req.flash("error", "Access Denied: Principals only.");
    return res.redirect("/home"); // Use res, not req
  }
  res.render("./teacher/addStudentForm.ejs");
};

// module.exports.addStudent = async (req, res) => {
//   // 1. Authorization check
//   // Ensure "classTeacher" matches the exact spelling in your User schema enum
//   if (req.user.designation !== "classTeacher") {
//     req.flash("error", "Only teachers can add students.");
//     return res.redirect("/home");
//   }

//   try {
//     const { studentId, admissionNumber, admissionId } = req.body;
//     const teacherClassId = await Class.findOne({
//       classTeacher: req.user._id,
//     }).select("_id");

//     // 2. Find the student in the User collection
//     let student = await Users.findById(studentId);

//     if (!student) {
//       req.flash("error", "Student ID not found in system.");
//       return res.redirect("/teacher?activeTab=Student");
//     }

//     //finding classroom loopspace for resp class
//     let loopSpace = await LoopSpace.findOne({
//       class: teacherClassId,
//       category: "ClassRoom",
//     });

//     // 3. Update the Student's User Profile
//     if (student.designation === "other" || student.designation === "student") {
//       student.designation = "student";
//       student.admissionNumber = admissionNumber;
//       student.instituition.class = teacherClassId;
//       student.instituition.school = req.user.instituition.school;
//       if (!student.loopSpace.includes(loopSpace._id)) {
//         student.loopSpace.push(loopSpace._id);
//       }

//       if (!loopSpace.members.includes(student._id)) {
//         loopSpace.members.push(student._id);
//       }
//       await loopSpace.save();
//       await student.save();
//     } else {
//       req.flash(
//         "error",
//         "This user cannot be added as a student (Invalid Designation).",
//       );
//       // THE CRITICAL FIX: Added 'return' here
//       return res.redirect("/teacher?activeTab=Student");
//     }

//     // 4. Link Student to the Class Model
//     await Class.findByIdAndUpdate(teacherClassId, {
//       $addToSet: { students: { student: student._id, admissionId } },
//     });

//     await LoopSpace.findOneAndUpdate(
//       { class: teacherClassId },
//       { category: "ClassRoom" },
//       { $addToSet: { members: student._id } },
//     );

//     req.flash(
//       "success",
//       `${student.name} added to class with Roll No: ${admissionNumber}`,
//     );
//     return res.redirect("/teacher?activeTab=Student");
//   } catch (err) {
//     console.error("Add Student Error:", err);
//     // Safety check to ensure we don't try to send a response if one was already sent
//     if (!res.headersSent) {
//       req.flash("error", `error: ${err}`);
//       return res.redirect("/teacher?activeTab=Student");
//     }
//   }
// };

// module.exports.addStudentRequest = async (req, res) => {
//   try {
//     // 1. Extract the exact properties from the objects
//     // (Assuming your route is something like /request/:classId)
//     const { classId } = req.params;

//     // (Assuming your frontend form sends an input named "studentId")
//     const studentId = req.user._id;

//     const newClassRequest = new classRequest({
//       receiver: classId,
//       sender: studentId,
//     });

//     // 2. Add 'await' to ensure the document actually saves to MongoDB
//     await newClassRequest.save();

//     req.flash("success", "Student request sent successfully.");
//     return res.redirect("/home");
//   } catch (error) {
//     console.error("Add Student Request Error:", error);
//     req.flash("error", "Something went wrong.");
//     return res.redirect("/home");
//   }
// };

// module.exports.requestReject = async (req, res) => {
//   try {
//     const { requestId } = req.body;

//     // Ensure we have a valid logged-in teacher
//     if (!req.user) {
//       return res.status(401).send("Unauthorized: Please log in.");
//     }

//     const teacherName = req.user.name || req.user.username || "your teacher";

//     // 1. Find the request first so we know which student to notify
//     // (Assuming your model is named 'classRequest' based on your previous code)
//     const pendingRequest = await classRequest.findById(requestId);

//     if (!pendingRequest) {
//       console.log("Request already processed or doesn't exist.");
//       return res.redirect(req.back);
//     }

//     const studentId = pendingRequest.sender;

//     // 2. Delete the request from the database
//     await classRequest.findByIdAndDelete(requestId);

//     // 3. Send the notification to the student
//     // (Adjust the fields below to perfectly match your Notification schema)
//     const newNotification = new Notification({
//       receiver: studentId,
//       sender: req.user._id,
//       type: "REQUEST_REJECT",
//       message: `Your request to join the class has been declined by ${teacherName}.`, // Fixed: changed 'content' to 'message'
//       link: "/home", // Fixed: changed 'url' to 'link'
//       isRead: false,
//     });
//     await newNotification.save();

//     req.flash("success", "Request Reject Successfully!");
//     res.redirect(`/teacher?tab=Students`);
//   } catch (error) {
//     console.error("Error rejecting student request:", error);
//     req.flash("error", "Error! in Rejecting Request");
//     res.redirect(`/teacher?tab=Students`);
//   }
// };

// module.exports.requestApprove = async (req, res) => {
//   try {
//     // 1. Extract the data sent from the EJS form
//     const { requestId, studentId, admissionNumber } = req.body;

//     // 2. Delete the pending request from the database
//     await classRequest.findByIdAndDelete(requestId);

//     // 3. Send an approval notification to the student
//     const teacherName = req.user.name || req.user.username || "your teacher";

//     const newNotification = new Notification({
//       receiver: studentId,
//       sender: req.user._id,
//       type: "REQUEST_APPROVED",
//       message: `Your request to join the class has been approved by ${teacherName}. Your Roll Number is ${admissionNumber}.`,
//       link: "/home",
//       isRead: false,
//     });

//     await newNotification.save();

//     // 4. Forward the POST request directly to your addStudent controller
//     // The '307' status strictly maintains the POST method and passes req.body along
//     return res.redirect(307, "/teacher/addStudent");
//   } catch (error) {
//     console.error("Error approving student request:", error);
//     req.flash("error", "Something went wrong while approving the request.");
//     return res.redirect("/teacher");
//   }
// };

module.exports.addResourcePage = async (req, res) => {
  try {
    const schoolId = req.user?.instituition?.school;
    // Get the class ID from the teacher's instituition details
    const classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });

    // Fetch class details to get the list of subjects
    // Assuming your Class schema has a 'subjects' array
    let classDetails = classRoom;

    if (!classDetails) {
      req.flash("error", "Class details not found.");
      return res.redirect("/teacher?activeTab=Resources");
    }

    res.render("./teacher/addResourcePage.ejs", {
      classDetails,
      subjects: classDetails.subjects, // Pass the actual subject list
    });
  } catch (err) {
    console.error("Error fetching class subjects:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/teacher?activeTab=Assignments");
  }
};

module.exports.addResource = async (req, res) => {
  try {
    const classId = req.user.instituition.class;
    const { title, description, resourceType, subject, externalLink } =
      req.body;

    // 1. Create Resource Entry
    const newResource = new Resource({
      title,
      description,
      resourceType,
      subject,
      externalLink,
      class: classId,
      uploadedBy: req.user._id,
    });

    await newResource.save();

    // 2. Notify the Class
    // Fetch students in this class to notify them
    const targetClass = await LoopSpace.findByIdAndUpdate(classId, {
      $push: {
        feed: {
          itemType: "Resource",
          itemRef: newResource._id,
        },
      },
    });

    if (targetClass && targetClass.members) {
      const notificationPromises = targetClass.members.map((studentId) => {
        return Notification.create({
          receiver: studentId,
          sender: req.user._id,
          type: "NOTICE",
          message: `New ${resourceType} uploaded for ${subject}: ${title}`,
          link: `${externalLink}`, // Link to student resource tab
        });
      });
      await Promise.all(notificationPromises);
    }

    req.flash("success", "Resource added to library!");
    res.redirect("/teacher?tab=Resources");
  } catch (err) {
    console.error("Resource Upload Error:", err);
    req.flash("error", "Failed to upload resource.");
    res.redirect("/teacher?tab=Resources");
  }
};

module.exports.submitAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    const schoolId = req.user?.instituition?.school;

    if (!schoolId) {
      req.flash("error", "School identification missing from your profile.");
      return res.redirect("/teacher?activeTab=Attendance");
    }

    const classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });
    const classId = classRoom._id;
    const attendanceData = Object.values(records);
    const newAttendance = new Attendance({
      school: schoolId,
      class: classId,
      date: new Date(),
      // Ensure records are mapped correctly
      records: Object.values(records),
      takenBy: req.user._id,
    });

    await newAttendance.save();

    // 2. --- NOTIFICATION LOGIC START ---
    // Loop through each student record to send individual notifications
    const notificationPromises = attendanceData.map((record) => {
      return new Notification({
        receiver: record.student, // The Student ID
        sender: req.user._id, // The Teacher ID
        type: "ATTENDANCE",
        message: `Attendance marked: You were ${record.status} in today's class.`,
        link: "/student/attendance", // Link to their attendance history
      }).save();
    });

    // Run all notification saves in parallel for better performance
    await Promise.all(notificationPromises);
    // --- NOTIFICATION LOGIC END ---

    req.flash("success", "Attendance marked successfully!");
    return res.redirect("/teacher?activeTab=Attendance");
  } catch (err) {
    console.error("Attendance Error:", err);
    req.flash("error", "Failed to submit attendance.");
    return res.redirect("/teacher?activeTab=Attendance");
  }
};

module.exports.addSubject = async (req, res) => {
  try {
    const { subjectName, teacherId } = req.body;
    const schoolId = req.user?.instituition?.school;

    // 1. Check if Teacher exists
    let Teacher = await Users.findById(teacherId);
    if (!Teacher) {
      req.flash("error", "Cannot find Teacher");
      return res.redirect("/teacher?activeTab=Overview");
    }

    // 4. Check if Class exists
    let classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });
    if (!classRoom) {
      req.flash("error", "Cannot find your Class");
      return res.redirect("/teacher?activeTab=Overview");
    }

    const classId = classRoom._id;
    // 6. Update Class Model (Add subject and add teacher to class staff list)
    await Class.findByIdAndUpdate(classId, {
      $push: {
        subjects: { name: subjectName, teacher: teacherId },
      },
      $addToSet: { teachers: teacherId },
    });

    req.flash("success", `Subject ${subjectName} added successfully!`);
    res.redirect("/teacher?activeTab=Overview");
  } catch (err) {
    console.error("Add Subject Error:", err);
    res.redirect("/teacher?activeTab=Overview");
  }
};

module.exports.createAssignmentPage = async (req, res) => {
  try {
    // Get the class ID from the teacher's instituition details
    const schoolId = req.user?.instituition?.school;
    // Get the class ID from the teacher's instituition details
    const classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });

    // Fetch class details to get the list of subjects
    // Assuming your Class schema has a 'subjects' array
    let classDetails = classRoom;

    if (!classDetails) {
      req.flash("error", "Class details not found.");
      return res.redirect("/teacher?activeTab=Assignments");
    }

    res.render("./teacher/addAssignment.ejs", {
      classDetails,
      subjects: classDetails.subjects, // Pass the actual subject list
    });
  } catch (err) {
    console.error("Error fetching class subjects:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/teacher?activeTab=Assignments");
  }
};

module.exports.createAssignment = async (req, res) => {
  try {
    const { subject, title, dueDate, description } = req.body; //

    // Extract instituitional data from teacher profile
    const schoolId = req.user?.instituition?.school;
    // Get the class ID from the teacher's instituition details
    const classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });
    const classId = classRoom._id;

    const newAssignment = new Assignment({
      school: schoolId, //
      class: classId, //
      subject, //
      title, //
      description, //
      dueDate, //
      postedBy: req.user._id, //
      attachments: [],
    });

    // 1. Handle Single File Upload to ImageKit
    if (req.file) {
      const uploadResponse = await imagekit.upload({
        file: req.file.buffer, // Data from memoryStorage
        fileName: `assignment_${Date.now()}_${req.file.originalname}`,
        folder: "/classloop_assignments",
      });

      // Store the single URL in the attachments array
      newAssignment.attachments.push(uploadResponse.url);
    }

    await newAssignment.save(); //

    // 2. Notify all students in the teacher's class
    const students = classRoom.students
      .map((item) => item.student?._id || item.student)
      .filter(Boolean);

    const notificationPromises = students.map(async (student) => {
      try {
        const notif = new Notification({
          receiver: student._id,
          sender: req.user._id,
          type: "ASSIGNMENT",
          message: `New Assignment: "${title}" posted for ${subject}.`,
          link: `/student/assignments/${newAssignment._id}`,
        });
        return await notif.save();
      } catch (e) {
        console.error(
          "Error saving notification for student:",
          student._id,
          e.message,
        );
      }
    });

    await Promise.all(notificationPromises);

    req.flash("success", "Assignment created and students notified!"); //
    res.redirect("/teacher?activeTab=Assignments"); //
  } catch (err) {
    console.error("Error creating assignment:", err); //
    req.flash("error", "Something went wrong while creating the assignment."); //
    res.redirect("/teacher?activeTab=Assignments"); //
  }
};

module.exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find the assignment to get class context
    const assignment = await Assignment.findById(id);
    if (!assignment) return res.redirect("/teacher?tab=Assignments");

    // 2. Delete the file from ImageKit if attachments exist
    if (assignment.attachments && assignment.attachments.length > 0) {
      for (let fileUrl of assignment.attachments) {
        // If you don't have fileId stored, you can find it by path
        const path = new URL(fileUrl).pathname;
        const files = await imagekit.listFiles({
          searchQuery: `name = "${path.split("/").pop()}"`,
        });

        if (files.length > 0) {
          await imagekit.deleteFile(files[0].fileId);
        }
      }
    }

    // 2. Remove assignment from the LoopSpace/Class feed
    await LoopSpace.findOneAndUpdate(
      { class: assignment.class },
      { $pull: { feed: { itemRef: id } } },
    );

    // 3. Delete the assignment document
    await Assignment.findByIdAndDelete(id);

    req.flash("success", "Assignment removed successfully.");
    res.redirect("/teacher?tab=Assignments");
  } catch (err) {
    req.flash("error", "Error deleting assignment.");
    console.error(err);
    res.redirect("/teacher?tab=Assignments");
  }
};

module.exports.previewAllForms = async (req, res) => {
  try {
    // 1. Fetch all forms created by the logged-in teacher
    // We populate 'class' to get total member counts for the card stats
    const forms = await Form.find({ creator: req.user._id })
      .populate("class")
      .sort({ createdAt: -1 });

    // 2. Fetch LoopSpaces to calculate total students for each class card
    // This helps show the "38 / 42" dynamic stats in your EJS
    const spaces = await LoopSpace.find({ admin: req.user._id }).select(
      "class members",
    );

    res.render("teacher/viewAllForms.ejs", {
      forms,
      spaces,
      currUser: req.user,
    });
  } catch (err) {
    console.error("Preview Forms Error:", err);
    req.flash("error", "Could not load forms.");
    res.redirect("back");
  }
};

module.exports.viewFormResponses = async (req, res) => {
  try {
    const { formId } = req.params;

    // 1. Fetch the Form and populate the class details
    const form = await Form.findById(formId).populate("class");
    if (!form) {
      req.flash("error", "Form not found.");
      return res.redirect("/teacher?tab=Overview");
    }

    // 2. Fetch all student responses for this form
    const responses = await FormResponse.find({ form: formId })
      .populate("student", "name profilePic admissionNumber") // Populate student info for the table
      .sort({ createdAt: -1 });

    // 3. Find the LoopSpace to get the full list of class members
    const space = await LoopSpace.findOne({ class: form.class._id });

    // 4. Calculate Pending Students
    // Get IDs of students who HAVE submitted
    const submittedStudentIds = responses.map((r) => r.student._id.toString());

    // Find members of the space who are NOT in the submitted list
    const pendingStudents = await Users.find({
      _id: { $in: space.members, $nin: submittedStudentIds },
      designation: "student", // Ensure we only target students, not other teachers
    }).select("name profilePic");

    // 5. Render the analytics page
    res.render("teacher/indivFormResponse.ejs", {
      form,
      responses,
      pendingStudents,
      currUser: req.user,
    });
  } catch (err) {
    console.error("View Form Responses Error:", err);
    req.flash("error", "Something went wrong while fetching responses.");
    res.redirect("/teacher?tab=Overview");
  }
};

module.exports.viewIndividualResponseDetails = async (req, res) => {
  try {
    const { responseId } = req.params;
    const response = await FormResponse.findById(responseId)
      .populate("student", "name profilePic admissionNumber")
      .populate({
        path: "form",
        populate: { path: "questions" },
      });

    res.render("teacher/viewStudentSubmission.ejs", { response });
  } catch (err) {
    res.status(500).send("Error fetching response");
    res.redirect("/teacher?tab=Overview");
  }
};

module.exports.addNotice = async (req, res) => {
  try {
    const { title, content, audience, priority } = req.body;

    const schoolId = req.user?.instituition?.school;
    const classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });
    const classId = classRoom._id;

    if (!schoolId || !classRoom) {
      req.flash(
        "error",
        "Profile Incomplete: You are not assigned to a school or class.",
      );
      return res.redirect("/home");
    }
    // 1. Create and Save Notice
    const newNotice = new Notice({
      school: schoolId,
      title,
      content,
      audience,
      priority,
      author: req.user._id,
      targetClass: classId,
    });
    await newNotice.save();

    // 2. Identify Target Users
    let targetUsers = [];

    if (audience === "specific_class") {
      // Match Class model: "students" and "teachers" arrays
      const cls = await Class.findById(classId)
        .populate("students")
        .populate("teachers");
      if (cls) {
        targetUsers = [...(cls.students || []), ...(cls.teachers || [])];
      }
    } else if (audience === "students") {
      // Match your import: "Users"
      // Match your model field: "designation"
      targetUsers = await Users.find({
        designation: "student",
        "instituition.school": schoolId,
      });
    } else if (audience === "teachers") {
      targetUsers = await Users.find({
        designation: { $in: ["teacher", "classTeacher"] },
        "instituition.school": schoolId,
      });
    } else if (audience === "all") {
      targetUsers = await Users.find({
        "instituition.school": schoolId,
      });
    }

    // 3. Filter current teacher and remove duplicates
    const uniqueUsers = [
      ...new Map(
        targetUsers
          .filter((u) => u && u._id.toString() !== req.user._id.toString())
          .map((user) => [user._id.toString(), user]),
      ).values(),
    ];

    // 4. Create Notifications individually to see errors in console
    if (uniqueUsers.length > 0) {
      const notificationPromises = uniqueUsers.map(async (user) => {
        try {
          const newNotif = new Notification({
            receiver: user._id, //
            sender: req.user._id, //
            type: "NOTICE", //
            message: `New Notice: ${title}`,
            link: `/home`,
          });
          return await newNotif.save();
        } catch (notifErr) {
          console.error("Individual Notification Error:", notifErr.message);
          return null;
        }
      });

      await Promise.allSettled(notificationPromises);
    }

    req.flash("success", "Notice posted and notifications sent!");
    res.redirect("/teacher?tab=Overview");
  } catch (err) {
    console.error("CRITICAL ERROR IN ADDNOTICE:", err);
    req.flash("error", "Error: " + err.message);
    res.redirect("/teacher?tab=Overview");
  }
};

module.exports.deleteNotice = async (req, res) => {
  try {
    const { noticeId } = req.body;
    await Notice.findByIdAndDelete(noticeId);
    req.flash("success", "Notice deleted successfully!");
    res.redirect("/teacher?tab=Overview");
  } catch (err) {
    console.error("Delete Notice Error:", err);
    req.flash("error", "Failed to delete notice.");
    res.redirect("/teacher?tab=Overview");
  }
};

module.exports.getAttendanceInsights = async (req, res) => {
  try {
    const schoolId = req.user?.instituition?.school;

    // 1. Fetch Class Data
    const currClass = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });

    if (!currClass) {
      res.flash("error", "Invalid Class");
      res.redirect("/teacher?tab=Overview");
    }
    const classId = currClass._id;
    // 2. Handle Date
    const selectedDate = req.query.date ? new Date(req.query.date) : new Date();
    const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

    // 3. Fetch ONE Attendance Document for this class and date
    const attendanceDoc = await Attendance.findOne({
      class: classId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).populate("records.student", "name profilePic admissionNumber"); // FIX: Nested Population

    // 4. Extract Records and Calculate Stats
    const records = attendanceDoc ? attendanceDoc.records : [];
    const totalStudents = records.length;

    const stats = {
      present: records.filter((r) => r.status === "Present").length,
      absent: records.filter((r) => r.status === "Absent").length,
      lateLeave: records.filter((r) => ["Late", "Leave"].includes(r.status))
        .length,
      percentage: 0,
    };

    if (totalStudents > 0) {
      stats.percentage = Math.round((stats.present / totalStudents) * 100);
    }

    res.render("./teacher/seeAttendance", {
      currClass,
      records, // This is now an array of objects: { student: {...}, status: "...", remarks: "..." }
      stats,
      selectedDate: startOfDay,
      currUser: req.user,
      activeTab: "Attendance",
    });
  } catch (err) {
    console.error("Attendance Insights Error:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/teacher?tab=Overview");
  }
};

module.exports.createForm = async (req, res) => {
  try {
    const { title, description, questions, expiresAt, isAnonymous } = req.body;
    const schoolId = req.user?.instituition?.school;
    const classRoom = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });
    const classId = classRoom._id;

    // 1. Process the questions array
    // We filter out any null entries that might happen if a teacher deleted a question during building
    const formattedQuestions = Object.values(questions).map((q) => ({
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options || [], // Will be empty for "text" type
      isRequired: q.isRequired === "on", // Checkbox 'on' to boolean
    }));

    // 2. Create the Form Template
    const newForm = new Form({
      title,
      description,
      questions: formattedQuestions,
      creator: req.user._id,
      class: classId,
      school: schoolId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isAnonymous: isAnonymous === "on",
    });

    await newForm.save();

    // 3. Sync with LoopSpace Feed
    // We use findOneAndUpdate with the classId to ensure it goes to the right classroom hub
    await LoopSpace.findOneAndUpdate(
      { class: classId },
      {
        $push: {
          feed: {
            itemType: "Form", // Ensure "Form" is in your LoopSpace enum
            itemRef: newForm._id,
          },
        },
      },
    );

    req.flash("success", "New form published successfully!");
    res.redirect("/teacher?activeTab=Overview");
  } catch (err) {
    console.error("Create Form Error:", err);
    req.flash("error", "Failed to create form. Please check your inputs.");
    res.redirect("back");
  }
};

module.exports.deleteForm = async (req, res) => {
  try {
    const { formId } = req.params;

    // 1. Optional: Find the form first to ensure the requester is the creator
    const form = await Form.findById(formId);

    if (!form) {
      req.flash("error", "Form not found.");
      return res.redirect("/teacher/previewForms");
    }

    // 2. Security Check: Only the creator can delete their form
    if (form.creator.toString() !== req.user._id.toString()) {
      req.flash("error", "You do not have permission to delete this form.");
      return res.redirect("/teacher/previewForms");
    }

    // 3. Delete all responses associated with this form first
    await FormResponse.deleteMany({ form: formId });

    // 4. Delete the form itself
    await Form.findByIdAndDelete(formId);

    req.flash(
      "success",
      "Form and all student responses deleted successfully.",
    );
    res.redirect("/teacher/previewForms");
  } catch (err) {
    console.error("Delete Form Error:", err);
    req.flash("error", "Something went wrong during deletion.");
    res.redirect("/teacher/previewForms");
  }
};

module.exports.submitGrade = async (req, res) => {
  try {
    const { assignmentId, submissionId } = req.params;
    const { grade } = req.body;

    // Use positional operator ($) to update the specific submission in the array
    await Assignment.updateOne(
      { _id: assignmentId, "submissions._id": submissionId },
      {
        $set: { "submissions.$.grade": grade },
      },
    );

    res.status(200).json({ success: true, message: "Grade updated!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports.addExamPage = async (req, res) => {
  try {
    const schoolId = req.user?.instituition?.school;
    const currClass = await Class.findOne({
      school: schoolId,
      classTeacher: req.user._id,
    });

    if (!currClass) {
      req.flash("error", "Class not found.");
      return res.redirect("/teacher?tab=Form");
    }

    res.render("teacher/addExamPage.ejs", {
      currClass,
      currUser: req.user,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/teacher?tab=Form");
  }
};

module.exports.createExam = async (req, res) => {
  try {
    const { examName, subject, totalMarks, examDate, classId } = req.body;

    // 1. Create the base exam document
    const newExam = new Exam({
      examName,
      subject,
      totalMarks,
      examDate,
      class: classId,
      teacher: req.user._id,
      results: [], // This will be populated in the next step
    });

    const savedExam = await newExam.save();

    // 2. Redirect to the bulk marking page using the new Exam ID
    req.flash("success", "Exam metadata saved. Please enter student marks.");
    res.redirect(`/teacher?tab=Exam`);
  } catch (err) {
    console.error("Exam Creation Error:", err);
    req.flash("error", "Failed to create exam record.");
    res.redirect(`/teacher?tab=Exam`);
  }
};

module.exports.saveExamMarks = async (req, res) => {
  try {
    const { examId, results } = req.body;

    // 1. Update the Exam document
    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      { results: results },
      { new: true, runValidators: true },
    );

    if (!updatedExam) {
      req.flash("error", "Exam record not found.");
      return res.redirect("/teacher?tab=Exam");
    }

    // 2. Map through results to create notifications
    // We use Promise.all to handle multiple student notifications efficiently
    const notificationPromises = results.map((result) => {
      // Find the student's specific score from the results array
      const score = result.marksObtained;

      return Notification.create({
        receiver: result.student, // Your model field
        sender: req.user._id, // The teacher
        type: "EXAM", // Your enum category
        message: `Result out! You scored ${score}/${updatedExam.totalMarks} in ${updatedExam.examName} (${updatedExam.subject}).`,
        link: `/student/results`, // Redirect link for student
      });
    });

    await Promise.all(notificationPromises);

    req.flash(
      "success",
      `Marks saved and ${results.length} students notified!`,
    );
    res.redirect("/teacher?tab=Exam");
  } catch (err) {
    console.error("Save & Notify Error:", err);
    req.flash(
      "error",
      "Error saving marks. Ensure scores are within total marks limit.",
    );
    res.redirect("back");
  }
};

module.exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, teacherRemarks } = req.body; // Comes from the button value and input

    let application = await Application.findByIdAndUpdate(id, {
      status: status,
      teacherRemarks: teacherRemarks,
      reviewedBy: req.user._id, // Track who clicked the button
    });

    const notificationMessage = `Your Application for ${application.type} has been ${status}.`;
    const link = `/loopSpace/${req.user.loopSpace._id}?tab='Applications'`;

    const newNotification = new Notification({
      receiver: application.student._id, // Send to the student
      sender: req.user._id, // Sent by the Teacher
      type: "APPLICATION",
      message: notificationMessage,
      link: link, // Link to the LoopSpace/Class so they can check details
      isRead: false,
    });

    await newNotification.save();

    req.flash("success", `Application ${status} successfully.`);
    // Redirect back to the Teacher Dashboard, keeping the 'Applications' tab active
    res.redirect(req.get("Referer"));
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update application.");
    res.redirect(req.get("Referer"));
  }
};

module.exports.getQrCode = async (req, res) => {
  try {
    // 1. Find the class where this user is the classTeacher
    const currClass = await Class.findOne({ classTeacher: req.user._id });

    // 2. Find the school and optionally populate the principal's details
    const currSchool = await Schools.findById(
      req.user.instituition.school,
    ).populate("principle");

    // 3. Safety check: Ensure the teacher actually has an assigned class
    if (!currClass) {
      req.flash("error", "You do not have a class assigned to you yet.");
      return res.redirect("/teacher");
    }

    // 4. Render the view and pass all required data
    res.render("./teacher/QrCode.ejs", {
      currClass,
      currSchool,
      teacher: req.user, // Pass the currently logged-in user as the teacher
    });
  } catch (err) {
    console.error("Error fetching QR Code:", err);
    req.flash("error", "Failed to load the QR Code page.");
    return res.redirect("/teacher");
  }
};
