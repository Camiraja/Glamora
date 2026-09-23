
        document.addEventListener('DOMContentLoaded', () => {
            initThemeLogic();
            initFiltersAndSearch();
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

        // 2. Filters & Search Logic
        function initFiltersAndSearch() {
            const filterBtns = document.querySelectorAll('.filter-btn');
            const searchInput = document.getElementById('searchInput');
            const serviceCards = document.querySelectorAll('.service-card');
            const addServiceCard = document.querySelector('.add-service-card');

            let currentFilter = 'all';
            let searchQuery = '';

            // Handle Filter Button Clicks
            filterBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    // Update active styling
                    filterBtns.forEach(b => {
                        b.classList.remove('bg-white', 'text-on-surface', 'shadow-sm');
                        b.classList.add('text-on-surface-variant');
                    });
                    e.target.classList.add('bg-white', 'text-on-surface', 'shadow-sm');
                    e.target.classList.remove('text-on-surface-variant');

                    currentFilter = e.target.getAttribute('data-filter');
                    applyFilters();
                });
            });

            // Handle Search Input
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase().trim();
                applyFilters();
            });

            // Filter Application Function
            function applyFilters() {
                serviceCards.forEach(card => {
                    const title = card.querySelector('h3').innerText.toLowerCase();
                    const category = card.getAttribute('data-category');
                    
                    // Logic: Show drafts when 'all' is selected. Otherwise respect category.
                    const matchesFilter = (currentFilter === 'all') || (category === currentFilter);
                    const matchesSearch = title.includes(searchQuery);

                    if (matchesFilter && matchesSearch) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });

                // Hide the "Add Service" block if the user is actively searching or filtering by specific category to clean up UI
                if (searchQuery !== '' || currentFilter !== 'all') {
                    addServiceCard.style.display = 'none';
                } else {
                    addServiceCard.style.display = 'flex';
                }
            }
        }

        // 3. Modal Actions (Add / Edit Drafts)
        function openModal(type) {
            const modal = document.getElementById('serviceModal');
            const form = document.getElementById('serviceForm');
            const title = document.getElementById('modalTitle');

            // Reset form for fresh inputs
            form.reset();

            if (type === 'draft') {
                title.innerText = "Complete Draft Service";
                document.getElementById('serviceName').value = "Men's Executive Grooming";
                document.getElementById('serviceCategory').value = "haircuts";
                document.getElementById('serviceDuration').value = "45";
                document.getElementById('serviceDesc').value = ""; // Ready for user input
                document.getElementById('servicePrice').focus();
            } else {
                title.innerText = "Add New Service";
            }

            modal.classList.remove('hidden');
        }

        function closeModal() {
            const modal = document.getElementById('serviceModal');
            modal.classList.add('hidden');
        }

        function handleServiceSubmit(event) {
            event.preventDefault();
            
            // In a real application, you would POST this data to your backend API.
            alert('Success! The service has been updated on your directory.');
            closeModal();
            
            // Optional: reset search/filters after adding to see the new item.
            document.getElementById('searchInput').value = '';
            document.querySelector('.filter-btn[data-filter="all"]').click();
        }
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

