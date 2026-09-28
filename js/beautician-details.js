// Sample Vendor Products Dataset (Emptying this array will auto-hide the section)
const vendorProducts = [
  {
    id: "prod_001",
    name: "Restorative Night Serum",
    price: "₦35,000",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuA2Ur2ZkbjstdSohFIZSdBO1nO6e5_mvcJjrUoIXfAECpypAudeCRtAu21pc5taW6vua8WhV3XhkiUBGgBGGa-PXH5ZxGfJ8JF1ikrero0YjIz3Pg05RVkzXC7N_5JGfjlxB6oYM6m9F3GDZX_cXSAbnhQR36G-J0T2efAUeYTPqtHTCl7r3bpCPhoYdpYafD_1F0cMUuOer_tQxnBUz0tOtenn9-YgitQpzU4tqDRGaVWxKY_qloGA"
  },
  {
    id: "prod_002",
    name: "Signature Hair Care Kit",
    price: "₦75,000",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBEEef-ElhMQCfN2_upLVGGrHq0_a9C7G0H6jvN194qTRh6j3nD0K_jSde3LjAJHaB_HVTa_buQ4HG0YKmlfgX3QA__kMBOtpmm3JElXhrZmobJVcNQsjJsxGoCwVuW1wM6kcBDRD-ooPqz37s23lll2C0eKakz31RXhehcnRL1QEqD3H2QWHUeALVm-UpAF766xtjFQdInc0YTKZJJHdJe_GzRNJgAeAvv3d1TuRDOsneWYHk2DirM"
  },
  {
    id: "prod_003",
    name: "Architectural Brow Gel",
    price: "₦15,000",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBhbr9zlND2-fI9zMRw5QxaHseRfRzBAUUSytOoGyz9LhcIv_HBOSx-FgYErMWtn2sut0CF4dfheSKml-_L5vsxf4yq6x_hXHAE-3c-uw2LnMcflxqWBM8nzZOckj6awgSEnjj_YQ8uVel4OlzeBgdlWiHAGZ6nhde1RYK_zVK9H0IFvlpiXFQpzo5mEfOsx5mzMRkSei8c2RdbfNMmv5LzGPE5zlvEFE1eKIfv5QQzykUwP5iTQz0L"
  },
  {
    id: "prod_004",
    name: "Hydrating Facial Mist",
    price: "₦22,000",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCVc93murcJhHYz7JzZuAdvfSduEZF57tetAb71ldirTZUawxK6eiX0vEtbe6JjpZEqL4-GB-jAhILK6n3MiCuBlRUN_Wg7GiVFp3H_5jJeiAaMDhyBieoTs4ke9EoAuYX72e18gzGAmK0fBSyqJhix0m5p9lM2wcA95_xkpHlQfJO9Lf_7uW3IjBuLKRgvlYaw37hDQK3RTUohmraz4wq9_f4-LH77uxqEDnHgoUZvpjfi-UEbFua7"
  }
];
//Mobile Sidebar Drawer Logic
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

function requireLoginForProtectedFlow(returnTo = "beautician-details.html") {
  const token = localStorage.getItem("glamoraToken");
  const user = JSON.parse(localStorage.getItem("glamoraUser") || "null");

  if (!token || !user) {
    sessionStorage.setItem("glamoraReturnTo", returnTo);
    window.location.href = "Auth/login.html";
    return false;
  }

  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  // Theme Switcher Logic
  const currentMode = localStorage.getItem("themeMode");
  if (currentMode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  const protectedLinks = document.querySelectorAll('[data-protected-action], [data-book-now]');
  protectedLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = link.getAttribute("data-book-target") || "booking.html";
      if (!requireLoginForProtectedFlow(target)) {
        event.preventDefault();
      }
    });
  });

  // Initialize Product Display Logic
  renderShopProducts();

  // Close modal when pressing Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProductsModal();
  });

  // Close modal when clicking outside content area
  const modal = document.getElementById("products-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeProductsModal();
    });
  }
});

