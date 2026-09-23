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
 * Vendor Reviews Logic
 * Features: Back Navigation, Rating Filter, Sorting Filter, Theme Logic
 */

// Mock Reviews Dataset
const REVIEWS_DATA = [
  {
    id: 1,
    author: "Elena Rostova",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCTDpcrVCWkyns1ocGXIL7fHKDGkrakhTzm4feBBoY4tEMGi-HiqGYpX0AIEqUC2BNp-qrrJkC1BdRK9daI5p2v1e9VDDZJqB5qACzTlF9F3xP9xsIWrWbMc7TmQS-JVjvkY4L2yEjBvH3dC_CkgQ97UGh28zmf-53uiyCuCV_j6YhrGoI2x2Y1iFl_VuPPBRw3HeESyjJ0JJlcgMC_tldnOHRNlcISUZ0RwPJrWHvnaHnvzv6NBVE6",
    date: "2023-10-24",
    formattedDate: "Oct 24, 2023",
    rating: 5,
    content: "Impeccable service from start to finish. The attention to detail during the consultation phase was exactly what I was looking for. The space is beautiful and the execution was flawless. Highly recommend for anyone looking for a premium, understated experience.",
    tags: ["Balayage & Tone", "Olaplex Treatment"],
    vendorResponse: null
  },
  {
    id: 2,
    author: "Marcus V.",
    avatarInitials: "M",
    date: "2023-10-18",
    formattedDate: "Oct 18, 2023",
    rating: 4,
    content: "Very clean, professional environment. The cut was precise and exactly to my specifications. My only minor note is that the appointment started about 15 minutes late, but the quality of the work made up for the wait.",
    tags: ["Precision Haircut"],
    vendorResponse: null
  },
  {
    id: 3,
    author: "Jordan Kim",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBGpVtv3Ll0VEbMyhIVdeKVOJC-R2GOP8vJEp0dDn6jU0XSpaVyOSiK29rs7xpAZDKrCLXZhPpad3CciCJV8XzIQhm_JNj2-7rUfYUCQBJdNIS__3dnhv-lIvEtAo1rxcWXL-YR3HW_TolZLXtmnIhG2ZDDNK9NhB_Lb0xZLkZ-VICfGN5Ia-GrvNo4Be1_hEXOZRNM-yeLtLVJtisaLriQtGkfDhGlDYeK965RDJg85Q4gf3mFuHXH",
    date: "2023-09-02",
    formattedDate: "Sep 02, 2023",
    rating: 5,
    content: "An absolute masterclass in aesthetic styling. They understand structure and form better than anyone else I've visited in the city. The minimalist studio vibe perfectly matches their no-nonsense, high-impact approach to beauty.",
    tags: ["Aesthetic Styling"],
    vendorResponse: "Thank you, Jordan. It's always a pleasure working with clients who appreciate architectural precision in styling. Looking forward to our next session."
  },
  {
    id: 4,
    author: "Sophia L.",
    avatarInitials: "S",
    date: "2023-08-15",
    formattedDate: "Aug 15, 2023",
    rating: 3,
    content: "Decent overall experience. The environment was lovely, but the color turned out slightly warmer than the reference photos we discussed during consultation.",
    tags: ["Hair Coloring"],
    vendorResponse: "Thank you for the feedback, Sophia! We'd love to have you back for a quick gloss adjustment free of charge."
  },
  {
    id: 5,
    author: "David K.",
    avatarInitials: "D",
    date: "2023-07-20",
    formattedDate: "Jul 20, 2023",
    rating: 2,
    content: "The venue is great, but communication was poor before the appointment. Showed up on time but had to wait 30 minutes without an explanation.",
    tags: ["Consultation"],
    vendorResponse: null
  },
  {
    id: 6,
    author: "Rachel M.",
    avatarInitials: "R",
    date: "2023-06-11",
    formattedDate: "Jun 11, 2023",
    rating: 1,
    content: "Disappointed with the customer service. Appointment was rescheduled twice on short notice.",
    tags: ["Styling"],
    vendorResponse: null
  }
];

// State
let currentRatingFilter = 'all';
let currentSort = 'recent';

// DOM Elements
const backButton = document.getElementById('back-button');
const reviewsFeed = document.getElementById('reviews-feed');
const ratingFilterContainer = document.getElementById('rating-filters');
const sortDropdownBtn = document.getElementById('sort-dropdown-btn');
const sortMenu = document.getElementById('sort-menu');
const currentSortLabel = document.getElementById('current-sort-label');
const loadMoreBtn = document.getElementById('load-more-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupBackButton();
  setupRatingFilters();
  setupSortFilter();
  renderReviews();
});

/**
 * 1. Back Button Functionality
 */
function setupBackButton() {
  if (!backButton) return;
  backButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (document.referrer && window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback destination if no history exists
      window.location.href = 'vendor-profile.html';
    }
  });
}

/**
 * 2. Filter Option 1: Rating Filter Pills
 */
