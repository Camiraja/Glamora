/**
 * GLAMORA - Vendor Schedule & Availability Logic
 */

/* ====================================================
   State Management & Real-time Calendar Logic
==================================================== */
let currentDate = new Date();
let currentView = 'Week'; // Can be 'Day', 'Week', 'Month'
let currentBufferTime = 15;
let eventsData = [];

document.addEventListener("DOMContentLoaded", () => {
  initThemeLogic();
  initGuardrailControls();
  
  // Prepopulate with original static data so calendar isn't empty initially
  populateInitialDummyData();
  
  updateCalendarDisplay(); 
});

/**
 * Pre-populate initial dummy data relative to the current week
 * This mirrors the exact schedule you had in your hardcoded HTML 
 * but attaches them to actual Date objects so they render correctly.
 */
function populateInitialDummyData() {
  let startOfWeek = new Date(currentDate);
  let day = startOfWeek.getDay();
  let diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  
  function getD(offset) {
    let d = new Date(startOfWeek);
    d.setDate(d.getDate() + offset);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  }
  
  eventsData = [
    { id: '1', type: 'block', title: 'Morning Prep', date: getD(1), hour: 9, timeStr: '9:00 AM' },
    { id: '2', type: 'booking', title: 'Brow Lamination', client: 'Elena R.', date: getD(2), hour: 9, timeStr: '9:00 AM' },
    { id: '3', type: 'booking', title: 'Lash Fill & Tint', client: 'Maya K.', date: getD(2), hour: 10, timeStr: '10:00 AM' },
    { id: '4', type: 'booking', title: 'Sculpting Consult', client: 'Oliver P.', date: getD(4), hour: 10, timeStr: '10:00 AM' },
    { id: '5', type: 'block', title: 'Inventory Run', date: getD(3), hour: 11, timeStr: '11:00 AM' },
    { id: '6', type: 'block', title: 'Lunch Block', date: getD(1), hour: 12, timeStr: '12:00 PM' },
    { id: '7', type: 'booking', title: 'Bridal Trial', client: 'Camilla D.', date: getD(5), hour: 12, timeStr: '12:00 PM' },
    { id: '8', type: 'block', title: 'Personal Appt', date: getD(2), hour: 13, timeStr: '1:00 PM' },
    { id: '9', type: 'booking', title: 'Architectural Brow Sculpt', client: 'Alex M.', date: getD(2), hour: 14, timeStr: '2:00 PM' },
    { id: '10', type: 'booking', title: 'Dermal Resurfacing', client: 'Sarah T.', date: getD(2), hour: 15, timeStr: '3:00 PM' },
    { id: '11', type: 'booking', title: 'Signature Glow Facial', client: 'Liam H.', date: getD(4), hour: 15, timeStr: '3:00 PM' },
  ];
}


/**
 * Theme Logic (Light/Dark mode)
 */
function initThemeLogic() {
  const savedTheme = localStorage.getItem("glamora_theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

/**
 * Navigation & Modal Toggles
 */
function toggleMobileSidebar() {
  const sidebar = document.getElementById("mobile-sidebar");
  if (sidebar) sidebar.classList.toggle("hidden");
}

function switchRole(role) {
  if (role === 'customer') {
    window.location.href = 'vendor customer dashboard.html';
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

/**
 * Handle Manual Booking Submission & Inject into Calendar
 */
function handleManualBookingSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const clientName = form.querySelector('input[type="text"]').value;
  const service = form.querySelector('select').value;
  const dateStr = form.querySelector('input[type="date"]').value;
  const timeStr = form.querySelector('input[type="time"]').value;
  
  const hour = parseInt(timeStr.split(':')[0]);
  
  // Format 12h time string
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayTime = `${displayHour}:${timeStr.split(':')[1]} ${ampm}`;
  
  // Push directly to state
  eventsData.push({
    id: Date.now().toString(),
    type: 'booking',
    title: service,
    client: clientName,
    date: dateStr,
    hour: hour,
    timeStr: displayTime
  });
  
  alert("Manual booking successfully added to your schedule!");
  closeModal('manualBookingModal');
  
  // Navigate the view specifically to the newly booked date
  currentDate = new Date(dateStr);
  if(currentView === 'Month') currentView = 'Week'; // Auto switch to week view to see specific time easily
  
  // Reset buttons visual state just in case it switched views
  const btns = document.querySelectorAll('.view-btn');
  btns.forEach(b => {
      b.className = "view-btn px-md py-xs rounded-full text-on-surface-variant hover:text-primary text-label-sm font-label-sm transition-all";
      if(b.innerText.trim() === currentView) {
          b.className = "view-btn px-md py-xs rounded-full bg-surface-container-lowest text-primary text-label-sm font-label-sm shadow-sm transition-all";
      }
  });

  updateCalendarDisplay();
}

/**
 * Calendar Date Navigation Engine
 */
function navigateDate(direction) {
  if (currentView === 'Day') {
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : (direction === 'prev' ? -1 : 0)));
  } else if (currentView === 'Week') {
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : (direction === 'prev' ? -7 : 0)));
  } else if (currentView === 'Month') {
    currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : (direction === 'prev' ? -1 : 0)));
  }
  
  if (direction === 'today') {
    currentDate = new Date();
  }
  
  updateCalendarDisplay();
}

