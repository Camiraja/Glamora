// --- Theme Switcher Logic (Passive Listener) ---
document.addEventListener("DOMContentLoaded", () => {
    const currentMode = localStorage.getItem("themeMode");
    if (currentMode === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
});

// --- Vendor Capabilities & Logistics Config ---
const vendorConfig = {
    offersWalkIn: true,      // Set to false to test disabled Walk-In option
    offersHomeService: true, // Set to false to test disabled Home Service option
    travelFee: 5000          // Logistics / Travel / Call-Out fee in NGN
};

// --- Percentage Deposit Config ---
const BREAKAGE_FEE_PERCENTAGE = 0.20; // 20% Breakage Fee required to lock slot

// --- State Management ---
const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();

let selectedDate = null;
let selectedSlots = [];
let selectedLocation = 'walk-in'; // 'walk-in' or 'home-service'
const PRICE_PER_SLOT = 15000; // ₦15,000 per 30-min slot

// Global record of booked slots
let globallyBookedSlots = {};

// --- DOM Elements ---
const monthYearLabel = document.getElementById('current-month-year');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const selectedDateLabel = document.getElementById('selected-date-label');
const timeSlotsContainer = document.getElementById('time-slots-container');
const clearSlotsBtn = document.getElementById('clear-slots-btn');
const slotSelectionCount = document.getElementById('slot-selection-count');
const checkoutBtn = document.getElementById('checkout-btn');

// Location DOM Elements
const walkInRadio = document.getElementById('radio-walkin');
const walkInLabel = document.getElementById('option-walkin');
const homeRadio = document.getElementById('radio-homeservice');
const homeLabel = document.getElementById('option-homeservice');
const homeFeeBadge = document.getElementById('home-service-fee-badge');

// Summary DOM Elements
const summaryDateTime = document.getElementById('summary-date-time');
const summaryServices = document.getElementById('summary-services');
const summarySubtotal = document.getElementById('summary-subtotal');
const summaryTravelRow = document.getElementById('summary-travel-row');
const summaryTravelFee = document.getElementById('summary-travel-fee');
const summaryTaxes = document.getElementById('summary-taxes');
const summaryTotal = document.getElementById('summary-total');
const summaryDueNow = document.getElementById('summary-due-now');
const summaryBalance = document.getElementById('summary-balance');
const dueNowLabel = document.getElementById('due-now-label');
const dueNowDescription = document.getElementById('due-now-description');

// --- Helper Functions ---
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
};

const formatDateObj = (dateObj) => {
    return dateObj.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' });
};

// --- Service Delivery Location Logic ---
function initServiceLocation() {
    if (homeFeeBadge) {
        homeFeeBadge.textContent = `+${formatCurrency(vendorConfig.travelFee)} logistics`;
    }

    // Grey out Walk-In option if vendor doesn't accept studio visits
    if (!vendorConfig.offersWalkIn) {
        walkInRadio.disabled = true;
        walkInRadio.checked = false;
        walkInLabel.classList.add('opacity-40', 'cursor-not-allowed', 'bg-surface-container-low', 'dark:bg-primary-container');
        walkInLabel.classList.remove('cursor-pointer', 'hover:border-primary', 'dark:hover:border-parchment-white');
        
        selectedLocation = 'home-service';
        homeRadio.checked = true;
    }

    // Grey out Home Service option if vendor doesn't offer mobile services
    if (!vendorConfig.offersHomeService) {
        homeRadio.disabled = true;
        homeRadio.checked = false;
        homeLabel.classList.add('opacity-40', 'cursor-not-allowed', 'bg-surface-container-low', 'dark:bg-primary-container');
        homeLabel.classList.remove('cursor-pointer', 'hover:border-primary', 'dark:hover:border-parchment-white');
        
        selectedLocation = 'walk-in';
        walkInRadio.checked = true;
    }

    // Radio change handlers
    document.querySelectorAll('input[name="delivery_location"]').forEach((radio) => {
        radio.addEventListener('change', (e) => {
            selectedLocation = e.target.value;
            updateSummary();
        });
    });
}

