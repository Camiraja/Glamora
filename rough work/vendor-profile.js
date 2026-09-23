
    // --------------------------------------------------
    // Toast Notification Utility
    // --------------------------------------------------
    function showToast(message, isError = false) {
      const toast = document.getElementById('systemToast');
      const msg = document.getElementById('toastMessage');
      const icon = document.getElementById('toastIcon');
      
      msg.textContent = message;
      if(isError) {
        icon.textContent = 'error';
        icon.classList.replace('text-sage', 'text-error-red');
      } else {
        icon.textContent = 'check_circle';
        icon.classList.replace('text-error-red', 'text-sage');
      }
      
      toast.classList.remove('translate-y-24', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
      
      setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-24', 'opacity-0');
      }, 3500);
    }

    // --------------------------------------------------
    // Tab Switching Logic (Settings vs Preview)
    // --------------------------------------------------
    const tabSettings = document.getElementById('tab-settings');
    const tabPreview = document.getElementById('tab-preview');
    const viewSettings = document.getElementById('view-settings');
    const viewPreview = document.getElementById('view-preview');

    function switchTab(mode) {
      if(mode === 'settings') {
        viewSettings.classList.remove('hidden');
        viewPreview.classList.add('hidden');
        
        tabSettings.classList.add('border-primary', 'text-primary', 'dark:text-inverse-primary', 'dark:border-inverse-primary');
        tabSettings.classList.remove('border-transparent', 'text-on-surface-variant', 'dark:text-outline');
        
        tabPreview.classList.remove('border-primary', 'text-primary', 'dark:text-inverse-primary', 'dark:border-inverse-primary');
        tabPreview.classList.add('border-transparent', 'text-on-surface-variant', 'dark:text-outline');
      } else {
        viewSettings.classList.add('hidden');
        viewPreview.classList.remove('hidden');
        
        tabPreview.classList.add('border-primary', 'text-primary', 'dark:text-inverse-primary', 'dark:border-inverse-primary');
        tabPreview.classList.remove('border-transparent', 'text-on-surface-variant', 'dark:text-outline');
        
        tabSettings.classList.remove('border-primary', 'text-primary', 'dark:text-inverse-primary', 'dark:border-inverse-primary');
        tabSettings.classList.add('border-transparent', 'text-on-surface-variant', 'dark:text-outline');
      }
    }

    tabSettings.addEventListener('click', () => switchTab('settings'));
    tabPreview.addEventListener('click', () => switchTab('preview'));

    // --------------------------------------------------
    // Form Edit & Save Logic
    // --------------------------------------------------
    const editBtn = document.getElementById('editChangesBtn');
    const saveBtn = document.getElementById('saveChangesBtn');
    const editableFields = document.querySelectorAll('.editable-field');

    editBtn.addEventListener('click', () => {
      editableFields.forEach(el => el.removeAttribute('disabled'));
      editBtn.classList.add('hidden');
      saveBtn.classList.remove('hidden');
    });

    saveBtn.addEventListener('click', () => {
      editableFields.forEach(el => el.setAttribute('disabled', 'true'));
      saveBtn.classList.add('hidden');
      editBtn.classList.remove('hidden');
      showToast('Studio profile and policies saved securely.');
    });

    // --------------------------------------------------
    // Escrow Slider Interactivity
    // --------------------------------------------------
    const slider = document.getElementById('depositSlider');
    const display = document.getElementById('depositDisplay');
    if (slider && display) {
      slider.addEventListener('input', (e) => {
        display.textContent = e.target.value;
      });
    }

    // --------------------------------------------------
    // Download PDF Action
    // --------------------------------------------------
    document.getElementById('downloadPdfBtn').addEventListener('click', () => {
      showToast('Downloading Audit Certificate PDF...');
      // Dummy logic for prototype
      setTimeout(() => {
        console.log("PDF Triggered");
      }, 1000);
    });

    // --------------------------------------------------
    // Studio Suspension Toggle
    // --------------------------------------------------
    const suspendBtn = document.getElementById('suspendBtn');
    const suspensionContainer = document.getElementById('suspensionContainer');
    const suspensionDesc = document.getElementById('suspensionDesc');
    let isSuspended = false;

    suspendBtn.addEventListener('click', () => {
      isSuspended = !isSuspended;
      if (isSuspended) {
        suspendBtn.textContent = 'Reactivate Booking Chair';
        suspendBtn.classList.replace('bg-white', 'bg-error');
        suspendBtn.classList.replace('dark:bg-charcoal', 'dark:bg-error');
        suspendBtn.classList.replace('text-error', 'text-white');
        suspensionContainer.classList.add('border-error-red', 'bg-error-container');
        suspensionDesc.textContent = 'Your studio is currently hidden from the marketplace search.';
        showToast('Studio suspended successfully.');
      } else {
        suspendBtn.textContent = 'Pause Public Booking Chair';
        suspendBtn.classList.replace('bg-error', 'bg-white');
        suspendBtn.classList.replace('dark:bg-error', 'dark:bg-charcoal');
        suspendBtn.classList.replace('text-white', 'text-error');
        suspensionContainer.classList.remove('border-error-red', 'bg-error-container');
        suspensionDesc.textContent = 'Temporarily hide your profile from the marketplace. Existing bookings remain valid.';
        showToast('Studio reactivated on marketplace.');
      }
    });

    // --------------------------------------------------
    // Persistent Theme Logic (LocalStorage)
    // --------------------------------------------------
    function setThemeMode(mode) {
      if (mode === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        mode = systemDark ? 'dark' : 'light';
        localStorage.removeItem('themeMode'); // clear manual override
      } else {
        localStorage.setItem('themeMode', mode);
      }

      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      showToast(`Interface appearance updated.`);
    }
  