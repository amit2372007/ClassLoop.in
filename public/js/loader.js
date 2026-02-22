// public/js/loader.js

const loader = document.getElementById("global-loader");

// ---------------------------------------------------
// 1. CORE LOADER FUNCTIONS
// ---------------------------------------------------

// Function to SHOW the loader
function showLoader() {
  if (!loader) return;
  loader.style.display = "flex";

  // A tiny timeout ensures the CSS transition works smoothly
  setTimeout(() => {
    loader.style.opacity = "1";
  }, 10);
}

// Function to HIDE the loader
function hideLoader() {
  if (!loader) return;
  loader.style.opacity = "0";

  // Wait for the fade out to finish before hiding it from the layout
  setTimeout(() => {
    loader.style.display = "none";
  }, 300);
}

// ---------------------------------------------------
// 2. AUTOMATIC TRIGGERS (PAGE LOAD & NAVIGATION)
// ---------------------------------------------------

// HIDE: As soon as the HTML is ready (Faster, doesn't wait for heavy images)
document.addEventListener("DOMContentLoaded", hideLoader);

// HIDE: When the page and all assets are fully loaded (Backup)
window.addEventListener("load", hideLoader);

// HIDE: The Ultimate Failsafe - Force hide after 5 seconds no matter what
setTimeout(() => {
  hideLoader();
}, 5000);

// SHOW: Right before the browser navigates away to another page
window.addEventListener("beforeunload", showLoader);

// HIDE: Fallback for Safari/iOS caching issues (when using the back button)
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    hideLoader();
  }
});

// ---------------------------------------------------
// 3. MANUAL TRIGGERS (AJAX / FETCH REQUESTS)
// ---------------------------------------------------

// Example: The function that runs when a user submits a picture on ClassLoop
async function handlePictureUpload(imageFile) {
  // 1. Show the loader immediately
  showLoader();

  try {
    // 2. Send the picture to your Node.js backend
    const formData = new FormData();
    formData.append("image", imageFile);

    const response = await fetch("/api/upload-post", {
      method: "POST",
      body: formData,
    });

    // Handle the backend response
    if (response.ok) {
      alert("Picture posted successfully!");
      // You can add the new post to the DOM here
    } else {
      alert("Failed to post picture.");
    }
  } catch (error) {
    console.error("Upload failed", error);
    alert("Something went wrong with the network.");
  } finally {
    // 3. Hide the loader whether the upload succeeded or failed
    hideLoader();
  }
}
