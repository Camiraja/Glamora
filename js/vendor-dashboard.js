/**
 * GLAMORA - Vendor Dashboard Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  initThemeLogic();
});

/**
 * Automatically applies dark/light theme based on system preference or saved preference.
 */
function initThemeLogic() {
  const savedTheme = localStorage.getItem("glamora_theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("glamora_theme")) {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  });
}

/**
 * Switch role logic between Vendor and Customer dashboard.
 */
function switchRole(role) {
  if (role === 'customer') {
    window.location.href = 'vendor customer dashboard.html';
  } else if (role === 'vendor') {
    console.log("Already on Vendor Dashboard");
  }
}

/**
 * Mobile Sidebar Drawer Navigation Toggle
 */
function toggleMobileSidebar() {
  const sidebar = document.getElementById("mobile-sidebar");
  if (sidebar) {
    sidebar.classList.toggle("hidden");
  }
}

/**
 * Modal Visibility Management
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
  }
}

/**
 * Handle Manual Booking Submission
 */
function handleManualBookingSubmit(event) {
  event.preventDefault();
  alert("Manual booking successfully added to your schedule!");
  closeModal('manualBookingModal');
}

/**
 * Handle Loading More History / Activity
 * Now transitions into a greyed-out disabled button matching the UI screenshot.
 */
function loadMoreActivity(event) {
  event.preventDefault();
  
  const hiddenActivities = document.getElementById("hiddenActivities");
  const loadMoreBtn = document.getElementById("loadMoreHistoryBtn");
  const connectingLine = document.getElementById("activity3-line");
  
  if (hiddenActivities) {
    // Reveal hidden activities
    hiddenActivities.classList.remove("hidden");
    hiddenActivities.classList.add("flex");
    
    // Connect activity line visually
    if (connectingLine) {
      connectingLine.classList.remove("hidden");
    }
    
    // Transition button to disabled "All History Loaded" pill style
    if (loadMoreBtn) {
      loadMoreBtn.innerText = "All History Loaded";
      loadMoreBtn.disabled = true;
      loadMoreBtn.className = "px-6 py-2 border border-soft-border bg-surface-container-low text-outline rounded-full font-label-md text-label-md cursor-not-allowed opacity-70 transition-all";
    }
  }
}