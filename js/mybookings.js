
      // --- 1. Theme Configuration Logic ---
      document.addEventListener("DOMContentLoaded", () => {
        initTheme();
        renderBookings(); 
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
        toast.innerHTML = `<span class="material-symbols-outlined text-sm">info</span> <span class="truncate">${message}</span>`;

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
        const booking = bookingsData.find(b => b.id === id) || olderBookings.find(b => b.id === id);
        if (!booking) return;

        const statusEl = document.getElementById('modal-status');
        statusEl.textContent = booking.status.toUpperCase();
        
        if (booking.status === 'upcoming') {
           statusEl.className = "text-label-sm font-label-sm text-success-green bg-secondary-container px-2 py-0.5 rounded-full";
        } else if (booking.status === 'completed') {
           statusEl.className = "text-label-sm font-label-sm text-on-surface-variant dark:text-outline-variant bg-surface-container-highest dark:bg-primary-container px-2 py-0.5 rounded-full";
        } else {
           statusEl.className = "text-label-sm font-label-sm text-error-red bg-error-container dark:bg-error-container/20 px-2 py-0.5 rounded-full";
        }

        document.getElementById('modal-service').textContent = booking.service;
        document.getElementById('modal-vendor').textContent = booking.provider;
        
        const cleanTime = booking.time.split(' - ')[0];
        document.getElementById('modal-datetime').textContent = `${booking.date}, 2026 at ${cleanTime}`;
        document.getElementById('modal-location').textContent = booking.location;
        document.getElementById('modal-price').textContent = booking.price;

        openModal('bookingModal');
      }

      function rebookVendor(id) {
        window.location.href = 'booking.html';
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

      function cancelAppointment(id) {
        const index = bookingsData.findIndex(b => b.id === id);
        if (index !== -1) {
          const providerName = bookingsData[index].provider;
          bookingsData[index].status = 'cancelled';
          showToast(`Your appointment with ${providerName} has been cancelled.`);
          renderBookings(); 
        }
      }

      // --- 6. Booking Data & Filtering ---
      let currentFilter = 'all';
      let historyLoaded = false;

      let bookingsData = [
        {
          id: 1,
          status: 'upcoming',
          date: 'Sep 08',
          time: '1:40 AM - 3:10 AM',
          exactDateTime: '2026-09-08T01:40:00', // Within 30 mins
          provider: 'Adesuwa Bridal Artistry',
          location: 'Lekki Phase 1, Lagos',
          service: 'Bridal Makeup Trial',
          desc: 'Full face application, airbrush foundation, false lashes included.',
          price: '₦150,000',
          img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJFGzGHFSg-Myt90YSsrcSom1lg46P3N1kzNKBMeZ1m9nZW0mjih0AlPeVddZOzEgQ8vPmUg2D6_c5YnwCq2y1DDevZlCACreHx_k3Wz--f-99VaEQ4uaoadhuDFSKpZ7ptZ2kVI9HFGYH9Z14jiVySeMmzYa86f6OHNhApwj5gJLtwlqMaa09nuo9pXqxwlgqn40u3wNpoHdqbjBHCvJRXmb1B4gY3Qp1BQpuC9AnOPJFiBwNHCwT'
        },
        {
          id: 2,
          status: 'upcoming',
          date: 'Sep 12',
          time: '2:00 PM - 3:00 PM',
          exactDateTime: '2026-09-12T14:00:00', 
          provider: 'Chinedu Grooming Room',
          location: 'Wuse II, Abuja',
          service: 'Structural Haircut',
          desc: 'Wash, precision cut, and beard sculpting.',
          price: '₦12,500',
          img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHc3RlNC9LxoXGZVLMoaPQcBdnihvATUVWNJULqCA4Eme7FPhgudMp5tzupIbgA3WKdkMpO3I5GxglVj8wNu3I45HKkOko6ZdZqrevgBAriVKQCpv2lAs94Sc4CKepwmnC8v1QbHnpLHsv9hlWajJQt134IqxbKUU8cgdiGTso_PLNwytMwZ_HBQFwWHOxphtR8SGrWUdkMB5Rqser4ichodAgHO2P8Lemu5NMmL0NqRbmiorh77tp'
        },
        {
          id: 3,
          status: 'completed',
          date: 'Aug 20',
          time: '1:00 PM - 2:00 PM',
          exactDateTime: '2026-08-20T13:00:00',
          provider: 'Sari Glow Aesthetics',
          location: 'Victoria Island, Lagos',
          service: 'Deep Tissue Massage',
          desc: '60 minutes full body pressure point massage.',
          price: '₦45,000',
          img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJFGzGHFSg-Myt90YSsrcSom1lg46P3N1kzNKBMeZ1m9nZW0mjih0AlPeVddZOzEgQ8vPmUg2D6_c5YnwCq2y1DDevZlCACreHx_k3Wz--f-99VaEQ4uaoadhuDFSKpZ7ptZ2kVI9HFGYH9Z14jiVySeMmzYa86f6OHNhApwj5gJLtwlqMaa09nuo9pXqxwlgqn40u3wNpoHdqbjBHCvJRXmb1B4gY3Qp1BQpuC9AnOPJFiBwNHCwT' 
        }
      ];

      const olderBookings = [
        {
          id: 4,
          status: 'cancelled',
          date: 'Jul 02',
          time: '4:30 PM - 5:30 PM',
          exactDateTime: '2026-07-02T16:30:00',
          provider: 'The Nail Architecture',
          location: 'GRA Phase 2, Port Harcourt',
          service: 'Gel Manicure',
          desc: 'Solid color, cuticle care, and paraffin wax treatment.',
          price: '₦18,000',
          img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-ju5OXrmxYa1WusD4PlfJtK8L-M_YbUIlbsMRODiEUbZnGzji4soahbBpvyUC7ZEpYBh2Rm17cjplbflGgThppwdz9QuIvRtsQMYQQxSZyuf28fBzLiiOyWk3-Pk9rH59eXof25ztKiAi0RF1TeypYCQzCUxkF-q6GZ_C5VMATwoYvVANzCIDKV5psBBTCSKLIOL4wHbRGusszM0d8r2l-2gY-8nB8pdBix6H2_nhfRJWi_9UBlyZ'
        },
        {
          id: 5,
          status: 'completed',
          date: 'Jun 12',
          time: '11:00 AM - 1:00 PM',
          exactDateTime: '2026-06-12T11:00:00',
          provider: 'Lash & Brow Lounge',
          location: 'Bodija, Ibadan',
          service: 'Volume Hybrid Lashes',
          desc: 'Full set wispy eyelash extensions with shaping.',
          price: '₦30,000',
          img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-ju5OXrmxYa1WusD4PlfJtK8L-M_YbUIlbsMRODiEUbZnGzji4soahbBpvyUC7ZEpYBh2Rm17cjplbflGgThppwdz9QuIvRtsQMYQQxSZyuf28fBzLiiOyWk3-Pk9rH59eXof25ztKiAi0RF1TeypYCQzCUxkF-q6GZ_C5VMATwoYvVANzCIDKV5psBBTCSKLIOL4wHbRGusszM0d8r2l-2gY-8nB8pdBix6H2_nhfRJWi_9UBlyZ'
        }
      ];

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
        if (historyLoaded) return;
        bookingsData = bookingsData.concat(olderBookings);
        historyLoaded = true;
        
        const btnText = document.getElementById('load-btn-text');
        const loadBtn = document.getElementById('load-more-btn');
        if (btnText) btnText.textContent = "All History Loaded";
        if (loadBtn) {
          loadBtn.disabled = true;
          loadBtn.classList.add('opacity-50', 'cursor-not-allowed');
          loadBtn.querySelector('.material-symbols-outlined').style.display = 'none';
        }
        renderBookings();
      }

      function renderBookings() {
        const container = document.getElementById('bookings-container');
        container.innerHTML = '';

        const filteredBookings = bookingsData.filter(booking => {
          if (currentFilter === 'all') return true;
          if (currentFilter === 'active') return booking.status === 'upcoming';
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
        let ribbonClass, ribbonText, priceStrikethrough, opacityClass, imageGreyscale;

        if (booking.status === 'upcoming') {
          ribbonClass = "bg-sage dark:bg-sage text-on-surface dark:text-charcoal";
          ribbonText = "UPCOMING";
          priceStrikethrough = "";
          opacityClass = "";
          imageGreyscale = "";
        } else if (booking.status === 'completed') {
          ribbonClass = "bg-surface-container-highest dark:bg-primary-container text-on-surface-variant dark:text-outline-variant";
          ribbonText = "COMPLETED";
          priceStrikethrough = "";
          opacityClass = "opacity-80 group-hover:opacity-100 transition-opacity";
          imageGreyscale = "grayscale group-hover:grayscale-0 transition-all";
        } else if (booking.status === 'cancelled') {
          ribbonClass = "bg-error-container dark:bg-error-container/20 text-on-error-container dark:text-error-container";
          ribbonText = "CANCELLED";
          priceStrikethrough = "line-through text-on-surface-variant dark:text-outline-variant";
          opacityClass = "opacity-60";
          imageGreyscale = "grayscale";
        }

        // Cancel Option Logic inside Dropdown
        const now = new Date();
        const appointmentTime = new Date(booking.exactDateTime);
        const diffInMs = appointmentTime - now;
        const diffInMinutes = diffInMs / (1000 * 60);

        let cancelOptionDropdownHtml = '';
        if (booking.status === 'upcoming') {
          if (diffInMinutes <= 30 && diffInMinutes > 0) {
            cancelOptionDropdownHtml = `
              <button disabled title="Cannot cancel within 30mins due to platform rules" class="w-full text-left px-md py-sm opacity-50 cursor-not-allowed text-on-surface-variant dark:text-outline-variant flex flex-col border-t border-soft-border dark:border-outline-variant/10">
                <span class="flex items-center gap-xs"><span class="material-symbols-outlined text-[18px]">block</span> Cancel</span>
                <span class="text-[10px] text-on-surface-variant/70 dark:text-outline-variant/70 pl-6">Platform rule: < 30 mins</span>
              </button>`;
          } else {
            cancelOptionDropdownHtml = `
              <button onclick="cancelAppointment(${booking.id}); hideAllMenus();" class="w-full text-left px-md py-sm hover:bg-error-container/20 text-error-red dark:text-error-container flex items-center gap-xs transition-colors border-t border-soft-border dark:border-outline-variant/10">
                <span class="material-symbols-outlined text-[18px]">cancel</span> Cancel
              </button>`;
          }
        }

        return `
          <div class="bg-surface dark:bg-surface-container-high/40 rounded-xl p-md shadow-sm border border-soft-border dark:border-outline-variant/10 hover:shadow-md transition-shadow relative overflow-visible group">
            
            <div class="absolute top-0 right-0 px-md py-xs font-label-sm text-label-sm rounded-bl-lg transition-colors ${ribbonClass} z-10">
              ${ribbonText}
            </div>
            
            <div class="flex flex-col md:flex-row gap-lg items-start md:items-center ${opacityClass}">
              <!-- Date Column -->
              <div class="flex flex-col min-w-[120px]">
                <span class="font-label-sm text-label-sm text-on-surface-variant dark:text-outline-variant mb-xs transition-colors">DATE</span>
                <span class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white mb-xs ${booking.status === 'cancelled' ? 'line-through' : ''} transition-colors">${booking.date}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant transition-colors">${booking.time}</span>
              </div>
              
              <!-- Desktop Divider -->
              <div class="hidden md:block w-px h-16 bg-soft-border dark:bg-outline-variant/20 transition-colors"></div>
              
              <!-- Provider Info -->
              <div class="flex items-center gap-md flex-1 w-full">
                <img class="w-16 h-16 rounded-full object-cover shadow-sm ${imageGreyscale} shrink-0" alt="${booking.provider}" src="${booking.img}" />
                <div class="min-w-0">
                  <h3 class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white transition-colors truncate">${booking.provider}</h3>
                  <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant flex items-center gap-xs transition-colors truncate mt-1">
                    <span class="material-symbols-outlined text-[16px] shrink-0">location_on</span>
                    <span class="truncate">${booking.location}</span>
                  </p>
                </div>
              </div>
              
              <!-- Service Description & Price -->
              <div class="flex-1 w-full mt-4 md:mt-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
                <div>
                  <h4 class="font-label-md text-label-md text-on-surface dark:text-parchment-white mb-xs transition-colors truncate">${booking.service}</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant transition-colors line-clamp-2 md:line-clamp-none">${booking.desc}</p>
                </div>
                <div class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white ${priceStrikethrough} transition-colors shrink-0">
                  ${booking.price}
                </div>
              </div>

              <!-- Manage Button & Dropdown Menu -->
              <div class="relative manage-dropdown-container self-end md:self-center shrink-0">
                <!-- Clean Manage button without small arrow icon -->
                <button onclick="toggleManageMenu(${booking.id}, event)" class="px-md py-sm rounded-full font-label-md text-label-md border border-soft-border dark:border-outline-variant/30 text-on-surface dark:text-parchment-white hover:bg-surface-container dark:hover:bg-primary-container transition-colors flex items-center justify-center">
                  Manage
                </button>
                
                <!-- Dropdown Menu Content -->
                <div id="manage-menu-${booking.id}" class="hidden absolute right-0 mt-2 w-48 bg-surface-container-lowest dark:bg-charcoal border border-soft-border dark:border-outline-variant/20 rounded-xl shadow-xl z-30 py-xs text-body-sm font-body-sm">
                  <button onclick="viewDetails(${booking.id}); hideAllMenus();" class="w-full text-left px-md py-sm hover:bg-surface-container dark:hover:bg-primary-container text-on-surface dark:text-parchment-white flex items-center gap-xs transition-colors">
                    <span class="material-symbols-outlined text-[18px]">visibility</span> View Details
                  </button>
                  <button onclick="rebookVendor(${booking.id}); hideAllMenus();" class="w-full text-left px-md py-sm hover:bg-surface-container dark:hover:bg-primary-container text-on-surface dark:text-parchment-white flex items-center gap-xs transition-colors">
                    <span class="material-symbols-outlined text-[18px]">refresh</span> Rebook
                  </button>
                  <button onclick="reportIssue(${booking.id}); hideAllMenus();" class="w-full text-left px-md py-sm hover:bg-surface-container dark:hover:bg-primary-container text-on-surface dark:text-parchment-white flex items-center gap-xs transition-colors">
                    <span class="material-symbols-outlined text-[18px]">flag</span> Report
                  </button>
                  ${cancelOptionDropdownHtml}
                </div>
              </div>

            </div>
          </div>
        `;
      }
    