function setupRatingFilters() {
  if (!ratingFilterContainer) return;
  const buttons = ratingFilterContainer.querySelectorAll('button');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      currentRatingFilter = button.getAttribute('data-rating');

      // Update button styling states
      buttons.forEach((btn) => {
        btn.className = "px-6 py-2.5 rounded-full hover:bg-surface-container/50 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-all flex items-center gap-1 cursor-pointer";
      });

      button.className = "px-6 py-2.5 rounded-full bg-surface-container-lowest shadow-sm font-label-md text-label-md text-primary transition-all flex items-center gap-2 cursor-pointer";

      // Re-render feed with filtered results
      renderReviews();
    });
  });
}

/**
 * 3. Filter Option 2: Sort Dropdown Logic
 */
function setupSortFilter() {
  if (!sortDropdownBtn || !sortMenu) return;

  // Toggle menu visibility
  sortDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sortMenu.classList.toggle('hidden');
  });

  // Close menu on outside click
  document.addEventListener('click', () => {
    if (!sortMenu.classList.contains('hidden')) {
      sortMenu.classList.add('hidden');
    }
  });

  // Handle sort option selection
  const sortOptions = sortMenu.querySelectorAll('button');
  sortOptions.forEach((option) => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      currentSort = option.getAttribute('data-sort');
      currentSortLabel.textContent = option.textContent.trim();
      sortMenu.classList.add('hidden');

      // Re-render feed with sorted results
      renderReviews();
    });
  });
}

/**
 * Core Render Engine
 */
function renderReviews() {
  if (!reviewsFeed) return;

  // 1. Filter by rating
  let filtered = REVIEWS_DATA.filter((item) => {
    if (currentRatingFilter === 'all') return true;
    return item.rating === parseInt(currentRatingFilter, 10);
  });

  // 2. Sort by selected criterion
  filtered.sort((a, b) => {
    if (currentSort === 'recent') {
      return new Date(b.date) - new Date(a.date);
    } else if (currentSort === 'highest') {
      return b.rating - a.rating;
    } else if (currentSort === 'lowest') {
      return a.rating - b.rating;
    }
    return 0;
  });

  // Clear current items
  reviewsFeed.innerHTML = '';

  // Handle Empty State
  if (filtered.length === 0) {
    reviewsFeed.innerHTML = `
      <div class="bg-surface-container-lowest shadow-sm rounded-xl p-lg text-center flex flex-col items-center justify-center min-h-[200px]">
        <span class="material-symbols-outlined text-[36px] text-on-surface-variant mb-2">rate_review</span>
        <p class="font-headline-md text-headline-md text-primary">No reviews found</p>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1">There are no ${currentRatingFilter}-star reviews available for this vendor yet.</p>
      </div>
    `;
    return;
  }

  // Render cards
  filtered.forEach((review) => {
    const card = document.createElement('div');
    card.className = "bg-surface-container-lowest shadow-sm rounded-xl p-md lg:p-lg flex flex-col gap-md transition-transform hover:-translate-y-1 duration-300";

    const avatarHTML = review.avatar
      ? `<div class="w-12 h-12 rounded-full overflow-hidden bg-surface-container shrink-0 shadow-sm">
           <img class="w-full h-full object-cover mix-blend-multiply" src="${review.avatar}" alt="${review.author}"/>
         </div>`
      : `<div class="w-12 h-12 rounded-full flex items-center justify-center bg-primary text-on-primary font-headline-md text-headline-md shrink-0 shadow-sm">
           ${review.avatarInitials}
         </div>`;

    const tagsHTML = review.tags && review.tags.length > 0
      ? `<div class="flex flex-wrap gap-sm mt-2">
           ${review.tags.map(tag => `<span class="inline-flex items-center px-3 py-1 rounded-sm bg-surface-container font-label-sm text-label-sm text-on-surface-variant">${tag}</span>`).join('')}
         </div>`
      : '';

    const responseHTML = review.vendorResponse
      ? `<div class="mt-4 p-md bg-surface-container rounded-lg relative overflow-hidden">
           <div class="absolute left-0 top-0 bottom-0 w-1 bg-secondary opacity-50"></div>
           <span class="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-2">Vendor Response</span>
           <p class="font-body-sm text-body-sm text-on-surface-variant">${review.vendorResponse}</p>
         </div>`
      : '';

    card.innerHTML = `
      <div class="flex items-start justify-between w-full">
        <div class="flex items-center gap-md min-w-0">
          ${avatarHTML}
          <div class="flex flex-col min-w-0">
            <h4 class="font-headline-md text-headline-md text-primary truncate">${review.author}</h4>
            <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mt-1">${review.formattedDate}</span>
          </div>
        </div>
        <div class="flex items-center gap-xs text-warning-amber shrink-0 bg-surface-container-low px-3 py-1.5 rounded-full">
          <span class="font-label-md text-label-md text-primary mr-1">${review.rating.toFixed(1)}</span>
          <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
        </div>
      </div>
      <p class="font-body-lg text-body-lg text-on-surface/90 leading-relaxed max-w-4xl">${review.content}</p>
      ${tagsHTML}
      ${responseHTML}
    `;

    reviewsFeed.appendChild(card);
  });
}

// Load More Interaction
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    loadMoreBtn.textContent = 'All Reviews Loaded';
    loadMoreBtn.disabled = true;
    loadMoreBtn.classList.add('opacity-50', 'cursor-not-allowed');
  });
}