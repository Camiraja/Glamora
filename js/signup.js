// --- Theme Initialization ---
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

// --- Form & Interaction Logic ---
function selectRole(role) {
    const bg = document.getElementById('role-active-bg');
    const btnCustomer = document.getElementById('btn-customer');
    const btnVendor = document.getElementById('btn-vendor');
    
    const proFields = document.getElementById('professional-fields');
    const bizNameInput = document.getElementById('businessName');
    const serviceCatSelect = document.getElementById('serviceCategory');

    if (role === 'customer') {
        bg.style.transform = 'translateX(0)';
        
        // Swap colors for Customer (Active)
        btnCustomer.classList.remove('text-on-surface-variant', 'dark:text-outline-variant');
        btnCustomer.classList.add('text-charcoal', 'dark:text-parchment-white');
        
        // Swap colors for Professional (Inactive)
        btnVendor.classList.remove('text-charcoal', 'dark:text-parchment-white');
        btnVendor.classList.add('text-on-surface-variant', 'dark:text-outline-variant');
        
        // Hide fields and remove validation for customers
        proFields.classList.add('hidden');
        bizNameInput.removeAttribute('required');
        serviceCatSelect.removeAttribute('required');
    } else {
        bg.style.transform = 'translateX(calc(100% + 4px))';
        
        // Swap colors for Professional (Active)
        btnVendor.classList.remove('text-on-surface-variant', 'dark:text-outline-variant');
        btnVendor.classList.add('text-charcoal', 'dark:text-parchment-white');
        
        // Swap colors for Customer (Inactive)
        btnCustomer.classList.remove('text-charcoal', 'dark:text-parchment-white');
        btnCustomer.classList.add('text-on-surface-variant', 'dark:text-outline-variant');
        
        // Show fields and enforce validation for professionals
        proFields.classList.remove('hidden');
        bizNameInput.setAttribute('required', 'true');
        serviceCatSelect.setAttribute('required', 'true');
    }
}

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    
    if (input.type === "password") {
        input.type = "text";
        icon.textContent = "visibility";
    } else {
        input.type = "password";
        icon.textContent = "visibility_off";
    }
}