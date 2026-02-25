const Notification = require("../model/notification/notification.js");
const Posts = require("../model/post.js");
const Comments = require("../model/comment.js");
const Users = require("../model/User.js");
const Message = require("../model/message.js");
const Connection = require("../model/connection/connection.js");
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
const classRequest = require("../model/school/classRequest.js");
const ImageKit = require("imagekit");

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports.teacherDashboard = async (req, res) => {
  // 1. Authorization check
  if (req.user.designation !== "classTeacher") {
    req.flash("error", "Access Denied: Teachers only.");
    return res.redirect("/home");
  }

  try {
    // 2. Identify the teacher's class
    const classId = req.user?.instituition?.class;
    const schoolId = req.user?.instituition?.school;

    if (!classId || !schoolId) {
      console.error("User missing instituitional data:", req.user._id);
      req.flash("error", "Your account is not linked to a class or school.");
      return res.redirect("/home");
    }

    // --- NEW: FETCH EXAMS FOR THE CLASS ---
    const exams = await Exam.find({ class: classId }).sort({ examDate: -1 });

    // Determine which exam is currently being marked
    const selectedExamId =
      req.query.examId || (exams.length > 0 ? exams[0]._id : null);
    let selectedExam = null;

    if (selectedExamId) {
      selectedExam = await Exam.findById(selectedExamId).populate(
        "results.student",
        "name profilePic",
      );
    }

    // --- ADDED: CHECK IF ATTENDANCE IS MARKED FOR TODAY ---
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existingAttendance = await Attendance.findOne({
      class: classId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    let attendancePercent = 0;
    if (existingAttendance && existingAttendance.records.length > 0) {
      const presentCount = existingAttendance.records.filter(
        (r) => r.status === "Present",
      ).length;
      attendancePercent = Math.round(
        (presentCount / existingAttendance.records.length) * 100,
      );
    }

    // 3. Determine the active tab (Defaults to 'Overview')
    const activeTab = req.query.tab || "Overview";

    // 4. Fetch the Class data and populate students
    const classData = await Class.findOne({ classTeacher: req.user._id })
      .populate({
        path: "students",
        select: "name phone profilePic rollNumber", // Add the fields you want to display in the roster
      })
      .populate({
        path: "subjects",
        populate: {
          path: "teacher",
          model: "User", // Use the exact name of your User model registration
          select: "name profilePic",
        },
      });
    const schoolIdfromClass = classData.school;
    const currSchool = await Schools.findById(schoolIdfromClass).populate(
      "principle",
      "name profilePic",
    );
    // 5. Fetch Class Announcements (Notice model)
    const announcements = await Notice.find({
      $or: [
        { audience: "all" },
        { targetClass: classId },
        { audience: "teachers" },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5);

    const assignments = await Assignment.find({ class: classId })
      .populate("postedBy", "name profilePic")
      .populate({
        path: "submissions.student", // Deep populate student info for grading
        select: "name profilePic",
      })
      .sort({ createdAt: -1 });

    //find resources and push to teacher dashboard
    const resources = await Resource.find({ class: classId });

    const application = await Application.find({ class: classId })
      .populate({
        path: "student",
        select: "name profilePic username email", // Select only what you need to display
      })
      .populate({
        path: "reviewedBy",
        select: "name", // To show "Approved by [Teacher Name]"
      })
      .sort({ createdAt: -1 });

    const studentRequests = await classRequest
      .find({ receiver: classId })
      .populate("sender");
    // 6. Render the dashboard
    res.render("./teacher/Dashboard.ejs", {
      currClass: classData,
      attendancePercent: attendancePercent,
      announcements: announcements,
      isMarked: !!existingAttendance,
      assignments: assignments,
      activeTab: activeTab,
      currUser: req.user,
      currSchool: currSchool, // Needed for the school name in header
      exams: exams,
      resources: resources,
      selectedExam: selectedExam,
      selectedExamId: selectedExamId,
      application: application,
      request: studentRequests,
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

module.exports.addStudent = async (req, res) => {
  // 1. Authorization check
  // Ensure "classTeacher" matches the exact spelling in your User schema enum
  if (req.user.designation !== "classTeacher") {
    req.flash("error", "Only teachers can add students.");
    return res.redirect("/home");
  }

  try {
    const { studentId, rollNumber, admissionId } = req.body;
    const teacherClassId = await Class.findOne({
      classTeacher: req.user._id,
    }).select("_id");

    // 2. Find the student in the User collection
    let student = await Users.findById(studentId);

    if (!student) {
      req.flash("error", "Student ID not found in system.");
      return res.redirect("/teacher?activeTab=Student");
    }

    //finding classroom loopspace for resp class
    let loopSpace = await LoopSpace.findOne({
      class: teacherClassId,
      category: "ClassRoom",
    });

    // 3. Update the Student's User Profile
    if (student.designation === "other" || student.designation === "student") {
      student.designation = "student";
      student.rollNumber = rollNumber;
      student.instituition.class = teacherClassId;
      student.instituition.school = req.user.instituition.school;
      if (!student.loopSpace.includes(loopSpace._id)) {
        student.loopSpace.push(loopSpace._id);
      }

      if (!loopSpace.members.includes(student._id)) {
        loopSpace.members.push(student._id);
      }
      await loopSpace.save();
      await student.save();
    } else {
      req.flash(
        "error",
        "This user cannot be added as a student (Invalid Designation).",
      );
      // THE CRITICAL FIX: Added 'return' here
      return res.redirect("/teacher?activeTab=Student");
    }

    // 4. Link Student to the Class Model
    await Class.findByIdAndUpdate(teacherClassId, {
      $addToSet: { students: { student: student._id, admissionId } },
    });

    await LoopSpace.findOneAndUpdate(
      { class: teacherClassId },
      { category: "ClassRoom" },
      { $addToSet: { members: student._id } },
    );

    req.flash(
      "success",
      `${student.name} added to class with Roll No: ${rollNumber}`,
    );
    return res.redirect("/teacher?activeTab=Student");
  } catch (err) {
    console.error("Add Student Error:", err);
    // Safety check to ensure we don't try to send a response if one was already sent
    if (!res.headersSent) {
      req.flash("error", `error: ${err}`);
      return res.redirect("/teacher?activeTab=Student");
    }
  }
};

module.exports.addStudentRequest = async (req, res) => {
  try {
    // 1. Extract the exact properties from the objects
    // (Assuming your route is something like /request/:classId)
    const { classId } = req.params;

    // (Assuming your frontend form sends an input named "studentId")
    const studentId = req.user._id;

    const newClassRequest = new classRequest({
      receiver: classId,
      sender: studentId,
    });

    // 2. Add 'await' to ensure the document actually saves to MongoDB
    await newClassRequest.save();

    req.flash("success", "Student request sent successfully.");
    return res.redirect("/home");
  } catch (error) {
    console.error("Add Student Request Error:", error);
    req.flash("error", "Something went wrong.");
    return res.redirect("/home");
  }
};

module.exports.requestReject = async (req, res) => {
  try {
    const { requestId } = req.body;

    // Ensure we have a valid logged-in teacher
    if (!req.user) {
      return res.status(401).send("Unauthorized: Please log in.");
    }

    const teacherName = req.user.name || req.user.username || "your teacher";

    // 1. Find the request first so we know which student to notify
    // (Assuming your model is named 'classRequest' based on your previous code)
    const pendingRequest = await classRequest.findById(requestId);

    if (!pendingRequest) {
      console.log("Request already processed or doesn't exist.");
      return res.redirect(req.back);
    }

    const studentId = pendingRequest.sender;

    // 2. Delete the request from the database
    await classRequest.findByIdAndDelete(requestId);

    // 3. Send the notification to the student
    // (Adjust the fields below to perfectly match your Notification schema)
    const newNotification = new Notification({
      receiver: studentId,
      sender: req.user._id,
      type: "REQUEST_REJECT",
      message: `Your request to join the class has been declined by ${teacherName}.`, // Fixed: changed 'content' to 'message'
      link: "/home", // Fixed: changed 'url' to 'link'
      isRead: false,
    });
    await newNotification.save();

    req.flash("success", "Request Reject Successfully!");
    res.redirect(`/teacher?tab=Students`);
  } catch (error) {
    console.error("Error rejecting student request:", error);
    req.flash("error", "Error! in Rejecting Request");
    res.redirect(`/teacher?tab=Students`);
  }
};

module.exports.requestApprove = async (req, res) => {
  try {
    // 1. Extract the data sent from the EJS form
    const { requestId, studentId, rollNumber } = req.body;

    // 2. Delete the pending request from the database
    await classRequest.findByIdAndDelete(requestId);

    // 3. Send an approval notification to the student
    const teacherName = req.user.name || req.user.username || "your teacher";

    const newNotification = new Notification({
      receiver: studentId,
      sender: req.user._id,
      type: "REQUEST_APPROVED",
      message: `Your request to join the class has been approved by ${teacherName}. Your Roll Number is ${rollNumber}.`,
      link: "/home",
      isRead: false,
    });

    await newNotification.save();

    // 4. Forward the POST request directly to your addStudent controller
    // The '307' status strictly maintains the POST method and passes req.body along
    return res.redirect(307, "/teacher/addStudent");
  } catch (error) {
    console.error("Error approving student request:", error);
    req.flash("error", "Something went wrong while approving the request.");
    return res.redirect("/teacher");
  }
};

module.exports.addResourcePage = async (req, res) => {
  try {
    // Get the class ID from the teacher's instituition details
    const classId = req.user.instituition.class;

    // Fetch class details to get the list of subjects
    // Assuming your Class schema has a 'subjects' array
    let classDetails = await Class.findById(classId);

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

    // Use the exact spelling from your saved info: "instituition"
    const classId = req.user.instituition.class;
    const schoolId = req.user.instituition.school; // Check if this is undefined
    const LoopSpaceId = req.user.loopSpace;

    if (!schoolId) {
      req.flash("error", "School identification missing from your profile.");
      return res.redirect("/teacher?activeTab=Attendance");
    }
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

    await LoopSpace.findByIdAndUpdate(LoopSpaceId, {
      $push: {
        feed: {
          itemType: "Attendance",
          itemRef: newAttendance._id,
        },
      },
    });

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
    const classId = req.user.instituition.class;

    // 1. Check if Teacher exists
    let Teacher = await Users.findById(teacherId); // Changed 'Users' to 'User' to match common naming
    if (!Teacher) {
      req.flash("error", "Cannot find Teacher");
      return res.redirect("/teacher?activeTab=Overview");
    }

    // 2. Update designation if they were listed as 'other'
    if (Teacher.designation === "other") {
      Teacher.designation = "teacher";
    }

    // 3. Link Teacher to this Class in their User Profile
    Teacher.instituition.class = classId;
    await Teacher.save();

    // 4. Check if Class exists
    let classRoom = await Class.findById(classId);
    if (!classRoom) {
      req.flash("error", "Cannot find your Class");
      return res.redirect("/teacher?activeTab=Overview");
    }

    // 5. Update School Model (Add teacher to school staff list)
    await Schools.findByIdAndUpdate(classRoom.school, {
      $addToSet: { teachers: teacherId },
    });

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
    const classId = req.user.instituition.class;

    // Fetch class details to get the list of subjects
    // Assuming your Class schema has a 'subjects' array
    let classDetails = await Class.findById(classId);

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
    const schoolId = req.user.instituition.school; //
    const classId = req.user.instituition.class; //
    const LoopSpaceId = req.user.loopSpace;

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

    await LoopSpace.findByIdAndUpdate(LoopSpaceId, {
      $push: {
        feed: {
          itemType: "Assignment",
          itemRef: newAssignment._id,
        },
      },
    });

    // 2. Notify all students in the teacher's class
    const students = await Users.find({
      "instituition.class": classId,
      role: "student",
    }); //

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
    if (!assignment) return res.redirect("back");

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
      return res.redirect("back");
    }

    // 2. Fetch all student responses for this form
    const responses = await FormResponse.find({ form: formId })
      .populate("student", "name profilePic rollNumber") // Populate student info for the table
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
    res.redirect("back");
  }
};

module.exports.viewIndividualResponseDetails = async (req, res) => {
  try {
    const { responseId } = req.params;
    const response = await FormResponse.findById(responseId)
      .populate("student", "name profilePic rollNumber")
      .populate({
        path: "form",
        populate: { path: "questions" },
      });

    res.render("teacher/viewStudentSubmission.ejs", { response });
  } catch (err) {
    res.status(500).send("Error fetching response");
  }
};

module.exports.addNotice = async (req, res) => {
  try {
    const { title, content, audience, priority } = req.body;

    const schoolId = req.user.instituition.school;
    const classId = req.user.instituition.class;
    const LoopSpaceId = req.user.loopSpace;

    if (!schoolId || !classId) {
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
      targetClass: audience === "specific_class" ? classId : null,
    });
    await newNotice.save();

    await LoopSpace.findByIdAndUpdate(LoopSpaceId, {
      $push: {
        feed: {
          itemType: "Notice",
          itemRef: newNotice._id,
        },
      },
    });

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

module.exports.getAttendanceInsights = async (req, res) => {
  try {
    const classId = req.user.instituition.class;

    // 1. Fetch Class Data
    const currClass = await Class.findById(classId);

    // 2. Handle Date
    const selectedDate = req.query.date ? new Date(req.query.date) : new Date();
    const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

    // 3. Fetch ONE Attendance Document for this class and date
    const attendanceDoc = await Attendance.findOne({
      class: classId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).populate("records.student", "name profilePic rollNumber"); // FIX: Nested Population

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
    const classId = req.user.instituition.class;
    const schoolId = req.user.instituition.school;

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

// controller/teacherController.js
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
    let classId = req.user.instituition.class;

    // Ensure you populate the students field to get names and IDs
    const currClass = await Class.findById(classId).populate("students");

    if (!currClass) {
      req.flash("error", "Class not found.");
      return res.redirect("back");
    }

    res.render("teacher/addExamPage.ejs", {
      currClass,
      currUser: req.user,
    });
  } catch (err) {
    console.error(err);
    res.redirect("back");
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

// Add this function to your controller file
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
