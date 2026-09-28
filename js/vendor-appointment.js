/**
 * Automatically applies dark/light theme based on system preference or saved preference.
 */
function initThemeLogic() {
  const savedTheme = localStorage.getItem("themeMode") || localStorage.getItem("glamora_theme") || "light";
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (savedTheme === "system" && systemPrefersDark)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const currentTheme = localStorage.getItem("themeMode") || localStorage.getItem("glamora_theme");
    if (currentTheme === "system") {
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

// TAB SWITCHING
function switchTab(type) {
  const aptTab = document.getElementById("tab-appointments");
  const ordTab = document.getElementById("tab-orders");
  const aptView = document.getElementById("appointments-view");
  const ordView = document.getElementById("orders-view");

  if (type === "appointments") {
    aptTab.className =
      "px-md py-xs rounded-full font-label-md text-label-md bg-surface-container-lowest dark:bg-neutral-800 text-primary dark:text-parchment-white shadow-sm transition-all flex items-center gap-xs";
    ordTab.className =
      "px-md py-xs rounded-full font-label-md text-label-md text-on-surface-variant dark:text-neutral-400 hover:text-primary dark:hover:text-parchment-white transition-all flex items-center gap-xs";
    aptView.classList.remove("hidden");
    ordView.classList.add("hidden");
  } else {
    ordTab.className =
      "px-md py-xs rounded-full font-label-md text-label-md bg-surface-container-lowest dark:bg-neutral-800 text-primary dark:text-parchment-white shadow-sm transition-all flex items-center gap-xs";
    aptTab.className =
      "px-md py-xs rounded-full font-label-md text-label-md text-on-surface-variant dark:text-neutral-400 hover:text-primary dark:hover:text-parchment-white transition-all flex items-center gap-xs";
    ordView.classList.remove("hidden");
    aptView.classList.add("hidden");
  }
}

// EXPANDABLE FILTER BAR TOGGLE
function toggleFilterBar() {
  const panel = document.getElementById("advancedFilterPanel");
  if (panel) {
    panel.classList.toggle("hidden");
  }
}

// QUICK CHIP FILTERING
function applyFilter(status, element) {
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.className =
      "filter-chip px-sm py-xs rounded-full font-label-sm text-label-sm bg-surface-container-low dark:bg-neutral-800 text-on-surface-variant dark:text-neutral-400 hover:bg-surface-container-high hover:text-primary transition-colors flex items-center gap-xs";
  });
  if (element) {
    element.className =
      "filter-chip px-sm py-xs rounded-full font-label-sm text-label-sm bg-primary text-on-primary dark:bg-parchment-white dark:text-charcoal font-semibold transition-colors flex items-center gap-xs";
  }

  const cards = document.querySelectorAll(".appointment-card, .order-card");
  cards.forEach((card) => {
    if (status === "all" || card.dataset.status === status) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

// ADVANCED PANEL FILTERS
function applyAdvancedFilters() {
  const statusVal = document.getElementById("filterStatusSelect").value;
  const cards = document.querySelectorAll(".appointment-card, .order-card");
  cards.forEach((card) => {
    if (statusVal === "all" || card.dataset.status === statusVal) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
  showToast("Filter settings applied", "info");
}

function resetFilters() {
  document.getElementById("filterStatusSelect").value = "all";
  document.getElementById("filterSortSelect").value = "newest";
  document.getElementById("filterDateInput").value = "";
  applyFilter("all", document.querySelector(".filter-chip"));
  showToast("Filters reset to default", "info");
}

// SEARCH FILTERING
function handleSearch(query) {
  const q = query.toLowerCase().trim();
  const cards = document.querySelectorAll(".appointment-card, .order-card");
  cards.forEach((card) => {
    const searchData = card.dataset.search || "";
    if (!q || searchData.toLowerCase().includes(q)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

// SIMULATE MARK COMPLETED
function simulateComplete(button, ref, amount) {
  button.disabled = true;
  button.innerHTML =
    '<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Releasing...';
  setTimeout(() => {
    button.className =
      "px-md py-sm rounded-lg bg-secondary-container dark:bg-emerald-950 text-on-secondary-container dark:text-emerald-300 flex items-center gap-xs font-label-md text-label-md";
    button.innerHTML =
      '<span class="material-symbols-outlined text-[18px]">verified</span> Payout Settled';
    showToast(`Session ${ref} complete. Funds disbursed to wallet!`, "success");
  }, 900);
}

// CANCEL APPOINTMENT MODAL CONTROLLER
let activeCancelButton = null;

function openCancelModal(button, clientName = "") {
  activeCancelButton = button;
  const modalText = document.getElementById("cancelModalText");
  if (modalText) {
    modalText.innerText = clientName
      ? `Are you sure you want to cancel the scheduled session slot for ${clientName}?`
      : "Are you sure you want to cancel this appointment slot? This action cannot be undone.";
  }
  openModal("cancelSlotModal");
}

function confirmCancelSlot() {
  if (activeCancelButton) {
    const card = activeCancelButton.closest(".appointment-card");
    if (card) {
      card.style.opacity = "0.45";
      activeCancelButton.disabled = true;
      activeCancelButton.innerText = "Cancelled";
      card.dataset.status = "cancelled";
    }
  }
  closeModal("cancelSlotModal");
  showToast("Appointment slot cancelled successfully", "info");
}

// SEND REMINDER
function sendReminder(clientName) {
  showToast(`Deposit payment reminder dispatched to ${clientName}`, "success");
}

// SIMULATE DISPATCH
function simulateDispatch(button, orderId) {
  button.disabled = true;
  button.innerHTML =
    '<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Dispatching...';
  setTimeout(() => {
    button.className =
      "px-md py-sm rounded-lg bg-surface-container dark:bg-neutral-800 text-on-surface-variant dark:text-neutral-400 flex items-center gap-xs font-label-md text-label-md";
    button.innerHTML =
      '<span class="material-symbols-outlined text-[18px]">check</span> Dispatched';
    showToast(`Order ${orderId} marked as dispatched to courier`, "success");
  }, 800);
}

// PRINT SHIPPING LABEL
function printShippingLabel(orderId) {
  showToast(`Preparing shipping manifest label for ${orderId}...`, "info");
}

// TRACK TRANSIT
function trackTransit(trackingId) {
  showToast(`Opening courier tracking for ${trackingId}...`, "info");
}

// MODAL CONTROLLERS
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("hidden");
}

let currentRescheduleClient = "";
function openRescheduleModal(clientName, currentSlot) {
  currentRescheduleClient = clientName;
  document.getElementById("rescheduleClientText").innerText =
    `Adjusting schedule slot for ${clientName} (Currently: ${currentSlot}).`;
  openModal("rescheduleModal");
}

function handleRescheduleSubmit(e) {
  e.preventDefault();
  closeModal("rescheduleModal");
  showToast(`Updated schedule sent to ${currentRescheduleClient}`, "success");
}

function openReceiptModal(client, ref, amount) {
  document.getElementById("receiptClient").innerText = client;
  document.getElementById("receiptRef").innerText = `#${ref}`;
  document.getElementById("receiptAmount").innerText = amount;
  openModal("receiptModal");
}

function handleManualBookingSubmit(e) {
  e.preventDefault();
  const client = document.getElementById("manualClientInput").value;
  closeModal("manualBookingModal");
  document.getElementById("manualBookingForm").reset();
  showToast(`Manual session created for ${client}`, "success");
}

// DYNAMIC CSV LEDGER EXPORT
function exportLedger() {
  const rows = [["Record Type", "Reference ID", "Client / Customer", "Details / Service", "Amount", "Status"]];

  // Extract Appointments
  document.querySelectorAll(".appointment-card").forEach((card) => {
    const client = card.querySelector(".font-headline-md")?.innerText.trim() || "";
    const refMatch = card.innerText.match(/Ref:\s*#?([A-Z0-9-]+)/i);
    const ref = refMatch ? refMatch[1] : "";
    const service = card.querySelector(".font-semibold")?.innerText.trim() || "";
    const status = card.getAttribute("data-status") || "";
    const amount = card.querySelector(".font-label-md")?.innerText.trim() || "";
    rows.push(["Appointment", ref, client, service, amount, status]);
  });

  // Extract Product Orders
  document.querySelectorAll(".order-card").forEach((card) => {
    const orderTitle = card.querySelector(".font-headline-md")?.innerText.trim() || "";
    const orderId = orderTitle.replace("Order #", "").trim();
    const clientMatch = card.innerText.match(/Customer:\s*([^\n•]+)/i);
    const client = clientMatch ? clientMatch[1].trim() : "";
    const item = card.querySelector(".font-semibold")?.innerText.trim() || "";
    const status = card.getAttribute("data-status") || "";
    const amount = card.querySelector(".font-label-md")?.innerText.trim() || "";
    rows.push(["Product Order", orderId, client, item, amount, status]);
  });

  const csvContent = rows
    .map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `glamora_ledger_export_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast("Ledger CSV statement exported successfully", "success");
}

// MOBILE DRAWER
function toggleMobileDrawer() {
  const drawer = document.getElementById("mobileDrawer");
  if (drawer) drawer.classList.toggle("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeLogic();
  loadVendorAppointments();
});

async function loadVendorAppointments() {
  const token = localStorage.getItem("glamoraToken");
  let user;
  try {
    user = JSON.parse(localStorage.getItem("glamoraUser") || "null");
  } catch {
    user = null;
  }
  const appointmentsView = document.getElementById("appointments-view");
  if (!token || !user) {
    sessionStorage.setItem("glamoraReturnTo", "vendor-appointments.html");
    window.location.href = "Auth/login.html";
    return;
  }
  if (String(user.role || "").toUpperCase() !== "VENDOR") {
    window.location.href = "customer-dashboard.html";
    return;
  }
  if (!appointmentsView) return;

  try {
    const response = await fetch("http://localhost:3000/api/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not load appointments.");

    appointmentsView.replaceChildren();
    const appointments = data.appointments || [];
    appointments.forEach((appointment) => appointmentsView.append(createVendorAppointmentCard(appointment)));
    const upcomingCount = appointments.filter((appointment) => ["CONFIRMED", "CHECKED_IN"].includes(appointment.status)).length;
    const pendingAppointments = appointments.filter((appointment) => appointment.status === "PENDING_PAYMENT");
    const actionCount = pendingAppointments.length;
    const today = new Date();
    const todayCount = appointments.filter((appointment) =>
      !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status) &&
      new Date(appointment.startAt).toDateString() === today.toDateString()
    ).length;
    const confirmedCount = appointments.filter((appointment) => ["CONFIRMED", "CHECKED_IN"].includes(appointment.status)).length;
    const pendingAmount = pendingAppointments.reduce(
      (total, appointment) => total + appointment.depositKobo + appointment.vatKobo + appointment.logisticsFeeKobo,
      0,
    );
    const formatNaira = (kobo) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
    document.getElementById("badge-appointments-count").textContent = appointments.length;
    document.getElementById("kpi-today-count").textContent = todayCount;
    document.getElementById("kpi-confirmed-count").textContent = `${confirmedCount} confirmed`;
    document.getElementById("kpi-pending-amount").textContent = formatNaira(pendingAmount);
    document.getElementById("kpi-pending-count").textContent = `${actionCount} appointment${actionCount === 1 ? "" : "s"}`;
    const upcomingChip = document.querySelector('.filter-chip[onclick*="upcoming"]');
    if (upcomingChip) upcomingChip.textContent = `Upcoming (${upcomingCount})`;
    const actionChip = document.querySelector('.filter-chip[onclick*="action"]');
    if (actionChip) {
      const label = actionChip.querySelector("span");
      if (label) label.textContent = `Requires Action (${actionCount})`;
    }
    applyFilter("all", document.querySelector('.filter-chip[onclick*="all"]'));
  } catch (error) {
    appointmentsView.replaceChildren();
    const message = document.createElement("p");
    message.className = "py-lg text-center text-error";
    message.textContent = error.message || "Could not load appointments.";
    appointmentsView.append(message);
    showToast(error.message || "Could not load pending appointments.", "error");
  }
}

function createVendorAppointmentCard(appointment) {
  const pending = appointment.status === "PENDING_PAYMENT";
  const completed = appointment.status === "COMPLETED";
  const cancelled = ["CANCELLED", "NO_SHOW"].includes(appointment.status);
  const status = pending ? "action" : completed ? "completed" : cancelled ? "cancelled" : "upcoming";
  const statusLabel = pending ? "Pending deposit" : completed ? "Completed" : cancelled ? appointment.status.replace("_", " ") : appointment.status === "CHECKED_IN" ? "Checked in" : "Confirmed";
  const serviceNames = (appointment.services || []).map((service) => service.serviceName).join(", ") || "Appointment";
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const formatDate = (date) => date.toLocaleString("en-NG", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const formatNaira = (kobo) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
  const upfrontKobo = appointment.depositKobo + appointment.vatKobo + appointment.logisticsFeeKobo;
  const card = document.createElement("article");
  card.className = "appointment-card bg-surface-container-lowest dark:bg-neutral-900 border border-soft-border dark:border-neutral-800 rounded-xl p-md shadow-sm relative overflow-hidden";
  card.dataset.status = status;
  card.dataset.search = `${appointment.customer?.name || ""} ${serviceNames} ${appointment.id}`.toLowerCase();

  const accent = document.createElement("div");
  accent.className = `absolute left-0 top-0 bottom-0 w-1.5 ${pending ? "bg-muted-terracotta" : completed ? "bg-sage" : cancelled ? "bg-outline-variant" : "bg-primary"}`;
  const row = document.createElement("div");
  row.className = "flex flex-col lg:flex-row lg:items-center justify-between gap-md pl-xs";
  const details = document.createElement("div");
  details.className = "flex flex-col gap-xs min-w-0";
  const heading = document.createElement("div");
  heading.className = "flex items-center gap-sm flex-wrap";
  const client = document.createElement("strong");
  client.className = "font-headline-md text-headline-md text-primary dark:text-parchment-white";
  client.textContent = appointment.customer?.name || "Customer";
  const badge = document.createElement("span");
  badge.className = `px-sm py-[2px] rounded-full font-label-sm text-label-sm ${pending ? "bg-error-container dark:bg-red-950 text-on-error-container dark:text-red-300" : "bg-surface-container-high dark:bg-neutral-800 text-on-surface-variant dark:text-neutral-300"}`;
  badge.textContent = statusLabel;
  heading.append(client, badge);

  const schedule = document.createElement("span");
  schedule.className = "font-body-sm text-body-sm text-on-surface-variant dark:text-neutral-400";
  schedule.textContent = `${formatDate(start)} - ${end.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}`;
  const service = document.createElement("span");
  service.className = "font-label-md text-label-md text-primary dark:text-parchment-white";
  service.textContent = serviceNames;
  const mode = document.createElement("span");
  mode.className = "font-body-sm text-body-sm text-on-surface-variant dark:text-neutral-400";
  mode.textContent = `${appointment.deliveryMode === "HOME_SERVICE" ? "Home service" : "Studio walk-in"} · Ref ${appointment.id.slice(0, 8)}`;
  details.append(heading, schedule, service, mode);

  if (pending) {
    const due = document.createElement("span");
    due.className = "font-label-sm text-label-sm text-muted-terracotta";
    due.textContent = `Deposit outstanding: ${formatNaira(upfrontKobo)} (${appointment.depositPercent}% breakage + VAT${appointment.logisticsFeeKobo ? " + logistics" : ""})`;
    details.append(due);
  }

  const actions = document.createElement("div");
  actions.className = "flex items-center gap-sm shrink-0";
  if (pending) {
    const release = document.createElement("button");
    release.type = "button";
    release.className = "px-sm py-xs rounded-lg text-error hover:bg-error-container/40 transition-colors font-label-md text-label-md";
    release.textContent = "Release slot";
    release.addEventListener("click", () => updateVendorAppointment(appointment.id, "cancel", release));
    actions.append(release);
  } else if (!completed && !cancelled) {
    const complete = document.createElement("button");
    complete.type = "button";
    complete.className = "px-sm py-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-md text-label-md";
    complete.textContent = "Mark completed";
    complete.addEventListener("click", () => updateVendorAppointment(appointment.id, "complete", complete));
    actions.append(complete);
  }

  row.append(details, actions);
  card.append(accent, row);
  return card;
}

async function updateVendorAppointment(appointmentId, action, button) {
  const pending = action === "cancel";
  const confirmation = pending
    ? "Release this unpaid appointment slot? The customer will need to book again."
    : "Mark this appointment as completed?";
  if (!window.confirm(confirmation)) return;
  const token = localStorage.getItem("glamoraToken");
  button.disabled = true;
  try {
    const endpoint = pending ? "cancel" : "complete";
    const response = await fetch(`http://localhost:3000/api/appointments/${appointmentId}/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not update appointment.");
    showToast(pending ? "Pending appointment cancelled and slot released." : "Appointment marked as completed.", "success");
    await loadVendorAppointments();
  } catch (error) {
    button.disabled = false;
    showToast(error.message || "Could not update appointment.", "error");
  }
}

// TOAST SYSTEM
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className =
    "pointer-events-auto flex items-center gap-xs px-md py-sm rounded-xl bg-charcoal text-parchment-white shadow-xl text-body-sm transition-all duration-300 transform translate-y-2 opacity-0";

  let icon = "info";
  if (type === "success") icon = "check_circle";
  if (type === "error") icon = "error";

  toast.innerHTML = `<span class="material-symbols-outlined text-[18px]">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  }, 10);

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}