/**
 * Toggle Calendar Views (Week, Month, Day) visually & state
 */
function setView(clickedBtn, viewName) {
  currentView = viewName;
  
  const container = document.getElementById("calendar-view-toggles");
  if (container) {
    const buttons = container.querySelectorAll('.view-btn');
    buttons.forEach(btn => {
      btn.className = "view-btn px-md py-xs rounded-full text-on-surface-variant hover:text-primary text-label-sm font-label-sm transition-all";
    });
    clickedBtn.className = "view-btn px-md py-xs rounded-full bg-surface-container-lowest text-primary text-label-sm font-label-sm shadow-sm transition-all";
  }
  
  updateCalendarDisplay();
}

/**
 * Render Header Labels depending on active View
 */
function updateCalendarDisplay() {
  const dateDisplay = document.getElementById("calendar-date-display");
  const yearDisplay = document.getElementById("calendar-year-display");
  
  if (!dateDisplay) return;

  if (currentView === 'Day') {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(currentDate);
    target.setHours(0,0,0,0);
    const diff = (target - today) / (1000 * 60 * 60 * 24);
    
    if (diff === 0) dateDisplay.textContent = "Today";
    else if (diff === -1) dateDisplay.textContent = "Yesterday";
    else if (diff === 1) dateDisplay.textContent = "Tomorrow";
    else dateDisplay.textContent = target.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    
  } else if (currentView === 'Week') {
    const d = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    dateDisplay.textContent = `Week ${weekNo}`;
    
  } else if (currentView === 'Month') {
    dateDisplay.textContent = currentDate.toLocaleDateString('en-US', { month: 'long' });
  }

  if (yearDisplay) yearDisplay.textContent = currentDate.getFullYear();
  
  // Render actual layout
  renderCalendar();
}

/**
 * Engine to dynamically inject standard calendar layouts
 */
function renderCalendar() {
  const container = document.getElementById('calendar-container');
  if(!container) return;
  
  if (currentView === 'Month') {
    container.innerHTML = generateMonthViewHTML();
  } else {
    container.innerHTML = generateTimeMatrixHTML();
  }
}

// Utility: Correct Date mapping
function getLocalYMD(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

/**
 * Generate standard Time Grid (Day/Week)
 */
function generateTimeMatrixHTML() {
  const isDay = currentView === 'Day';
  const numCols = isDay ? 2 : 8; 
  const gridClass = isDay ? 'grid-cols-2' : 'grid-cols-8';
  
  let daysToRender = [];
  if (isDay) {
    daysToRender.push(new Date(currentDate));
  } else {
    let startOfWeek = new Date(currentDate);
    let day = startOfWeek.getDay();
    let diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
      let d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      daysToRender.push(d);
    }
  }
  
  // Generate Header Row
  let html = `<div class="grid ${gridClass} bg-surface-container-low p-sm text-center select-none border-b border-soft-border">`;
  html += `<div class="text-label-sm font-label-sm text-on-surface-variant flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">schedule</span></div>`;
  
  const todayYMD = getLocalYMD(new Date());
  
  daysToRender.forEach(d => {
    const ymd = getLocalYMD(d);
    const isToday = ymd === todayYMD;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const dateNum = d.getDate();
    
    if (isToday) {
      html += `<div class="flex flex-col py-xs bg-surface-container-highest/60 rounded-lg">
                 <span class="text-label-sm font-label-sm text-secondary font-bold">${dayName}</span>
                 <span class="font-headline-md text-headline-md text-primary font-bold">${dateNum}</span>
               </div>`;
    } else {
      html += `<div class="flex flex-col py-xs">
                 <span class="text-label-sm font-label-sm text-on-surface-variant">${dayName}</span>
                 <span class="font-headline-md text-headline-md text-primary">${dateNum}</span>
               </div>`;
    }
  });
  html += `</div>`;
  
  // Generate Matrix Body
  html += `<div class="relative overflow-x-auto select-none"><div class="min-w-[${isDay ? '300px' : '720px'}]">`;
  const standardHours = [8, 9, 10, 11, 12, 13, 14, 15, 16];
  
  standardHours.forEach(hour => {
    const hourStr = hour.toString().padStart(2, '0') + ':00';
    html += `<div class="grid ${gridClass} h-20 relative hover:bg-surface-container-low/40 transition-colors border-b border-soft-border/30">`;
    html += `<div class="px-sm text-right pr-md pt-xs text-label-sm font-label-sm text-outline border-r border-soft-border/50">${hourStr}</div>`;
    
    daysToRender.forEach(d => {
      const ymd = getLocalYMD(d);
      const event = eventsData.find(e => e.date === ymd && e.hour === hour);
      
      if (event) {
        html += `<div class="p-xs">${renderEventCardHTML(event)}</div>`;
      } else {
        html += `<div></div>`;
      }
    });
    
    html += `</div>`;
  });
  
  // Night Summary Expansion Bar
  html += `<div id="evening-hours-summary" class="grid ${gridClass} h-16 relative hover:bg-surface-container-low/40 transition-colors bg-surface-container-low/30 border-b border-soft-border/30">
            <div class="px-sm text-right pr-md pt-xs text-label-sm font-label-sm text-outline border-r border-soft-border/50">17:00 – 20:00</div>
            <div class="${isDay ? 'col-span-1' : 'col-span-7'} px-md flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant">
              <span class="flex items-center gap-xs">
                <span class="material-symbols-outlined text-[16px]">wb_twilight</span>
                Evening Sessions
              </span>
              <button onclick="expandNightHours(${numCols})" class="text-primary hover:underline font-semibold text-label-sm transition-colors cursor-pointer">
                Expand full night hours →
              </button>
            </div>
          </div>`;
  html += `<div id="expanded-night-hours" class="hidden flex-col w-full"></div>`;
  html += `</div></div>`;
  
  return html;
}

