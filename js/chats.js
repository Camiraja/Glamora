let isUserBlocked = false;

// Global state for filtering & search
let currentFilter = 'all';
let currentSearchQuery = '';

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


document.addEventListener("DOMContentLoaded", () => {
  const trigger = document.getElementById("chat-menu-trigger");
  const menu = document.getElementById("chat-menu");

  if (trigger && menu) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !trigger.contains(e.target)) {
        menu.classList.add("hidden");
      }
    });
  }
});

/* --- Mobile Toggling --- */
function openMobileChat() {
  if (window.innerWidth < 1024) {
    document.getElementById("chat-sidebar").classList.add("hidden");
    const mainChat = document.getElementById("main-chat-area");
    mainChat.classList.remove("hidden");
    mainChat.classList.add("flex");
  }
}

function closeMobileChat() {
  if (window.innerWidth < 1024) {
    document.getElementById("chat-sidebar").classList.remove("hidden");
    const mainChat = document.getElementById("main-chat-area");
    mainChat.classList.add("hidden");
    mainChat.classList.remove("flex");
  }
}

/* --- Search & Filter Logic Interplay --- */
function applyFilters() {
  const chats = document.querySelectorAll(".chat-item");
  chats.forEach((chat) => {
    const nameElement = chat.querySelector("h3");
    if (!nameElement) return;
    
    const name = nameElement.innerText.toLowerCase();
    const matchesSearch = name.includes(currentSearchQuery);
    let matchesFilter = false;

    if (currentFilter === "all") {
      matchesFilter = true;
    } else if (currentFilter === "unread" && chat.dataset.unread === "true") {
      matchesFilter = true;
    } else if (currentFilter === "bookings" && chat.dataset.booking === "true") {
      matchesFilter = true;
    }

    if (matchesSearch && matchesFilter) {
      chat.style.display = "flex";
    } else {
      chat.style.display = "none";
    }
  });
}

function filterChats(filterType, clickedButton) {
  const buttons = document.querySelectorAll("#filter-buttons button");
  buttons.forEach((btn) => {
    btn.classList.remove("bg-charcoal", "text-white");
    btn.classList.add("border-soft-border", "text-on-surface-variant");
  });
  
  clickedButton.classList.remove("border-soft-border", "text-on-surface-variant");
  clickedButton.classList.add("bg-charcoal", "text-white");

  currentFilter = filterType;
  applyFilters();
}

function searchChats(query) {
  currentSearchQuery = query.toLowerCase();
  applyFilters();
}

/* --- Modals --- */
function openModal(id) {
  document.getElementById("chat-menu")?.classList.add("hidden");
  document.getElementById(id)?.classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function handleProfileView() {
  if (isUserBlocked) {
    alert("You cannot view the profile of a blocked user. Unblock them first.");
    return;
  }
  openModal("profileModal");
}

function confirmBlockUser() {
  isUserBlocked = true;
  closeModal("blockConfirmModal");
  
  document.getElementById("chat-input-area").classList.add("hidden");
  document.getElementById("blocked-input-area").classList.remove("hidden");
  document.getElementById("chat-user-status").innerHTML = '<span class="text-label-sm font-label-sm text-error-red">Blocked</span>';
}

function unblockUser() {
  isUserBlocked = false;
  document.getElementById("chat-input-area").classList.remove("hidden");
  document.getElementById("blocked-input-area").classList.add("hidden");
  document.getElementById("chat-user-status").innerHTML = `
    <div class="w-1.5 h-1.5 bg-success-green rounded-full"></div>
    <span class="text-label-sm font-label-sm text-on-surface-variant">Online</span>
  `;
}

function proceedToReportDetails() {
  closeModal("reportConfirmModal");
  openModal("reportDetailModal");
}

function submitReport(event) {
  event.preventDefault();
  const shouldBlock = document.getElementById("blockCheckbox").checked;
  closeModal("reportDetailModal");
  
  if (shouldBlock) {
    confirmBlockUser();
  }
  alert("Thank you. Your report has been submitted to Glamora Support.");
}

function dismissBanner() {
  const banner = document.getElementById("safety-banner");
  if (banner) {
    banner.style.display = "none";
  }
}

/* --- Real Voice Recording Logic --- */
let isRecording = false;
let recordingInterval;
let recordingSeconds = 0;
let mediaRecorder;
let audioChunks = [];

async function toggleVoiceRecord() {
  if (isUserBlocked) return;
  const btn = document.getElementById("voice-record-btn");
  const icon = document.getElementById("voice-record-icon");
  const input = document.getElementById("message-input");

  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const mins = Math.floor(recordingSeconds / 60);
        const secs = (recordingSeconds % 60).toString().padStart(2, "0");
        
        sendAudioMessage(`${mins}:${secs}`, audioUrl);
        
        stream.getTracks().forEach(track => track.stop());
      });

      mediaRecorder.start();
      isRecording = true;
      icon.innerText = "stop";
      icon.classList.add("text-error-red");
      btn.classList.add("bg-error-container");
      input.value = "Recording... 0:00";
      input.disabled = true;

      recordingSeconds = 0;
      recordingInterval = setInterval(() => {
        recordingSeconds++;
        const mins = Math.floor(recordingSeconds / 60);
        const secs = (recordingSeconds % 60).toString().padStart(2, "0");
        input.value = `Recording... ${mins}:${secs}`;
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied or unavailable:", err);
      alert("Microphone access is required to send voice notes.");
    }
  } else {
    isRecording = false;
    clearInterval(recordingInterval);
    
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    
    icon.innerText = "mic";
    icon.classList.remove("text-error-red");
    btn.classList.remove("bg-error-container");
    input.disabled = false;
    input.value = "";
  }
}

