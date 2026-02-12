const Schools = require("../model/school/school.js");
const Class = require("../model/school/classes.js");

module.exports.renderSchoolDashboard = async (req, res) => {
  try {
    const schoolId = req.user.instituition.school;
    // .populate("classes") allows you to see the list of classes in the dashboard
    const schoolData = await Schools.findById(schoolId)
      .populate("teachers")
      .populate({
        path: "classes",
        populate: {
          path: "classTeacher", // This field is inside the Class model
          model: "User", // Explicitly mention the model if needed
          select: "name profilePic", // Optional: only fetch specific fields like name and pic
        },
      });
    const activeTab = req.query.tab || "Dashboard";
    res.render("./school/Dashboard.ejs", {
      School: schoolData,
      activeTab, // Pass as a string
      currUser: req.user,
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
    const schoolId = req.user.instituition.school;

    let Teacher = await Users.findById(classTeacherId);
    if (!Teacher) {
      req.flash("error", "No such user exist");
      res.redirect("/school/tab='manageClasses'");
    }
    // 2. Create the new Class document
    const newClass = new Class({
      className: className,
      section: section,
      session: session,
      school: schoolId,
      classTeacher: classTeacherId || null, // Handle case where teacher isn't assigned yet
      students: [], // Starts empty
    });

    const newSpace = new LoopSpace({
      name: `${className}-${section} Loop Space`,
      description: `Loop Space for Class ${className}-${section}`,
      class: newClass._id,
      school: schoolId,
      category: "ClassRoom",
      admin: classTeacherId,
    });
    await newSpace.save();
    Teacher.designation = "classTeacher";
    Teacher.save();
    const savedClass = await newClass.save();

    await Schools.findByIdAndUpdate(schoolId, {
      $push: { classes: savedClass._id },
      $addToSet: { teachers: classTeacherId }, // Only adds the teacher if they aren't already listed
    });

    // 4. If a teacher was assigned, update that User's currentClass field
    if (classTeacherId) {
      await Users.findByIdAndUpdate(classTeacherId, {
        // Combined update object
        $set: { "instituition.class": savedClass._id },
        $addToSet: { "instituition.school": req.user.instituition.school },
      });
    }

    req.flash("success", `Class ${className}-${section} created successfully!`);

    // 5. Redirect back specifically to the ManageClasses tab
    res.redirect("/school?tab=ManageClasses");
  } catch (err) {
    console.error("Class Creation Error:", err);
    req.flash("error", "Failed to create class. Please try again.");
    res.redirect("/school?tab=ManageClasses");
  }
};
