// --- Theme Logic ---

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderFeed();
});

function initTheme() {
  // Check localStorage for a globally set theme, default to 'light'
  const savedTheme = localStorage.getItem("themeMode") || "light"; 
  applyTheme(savedTheme);

  // Still react appropriately if set to system preferences
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (localStorage.getItem("themeMode") === "system") {
      applyTheme("system");
    }
  });
}

function applyTheme(mode) {
  const html = document.documentElement;
  let isDark = false;

  if (mode === "dark") {
    isDark = true;
  } else if (mode === "system") {
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  if (isDark) {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

// --- Notifications Dataset & Interactivity ---

let notifications = [
  {
    id: "ntf_1",
    section: "Today",
    isUnread: true,
    isImportant: true,
    type: "action",
    title: "Reschedule Request",
    message: "Studio A has requested to move your Architectural Brow Sculpting appointment from 2:00 PM to 3:30 PM today due to an unexpected scheduling conflict.",
    time: "14 mins ago",
    badgeText: "Action Required",
    badgeStyle: "text-muted-terracotta bg-tertiary-fixed/30 dark:bg-tertiary-fixed/10",
    icon: "edit_calendar",
    hasActions: true,
    status: null 
  },
  {
    id: "ntf_2",
    section: "Today",
    isUnread: true,
    isImportant: false,
    type: "message",
    title: "Mila at Minimalist Esthetics",
    message: '"Hi! Just a quick reminder to avoid any active retinoids for 48 hours prior to your chemical peel session tomorrow. See you at 10 AM."',
    time: "2 hours ago",
    badgeText: "Direct Message",
    badgeStyle: "text-primary dark:text-parchment-white",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCw6ikctDQu7Ds4T5l4YKR44gXCVY6qXlIAx8WqBxQgiVRafkdlkK4sUPREerY1yCGcUqasdNPCQkA_h8pQEuBW_7w4uvSbgPFSxOgC4yEZefTzWh10J30JIDtfSONM9GF3B2NfDmsFcigwKAZ7J4douMHIRIYYII6PCb7zkFa29vB9IJu8MDloNwUbyeHm4zyrM3cJHoyThG43Iy4OyeExgVraUhlgWkZHXzYqvHOVNRcr1LdkoOAx"
  },
  {
    id: "ntf_3",
    section: "Yesterday",
    isUnread: false,
    isImportant: false,
    type: "receipt",
    title: "Receipt: Structural Balayage",
    message: "Payment of $240.00 to Atelier Hair has been processed successfully. Your digital receipt is available.",
    time: "Oct 24, 4:15 PM",
    badgeText: "Payment Successful",
    badgeStyle: "text-sage dark:text-sage",
    icon: "receipt_long",
    hasDownload: true
  },
  {
    id: "ntf_4",
    section: "Yesterday",
    isUnread: false,
    isImportant: true,
    type: "system",
    title: "Profile Verification Complete",
    message: "Your professional credentials have been verified. You now have full access to premium booking features.",
    time: "Oct 23, 9:00 AM",
    badgeText: "System Update",
    badgeStyle: "text-on-surface-variant dark:text-outline-variant",
    icon: "verified_user"
  }
];

const earlierNotifications = [
  {
    id: "ntf_5",
    section: "Earlier",
    isUnread: false,
    isImportant: false,
    type: "booking",
    title: "Booking Confirmed: Lash Lamination",
    message: "Your appointment with Adesuwa Balogun for Signature Lash Lift & Lamination is confirmed for Friday at 11:00 AM.",
    time: "Oct 19, 2:30 PM",
    badgeText: "Booking Confirmed",
    badgeStyle: "text-success-green dark:text-success-green",
    icon: "event_available"
  },
  {
    id: "ntf_6",
    section: "Earlier",
    isUnread: false,
    isImportant: true,
    type: "reminder",
    title: "Leave a Review for Glow Lab",
    message: "How was your Dermal Resurfacing treatment? Share your experience to earn 50 Glamora Rewards points.",
    time: "Oct 15, 6:00 PM",
    badgeText: "Review Request",
    badgeStyle: "text-warning-amber dark:text-warning-amber",
    icon: "star"
  }
];

let currentFilter = "all";
let earlierLoaded = false;

function setFilter(filter) {
  currentFilter = filter;
  
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("bg-surface-container-highest", "dark:bg-primary-container", "text-on-surface", "dark:text-parchment-white", "shadow-sm");
    btn.classList.add("text-on-surface-variant", "dark:text-outline-variant");
  });

  const activeBtn = document.getElementById(`filter-${filter}`);
  if (activeBtn) {
    activeBtn.classList.add("bg-surface-container-highest", "dark:bg-primary-container", "text-on-surface", "dark:text-parchment-white", "shadow-sm");
    activeBtn.classList.remove("text-on-surface-variant", "dark:text-outline-variant");
  }

  renderFeed();
}

function renderFeed() {
  const container = document.getElementById("notifications-container");
  if (!container) return;

  let filtered = notifications.filter((ntf) => {
    if (currentFilter === "unread") return ntf.isUnread;
    if (currentFilter === "important") return ntf.isImportant;
    return true; 
  });

  updateBadges();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-xl flex flex-col items-center justify-center text-center gap-sm bg-surface-container-low dark:bg-primary-container/40 rounded-2xl p-lg border border-soft-border dark:border-outline-variant/20 transition-colors">
        <span class="material-symbols-outlined text-headline-xl text-outline-variant dark:text-outline-variant/50">inbox</span>
        <h3 class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white">No notifications found</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant">There are no ${currentFilter} updates to display right now.</p>
      </div>
    `;
    return;
  }

  const sections = {};
  filtered.forEach((item) => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  let html = "";
  for (const [sectionTitle, items] of Object.entries(sections)) {
    html += `
      <div class="flex items-center gap-md mb-xs mt-md first:mt-0">
        <span class="font-label-sm text-label-sm text-on-surface-variant dark:text-outline-variant uppercase tracking-widest">${sectionTitle}</span>
        <div class="flex-1 h-[1px] bg-surface-container-high dark:bg-outline-variant/20 transition-colors"></div>
      </div>
    `;

    items.forEach((item) => {
      html += createNotificationCard(item);
    });
  }

  container.innerHTML = html;
}

function createNotificationCard(item) {
  const isProcessed = item.status === "accepted" || item.status === "declined";

  const unreadIndicator = item.isUnread
    ? `<div class="absolute top-md right-md w-2.5 h-2.5 rounded-full bg-primary dark:bg-parchment-white z-10"></div>`
    : "";

  const borderAccent = item.isUnread && item.isImportant
    ? `<div class="absolute left-0 top-0 bottom-0 w-1 bg-muted-terracotta dark:bg-muted-terracotta"></div>`
    : "";

  // Card background and greyed-out state visual styling
  let cardBg = item.isUnread
    ? "bg-surface-container-highest dark:bg-primary-container shadow-md"
    : "bg-surface-container dark:bg-surface-container-high/40 shadow-sm border border-soft-border/50 dark:border-outline-variant/10";

  if (isProcessed) {
    cardBg += " opacity-65 grayscale-[30%]";
  }

  let iconContent = "";
  if (item.avatar) {
    iconContent = `
      <div class="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-sm bg-surface-dim dark:bg-primary-container relative z-10">
        <img class="w-full h-full object-cover" src="${item.avatar}" alt="${item.title}" />
      </div>`;
  } else {
    iconContent = `
      <div class="w-12 h-12 rounded-full bg-surface dark:bg-charcoal flex items-center justify-center shrink-0 shadow-sm text-muted-terracotta z-10 transition-colors">
        <span class="material-symbols-outlined">${item.icon || "notifications"}</span>
      </div>`;
  }

  // Handle action buttons vs accepted/declined badges
  let actionButtons = "";
  if (item.hasActions) {
    if (item.status === "accepted") {
      actionButtons = `
        <div class="flex shrink-0 items-center justify-center mt-sm sm:mt-0 z-10 w-full sm:w-auto">
          <span class="px-md py-sm bg-surface-container-high dark:bg-charcoal text-outline dark:text-outline-variant font-label-md text-label-md rounded-lg flex items-center gap-xs cursor-default select-none border border-soft-border dark:border-outline-variant/20">
            <span class="material-symbols-outlined text-base">check_circle</span> Accepted
          </span>
        </div>`;
    } else if (item.status === "declined") {
      actionButtons = `
        <div class="flex shrink-0 items-center justify-center mt-sm sm:mt-0 z-10 w-full sm:w-auto">
          <span class="px-md py-sm bg-surface-container-high dark:bg-charcoal text-outline dark:text-outline-variant font-label-md text-label-md rounded-lg flex items-center gap-xs cursor-default select-none border border-soft-border dark:border-outline-variant/20">
            <span class="material-symbols-outlined text-base">cancel</span> Declined
          </span>
        </div>`;
    } else {
      actionButtons = `
        <div class="flex sm:flex-col gap-sm shrink-0 items-center sm:items-end justify-center mt-sm sm:mt-0 z-10 w-full sm:w-auto">
          <button onclick="handleAction(event, '${item.id}', 'accepted')" class="px-lg py-sm bg-charcoal dark:bg-parchment-white text-on-primary dark:text-charcoal font-label-md text-label-md rounded-lg shadow-md hover:bg-primary-container dark:hover:bg-primary-fixed transition-colors w-full sm:w-auto">Accept</button>
          <button onclick="handleAction(event, '${item.id}', 'declined')" class="px-lg py-sm bg-transparent text-charcoal dark:text-parchment-white font-label-md text-label-md rounded-lg hover:bg-surface dark:hover:bg-surface-container shadow-sm transition-colors w-full sm:w-auto">Decline</button>
        </div>`;
    }
  } else if (item.hasDownload) {
    actionButtons = `
      <div class="flex shrink-0 items-center justify-center mt-sm sm:mt-0 z-10">
        <button onclick="showToast('Receipt downloaded successfully'); event.stopPropagation();" class="p-2 text-on-surface-variant dark:text-outline-variant hover:text-charcoal dark:hover:text-parchment-white hover:bg-surface dark:hover:bg-primary-container rounded-lg transition-colors shadow-sm flex items-center gap-2" title="Download Receipt">
          <span class="material-symbols-outlined">download</span>
        </button>
      </div>`;
  }

  return `
    <div id="card-${item.id}" onclick="markAsRead('${item.id}')" class="relative ${cardBg} rounded-xl p-md flex flex-col sm:flex-row gap-md overflow-hidden group hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
      ${borderAccent}
      ${unreadIndicator}
      ${iconContent}
      <div class="flex-1 flex flex-col gap-xs z-10 pr-md">
        <div class="flex flex-wrap items-center justify-between gap-sm mb-1">
          <span class="font-label-sm text-label-sm uppercase tracking-wider px-2 py-0.5 rounded-md ${item.badgeStyle}">${item.badgeText}</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant dark:text-outline-variant flex items-center gap-1 transition-colors">
            <span class="material-symbols-outlined text-[14px]">schedule</span> ${item.time}
          </span>
        </div>
        <h3 class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white transition-colors">${item.title}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant line-clamp-2 transition-colors">${item.message}</p>
      </div>
      ${actionButtons}
    </div>
  `;
}

function markAsRead(id) {
  const item = notifications.find((n) => n.id === id);
  if (item && item.isUnread) {
    item.isUnread = false;
    renderFeed();
  }
}

function handleAction(event, id, action) {
  event.stopPropagation();
  const item = notifications.find((n) => n.id === id);
  if (item) {
    item.isUnread = false; 
    item.status = action; 
    renderFeed();
    showToast(`${action === "accepted" ? "Accepted" : "Declined"}: ${item.title}`);
  }
}

function updateBadges() {
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => n.isUnread).length;
  const importantCount = notifications.filter((n) => n.isImportant).length;

  const badgeAll = document.getElementById("badge-all");
  const badgeUnread = document.getElementById("badge-unread");
  const badgeImportant = document.getElementById("badge-important");
  const navDot = document.getElementById("nav-notification-dot");

  if (badgeAll) badgeAll.textContent = totalCount;
  if (badgeUnread) badgeUnread.textContent = unreadCount;
  if (badgeImportant) badgeImportant.textContent = importantCount;

  if (navDot) {
    navDot.style.display = unreadCount > 0 ? "block" : "none";
  }
}

function loadEarlierHistory() {
  if (earlierLoaded) return;

  notifications = notifications.concat(earlierNotifications);
  earlierLoaded = true;

  renderFeed();

  const loadBtnText = document.getElementById("load-btn-text");
  const loadBtn = document.getElementById("load-earlier-btn");

  if (loadBtnText) loadBtnText.textContent = "All History Loaded";
  if (loadBtn) {
    loadBtn.disabled = true;
    loadBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  showToast("Loaded earlier notification history");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-charcoal dark:bg-parchment-white text-on-primary dark:text-charcoal px-lg py-sm rounded-full shadow-2xl z-[100] font-label-md transition-all duration-300 flex items-center gap-xs opacity-0";
  toast.innerHTML = `<span class="material-symbols-outlined text-sm">check_circle</span> ${message}`;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, -10px)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, 10px)";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}