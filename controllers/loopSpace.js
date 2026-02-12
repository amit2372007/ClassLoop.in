const mongoose = require("mongoose");
//loopSpace
const LoopSpace = require("../model/loopSpace/loopSpace.js");
const SpaceMessage = require("../model/loopSpace/spaceMessage.js");

//DoubtBin models
const Doubts = require("../model/DoubtBin/doubt.js");
const Answers = require("../model/DoubtBin/answer.js");
// School model
const Schools = require("../model/school/school.js");
const Class = require("../model/school/classes.js");
const Notice = require("../model/school/notice.js");
const Attendance = require("../model/school/attendance.js");
const Form = require("../model/school/form.js");
const FormResponse = require("../model/school/formResponse.js");
const Assignment = require("../model/school/assignment.js");
const Resources = require("../model/school/resourse.js");
const Application = require("../model/school/application.js");
// Connection model

let Connection = require("../model/connection/connection.js");

const ImageKit = require("imagekit");

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

module.exports.indivLoopSpace = async (req, res) => {
  try {
    const { id } = req.params;
    const activeTab = req.query.tab || "Feed";
    const loopSpace = await LoopSpace.findById(id)
      .populate("class")
      .populate("admin", "name profilePic")
      .populate({
        path: "feed.itemRef",
      });

    if (!loopSpace) {
      req.flash("error", "No such LoopSpace exists");
      return res.redirect("/home");
    }

    if (loopSpace.feed && loopSpace.feed.length > 0) {
      loopSpace.feed.sort((a, b) => {
        const dateA = a.itemRef?.createdAt || 0;
        const dateB = b.itemRef?.createdAt || 0;
        return new Date(dateB) - new Date(dateA);
      });
    }

    // Fetch user's responses for this space to check submission status
    const userResponses = await mongoose
      .model("FormResponse")
      .find({
        student: req.user._id,
      })
      .select("form");

    const submittedFormIds = userResponses.map((r) => r.form.toString());

    const messages = await SpaceMessage.find({ loopSpace: id })
      .populate("sender", "name profilePic")
      .sort({ createdAt: 1 }); // Sort by time (oldest to newest)

    const classDoubts = await Doubts.find({
      author: { $in: loopSpace.members },
      isResolved: false,
    })
      .limit(3) // Only show the 10 most recent
      .populate("author", "name");
    const classId = loopSpace.class;
    const resources = await Resources.find({ class: classId })
      .populate("uploadedBy", "name profilePic") // This joins the User data
      .sort({ createdAt: -1 });

    const application = await Application.find({
      class: classId,
      student: req.user._id,
    }).sort({ createdAt: -1 });

    res.render("loopSpace/loopSpace.ejs", {
      loopSpace,
      currUser: req.user,
      activeTab,
      messages,
      submittedFormIds,
      classDoubts,
      resources,
      application,
    });
  } catch (err) {
    console.error("LoopSpace Route Error:", err);
    res.status(500).send("Internal Server Error");
  }
};

module.exports.uploadAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.redirect("back");

    // 1. Upload the file to ImageKit
    const ikResponse = await imagekit.upload({
      file: req.file.buffer,
      fileName: `SUB_${req.user.name}_${Date.now()}_${req.file.originalname}`,
      folder: "/classLoop_submittedAssignments", // Your project folder
    });

    // 2. Prepare submission data
    const newSubmission = {
      student: req.user._id,
      fileUrl: ikResponse.url,
      fileId: ikResponse.fileId, // Crucial for later deletion
      submittedAt: new Date(),
    };

    // 3. Update the Assignment document with the new submission
    await Assignment.findByIdAndUpdate(id, {
      $push: { submissions: newSubmission },
    });

    req.flash("success", "Assignment submitted successfully!");
    res.redirect(req.get("Referrer") || "/home");
  } catch (err) {
    console.error("Assignment Upload Error:", err);
    req.flash("error", "Upload failed. Please try again.");
    res.redirect(req.get("Referrer") || "/home");
  }
};

