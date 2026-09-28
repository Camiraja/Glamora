function requireCustomerSessionForBooking() {
    const token = localStorage.getItem("glamoraToken");
    const user = JSON.parse(localStorage.getItem("glamoraUser") || "null");

    if (!token || !user) {
        sessionStorage.setItem("glamoraReturnTo", "booking.html");
        window.location.href = "Auth/login.html";
        return false;
    }

    if (String(user.role || "").toUpperCase() !== "CUSTOMER") {
        window.location.href = user.role === "VENDOR" ? "vendor-dashboard.html" : "landing page.html";
        return false;
    }

    return true;
}

// --- Theme Switcher Logic (Passive Listener) ---
document.addEventListener("DOMContentLoaded", () => {
    if (!requireCustomerSessionForBooking()) {
        return;
    }

    const currentMode = localStorage.getItem("themeMode");
    if (currentMode === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
});

// --- State Management ---
const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();

let selectedDate = null;
let selectedSlots = [];
let selectedLocation = 'walk-in'; // 'walk-in' or 'home-service'
let selectedService = null;
let bookingServices = [];
let pendingAppointmentId = null;
let vatRatePercent = 0;

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
const serviceSelect = document.getElementById('booking-service');
const bookingMessage = document.getElementById('booking-message');

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
const vatRateLabel = document.getElementById('vat-rate-label');
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

function timeLabelToMinutes(timeLabel) {
    const [time, period] = timeLabel.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

function minutesToTimeLabel(totalMinutes) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const hour12 = hour % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

function getAvailabilityForWeekday(dayOfWeek) {
    if (!selectedService) return [];
    const schedule = selectedService.business.owner.availability;
    return schedule.filter((window) =>
        window.dayOfWeek === dayOfWeek &&
        window.staffMemberId === selectedService.staffMemberId
    );
}

function hasValidSlotSelection() {
    if (!selectedService || selectedService.durationMin % 30 !== 0) return false;
    const requiredSlots = selectedService.durationMin / 30;
    return selectedSlots.length === requiredSlots && selectedSlots.every((time, index) =>
        index === 0 || timeLabelToMinutes(time) === timeLabelToMinutes(selectedSlots[index - 1]) + 30
    );
}

function setBookingMessage(message, isError = false) {
    bookingMessage.textContent = message;
    bookingMessage.className = `text-sm ${isError ? 'text-error' : 'text-on-surface-variant dark:text-outline-variant'}`;
}

async function loadBookingCatalog() {
    try {
        const response = await fetch('http://localhost:3000/api/businesses');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not load services.');
        vatRatePercent = Number(data.vatRatePercent);
        vatRateLabel.textContent = vatRatePercent > 0
            ? `VAT (${vatRatePercent}%)`
            : 'VAT (rate awaiting approval)';

        const services = data.businesses.flatMap((business) =>
            business.services.map((service) => ({ ...service, business }))
        );
        if (services.length === 0) throw new Error('No bookable services are available yet.');

        bookingServices = services;
        serviceSelect.replaceChildren();
        services.forEach((service) => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = `${service.business.name} - ${service.name} (${formatCurrency(service.priceKobo / 100)})`;
            serviceSelect.appendChild(option);
        });

        const query = new URLSearchParams(window.location.search);
        const requestedServiceId = query.get('serviceId');
        const requestedBusinessId = query.get('businessId');
        selectedService = services.find((service) =>
            service.id === requestedServiceId && service.business.id === requestedBusinessId
        ) || services.find((service) => service.id === requestedServiceId) || services[0];
        serviceSelect.value = selectedService.id;
        serviceSelect.disabled = false;
        applyServiceDeliveryOptions();
        renderCalendar(currentMonth, currentYear);
        updateSummary();
    } catch (error) {
        setBookingMessage(error.message || 'Could not connect to the booking service.', true);
    }
}

// --- Service Delivery Location Logic ---
function initServiceLocation() {
    document.querySelectorAll('input[name="delivery_location"]').forEach((radio) => {
        radio.addEventListener('change', (e) => {
            selectedLocation = e.target.value;
            updateSummary();
        });
    });
}

function applyServiceDeliveryOptions() {
    const mode = selectedService.business.deliveryMode;
    const offersStudio = mode !== 'HOME_SERVICE_ONLY';
    const offersHomeService = mode !== 'STUDIO_ONLY';

    walkInLabel.classList.toggle('hidden', !offersStudio);
    homeLabel.classList.toggle('hidden', !offersHomeService);
    walkInRadio.disabled = !offersStudio;
    homeRadio.disabled = !offersHomeService;

    if (homeFeeBadge) {
        homeFeeBadge.textContent = `+${formatCurrency(selectedService.business.logisticsFeeKobo / 100)} logistics`;
    }

    if (!offersStudio) selectedLocation = 'home-service';
    else if (!offersHomeService) selectedLocation = 'walk-in';
    walkInRadio.checked = selectedLocation === 'walk-in';
    homeRadio.checked = selectedLocation === 'home-service';
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

        const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
        const hasAvailability = getAvailabilityForWeekday(weekday).length > 0;

        if ((loopDate < today && loopDateString !== todayString) || !hasAvailability) {
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
    if (!selectedDate) {
        selectedDateLabel.textContent = 'Select a Date';
        timeSlotsContainer.innerHTML = '<p class="font-body-sm text-on-surface-variant dark:text-outline-variant">Please select an available date.</p>';
        return;
    }
    
    selectedDateLabel.textContent = selectedDate.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
    timeSlotsContainer.innerHTML = '';
    
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;
    const bookedForDay = globallyBookedSlots[dateKey] || [];

    const weekday = new Date(Date.UTC(
        selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()
    )).getUTCDay();
    const availableTimes = new Set();
    getAvailabilityForWeekday(weekday).forEach((window) => {
        const [startHour, startMinute] = window.startTime.split(':').map(Number);
        const [endHour, endMinute] = window.endTime.split(':').map(Number);
        const start = startHour * 60 + startMinute;
        const end = endHour * 60 + endMinute;
        for (let minute = start; minute + 30 <= end; minute += 30) {
            availableTimes.add(minutesToTimeLabel(minute));
        }
    });

    const times = Array.from(availableTimes).sort((left, right) =>
        timeLabelToMinutes(left) - timeLabelToMinutes(right)
    );
    if (times.length === 0) {
        timeSlotsContainer.innerHTML = '<p class="font-body-sm text-on-surface-variant dark:text-outline-variant">No times are available for this date.</p>';
        return;
    }

    const gridDiv = document.createElement('div');
    gridDiv.className = 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-sm';
    times.forEach((time) => {
        const slotBtn = document.createElement('button');
        if (bookedForDay.includes(time)) {
            slotBtn.className = 'py-sm rounded-lg border border-soft-border dark:border-outline-variant font-body-sm text-body-sm text-outline-variant dark:text-surface-variant bg-surface-container-lowest dark:bg-primary-container opacity-50 cursor-not-allowed line-through';
            slotBtn.disabled = true;
        } else {
            slotBtn.className = selectedSlots.includes(time)
                ? 'py-sm rounded-lg border-transparent font-body-sm text-body-sm bg-charcoal dark:bg-parchment-white text-on-primary dark:text-charcoal shadow-md transition-all'
                : 'py-sm rounded-lg border border-soft-border dark:border-outline-variant font-body-sm text-body-sm text-on-surface dark:text-parchment-white hover:border-primary dark:hover:border-parchment-white transition-all';
            slotBtn.addEventListener('click', () => toggleSlot(time));
        }
        slotBtn.textContent = time;
        gridDiv.appendChild(slotBtn);
    });
    timeSlotsContainer.appendChild(gridDiv);
}

function toggleSlot(time) {
    if (selectedSlots.includes(time)) {
        selectedSlots = selectedSlots.filter(t => t !== time);
    } else {
        selectedSlots.push(time);
        selectedSlots.sort((a, b) => timeLabelToMinutes(a) - timeLabelToMinutes(b));
    }
    renderTimeSlots();
    updateSummary();
}

function updateSummary() {
    slotSelectionCount.textContent = `${selectedSlots.length} slot(s) selected`;
    
    if (selectedSlots.length > 0) {
        clearSlotsBtn.classList.remove('hidden');
        checkoutBtn.disabled = pendingAppointmentId ? false : !hasValidSlotSelection();
        const requiredSlots = selectedService.durationMin / 30;
        slotSelectionCount.textContent = `${selectedSlots.length} of ${requiredSlots} required 30-minute slots selected`;
        
        const firstSlot = selectedSlots[0];
        const lastSlot = selectedSlots[selectedSlots.length - 1];
        summaryDateTime.textContent = `${formatDateObj(selectedDate)} • ${firstSlot}${selectedSlots.length > 1 ? ' - ' + lastSlot : ''}`;
        
        const locationBadge = selectedLocation === 'home-service' ? ' (Home Service)' : ' (Studio Walk-In)';
        
        summaryServices.innerHTML = `
            <div class="flex justify-between items-start group">
              <div class="flex flex-col gap-xs pr-md">
                <span class="font-label-md text-label-md text-primary dark:text-parchment-white">${selectedService.name}${locationBadge}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant">${selectedService.durationMin} mins</span>
              </div>
              <div class="flex flex-col items-end gap-xs">
                <span class="font-label-md text-label-md text-primary dark:text-parchment-white">${formatCurrency(selectedService.priceKobo / 100)}</span>
              </div>
            </div>
        `;

        // 1. Core Component Breakdown
        const subtotal = selectedService.priceKobo / 100;
        const travelFee = selectedLocation === 'home-service'
            ? selectedService.business.logisticsFeeKobo / 100
            : 0;
        
        // 2. Full VAT (7.5%) on service + travel
        const vat = (subtotal + travelFee) * (vatRatePercent / 100);
        
        // 3. Gross Total
        const total = subtotal + travelFee + vat;
        
        const breakageFee = subtotal * (selectedService.business.breakagePercent / 100);
        
        let dueNow = breakageFee + vat;

        if (selectedLocation === 'home-service') {
            summaryTravelRow.classList.remove('hidden');
            summaryTravelRow.classList.add('flex');
            summaryTravelFee.textContent = formatCurrency(travelFee);
            
            dueNow += travelFee;
            dueNowLabel.textContent = "Upfront Payment Required";
            dueNowDescription.textContent = 'Breakage deposit, VAT, and home-service logistics are payable before the appointment is confirmed.';
        } else {
            summaryTravelRow.classList.add('hidden');
            summaryTravelRow.classList.remove('flex');
            
            dueNowLabel.textContent = "Upfront Payment Required";
            dueNowDescription.textContent = 'Breakage deposit and VAT are payable before the appointment is confirmed.';
        }

        const remainingBalance = total - dueNow;

        summarySubtotal.textContent = formatCurrency(subtotal);
        summaryTaxes.textContent = formatCurrency(vat);
        summaryTotal.textContent = formatCurrency(total);
        summaryDueNow.textContent = formatCurrency(dueNow);
        summaryBalance.textContent = formatCurrency(remainingBalance);

        checkoutBtn.innerHTML = `
            ${pendingAppointmentId ? 'Retry Deposit Payment' : 'Create Appointment'}
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        `;

    } else {
        clearSlotsBtn.classList.add('hidden');
        checkoutBtn.disabled = !pendingAppointmentId;
        summaryDateTime.textContent = "Awaiting selection...";
        summaryServices.innerHTML = '<p class="font-body-sm text-on-surface-variant dark:text-outline-variant text-center py-md">Select time slots to view your total.</p>';
        summaryTravelRow.classList.add('hidden');
        summaryTravelRow.classList.remove('flex');
        
        dueNowLabel.textContent = "Upfront Payment Required";
        dueNowDescription.textContent = 'Breakage deposit and VAT are payable before the appointment is confirmed.';

        summarySubtotal.textContent = "₦0.00";
        summaryTaxes.textContent = "₦0.00";
        summaryTotal.textContent = "₦0.00";
        summaryDueNow.textContent = "₦0.00";
        summaryBalance.textContent = "₦0.00";

        checkoutBtn.innerHTML = `
            ${pendingAppointmentId ? 'Retry Deposit Payment' : 'Create Appointment'}
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

async function startDepositPayment(appointmentId, token) {
    const response = await fetch(`http://localhost:3000/api/payments/appointments/${appointmentId}/deposit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not initialize deposit payment.');
    if (!data.authorizationUrl) throw new Error('Paystack did not return a checkout URL.');
    window.location.href = data.authorizationUrl;
}

checkoutBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('glamoraToken');
    if (!token) {
        sessionStorage.setItem('glamoraReturnTo', 'booking.html');
        window.location.href = 'Auth/login.html';
        return;
    }

    if (pendingAppointmentId) {
        checkoutBtn.disabled = true;
        try {
            await startDepositPayment(pendingAppointmentId, token);
        } catch (error) {
            setBookingMessage(`Appointment ${pendingAppointmentId} is still pending deposit: ${error.message}`, true);
            checkoutBtn.disabled = false;
        }
        return;
    }

    if (!selectedDate || !selectedService || !hasValidSlotSelection()) return;

    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;
    const dateParts = [selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()];
    const slots = selectedSlots.map((time) => {
        const startMinutes = timeLabelToMinutes(time);
        const startsAt = new Date(Date.UTC(...dateParts, Math.floor(startMinutes / 60), startMinutes % 60));
        return { startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString() };
    });

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Creating appointment...';
    setBookingMessage('');
    try {
        const response = await fetch('http://localhost:3000/api/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                serviceIds: [selectedService.id],
                slots,
                deliveryMode: selectedLocation === 'home-service' ? 'HOME_SERVICE' : 'STUDIO',
                notes: `Delivery: ${selectedLocation}`,
            }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not create appointment.');

        pendingAppointmentId = data.appointment.id;
        globallyBookedSlots[dateKey] = [...(globallyBookedSlots[dateKey] || []), ...selectedSlots];
        setBookingMessage(`Appointment ${pendingAppointmentId} is pending deposit, VAT, and applicable logistics payment.`);
        selectedSlots = [];
        renderTimeSlots();
        updateSummary();
        try {
            await startDepositPayment(pendingAppointmentId, token);
        } catch (paymentError) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = 'Retry Deposit Payment <span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
            setBookingMessage(`Appointment ${pendingAppointmentId} remains pending deposit: ${paymentError.message}`, true);
        }
    } catch (error) {
        setBookingMessage(error.message || 'Could not connect to the booking service.', true);
        updateSummary();
    }
});

serviceSelect.addEventListener('change', () => {
    selectedService = bookingServices.find((service) => service.id === serviceSelect.value) || selectedService;
    applyServiceDeliveryOptions();
    selectedDate = null;
    selectedSlots = [];
    renderCalendar(currentMonth, currentYear);
    renderTimeSlots();
    updateSummary();
});

// --- Initialization ---
initServiceLocation();
renderCalendar(currentMonth, currentYear);
loadBookingCatalog();