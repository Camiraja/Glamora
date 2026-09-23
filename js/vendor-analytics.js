document.addEventListener("DOMContentLoaded", () => {
    initThemeLogic();
    initMobileNav();
    initRoleToggle();
    initDateFilter();
    initExportReport();
    initSearch();
    initLiveChart();
});

/** 1. Theme Persistence Logic */
function initThemeLogic() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const htmlEl = document.documentElement;

    // Read stored preference or fallback to system
    let currentTheme = localStorage.getItem('glamora_theme') || 
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            htmlEl.classList.add('dark');
            if(themeBtn) themeBtn.innerHTML = '<span class="material-symbols-outlined text-[22px]">light_mode</span>';
        } else {
            htmlEl.classList.remove('dark');
            if(themeBtn) themeBtn.innerHTML = '<span class="material-symbols-outlined text-[22px]">dark_mode</span>';
        }
        // Force chart update on theme change to match new contrast colors
        if(window.revenueChart) {
            window.revenueChart.data.datasets[0].borderColor = theme === 'dark' ? '#8A9A8D' : '#536257'; 
            window.revenueChart.update();
        }
    };

    applyTheme(currentTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('glamora_theme', currentTheme);
            applyTheme(currentTheme);
        });
    }
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

/** 3. Role Switcher */
function initRoleToggle() {
    const vendorBtn = document.getElementById('role-vendor');
    const customerBtn = document.getElementById('role-customer');
    
    // Vendor is inherently active here, so we just setup redirect for customer
    if(customerBtn) {
        customerBtn.addEventListener('click', () => {
            window.location.href = 'customer-dashboard.html';
        });
    }
}

/** 4. Functional Date Filter Dropdown */
function initDateFilter() {
    const btn = document.getElementById('filter-date-btn');
    const menu = document.getElementById('filter-dropdown-menu');
    const label = document.getElementById('active-filter-label');
    const options = document.querySelectorAll('.filter-option');

    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
        menu.classList.toggle('flex');
    });

    options.forEach(opt => {
        opt.addEventListener('click', (e) => {
            const val = e.target.getAttribute('data-value');
            label.textContent = val;
            menu.classList.add('hidden');
            menu.classList.remove('flex');
            // Re-render chart to simulate data change
            simulateDataFetch();
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add('hidden');
            menu.classList.remove('flex');
        }
    });
}

/** 5. Functional Export Data execution */
function initExportReport() {
    const exportBtn = document.getElementById('export-report-btn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
        // Change button state visually
        const originalHtml = exportBtn.innerHTML;
        exportBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span><span>Compiling...</span>';
        exportBtn.classList.add('opacity-70', 'cursor-not-allowed');

        setTimeout(() => {
            // Build real mock CSV data string
            const csvContent = "data:text/csv;charset=utf-8," 
                + "Metric,Value,Trend\n"
                + "Total Bookings,148,+14%\n"
                + "Completed Bookings,112,75.6%\n"
                + "Gross Revenue,1450000,+22.4%\n"
                + "New Customers,68,46%\n";

            // Trigger file download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "Glamora_Analytics_Sept_2026.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Restore UI state
            exportBtn.innerHTML = originalHtml;
            exportBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        }, 1200); // simulate compile time
    });
}

/** 6. Live Interactive Search Bar */
function initSearch() {
    const input = document.getElementById('global-search-input');
    const dropdown = document.getElementById('search-results-dropdown');
    
    // Mock dataset representing services, clients, and metrics from the vendor page
    const database = [
        { title: "Hair Installation Booking Trends", type: "Metric", icon: "monitoring" },
        { title: "Wig Revamp", type: "Service", icon: "spa" },
        { title: "Elena Vance Profile Data", type: "Settings", icon: "person" },
        { title: "Escrow Reconciliations", type: "Finance", icon: "account_balance" }
    ];

    if (!input || !dropdown) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        dropdown.innerHTML = '';
        
        if (query.length < 2) {
            dropdown.classList.add('hidden');
            dropdown.classList.remove('flex');
            return;
        }

        const filtered = database.filter(item => item.title.toLowerCase().includes(query));
        
        if (filtered.length > 0) {
            filtered.forEach(item => {
                dropdown.innerHTML += `
                    <a href="#" class="flex items-center gap-sm px-sm py-xs hover:bg-surface-container-low border-b border-soft-border last:border-0 transition-colors">
                        <span class="material-symbols-outlined text-[18px] text-secondary">${item.icon}</span>
                        <div class="flex flex-col">
                            <span class="font-label-md text-label-md text-charcoal">${item.title}</span>
                            <span class="font-body-sm text-body-sm text-[11px] text-on-surface-variant">${item.type}</span>
                        </div>
                    </a>
                `;
            });
        } else {
            dropdown.innerHTML = `<div class="p-sm text-body-sm text-on-surface-variant">No analytics metrics found for "${query}"</div>`;
        }

        dropdown.classList.remove('hidden');
        dropdown.classList.add('flex');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
            dropdown.classList.remove('flex');
        }
    });
}

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
/** Simulate data fetch when filter changes */
function simulateDataFetch() {
    if(!window.revenueChart) return;
    
    // Generate new random variations for the chart
    const newData = Array.from({length: 7}, () => Math.floor(Math.random() * (90000 - 15000 + 1)) + 15000);
    window.revenueChart.data.datasets[0].data = newData;
    window.revenueChart.update();
}