// Render or hide the Shop Products section dynamically
function renderShopProducts() {
  const section = document.getElementById("shop-products-section");
  const container = document.getElementById("shop-products-container");

  // Condition 1: Hide section entirely if no products exist
  if (!vendorProducts || vendorProducts.length === 0) {
    if (section) section.style.display = "none";
    return;
  }

  // Ensure section is visible
  if (section) section.style.display = "flex";

  // Populate horizontal preview slider
  if (container) {
    container.innerHTML = vendorProducts
      .map(
        (product) => `
      <div class="shrink-0 w-64 flex flex-col gap-sm snap-start group cursor-pointer" onclick="openProductsModal()">
        <div class="w-full aspect-[4/5] rounded-xl overflow-hidden bg-surface-container-lowest dark:bg-surface-container-high border border-soft-border dark:border-outline-variant relative">
          <img alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${product.image}">
          <div class="absolute bottom-sm right-sm w-10 h-10 rounded-full bg-white dark:bg-charcoal flex items-center justify-center shadow-md text-charcoal dark:text-parchment-white hover:bg-charcoal dark:hover:bg-parchment-white hover:text-white dark:hover:text-charcoal transition-colors">
            <span class="material-symbols-outlined text-sm">shopping_bag</span>
          </div>
        </div>
        <div>
          <h4 class="font-label-md text-label-md text-on-surface dark:text-parchment-white">${product.name}</h4>
          <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant">${product.price}</p>
        </div>
      </div>
    `
      )
      .join("");
  }
}

// Open Products Modal and populate grid
function openProductsModal() {
  const modal = document.getElementById("products-modal");
  const modalGrid = document.getElementById("modal-products-grid");

  if (modalGrid) {
    modalGrid.innerHTML = vendorProducts
      .map(
        (product) => `
      <div class="flex flex-col gap-sm p-sm bg-surface-container-lowest dark:bg-surface-container-high border border-soft-border dark:border-outline-variant rounded-xl group hover:shadow-md transition-shadow">
        <div class="w-full aspect-square rounded-lg overflow-hidden bg-surface-container relative">
          <img alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${product.image}">
        </div>
        <div class="flex flex-col justify-between flex-1 gap-xs mt-xs">
          <div>
            <h4 class="font-label-md text-label-md text-on-surface dark:text-parchment-white">${product.name}</h4>
            <p class="font-headline-md text-headline-md text-primary dark:text-parchment-white mt-xs">${product.price}</p>
          </div>
          <button class="w-full py-xs mt-sm bg-charcoal dark:bg-parchment-white text-white dark:text-charcoal font-label-sm text-label-sm rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-xs">
            <span class="material-symbols-outlined text-sm">shopping_bag</span>
            <span>Purchase</span>
          </button>
        </div>
      </div>
    `
      )
      .join("");
  }

  if (modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // Lock background scrolling
  }
}

// Close Products Modal
function closeProductsModal() {
  const modal = document.getElementById("products-modal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = ""; // Restore background scrolling
  }
}

// Smooth scroll to services
function scrollToServices() {
  const servicesMenu = document.getElementById("services-menu");
  if (servicesMenu) {
    const offset = 80;
    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = servicesMenu.getBoundingClientRect().top;
    const elementPosition = elementRect - bodyRect;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth"
    });
  }
}

// Service Booking Logic
function bookService(id, name, price, duration) {
  if (!requireLoginForProtectedFlow("booking.html")) {
    return;
  }

  const serviceDetails = {
    id: id,
    vendorId: "vend_01",
    vendorName: "Adesuwa Balogun",
    name: name,
    price: price,
    duration: duration,
    depositPercentage: 0.30
  };

  localStorage.setItem("glamoraSelectedService", JSON.stringify(serviceDetails));
  window.location.href = "booking.html";
}

