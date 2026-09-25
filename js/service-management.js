let selectedImageSrc = '';
let currentEditCard = null; 
let cardToDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    initThemeLogic();
    initFiltersAndSearch();
    initImageUpload();
    initGlobalMenuClose();
});

// 1. Theme Logic Setup
function initThemeLogic() {
    const savedTheme = localStorage.getItem("glamora_theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

// 2. Filters & Search Logic
function initFiltersAndSearch() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('searchInput');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => {
                b.classList.remove('bg-white', 'text-on-surface', 'shadow-sm');
                b.classList.add('text-on-surface-variant');
            });
            e.target.classList.add('bg-white', 'text-on-surface', 'shadow-sm');
            e.target.classList.remove('text-on-surface-variant');
            applyFilters();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
}

function applyFilters() {
    const activeFilterBtn = document.querySelector('.filter-btn.bg-white') || document.querySelector('.filter-btn');
    const currentFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
    const searchQuery = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    
    const serviceCards = document.querySelectorAll('.service-card:not(.add-service-card)');
    const addServiceCard = document.querySelector('.add-service-card');

    serviceCards.forEach(card => {
        const titleEl = card.querySelector('.service-title');
        const title = titleEl ? titleEl.innerText.toLowerCase() : '';
        const category = card.getAttribute('data-category');
        
        const matchesFilter = (currentFilter === 'all') || (category === currentFilter);
        const matchesSearch = title.includes(searchQuery);

        if (matchesFilter && matchesSearch) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });

    if (addServiceCard) {
        if (searchQuery !== '' || currentFilter !== 'all') {
            addServiceCard.style.display = 'none';
        } else {
            addServiceCard.style.display = 'flex';
        }
    }
}

// 3. Image Upload & Drag-and-Drop
function initImageUpload() {
    const dropzone = document.getElementById('imageDropzone');
    const imageInput = document.getElementById('serviceImage');

    if (!dropzone || !imageInput) return;

    dropzone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImageFile(file);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.classList.add('border-primary');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.classList.remove('border-primary');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
    });
}

function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        selectedImageSrc = e.target.result;
        setPreviewImage(selectedImageSrc);
    };
    reader.readAsDataURL(file);
}

function setPreviewImage(src) {
    selectedImageSrc = src;
    const preview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const uploadUI = document.getElementById('imageUploadUI');

    if (src && preview && previewContainer) {
        preview.src = src;
        previewContainer.classList.remove('hidden');
        if (uploadUI) uploadUI.classList.add('opacity-0');
    }
}

function removeImage(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    selectedImageSrc = '';
    const imageInput = document.getElementById('serviceImage');
    if (imageInput) imageInput.value = '';
    
    const preview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const uploadUI = document.getElementById('imageUploadUI');

    if (preview) preview.src = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (uploadUI) uploadUI.classList.remove('opacity-0');
}

// 4. Action Menus & Card Management
function toggleCardMenu(event, button) {
    event.stopPropagation();
    const menu = button.nextElementSibling;
    const isHidden = menu.classList.contains('hidden');
    
    // Close all other menus first
    document.querySelectorAll('.card-menu').forEach(m => m.classList.add('hidden'));
    
    // Toggle current menu
    if (isHidden) {
        menu.classList.remove('hidden');
    }
}

function initGlobalMenuClose() {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.card-menu') && !e.target.closest('button[onclick^="toggleCardMenu"]')) {
            document.querySelectorAll('.card-menu').forEach(m => m.classList.add('hidden'));
        }
    });
}

