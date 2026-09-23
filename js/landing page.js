document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================================================
       1. 5-Second Splash Screen Handler
       ========================================================================== */
// --- 1. Splash Screen Logic (5 Seconds) ---
      const splashScreen = document.getElementById("splash-screen");
      const mainContent = document.getElementById("main-content");

      window.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
          splashScreen.style.opacity = "0";
          splashScreen.style.visibility = "hidden";
          mainContent.classList.remove("opacity-0");
          document.body.classList.remove("overflow-hidden");
        }, 5000); // 5000ms splash screen duration
      });

    /* ==========================================================================
       2. System & Dark Mode Toggle Handler
       ========================================================================== */
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');

    const savedTheme = localStorage.getItem('glamora-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    function applyTheme(isDark) {
        if (isDark) {
            document.documentElement.classList.add('dark');
            if (themeToggleIcon) themeToggleIcon.textContent = 'dark_mode';
        } else {
            document.documentElement.classList.remove('dark');
            if (themeToggleIcon) themeToggleIcon.textContent = 'light_mode';
        }
    }

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        applyTheme(true);
    } else {
        applyTheme(false);
    }

    themeToggleBtn?.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        applyTheme(isDark);
        localStorage.setItem('glamora-theme', isDark ? 'dark' : 'light');
    });

    /* ==========================================================================
       3. Functional Search & Filter Options
       ========================================================================== */
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const filterPanel = document.getElementById('filter-panel');
    const searchInput = document.getElementById('searchInput');
    const searchSubmitBtn = document.getElementById('searchSubmitBtn');
    const popularTags = document.querySelectorAll('.popular-tag');
    const disciplineCards = document.querySelectorAll('.discipline-card');
    const resetDisciplineBtn = document.getElementById('resetDisciplineFilterBtn');

    filterToggleBtn?.addEventListener('click', () => {
        filterPanel?.classList.toggle('hidden');
    });

    function filterCards() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedLocation = (document.getElementById('filter-location')?.value || '').toLowerCase();
        const selectedSpecialty = (document.getElementById('filter-specialty')?.value || '').toLowerCase();
        const maxPrice = parseFloat(document.getElementById('filter-price')?.value) || Infinity;

        const cards = document.querySelectorAll('#carouselTrack > .carousel-card:not(.clone)');

        cards.forEach((card) => {
            const name = (card.dataset.name || '').toLowerCase();
            const title = (card.dataset.title || '').toLowerCase();
            const category = (card.dataset.category || '').toLowerCase();
            const specialty = (card.dataset.specialty || '').toLowerCase();
            const location = (card.dataset.location || '').toLowerCase();
            const price = parseFloat(card.dataset.price) || 0;

            const matchesQuery = !query || 
                name.includes(query) || 
                title.includes(query) || 
                category.includes(query) || 
                specialty.includes(query) || 
                location.includes(query);

            const matchesLocation = !selectedLocation || location.includes(selectedLocation);
            const matchesSpecialty = !selectedSpecialty || specialty.includes(selectedSpecialty) || category.includes(selectedSpecialty);
            const matchesPrice = price <= maxPrice;

            if (matchesQuery && matchesLocation && matchesSpecialty && matchesPrice) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });

        // Rebuild infinite carousel track with visible cards
        if (window.rebuildCarousel) {
            window.rebuildCarousel();
        }
    }

    searchSubmitBtn?.addEventListener('click', () => {
        filterCards();
    });

    searchInput?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') filterCards();
    });

    document.getElementById('apply-filters')?.addEventListener('click', () => {
        filterCards();
        filterPanel?.classList.add('hidden');
    });

    document.getElementById('reset-filters')?.addEventListener('click', () => {
        if (document.getElementById('filter-location')) document.getElementById('filter-location').value = '';
        if (document.getElementById('filter-specialty')) document.getElementById('filter-specialty').value = '';
        if (document.getElementById('filter-price')) document.getElementById('filter-price').value = '';
        if (searchInput) searchInput.value = '';
        filterCards();
    });

    popularTags.forEach((tag) => {
        tag.addEventListener('click', () => {
            const tagValue = tag.getAttribute('data-tag') || tag.textContent.trim();
            if (searchInput) searchInput.value = tagValue;
            filterCards();
        });
    });

    disciplineCards.forEach((card) => {
        card.addEventListener('click', () => {
            const cat = card.getAttribute('data-category');
            if (searchInput && cat && cat !== 'Other') {
                searchInput.value = cat;
            } else if (searchInput) {
                searchInput.value = '';
            }
            filterCards();
        });
    });

    resetDisciplineBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        filterCards();
    });

    /* ==========================================================================
       4. Infinite Looping Carousel
       ========================================================================== */
    const track = document.getElementById('carouselTrack');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const dotsContainer = document.getElementById('carouselDots');
    const carouselContainer = document.getElementById('rosterCarousel');

    if (track) {
        let originalCards = Array.from(track.querySelectorAll('.carousel-card:not(.clone)'));
        let visibleCards = [];
        let currentIndex = 0;
        let autoPlayInterval = null;
        let isTransitioning = false;

        function getCardsPerView() {
            if (window.innerWidth >= 1024) return 3;
            if (window.innerWidth >= 768) return 2;
            return 1;
        }

        function setupInfiniteTrack() {
            // Remove previous clones
            track.querySelectorAll('.carousel-card.clone').forEach(el => el.remove());

            visibleCards = originalCards.filter(card => card.style.display !== 'none');
            if (visibleCards.length === 0) return;

            // Clone set before and set after for smooth infinite looping
            const clonesBefore = visibleCards.map(card => {
                const clone = card.cloneNode(true);
                clone.classList.add('clone');
                return clone;
            });

            const clonesAfter = visibleCards.map(card => {
                const clone = card.cloneNode(true);
                clone.classList.add('clone');
                return clone;
            });

            clonesBefore.forEach(clone => track.insertBefore(clone, track.firstChild));
            clonesAfter.forEach(clone => track.appendChild(clone));

            currentIndex = visibleCards.length; // Start at first original element
            updatePosition(false);
            createDots();
        }

        function updatePosition(animate = true) {
            const perView = getCardsPerView();
            const stepPercentage = 100 / perView;

            if (animate) {
                track.style.transition = 'transform 0.5s ease-in-out';
                isTransitioning = true;
            } else {
                track.style.transition = 'none';
            }

            const offset = -(currentIndex * stepPercentage);
            track.style.transform = `translateX(${offset}%)`;

            updateDots();
        }

        function createDots() {
            if (!dotsContainer) return;
            dotsContainer.innerHTML = '';
            const total = visibleCards.length;
            if (total === 0) return;

            for (let i = 0; i < total; i++) {
                const dot = document.createElement('button');
                dot.className = `w-2 h-2 rounded-full transition-colors ${i === getActiveDotIndex() ? 'bg-primary' : 'bg-surface-dim'}`;
                dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
                dot.addEventListener('click', () => {
                    if (isTransitioning) return;
                    currentIndex = visibleCards.length + i;
                    updatePosition(true);
                });
                dotsContainer.appendChild(dot);
            }
        }

        function getActiveDotIndex() {
            const total = visibleCards.length;
            if (total === 0) return 0;
            let idx = (currentIndex - total) % total;
            if (idx < 0) idx += total;
            return idx;
        }

        function updateDots() {
            if (!dotsContainer) return;
            const activeIdx = getActiveDotIndex();
            Array.from(dotsContainer.children).forEach((dot, index) => {
                if (index === activeIdx) {
                    dot.classList.remove('bg-surface-dim');
                    dot.classList.add('bg-primary');
                } else {
                    dot.classList.remove('bg-primary');
                    dot.classList.add('bg-surface-dim');
                }
            });
        }

        function nextSlide() {
            if (isTransitioning || visibleCards.length === 0) return;
            currentIndex++;
            updatePosition(true);
        }

        function prevSlide() {
            if (isTransitioning || visibleCards.length === 0) return;
            currentIndex--;
            updatePosition(true);
        }

        track.addEventListener('transitionend', () => {
            isTransitioning = false;
            const total = visibleCards.length;
            if (total === 0) return;

            // Infinite loop boundaries
            if (currentIndex >= total * 2) {
                currentIndex = total;
                updatePosition(false);
            } else if (currentIndex < total) {
                currentIndex = total * 2 - 1;
                updatePosition(false);
            }
        });

        function startAutoPlay() {
            stopAutoPlay();
            autoPlayInterval = setInterval(nextSlide, 3500);
        }

        function stopAutoPlay() {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
        }

        nextBtn?.addEventListener('click', () => {
            nextSlide();
            startAutoPlay();
        });

        prevBtn?.addEventListener('click', () => {
            prevSlide();
            startAutoPlay();
        });

        carouselContainer?.addEventListener('mouseenter', stopAutoPlay);
        carouselContainer?.addEventListener('mouseleave', startAutoPlay);

        window.addEventListener('resize', () => {
            setupInfiniteTrack();
        });

        window.rebuildCarousel = function() {
            setupInfiniteTrack();
        };

        // Initialize Carousel
        setupInfiniteTrack();
        startAutoPlay();
    }
});