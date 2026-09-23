document.addEventListener('DOMContentLoaded', () => {
    
    // --- Theme Switcher Logic (Passive Listener) ---
    const currentMode = localStorage.getItem("themeMode");

    if (currentMode === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }

    // --- Favorite / Unfavorite Card Removal Logic ---
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    
    favoriteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const vendorCard = btn.closest('.group');
            
            if (vendorCard) {
                vendorCard.style.transition = 'all 0.3s ease-in-out';
                vendorCard.style.opacity = '0';
                vendorCard.style.transform = 'scale(0.9)';
                
                setTimeout(() => {
                    vendorCard.remove();
                    checkEmptyFavorites();
                }, 300);
            }
        });
    });

    function checkEmptyFavorites() {
        const gridContainer = document.querySelector('.grid');
        const remainingCards = gridContainer ? gridContainer.querySelectorAll('.group') : [];
        
        if (remainingCards.length === 0 && gridContainer) {
            gridContainer.classList.remove('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');
            gridContainer.innerHTML = `
                <div class="col-span-full py-xl text-center flex flex-col items-center justify-center gap-base">
                    <span class="material-symbols-outlined text-[48px] text-on-surface-variant dark:text-outline-variant">heart_broken</span>
                    <h2 class="font-headline-md text-headline-md text-on-surface dark:text-parchment-white">No favorites saved yet</h2>
                    <p class="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant">Explore the marketplace to find and save your favorite professionals.</p>
                    <a href="marketplace.html" class="mt-base bg-charcoal dark:bg-parchment-white text-on-primary dark:text-charcoal rounded-lg px-md py-sm font-label-md text-label-md hover:bg-surface-tint transition-colors">Explore Marketplace</a>
                </div>
            `;
        }
    }
});