/* --- Audio Playback Integration --- */
function sendAudioMessage(duration, audioUrl) {
  const history = document.getElementById("chat-history");
  const msgWrapper = document.createElement("div");
  const uniqueId = 'audio-' + Date.now();
  
  msgWrapper.className = "flex flex-col gap-xs max-w-[85%] md:max-w-[70%] self-end";
  msgWrapper.innerHTML = `
    <div class="bg-charcoal p-sm pr-md rounded-2xl rounded-br-sm text-white flex items-center gap-sm">
      <audio id="${uniqueId}" src="${audioUrl}" class="hidden"></audio>
      <button id="play-btn-${uniqueId}" onclick="toggleAudioPlayback('${uniqueId}')" class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 hover:bg-white/30 transition-colors">
        <span id="play-icon-${uniqueId}" class="material-symbols-outlined text-[18px]">play_arrow</span>
      </button>
      <div class="flex-1 w-24 sm:w-32 h-1 bg-white/30 rounded-full relative cursor-pointer" onclick="seekAudio(event, '${uniqueId}')" id="progress-bg-${uniqueId}">
        <div id="progress-bar-${uniqueId}" class="absolute left-0 top-0 bottom-0 w-0 bg-white rounded-full pointer-events-none transition-all duration-75"></div>
      </div>
      <span class="text-label-sm font-label-sm shrink-0">${duration}</span>
    </div>
    <span class="text-label-sm font-label-sm text-on-surface-variant self-end">Just now</span>
  `;
  history.appendChild(msgWrapper);
  history.scrollTop = history.scrollHeight;

  const audioEl = document.getElementById(uniqueId);
  const progressBar = document.getElementById(`progress-bar-${uniqueId}`);
  const playIcon = document.getElementById(`play-icon-${uniqueId}`);

  audioEl.addEventListener('timeupdate', () => {
    if (audioEl.duration) {
      const progressPercent = (audioEl.currentTime / audioEl.duration) * 100;
      progressBar.style.width = `${progressPercent}%`;
    }
  });

  audioEl.addEventListener('ended', () => {
    playIcon.innerText = 'play_arrow';
    progressBar.style.width = '0%';
  });
}

function toggleAudioPlayback(id) {
  const audioEl = document.getElementById(id);
  const playIcon = document.getElementById(`play-icon-${id}`);

  if (audioEl.paused) {
    document.querySelectorAll('audio').forEach(a => {
      if (a.id !== id && !a.paused) {
        a.pause();
        const otherIcon = document.getElementById(`play-icon-${a.id}`);
        if (otherIcon) otherIcon.innerText = 'play_arrow';
      }
    });

    audioEl.play();
    playIcon.innerText = 'pause';
  } else {
    audioEl.pause();
    playIcon.innerText = 'play_arrow';
  }
}

function seekAudio(event, id) {
  const audioEl = document.getElementById(id);
  const progressBg = document.getElementById(`progress-bg-${id}`);
  
  if (audioEl.duration) {
    const rect = progressBg.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * audioEl.duration;
    audioEl.currentTime = seekTime;
  }
}

/* --- Media / Image Attachment Upload --- */
function handleMediaUpload(event) {
  if (isUserBlocked) return;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const history = document.getElementById("chat-history");
    const msgWrapper = document.createElement("div");
    msgWrapper.className = "flex flex-col gap-xs max-w-[85%] md:max-w-[70%] self-end";
    
    msgWrapper.innerHTML = `
      <div class="bg-charcoal p-xs rounded-2xl rounded-br-sm text-white">
        <img src="${e.target.result}" class="max-w-full h-auto max-h-48 rounded-xl object-cover" alt="Attachment" />
      </div>
      <span class="text-label-sm font-label-sm text-on-surface-variant self-end">Just now</span>
    `;

    history.appendChild(msgWrapper);
    history.scrollTop = history.scrollHeight;
  }
  
  if (file.type.startsWith('image/')) {
    reader.readAsDataURL(file);
  } else {
    alert("Please upload an image file.");
  }
  
  event.target.value = '';
}

/* --- Standard Messaging --- */
function sendMessage() {
  if (isUserBlocked || isRecording) return;
  const input = document.getElementById("message-input");
  const val = input.value.trim();
  if (!val) return;

  const history = document.getElementById("chat-history");
  const msgWrapper = document.createElement("div");
  msgWrapper.className = "flex flex-col gap-xs max-w-[85%] md:max-w-[70%] self-end";
  msgWrapper.innerHTML = `
    <div class="bg-charcoal p-md rounded-2xl rounded-br-sm text-white">
      <p class="text-body-md font-body-md break-words">${val}</p>
    </div>
    <span class="text-label-sm font-label-sm text-on-surface-variant self-end">Just now</span>
  `;
  history.appendChild(msgWrapper);
  input.value = "";
  input.style.height = "";
  history.scrollTop = history.scrollHeight;

  const sidebarMsg = document.getElementById("sidebar-last-msg");
  if (sidebarMsg) {
    sidebarMsg.innerText = val;
  }
}