
      // --- 1. Theme Configuration Logic ---
      document.addEventListener("DOMContentLoaded", () => {
        initTheme();
        loadBookings();
      });

      function initTheme() {
        const savedTheme = localStorage.getItem("themeMode") || "light";
        applyTheme(savedTheme);
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
          if (localStorage.getItem("themeMode") === "system") {
            applyTheme("system");
          }
        });
      }

      function applyTheme(mode) {
        const html = document.documentElement;
        if (mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          html.classList.add("dark");
        } else {
          html.classList.remove("dark");
        }
      }

      // --- 2. Toast Notification Logic ---
      function showToast(message) {
        const existingToast = document.getElementById("glamora-toast");
        if (existingToast) existingToast.remove();

        const toast = document.createElement("div");
        toast.id = "glamora-toast";
        toast.className = "fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-charcoal dark:bg-parchment-white text-on-primary dark:text-charcoal px-lg py-sm rounded-full shadow-2xl z-[100] font-label-md transition-all duration-300 flex items-center gap-xs w-[90%] sm:w-auto justify-center sm:justify-start opacity-0";
        toast.innerHTML = `<span class="material-symbols-outlined text-sm">info</span> <span class="truncate">${escapeHtml(message)}</span>`;

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
          toast.style.opacity = "1";
          toast.style.transform = "translate(-50%, -10px)";
        });

        setTimeout(() => {
          toast.style.opacity = "0";
          toast.style.transform = "translate(-50%, 10px)";
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      }

      // --- 3. Modal Logic ---
      function openModal(id) {
        document.getElementById(id).classList.remove('hidden');
      }

      function closeModal(id) {
        document.getElementById(id).classList.add('hidden');
      }

      // --- 4. Dropdown Menu Toggle Logic ---
      function toggleManageMenu(id, event) {
        event.stopPropagation();
        const targetMenu = document.getElementById(`manage-menu-${id}`);
        const isHidden = targetMenu.classList.contains('hidden');
        hideAllMenus();
        if (isHidden) {
          targetMenu.classList.remove('hidden');
        }
      }

      function hideAllMenus() {
        document.querySelectorAll('[id^="manage-menu-"]').forEach(menu => menu.classList.add('hidden'));
      }

      // Close dropdown when clicking anywhere outside
      document.addEventListener('click', hideAllMenus);

      // --- 5. Actions ---
      function viewDetails(id) {
        const booking = bookingsData.find(b => b.id === id);
        if (!booking) return;

        const statusEl = document.getElementById('modal-status');
        statusEl.textContent = booking.statusLabel.toUpperCase();
        
          if (booking.status === 'pending') {
            statusEl.className = "text-label-sm font-label-sm text-muted-terracotta bg-tertiary-fixed-dim px-2 py-0.5 rounded-full";
          } else if (booking.status === 'upcoming') {
           statusEl.className = "text-label-sm font-label-sm text-success-green bg-secondary-container px-2 py-0.5 rounded-full";
        } else if (booking.status === 'completed') {
           statusEl.className = "text-label-sm font-label-sm text-on-surface-variant dark:text-outline-variant bg-surface-container-highest dark:bg-primary-container px-2 py-0.5 rounded-full";
        } else {
           statusEl.className = "text-label-sm font-label-sm text-error-red bg-error-container dark:bg-error-container/20 px-2 py-0.5 rounded-full";
        }

        document.getElementById('modal-service').textContent = booking.service;
        document.getElementById('modal-vendor').textContent = booking.provider;
        
        document.getElementById('modal-datetime').textContent = `${booking.date}, ${booking.time}`;
        document.getElementById('modal-location').textContent = booking.location;
        document.getElementById('modal-price').textContent = booking.price;

        openModal('bookingModal');
      }

      function rebookVendor(id) {
        const booking = bookingsData.find((item) => item.id === id);
        const serviceId = booking?.serviceIds?.[0];
        window.location.href = serviceId ? `booking.html?serviceId=${encodeURIComponent(serviceId)}` : 'booking.html';
      }

      function reportIssue(id) {
        openModal('reportConfirmModal');
      }

      function proceedToReportDetails() {
        closeModal('reportConfirmModal');
        openModal('reportDetailModal');
      }

      function submitReport(event) {
        event.preventDefault();
        closeModal('reportDetailModal');
        showToast("Your report has been successfully submitted.");
      }

      async function cancelAppointment(id) {
        if (!window.confirm('Cancel this appointment? This will release the reserved time slot.')) return;
        const token = localStorage.getItem('glamoraToken');
        try {
          const response = await fetch(`http://localhost:3000/api/appointments/${encodeURIComponent(id)}/cancel`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Could not cancel appointment.');
          showToast('Appointment cancelled.');
          await loadBookings();
        } catch (error) {
          showToast(error.message || 'Could not connect to the booking service.');
        }
      }

      // --- 6. Booking Data & Filtering ---
      let currentFilter = 'all';
      let bookingsData = [];

      function mapAppointment(appointment) {
        const start = new Date(appointment.startAt);
        const end = new Date(appointment.endAt);
        const services = appointment.services || [];
        const statusMap = {
          PENDING_PAYMENT: ['pending', 'PENDING DEPOSIT'],
          CONFIRMED: ['upcoming', 'CONFIRMED'],
          CHECKED_IN: ['upcoming', 'CHECKED IN'],
          COMPLETED: ['completed', 'COMPLETED'],
          CANCELLED: ['cancelled', 'CANCELLED'],
          NO_SHOW: ['cancelled', 'NO SHOW'],
        };
        const [status, statusLabel] = statusMap[appointment.status] || ['cancelled', appointment.status];
        const totalKobo = appointment.subtotalKobo + appointment.vatKobo + appointment.logisticsFeeKobo;
        const upfrontKobo = appointment.depositKobo + appointment.vatKobo + appointment.logisticsFeeKobo;
        const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);
        const location = appointment.deliveryMode === 'HOME_SERVICE'
          ? 'Home service'
          : (appointment.business?.locations?.[0]?.city || 'Studio walk-in');

        return {
          id: appointment.id,
          status,
          statusLabel,
          date: start.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
          time: `${start.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`,
          exactDateTime: appointment.startAt,
          provider: appointment.business?.name || appointment.vendor?.name || 'Glamora professional',
          location,
          service: services.map((service) => service.serviceName).join(', ') || 'Appointment',
          serviceIds: services.map((service) => service.serviceId),
          desc: `${appointment.deliveryMode === 'HOME_SERVICE' ? 'Home service' : 'Studio walk-in'} · ${appointment.depositPercent}% breakage deposit`,
          price: money(totalKobo),
          upfront: money(upfrontKobo),
        };
      }

      async function loadBookings() {
        const token = localStorage.getItem('glamoraToken');
        let user;
        try {
          user = JSON.parse(localStorage.getItem('glamoraUser') || 'null');
        } catch {
          user = null;
        }
        if (!token || !user) {
          sessionStorage.setItem('glamoraReturnTo', 'mybookings.html');
          window.location.href = 'Auth/login.html';
          return;
        }
        if (String(user.role || '').toUpperCase() !== 'CUSTOMER') {
          window.location.href = 'vendor-dashboard.html';
          return;
        }

        const container = document.getElementById('bookings-container');
        container.innerHTML = '<p class="py-lg text-center text-on-surface-variant">Loading your appointments...</p>';
        try {
          const response = await fetch('http://localhost:3000/api/appointments', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Could not load appointments.');
          bookingsData = data.appointments.map(mapAppointment);
          document.getElementById('load-more-btn')?.classList.add('hidden');
          renderBookings();
        } catch (error) {
          container.innerHTML = `<div class="py-lg text-center text-error">${escapeHtml(error.message || 'Could not load appointments.')}</div>`;
        }
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (character) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
      }

      async function payDeposit(id) {
        const token = localStorage.getItem('glamoraToken');
        try {
          const response = await fetch(`http://localhost:3000/api/payments/appointments/${encodeURIComponent(id)}/deposit`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Could not start deposit payment.');
          if (!data.authorizationUrl) throw new Error('Paystack did not return a checkout link.');
          window.location.href = data.authorizationUrl;
        } catch (error) {
          showToast(error.message || 'Could not connect to the payment service.');
        }
      }

      function setFilter(filterType) {
        currentFilter = filterType;
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
          btn.classList.remove('bg-surface', 'dark:bg-charcoal', 'text-on-surface', 'dark:text-parchment-white', 'shadow-sm');
          btn.classList.add('text-on-surface-variant', 'dark:text-outline-variant');
        });

        const activeBtn = document.getElementById(`filter-${filterType}`);
        if (activeBtn) {
          activeBtn.classList.remove('text-on-surface-variant', 'dark:text-outline-variant');
          activeBtn.classList.add('bg-surface', 'dark:bg-charcoal', 'text-on-surface', 'dark:text-parchment-white', 'shadow-sm');
        }

        renderBookings();
      }

      function loadMoreHistory() {
        loadBookings();
      }

      function renderBookings() {
        const container = document.getElementById('bookings-container');
        container.innerHTML = '';

        const filteredBookings = bookingsData.filter(booking => {
          if (currentFilter === 'all') return true;
          if (currentFilter === 'active') return booking.status === 'upcoming' || booking.status === 'pending';
          if (currentFilter === 'completed') return booking.status === 'completed' || booking.status === 'cancelled';
          return true;
        });

        if (filteredBookings.length === 0) {
          container.innerHTML = `
            <div class="py-xl flex flex-col items-center justify-center text-center gap-sm bg-surface-container-low dark:bg-primary-container/40 rounded-2xl p-lg border border-soft-border dark:border-outline-variant/20 transition-colors w-full">
              <span class="material-symbols-outlined text-headline-xl text-outline-variant dark:text-outline-variant/50">event_busy</span>
              <h3 class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white mt-4">No bookings found</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant">You don't have any ${currentFilter} appointments yet.</p>
            </div>`;
          return;
        }

        filteredBookings.forEach(booking => {
          container.innerHTML += generateCardHTML(booking);
        });
      }

      function generateCardHTML(booking) {
        const ribbonClass = booking.status === 'pending'
          ? 'bg-tertiary-fixed-dim text-tertiary-container'
          : booking.status === 'upcoming'
            ? 'bg-sage dark:bg-sage text-on-surface dark:text-charcoal'
            : booking.status === 'completed'
              ? 'bg-surface-container-highest dark:bg-primary-container text-on-surface-variant dark:text-outline-variant'
              : 'bg-error-container dark:bg-error-container/20 text-on-error-container dark:text-error-container';
        const diffInMinutes = (new Date(booking.exactDateTime) - new Date()) / 60000;
        const canCancel = ['pending', 'upcoming'].includes(booking.status);
        const cancelAction = canCancel
          ? (diffInMinutes <= 30
            ? '<span class="px-md py-sm text-xs text-on-surface-variant">Cancellation unavailable within 30 minutes</span>'
            : `<button onclick="cancelAppointment('${escapeHtml(booking.id)}'); hideAllMenus();" class="w-full text-left px-md py-sm hover:bg-error-container/20 text-error-red dark:text-error-container flex items-center gap-xs border-t border-soft-border"><span class="material-symbols-outlined text-[18px]">cancel</span> Cancel appointment</button>`)
          : '';
        const payButton = booking.status === 'pending'
          ? `<button onclick="payDeposit('${escapeHtml(booking.id)}')" class="px-md py-sm rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container">Pay ${escapeHtml(booking.upfront)} deposit</button>`
          : '';
        const id = escapeHtml(booking.id);

        return `
          <article class="bg-surface dark:bg-surface-container-high/40 rounded-xl p-md shadow-sm border border-soft-border dark:border-outline-variant/10 hover:shadow-md transition-shadow relative overflow-visible group">
            <div class="absolute top-0 right-0 px-md py-xs font-label-sm text-label-sm rounded-bl-lg ${ribbonClass} z-10">${escapeHtml(booking.statusLabel)}</div>
            <div class="flex flex-col md:flex-row gap-lg items-start md:items-center">
              <div class="flex flex-col min-w-[120px]">
                <span class="font-label-sm text-label-sm text-on-surface-variant dark:text-outline-variant mb-xs">DATE</span>
                <span class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white mb-xs">${escapeHtml(booking.date)}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant">${escapeHtml(booking.time)}</span>
              </div>
              <div class="hidden md:block w-px h-16 bg-soft-border dark:bg-outline-variant/20"></div>
              <div class="flex items-center gap-md flex-1 w-full">
                <div class="w-14 h-14 rounded-full bg-surface-container-high dark:bg-primary-container flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-primary dark:text-parchment-white">storefront</span></div>
                <div class="min-w-0">
                  <h3 class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white truncate">${escapeHtml(booking.provider)}</h3>
                  <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant flex items-center gap-xs truncate mt-1"><span class="material-symbols-outlined text-[16px] shrink-0">location_on</span><span class="truncate">${escapeHtml(booking.location)}</span></p>
                </div>
              </div>
              <div class="flex-1 w-full mt-4 md:mt-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
                <div>
                  <h4 class="font-label-md text-label-md text-on-surface dark:text-parchment-white mb-xs truncate">${escapeHtml(booking.service)}</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant">${escapeHtml(booking.desc)}</p>
                  ${booking.status === 'pending' ? `<p class="font-label-sm text-label-sm text-muted-terracotta mt-xs">Upfront amount pending: ${escapeHtml(booking.upfront)}</p>` : ''}
                </div>
                <div class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white shrink-0">${escapeHtml(booking.price)}</div>
              </div>
              <div class="flex items-center gap-sm self-end md:self-center shrink-0">
                ${payButton}
                <div class="relative manage-dropdown-container">
                  <button onclick="toggleManageMenu('${id}', event)" class="px-md py-sm rounded-lg font-label-md text-label-md border border-soft-border dark:border-outline-variant/30 text-on-surface dark:text-parchment-white hover:bg-surface-container">Manage</button>
                  <div id="manage-menu-${id}" class="hidden absolute right-0 mt-2 w-52 bg-surface-container-lowest dark:bg-charcoal border border-soft-border dark:border-outline-variant/20 rounded-lg shadow-xl z-30 py-xs text-body-sm">
                    <button onclick="viewDetails('${id}'); hideAllMenus();" class="w-full text-left px-md py-sm hover:bg-surface-container text-on-surface dark:text-parchment-white flex items-center gap-xs"><span class="material-symbols-outlined text-[18px]">visibility</span> View Details</button>
                    <button onclick="rebookVendor('${id}'); hideAllMenus();" class="w-full text-left px-md py-sm hover:bg-surface-container text-on-surface dark:text-parchment-white flex items-center gap-xs"><span class="material-symbols-outlined text-[18px]">refresh</span> Rebook</button>
                    <button onclick="reportIssue('${id}'); hideAllMenus();" class="w-full text-left px-md py-sm hover:bg-surface-container text-on-surface dark:text-parchment-white flex items-center gap-xs"><span class="material-symbols-outlined text-[18px]">flag</span> Report</button>
                    ${cancelAction}
                  </div>
                </div>
              </div>
            </div>
          </article>`;
      }
    