/**
 * Glamora Search & Discovery Page Controller
 * Handles live filtering, search bar popover filter dropdown, pagination,
 * view switching, modal details display, and toast notifications.
 */
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

let currentPage = 1;
const itemsPerPage = 6;

document.addEventListener("DOMContentLoaded", () => {
  initThemeLogic();
  initSearchAndFilterSystem();
});

/**
 * Automatically applies dark/light theme based on system preference or saved preference.
 */
function initThemeLogic() {
  const savedTheme = localStorage.getItem("glamora_theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("glamora_theme")) {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  });
}
/**
 * Toggles mobile drawer navigation.
 */
function toggleMobileSidebar() {
  const sidebar = document.getElementById("mobile-sidebar");
  if (sidebar) {
    sidebar.classList.toggle("hidden");
  }
}

/**
 * Displays toast feedback notifications.
 */
function showToast(message, icon = "check_circle") {
  const toast = document.getElementById("actionToast");
  const toastMessage = document.getElementById("toastMessage");
  const toastIcon = document.getElementById("toastIcon");

  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  if (toastIcon) toastIcon.textContent = icon;

  toast.classList.remove("opacity-0", "pointer-events-none", "translate-y-24");
  toast.classList.add("opacity-100", "translate-y-0");

  setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "pointer-events-none", "translate-y-24");
  }, 3200);
}

/**
 * Core initialization for Search, Dropdown Filter Popper, Filter Chips, Pagination & View Controls.
 */