// --- Calendar Logic ---
function renderCalendar(month, year) {
    calendarGrid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearLabel.textContent = `${monthNames[month]} ${year}`;

    // Blank spaces for prior month days
    for (let i = 0; i < firstDay; i++) {
        const blankDiv = document.createElement('div');
        blankDiv.className = 'aspect-square';
        calendarGrid.appendChild(blankDiv);
    }

    // Render valid days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateBtn = document.createElement('button');
        const loopDate = new Date(year, month, day);
        
        const loopDateString = loopDate.toDateString();
        const todayString = today.toDateString();
        
        dateBtn.className = "aspect-square rounded-lg flex items-center justify-center font-body-md text-body-md transition-colors relative";
        dateBtn.textContent = day;

        if (loopDate < today && loopDateString !== todayString) {
            dateBtn.classList.add("text-outline-variant", "dark:text-surface-variant", "opacity-50", "cursor-not-allowed", "line-through", "decoration-outline-variant", "dark:decoration-surface-variant");
            dateBtn.disabled = true;
        } else {
            dateBtn.classList.add("text-on-surface", "dark:text-parchment-white", "hover:bg-surface-container-low", "dark:hover:bg-surface-container-high");
            
            if (selectedDate && loopDateString === selectedDate.toDateString()) {
                dateBtn.classList.remove("text-on-surface", "dark:text-parchment-white", "hover:bg-surface-container-low", "dark:hover:bg-surface-container-high");
                dateBtn.classList.add("bg-charcoal", "dark:bg-parchment-white", "text-on-primary", "dark:text-charcoal", "shadow-md");
                
                const dot = document.createElement('span');
                dot.className = "absolute bottom-1 w-1 h-1 rounded-full bg-on-primary dark:bg-charcoal";
                dateBtn.appendChild(dot);
            }
            
            dateBtn.addEventListener('click', () => {
                selectedDate = loopDate;
                selectedSlots = [];
                renderCalendar(currentMonth, currentYear);
                renderTimeSlots();
                updateSummary();
            });
        }
        
        calendarGrid.appendChild(dateBtn);
    }
}

// --- Time Slots Logic ---
function renderTimeSlots() {
    if (!selectedDate) return;
    
    selectedDateLabel.textContent = selectedDate.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
    timeSlotsContainer.innerHTML = '';
    
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;
    const bookedForDay = globallyBookedSlots[dateKey] || [];

    const timeBlocks = {
        'Morning': ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
        'Afternoon': ['12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM']
    };

    for (const [period, times] of Object.entries(timeBlocks)) {
        const periodDiv = document.createElement('div');
        periodDiv.className = "flex flex-col gap-sm mb-md";
        
        const periodLabel = document.createElement('span');
        periodLabel.className = "font-label-sm text-label-sm text-on-surface-variant dark:text-outline-variant tracking-wider uppercase";
        periodLabel.textContent = period;
        periodDiv.appendChild(periodLabel);

        const gridDiv = document.createElement('div');
        gridDiv.className = "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-sm";

        times.forEach(time => {
            const slotBtn = document.createElement('button');
            
            if (bookedForDay.includes(time)) {
                slotBtn.className = "py-sm rounded-lg border border-soft-border dark:border-outline-variant font-body-sm text-body-sm text-outline-variant dark:text-surface-variant bg-surface-container-lowest dark:bg-primary-container opacity-50 cursor-not-allowed line-through decoration-outline-variant dark:decoration-surface-variant";
                slotBtn.disabled = true;
                slotBtn.textContent = time;
            } else {
                const isSelected = selectedSlots.includes(time);
                if (isSelected) {
                    slotBtn.className = "py-sm rounded-lg border-transparent font-body-sm text-body-sm bg-charcoal dark:bg-parchment-white text-on-primary dark:text-charcoal shadow-md transition-all";
                } else {
                    slotBtn.className = "py-sm rounded-lg border border-soft-border dark:border-outline-variant font-body-sm text-body-sm text-on-surface dark:text-parchment-white hover:border-primary dark:hover:border-parchment-white transition-all";
                }
                
                slotBtn.textContent = time;
                slotBtn.addEventListener('click', () => {
                    toggleSlot(time);
                });
            }
            gridDiv.appendChild(slotBtn);
        });
        
        periodDiv.appendChild(gridDiv);
        timeSlotsContainer.appendChild(periodDiv);
    }
}

function toggleSlot(time) {
    if (selectedSlots.includes(time)) {
        selectedSlots = selectedSlots.filter(t => t !== time);
    } else {
        selectedSlots.push(time);
        selectedSlots.sort((a, b) => new Date('1970/01/01 ' + a) - new Date('1970/01/01 ' + b));
    }
    renderTimeSlots();
    updateSummary();
}

