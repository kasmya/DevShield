// DevShield - Background Service Worker
// Handles communication between content script and popup

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzePage") {
    // Execute content script on the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "analyze" }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: "Unable to analyze this page" });
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({ error: "No active tab found" });
      }
    });
    return true; // Keep message channel open for async response
  }
});

// Log when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("DevShield Extension installed successfully");
});

