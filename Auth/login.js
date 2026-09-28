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

const API_BASE_URL = "http://localhost:3000";

function normalizeReturnTarget(target) {
  if (!target) {
    return "../landing page.html";
  }

  if (target.startsWith("http://") || target.startsWith("https://")) {
    return target;
  }

  const cleanTarget = target.replace(/\\/g, "/");

  if (window.location.pathname.toLowerCase().includes("/auth/")) {
    return cleanTarget.startsWith("../") ? cleanTarget : `../${cleanTarget.replace(/^\.?\//, "")}`;
  }

  return cleanTarget.startsWith("./") ? cleanTarget.slice(2) : cleanTarget;
}

function redirectUserByRole(role) {
  const normalizedRole = String(role || "").toUpperCase();
  const returnTo = sessionStorage.getItem("glamoraReturnTo");

  if (returnTo) {
    sessionStorage.removeItem("glamoraReturnTo");
    window.location.href = normalizeReturnTarget(returnTo);
    return;
  }

  if (normalizedRole === "CUSTOMER") {
    window.location.href = "../customer-dashboard.html";
    return;
  }

  if (normalizedRole === "VENDOR") {
    window.location.href = "../vendor-dashboard.html";
    return;
  }

  window.location.href = "../landing page.html";
}

function saveSession(token, user) {
  localStorage.setItem("glamoraToken", token);
  localStorage.setItem("glamoraUser", JSON.stringify(user));
}

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
  alert(`${provider} sign-in is not connected yet. Please use email login for now.`);
}

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const form = e.currentTarget;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  const messageEl = document.getElementById("loginMessage");

  btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';
  btn.classList.add("opacity-80", "cursor-not-allowed");

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed.");
    }

    saveSession(data.token, data.user);
    if (messageEl) {
      messageEl.textContent = "Login successful. Redirecting...";
      messageEl.className = "text-sm text-success-green mt-2";
    }

    redirectUserByRole(data.user.role);
  } catch (error) {
    btn.innerHTML = originalText;
    btn.classList.remove("opacity-80", "cursor-not-allowed");

    if (messageEl) {
      messageEl.textContent = error.message || "Login failed. Please try again.";
      messageEl.className = "text-sm text-error mt-2";
    }
  }
});