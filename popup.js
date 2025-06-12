// Popup JavaScript for Kokoro TTS Extension
document.addEventListener("DOMContentLoaded", function () {
  const apiUrlInput = document.getElementById("apiUrl");
  const voiceSelect = document.getElementById("voice");
  const speedSlider = document.getElementById("speed");
  const speedValue = document.getElementById("speedValue");
  const readBtn = document.getElementById("readBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stopBtn = document.getElementById("stopBtn");
  const status = document.getElementById("status");
  const progress = document.getElementById("progress");
  const progressBar = document.getElementById("progressBar");

  // Load saved settings
  chrome.storage.sync.get(["apiUrl", "voice", "speed"], function (result) {
    if (result.apiUrl) apiUrlInput.value = result.apiUrl;
    if (result.voice) voiceSelect.value = result.voice;
    if (result.speed) {
      speedSlider.value = result.speed;
      speedValue.textContent = result.speed + "x";
    }
  });

  // Save settings on change
  function saveSettings() {
    chrome.storage.sync.set({
      apiUrl: apiUrlInput.value,
      voice: voiceSelect.value,
      speed: speedSlider.value,
    });
  }

  apiUrlInput.addEventListener("change", saveSettings);
  voiceSelect.addEventListener("change", saveSettings);
  speedSlider.addEventListener("input", function () {
    speedValue.textContent = this.value + "x";
    saveSettings();
  });

  // Show status message
  function showStatus(message, type = "info") {
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove("hidden");

    if (type !== "error") {
      setTimeout(() => {
        status.classList.add("hidden");
      }, 3000);
    }
  }

  // Show/hide progress
  function showProgress(show = true) {
    if (show) {
      progress.classList.remove("hidden");
    } else {
      progress.classList.add("hidden");
      progressBar.style.width = "0%";
    }
  }

  // Update progress
  function updateProgress(percent) {
    progressBar.style.width = percent + "%";
  }

  // Get current tab and send message to content script
  function sendToContentScript(action, data = {}) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: action,
            apiUrl: apiUrlInput.value,
            voice: voiceSelect.value,
            speed: parseFloat(speedSlider.value),
            ...data,
          },
          function (response) {
            if (chrome.runtime.lastError) {
              showStatus("Error: " + chrome.runtime.lastError.message, "error");
            } else if (response) {
              if (response.success) {
                showStatus(response.message, "success");
                if (action === "read") {
                  showProgress(true);
                  updateProgress(0);
                }
              } else {
                showStatus(response.message, "error");
                showProgress(false);
              }
            }
          },
        );
      }
    });
  }

  // Button event listeners
  readBtn.addEventListener("click", function () {
    showStatus("Extracting article text...", "info");
    sendToContentScript("read");
  });

  pauseBtn.addEventListener("click", function () {
    sendToContentScript("pause");
  });

  stopBtn.addEventListener("click", function () {
    sendToContentScript("stop");
    showProgress(false);
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (request.action === "updateProgress") {
        updateProgress(request.progress);
      } else if (request.action === "playbackFinished") {
        showStatus("Playback finished", "success");
        showProgress(false);
      } else if (request.action === "playbackError") {
        showStatus("Playback error: " + request.error, "error");
        showProgress(false);
      }
    },
  );
});
