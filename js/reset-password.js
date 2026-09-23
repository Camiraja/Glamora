// --- Theme Switcher Logic (Passive Listener) ---
document.addEventListener("DOMContentLoaded", () => {
    const currentMode = localStorage.getItem("themeMode");

    if (currentMode === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }

    setupOTPAutoAdvance();
});

// --- Step Navigation State Management ---
function goToStep(stepNumber) {
    document.querySelectorAll('.step-container').forEach(step => step.classList.add('hidden'));
    
    const targetStep = document.getElementById(`step-${stepNumber}`);
    if (targetStep) {
        targetStep.classList.remove('hidden');
    }
}

// --- Step 1: Request OTP Form ---
document.getElementById('request-otp-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const emailInput = document.getElementById('email').value;
    const btn = document.getElementById('btn-step-1');

    setButtonLoading(btn, "Sending Code...");

    setTimeout(() => {
        resetButton(btn, "Send OTP Code", "arrow_forward");
        document.getElementById('user-email-display').textContent = emailInput;
        goToStep(2);
        const firstOtpInput = document.querySelector('.otp-input');
        if (firstOtpInput) firstOtpInput.focus();
    }, 1200);
});

// --- Step 2: OTP Input Auto-Advance & Verification ---
function setupOTPAutoAdvance() {
    const otpInputs = document.querySelectorAll('.otp-input');

    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').trim();
            if (/^\d{6}$/.test(pastedData)) {
                pastedData.split('').forEach((char, i) => {
                    if (otpInputs[i]) otpInputs[i].value = char;
                });
                otpInputs[5].focus();
            }
        });
    });
}

document.getElementById('verify-otp-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = document.getElementById('btn-step-2');

    setButtonLoading(btn, "Verifying...");

    setTimeout(() => {
        resetButton(btn, "Verify & Proceed", "arrow_forward");
        goToStep(3);
    }, 1200);
});

document.getElementById('btn-resend').addEventListener('click', function () {
    this.innerText = "Code Sent!";
    this.disabled = true;
    setTimeout(() => {
        this.innerText = "Resend OTP";
        this.disabled = false;
    }, 30000); 
});

// --- Step 3: Password Validation & Reset Submission ---
document.getElementById('reset-password-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const errorAlert = document.getElementById('password-error');
    const btn = document.getElementById('btn-step-3');

    if (newPassword !== confirmPassword) {
        errorAlert.classList.remove('hidden');
        return;
    }
    
    errorAlert.classList.add('hidden');
    setButtonLoading(btn, "Updating Password...");

    setTimeout(() => {
        goToStep('success');
        document.getElementById('back-to-login-container').classList.add('hidden');
        
        setTimeout(() => {
            window.location.href = "login.html";
        }, 2000);
    }, 1500);
});

// --- Helpers ---
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

function setButtonLoading(btn, loadingText) {
    btn.disabled = true;
    btn.classList.add('opacity-80', 'cursor-not-allowed');
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">progress_activity</span><span class="ml-2">${loadingText}</span>`;
}

function resetButton(btn, originalText, iconName) {
    btn.disabled = false;
    btn.classList.remove('opacity-80', 'cursor-not-allowed');
    btn.innerHTML = `<span>${originalText}</span><span class="material-symbols-outlined text-[18px] ml-2">${iconName}</span>`;
}