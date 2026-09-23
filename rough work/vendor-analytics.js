      // --- Theme Switcher Logic (Passive Listener) ---
      document.addEventListener("DOMContentLoaded", () => {
        // Retrieve the mode saved from the landing or settings page
        const currentMode = localStorage.getItem("themeMode");

        // Apply the 'dark' class to the <html> tag for Tailwind compatibility
        if (currentMode === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      });
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

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Data Sources for Dynamic Components ---

    const allPopularServices = [
        { name: "Hair Installation", desc: "Avg duration: 180 min · Premium", bookings: 64, share: 43.2 },
        { name: "Wig Revamp", desc: "Wash, conditioning & restyle", bookings: 32, share: 21.6 },
        { name: "Hair Coloring", desc: "Custom tone matching & balayage", bookings: 16, share: 10.8 },
        { name: "Facial Sculpting & Peel", desc: "Holistic skin rejuvenation", bookings: 12, share: 8.1 },
        { name: "Nail Extension Art", desc: "Gel sculpt & chrome overlay", bookings: 10, share: 6.7 },
        { name: "Classic Lashes", desc: "Mink individual sets", bookings: 6, share: 4.1 },
        { name: "Bridal Makeup Setup", desc: "Full face & contouring", bookings: 4, share: 2.7 },
        { name: "Pedicure Deluxe", desc: "Spa scrub and massage", bookings: 2, share: 1.4 },
        { name: "Eyebrow Tinting", desc: "Shape & semi-permanent tint", bookings: 1, share: 0.7 },
        { name: "Silk Press", desc: "Natural hair straightening", bookings: 1, share: 0.7 }
    ];

    const historicalTrendsData = [
        { id: 0, month: "September 2026", label: "(Current)", revenue: "₦1,450,000", bookings: 112, clients: 148, newVal: 68, newPct: 46, retVal: 80, retPct: 54, isCurrent: true, growth: "" },
        { id: 1, month: "August 2026", label: "Closed", revenue: "₦1,185,000", bookings: 98, clients: 130, newVal: 55, newPct: 42, retVal: 75, retPct: 58, isCurrent: false, growth: "+18.1% growth" },
        { id: 2, month: "July 2026", label: "Closed", revenue: "₦1,003,200", bookings: 84, clients: 114, newVal: 40, newPct: 35, retVal: 74, retPct: 65, isCurrent: false, growth: "Baseline" },
        { id: 3, month: "June 2026", label: "Closed", revenue: "₦980,000", bookings: 80, clients: 108, newVal: 38, newPct: 35, retVal: 70, retPct: 65, isCurrent: false, growth: "Past" }
    ];


    // --- 1. Dynamic Popular Services Logic ---
    
    const serviceLimitSelect = document.getElementById('service-limit-select');
    const popularServicesContainer = document.getElementById('popular-services-container');

    function renderPopularServices(limit) {
        popularServicesContainer.innerHTML = '';
        
        // Header
        const headerHTML = `
            <div class="grid grid-cols-12 gap-sm px-sm py-xs font-label-sm text-label-sm uppercase tracking-wider text-secondary dark:text-sage">
                <span class="col-span-2">Rank</span>
                <span class="col-span-6">Service</span>
                <span class="col-span-4 text-right">Bookings & Share</span>
            </div>
        `;
        popularServicesContainer.insertAdjacentHTML('beforeend', headerHTML);

        // Render constrained items
        const itemsToRender = allPopularServices.slice(0, limit);
        itemsToRender.forEach((service, index) => {
            const rank = index + 1;
            const badgeClass = rank === 1 
                ? "bg-charcoal dark:bg-surface text-on-primary dark:text-charcoal" 
                : "bg-surface-container-high dark:bg-[#404040] text-charcoal dark:text-surface";

            const rowHTML = `
                <div class="grid grid-cols-12 gap-sm items-center p-sm rounded-xl bg-surface-container-low/40 dark:bg-[#363636]/40 hover:bg-surface-container-low dark:hover:bg-[#363636] transition-colors border border-transparent dark:border-outline">
                    <div class="col-span-2 flex items-center">
                        <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg ${badgeClass} font-label-md text-label-md font-semibold">#${rank}</span>
                    </div>
                    <div class="col-span-6 flex flex-col min-w-0">
                        <span class="font-label-md text-label-md text-charcoal dark:text-surface font-semibold truncate">${service.name}</span>
                        <span class="font-body-sm text-body-sm text-secondary dark:text-sage text-[12px]">${service.desc}</span>
                    </div>
                    <div class="col-span-4 flex flex-col items-end">
                        <span class="font-label-md text-label-md text-charcoal dark:text-surface font-semibold">${service.bookings} bookings</span>
                        <div class="flex items-center gap-xs w-full max-w-[110px] justify-end mt-xs">
                            <div class="w-16 bg-surface-container dark:bg-[#404040] h-1.5 rounded-full overflow-hidden">
                                <div class="bg-charcoal dark:bg-surface h-full w-[${service.share}%] rounded-full"></div>
                            </div>
                            <span class="font-label-sm text-label-sm text-secondary dark:text-sage text-[11px]">${service.share}%</span>
                        </div>
                    </div>
                </div>
            `;
            popularServicesContainer.insertAdjacentHTML('beforeend', rowHTML);
        });
    }

    serviceLimitSelect.addEventListener('change', (e) => {
        renderPopularServices(parseInt(e.target.value));
    });

    renderPopularServices(5); // Initial load


    // --- 2. Dynamic Business Trend Matrix Logic ---

    const trendMonthSelect = document.getElementById('trend-month-select');
    const trendFeaturedCard = document.getElementById('trend-featured-card');
    const trendHistoryContainer = document.getElementById('trend-history-container');

    function renderTrendMatrix(selectedIndex) {
        const selectedData = historicalTrendsData[selectedIndex];
        
        // 1. Render Featured Card
        const statusDot = selectedData.isCurrent 
            ? `<span class="w-2.5 h-2.5 rounded-full bg-success-green animate-pulse"></span>` 
            : `<span class="w-2.5 h-2.5 rounded-full bg-outline"></span>`;

        trendFeaturedCard.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-xs">
                    ${statusDot}
                    <span class="font-label-md text-label-md text-charcoal dark:text-surface font-semibold">${selectedData.month} ${selectedData.label}</span>
                </div>
                <span class="font-headline-md text-headline-md text-charcoal dark:text-surface font-bold">${selectedData.revenue}</span>
            </div>
            <div class="grid grid-cols-2 gap-sm pt-xs">
                <div class="flex flex-col">
                    <span class="font-label-sm text-label-sm text-secondary dark:text-sage uppercase tracking-wider">Booking Trends</span>
                    <span class="font-headline-md text-headline-md text-charcoal dark:text-surface font-medium mt-xs">${selectedData.bookings} slots</span>
                    <span class="font-body-sm text-body-sm text-on-surface-variant dark:text-sage text-[12px]">Fulfilled Appointments</span>
                </div>
                <div class="flex flex-col">
                    <span class="font-label-sm text-label-sm text-secondary dark:text-sage uppercase tracking-wider">Customer Volume</span>
                    <span class="font-headline-md text-headline-md text-charcoal dark:text-surface font-medium mt-xs">${selectedData.clients} active</span>
                    <span class="font-body-sm text-body-sm text-on-surface-variant dark:text-sage text-[12px]">Unique Client Profiles</span>
                </div>
            </div>
            <div class="pt-xs flex flex-col gap-xs">
                <div class="flex justify-between font-label-sm text-label-sm text-charcoal dark:text-surface">
                    <span>New: ${selectedData.newVal} (${selectedData.newPct}%)</span>
                    <span>Returning: ${selectedData.retVal} (${selectedData.retPct}%)</span>
                </div>
                <div class="w-full bg-surface-container dark:bg-[#404040] h-2 rounded-full overflow-hidden flex">
                    <div class="bg-secondary h-full" style="width: ${selectedData.newPct}%"></div>
                    <div class="bg-charcoal dark:bg-surface h-full" style="width: ${selectedData.retPct}%"></div>
                </div>
            </div>
        `;

        // 2. Render Historical Benchmarks (Months prior to selected)
        trendHistoryContainer.innerHTML = `<span class="font-label-sm text-label-sm uppercase tracking-wider text-secondary dark:text-sage mb-1 mt-2">Historical Month Benchmarks</span>`;
        
        const priorMonths = historicalTrendsData.slice(selectedIndex + 1, selectedIndex + 3); // Get next 2 previous months
        
        if (priorMonths.length === 0) {
            trendHistoryContainer.insertAdjacentHTML('beforeend', `<span class="text-body-sm text-secondary">No prior data available.</span>`);
        } else {
            priorMonths.forEach(data => {
                const growthColor = data.growth.includes('+') ? 'text-success-green' : 'text-secondary dark:text-sage';
                const rowHTML = `
                    <div class="flex items-center justify-between p-sm rounded-xl bg-surface-container-low/50 dark:bg-[#363636]/50 border border-transparent dark:border-outline">
                        <div class="flex flex-col">
                            <span class="font-label-md text-label-md text-charcoal dark:text-surface font-medium">${data.month}</span>
                            <span class="font-body-sm text-body-sm text-secondary dark:text-sage text-[12px]">${data.bookings} bookings · ${data.clients} clients</span>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="font-label-md text-label-md text-charcoal dark:text-surface font-semibold">${data.revenue}</span>
                            <span class="font-label-sm text-label-sm ${growthColor} font-medium">${data.growth}</span>
                        </div>
                    </div>
                `;
                trendHistoryContainer.insertAdjacentHTML('beforeend', rowHTML);
            });
        }
    }

    trendMonthSelect.addEventListener('change', (e) => {
        renderTrendMatrix(parseInt(e.target.value));
    });

    renderTrendMatrix(0); // Initial load (September)


    // --- Sidebar Mobile Toggle Logic ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
        setTimeout(() => overlay.classList.toggle('opacity-0'), 10);
    }

    mobileMenuBtn?.addEventListener('click', toggleSidebar);
    closeSidebarBtn?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);


    // --- Global Search Logic ---
    const searchInput = document.getElementById('global-search-input');
    const searchDropdown = document.getElementById('search-results-dropdown');

    searchInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 1) {
            searchDropdown.innerHTML = `
                <a href="#" class="block px-sm py-xs hover:bg-surface-container-low dark:hover:bg-[#363636] text-body-sm text-charcoal dark:text-surface border-b border-soft-border dark:border-outline">Result for "${query}" in Earnings</a>
                <a href="#" class="block px-sm py-xs hover:bg-surface-container-low dark:hover:bg-[#363636] text-body-sm text-charcoal dark:text-surface">Result for "${query}" in Schedule</a>
            `;
            searchDropdown.classList.remove('hidden');
            searchDropdown.classList.add('flex');
        } else {
            searchDropdown.classList.add('hidden');
            searchDropdown.classList.remove('flex');
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.classList.add('hidden');
            searchDropdown.classList.remove('flex');
        }
    });


    // --- Chart.js Initialization ---
    const ctx = document.getElementById('revenueChartCanvas');
    if (ctx) {
        // Checking if dark mode is active to adjust chart text colors
        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? '#404040' : '#E2E2DE';
        const textColor = isDark ? '#ffffff' : '#444748';

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Gross Volume',
                    data: [150000, 210000, 180000, 290000, 350000, 420000, 310000],
                    borderColor: isDark ? '#ffffff' : '#2C2C2C',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(44, 44, 44, 0.05)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: isDark ? '#ffffff' : '#2C2C2C',
                    pointBorderColor: isDark ? '#ffffff' : '#2C2C2C'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#363636' : '#1b1c1a',
                        titleFont: { family: 'Hanken Grotesk', size: 12 },
                        bodyFont: { family: 'Hanken Grotesk', size: 14 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [4, 4], color: gridColor, drawBorder: false },
                        ticks: {
                            font: { family: 'Hanken Grotesk', size: 11 },
                            color: textColor,
                            callback: function(value) { return '₦' + (value/1000) + 'k'; }
                        }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { font: { family: 'Hanken Grotesk', size: 11 }, color: textColor }
                    }
                }
            }
        });
    }
});