/**
 * Generate 7-column Month Calendar Grid View
 */
function generateMonthViewHTML() {
  let html = `<div class="grid grid-cols-7 bg-surface-container-low p-sm text-center select-none border-b border-soft-border">`;
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  days.forEach(d => { html += `<div class="text-label-sm font-label-sm text-on-surface-variant">${d}</div>`; });
  html += `</div>`;
  
  html += `<div class="grid grid-cols-7 auto-rows-[120px] bg-surface-container-lowest">`;
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let startOffset = firstDay.getDay() - 1;
  if (startOffset === -1) startOffset = 6; 
  
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
      html += `<div class="p-xs border-b border-r border-soft-border/50 bg-surface-container-low/20 text-outline">
                 <span class="text-label-sm font-label-sm">${prevMonthLastDay - i}</span>
               </div>`;
  }
  
  const todayYMD = getLocalYMD(new Date());
  for (let i = 1; i <= lastDay.getDate(); i++) {
      const dateObj = new Date(year, month, i);
      const ymd = getLocalYMD(dateObj);
      const isToday = ymd === todayYMD;
      
      const dayEvents = eventsData.filter(e => e.date === ymd);
      
      let dayNumHtml = isToday 
          ? `<span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary font-label-sm text-label-sm shadow-sm">${i}</span>` 
          : `<span class="text-label-sm font-label-sm text-primary p-1">${i}</span>`;
          
      let eventsHtml = '';
      dayEvents.slice(0, 3).forEach(ev => {
          let bg = ev.type === 'block' ? 'bg-surface-container-highest text-on-surface' : 'bg-secondary-container text-on-secondary-container';
          eventsHtml += `<div class="text-[10px] truncate px-1 py-0.5 rounded ${bg} font-medium">${ev.timeStr || (ev.hour+':00')} ${ev.title}</div>`;
      });
      if (dayEvents.length > 3) {
           eventsHtml += `<div class="text-[10px] text-outline pl-1">+${dayEvents.length - 3} more</div>`;
      }
      
      html += `<div class="p-xs border-b border-r border-soft-border/50 hover:bg-surface-container-low/20 transition-colors flex flex-col gap-xs overflow-hidden">
                 ${dayNumHtml}
                 <div class="flex flex-col gap-[2px] mt-1">${eventsHtml}</div>
               </div>`;
  }
  
  const totalCellsRendered = startOffset + lastDay.getDate();
  const remainingCells = (Math.ceil(totalCellsRendered / 7) * 7) - totalCellsRendered;
  for (let i = 1; i <= remainingCells; i++) {
      html += `<div class="p-xs border-b border-r border-soft-border/50 bg-surface-container-low/20 text-outline">
                 <span class="text-label-sm font-label-sm">${i}</span>
               </div>`;
  }
  
  html += `</div>`;
  return html;
}

/**
 * Render visual Event UI Card strictly to visual design layout
 */
