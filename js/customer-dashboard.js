function requireCustomerAccess() {
    const token = localStorage.getItem('glamoraToken');
    const user = JSON.parse(localStorage.getItem('glamoraUser') || 'null');

    if (!token || !user) {
        sessionStorage.setItem('glamoraReturnTo', 'customer-dashboard.html');
        window.location.href = 'Auth/login.html';
        return false;
    }

    if (String(user.role || '').toUpperCase() !== 'CUSTOMER') {
        window.location.href = 'vendor-dashboard.html';
        return false;
    }

    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!requireCustomerAccess()) {
        return;
    }
    
    // 1. Theme Initialization
    const applyTheme = () => {
        const selectedMode = localStorage.getItem('themeMode');
        const htmlElement = document.documentElement;
        
        if (selectedMode === 'dark') {
            htmlElement.classList.add('dark');
        } else {
            htmlElement.classList.remove('dark');
        }
    };
    applyTheme();

    // 2. Mobile Sidebar Drawer Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const sidebarBackdrop = document.getElementById('mobile-sidebar-backdrop');

    function openSidebar() {
        if (mobileSidebar && sidebarBackdrop) {
            sidebarBackdrop.classList.remove('hidden');
            setTimeout(() => {
                sidebarBackdrop.classList.add('opacity-100');
                mobileSidebar.classList.remove('-translate-x-full');
            }, 10);
        }
    }

    function closeSidebar() {
        if (mobileSidebar && sidebarBackdrop) {
            mobileSidebar.classList.add('-translate-x-full');
            sidebarBackdrop.classList.remove('opacity-100');
            setTimeout(() => {
                sidebarBackdrop.classList.add('hidden');
            }, 300);
        }
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

    // 3. Platform Rule: Enforce 30-minute Cancellation Window
    const checkCancelRules = () => {
        const cancelButtons = document.querySelectorAll('.cancel-btn');
        const now = new Date();
        
        cancelButtons.forEach(btn => {
            const aptTimeStr = btn.getAttribute('data-appointment-time');
            if (!aptTimeStr) return;
            
            const aptTime = new Date(aptTimeStr);
            const diffMs = aptTime - now;
            const diffMins = diffMs / (1000 * 60);
            
            if (diffMins <= 30) {
                btn.classList.add('opacity-50', 'cursor-not-allowed', 'text-on-surface-variant');
                btn.classList.remove('hover:bg-surface-container-low', 'dark:hover:bg-primary-container', 'text-on-surface', 'dark:text-inverse-on-surface');
                
                btn.setAttribute('aria-label', 'Cannot cancel within 30 mins of appointment');
                btn.classList.add('tooltip');
                
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                };
            }
        });
    };
    
    checkCancelRules();

    // 4. Tooltip Hover Logic
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(btn => {
        btn.addEventListener('mouseenter', (e) => {
            const label = e.currentTarget.getAttribute('aria-label');
            if(!label) return;
            
            const tooltipEl = document.createElement('div');
            tooltipEl.className = 'absolute bottom-full right-0 mb-2 bg-charcoal dark:bg-surface-container-lowest text-on-primary dark:text-on-surface font-label-sm text-xs px-3 py-1 rounded whitespace-nowrap opacity-0 transition-opacity duration-200 pointer-events-none z-50 shadow-lg';
            tooltipEl.innerText = label;
            tooltipEl.id = 'temp-tooltip';
            
            e.currentTarget.style.position = 'relative';
            e.currentTarget.appendChild(tooltipEl);
            
            requestAnimationFrame(() => {
                tooltipEl.style.opacity = '1';
            });
        });
        
        btn.addEventListener('mouseleave', (e) => {
            const tooltipEl = e.currentTarget.querySelector('#temp-tooltip');
            if (tooltipEl) {
                tooltipEl.style.opacity = '0';
                setTimeout(() => tooltipEl.remove(), 200);
            }
        });
    });
});

// Global Handlers
window.toggleManageMenu = function(event, menuId) {
    if(event) event.stopPropagation();
    const menu = document.getElementById(menuId);
    
    if (menu.classList.contains('hidden')) {
        document.querySelectorAll('[id^="manage-menu-"]').forEach(m => {
            m.classList.add('hidden');
            m.classList.remove('flex');
        });
        menu.classList.remove('hidden');
        menu.classList.add('flex');
    } else {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    }
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative')) {
        document.querySelectorAll('[id^="manage-menu-"]').forEach(m => {
            m.classList.add('hidden');
            m.classList.remove('flex');
        });
    }
});

window.openModal = function(modalId) {
    document.querySelectorAll('[id^="manage-menu-"]').forEach(m => {
        m.classList.add('hidden');
        m.classList.remove('flex');
    });

    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.confirmBlockUser = function() {
    window.closeModal('blockConfirmModal');
};

window.proceedToReportDetails = function() {
    window.closeModal('reportConfirmModal');
    window.openModal('reportDetailModal');
};

window.submitReport = function(event) {
    event.preventDefault();
    window.closeModal('reportDetailModal');
};