// Popup JavaScript for Kokoro TTS Extension
document.addEventListener("DOMContentLoaded", function () {
  // Main controls
  const apiUrlInput = document.getElementById("apiUrl");
  const voiceSelect = document.getElementById("voice");
  const speedSlider = document.getElementById("speed");
  const speedValue = document.getElementById("speedValue");
  const readBtn = document.getElementById("readBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stopBtn = document.getElementById("stopBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const status = document.getElementById("status");
  const progress = document.getElementById("progress");
  const progressBar = document.getElementById("progressBar");

  // Content analysis elements
  const chunkCount = document.getElementById("chunkCount");
  const currentChunk = document.getElementById("currentChunk");
  const charCount = document.getElementById("charCount");
  const contentPreview = document.getElementById("contentPreview");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const extractBtn = document.getElementById("extractBtn");

  // Content selection options
  const includeIframes = document.getElementById("includeIframes");
  const includeSelected = document.getElementById("includeSelected");

  // Settings elements
  const autoPlay = document.getElementById("autoPlay");
  const highlightText = document.getElementById("highlightText");
  const showProgress = document.getElementById("showProgress");
  const chunkSize = document.getElementById("chunkSize");
  const chunkSizeValue = document.getElementById("chunkSizeValue");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const resetSettingsBtn = document.getElementById("resetSettingsBtn");

  // Tab management
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Initialize tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });

  // Load saved settings
  chrome.storage.sync.get([
    "apiUrl", "voice", "speed", "includeIframes", "includeSelected",
    "autoPlay", "highlightText", "showProgress", "chunkSize"
  ], function (result) {
    if (result.apiUrl) apiUrlInput.value = result.apiUrl;
    if (result.voice) voiceSelect.value = result.voice;
    if (result.speed) {
      speedSlider.value = result.speed;
      speedValue.textContent = result.speed + "x";
    }
    if (result.includeIframes !== undefined) includeIframes.checked = result.includeIframes;
    if (result.includeSelected !== undefined) includeSelected.checked = result.includeSelected;
    if (result.autoPlay !== undefined) autoPlay.checked = result.autoPlay;
    if (result.highlightText !== undefined) highlightText.checked = result.highlightText;
    if (result.showProgress !== undefined) showProgress.checked = result.showProgress;
    if (result.chunkSize) {
      chunkSize.value = result.chunkSize;
      chunkSizeValue.textContent = result.chunkSize + " chars";
    }
  });

  // Save settings on change
  function saveSettings() {
    chrome.storage.sync.set({
      apiUrl: apiUrlInput.value,
      voice: voiceSelect.value,
      speed: speedSlider.value,
      includeIframes: includeIframes.checked,
      includeSelected: includeSelected.checked,
      autoPlay: autoPlay.checked,
      highlightText: highlightText.checked,
      showProgress: showProgress.checked,
      chunkSize: chunkSize.value,
    });
  }

  // Event listeners for settings
  apiUrlInput.addEventListener("change", saveSettings);
  voiceSelect.addEventListener("change", saveSettings);
  speedSlider.addEventListener("input", function () {
    speedValue.textContent = this.value + "x";
    saveSettings();
  });

  includeIframes.addEventListener("change", saveSettings);
  includeSelected.addEventListener("change", saveSettings);
  autoPlay.addEventListener("change", saveSettings);
  highlightText.addEventListener("change", saveSettings);
  showProgress.addEventListener("change", saveSettings);

  chunkSize.addEventListener("input", function () {
    chunkSizeValue.textContent = this.value + " chars";
    saveSettings();
  });

  // Settings buttons
  saveSettingsBtn.addEventListener("click", function () {
    saveSettings();
    showStatus("Settings saved!", "success");
  });

  resetSettingsBtn.addEventListener("click", function () {
    chrome.storage.sync.clear(function() {
      location.reload();
    });
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
  function showProgressBar(show = true) {
    if (show && showProgress.checked) {
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

  // Update content analysis
  function updateContentAnalysis(data) {
    if (data.chunks) {
      chunkCount.textContent = data.chunks.length;
      currentChunk.textContent = data.currentChunk + 1;
      charCount.textContent = data.totalChars;
      
      if (data.chunks[data.currentChunk]) {
        contentPreview.textContent = data.chunks[data.currentChunk].substring(0, 200) + "...";
      }
    }
  }

  // Get current tab and send message to content script
  function sendToContentScript(action, data = {}) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        const messageData = {
          action: action,
          apiUrl: apiUrlInput.value,
          voice: voiceSelect.value,
          speed: parseFloat(speedSlider.value),
          includeIframes: includeIframes.checked,
          includeSelected: includeSelected.checked,
          autoPlay: autoPlay.checked,
          highlightText: highlightText.checked,
          chunkSize: parseInt(chunkSize.value),
          ...data,
        };

        chrome.tabs.sendMessage(
          tabs[0].id,
          messageData,
          function (response) {
            if (chrome.runtime.lastError) {
              showStatus("Error: " + chrome.runtime.lastError.message, "error");
            } else if (response) {
              if (response.success) {
                showStatus(response.message, "success");
                if (action === "read") {
                  showProgressBar(true);
                  updateProgress(0);
                }
                if (response.contentAnalysis) {
                  updateContentAnalysis(response.contentAnalysis);
                }
              } else {
                showStatus(response.message, "error");
                showProgressBar(false);
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
    showProgressBar(false);
  });

  prevBtn.addEventListener("click", function () {
    sendToContentScript("navigate", { direction: -1 });
  });

  nextBtn.addEventListener("click", function () {
    sendToContentScript("navigate", { direction: 1 });
  });

  analyzeBtn.addEventListener("click", function () {
    showStatus("Analyzing content...", "info");
    sendToContentScript("analyze");
  });

  extractBtn.addEventListener("click", function () {
    showStatus("Extracting text...", "info");
    sendToContentScript("extract");
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (request.action === "updateProgress") {
        updateProgress(request.progress);
      } else if (request.action === "updateContentAnalysis") {
        updateContentAnalysis(request.data);
      } else if (request.action === "playbackFinished") {
        showStatus("Playback finished", "success");
        showProgressBar(false);
      } else if (request.action === "playbackError") {
        showStatus("Playback error: " + request.error, "error");
        showProgressBar(false);
      } else if (request.action === "contentExtracted") {
        showStatus(`Extracted ${request.charCount} characters`, "success");
        updateContentAnalysis(request.analysis);
      }
    },
  );
});