function deleteService(button) {
    cardToDelete = button.closest('.service-card');
    document.getElementById('deleteModal').classList.remove('hidden');
    button.closest('.card-menu').classList.add('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    cardToDelete = null;
}

function confirmDelete() {
    if (cardToDelete) {
        cardToDelete.remove();
        cardToDelete = null;
    }
    closeDeleteModal();
    applyFilters();
}

function toggleVisibility(button) {
    const card = button.closest('.service-card');
    const statusBadge = card.querySelector('.status-badge');
    const btnIcon = button.querySelector('span');
    const btnTextNode = button.lastChild;
    
    if (card.classList.contains('opacity-60')) {
        // Make Active
        card.classList.remove('opacity-60');
        statusBadge.textContent = 'ACTIVE';
        statusBadge.classList.replace('bg-surface-tint', 'bg-success-green/90');
        btnIcon.textContent = 'visibility_off';
        btnTextNode.textContent = ' Hide';
    } else {
        // Make Hidden
        card.classList.add('opacity-60');
        statusBadge.textContent = 'HIDDEN';
        statusBadge.classList.replace('bg-success-green/90', 'bg-surface-tint');
        btnIcon.textContent = 'visibility';
        btnTextNode.textContent = ' Show';
    }
    
    // Close menu after clicking
    button.closest('.card-menu').classList.add('hidden');
}

// 5. Modal Operations (Add/Edit)
function openModal(type) {
    const modal = document.getElementById('serviceModal');
    const form = document.getElementById('serviceForm');
    const title = document.getElementById('modalTitle');

    form.reset();
    removeImage();
    currentEditCard = null;

    if (type === 'new') {
        title.innerText = "Add New Service";
    }
    
    modal.classList.remove('hidden');
}

function editService(button) {
    const card = button.closest('.service-card');
    currentEditCard = card; 
    
    const title = card.querySelector('.service-title').innerText;
    const desc = card.querySelector('.service-desc').innerText;
    const priceRaw = card.querySelector('.service-price').innerText;
    const durationRaw = card.querySelector('.service-duration').innerText;
    const category = card.getAttribute('data-category');
    const imgSrc = card.querySelector('.service-img').src;

    const price = priceRaw.replace(/[^0-9.-]+/g, ""); 
    const duration = durationRaw.replace(/[^0-9.-]+/g, "");

    document.getElementById('serviceName').value = title;
    document.getElementById('serviceCategory').value = category;
    document.getElementById('serviceDuration').value = duration;
    document.getElementById('servicePrice').value = price;
    document.getElementById('serviceDesc').value = desc;
    
    setPreviewImage(imgSrc);

    document.getElementById('modalTitle').innerText = "Edit Service";
    document.getElementById('serviceModal').classList.remove('hidden');
    
    button.closest('.card-menu').classList.add('hidden');
}

function closeModal() {
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.add('hidden');
    currentEditCard = null;
}

function handleServiceSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('serviceName').value.trim();
    const category = document.getElementById('serviceCategory').value;
    const duration = document.getElementById('serviceDuration').value;
    const price = document.getElementById('servicePrice').value;
    const desc = document.getElementById('serviceDesc').value.trim();
    
    const fallbackImages = {
        haircuts: "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=600&auto=format&fit=crop",
        coloring: "https://images.unsplash.com/photo-1620331311520-246422fd82f9?q=80&w=600&auto=format&fit=crop",
        treatments: "https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=600&auto=format&fit=crop"
    };

    const finalImageSrc = selectedImageSrc || fallbackImages[category] || fallbackImages.haircuts;
    const formattedPrice = '₦' + Number(price).toLocaleString();
    const categoryBadgeText = category.toUpperCase();

    if (currentEditCard) {
        currentEditCard.setAttribute('data-category', category);
        currentEditCard.querySelector('.service-title').innerText = name;
        currentEditCard.querySelector('.service-desc').innerText = desc;
        currentEditCard.querySelector('.service-price').innerText = formattedPrice;
        currentEditCard.querySelector('.service-duration').innerText = `${duration} min`;
        currentEditCard.querySelector('.service-category-badge').innerText = categoryBadgeText;
        currentEditCard.querySelector('.service-img').src = finalImageSrc;
    } else {
        const newCard = document.createElement('div');
        // Make sure newly created cards also have the relative class!
        newCard.className = "service-card relative bg-surface-container-lowest border border-soft-border flex flex-col shadow-sm hover:border-primary/40 transition-all group";
        newCard.setAttribute('data-category', category);

        newCard.innerHTML = `
          <div class="w-full h-32 rounded-t-xl bg-surface-container-high relative overflow-hidden">
            <img src="${finalImageSrc}" alt="${name}" class="service-img w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div class="absolute top-3 left-3 flex flex-col gap-1 items-start">
              <div class="bg-surface-container-lowest/90 backdrop-blur-sm px-2 py-1 rounded text-on-surface-variant font-bold text-[10px] uppercase tracking-wider shadow-sm service-category-badge">${categoryBadgeText}</div>
              <div class="status-badge bg-success-green/90 backdrop-blur-sm px-2 py-1 rounded text-white font-bold text-[10px] uppercase tracking-wider shadow-sm">ACTIVE</div>
            </div>
          </div>
          <!-- Menu outside overflow-hidden for dynamic cards too -->
          <div class="absolute top-3 right-3 z-20">
            <button type="button" onclick="toggleCardMenu(event, this)" class="w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center text-on-surface hover:bg-white transition-colors shadow-sm">
              <span class="material-symbols-outlined text-[20px]">more_vert</span>
            </button>
            <div class="card-menu hidden absolute top-full right-0 mt-1 w-36 bg-surface-container-lowest border border-soft-border rounded-lg shadow-lg overflow-hidden">
              <button type="button" onclick="editService(this)" class="w-full flex items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-surface-container-low transition-colors"><span class="material-symbols-outlined text-[16px]">edit</span> Edit</button>
              <button type="button" onclick="toggleVisibility(this)" class="w-full flex items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-surface-container-low transition-colors visibility-btn"><span class="material-symbols-outlined text-[16px]">visibility_off</span> Hide</button>
              <button type="button" onclick="deleteService(this)" class="w-full flex items-center gap-2 px-3 py-2 text-left text-[14px] text-error hover:bg-error-container transition-colors"><span class="material-symbols-outlined text-[16px]">delete</span> Delete</button>
            </div>
          </div>
          <div class="p-6 min-h-[220px] flex flex-col flex-1 justify-between rounded-b-xl bg-surface-container-lowest relative z-0">
            <div class="mb-4">
              <h3 class="service-title text-[20px] font-bold text-on-surface mb-2 leading-snug line-clamp-1">${name}</h3>
              <p class="service-desc text-[14px] text-on-surface-variant leading-relaxed line-clamp-3">${desc}</p>
            </div>
            <div class="pt-4 border-t border-soft-border flex items-center justify-between">
              <div class="space-y-1">
                <span class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">PRICE</span>
                <span class="service-price text-[18px] font-bold text-on-surface">${formattedPrice}</span>
              </div>
              <div class="h-8 w-[1px] bg-soft-border"></div>
              <div class="space-y-1 text-right">
                <span class="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">DURATION</span>
                <span class="service-duration text-[18px] font-bold text-on-surface">${duration} min</span>
              </div>
            </div>
          </div>
        `;

        const grid = document.getElementById('servicesGrid');
        const addCard = document.querySelector('.add-service-card');
        if (grid && addCard) {
            grid.insertBefore(newCard, addCard);
        }
    }

    closeModal();
    applyFilters();
}

/**
 * Mobile Navigation & Sidebar Roles
 */
function switchRole(role) {
    if (role === 'customer') {
        window.location.href = 'vendor customer dashboard.html';
    } else if (role === 'vendor') {
        console.log("Already on Vendor Dashboard");
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById("mobile-sidebar");
    if (sidebar) {
        sidebar.classList.toggle("hidden");
    }
}