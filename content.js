// Content Script for Kokoro TTS Extension
(function () {
  let currentAudio = null;
  let audioContext = null;
  let isPlaying = false;
  let isPaused = false;

  // Initialize audio context
  function initAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume audio context if suspended (required by Chrome's autoplay policy)
    if (audioContext.state === "suspended") {
      return audioContext.resume();
    }
    return Promise.resolve();
  }

  // Extract article content from the page
  function extractArticleText() {
    let text = "";

    // Try common article selectors
    const selectors = [
      "article",
      '[role="main"]',
      ".article-content",
      ".post-content",
      ".entry-content",
      ".content",
      "main",
      ".story-body",
      ".article-body",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        text = extractTextFromElement(element);
        if (text.length > 100) break; // Found substantial content
      }
    }

    // Fallback: try to find paragraphs
    if (text.length < 100) {
      const paragraphs = document.querySelectorAll("p");
      const paragraphTexts = Array.from(paragraphs)
        .map((p) => p.textContent.trim())
        .filter((text) => text.length > 50); // Filter out short paragraphs

      text = paragraphTexts.join(" ");
    }

    // Final fallback: get readable text from body
    if (text.length < 100) {
      text = extractTextFromElement(document.body);
    }

    return cleanText(text);
  }

  // Extract text from element, excluding script/style tags
  function extractTextFromElement(element) {
    const clonedElement = element.cloneNode(true);

    // Remove script, style, nav, header, footer, aside elements
    const elementsToRemove = clonedElement.querySelectorAll(
      "script, style, nav, header, footer, aside, .nav, .navigation, .sidebar, .ads, .advertisement",
    );
    elementsToRemove.forEach((el) => el.remove());

    return clonedElement.textContent || clonedElement.innerText || "";
  }

  // Clean and normalize text
  function cleanText(text) {
    return text
      .replace(/\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, "\n") // Remove excessive line breaks
      .trim();
    // .substring(0, 5000); // Limit text length for reasonable processing time
  }

  // Call Kokoro FastAPI to generate speech
  async function generateSpeech(text, apiUrl, voice) {
    try {
      const response = await fetch(`${apiUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "kokoro",
          input: text,
          voice: "af_alloy",
          response_format: "pcm",
          download_format: "mp3",
          speed: 1,
          stream: true,
          return_download_link: false,
          lang_code: "a",
          normalization_options: {
            normalize: true,
            unit_normalization: false,
            url_normalization: true,
            email_normalization: true,
            optional_pluralization_normalization: true,
            phone_normalization: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error("Kokoro API error:", error);
      throw error;
    }
  }

  // Play audio from array buffer
  async function playAudio(audioBuffer, speed = 1.0) {
    try {
      await initAudioContext();

      const audioData = await audioContext.decodeAudioData(
        audioBuffer.slice(0),
      );
      const source = audioContext.createBufferSource();
      source.buffer = audioData;
      source.playbackRate.value = speed;

      // Connect to destination
      source.connect(audioContext.destination);

      // Set up current audio reference
      currentAudio = source;
      isPlaying = true;
      isPaused = false;

      // Handle playback end
      source.onended = () => {
        isPlaying = false;
        currentAudio = null;
        chrome.runtime.sendMessage({ action: "playbackFinished" });
      };

      // Start playing
      source.start(0);

      return source;
    } catch (error) {
      console.error("Audio playback error:", error);
      throw error;
    }
  }

  // Stop current playback
  function stopPlayback() {
    if (currentAudio) {
      try {
        currentAudio.stop();
      } catch (e) {
        // Audio might already be stopped
      }
      currentAudio = null;
    }
    isPlaying = false;
    isPaused = false;
  }

  // Pause/resume playback (note: Web Audio API doesn't have native pause/resume)
  function pauseResumePlayback() {
    if (audioContext) {
      if (isPaused) {
        audioContext.resume();
        isPaused = false;
      } else {
        audioContext.suspend();
        isPaused = true;
      }
    }
  }

  // Add visual indicator
  function addVisualIndicator() {
    // Remove existing indicator
    removeVisualIndicator();

    const indicator = document.createElement("div");
    indicator.id = "kokoro-tts-indicator";
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        animation: kokoro-fade-in 0.3s ease-out;
      ">
        🎵 Reading with Kokoro TTS...
      </div>
      <style>
        @keyframes kokoro-fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;

    document.body.appendChild(indicator);
  }

  function removeVisualIndicator() {
    const existing = document.getElementById("kokoro-tts-indicator");
    if (existing) {
      existing.remove();
    }
  }

  // Message listener
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      (async function () {
        try {
          console.log(request);
          switch (request.action) {
            case "readSelected":
              // Stop any current playback
              stopPlayback();

              // Use provided selected text
              const selectedText = request.selectedText;
              if (!selectedText || selectedText.length < 5) {
                sendResponse({
                  success: false,
                  message: "No text selected or text too short",
                });
                return;
              }

              sendResponse({
                success: true,
                message: `Reading selected text (${selectedText.length} characters)...`,
              });

              try {
                // Show visual indicator
                addVisualIndicator();
                console.log(request);
                // Generate speech for selected text
                const audioBuffer = await generateSpeech(
                  selectedText,
                  request.apiUrl,
                  request.voice,
                );

                // Play audio
                await playAudio(audioBuffer, request.speed);

                chrome.runtime.sendMessage({
                  action: "updateProgress",
                  progress: 100,
                });
              } catch (error) {
                removeVisualIndicator();
                chrome.runtime.sendMessage({
                  action: "playbackError",
                  error: error.message,
                });
              }
              break;

            case "read":
              // Stop any current playback
              stopPlayback();

              // Extract text
              const text = extractArticleText();
              if (!text || text.length < 10) {
                sendResponse({
                  success: false,
                  message: "No readable content found on this page",
                });
                return;
              }

              sendResponse({
                success: true,
                message: `Found ${text.length} characters. Generating speech...`,
              });

              try {
                // Show visual indicator
                addVisualIndicator();

                // Generate speech
                const audioBuffer = await generateSpeech(
                  text,
                  request.apiUrl,
                  request.voice,
                );

                // Play audio
                await playAudio(audioBuffer, request.speed);

                chrome.runtime.sendMessage({
                  action: "updateProgress",
                  progress: 100,
                });
              } catch (error) {
                removeVisualIndicator();
                chrome.runtime.sendMessage({
                  action: "playbackError",
                  error: error.message,
                });
              }
              break;

            case "pause":
              pauseResumePlayback();
              sendResponse({
                success: true,
                message: isPaused ? "Paused" : "Resumed",
              });
              break;

            case "stop":
              stopPlayback();
              removeVisualIndicator();
              sendResponse({ success: true, message: "Stopped" });
              break;

            default:
              sendResponse({ success: false, message: "Unknown action" });
          }
        } catch (error) {
          console.error("Content script error:", error);
          sendResponse({ success: false, message: error.message });
        }
      })();

      return true; // Keep the message channel open for async response
    },
  );

  // Clean up on page unload
  window.addEventListener("beforeunload", function () {
    stopPlayback();
    removeVisualIndicator();
  });
})();
