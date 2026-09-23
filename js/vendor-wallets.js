document.addEventListener('DOMContentLoaded', () => {

    // --- Theme / Mode Toggle Logic ---
    const themeBtns = document.querySelectorAll('.theme-btn');
    const themeSlider = document.getElementById('theme-slider');
    
    if (themeBtns.length && themeSlider) {
        themeBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                themeSlider.style.transform = `translateX(${index * 100}%)`;
                themeBtns.forEach(b => {
                    b.classList.remove('text-primary');
                    b.classList.add('text-on-surface-variant');
                });
                btn.classList.add('text-primary');
                btn.classList.remove('text-on-surface-variant');
                const mode = btn.getAttribute('data-theme');
                console.log(`Switched to ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`);
            });
        });
    }

    // --- Functional Chart Data & Filter Logic ---
    const chartContainer = document.getElementById('chart-container');
    const filterBtns = document.querySelectorAll('.chart-filter-btn');

    // Mock Data Sets for Different Filters
    const chartDataSets = {
        '6M': [
            { label: 'Apr', value: 340000 },
            { label: 'May', value: 420000 },
            { label: 'Jun', value: 390000 },
            { label: 'Jul', value: 510000 },
            { label: 'Aug', value: 480000 },
            { label: 'Sep', value: 620000 }
        ],
        '1Y': [
            { label: 'Oct', value: 290000 }, { label: 'Nov', value: 310000 },
            { label: 'Dec', value: 550000 }, { label: 'Jan', value: 380000 },
            { label: 'Feb', value: 400000 }, { label: 'Mar', value: 450000 },
            { label: 'Apr', value: 340000 }, { label: 'May', value: 420000 },
            { label: 'Jun', value: 390000 }, { label: 'Jul', value: 510000 },
            { label: 'Aug', value: 480000 }, { label: 'Sep', value: 620000 }
        ],
        'ALL': [
            { label: '2023', value: 1200000 },
            { label: '2024', value: 2800000 },
            { label: '2025', value: 4100000 },
            { label: '2026', value: 3200000 }
        ]
    };

    function formatCurrency(value) {
        if (value >= 1000000) return '₦' + (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return '₦' + (value / 1000).toFixed(0) + 'k';
        return '₦' + value;
    }

    function renderChart(data) {
        if (!chartContainer) return;
        chartContainer.innerHTML = '';
        const maxVal = Math.max(...data.map(d => d.value)) * 1.2; // Add 20% headroom

        data.forEach((item, index) => {
            const heightPct = (item.value / maxVal) * 100;
            const isHighest = item.value === Math.max(...data.map(d => d.value));

            const barHTML = `
                <div class="relative z-20 flex flex-col items-center justify-end h-full w-full group cursor-pointer" onclick="alert('${item.label} Earnings: ₦${item.value.toLocaleString()}')">
                    <div class="w-full ${isHighest ? 'bg-primary shadow-sm' : 'bg-primary/20 group-hover:bg-primary/40'} rounded-t-md relative transition-all duration-700 ease-out flex justify-center" 
                         style="height: 0%;" 
                         data-target-height="${heightPct}%">
                        <div class="absolute -top-10 bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm py-xs px-sm rounded opacity-0 ${isHighest ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity whitespace-nowrap shadow-md pointer-events-none z-30">
                            ${formatCurrency(item.value)}
                        </div>
                    </div>
                    <span class="font-label-sm text-label-sm ${isHighest ? 'text-primary font-bold' : 'text-on-surface-variant'} mt-sm transition-colors duration-300 truncate max-w-full px-1">
                        ${item.label}
                    </span>
                </div>
            `;
            chartContainer.insertAdjacentHTML('beforeend', barHTML);
        });

        // Trigger animation after DOM insertion
        setTimeout(() => {
            const bars = chartContainer.querySelectorAll('[data-target-height]');
            bars.forEach((bar, idx) => {
                setTimeout(() => {
                    bar.style.height = bar.getAttribute('data-target-height');
                }, idx * 30);
            });
        }, 50);
    }
    
    // Filter click events
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => {
                b.classList.remove('bg-surface-container-high', 'text-on-surface');
                b.classList.add('text-on-surface-variant');
            });
            e.target.classList.remove('text-on-surface-variant');
            e.target.classList.add('bg-surface-container-high', 'text-on-surface');

            const filterType = e.target.getAttribute('data-filter');
            renderChart(chartDataSets[filterType]);
        });
    });

    // Initial render
    renderChart(chartDataSets['6M']);

    // --- Modal Logic ---
    const setupModal = (btnId, modalId, closeBtnIds, contentId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        const content = document.getElementById(contentId);
        
        if (!btn || !modal || !content) return;

        const closeBtns = closeBtnIds.map(id => document.getElementById(id)).filter(Boolean);

        const openModal = () => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => {
                content.classList.remove('modal-enter');
                content.classList.add('modal-enter-active');
            }, 10);
        };

        const closeModal = () => {
            content.classList.remove('modal-enter-active');
            content.classList.add('modal-exit-active');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                content.classList.remove('modal-exit-active');
                content.classList.add('modal-enter');
            }, 200);
        };

        btn.addEventListener('click', openModal);
        closeBtns.forEach(cBtn => cBtn.addEventListener('click', closeModal));
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    };

    setupModal('btn-request-payout', 'payout-modal', ['close-payout-modal', 'cancel-payout-btn'], 'payout-modal-content');
    setupModal('btn-view-all', 'view-all-modal', ['close-view-all-modal'], 'view-all-content');

});

// --- Global Functions ---
window.switchRole = function(role) {
    if (role === 'customer') {
        window.location.href = 'vendor customer dashboard.html';
    } else if (role === 'vendor') {
        console.log("Already on Vendor Dashboard");
    }
};

window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('mobile-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('hidden');
    }
};