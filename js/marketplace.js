// --- Theme Initialization Logic ---
function setTheme(mode) {
  if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Retrieve the mode saved on page load (defaults to light so it doesn't force dark mode)
document.addEventListener("DOMContentLoaded", () => {
  const currentMode = localStorage.getItem("themeMode") || "light";
  setTheme(currentMode);
});

// --- Dynamic Interactive Logics ---
document.addEventListener('DOMContentLoaded', () => {

  // Add to Cart Logic 
  function attachAddToCartEvent(btn) {
    if (!btn) return;
    btn.addEventListener('click', function(e) {
      e.preventDefault(); 
      if (this.classList.contains('bg-success-green')) return;

      const originalHTML = this.innerHTML;
      this.innerHTML = '<span class="material-symbols-outlined text-[16px]">check</span> Added';
      
      this.classList.remove('bg-charcoal', 'dark:bg-parchment-white', 'text-on-primary', 'dark:text-charcoal', 'hover:bg-primary', 'dark:hover:bg-surface-container-highest');
      this.classList.add('bg-success-green', 'text-white', 'dark:bg-success-green', 'dark:text-white');

      setTimeout(() => {
        this.innerHTML = originalHTML;
        this.classList.remove('bg-success-green', 'text-white', 'dark:bg-success-green', 'dark:text-white');
        this.classList.add('bg-charcoal', 'dark:bg-parchment-white', 'text-on-primary', 'dark:text-charcoal', 'hover:bg-primary', 'dark:hover:bg-surface-container-highest');
      }, 2000);
    });
  }

  // Bind initial cart buttons
  document.querySelectorAll('.add-to-cart-btn').forEach(attachAddToCartEvent);

  // --- Filtering (Search + Price) Logic ---
  const searchInput = document.getElementById('search-input');
  const minPriceInput = document.getElementById('min-price');
  const maxPriceInput = document.getElementById('max-price');
  const productGrid = document.getElementById('product-grid');

  function applyFilters() {
    if (!productGrid) return;
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const minPrice = parseInt(minPriceInput.value) || 0;
    const maxPrice = parseInt(maxPriceInput.value) || Infinity;

    Array.from(productGrid.children).forEach(card => {
      // Find the h3 tag inside the card to use as the product title
      const titleElement = card.querySelector('h3');
      const title = titleElement ? titleElement.textContent.toLowerCase() : '';
      const price = parseInt(card.getAttribute('data-price') || 0);

      // Check if current card matches search and price rules
      const matchesSearch = title.includes(searchTerm);
      const matchesPrice = price >= minPrice && price <= maxPrice;

      if (matchesSearch && matchesPrice) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // Bind filter events
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (minPriceInput) minPriceInput.addEventListener('input', applyFilters);
  if (maxPriceInput) maxPriceInput.addEventListener('input', applyFilters);


  // --- Sort By Filters Logic ---
  const sortSelect = document.getElementById('sort-select');

  if (sortSelect && productGrid) {
    sortSelect.addEventListener('change', (e) => {
      const cards = Array.from(productGrid.children);
      const sortType = e.target.value;

      cards.sort((a, b) => {
        const priceA = parseInt(a.getAttribute('data-price') || 0);
        const priceB = parseInt(b.getAttribute('data-price') || 0);

        if (sortType === 'price-asc') return priceA - priceB;
        if (sortType === 'price-desc') return priceB - priceA;
        return 0; // Fallback for recommended/newest
      });

      productGrid.innerHTML = '';
      cards.forEach(card => productGrid.appendChild(card));
    });
  }

  // --- Load More Products Logic ---
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn && productGrid) {
    loadMoreBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const originalText = this.innerHTML;

      // Simulate loading state
      this.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Loading...';
      this.classList.add("opacity-80", "cursor-not-allowed");

      setTimeout(() => {
        const existingCards = Array.from(productGrid.children);
        
        // Duplicate the first two visible cards for demonstration
        for (let i = 0; i < 2; i++) {
          if (existingCards[i]) {
            const clone = existingCards[i].cloneNode(true);
            attachAddToCartEvent(clone.querySelector('.add-to-cart-btn'));
            productGrid.appendChild(clone);
          }
        }
        
        // Re-apply filters to ensure freshly loaded items obey search/price limits
        applyFilters(); 
        
        // Reset button
        this.innerHTML = originalText;
        this.classList.remove("opacity-80", "cursor-not-allowed");
      }, 1000);
    });
  }
});