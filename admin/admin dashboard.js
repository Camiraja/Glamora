// --- Theme Switcher Logic (Passive Listener) ---
document.addEventListener("DOMContentLoaded", () => {
    // Retrieve the mode saved from the landing or settings page[cite: 1]
    const currentMode = localStorage.getItem("themeMode");

    // Apply the 'dark' class to the <html> tag for Tailwind compatibility[cite: 1]
    if (currentMode === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
});

// Manual Theme Toggle Button functionality
const themeToggleBtn = document.getElementById("theme-toggle");
if(themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
        if (document.documentElement.classList.contains("dark")) {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("themeMode", "light");
            triggerToast("Switched to Light Mode");
        } else {
            document.documentElement.classList.add("dark");
            localStorage.setItem("themeMode", "dark");
            triggerToast("Switched to Dark Mode");
        }
    });
}


// --- Sidebar & Mobile Menu Logic ---
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar.classList.toggle('-translate-x-full');
    
    // Toggle overlay visibility
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebarOverlay.classList.add('hidden', 'opacity-0');
        sidebarOverlay.classList.remove('block', 'opacity-100');
    } else {
        sidebarOverlay.classList.remove('hidden', 'opacity-0');
        sidebarOverlay.classList.add('block', 'opacity-100');
    }
}

if(openSidebarBtn) openSidebarBtn.addEventListener('click', toggleSidebar);
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
if(sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);


// --- Navigation Active States ---
const navItems = document.querySelectorAll('.nav-item');
const activeClasses = document.getElementById('sidebar-nav').getAttribute('data-active-classes').split(' ');

navItems.forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent jump to top for mockup purposes
        
        // Remove active states from all
        navItems.forEach(nav => {
            nav.classList.remove(...activeClasses);
            nav.classList.add('text-on-surface-variant', 'dark:text-outline-variant', 'hover:bg-surface-container-high', 'dark:hover:bg-surface-tint/20');
        });

        // Add active state to clicked
        this.classList.remove('text-on-surface-variant', 'dark:text-outline-variant', 'hover:bg-surface-container-high', 'dark:hover:bg-surface-tint/20');
        this.classList.add(...activeClasses);
        
        // Mobile cleanup
        if (window.innerWidth < 1024) toggleSidebar();
    });
});


// --- Global Search Simulation ---
const globalSearch = document.getElementById('global-search');
if(globalSearch) {
    globalSearch.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && this.value.trim() !== '') {
            triggerToast(`Searching records for: "${this.value}"`);
            this.value = '';
            this.blur();
        }
    });
}


// --- Filter Buttons (Transaction Velocity) ---
const filterBtns = document.querySelectorAll('.filter-btn');

filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        filterBtns.forEach(f => {
            f.classList.remove('active-filter');
            f.classList.add('inactive-filter');
        });
        this.classList.remove('inactive-filter');
        this.classList.add('active-filter');
        
        triggerToast(`Graph updated: ${this.innerText} window`);
    });
});


// --- Global Toast Logic ---
let toastTimeout;
window.triggerToast = function(message) {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toast-text");
    
    if (!toast || !toastText) return;
    
    clearTimeout(toastTimeout);
    
    toastText.innerText = message;
    
    // Show toast
    toast.classList.remove("opacity-0", "pointer-events-none", "translate-y-2");
    toast.classList.add("opacity-100", "translate-y-0");
    
    // Hide toast
    toastTimeout = setTimeout(() => {
        toast.classList.remove("opacity-100", "translate-y-0");
        toast.classList.add("opacity-0", "pointer-events-none", "translate-y-2");
    }, 3500);
}