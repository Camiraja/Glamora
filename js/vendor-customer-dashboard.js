/**
 * GLAMORA - Vendor Customer Dashboard Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  initThemeLogic();
  initTooltips();
  initGlobalClickListener();
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
  if (role === 'vendor') {
    window.location.href = 'vendor-dashboard.html';
  } else if (role === 'customer') {
    console.log("Already on Customer Dashboard");
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
 * Toggle Appointment "Manage" Dropdown Menu
 */
function toggleManageDropdown(dropdownId) {
  const dropdowns = document.querySelectorAll('[id^="dropdown-"]');
  dropdowns.forEach((dd) => {
    if (dd.id !== dropdownId) {
      dd.classList.add("hidden");
    }
  });

  const targetDropdown = document.getElementById(dropdownId);
  if (targetDropdown) {
    targetDropdown.classList.toggle("hidden");
  }
}

/**
 * Modal Visibility Management
 */
function openModal(modalId) {
  document.querySelectorAll('[id^="dropdown-"]').forEach((dd) => dd.classList.add("hidden"));

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
 * Pay Deposit Flow
 */
function confirmPayDeposit() {
  alert("Deposit payment successful! Your appointment is now confirmed.");
  closeModal("depositModal");
}

/**
 * Report & Block Actions
 */
function proceedToReportDetails() {
  closeModal("reportConfirmModal");
  openModal("reportDetailModal");
}

function submitReport(event) {
  event.preventDefault();
  alert("Your report has been submitted successfully. Our team will review it shortly.");
  closeModal("reportDetailModal");
}

function confirmBlockUser() {
  alert("User has been blocked.");
  closeModal("blockConfirmModal");
}

/**
 * Appointment cancellation logic
 */
function handleCancelAppointment(isWithin30Mins) {
  if (isWithin30Mins) {
    alert("You cannot cancel an appointment within 30 minutes of the scheduled time.");
    return;
  }

  if (confirm("Are you sure you want to cancel this appointment?")) {
    alert("Appointment cancelled successfully.");
    document.querySelectorAll('[id^="dropdown-"]').forEach((dd) => dd.classList.add("hidden"));
  }
}

/**
 * Tooltip logic
 */
function initTooltips() {
  const tooltips = document.querySelectorAll(".tooltip");
  tooltips.forEach((btn) => {
    btn.addEventListener("mouseenter", (e) => {
      const label = e.currentTarget.getAttribute("aria-label");
      if (!label) return;

      const tooltipEl = document.createElement("div");
      tooltipEl.className =
        "absolute -top-10 left-1/2 transform -translate-x-1/2 bg-charcoal text-on-primary font-label-sm text-xs px-3 py-1 rounded whitespace-nowrap opacity-0 transition-opacity duration-200 pointer-events-none z-50 shadow-md";
      tooltipEl.innerText = label;
      tooltipEl.id = "temp-tooltip";

      e.currentTarget.style.position = "relative";
      e.currentTarget.appendChild(tooltipEl);

      requestAnimationFrame(() => {
        tooltipEl.style.opacity = "1";
      });
    });

    btn.addEventListener("mouseleave", (e) => {
      const tooltipEl = e.currentTarget.querySelector("#temp-tooltip");
      if (tooltipEl) {
        tooltipEl.style.opacity = "0";
        setTimeout(() => tooltipEl.remove(), 200);
      }
    });
  });
}

/**
 * Global Outside Click Listener to close dropdowns
 */
function initGlobalClickListener() {
  document.addEventListener("click", (e) => {
    const isDropdownButton = e.target.closest('button[onclick*="toggleManageDropdown"]');
    const isInsideDropdown = e.target.closest('[id^="dropdown-"]');

    if (!isDropdownButton && !isInsideDropdown) {
      document.querySelectorAll('[id^="dropdown-"]').forEach((dd) => dd.classList.add("hidden"));
    }
  });
}