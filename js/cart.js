document.addEventListener('DOMContentLoaded', () => {
    
    // Select core DOM elements
    const cartItemsWrapper = document.getElementById('cart-items-wrapper');
    const selectAllCheckbox = document.getElementById('select-all');
    
    // Order Summary Elements
    const summaryItemsCount = document.getElementById('summary-items-count');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryDiscount = document.getElementById('summary-discount');
    const summaryTax = document.getElementById('summary-tax');
    const summaryTotal = document.getElementById('summary-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    // Number Formatter for Nigerian Naira
    const formatNaira = (amount) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Calculate and Update Order Summary
    const updateCartTotals = () => {
        const cartItems = document.querySelectorAll('.cart-item');
        let subtotal = 0;
        let totalItemsSelected = 0;
        
        let allChecked = true;
        let anyChecked = false;

        if (cartItems.length === 0) {
            allChecked = false;
            renderEmptyCart();
        }

        cartItems.forEach(item => {
            const checkbox = item.querySelector('.item-checkbox');
            if (checkbox.checked) {
                anyChecked = true;
                const price = parseFloat(item.dataset.price);
                const quantity = parseInt(item.querySelector('.quantity-val').textContent);
                subtotal += (price * quantity);
                totalItemsSelected += quantity;
            } else {
                allChecked = false;
            }
        });

        // Update "Select All" checkbox state
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = allChecked && cartItems.length > 0;
        }

        // Apply Nigerian business logic logic
        const discountRate = 0.10; // 10% Professional Discount
        const discount = subtotal * discountRate;
        const subtotalAfterDiscount = subtotal - discount;
        const taxRate = 0.075; // 7.5% VAT in Nigeria
        const tax = subtotalAfterDiscount * taxRate;
        const grandTotal = subtotalAfterDiscount + tax;

        // Update DOM
        summaryItemsCount.textContent = `Subtotal (${totalItemsSelected} items)`;
        summarySubtotal.textContent = formatNaira(subtotal);
        summaryDiscount.textContent = `-${formatNaira(discount)}`;
        summaryTax.textContent = formatNaira(tax);
        summaryTotal.textContent = formatNaira(grandTotal);

        // Disable checkout if nothing is selected
        if (!anyChecked || cartItems.length === 0) {
            checkoutBtn.classList.add('opacity-50', 'pointer-events-none');
        } else {
            checkoutBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
    };

    // Empty Cart State Renderer
    const renderEmptyCart = () => {
        const gridContainer = document.getElementById('cart-container');
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div class="col-span-full py-xl text-center flex flex-col items-center justify-center gap-base">
                    <span class="material-symbols-outlined text-[48px] text-on-surface-variant">shopping_cart</span>
                    <h2 class="font-headline-lg text-headline-lg text-on-surface mt-sm">Your cart is empty</h2>
                    <p class="font-body-md text-body-md text-on-surface-variant">Browse the marketplace to discover premium professional formulations.</p>
                    <a href="marketplace.html" class="mt-base bg-charcoal text-on-primary rounded-lg px-md py-sm font-label-md text-label-md hover:bg-surface-tint transition-colors">Go to Marketplace</a>
                </div>
            `;
        }
    };

    // Event Delegation for Cart Interactions (Handles dynamically added/removed items)
    if (cartItemsWrapper) {
        cartItemsWrapper.addEventListener('click', (e) => {
            const target = e.target;

            // 1. Handle Quantity Increase
            const increaseBtn = target.closest('.increase-btn');
            if (increaseBtn) {
                const quantitySpan = increaseBtn.previousElementSibling;
                let currentQty = parseInt(quantitySpan.textContent);
                quantitySpan.textContent = currentQty + 1;
                updateCartTotals();
                return;
            }

            // 2. Handle Quantity Decrease
            const decreaseBtn = target.closest('.decrease-btn');
            if (decreaseBtn) {
                const quantitySpan = decreaseBtn.nextElementSibling;
                let currentQty = parseInt(quantitySpan.textContent);
                if (currentQty > 1) {
                    quantitySpan.textContent = currentQty - 1;
                    updateCartTotals();
                }
                return;
            }

            // 3. Handle Remove Item
            const removeBtn = target.closest('.remove-btn');
            if (removeBtn) {
                const cartItem = removeBtn.closest('.cart-item');
                // Animate removal
                cartItem.style.transition = 'all 0.3s ease';
                cartItem.style.opacity = '0';
                cartItem.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    cartItem.remove();
                    updateCartTotals();
                }, 300);
                return;
            }

            // 4. Handle Individual Checkboxes
            if (target.classList.contains('item-checkbox')) {
                updateCartTotals();
            }
        });
    }

    // 5. Handle "Select All" Toggle
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const checkboxes = document.querySelectorAll('.item-checkbox');
            checkboxes.forEach(box => {
                box.checked = isChecked;
            });
            updateCartTotals();
        });
    }

    // Initialize Global Theme
    const savedTheme = localStorage.getItem('glamora-theme') || 'system';
    const htmlEl = document.documentElement;

    if (savedTheme === 'dark') {
        htmlEl.classList.add('dark');
    } else if (savedTheme === 'light') {
        htmlEl.classList.remove('dark');
    } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            htmlEl.classList.add('dark');
        } else {
            htmlEl.classList.remove('dark');
        }
    }

    // Initial Calculation on Load
    updateCartTotals();
});