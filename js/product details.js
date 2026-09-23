
        // --- 1. Theme Logic (Read-Only) ---
        function initTheme() {
            // Check localStorage for theme setting, default is light.
            if (localStorage.getItem('theme') === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
        initTheme();

        // --- 2. Interactive Product Details ---
        let currentSize = '30 ML';

        function selectSize(btn, size) {
            currentSize = size;
            
            const allButtons = document.querySelectorAll('.size-btn');
            allButtons.forEach(b => {
                b.className = 'size-btn bg-surface-container text-charcoal dark:bg-charcoal dark:text-white px-md py-sm rounded-md text-label-sm font-label-sm hover:bg-surface-container-high transition-all';
                b.classList.remove('active');
            });
            
            btn.className = 'size-btn active bg-charcoal text-on-primary dark:bg-white dark:text-charcoal px-md py-sm rounded-md text-label-sm font-label-sm transition-all shadow-sm';
        }

        function updateQty(change) {
            const qtyInput = document.getElementById('qty');
            let current = parseInt(qtyInput.value) || 1;
            current += change;
            if (current < 1) current = 1;
            qtyInput.value = current;
        }

        function addToCart() {
            const qty = parseInt(document.getElementById('qty').value);
            const title = document.getElementById('product-title').innerText.replace('\n', ' ');
            
            const product = {
                name: title,
                price: 125000,
                size: currentSize,
                quantity: qty
            };

            let cart = JSON.parse(localStorage.getItem('userCart')) || [];
            cart.push(product);
            localStorage.setItem('userCart', JSON.stringify(cart));
            
            alert(`Added ${qty}x ${title} (${currentSize}) to your cart successfully!`);
        }