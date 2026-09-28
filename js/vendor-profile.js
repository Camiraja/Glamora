document.addEventListener("DOMContentLoaded", () => {
  initThemeLogic();
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

/** 3. Role Switcher */
function initRoleToggle() {
    const vendorBtn = document.getElementById('role-vendor');
    const customerBtn = document.getElementById('role-customer');
    
    // Vendor is inherently active here, so we just setup redirect for customer
    if(customerBtn) {
        customerBtn.addEventListener('click', () => {
            window.location.href = 'customer-dashboard.html';
        });
    }
}
      (function () {
        // 1. Theme initialization logic via localStorage ('glamora_theme')
        const storedTheme = localStorage.getItem("glamora_theme") || "light";
        if (storedTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
          localStorage.setItem("glamora_theme", "light");
        }

        // Toast utility
        const toast = document.getElementById("actionToast");
        const toastMessage = document.getElementById("toastMessage");
        const toastIcon = document.getElementById("toastIcon");
        let toastTimeout = null;

        function showToast(message, icon = "check_circle", isError = false) {
          if (!toast) return;
          if (toastTimeout) clearTimeout(toastTimeout);
          toastMessage.textContent = message;
          toastIcon.textContent = icon;
          toastIcon.className = `material-symbols-outlined text-[20px] ${isError ? "text-error-red" : "text-sage"}`;
          toast.classList.remove("translate-y-24", "opacity-0");
          toast.classList.add("translate-y-0", "opacity-100");
          toastTimeout = setTimeout(() => {
            toast.classList.remove("translate-y-0", "opacity-100");
            toast.classList.add("translate-y-24", "opacity-0");
          }, 3600);
        }

        // 2. Dynamic Edit Profile / Save Changes Toggle
        let isEditMode = false;
        const profileToggleBtn = document.getElementById("profileToggleBtn");
        const profileToggleIcon = document.getElementById("profileToggleIcon");
        const profileToggleText = document.getElementById("profileToggleText");
        const editStateIndicator =
          document.getElementById("editStateIndicator");
        const formInputs = document.querySelectorAll(".studio-input");

        // Set initial disabled state
        formInputs.forEach((input) => input.setAttribute("disabled", "true"));

        profileToggleBtn.addEventListener("click", async () => {
          if (isEditMode && !(await saveBookingSettings())) return;
          isEditMode = !isEditMode;

          if (isEditMode) {
            // Switch to Editing State
            formInputs.forEach((input) => {
              input.removeAttribute("disabled");
              input.classList.remove("bg-surface-container-low");
              input.classList.add(
                "bg-surface-container-lowest",
                "border-soft-border",
              );
            });
            profileToggleBtn.classList.remove("bg-primary");
            profileToggleBtn.classList.add("bg-success-green");
            profileToggleIcon.textContent = "save";
            profileToggleText.textContent = "Save Changes";
            editStateIndicator.textContent = "Editing Active";
            editStateIndicator.classList.remove(
              "bg-surface-container",
              "text-on-surface-variant",
            );
            editStateIndicator.classList.add(
              "bg-secondary-container",
              "text-on-secondary-container",
              "font-semibold",
            );
            showToast("Profile editing enabled. Make your updates.", "edit");
          } else {
            // Switch to Saved State
            formInputs.forEach((input) => {
              input.setAttribute("disabled", "true");
              input.classList.remove(
                "bg-surface-container-lowest",
                "border-soft-border",
              );
              input.classList.add("bg-surface-container-low");
            });

            // Sync values to headers / previews
            const newName = document
              .getElementById("inputStudioName")
              .value.trim();
            const newBio = document
              .getElementById("inputStudioBio")
              .value.trim();
            if (newName) {
              document.getElementById("displayStudioNameHeader").textContent =
                newName;
              document.getElementById("sidebarStudioName").textContent = newName
                .split("&")[0]
                .trim();
            }
            if (newBio) {
              document.getElementById("sidebarStudioTagline").textContent =
                newBio.slice(0, 48) + "...";
            }

            profileToggleBtn.classList.remove("bg-success-green");
            profileToggleBtn.classList.add("bg-primary");
            profileToggleIcon.textContent = "edit";
            profileToggleText.textContent = "Edit Profile";
            editStateIndicator.textContent = "Read-Only Mode";
            editStateIndicator.classList.remove(
              "bg-secondary-container",
              "text-on-secondary-container",
              "font-semibold",
            );
            editStateIndicator.classList.add(
              "bg-surface-container",
              "text-on-surface-variant",
            );
            showToast("Vendor booking settings saved.", "check_circle");
          }
        });

        // 3. Media Upload Simulations (Banner & Avatar)
        const bannerFileInput = document.getElementById("bannerFileInput");
        const avatarFileInput = document.getElementById("avatarFileInput");
        const bannerDisplay = document.getElementById("bannerDisplay");
        const sidebarBannerPreview = document.getElementById(
          "sidebarBannerPreview",
        );
        const avatarDisplay = document.getElementById("avatarDisplay");
        const sidebarAvatarPreview = document.getElementById(
          "sidebarAvatarPreview",
        );
        const headerProfileAvatar = document.getElementById(
          "headerProfileAvatar",
        );

        document
          .getElementById("uploadBannerTrigger")
          .addEventListener("click", () => bannerFileInput.click());
        document
          .getElementById("changePhotoTrigger")
          .addEventListener("click", () => avatarFileInput.click());
        document
          .getElementById("avatarMiniTrigger")
          .addEventListener("click", () => avatarFileInput.click());

        bannerFileInput.addEventListener("change", (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function (evt) {
              bannerDisplay.style.backgroundImage = `url('${evt.target.result}')`;
              sidebarBannerPreview.style.backgroundImage = `url('${evt.target.result}')`;
              showToast("Studio banner updated successfully.", "image");
            };
            reader.readAsDataURL(file);
          }
        });

        avatarFileInput.addEventListener("change", (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function (evt) {
              avatarDisplay.src = evt.target.result;
              sidebarAvatarPreview.src = evt.target.result;
              if (headerProfileAvatar)
                headerProfileAvatar.src = evt.target.result;
              showToast("Studio profile picture updated successfully.", "face");
            };
            reader.readAsDataURL(file);
          }
        });

        // 4. Interactive Specialty Tags Multi-select
        const specialtyTags = document.querySelectorAll(".specialty-tag");
        specialtyTags.forEach((btn) => {
          btn.addEventListener("click", () => {
            const checkIcon = btn.querySelector(".material-symbols-outlined");
            const isSelected = btn.classList.contains("bg-primary");
            if (isSelected) {
              btn.classList.remove("bg-primary", "text-white", "shadow-sm");
              btn.classList.add(
                "bg-surface-container-lowest",
                "text-on-surface-variant",
                "border",
                "border-soft-border",
              );
              if (checkIcon) checkIcon.classList.add("opacity-0");
            } else {
              btn.classList.remove(
                "bg-surface-container-lowest",
                "text-on-surface-variant",
                "border",
                "border-soft-border",
              );
              btn.classList.add("bg-primary", "text-white", "shadow-sm");
              if (checkIcon) checkIcon.classList.remove("opacity-0");
            }
          });
        });

        // 5. Service Delivery Modes Toggle Logic
        const studioToggle = document.getElementById("modeToggleStudio");
        const mobileToggle = document.getElementById("modeToggleMobile");
        const studioStatus = document.getElementById("modeStudioStatus");
        const mobileStatus = document.getElementById("modeMobileStatus");
        const mobileDetailsRow = document.getElementById("mobileDetailsRow");
        const modeCardStudio = document.getElementById("modeCardStudio");
        const modeCardMobile = document.getElementById("modeCardMobile");
        const mobileIconBox = document.getElementById("mobileIconBox");

        function updateModes() {
          // Physical studio card status
          if (studioToggle.checked) {
            studioStatus.innerHTML =
              '<span class="material-symbols-outlined text-[14px]">check_circle</span> Active &amp; Bookable';
            studioStatus.className =
              "text-success-green font-semibold flex items-center gap-1";
            modeCardStudio.classList.add("border-primary/40");
          } else {
            studioStatus.innerHTML =
              '<span class="material-symbols-outlined text-[14px]">cancel</span> Walk-ins Disabled';
            studioStatus.className =
              "text-on-surface-variant font-semibold flex items-center gap-1";
            modeCardStudio.classList.remove("border-primary/40");
          }

          // Mobile service card status
          if (mobileToggle.checked) {
            mobileStatus.innerHTML =
              '<span class="material-symbols-outlined text-[14px]">check_circle</span> Enabled (House Calls)';
            mobileStatus.className =
              "text-success-green font-semibold flex items-center gap-1";
            mobileDetailsRow.classList.remove("hidden");
            mobileIconBox.classList.add("bg-primary", "text-white");
            mobileIconBox.classList.remove(
              "bg-surface-container-high",
              "text-primary",
            );
            modeCardMobile.classList.add("border-primary/40");
          } else {
            mobileStatus.innerHTML =
              '<span class="material-symbols-outlined text-[14px]">cancel</span> House Calls Inactive';
            mobileStatus.className =
              "text-on-surface-variant font-semibold flex items-center gap-1";
            mobileDetailsRow.classList.add("hidden");
            mobileIconBox.classList.remove("bg-primary", "text-white");
            mobileIconBox.classList.add(
              "bg-surface-container-high",
              "text-primary",
            );
            modeCardMobile.classList.remove("border-primary/40");
          }

          if (!studioToggle.checked && !mobileToggle.checked) {
            showToast(
              "Warning: Both delivery modes disabled. Clients cannot book.",
              "warning",
              true,
            );
          }
        }

        studioToggle.addEventListener("change", () => {
          updateModes();
          showToast(
            studioToggle.checked
              ? "Physical Walk-in appointments enabled."
              : "Walk-in appointments paused.",
          );
        });

        mobileToggle.addEventListener("change", () => {
          updateModes();
          showToast(
            mobileToggle.checked
              ? "Mobile House Calls service activated."
              : "Mobile House Calls service deactivated.",
          );
        });

        // 6. Escrow Deposit Slider Component
        const slider = document.getElementById("depositSlider");
        const display = document.getElementById("depositDisplay");
        const inlineText = document.getElementById("depositInlineText");
        if (slider && display) {
          slider.addEventListener("input", function (e) {
            const val = e.target.value;
            display.textContent = val;
            if (inlineText) inlineText.textContent = val + "%";
          });
        }

        async function loadBookingSettings() {
          const token = localStorage.getItem("glamoraToken");
          if (!token) return;
          try {
            const response = await fetch("http://localhost:3000/api/vendor/business", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Could not load booking settings.");

            studioToggle.checked = data.business.deliveryMode !== "HOME_SERVICE_ONLY";
            mobileToggle.checked = data.business.deliveryMode !== "STUDIO_ONLY";
            slider.value = data.business.breakagePercent;
            display.textContent = data.business.breakagePercent;
            const travelInput = document.getElementById("travelSurchargeInput");
            travelInput.value = `₦ ${new Intl.NumberFormat("en-NG").format(data.business.logisticsFeeKobo / 100)}`;
            updateModes();
          } catch (error) {
            showToast(error.message || "Could not load booking settings.", "error", true);
          }
        }

        async function saveBookingSettings() {
          const token = localStorage.getItem("glamoraToken");
          const deliveryMode = studioToggle.checked
            ? (mobileToggle.checked ? "BOTH" : "STUDIO_ONLY")
            : (mobileToggle.checked ? "HOME_SERVICE_ONLY" : null);
          const travelInput = document.getElementById("travelSurchargeInput");
          const logisticsFee = Number(travelInput.value.replace(/[^\d.]/g, ""));
          if (!token || !deliveryMode || !Number.isFinite(logisticsFee) || logisticsFee < 0) {
            showToast("Enable at least one delivery mode and enter a valid logistics fee.", "error", true);
            return false;
          }

          try {
            const response = await fetch("http://localhost:3000/api/vendor/business", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                deliveryMode,
                breakagePercent: Number(slider.value),
                logisticsFeeKobo: Math.round(logisticsFee * 100),
              }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Could not save booking settings.");
            return true;
          } catch (error) {
            showToast(error.message || "Could not save booking settings.", "error", true);
            return false;
          }
        }

        loadBookingSettings();

        // 7. Chair Turnaround Buffer Buttons
        const bufferGroup = document.getElementById("bufferButtonGroup");
        if (bufferGroup) {
          const buttons = bufferGroup.querySelectorAll(".buffer-btn");
          buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
              buttons.forEach((b) => {
                b.classList.remove(
                  "bg-primary",
                  "text-on-primary",
                  "shadow-sm",
                );
                b.classList.add("bg-surface-container-low", "text-on-surface");
                const subtitle = b.querySelector("span:last-child");
                if (subtitle) {
                  subtitle.classList.remove("text-surface-container-low");
                  subtitle.classList.add("text-on-surface-variant");
                }
              });
              btn.classList.remove(
                "bg-surface-container-low",
                "text-on-surface",
              );
              btn.classList.add("bg-primary", "text-on-primary", "shadow-sm");
              const sub = btn.querySelector("span:last-child");
              if (sub) {
                sub.classList.remove("text-on-surface-variant");
                sub.classList.add("text-surface-container-low");
              }
              showToast(
                `Turnaround sanitation buffer set to ${btn.dataset.buffer} minutes.`,
              );
            });
          });
        }

        // 8. Currency Dropdown Selector Sync
        const currencySelect = document.getElementById(
          "operatingCurrencySelect",
        );
        const sidebarAbv = document.getElementById("sidebarAbv");
        currencySelect.addEventListener("change", (e) => {
          const val = e.target.value;
          if (val === "USD") sidebarAbv.textContent = "$ 85.00";
          else if (val === "GBP") sidebarAbv.textContent = "£ 70.00";
          else sidebarAbv.textContent = "₦ 68,500";
          showToast(`Base operating currency updated to ${val}.`);
        });

        // 9. Fully Functional Compliance Certificate PDF Download Simulation
        const downloadPdfBtn = document.getElementById("downloadPdfBtn");
        downloadPdfBtn.addEventListener("click", () => {
          showToast(
            "Generating official Glamora Escrow Accreditation PDF...",
            "download",
          );
          setTimeout(() => {
            // Create synthetic blob and trigger genuine browser file download
            const pdfContent = `GLAMORA INSTITUTIONAL COMPLIANCE CERTIFICATE\n==========================================\nAccreditation ID: LPA-8841-GLM\nStudio: Alexander Vanguard Studio & Apothecary\nEscrow Status: Tier 1 Bonded Guarantee\nUnderwriter: Leadway Assurance Professional Indemnity\nValid Period: 2025 - 2026\nSettlement Destination: GTBank Ending 8921\nArbitration Standard: Glamora Marketplace Fair Protection Standards\n==========================================`;
            const blob = new Blob([pdfContent], { type: "application/pdf" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download =
              "Glamora-Compliance-Accreditation-AlexanderVanguard.pdf";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast(
              "Certificate downloaded: Glamora-Compliance-Accreditation.pdf",
              "check_circle",
            );
          }, 600);
        });

        // 10. Fully Functional Studio Suspension / Pause Chair Toggle
        let isStudioSuspended = false;
        const suspensionActionBtn = document.getElementById(
          "suspensionActionBtn",
        );
        const suspensionBtnText = document.getElementById("suspensionBtnText");
        const suspensionBadge = document.getElementById("suspensionBadge");
        const suspensionText = document.getElementById("suspensionText");
        const suspensionCard = document.getElementById("suspensionCard");

        suspensionActionBtn.addEventListener("click", () => {
          isStudioSuspended = !isStudioSuspended;

          if (isStudioSuspended) {
            suspensionBadge.textContent = "Suspended / Paused";
            suspensionBadge.className =
              "bg-error text-white font-label-sm text-label-sm px-2.5 py-0.5 rounded-full font-semibold";
            suspensionBtnText.textContent = "Reactivate Public Booking Chair";
            suspensionActionBtn.className =
              "w-full px-4 py-2.5 rounded-lg bg-primary text-white font-label-sm text-label-sm hover:bg-charcoal transition-all shadow-sm font-semibold flex items-center justify-center gap-1.5";
            suspensionActionBtn.querySelector(
              ".material-symbols-outlined",
            ).textContent = "play_circle";
            suspensionText.textContent =
              "Your studio is paused. New clients cannot book your calendar. Existing bookings remain intact.";
            suspensionCard.className =
              "p-md rounded-xl bg-error-container/80 space-y-sm border border-error/50 transition-colors";
            showToast(
              "Studio presence paused. Public booking disabled.",
              "pause_circle",
              true,
            );
          } else {
            suspensionBadge.textContent = "Public / Active";
            suspensionBadge.className =
              "bg-white/80 text-success-green font-label-sm text-label-sm px-2 py-0.5 rounded-full font-semibold";
            suspensionBtnText.textContent = "Pause Public Booking Chair";
            suspensionActionBtn.className =
              "w-full px-4 py-2.5 rounded-lg bg-white text-error font-label-sm text-label-sm hover:bg-error hover:text-white transition-all shadow-sm border border-error/20 font-semibold flex items-center justify-center gap-1.5";
            suspensionActionBtn.querySelector(
              ".material-symbols-outlined",
            ).textContent = "pause_circle";
            suspensionText.textContent =
              "Temporarily pause your studio presence on Glamora marketplace. Existing bonded bookings will remain valid.";
            suspensionCard.className =
              "p-md rounded-xl bg-error-container/40 space-y-sm border border-error-container transition-colors";
            showToast(
              "Studio reactivated! Calendar is open for public reservations.",
              "check_circle",
            );
          }
        });

        // 11. Bank update button micro-interaction
        const changeBankBtn = document.getElementById("changeBankBtn");
        if (changeBankBtn) {
          changeBankBtn.addEventListener("click", () => {
            showToast(
              "Redirecting to secure NIBSS Corporate Mandate portal...",
              "lock",
            );
          });
        }
      })();
  