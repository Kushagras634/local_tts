// Content Script for Kokoro TTS Extension
(function () {
  let currentAudio = null;
  let audioContext = null;
  let isPlaying = false;
  let isPaused = false;
  let audioQueue = [];
  let isProcessingQueue = false;
  let textChunks = [];
  let currentChunkIndex = 0;
  let highlightedElements = [];
  let isReadingSelected = false;
  let selectedRange = null;

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
  }

  // Split text into chunks for streaming and store for highlighting
  function splitTextIntoChunks(text, maxChunkSize = 500) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } else {
        currentChunk += (currentChunk.length > 0 ? ". " : "") + trimmedSentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    // Store chunks for highlighting
    textChunks = chunks;
    currentChunkIndex = 0;

    return chunks;
  }

  // Highlight text in the page
  function highlightText(text, isSelected = false) {
    clearHighlights();

    if (isSelected && selectedRange) {
      highlightSelectedText(text);
    } else {
      highlightPageText(text);
    }

    // Add progress indicator
    const progress = document.createElement('div');
    progress.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #4CAF50 ${(currentChunkIndex / textChunks.length) * 100}%, #e0e0e0 ${(currentChunkIndex / textChunks.length) * 100}%);
      width: 100%;
      z-index: 10001;
    `;
    progress.id = 'kokoro-tts-progress';
    document.body.appendChild(progress);
  }

  // Highlight selected text
  function highlightSelectedText(text) {
    try {
      if (selectedRange) {
        const span = document.createElement('span');
        span.className = 'kokoro-tts-highlight';
        span.style.cssText = `
          background: linear-gradient(120deg, #a8e6cf 0%, #dcedc8 100%) !important;
          padding: 2px 4px !important;
          border-radius: 3px !important;
          animation: kokoro-pulse 1.5s ease-in-out infinite alternate !important;
          box-shadow: 0 0 10px rgba(168, 230, 207, 0.6) !important;
        `;

        try {
          selectedRange.surroundContents(span);
          highlightedElements.push(span);
        } catch (e) {
          // If surroundContents fails, try extractContents and insert
          const contents = selectedRange.extractContents();
          span.appendChild(contents);
          selectedRange.insertNode(span);
          highlightedElements.push(span);
        }
      }
    } catch (error) {
      console.log('Could not highlight selected text:', error);
    }
  }

  // Highlight text in page content
  function highlightPageText(text) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script, style, and already highlighted elements
          const parent = node.parentElement;
          if (!parent ||
              parent.tagName === 'SCRIPT' ||
              parent.tagName === 'STYLE' ||
              parent.classList.contains('kokoro-tts-highlight') ||
              parent.closest('#kokoro-tts-indicator')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Find the text to highlight
    const searchText = text.substring(0, 100).toLowerCase(); // Use first 100 chars for matching

    for (const textNode of textNodes) {
      const nodeText = textNode.textContent.toLowerCase();
      const index = nodeText.indexOf(searchText);

      if (index !== -1) {
        try {
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, Math.min(index + text.length, textNode.textContent.length));

          const span = document.createElement('span');
          span.className = 'kokoro-tts-highlight';
          span.style.cssText = `
            background: linear-gradient(120deg, #a8e6cf 0%, #dcedc8 100%) !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            animation: kokoro-pulse 1.5s ease-in-out infinite alternate !important;
            box-shadow: 0 0 10px rgba(168, 230, 207, 0.6) !important;
          `;

          range.surroundContents(span);
          highlightedElements.push(span);

          // Scroll to highlight
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        } catch (e) {
          console.log('Could not highlight text:', e);
        }
      }
    }
  }

  // Clear all highlights
  function clearHighlights() {
    highlightedElements.forEach(element => {
      if (element && element.parentNode) {
        const parent = element.parentNode;
        parent.insertBefore(document.createTextNode(element.textContent), element);
        parent.removeChild(element);
        parent.normalize();
      }
    });
    highlightedElements = [];

    const progress = document.getElementById('kokoro-tts-progress');
    if (progress) {
      progress.remove();
    }
  }

  // Add highlight styles to page
  function addHighlightStyles() {
    if (document.getElementById('kokoro-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'kokoro-highlight-styles';
    style.textContent = `
      @keyframes kokoro-pulse {
        from {
          background: linear-gradient(120deg, #a8e6cf 0%, #dcedc8 100%);
          box-shadow: 0 0 10px rgba(168, 230, 207, 0.6);
        }
        to {
          background: linear-gradient(120deg, #88d8a3 0%, #c8e6c9 100%);
          box-shadow: 0 0 15px rgba(136, 216, 163, 0.8);
        }
      }
      .kokoro-tts-highlight {
        transition: all 0.3s ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Call Kokoro FastAPI to generate speech with streaming
  async function generateSpeechStream(text, apiUrl, voice, speed = 1) {
    try {
      const response = await fetch(`${apiUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "kokoro",
          input: text,
          voice: voice,
          response_format: "pcm",
          download_format: "mp3",
          speed: speed,
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
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      console.log(`Response content-type: ${contentType}`);

      const arrayBuffer = await response.arrayBuffer();
      console.log(`Received audio data: ${arrayBuffer.byteLength} bytes`);

      // Validate that we received audio data
      if (arrayBuffer.byteLength === 0) {
        throw new Error("Received empty audio data from API");
      }

      // Check if it's actually audio data (basic validation)
      const uint8Array = new Uint8Array(arrayBuffer);
      const isLikelyAudio = uint8Array.byteLength > 100; // Basic size check

      if (!isLikelyAudio) {
        console.error("Received data doesn't appear to be audio:", new TextDecoder().decode(uint8Array.slice(0, 200)));
        throw new Error("API returned invalid audio data");
      }

      return arrayBuffer;
    } catch (error) {
      console.error("Kokoro API error:", error);
      throw error;
    }
  }

  // Process streaming audio chunks
  async function processStreamingAudio(text, apiUrl, voice, speed = 1, isSelected = false) {
    const chunks = splitTextIntoChunks(text, 500);
    console.log(`Processing ${chunks.length} text chunks for streaming...`);

    // Store reading state
    isReadingSelected = isSelected;
    if (isSelected) {
      selectedRange = window.getSelection().getRangeAt(0).cloneRange();
    }

    // Clear existing queue
    audioQueue = [];
    isProcessingQueue = true;
    addHighlightStyles();

    try {
      // Generate audio for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Generating audio for chunk ${i + 1}/${chunks.length}`);

        const audioBuffer = await generateSpeechStream(chunk, apiUrl, voice, speed);
        audioQueue.push(audioBuffer);

        // Start playing the first chunk immediately
        if (i === 0) {
          playNextInQueue();
        }

        // Update progress
        chrome.runtime.sendMessage({
          action: "updateProgress",
          progress: Math.round(((i + 1) / chunks.length) * 100),
        });
      }
    } catch (error) {
      isProcessingQueue = false;
      throw error;
    }
  }

  // Convert raw PCM data to AudioBuffer
  function createAudioBufferFromPCM(pcmData, sampleRate = 22050, channels = 1) {
    const samples = pcmData.byteLength / 2; // 16-bit samples
    const audioBuffer = audioContext.createBuffer(channels, samples, sampleRate);

    // Convert PCM data to Float32Array
    const pcmArray = new Int16Array(pcmData);
    const floatArray = new Float32Array(samples);

    // Convert 16-bit PCM to float (-1.0 to 1.0)
    for (let i = 0; i < samples; i++) {
      floatArray[i] = pcmArray[i] / 32768.0;
    }

    // Copy to audio buffer
    audioBuffer.copyToChannel(floatArray, 0);

    return audioBuffer;
  }

  // Play next audio chunk in queue
  async function playNextInQueue() {
    if (audioQueue.length === 0) {
      isProcessingQueue = false;
      isPlaying = false;
      currentAudio = null;
      chrome.runtime.sendMessage({ action: "playbackFinished" });
      return;
    }

    const audioBuffer = audioQueue.shift();

    try {
      await initAudioContext();

      console.log(`Processing PCM audio buffer: ${audioBuffer.byteLength} bytes`);

      let audioData;
      try {
        // First try to decode as encoded audio (MP3, WAV, etc.)
        audioData = await audioContext.decodeAudioData(audioBuffer.slice(0));
        console.log("Successfully decoded as encoded audio");
      } catch (decodeError) {
        console.log("Encoded audio decode failed, trying raw PCM...");

        // If that fails, treat as raw PCM data
        try {
          audioData = createAudioBufferFromPCM(audioBuffer);
          console.log(`Successfully created AudioBuffer from PCM: ${audioData.duration.toFixed(2)}s`);
        } catch (pcmError) {
          console.error("PCM processing error:", pcmError);

          // Try to continue with next chunk if available
          if (audioQueue.length > 0) {
            console.log("Skipping corrupted chunk, trying next one...");
            setTimeout(() => playNextInQueue(), 100);
            return;
          } else {
            throw new Error(`Audio processing failed: ${pcmError.message}`);
          }
        }
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioData;

      // Connect to destination
      source.connect(audioContext.destination);

      // Set up current audio reference
      currentAudio = source;
      isPlaying = true;
      isPaused = false;

      console.log(`Playing audio chunk: ${audioData.duration.toFixed(2)}s`);

      // Handle playback end - play next chunk
      source.onended = () => {
        if (audioQueue.length > 0) {
          // Move to next chunk and highlight it
          currentChunkIndex++;
          if (currentChunkIndex < textChunks.length) {
            highlightText(textChunks[currentChunkIndex], isReadingSelected);
          }

          // Play next chunk
          setTimeout(() => playNextInQueue(), 50); // Small delay between chunks
        } else {
          isPlaying = false;
          currentAudio = null;
          isProcessingQueue = false;
          clearHighlights();
          chrome.runtime.sendMessage({ action: "playbackFinished" });
        }
      };

      // Highlight current chunk when playback starts
      if (currentChunkIndex < textChunks.length) {
        highlightText(textChunks[currentChunkIndex], isReadingSelected);
      }

      // Start playing
      source.start(0);

    } catch (error) {
      console.error("Audio playback error:", error);
      isProcessingQueue = false;
      removeVisualIndicator();
      chrome.runtime.sendMessage({
        action: "playbackError",
        error: `Audio playback failed: ${error.message}`,
      });
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

    // Clear queue and highlights
    audioQueue = [];
    isProcessingQueue = false;
    isPlaying = false;
    isPaused = false;
    clearHighlights();
    currentChunkIndex = 0;
    textChunks = [];
    isReadingSelected = false;
    selectedRange = null;
  }

  // Pause/resume playback
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
    if (document.getElementById('kokoro-tts-indicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'kokoro-tts-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 10000;
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Add navigation buttons
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '⏮️';
    prevButton.title = 'Previous chunk (Alt + Left)';
    prevButton.onclick = () => navigateChunk(-1);

    const playPauseButton = document.createElement('button');
    playPauseButton.innerHTML = isPaused ? '▶️' : '⏸️';
    playPauseButton.title = 'Play/Pause (Space)';
    playPauseButton.onclick = pauseResumePlayback;

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '⏭️';
    nextButton.title = 'Next chunk (Alt + Right)';
    nextButton.onclick = () => navigateChunk(1);

    indicator.appendChild(prevButton);
    indicator.appendChild(playPauseButton);
    indicator.appendChild(nextButton);

    document.body.appendChild(indicator);

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
  }

  function handleKeyboardShortcuts(event) {
    if (event.altKey) {
      if (event.key === 'ArrowLeft') {
        navigateChunk(-1);
      } else if (event.key === 'ArrowRight') {
        navigateChunk(1);
      }
    } else if (event.code === 'Space' && !event.target.matches('input, textarea')) {
      event.preventDefault();
      pauseResumePlayback();
    }
  }

  function navigateChunk(direction) {
    if (!textChunks.length) return;

    // Stop current playback
    stopPlayback();

    // Update chunk index
    currentChunkIndex = Math.max(0, Math.min(textChunks.length - 1, currentChunkIndex + direction));

    // Start reading from the new chunk
    const text = textChunks[currentChunkIndex];
    highlightText(text, isReadingSelected);
    processStreamingAudio(text, 'http://localhost:5000/tts', 'default', 1, isReadingSelected);
  }

  function removeVisualIndicator() {
    const existing = document.getElementById("kokoro-tts-indicator");
    if (existing) {
      existing.remove();
    }
  }

  // Get selected text from the page
  function getSelectedText() {
    const selection = window.getSelection();
    return selection.toString().trim();
  }

  // Message listener
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      (async function () {
        try {
          console.log("Received request:", request);

          switch (request.action) {
            case "readSelected":
              // Stop any current playback
              stopPlayback();

              // Get selected text from the page (not from request)
              const selectedText = getSelectedText();

              if (!selectedText || selectedText.length < 5) {
                sendResponse({
                  success: false,
                  message: "No text selected or text too short. Please select some text first.",
                });
                return;
              }

              console.log(`Reading selected text: "${selectedText.substring(0, 100)}..."`);

              sendResponse({
                success: true,
                message: `Reading selected text (${selectedText.length} characters)...`,
              });

              try {
                // Show visual indicator
                addVisualIndicator();

                // Process streaming audio for selected text
                await processStreamingAudio(
                  selectedText,
                  request.apiUrl,
                  request.voice,
                  request.speed || 1
                );

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

              // Extract text from page
              const text = extractArticleText();
              if (!text || text.length < 10) {
                sendResponse({
                  success: false,
                  message: "No readable content found on this page",
                });
                return;
              }

              console.log(`Reading page content: ${text.length} characters`);

              sendResponse({
                success: true,
                message: `Found ${text.length} characters. Starting streaming playback...`,
              });

              try {
                // Show visual indicator
                addVisualIndicator();

                // Process streaming audio for page content
                await processStreamingAudio(
                  text,
                  request.apiUrl,
                  request.voice,
                  request.speed || 1
                );

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

  console.log("Kokoro TTS content script loaded");
})();