function renderEventCardHTML(event) {
  if (event.type === 'block') {
      return `
      <div class="w-full h-full rounded-lg bg-surface-container-highest p-xs flex flex-col justify-center relative overflow-hidden cursor-not-allowed border border-soft-border/50">
        <div class="absolute inset-0 opacity-15 bg-[radial-gradient(#171818_1px,transparent_1px)] [background-size:8px_8px]"></div>
        <span class="font-label-sm text-label-sm z-10 flex items-center gap-xs truncate text-on-surface-variant font-medium">
          <span class="material-symbols-outlined text-[14px]">block</span>${event.title}
        </span>
      </div>`;
  }
  return `
  <div class="w-full h-full bg-secondary-container/80 rounded-lg p-xs md:p-sm flex flex-col justify-between shadow-sm cursor-pointer hover:bg-sage/40 transition-all border border-success-green/20">
    <div class="flex items-start justify-between gap-xs">
      <span class="font-label-sm text-label-sm text-on-secondary-fixed font-bold leading-tight line-clamp-1">${event.title}</span>
    </div>
    ${event.client ? `
    <div class="flex items-center justify-between text-on-secondary-container mt-auto">
      <span class="font-label-sm text-label-sm font-bold truncate">${event.client}</span>
      <span class="text-[10px] font-label-sm flex-shrink-0">${event.timeStr || (event.hour+':00')}</span>
    </div>` : ''}
  </div>`;
}

/**
 * Expand Night Hours Dynamically based on View Grid Col count
 */
function expandNightHours(numCols) {
  const summaryBtn = document.getElementById('evening-hours-summary');
  const expandedContainer = document.getElementById('expanded-night-hours');
  
  if(summaryBtn && expandedContainer) {
    summaryBtn.classList.add('hidden');
    expandedContainer.classList.remove('hidden');
    expandedContainer.classList.add('flex');
    
    const gridClass = numCols === 2 ? 'grid-cols-2' : 'grid-cols-8';
    let nightHTML = '';
    
    for(let hour = 17; hour <= 22; hour++) {
      nightHTML += `
        <div class="grid ${gridClass} h-16 relative hover:bg-surface-container-low/40 transition-colors border-t border-soft-border/30">
          <div class="px-sm text-right pr-md pt-xs text-label-sm font-label-sm text-outline border-r border-soft-border/50">
            ${hour}:00
          </div>`;
      for(let c = 1; c < numCols; c++) {
        nightHTML += `<div></div>`;
      }
      nightHTML += `</div>`;
    }
    expandedContainer.innerHTML = nightHTML;
  }
}


/* ====================================================
   Schedule Guardrails & Modals Logic
==================================================== */

function initGuardrailControls() {
  const slider = document.getElementById("deposit-slider");
  const display = document.getElementById("deposit-val-display");
  if (slider && display) {
    slider.addEventListener("input", (e) => {
      display.textContent = e.target.value + "%";
    });
  }

  const quickBlockBtn = document.getElementById("quick-blockout-btn");
  if (quickBlockBtn) {
    quickBlockBtn.addEventListener("click", () => openModal('blockOutModal'));
  }
}

function handleEditWorkingHours() {
  openModal('workingHoursModal');
}

function saveWorkingHours(event) {
  event.preventDefault();
  alert("Working hours successfully updated!");
  closeModal('workingHoursModal');
}

function saveBlockOutTime(event) {
  event.preventDefault();
  alert("Time slot blocked and reason sent to admin. Calendar synced.");
  closeModal('blockOutModal');
  updateCalendarDisplay(); // Optional refresh
}

function handleReschedule() {
  alert("Initiating Reschedule Workflow for Alex M.");
}

function setBuffer(clickedBtn, bufferValue) {
  const container = document.getElementById("buffer-toggles");
  if (!container) return;
  
  const buttons = container.querySelectorAll('.buffer-btn');
  buttons.forEach(btn => {
    btn.className = "buffer-btn py-sm rounded-lg text-label-sm font-label-sm text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-colors";
  });
  
  clickedBtn.className = "buffer-btn py-sm rounded-lg text-label-sm font-label-sm text-on-primary bg-primary font-bold shadow-sm";
  currentBufferTime = bufferValue;
}

function saveCancellationWindow() {
  const select = document.getElementById('cancel-window-select');
  const value = select.options[select.selectedIndex].text;
  alert("Cancellation policy updated successfully.");
  closeModal('cancelWindowModal');
}

function handleSyncToggle(event) {
  const isChecked = event.target.checked;
  if (isChecked) {
    console.log("Calendar Sync: Enabled");
  } else {
    console.log("Calendar Sync: Paused");
  }
}