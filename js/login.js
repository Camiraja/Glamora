// --- Theme Switcher Logic (Passive Listener) ---
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

// --- Password Toggle & Form Logic ---

function togglePassword() {
  const passwordInput = document.getElementById("password");
  const visibilityIcon = document.getElementById("visibilityIcon");

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    visibilityIcon.textContent = "visibility";
  } else {
    passwordInput.type = "password";
    visibilityIcon.textContent = "visibility_off";
  }
}

function handleSSO(provider) {
  console.log(`Authenticating with ${provider}...`);
  window.location.href = "dashboard.html";
}

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  
  const btn = this.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;

  btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';
  btn.classList.add("opacity-80", "cursor-not-allowed");

  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.classList.remove("opacity-80", "cursor-not-allowed");
    window.location.href = "dashboard.html";
  }, 1500);
});