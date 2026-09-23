// customer-profile.js
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. TOAST NOTIFICATION SYSTEM ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `flex items-center gap-sm px-md py-sm rounded-lg shadow-lg text-on-primary bg-primary border border-soft-border transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-auto`;
        
        let iconName = 'check_circle';
        if (type === 'error') iconName = 'error';
        if (type === 'info') iconName = 'info';

        toast.innerHTML = `
            <span class="material-symbols-outlined text-[20px] text-sage">${iconName}</span>
            <span class="font-body-sm text-body-sm">${message}</span>
        `;
        
        container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // --- 2. MODAL HELPERS ---
    function openModal(modal, content) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }

    function closeModal(modal, content) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
    }

    // --- 3. DEDICATED DISPLAY & THEME SELECTOR LOGIC ---
    const lightThemeCard = document.getElementById('theme-card-light');
    const darkThemeCard = document.getElementById('theme-card-dark');
    const radioIconLight = document.getElementById('radio-icon-light');
    const radioIconDark = document.getElementById('radio-icon-dark');

    function applyTheme(theme, notify = false) {
        const isDark = theme === 'dark';
        if (isDark) {
            document.documentElement.classList.add('dark');
            darkThemeCard.classList.add('border-primary');
            darkThemeCard.classList.remove('border-soft-border');
            lightThemeCard.classList.remove('border-primary');
            lightThemeCard.classList.add('border-soft-border');
            radioIconDark.textContent = 'radio_button_checked';
            radioIconLight.textContent = 'radio_button_unchecked';
        } else {
            document.documentElement.classList.remove('dark');
            lightThemeCard.classList.add('border-primary');
            lightThemeCard.classList.remove('border-soft-border');
            darkThemeCard.classList.remove('border-primary');
            darkThemeCard.classList.add('border-soft-border');
            radioIconLight.textContent = 'radio_button_checked';
            radioIconDark.textContent = 'radio_button_unchecked';
        }
        localStorage.setItem('glamora-theme', theme);
        if (notify) {
            showToast(`${isDark ? 'Dark' : 'Light'} theme preference saved!`, 'info');
        }
    }

    // Load saved theme or strictly default to light (white page default)
    const savedTheme = localStorage.getItem('glamora-theme') || 'light';
    applyTheme(savedTheme, false);

    lightThemeCard.addEventListener('click', () => applyTheme('light', true));
    darkThemeCard.addEventListener('click', () => applyTheme('dark', true));

    // 4. Mobile Sidebar Drawer Logic
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


    // --- 5. SIDEBAR NAVIGATION & SCROLLSPY ---
    const navButtons = document.querySelectorAll('#profile-nav button[data-target]');
    const sections = document.querySelectorAll('main > section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    const observerOptions = { root: null, rootMargin: '-20% 0px -60% 0px', threshold: 0 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navButtons.forEach(b => {
                    const isCurrent = b.getAttribute('data-target') === id;
                    if (isCurrent) {
                        b.classList.remove('hover:bg-surface-container-low', 'text-on-surface-variant');
                        b.classList.add('bg-surface-container-high', 'text-on-surface');
                    } else {
                        b.classList.add('hover:bg-surface-container-low', 'text-on-surface-variant');
                        b.classList.remove('bg-surface-container-high', 'text-on-surface');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(sec => observer.observe(sec));

    // --- 6. PERSONAL INFO SAVING ---
    const saveInfoBtn = document.getElementById('save-personal-info-btn');
    const firstNameInput = document.getElementById('input-first-name');
    const lastNameInput = document.getElementById('input-last-name');
    const displayName = document.getElementById('profile-display-name');

    saveInfoBtn.addEventListener('click', () => {
        const fName = firstNameInput.value.trim();
        const lName = lastNameInput.value.trim();
        if (fName && lName) {
            displayName.textContent = `${fName} ${lName}`;
            showToast('Personal information updated successfully!');
        } else {
            showToast('Please fill in your name fields.', 'error');
        }
    });

    // --- 7. DYNAMIC SMS NOTIFICATION TOGGLE & PHONE INPUT ---
    const smsToggle = document.getElementById('sms-notification-toggle');
    const smsKnob = document.getElementById('sms-toggle-knob');
    const smsPhoneContainer = document.getElementById('sms-phone-container');

    smsToggle.addEventListener('click', () => {
        const isChecked = smsToggle.getAttribute('aria-checked') === 'true';
        if (isChecked) {
            smsToggle.setAttribute('aria-checked', 'false');
            smsToggle.classList.remove('bg-primary');
            smsToggle.classList.add('bg-surface-container-high');
            smsKnob.classList.remove('translate-x-6');
            smsKnob.classList.add('translate-x-1');
            smsPhoneContainer.classList.add('hidden');
            showToast('SMS notifications turned off', 'info');
        } else {
            smsToggle.setAttribute('aria-checked', 'true');
            smsToggle.classList.add('bg-primary');
            smsToggle.classList.remove('bg-surface-container-high');
            smsKnob.classList.add('translate-x-6');
            smsKnob.classList.remove('translate-x-1');
            smsPhoneContainer.classList.remove('hidden');
            showToast('SMS notifications turned on. Please verify phone number.');
        }
    });

    // --- 8. DELIVERY DETAILS SAVING ---
    const saveDeliveryBtn = document.getElementById('save-delivery-btn');
    saveDeliveryBtn.addEventListener('click', () => {
        const address = document.getElementById('input-delivery-address').value.trim();
        const city = document.getElementById('input-delivery-city').value.trim();
        const state = document.getElementById('select-delivery-state').value;
        const phone = document.getElementById('input-delivery-phone').value.trim();

        if (!address || !city || !state || !phone) {
            showToast('Please complete all delivery details', 'error');
            return;
        }

        const deliveryData = { address, city, state, phone: '+234' + phone };
        localStorage.setItem('glamora_delivery_details', JSON.stringify(deliveryData));
        showToast('Delivery address saved successfully!');
    });

    // --- 9. PAYMENT METHODS & ADD CARD MODAL ---
    const addCardModal = document.getElementById('add-card-modal');
    const addCardModalContent = document.getElementById('add-card-modal-content');
    const openAddCardBtn = document.getElementById('open-add-card-btn');
    const closeCardModalBtn = document.getElementById('close-card-modal');
    const cancelCardModalBtn = document.getElementById('cancel-card-modal');
    const addCardForm = document.getElementById('add-card-form');
    const cardsGrid = document.getElementById('payment-cards-grid');

    openAddCardBtn.addEventListener('click', () => openModal(addCardModal, addCardModalContent));
    closeCardModalBtn.addEventListener('click', () => closeModal(addCardModal, addCardModalContent));
    cancelCardModalBtn.addEventListener('click', () => closeModal(addCardModal, addCardModalContent));

    const cardNumInput = document.getElementById('modal-card-number');
    cardNumInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        val = val.substring(0, 16);
        val = val.match(/.{1,4}/g)?.join(' ') || val;
        e.target.value = val;
    });

    const cardExpiryInput = document.getElementById('modal-card-expiry');
    cardExpiryInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length >= 2) {
            val = val.substring(0, 2) + '/' + val.substring(2, 4);
        }
        e.target.value = val;
    });

    addCardForm.addEventListener('submit', () => {
        const num = cardNumInput.value;
        const expiry = cardExpiryInput.value;
        const isDefault = document.getElementById('modal-card-default').checked;

        if (!num || num.length < 19) {
            showToast('Please enter a valid card number', 'error');
            return;
        }

        const last4 = num.slice(-4);
        const cardId = Date.now();

        const cardHTML = `
            <div class="card-item relative p-md rounded-xl bg-surface border border-soft-border text-on-surface group cursor-pointer transition-transform hover:-translate-y-1 shadow-sm flex flex-col justify-between" data-card-id="${cardId}">
              <div class="flex justify-between items-start mb-lg">
                <span class="material-symbols-outlined text-[32px] text-on-surface-variant">credit_card</span>
                <div class="flex items-center gap-xs">
                  ${isDefault ? '<span class="card-badge px-xs py-xs bg-primary text-on-primary rounded font-label-sm text-label-sm">DEFAULT</span>' : '<button class="set-default-card-btn p-xs text-on-surface-variant hover:text-primary transition-colors text-[12px] underline cursor-pointer" title="Set Default">Set Default</button>'}
                  <button class="delete-card-btn p-xs text-on-surface-variant hover:text-error-red transition-colors cursor-pointer" title="Delete Card">
                    <span class="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </div>
              <div class="font-headline-md text-headline-md tracking-[0.2em] mb-sm text-on-surface-variant">
                •••• •••• •••• ${last4}
              </div>
              <div class="flex justify-between items-end">
                <div class="flex flex-col">
                  <span class="font-label-sm text-label-sm text-on-surface-variant uppercase">Exp</span>
                  <span class="font-label-md text-label-md text-on-surface">${expiry || '12/28'}</span>
                </div>
                <div class="w-10 h-6">
                  <svg class="w-full h-full text-on-surface-variant" fill="none" viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0H40V24H0V0Z" fill="currentColor" fill-opacity="0.2"/>
                    <path d="M20 12L30 20H10L20 12Z" fill="currentColor" fill-opacity="0.6"/>
                  </svg>
                </div>
              </div>
            </div>
        `;

        cardsGrid.insertAdjacentHTML('beforeend', cardHTML);
        closeModal(addCardModal, addCardModalContent);
        addCardForm.reset();
        showToast('New card saved successfully!');
    });

    cardsGrid.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-card-btn');
        const defaultBtn = e.target.closest('.set-default-card-btn');

        if (deleteBtn) {
            const cardItem = deleteBtn.closest('.card-item');
            cardItem.remove();
            showToast('Card removed', 'info');
        }

        if (defaultBtn) {
            document.querySelectorAll('.card-badge').forEach(b => b.remove());
            const cardItem = defaultBtn.closest('.card-item');
            const actionContainer = defaultBtn.parentElement;
            defaultBtn.remove();
            actionContainer.insertAdjacentHTML('afterbegin', '<span class="card-badge px-xs py-xs bg-primary text-on-primary rounded font-label-sm text-label-sm">DEFAULT</span>');
            showToast('Default card updated');
        }
    });

    // --- 10. SECURITY SECTION: PASSWORD & 2FA & SESSIONS ---
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const icon = btn.querySelector('.material-symbols-outlined');
            if (input.type === 'password') {
                input.type = 'text';
                icon.textContent = 'visibility_off';
            } else {
                input.type = 'password';
                icon.textContent = 'visibility';
            }
        });
    });

    const newPassInput = document.getElementById('new-password');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');

    newPassInput.addEventListener('input', (e) => {
        const val = e.target.value;
        let score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        if (val.length === 0) {
            strengthBar.style.width = '0%';
            strengthText.textContent = 'Weak';
        } else if (score <= 2) {
            strengthBar.style.width = '33%';
            strengthBar.className = 'h-full bg-error-red transition-all duration-300';
            strengthText.textContent = 'Weak';
        } else if (score <= 4) {
            strengthBar.style.width = '66%';
            strengthBar.className = 'h-full bg-warning-amber transition-all duration-300';
            strengthText.textContent = 'Medium';
        } else {
            strengthBar.style.width = '100%';
            strengthBar.className = 'h-full bg-sage transition-all duration-300';
            strengthText.textContent = 'Strong';
        }
    });

    document.getElementById('update-password-btn').addEventListener('click', () => {
        const cur = document.getElementById('current-password').value;
        const newP = newPassInput.value;
        const confP = document.getElementById('confirm-password').value;

        if (!cur) {
            showToast('Please enter your current password', 'error');
            return;
        }
        if (!newP || newP.length < 6) {
            showToast('New password must be at least 6 characters', 'error');
            return;
        }
        if (newP !== confP) {
            showToast('New passwords do not match', 'error');
            return;
        }

        showToast('Password changed successfully!');
        document.getElementById('password-form').reset();
        strengthBar.style.width = '0%';
        strengthText.textContent = 'Weak';
    });

    const twofaToggle = document.getElementById('twofa-toggle');
    const twofaKnob = document.getElementById('twofa-knob');
    const twofaBadge = document.getElementById('twofa-badge');
    const twofaModal = document.getElementById('twofa-modal');
    const twofaModalContent = document.getElementById('twofa-modal-content');
    const cancelTwofaBtn = document.getElementById('cancel-twofa-btn');
    const confirmTwofaBtn = document.getElementById('confirm-twofa-btn');
    const twofaInputFields = document.querySelectorAll('#twofa-inputs input');

    // Auto focus logic for 6-digit code boxes
    twofaInputFields.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value && index < twofaInputFields.length - 1) {
                twofaInputFields[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                twofaInputFields[index - 1].focus();
            }
        });
    });

    twofaToggle.addEventListener('click', () => {
        const isEnabled = twofaToggle.getAttribute('aria-checked') === 'true';
        if (isEnabled) {
            // Turning OFF
            twofaToggle.setAttribute('aria-checked', 'false');
            twofaToggle.classList.remove('bg-primary');
            twofaToggle.classList.add('bg-surface-container-high');
            twofaKnob.classList.remove('translate-x-6');
            twofaKnob.classList.add('translate-x-1');
            twofaBadge.textContent = 'DISABLED';
            twofaBadge.className = 'px-xs py-[2px] bg-error-red/10 text-error-red text-[11px] font-bold rounded';
            showToast('Two-Factor Authentication disabled', 'info');
        } else {
            // Turning ON - Open verification modal instead of instantly toggling
            twofaInputFields.forEach(inp => inp.value = ''); // clear old inputs
            openModal(twofaModal, twofaModalContent);
            setTimeout(() => twofaInputFields[0].focus(), 300); // autofocus first input
        }
    });

    cancelTwofaBtn.addEventListener('click', () => {
        closeModal(twofaModal, twofaModalContent);
    });

    confirmTwofaBtn.addEventListener('click', () => {
        let code = '';
        twofaInputFields.forEach(inp => code += inp.value);
        if(code.length === 6) {
            closeModal(twofaModal, twofaModalContent);
            // Visually Enable 2FA
            twofaToggle.setAttribute('aria-checked', 'true');
            twofaToggle.classList.add('bg-primary');
            twofaToggle.classList.remove('bg-surface-container-high');
            twofaKnob.classList.add('translate-x-6');
            twofaKnob.classList.remove('translate-x-1');
            twofaBadge.textContent = 'ENABLED';
            twofaBadge.className = 'px-xs py-[2px] bg-sage/20 text-sage text-[11px] font-bold rounded';
            showToast('Two-Factor Authentication successfully verified and enabled!');
        } else {
            showToast('Please enter the full 6-digit code', 'error');
        }
    });

    document.getElementById('revoke-all-sessions-btn').addEventListener('click', () => {
        document.querySelectorAll('.session-item').forEach(item => item.remove());
        showToast('Signed out from all other devices');
    });

    document.getElementById('sessions-container').addEventListener('click', (e) => {
        const revokeSingle = e.target.closest('.revoke-single-session');
        if (revokeSingle) {
            revokeSingle.closest('.session-item').remove();
            showToast('Session revoked', 'info');
        }
    });

    // --- 11. PROFILE PICTURE UPDATE FUNCTIONALITY ---
    const changeAvatarBtn = document.getElementById('change-avatar-btn');
    const fileInput = document.getElementById('avatar-file-input');
    const userAvatarImgs = document.querySelectorAll('.user-avatar-img');

    changeAvatarBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                userAvatarImgs.forEach(img => img.src = event.target.result);
                showToast('Profile photo updated successfully!');
            };
            reader.readAsDataURL(file);
        }
    });

    // --- 12. DEACTIVATE & ERASE PROFILE DATA MODALS ---
    const deactivateBtn = document.getElementById('deactivate-profile-btn');
    const deactivateModal = document.getElementById('deactivate-modal');
    const deactivateModalContent = document.getElementById('deactivate-modal-content');
    const cancelDeactivateBtn = document.getElementById('cancel-deactivate-btn');
    const confirmDeactivateBtn = document.getElementById('confirm-deactivate-btn');

    deactivateBtn.addEventListener('click', () => openModal(deactivateModal, deactivateModalContent));
    cancelDeactivateBtn.addEventListener('click', () => closeModal(deactivateModal, deactivateModalContent));
    confirmDeactivateBtn.addEventListener('click', () => {
        // Clear local storage data then redirect to login
        localStorage.clear();
        closeModal(deactivateModal, deactivateModalContent);
        showToast('Profile deactivated. Logging out...', 'info');
        setTimeout(() => window.location.href = 'login.html', 1500);
    });

    const eraseBtn = document.getElementById('erase-profile-btn');
    const eraseModal = document.getElementById('erase-modal');
    const eraseModalContent = document.getElementById('erase-modal-content');
    const cancelEraseBtn = document.getElementById('cancel-erase-btn');
    const confirmEraseBtn = document.getElementById('confirm-erase-btn');

    eraseBtn.addEventListener('click', () => openModal(eraseModal, eraseModalContent));
    cancelEraseBtn.addEventListener('click', () => closeModal(eraseModal, eraseModalContent));
    confirmEraseBtn.addEventListener('click', () => {
        // Permanently clear data then redirect to signup page
        localStorage.clear();
        closeModal(eraseModal, eraseModalContent);
        showToast('All profile data erased permanently.', 'error');
        setTimeout(() => window.location.href = 'signup.html', 1500);
    });

    // --- 13. SIGN OUT MODAL ---
    const signoutBtn = document.getElementById('signout-btn');
    const signoutModal = document.getElementById('signout-modal');
    const signoutModalContent = document.getElementById('signout-modal-content');
    const cancelSignoutBtn = document.getElementById('cancel-signout-btn');
    const confirmSignoutBtn = document.getElementById('confirm-signout-btn');

    signoutBtn.addEventListener('click', () => openModal(signoutModal, signoutModalContent));
    cancelSignoutBtn.addEventListener('click', () => closeModal(signoutModal, signoutModalContent));
    confirmSignoutBtn.addEventListener('click', () => {
        // Clear auth tokens/session data then redirect
        localStorage.removeItem('userToken');
        closeModal(signoutModal, signoutModalContent);
        showToast('Signing out...', 'info');
        setTimeout(() => window.location.href = 'login.html', 1200);
    });

});