function updateSummary() {
    slotSelectionCount.textContent = `${selectedSlots.length} slot(s) selected`;
    
    if (selectedSlots.length > 0) {
        clearSlotsBtn.classList.remove('hidden');
        checkoutBtn.disabled = false;
        
        const firstSlot = selectedSlots[0];
        const lastSlot = selectedSlots[selectedSlots.length - 1];
        summaryDateTime.textContent = `${formatDateObj(selectedDate)} • ${firstSlot}${selectedSlots.length > 1 ? ' - ' + lastSlot : ''}`;
        
        const locationBadge = selectedLocation === 'home-service' ? ' (Home Service)' : ' (Studio Walk-In)';
        
        summaryServices.innerHTML = `
            <div class="flex justify-between items-start group">
              <div class="flex flex-col gap-xs pr-md">
                <span class="font-label-md text-label-md text-primary dark:text-parchment-white">Precision Cut & Style${locationBadge}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant">${selectedSlots.length * 30} mins</span>
              </div>
              <div class="flex flex-col items-end gap-xs">
                <span class="font-label-md text-label-md text-primary dark:text-parchment-white">${formatCurrency(PRICE_PER_SLOT * selectedSlots.length)}</span>
              </div>
            </div>
        `;

        // 1. Core Component Breakdown
        const subtotal = PRICE_PER_SLOT * selectedSlots.length;
        const travelFee = (selectedLocation === 'home-service') ? vendorConfig.travelFee : 0;
        
        // 2. Full VAT (7.5%) on service + travel
        const vat = (subtotal + travelFee) * 0.075; 
        
        // 3. Gross Total
        const total = subtotal + travelFee + vat;
        
        // 4. Base 20% Breakage Fee
        const breakageFee = subtotal * BREAKAGE_FEE_PERCENTAGE; 
        
        // 5. Upfront Total: Breakage + 100% VAT (+ Logistics if applicable)
        let dueNow = breakageFee + vat;

        if (selectedLocation === 'home-service') {
            summaryTravelRow.classList.remove('hidden');
            summaryTravelRow.classList.add('flex');
            summaryTravelFee.textContent = formatCurrency(travelFee);
            
            dueNow += travelFee;
            dueNowLabel.textContent = "Due Now (Breakage + Logistics + VAT)";
            dueNowDescription.innerHTML = `The <span class="font-bold text-muted-terracotta dark:text-tertiary-fixed">20% breakage fee, logistics, and full VAT</span> are paid upfront to secure your booking.`;
        } else {
            summaryTravelRow.classList.add('hidden');
            summaryTravelRow.classList.remove('flex');
            
            dueNowLabel.textContent = "Due Now (20% Breakage + VAT)";
            dueNowDescription.innerHTML = `The <span class="font-bold text-muted-terracotta dark:text-tertiary-fixed">20% breakage fee and full VAT</span> are paid upfront to hold your time slot.`;
        }

        // 6. Remaining Balance (Always equals 80% of base service)
        const remainingBalance = total - dueNow;

        summarySubtotal.textContent = formatCurrency(subtotal);
        summaryTaxes.textContent = formatCurrency(vat);
        summaryTotal.textContent = formatCurrency(total);
        summaryDueNow.textContent = formatCurrency(dueNow);
        summaryBalance.textContent = formatCurrency(remainingBalance);

        checkoutBtn.innerHTML = `
            Pay Due Amount (${formatCurrency(dueNow)})
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        `;

    } else {
        clearSlotsBtn.classList.add('hidden');
        checkoutBtn.disabled = true;
        summaryDateTime.textContent = "Awaiting selection...";
        summaryServices.innerHTML = '<p class="font-body-sm text-on-surface-variant dark:text-outline-variant text-center py-md">Select time slots to view your total.</p>';
        summaryTravelRow.classList.add('hidden');
        summaryTravelRow.classList.remove('flex');
        
        dueNowLabel.textContent = "Due Now (20% Breakage + VAT)";
        dueNowDescription.innerHTML = `The <span class="font-bold text-muted-terracotta dark:text-tertiary-fixed">20% breakage fee and full VAT</span> are paid upfront to hold your time slot.`;

        summarySubtotal.textContent = "₦0.00";
        summaryTaxes.textContent = "₦0.00";
        summaryTotal.textContent = "₦0.00";
        summaryDueNow.textContent = "₦0.00";
        summaryBalance.textContent = "₦0.00";

        checkoutBtn.innerHTML = `
            Proceed to Payment
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        `;
    }
}// --- Event Listeners ---
prevMonthBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar(currentMonth, currentYear);
});

nextMonthBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar(currentMonth, currentYear);
});

clearSlotsBtn.addEventListener('click', () => {
    selectedSlots = [];
    renderTimeSlots();
    updateSummary();
});

checkoutBtn.addEventListener('click', () => {
    if (selectedSlots.length === 0 || !selectedDate) return;
    
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;
    
    if (!globallyBookedSlots[dateKey]) {
        globallyBookedSlots[dateKey] = [];
    }
    
    globallyBookedSlots[dateKey].push(...selectedSlots);
    
    const subtotal = PRICE_PER_SLOT * selectedSlots.length;
    const travelFee = (selectedLocation === 'home-service') ? vendorConfig.travelFee : 0;
    const breakageFee = subtotal * BREAKAGE_FEE_PERCENTAGE;
    const dueNow = selectedLocation === 'home-service' ? breakageFee + travelFee : breakageFee;

    const locationType = selectedLocation === 'home-service' ? 'Home Service' : 'Studio Walk-In';
    alert(`Payment of ${formatCurrency(dueNow)} successful! Your ${locationType} appointment on ${formatDateObj(selectedDate)} is confirmed.`);
    
    selectedSlots = [];
    renderTimeSlots();
    updateSummary();
});

// --- Initialization ---
initServiceLocation();
renderCalendar(currentMonth, currentYear);