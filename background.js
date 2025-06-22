// Background Service Worker for Local TTS Extension

// Extension installation handler
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "install") {
    console.log("Local TTS Extension installed");

    // Set default settings
    chrome.storage.sync.set({
      apiUrl: "http://localhost:8880",
      voice: "en",
      speed: 1.0,
      audioFormat: "pcm",
    });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // Forward messages between popup and content script if needed
  if (request.action === "forwardToContentScript" && request.tabId) {
    chrome.tabs.sendMessage(request.tabId, request.data, function (response) {
      sendResponse(response);
    });
    return true; // Keep message channel open for async response
  }

  // Handle background tasks
  switch (request.action) {
    case "checkTTSAPI":
      checkTTSAPI(request.apiUrl)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message }),
        );
      return true;

    case "getBadgeText":
      chrome.action.getBadgeText({ tabId: sender.tab.id }, function (result) {
        sendResponse({ badgeText: result });
      });
      return true;

    case "setBadgeText":
      chrome.action.setBadgeText({
        text: request.text,
        tabId: sender.tab.id,
      });
      sendResponse({ success: true });
      break;

    default:
      // Log unknown actions for debugging
      console.log("Unknown action in background script:", request.action);
  }
});

// Check if TTS API is accessible
async function checkTTSAPI(apiUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${apiUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, message: "TTS API is accessible" };
    } else {
      return {
        success: false,
        message: `API returned status: ${response.status}`,
      };
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return { success: false, message: "API request timed out" };
    }
    return {
      success: false,
      message: `Cannot connect to API: ${error.message}`,
    };
  }
}

// Handle extension icon click (alternative to popup)
chrome.action.onClicked.addListener(function (tab) {
  // This will only fire if no popup is defined
  // Since we have a popup, this won't normally execute
  // But keeping it here for potential future use
  chrome.tabs.sendMessage(tab.id, { action: "toggleReading" });
});

// Context menu for right-click functionality
chrome.runtime.onInstalled.addListener(function () {
  // Create context menu items
  try {
    chrome.contextMenus.create({
      id: "readSelectedText",
      title: "Read selected text with Local TTS",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "readFullArticle",
      title: "Read full article with Local TTS",
      contexts: ["page"],
    });

    console.log("Context menus created successfully");
  } catch (error) {
    console.error("Error creating context menus:", error);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  console.log("Context menu clicked:", info.menuItemId);

  chrome.storage.sync.get(["apiUrl", "voice", "speed", "audioFormat"], function (settings) {
    const message = {
      apiUrl: settings.apiUrl || "http://localhost:8880",
      voice: settings.voice || "en",
      speed: settings.speed || 1.0,
      audioFormat: settings.audioFormat || "pcm",
    };

    switch (info.menuItemId) {
      case "readSelectedText":
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "readSelected",
            selectedText: info.selectionText,
            ...message,
          },
          function (response) {
            if (chrome.runtime.lastError) {
              console.error(
                "Error sending message to content script:",
                chrome.runtime.lastError,
              );
            }
          },
        );
        break;

      case "readFullArticle":
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "read",
            ...message,
          },
          function (response) {
            if (chrome.runtime.lastError) {
              console.error(
                "Error sending message to content script:",
                chrome.runtime.lastError,
              );
            }
          },
        );
        break;
    }
  });
});

// Handle tab updates (page navigation)
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === "complete" && tab.url) {
    // Reset badge when page loads
    chrome.action.setBadgeText({ text: "", tabId: tabId });
  }
});

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener(function (details) {
  console.log("Extension update available:", details.version);
  // Auto-reload extension (optional - can be removed if not desired)
  // chrome.runtime.reload();
});

// Cleanup on extension suspend
chrome.runtime.onSuspend.addListener(function () {
  console.log("Local TTS Extension suspending");
  // Perform any necessary cleanup
});