function initSearchAndFilterSystem() {
  const searchInput = document.getElementById("global-search-input");
  const filterChips = document.querySelectorAll(".filter-chip");
  const resetFiltersBtn = document.getElementById("reset-filters-btn");
  const filterSummaryBar = document.getElementById("filter-summary-bar");
  const activeFilterLabel = document.getElementById("active-filter-label");
  const clearActiveFilter = document.getElementById("clear-active-filter");
  const resultsCountText = document.getElementById("results-count-text");
  const noResultsState = document.getElementById("no-results-state");
  const resetEmptyBtn = document.getElementById("reset-empty-btn");

  // Search Bar Filter Dropdown Popper Elements
  const searchBarFilterBtn = document.getElementById("search-bar-filter-btn");
  const searchFilterDropdown = document.getElementById("search-filter-dropdown");
  const closeSearchFilterDropdown = document.getElementById("close-search-filter-dropdown");
  const applySearchDropdownFilters = document.getElementById("apply-search-dropdown-filters");
  const resetSearchDropdownFilters = document.getElementById("reset-search-dropdown-filters");
  const searchBarFilterIndicator = document.getElementById("search-bar-filter-indicator");

  // Dropdown Input Controls
  const locationSelect = document.getElementById("search-filter-location");
  const maxPriceSelect = document.getElementById("search-filter-max-price");
  const deliverySelect = document.getElementById("search-filter-delivery");
  const categorySelect = document.getElementById("search-filter-category");
  const promoCheckbox = document.getElementById("search-filter-promo");
  const ratingSelect = document.getElementById("search-filter-rating");

  // View switchers
  const viewSplitBtn = document.getElementById("view-split-btn");
  const viewListBtn = document.getElementById("view-list-btn");
  const resultsColumn = document.getElementById("results-column");
  const mapColumn = document.getElementById("map-column");

  // State
  let activeChip = "all";
  let dropdownFilters = {
    location: "all",
    maxPrice: "all",
    delivery: "all",
    category: "all",
    promoOnly: false,
    rating: "all"
  };

  // Toggle Search Filter Dropdown Popper
  if (searchBarFilterBtn && searchFilterDropdown) {
    searchBarFilterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      searchFilterDropdown.classList.toggle("hidden");
    });

    closeSearchFilterDropdown?.addEventListener("click", () => {
      searchFilterDropdown.classList.add("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!searchFilterDropdown.contains(e.target) && !searchBarFilterBtn.contains(e.target)) {
        searchFilterDropdown.classList.add("hidden");
      }
    });
  }

  // Apply Dropdown Filters
  applySearchDropdownFilters?.addEventListener("click", () => {
    dropdownFilters = {
      location: locationSelect ? locationSelect.value : "all",
      maxPrice: maxPriceSelect ? maxPriceSelect.value : "all",
      delivery: deliverySelect ? deliverySelect.value : "all",
      category: categorySelect ? categorySelect.value : "all",
      promoOnly: promoCheckbox ? promoCheckbox.checked : false,
      rating: ratingSelect ? ratingSelect.value : "all"
    };

    const hasActiveDropdownFilters = Object.values(dropdownFilters).some(
      v => v !== "all" && v !== false
    );

    if (searchBarFilterIndicator) {
      if (hasActiveDropdownFilters) {
        searchBarFilterIndicator.classList.remove("hidden");
      } else {
        searchBarFilterIndicator.classList.add("hidden");
      }
    }

    searchFilterDropdown.classList.add("hidden");
    currentPage = 1;
    applyAllFilters();
    showToast("Search filters applied");
  });

  // Reset Dropdown Filters
  resetSearchDropdownFilters?.addEventListener("click", () => {
    if (locationSelect) locationSelect.value = "all";
    if (maxPriceSelect) maxPriceSelect.value = "all";
    if (deliverySelect) deliverySelect.value = "all";
    if (categorySelect) categorySelect.value = "all";
    if (promoCheckbox) promoCheckbox.checked = false;
    if (ratingSelect) ratingSelect.value = "all";

    dropdownFilters = {
      location: "all",
      maxPrice: "all",
      delivery: "all",
      category: "all",
      promoOnly: false,
      rating: "all"
    };

    if (searchBarFilterIndicator) {
      searchBarFilterIndicator.classList.add("hidden");
    }

    currentPage = 1;
    applyAllFilters();
  });

  // Master Filter Calculation Engine
  function applyAllFilters() {
    const cards = Array.from(document.querySelectorAll(".service-card"));
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    let visibleCount = 0;
    const matchingCards = [];

    cards.forEach((card) => {
      const title = card.getAttribute("data-title")?.toLowerCase() || "";
      const vendor = card.getAttribute("data-vendor")?.toLowerCase() || "";
      const category = card.getAttribute("data-category") || "";
      const delivery = card.getAttribute("data-delivery") || "";
      const location = card.getAttribute("data-location") || "";
      const price = parseInt(card.getAttribute("data-price") || "0", 10);
      const isPromo = card.getAttribute("data-promo") === "true";
      const rating = parseFloat(card.getAttribute("data-rating") || "0");

      // 1. Check Search Query
      const matchesSearch = !query || title.includes(query) || vendor.includes(query) || location.includes(query);

      // 2. Check Filter Chips
      let matchesChip = true;
      if (activeChip === "promo") matchesChip = isPromo;
      else if (activeChip === "home-service") matchesChip = delivery === "home";
      else if (activeChip === "in-studio") matchesChip = delivery === "studio";
      else if (activeChip === "under-25k") matchesChip = price <= 25000;

      // 3. Check Dropdown Filters
      const matchesLocation = dropdownFilters.location === "all" || location === dropdownFilters.location;
      const matchesMaxPrice = dropdownFilters.maxPrice === "all" || price <= parseInt(dropdownFilters.maxPrice, 10);
      const matchesDelivery = dropdownFilters.delivery === "all" || delivery === dropdownFilters.delivery;
      const matchesCategory = dropdownFilters.category === "all" || category === dropdownFilters.category;
      const matchesPromoOnly = !dropdownFilters.promoOnly || isPromo;
      const matchesRating = dropdownFilters.rating === "all" || rating >= parseFloat(dropdownFilters.rating);

      const isMatch = matchesSearch && matchesChip && matchesLocation && matchesMaxPrice && matchesDelivery && matchesCategory && matchesPromoOnly && matchesRating;

      if (isMatch) {
        matchingCards.push(card);
        visibleCount++;
      }
    });

    // Handle Pagination for matching cards
    renderPagination(matchingCards);

    // Update Result Stats & Bar Summaries
    if (resultsCountText) {
      resultsCountText.innerHTML = `<span class="material-symbols-outlined text-sage text-[18px]">verified_user</span> Showing ${visibleCount} verified treatment${visibleCount !== 1 ? 's' : ''}`;
    }

    if (activeChip !== "all" || query || Object.values(dropdownFilters).some(v => v !== "all" && v !== false)) {
      if (filterSummaryBar) filterSummaryBar.classList.remove("hidden");
      if (filterSummaryBar) filterSummaryBar.classList.add("flex");
      if (activeFilterLabel) {
        let labelText = activeChip !== "all" ? getChipLabel(activeChip) : "Filtered Results";
        if (query) labelText += ` • "${query}"`;
        activeFilterLabel.textContent = labelText;
      }
    } else {
      if (filterSummaryBar) filterSummaryBar.classList.add("hidden");
      if (filterSummaryBar) filterSummaryBar.classList.remove("flex");
    }

    // Toggle Map pins visibility based on matching IDs
    const matchingIds = matchingCards.map(c => c.getAttribute("data-id"));
    document.querySelectorAll(".map-pin").forEach((pin) => {
      const pinId = pin.getAttribute("data-serv-id");
      if (matchingIds.includes(pinId)) {
        pin.style.opacity = "1";
        pin.style.pointerEvents = "auto";
      } else {
        pin.style.opacity = "0.3";
        pin.style.pointerEvents = "none";
      }
    });
  }

  /**
   * Renders functional pagination buttons and toggles card visibility by page.
   */
  function renderPagination(matchingCards) {
    const totalItems = matchingCards.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // Hide all service cards first
    const allCards = document.querySelectorAll(".service-card");
    allCards.forEach((c) => c.classList.add("hidden"));

    if (totalItems === 0) {
      if (noResultsState) noResultsState.classList.remove("hidden");
      const pagBar = document.getElementById("pagination-bar");
      if (pagBar) pagBar.classList.add("hidden");
      return;
    } else {
      if (noResultsState) noResultsState.classList.add("hidden");
      const pagBar = document.getElementById("pagination-bar");
      if (pagBar) pagBar.classList.remove("hidden");
    }

    // Calculate Slice Range
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    // Reveal active page cards
    const pageCards = matchingCards.slice(startIndex, endIndex);
    pageCards.forEach((card) => card.classList.remove("hidden"));

    // Update Pagination Info Text
    const paginationText = document.getElementById("pagination-text");
    if (paginationText) {
      paginationText.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} Verified Services`;
    }

    // Rebuild Pagination Buttons
    const controlsContainer = document.getElementById("pagination-controls");
    if (controlsContainer) {
      let controlsHTML = `
        <button id="prev-page-btn" class="w-8 h-8 rounded-lg border border-soft-border ${currentPage === 1 ? 'bg-surface-container-low text-outline cursor-not-allowed' : 'bg-surface-container hover:bg-surface-container-high text-charcoal cursor-pointer'} flex items-center justify-center font-label-sm transition-colors" ${currentPage === 1 ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
      `;

      for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
          controlsHTML += `
            <button class="page-num-btn w-8 h-8 rounded-lg bg-charcoal text-on-primary flex items-center justify-center font-label-sm shadow-xs font-bold" data-page="${i}">${i}</button>
          `;
        } else {
          controlsHTML += `
            <button class="page-num-btn w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-charcoal flex items-center justify-center font-label-sm transition-colors cursor-pointer" data-page="${i}">${i}</button>
          `;
        }
      }

      controlsHTML += `
        <button id="next-page-btn" class="w-8 h-8 rounded-lg border border-soft-border ${currentPage === totalPages ? 'bg-surface-container-low text-outline cursor-not-allowed' : 'bg-surface-container hover:bg-surface-container-high text-charcoal cursor-pointer'} flex items-center justify-center font-label-sm transition-colors" ${currentPage === totalPages ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      `;

      controlsContainer.innerHTML = controlsHTML;

      // Attach Click Listeners to newly generated pagination buttons
      document.getElementById("prev-page-btn")?.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          renderPagination(matchingCards);
          document.getElementById("results-column")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

      document.getElementById("next-page-btn")?.addEventListener("click", () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderPagination(matchingCards);
          document.getElementById("results-column")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

      document.querySelectorAll(".page-num-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const pageNum = parseInt(e.currentTarget.getAttribute("data-page"), 10);
          if (pageNum && pageNum !== currentPage) {
            currentPage = pageNum;
            renderPagination(matchingCards);
            document.getElementById("results-column")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }
  }

  function getChipLabel(filterKey) {
    switch (filterKey) {
      case "promo": return "Promo & Discounts";
      case "home-service": return "Home Service Available";
      case "in-studio": return "In-Studio Only";
      case "under-25k": return "Under ₦25,000";
      default: return "All Services";
    }
  }

  // Input Search Listener
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentPage = 1;
      applyAllFilters();
    });
  }

  // Filter Chips Listeners
  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => {
        c.classList.remove("active-chip", "bg-charcoal", "text-on-primary");
        c.classList.add("bg-surface-container-lowest", "text-on-surface-variant", "border", "border-soft-border");
      });

      chip.classList.add("active-chip", "bg-charcoal", "text-on-primary");
      chip.classList.remove("bg-surface-container-lowest", "text-on-surface-variant", "border", "border-soft-border");

      activeChip = chip.getAttribute("data-filter") || "all";
      currentPage = 1;
      applyAllFilters();
    });
  });

  // Reset Button
  const resetAll = () => {
    activeChip = "all";
    if (searchInput) searchInput.value = "";
    filterChips.forEach((c) => {
      if (c.getAttribute("data-filter") === "all") {
        c.classList.add("active-chip", "bg-charcoal", "text-on-primary");
        c.classList.remove("bg-surface-container-lowest", "text-on-surface-variant");
      } else {
        c.classList.remove("active-chip", "bg-charcoal", "text-on-primary");
        c.classList.add("bg-surface-container-lowest", "text-on-surface-variant");
      }
    });

    if (resetSearchDropdownFilters) resetSearchDropdownFilters.click();
    currentPage = 1;
    applyAllFilters();
    showToast("Filters reset to default");
  };

  resetFiltersBtn?.addEventListener("click", resetAll);
  clearActiveFilter?.addEventListener("click", resetAll);
  resetEmptyBtn?.addEventListener("click", resetAll);

  // View switchers (Split Map vs Grid Only)
  if (viewSplitBtn && viewListBtn && resultsColumn && mapColumn) {
    viewSplitBtn.addEventListener("click", () => {
      viewSplitBtn.className = "px-3.5 py-1 rounded-full bg-surface-container-lowest text-charcoal shadow-xs font-label-sm flex items-center gap-1.5 transition-all cursor-pointer";
      viewListBtn.className = "px-3.5 py-1 rounded-full text-on-surface-variant font-label-sm flex items-center gap-1.5 hover:text-charcoal transition-all cursor-pointer";

      resultsColumn.className = "col-span-12 lg:col-span-7 flex flex-col gap-6";
      mapColumn.classList.remove("hidden");
      showToast("Split map view activated");
    });

    viewListBtn.addEventListener("click", () => {
      viewListBtn.className = "px-3.5 py-1 rounded-full bg-surface-container-lowest text-charcoal shadow-xs font-label-sm flex items-center gap-1.5 transition-all cursor-pointer";
      viewSplitBtn.className = "px-3.5 py-1 rounded-full text-on-surface-variant font-label-sm flex items-center gap-1.5 hover:text-charcoal transition-all cursor-pointer";

      resultsColumn.className = "col-span-12 flex flex-col gap-6";
      mapColumn.classList.add("hidden");
      showToast("Grid-only view activated");
    });
  }

  // Bookmark Toggle Buttons
  document.querySelectorAll(".bookmark-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const icon = btn.querySelector(".material-symbols-outlined");
      if (icon) {
        if (icon.textContent === "bookmark_border") {
          icon.textContent = "bookmark";
          btn.classList.add("text-sage");
          showToast("Treatment saved to bookmarks", "bookmark");
        } else {
          icon.textContent = "bookmark_border";
          btn.classList.remove("text-sage");
          showToast("Treatment removed from bookmarks", "bookmark_border");
        }
      }
    });
  });

  // Modal Detail Dialog Logic
  initModalListeners();

  // Initial Filter Pass
  applyAllFilters();
}

/**
 * Service Modal Display Logic
 */
function openServiceModalById(servId) {
  const card = document.querySelector(`.service-card[data-id="${servId}"]`);
  if (!card) return;

  const modal = document.getElementById("service-detail-modal");
  const panel = document.getElementById("modal-dialog-panel");

  const title = card.getAttribute("data-title") || "";
  const vendor = card.getAttribute("data-vendor") || "";
  const price = parseInt(card.getAttribute("data-price") || "0", 10);
  const rating = card.getAttribute("data-rating") || "";
  const duration = card.getAttribute("data-duration") || "90";
  const category = card.getAttribute("data-category") || "";
  const delivery = card.getAttribute("data-delivery") || "studio";
  const imgSrc = card.querySelector("img")?.src || "";

  document.getElementById("modal-service-title").textContent = title;
  document.getElementById("modal-vendor-name").textContent = vendor;
  document.getElementById("modal-price-full").textContent = `₦${price.toLocaleString()}`;
  document.getElementById("modal-price-strike").textContent = `₦${Math.round(price * 1.18).toLocaleString()}`;
  document.getElementById("modal-duration").textContent = `${duration} mins`;
  document.getElementById("modal-deposit-calc").textContent = `₦${Math.round(price * 0.25).toLocaleString()} escrow bond deposit`;

  const imgElem = document.getElementById("modal-service-img");
  if (imgElem) imgElem.src = imgSrc;

  const catBadge = document.getElementById("modal-category-badge");
  if (catBadge) {
    catBadge.textContent = category === "hair" ? "Hair Architecture" : category === "scalp-skin" ? "Dermal Care" : "Nail Artistry";
  }

  const deliveryTitle = document.getElementById("modal-delivery-title");
  const deliveryDesc = document.getElementById("modal-delivery-desc");
  if (deliveryTitle && deliveryDesc) {
    if (delivery === "home") {
      deliveryTitle.textContent = "Home Service Available";
      deliveryDesc.textContent = "Specialist travels to your location with full sanitization station.";
    } else {
      deliveryTitle.textContent = "In-Studio Experience";
      deliveryDesc.textContent = "Private clinical chair session at verified partner facility.";
    }
  }

  modal.classList.remove("opacity-0", "pointer-events-none");
  panel.classList.remove("scale-95");
  panel.classList.add("scale-100");
}

function initModalListeners() {
  const modal = document.getElementById("service-detail-modal");
  const panel = document.getElementById("modal-dialog-panel");
  const closeBtn = document.getElementById("close-modal-btn");
  const cancelBtn = document.getElementById("modal-cancel-btn");

  const closeModal = () => {
    if (!modal) return;
    panel?.classList.remove("scale-100");
    panel?.classList.add("scale-95");
    modal.classList.add("opacity-0", "pointer-events-none");
  };

  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal?.classList.contains("opacity-0")) {
      closeModal();
    }
  });

  document.querySelectorAll(".open-modal-trigger, .service-card").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      if (e.target.closest("a") || e.target.closest(".bookmark-btn")) return;
      const card = trigger.closest(".service-card") || trigger;
      const servId = card.getAttribute("data-id");
      if (servId) openServiceModalById(servId);
    });
  });
}