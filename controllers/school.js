const Schools = require("../model/school/school.js");
const Class = require("../model/school/classes.js");
const Users = require("../model/User.js");
const LoopSpace = require("../model/loopSpace/loopSpace.js");
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
    // .populate("classes") allows you to see the list of classes in the dashboard
    const schoolData = await Schools.findOne({ principle: req.user._id })
      .populate("teachers")
      .populate({
        path: "classes",
        populate: {
          path: "classTeacher", // This field is inside the Class model
          model: "User", // Explicitly mention the model if needed
          select: "name profilePic", // Optional: only fetch specific fields like name and pic
        },
      });
    const Principle = await Users.findById(req.user._id);
    console.log(schoolData);
    const activeTab = req.query.tab || "Dashboard";
    res.render("./school/Dashboard.ejs", {
      School: schoolData,
      activeTab, // Pass as a string
      currUser: req.user,
      Principle: Principle,
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