// Render or hide the Shop Products section dynamically
function renderShopProducts() {
  const section = document.getElementById("shop-products-section");
  const container = document.getElementById("shop-products-container");

  if (!vendorProducts || vendorProducts.length === 0) {
    if (section) section.style.display = "none";
    return;
  }

  if (section) section.style.display = "flex";

  // Slice array to only show a maximum of 3 products on the initial display
  const initialProducts = vendorProducts.slice(0, 3);

  if (container) {
    container.innerHTML = initialProducts
      .map(
        (product) => `
      <div class="shrink-0 w-64 flex flex-col gap-sm snap-start group cursor-pointer" onclick="openProductsModal()">
        <div class="w-full aspect-[4/5] rounded-xl overflow-hidden bg-surface-container-lowest dark:bg-surface-container-high border border-soft-border dark:border-outline-variant relative">
          <img alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${product.image}">
          
          <!-- Quick Add to Cart button overlapping image -->
          <button onclick="event.stopPropagation(); addToCart('${product.id}')" class="absolute bottom-sm right-sm w-10 h-10 rounded-full bg-white dark:bg-charcoal flex items-center justify-center shadow-md text-charcoal dark:text-parchment-white hover:bg-charcoal dark:hover:bg-parchment-white hover:text-white dark:hover:text-charcoal transition-colors">
            <span class="material-symbols-outlined text-sm">add_shopping_cart</span>
          </button>
        </div>
        <div>
          <h4 class="font-label-md text-label-md text-on-surface dark:text-parchment-white">${product.name}</h4>
          <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-outline-variant">${product.price}</p>
        </div>
      </div>
    `
      )
      .join("");
  }
}

// Open Products Modal and populate grid with ALL products
function openProductsModal() {
  const modal = document.getElementById("products-modal");
  const modalGrid = document.getElementById("modal-products-grid");

  if (modalGrid) {
    modalGrid.innerHTML = vendorProducts
      .map(
        (product) => `
      <div class="flex flex-col gap-sm p-sm bg-surface-container-lowest dark:bg-surface-container-high border border-soft-border dark:border-outline-variant rounded-xl group hover:shadow-md transition-shadow">
        <div class="w-full aspect-square rounded-lg overflow-hidden bg-surface-container relative">
          <img alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${product.image}">
        </div>
        <div class="flex flex-col justify-between flex-1 gap-xs mt-xs">
          <div>
            <h4 class="font-label-md text-label-md text-on-surface dark:text-parchment-white">${product.name}</h4>
            <p class="font-headline-md text-headline-md text-primary dark:text-parchment-white mt-xs">${product.price}</p>
          </div>
          
          <!-- Add to Cart button inside Modal -->
          <button onclick="addToCart('${product.id}')" class="w-full py-xs mt-sm bg-charcoal dark:bg-parchment-white text-white dark:text-charcoal font-label-sm text-label-sm rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-xs">
            <span class="material-symbols-outlined text-sm">add_shopping_cart</span>
            <span>Add to Cart</span>
          </button>
        </div>
      </div>
    `
      )
      .join("");
  }

  if (modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden"; 
  }
}

// --- NEW LOGIC: Add to Cart ---
function addToCart(productId) {
  const product = vendorProducts.find(p => p.id === productId);
  if (!product) return;
  
  // Retrieve existing cart or start a new array
  let cart = JSON.parse(localStorage.getItem("glamoraCart")) || [];
  
  // Check if item already exists in cart
  const existingItem = cart.find(item => item.id === productId);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    // Add new product object with quantity
    cart.push({ 
      ...product, 
      quantity: 1, 
      vendorName: "Adesuwa Balogun" 
    });
  }
  
  // Save updated cart
  localStorage.setItem("glamoraCart", JSON.stringify(cart));
  
  // Trigger user feedback
  showToast(`${product.name} added to cart!`);
}

// Simple Toast Notification Generator
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-charcoal dark:bg-parchment-white text-white dark:text-charcoal px-lg py-sm rounded-full shadow-2xl z-[100] font-label-md transition-all duration-300 flex items-center gap-xs opacity-0';
  toast.innerHTML = `<span class="material-symbols-outlined text-sm">check_circle</span> ${message}`;
  
  document.body.appendChild(toast);
  
  // Animate In
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, -10px)';
  });
  
  // Animate Out & Remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}