module.exports.renderFormSubmitPage = async (req, res) => {
  try {
    const { formId } = req.params;

    // Fetch form and populate creator info for the header
    const form = await Form.findById(formId).populate(
      "creator",
      "name profilePic",
    );

    if (!form) {
      req.flash("error", "Form not found!");
      return res.redirect("back");
    }

    // Check if form is still open
    if (!form.isOpen) {
      req.flash("error", "This form is no longer accepting responses.");
      return res.redirect("back");
    }

    res.render("loopSpace/viewForm.ejs", {
      form,
      currUser: req.user,
    });
  } catch (err) {
    console.error("Render Form Error:", err);
    res.status(500).send("Internal Server Error");
  }
};

module.exports.formSubmit = async (req, res) => {
  try {
    const { formId } = req.params;
    const { answers } = req.body; // Object where key = questionId

    // 1. Transform the answers object into an array for the schema
    // answers looks like: { "qID1": "Text Answer", "qID2": ["Option1", "Option2"] }
    const formattedAnswers = Object.keys(answers).map((qId) => ({
      questionId: qId,
      value: answers[qId],
    }));

    // 2. Create and save the response
    const newResponse = new FormResponse({
      form: formId,
      student: req.user._id,
      answers: formattedAnswers,
    });

    await newResponse.save();

    // 3. Optional: Add response reference to the original Form
    await Form.findByIdAndUpdate(formId, {
      $push: { responses: newResponse._id },
    });

    req.flash("success", "Your response has been submitted successfully!");
    res.redirect("/home");
  } catch (err) {
    console.error("Form Submission Error:", err);
    req.flash("error", "Something went wrong during submission.");
    res.redirect("back");
  }
};

module.exports.submitApplication = async (req, res) => {
  try {
    const { id } = req.params; // LoopSpace ID
    const { type, subject, fromDate, toDate, reason } = req.body;

    // 1. Find the LoopSpace to get the Class ID
    const loopSpace = await LoopSpace.findById(id).populate("class");
    if (!loopSpace) {
      req.flash("error", "LoopSpace not found.");
      return res.redirect("/home");
    }

    // 2. Create the Application
    const newApplication = new Application({
      student: req.user._id,
      class: loopSpace.class._id, // Auto-link to the class
      type: type,
      subject: subject,
      reason: reason,
      dateRange: {
        from: fromDate,
        to: toDate,
      },
      status: "Pending",
    });

    await newApplication.save();

    req.flash("success", "Application submitted successfully!");
    res.redirect(req.get("Referer") || "/"); // Redirect back to the tab
  } catch (err) {
    console.error("Application Error:", err);
    req.flash("error", "Failed to submit application.");
    res.redirect(req.get("Referer") || "/");
  }
};

module.exports.deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find the application first
    const application = await Application.findById(id);

    if (!application) {
      req.flash("error", "Application not found.");
      return res.redirect("back"); // Go back to where the user was
    }

    if (
      application.status === "approved" ||
      application.status === "rejected"
    ) {
      req.flash("error", "Application already responded to by Teacher");
      return res.redirect(req.get("Referer") || "/"); // Added 'return' to stop execution
    }
    // 2. Security Check: Ensure the logged-in user owns this application
    // We use .equals() because MongoDB ObjectIDs are objects, not strings
    if (!application.student.equals(req.user._id)) {
      req.flash("error", "You do not have permission to delete this.");
      return res.redirect("back");
    }

    // 3. Delete it
    await Application.findByIdAndDelete(id);

    req.flash("success", "Application deleted successfully.");
    res.redirect(req.get("Referer") || "/");
  } catch (err) {
    console.error("Delete Application Error:", err);
    req.flash("error", "Something went wrong.");
    res.redirect(req.get("Referer") || "/");
  }
};
