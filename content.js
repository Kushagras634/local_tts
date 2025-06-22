// Content Script for Kokoro TTS Extension (Bundled from src/main.js)
(() => {
  // src/text-extraction.js
  var TextExtractor = class {
    constructor() {
      this.textChunks = [];
      this.currentChunkIndex = 0;
    }
    // Extract readable text from HTML content with better formatting handling
    extractReadableText(element) {
      const clonedElement = element.cloneNode(true);
      const elementsToRemove = clonedElement.querySelectorAll(
        "script, style, nav, header, footer, aside, .nav, .navigation, .sidebar, .ads, .advertisement"
      );
      elementsToRemove.forEach((el) => el.remove());
      this.processSpecialFormatting(clonedElement);
      let text = "";
      const walker = document.createTreeWalker(
        clonedElement,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node2) {
            const parent = node2.parentElement;
            if (!parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.style.display === "none" || parent.style.visibility === "hidden") {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      let node;
      while (node = walker.nextNode()) {
        const nodeText = node.textContent.trim();
        if (nodeText) {
          text += nodeText + " ";
        }
      }
      return this.cleanText(text);
    }
    // Extract article content from the page
    async extractArticleText(includeIframes = true) {
      let text = "";
      if (includeIframes) {
        text = await this.extractTextFromIframes();
        if (text.length > 100) {
          return this.cleanText(text);
        }
      }
      const selectors = [
        "article",
        '[role="main"]',
        ".article-content",
        ".post-content",
        ".entry-content",
        ".content",
        "main",
        ".story-body",
        ".article-body"
      ];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          text = this.extractReadableText(element);
          if (text.length > 100) break;
        }
      }
      if (text.length < 100) {
        const paragraphs = document.querySelectorAll("p");
        const paragraphTexts = Array.from(paragraphs).map((p) => this.extractReadableText(p)).filter((text2) => text2.length > 50);
        text = paragraphTexts.join(" ");
      }
      if (text.length < 100) {
        text = this.extractReadableText(document.body);
      }
      return this.cleanText(text);
    }
    // Extract text from iframes
    async extractTextFromIframes() {
      let allText = "";
      this.inspectDOMForIframes();
      let iframes = document.querySelectorAll("iframe");
      console.log(`Method 1 - querySelectorAll('iframe'): Found ${iframes.length} iframes`);
      if (iframes.length === 0) {
        iframes = document.getElementsByTagName("iframe");
        console.log(`Method 2 - getElementsByTagName('iframe'): Found ${iframes.length} iframes`);
      }
      if (iframes.length === 0) {
        const frameElements = document.querySelectorAll("frame, embed, object");
        console.log(`Method 3 - frame/embed/object elements: Found ${frameElements.length} elements`);
        iframes = frameElements;
      }
      if (iframes.length === 0) {
        const iframeLike = document.querySelectorAll('[src*="iframe"], [srcdoc], [data-iframe]');
        console.log(`Method 4 - iframe-like attributes: Found ${iframeLike.length} elements`);
        iframes = iframeLike;
      }
      if (iframes.length === 0) {
        console.log("Method 5 - Searching for iframes in Shadow DOM...");
        const shadowIframes = this.findIframesInShadow();
        console.log(`Method 5 - Shadow DOM iframes: Found ${shadowIframes.length} iframes`);
        iframes = shadowIframes;
      }
      if (iframes.length === 0) {
        console.log("No iframes found initially, waiting for dynamic iframes...");
        iframes = await this.waitForIframes(3e3);
      }
      if (iframes.length === 0) {
        try {
          if (window.self !== window.top) {
            console.log("We are inside an iframe - extracting content from current document");
            const currentContent = this.extractReadableText(document.body);
            if (currentContent && currentContent.trim().length > 0) {
              allText = currentContent;
              console.log(`Extracted ${allText.length} characters from current iframe content`);
            }
          }
        } catch (e) {
          console.log("Cross-origin iframe detected, cannot access parent");
        }
      }
      console.log(`Final iframe count: ${iframes.length}`);
      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        try {
          console.log(`Processing iframe ${i + 1}:`, iframe);
          console.log(`Iframe tagName: ${iframe.tagName}`);
          console.log(`Iframe src: ${iframe.src}`);
          console.log(`Iframe srcdoc: ${iframe.srcdoc ? "Present (" + iframe.srcdoc.length + " chars)" : "Not present"}`);
          console.log(`Iframe contentDocument: ${iframe.contentDocument ? "Available" : "Not available"}`);
          console.log(`Iframe in Shadow DOM: ${iframe.getRootNode() !== document ? "Yes" : "No"}`);
          const iframeText = this.extractIframeContent(iframe);
          if (iframeText && iframeText.trim().length > 0) {
            allText += iframeText + " ";
            console.log(`Iframe ${i + 1}: Added to total text. Total length now: ${allText.length}`);
          } else {
            console.log(`Iframe ${i + 1}: No text extracted`);
          }
        } catch (error) {
          console.log(`Iframe ${i + 1}: Error extracting text:`, error);
        }
      }
      console.log(`Total iframe text extracted: ${allText.length} characters`);
      return allText;
    }
    // Extract text from srcdoc attribute
    extractTextFromSrcdoc(srcdoc) {
      try {
        console.log("Processing srcdoc:", srcdoc.substring(0, 200) + "...");
        const decodedHtml = this.decodeHTMLEntities(srcdoc);
        console.log("Decoded HTML length:", decodedHtml.length);
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = decodedHtml;
        let extractedText = "";
        const body = tempDiv.querySelector("body");
        if (body) {
          console.log("Found body element, extracting text...");
          extractedText = this.extractReadableText(body);
          console.log("Body text length:", extractedText.length);
        }
        if (!extractedText || extractedText.length < 50) {
          const paragraphs = tempDiv.querySelectorAll("p");
          console.log("Found", paragraphs.length, "paragraphs");
          if (paragraphs.length > 0) {
            const paragraphTexts = Array.from(paragraphs).map((p) => this.extractReadableText(p)).filter((text) => text.length > 10);
            extractedText = paragraphTexts.join(" ");
            console.log("Paragraph text length:", extractedText.length);
          }
        }
        if (!extractedText || extractedText.length < 50) {
          console.log("Using fallback text extraction...");
          extractedText = this.extractReadableText(tempDiv);
          console.log("Fallback text length:", extractedText.length);
        }
        const cleanedText = this.cleanText(extractedText);
        console.log("Final cleaned text length:", cleanedText.length);
        return cleanedText;
      } catch (error) {
        console.log("Error extracting from srcdoc:", error);
        return "";
      }
    }
    // Extract text from iframe src (for same-origin iframes)
    extractTextFromIframeSrc(src) {
      try {
        return "";
      } catch (error) {
        console.log("Error extracting from iframe src:", error);
        return "";
      }
    }
    // Decode HTML entities
    decodeHTMLEntities(text) {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = text;
      return textarea.value;
    }
    // Enhanced iframe content extraction
    extractIframeContent(iframe) {
      let content = "";
      try {
        if (iframe.contentDocument && iframe.contentDocument.body) {
          content = this.extractReadableText(iframe.contentDocument.body);
          if (content && content.trim().length > 0) {
            console.log("Successfully extracted content from contentDocument");
            return content;
          }
        }
        if (iframe.srcdoc) {
          content = this.extractTextFromSrcdoc(iframe.srcdoc);
          if (content && content.trim().length > 0) {
            console.log("Successfully extracted content from srcdoc");
            return content;
          }
        }
        if (iframe.src && !iframe.srcdoc) {
          console.log("Iframe has src but no srcdoc, content might be dynamic");
          return "";
        }
      } catch (error) {
        console.log("Error in enhanced iframe extraction:", error);
      }
      return content;
    }
    // Wait for iframes to load and retry detection
    async waitForIframes(maxWaitTime = 3e3) {
      const startTime = Date.now();
      let iframes = [];
      while (Date.now() - startTime < maxWaitTime) {
        iframes = document.querySelectorAll("iframe");
        if (iframes.length > 0) {
          console.log(`Found ${iframes.length} iframes after waiting ${Date.now() - startTime}ms`);
          return iframes;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.log("No iframes found after waiting", maxWaitTime, "ms");
      return [];
    }
    // Debug function to inspect DOM structure
    inspectDOMForIframes() {
      console.log("=== DOM Inspection for Iframes ===");
      const allElements = document.querySelectorAll("*");
      console.log(`Total elements on page: ${allElements.length}`);
      const iframeElements = document.querySelectorAll("iframe");
      const frameElements = document.querySelectorAll("frame");
      const embedElements = document.querySelectorAll("embed");
      const objectElements = document.querySelectorAll("object");
      console.log(`iframe elements: ${iframeElements.length}`);
      console.log(`frame elements: ${frameElements.length}`);
      console.log(`embed elements: ${embedElements.length}`);
      console.log(`object elements: ${objectElements.length}`);
      const shadowIframes = this.findIframesInShadow();
      console.log(`Shadow DOM iframes: ${shadowIframes.length}`);
      const srcElements = document.querySelectorAll("[src]");
      const srcdocElements = document.querySelectorAll("[srcdoc]");
      console.log(`Elements with src attribute: ${srcElements.length}`);
      console.log(`Elements with srcdoc attribute: ${srcdocElements.length}`);
      if (iframeElements.length > 0) {
        iframeElements.forEach((iframe, index) => {
          console.log(`Iframe ${index + 1}:`, {
            tagName: iframe.tagName,
            src: iframe.src,
            srcdoc: iframe.srcdoc ? `Present (${iframe.srcdoc.length} chars)` : "Not present",
            contentDocument: iframe.contentDocument ? "Available" : "Not available",
            className: iframe.className,
            id: iframe.id,
            inShadowDOM: iframe.getRootNode() !== document ? "Yes" : "No"
          });
        });
      }
      if (shadowIframes.length > 0) {
        shadowIframes.forEach((iframe, index) => {
          console.log(`Shadow DOM Iframe ${index + 1}:`, {
            tagName: iframe.tagName,
            src: iframe.src,
            srcdoc: iframe.srcdoc ? `Present (${iframe.srcdoc.length} chars)` : "Not present",
            contentDocument: iframe.contentDocument ? "Available" : "Not available",
            className: iframe.className,
            id: iframe.id,
            shadowRoot: iframe.getRootNode()
          });
        });
      }
      try {
        if (window.self !== window.top) {
          console.log("We are inside an iframe!");
          console.log("Current document URL:", window.location.href);
          console.log("Parent document URL:", window.parent.location.href);
        } else {
          console.log("We are in the main document");
        }
      } catch (e) {
        console.log("Cross-origin iframe detected");
      }
      console.log("=== End DOM Inspection ===");
    }
    // Find iframes in Shadow DOM
    findIframesInShadow(root = document) {
      const iframes = [];
      const nodes = root.querySelectorAll("*");
      nodes.forEach((node) => {
        if (node.shadowRoot) {
          console.log("Found shadow root, searching inside...");
          iframes.push(...this.findIframesInShadow(node.shadowRoot));
        }
        if (node.tagName === "IFRAME") {
          console.log("Found iframe in shadow DOM:", node);
          iframes.push(node);
        }
      });
      return iframes;
    }
    // Process special formatting like dropcaps to make them readable
    processSpecialFormatting(element) {
      const dropcapSelectors = [
        ".dropcap",
        '[class*="dropcap"]',
        "span.dropcap",
        "p.dropcap span",
        "p:first-letter",
        'span[class*="dropcap"]'
      ];
      dropcapSelectors.forEach((selector) => {
        const dropcaps = element.querySelectorAll(selector);
        dropcaps.forEach((dropcap) => {
          const text = dropcap.textContent;
          if (text && text.length > 0) {
            dropcap.textContent = text + " ";
          }
        });
      });
      const paragraphs = element.querySelectorAll("p");
      paragraphs.forEach((p) => {
        const text = p.textContent;
        if (text && text.length > 0) {
          if (p.classList.contains("dropcap") || p.querySelector(".dropcap")) {
            const firstChar = text.charAt(0);
            const restOfText = text.substring(1);
            if (restOfText && !restOfText.startsWith(" ")) {
              p.textContent = firstChar + " " + restOfText;
            }
          }
        }
      });
      const specialElements = element.querySelectorAll("span, em, strong, b, i, mark");
      specialElements.forEach((el) => {
        const text = el.textContent;
        if (text && text.length > 0) {
          const parentText = el.parentElement.textContent;
          const beforeChar = parentText.charAt(parentText.indexOf(text) - 1);
          const afterChar = parentText.charAt(parentText.indexOf(text) + text.length);
          if (beforeChar && beforeChar !== " " && beforeChar !== "\n") {
            el.textContent = " " + text;
          }
          if (afterChar && afterChar !== " " && afterChar !== "\n") {
            el.textContent = text + " ";
          }
        }
      });
      const blockElements = element.querySelectorAll("p, div, br");
      blockElements.forEach((p) => {
        if (p.tagName === "BR") {
          p.textContent = "\n";
        } else if (p.textContent.trim()) {
          p.textContent = p.textContent.trim() + "\n\n";
        }
      });
    }
    // Special function to handle dropcap text extraction
    processDropcapText(htmlText) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlText;
      const dropcaps = tempDiv.querySelectorAll(".dropcap, span.dropcap");
      dropcaps.forEach((dropcap) => {
        const text = dropcap.textContent;
        if (text && text.length > 0) {
          dropcap.textContent = text + " ";
        }
      });
      return this.extractReadableText(tempDiv);
    }
    // Fallback function for complex HTML structures
    extractTextFromComplexHTML(htmlString) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlString;
      return this.extractReadableText(tempDiv);
    }
    // Clean and normalize text
    cleanText(text) {
      return text.replace(/\s+/g, " ").replace(/\n\s*\n/g, "\n").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    }
    // Split text into chunks for streaming and store for highlighting
    splitTextIntoChunks(text, maxChunkSize = 500) {
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
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
      this.textChunks = chunks;
      this.currentChunkIndex = 0;
      return chunks;
    }
    // Get selected text from the page
    getSelectedText() {
      const selection = window.getSelection();
      if (!selection.rangeCount) {
        return "";
      }
      const range = selection.getRangeAt(0);
      const tempContainer = document.createElement("div");
      tempContainer.appendChild(range.cloneContents());
      return this.extractReadableText(tempContainer);
    }
  };

  // src/audio-handler.js
  var AudioHandler = class {
    constructor() {
      this.currentAudio = null;
      this.audioContext = null;
      this.isPlaying = false;
      this.isPaused = false;
      this.audioQueue = [];
      this.isProcessingQueue = false;
    }
    // Initialize audio context
    initAudioContext() {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioContext.state === "suspended") {
        return this.audioContext.resume();
      }
      return Promise.resolve();
    }
    // Call Kokoro FastAPI to generate speech with streaming
    async generateSpeechStream(text, apiUrl, voice, speed = 1, audioFormat = "pcm") {
      try {
        const response = await fetch(`${apiUrl}/v1/audio/speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "kokoro",
            input: text,
            voice,
            response_format: audioFormat,
            download_format: audioFormat === "pcm" ? "mp3" : audioFormat,
            speed,
            stream: true,
            return_download_link: false,
            lang_code: "a",
            normalization_options: {
              normalize: true,
              unit_normalization: false,
              url_normalization: true,
              email_normalization: true,
              optional_pluralization_normalization: true,
              phone_normalization: true
            }
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `API request failed: ${response.status} ${response.statusText} - ${errorText}`
          );
        }
        const contentType = response.headers.get("content-type");
        console.log(`Response content-type: ${contentType}`);
        const arrayBuffer = await response.arrayBuffer();
        console.log(`Received audio data: ${arrayBuffer.byteLength} bytes`);
        if (arrayBuffer.byteLength === 0) {
          throw new Error("Received empty audio data from API");
        }
        const uint8Array = new Uint8Array(arrayBuffer);
        const isLikelyAudio = uint8Array.byteLength > 100;
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
    async processStreamingAudio(text, apiUrl, voice, speed = 1, isSelected = false, autoPlay = true, highlightText = true, textExtractor, highlightingHandler, audioFormat = "pcm") {
      const chunks = textExtractor.splitTextIntoChunks(text, 500);
      console.log(`Processing ${chunks.length} text chunks for streaming...`);
      this.audioQueue = [];
      this.isProcessingQueue = true;
      if (highlightText) {
        highlightingHandler.addHighlightStyles();
      }
      try {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`Generating audio for chunk ${i + 1}/${chunks.length}`);
          const audioBuffer = await this.generateSpeechStream(chunk, apiUrl, voice, speed, audioFormat);
          this.audioQueue.push(audioBuffer);
          if (i === 0 && autoPlay) {
            this.playNextInQueue(textExtractor, highlightingHandler, isSelected);
          }
          chrome.runtime.sendMessage({
            action: "updateProgress",
            progress: Math.round((i + 1) / chunks.length * 100)
          });
          chrome.runtime.sendMessage({
            action: "updateContentAnalysis",
            data: {
              chunks,
              currentChunk: i,
              totalChars: text.length
            }
          });
        }
      } catch (error) {
        this.isProcessingQueue = false;
        throw error;
      }
    }
    // Convert raw PCM data to AudioBuffer
    createAudioBufferFromPCM(pcmData, sampleRate = 22050, channels = 1) {
      const samples = pcmData.byteLength / 2;
      const audioBuffer = this.audioContext.createBuffer(channels, samples, sampleRate);
      const pcmArray = new Int16Array(pcmData);
      const floatArray = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        floatArray[i] = pcmArray[i] / 32768;
      }
      audioBuffer.copyToChannel(floatArray, 0);
      return audioBuffer;
    }
    // Play next audio chunk in queue
    async playNextInQueue(textExtractor, highlightingHandler, isReadingSelected) {
      if (this.audioQueue.length === 0) {
        this.isProcessingQueue = false;
        this.isPlaying = false;
        this.currentAudio = null;
        chrome.runtime.sendMessage({ action: "playbackFinished" });
        return;
      }
      const audioBuffer = this.audioQueue.shift();
      try {
        await this.initAudioContext();
        console.log(`Processing PCM audio buffer: ${audioBuffer.byteLength} bytes`);
        let audioData;
        try {
          audioData = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
          console.log("Successfully decoded as encoded audio");
        } catch (decodeError) {
          console.log("Encoded audio decode failed, trying raw PCM...");
          try {
            audioData = this.createAudioBufferFromPCM(audioBuffer);
            console.log(`Successfully created AudioBuffer from PCM: ${audioData.duration.toFixed(2)}s`);
          } catch (pcmError) {
            console.error("PCM processing error:", pcmError);
            if (this.audioQueue.length > 0) {
              console.log("Skipping corrupted chunk, trying next one...");
              setTimeout(() => this.playNextInQueue(textExtractor, highlightingHandler, isReadingSelected), 100);
              return;
            } else {
              throw new Error(`Audio processing failed: ${pcmError.message}`);
            }
          }
        }
        const source = this.audioContext.createBufferSource();
        source.buffer = audioData;
        source.connect(this.audioContext.destination);
        this.currentAudio = source;
        this.isPlaying = true;
        this.isPaused = false;
        console.log(`Playing audio chunk: ${audioData.duration.toFixed(2)}s`);
        source.onended = () => {
          if (this.audioQueue.length > 0) {
            textExtractor.currentChunkIndex++;
            if (textExtractor.currentChunkIndex < textExtractor.textChunks.length) {
              const shouldHighlight = true;
              if (shouldHighlight) {
                highlightingHandler.highlightText(textExtractor.textChunks[textExtractor.currentChunkIndex], isReadingSelected);
              }
            }
            setTimeout(() => this.playNextInQueue(textExtractor, highlightingHandler, isReadingSelected), 50);
          } else {
            this.isPlaying = false;
            this.currentAudio = null;
            this.isProcessingQueue = false;
            highlightingHandler.clearHighlights();
            chrome.runtime.sendMessage({ action: "playbackFinished" });
          }
        };
        if (textExtractor.currentChunkIndex < textExtractor.textChunks.length) {
          const shouldHighlight = true;
          if (shouldHighlight) {
            highlightingHandler.highlightText(textExtractor.textChunks[textExtractor.currentChunkIndex], isReadingSelected);
          }
        }
        source.start(0);
      } catch (error) {
        console.error("Audio playback error:", error);
        this.isProcessingQueue = false;
        chrome.runtime.sendMessage({
          action: "playbackError",
          error: `Audio playback failed: ${error.message}`
        });
        throw error;
      }
    }
    // Stop current playback
    stopPlayback(textExtractor, highlightingHandler) {
      if (this.currentAudio) {
        try {
          this.currentAudio.stop();
        } catch (e) {
        }
        this.currentAudio = null;
      }
      this.audioQueue = [];
      this.isProcessingQueue = false;
      this.isPlaying = false;
      this.isPaused = false;
      highlightingHandler.clearHighlights();
      textExtractor.currentChunkIndex = 0;
      textExtractor.textChunks = [];
    }
    // Pause/resume playback
    pauseResumePlayback() {
      if (this.audioContext) {
        if (this.isPaused) {
          this.audioContext.resume();
          this.isPaused = false;
        } else {
          this.audioContext.suspend();
          this.isPaused = true;
        }
      }
    }
  };

  // src/highlighting.js
  var HighlightingHandler = class {
    constructor() {
      this.highlightedElements = [];
      this.isReadingSelected = false;
      this.selectedRange = null;
    }
    // Highlight text in the page
    highlightText(text, isSelected = false) {
      this.clearHighlights();
      if (isSelected && this.selectedRange) {
        this.highlightSelectedText(text);
      } else {
        this.highlightPageText(text);
      }
      const progress = document.createElement("div");
      progress.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #4CAF50 ${window.textExtractor?.currentChunkIndex / window.textExtractor?.textChunks.length * 100}%, #e0e0e0 ${window.textExtractor?.currentChunkIndex / window.textExtractor?.textChunks.length * 100}%);
      width: 100%;
      z-index: 10001;
    `;
      progress.id = "kokoro-tts-progress";
      document.body.appendChild(progress);
    }
    // Highlight selected text
    highlightSelectedText(text) {
      try {
        if (this.selectedRange) {
          const span = document.createElement("span");
          span.className = "kokoro-tts-highlight";
          span.style.cssText = `
          background: linear-gradient(120deg, #a8e6cf 0%, #dcedc8 100%) !important;
          padding: 2px 4px !important;
          border-radius: 3px !important;
          animation: kokoro-pulse 1.5s ease-in-out infinite alternate !important;
          box-shadow: 0 0 10px rgba(168, 230, 207, 0.6) !important;
        `;
          try {
            this.selectedRange.surroundContents(span);
            this.highlightedElements.push(span);
          } catch (e) {
            const contents = this.selectedRange.extractContents();
            span.appendChild(contents);
            this.selectedRange.insertNode(span);
            this.highlightedElements.push(span);
          }
        }
      } catch (error) {
        console.log("Could not highlight selected text:", error);
      }
    }
    // Highlight text in page content
    highlightPageText(text) {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node2) {
            const parent = node2.parentElement;
            if (!parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.classList.contains("kokoro-tts-highlight") || parent.closest("#kokoro-tts-indicator")) {
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
      const searchText = text.substring(0, 100).toLowerCase();
      for (const textNode of textNodes) {
        const nodeText = textNode.textContent.toLowerCase();
        const index = nodeText.indexOf(searchText);
        if (index !== -1) {
          try {
            const range = document.createRange();
            range.setStart(textNode, index);
            range.setEnd(textNode, Math.min(index + text.length, textNode.textContent.length));
            const span = document.createElement("span");
            span.className = "kokoro-tts-highlight";
            span.style.cssText = `
            background: linear-gradient(120deg, #a8e6cf 0%, #dcedc8 100%) !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            animation: kokoro-pulse 1.5s ease-in-out infinite alternate !important;
            box-shadow: 0 0 10px rgba(168, 230, 207, 0.6) !important;
          `;
            range.surroundContents(span);
            this.highlightedElements.push(span);
            span.scrollIntoView({ behavior: "smooth", block: "center" });
            break;
          } catch (e) {
            console.log("Could not highlight text:", e);
          }
        }
      }
    }
    // Clear all highlights
    clearHighlights() {
      this.highlightedElements.forEach((element) => {
        if (element && element.parentNode) {
          const parent = element.parentNode;
          parent.insertBefore(document.createTextNode(element.textContent), element);
          parent.removeChild(element);
          parent.normalize();
        }
      });
      this.highlightedElements = [];
      const progress = document.getElementById("kokoro-tts-progress");
      if (progress) {
        progress.remove();
      }
    }
    // Add highlight styles to page
    addHighlightStyles() {
      if (document.getElementById("kokoro-highlight-styles")) return;
      const style = document.createElement("style");
      style.id = "kokoro-highlight-styles";
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
    // Set selected range for highlighting
    setSelectedRange(range) {
      this.selectedRange = range;
    }
    // Get selected range
    getSelectedRange() {
      return this.selectedRange;
    }
    // Set reading selected state
    setReadingSelected(isSelected) {
      this.isReadingSelected = isSelected;
    }
    // Get reading selected state
    getReadingSelected() {
      return this.isReadingSelected;
    }
  };

  // src/ui-controller.js
  var UIController = class {
    constructor() {
      this.keyboardHandler = null;
    }
    // Add visual indicator
    addVisualIndicator(audioHandler) {
      if (document.getElementById("kokoro-tts-indicator")) return;
      const indicator = document.createElement("div");
      indicator.id = "kokoro-tts-indicator";
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
      const prevButton = document.createElement("button");
      prevButton.innerHTML = "\u23EE\uFE0F";
      prevButton.title = "Previous chunk (Alt + Left)";
      prevButton.onclick = () => this.navigateChunk(-1, audioHandler);
      const playPauseButton = document.createElement("button");
      playPauseButton.innerHTML = audioHandler.isPaused ? "\u25B6\uFE0F" : "\u23F8\uFE0F";
      playPauseButton.title = "Play/Pause (Space)";
      playPauseButton.onclick = () => audioHandler.pauseResumePlayback();
      const nextButton = document.createElement("button");
      nextButton.innerHTML = "\u23ED\uFE0F";
      nextButton.title = "Next chunk (Alt + Right)";
      nextButton.onclick = () => this.navigateChunk(1, audioHandler);
      indicator.appendChild(prevButton);
      indicator.appendChild(playPauseButton);
      indicator.appendChild(nextButton);
      document.body.appendChild(indicator);
      this.setupKeyboardShortcuts(audioHandler);
    }
    setupKeyboardShortcuts(audioHandler) {
      if (this.keyboardHandler) {
        document.removeEventListener("keydown", this.keyboardHandler);
      }
      this.keyboardHandler = (event) => {
        if (event.altKey) {
          if (event.key === "ArrowLeft") {
            this.navigateChunk(-1, audioHandler);
          } else if (event.key === "ArrowRight") {
            this.navigateChunk(1, audioHandler);
          }
        } else if (event.code === "Space" && !event.target.matches("input, textarea")) {
          event.preventDefault();
          audioHandler.pauseResumePlayback();
        }
      };
      document.addEventListener("keydown", this.keyboardHandler);
    }
    navigateChunk(direction, audioHandler) {
      if (!window.textExtractor?.textChunks.length) return;
      audioHandler.stopPlayback(window.textExtractor, window.highlightingHandler);
      window.textExtractor.currentChunkIndex = Math.max(0, Math.min(window.textExtractor.textChunks.length - 1, window.textExtractor.currentChunkIndex + direction));
      const text = window.textExtractor.textChunks[window.textExtractor.currentChunkIndex];
      window.highlightingHandler.highlightText(text, window.highlightingHandler.getReadingSelected());
      audioHandler.processStreamingAudio(text, "http://localhost:5000/tts", "default", 1, window.highlightingHandler.getReadingSelected(), true, true, window.textExtractor, window.highlightingHandler);
    }
    removeVisualIndicator() {
      const existing = document.getElementById("kokoro-tts-indicator");
      if (existing) {
        existing.remove();
      }
      if (this.keyboardHandler) {
        document.removeEventListener("keydown", this.keyboardHandler);
        this.keyboardHandler = null;
      }
    }
    // Update UI based on playback state
    updatePlaybackUI(audioHandler) {
      const playPauseButton = document.querySelector("#kokoro-tts-indicator button:nth-child(2)");
      if (playPauseButton) {
        playPauseButton.innerHTML = audioHandler.isPaused ? "\u25B6\uFE0F" : "\u23F8\uFE0F";
      }
    }
    // Show error message
    showError(message) {
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10002;
      max-width: 300px;
      font-family: Arial, sans-serif;
    `;
      errorDiv.textContent = message;
      errorDiv.id = "kokoro-tts-error";
      document.body.appendChild(errorDiv);
      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.remove();
        }
      }, 5e3);
    }
    // Show success message
    showSuccess(message) {
      const successDiv = document.createElement("div");
      successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10002;
      max-width: 300px;
      font-family: Arial, sans-serif;
    `;
      successDiv.textContent = message;
      successDiv.id = "kokoro-tts-success";
      document.body.appendChild(successDiv);
      setTimeout(() => {
        if (successDiv.parentNode) {
          successDiv.remove();
        }
      }, 3e3);
    }
    // Show loading indicator
    showLoading() {
      const loadingDiv = document.createElement("div");
      loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10003;
      font-family: Arial, sans-serif;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
      loadingDiv.innerHTML = `
      <div style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>Processing audio...</span>
    `;
      loadingDiv.id = "kokoro-tts-loading";
      const style = document.createElement("style");
      style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
      document.head.appendChild(style);
      document.body.appendChild(loadingDiv);
    }
    // Hide loading indicator
    hideLoading() {
      const loadingDiv = document.getElementById("kokoro-tts-loading");
      if (loadingDiv) {
        loadingDiv.remove();
      }
    }
  };

  // src/main.js
  (function() {
    const textExtractor = new TextExtractor();
    const audioHandler = new AudioHandler();
    const highlightingHandler = new HighlightingHandler();
    const uiController = new UIController();
    window.textExtractor = textExtractor;
    window.audioHandler = audioHandler;
    window.highlightingHandler = highlightingHandler;
    window.uiController = uiController;
    chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        (async function() {
          try {
            console.log("Received request:", request);
            switch (request.action) {
              case "readSelected":
                audioHandler.stopPlayback(textExtractor, highlightingHandler);
                const selectedText = textExtractor.getSelectedText();
                if (!selectedText || selectedText.length < 5) {
                  sendResponse({
                    success: false,
                    message: "No text selected or text too short. Please select some text first."
                  });
                  return;
                }
                console.log(`Reading selected text: "${selectedText.substring(0, 100)}..."`);
                sendResponse({
                  success: true,
                  message: `Reading selected text (${selectedText.length} characters)...`
                });
                try {
                  const selection = window.getSelection();
                  if (selection.rangeCount > 0) {
                    highlightingHandler.setSelectedRange(selection.getRangeAt(0).cloneRange());
                    highlightingHandler.setReadingSelected(true);
                  }
                  uiController.addVisualIndicator(audioHandler);
                  await audioHandler.processStreamingAudio(
                    selectedText,
                    request.apiUrl,
                    request.voice,
                    request.speed || 1,
                    true,
                    // isSelected
                    true,
                    // autoPlay
                    request.highlightText || true,
                    textExtractor,
                    highlightingHandler,
                    request.audioFormat || "pcm"
                  );
                } catch (error) {
                  uiController.removeVisualIndicator();
                  uiController.showError(error.message);
                  chrome.runtime.sendMessage({
                    action: "playbackError",
                    error: error.message
                  });
                }
                break;
              case "read":
                audioHandler.stopPlayback(textExtractor, highlightingHandler);
                let text = "";
                if (request.includeSelected && textExtractor.getSelectedText().length > 5) {
                  text = textExtractor.getSelectedText();
                  highlightingHandler.setReadingSelected(true);
                } else {
                  text = await textExtractor.extractArticleText(request.includeIframes);
                  highlightingHandler.setReadingSelected(false);
                }
                if (!text || text.length < 10) {
                  sendResponse({
                    success: false,
                    message: "No readable content found on this page"
                  });
                  return;
                }
                console.log(`Reading page content: ${text.length} characters`);
                const chunkSize = request.chunkSize || 500;
                const chunks = textExtractor.splitTextIntoChunks(text, chunkSize);
                sendResponse({
                  success: true,
                  message: `Found ${text.length} characters in ${chunks.length} chunks. Starting streaming playback...`,
                  contentAnalysis: {
                    chunks,
                    currentChunk: 0,
                    totalChars: text.length
                  }
                });
                try {
                  uiController.addVisualIndicator(audioHandler);
                  await audioHandler.processStreamingAudio(
                    text,
                    request.apiUrl,
                    request.voice,
                    request.speed || 1,
                    highlightingHandler.getReadingSelected(),
                    request.autoPlay,
                    request.highlightText,
                    textExtractor,
                    highlightingHandler,
                    request.audioFormat || "pcm"
                  );
                } catch (error) {
                  uiController.removeVisualIndicator();
                  uiController.showError(error.message);
                  chrome.runtime.sendMessage({
                    action: "playbackError",
                    error: error.message
                  });
                }
                break;
              case "analyze":
                const analysisText = await textExtractor.extractArticleText();
                const analysisChunks = textExtractor.splitTextIntoChunks(analysisText, request.chunkSize || 500);
                sendResponse({
                  success: true,
                  message: `Content analyzed: ${analysisText.length} characters in ${analysisChunks.length} chunks`,
                  contentAnalysis: {
                    chunks: analysisChunks,
                    currentChunk: 0,
                    totalChars: analysisText.length
                  }
                });
                break;
              case "extract":
                const extractedText = await textExtractor.extractArticleText();
                const extractedChunks = textExtractor.splitTextIntoChunks(extractedText, request.chunkSize || 500);
                chrome.runtime.sendMessage({
                  action: "contentExtracted",
                  charCount: extractedText.length,
                  analysis: {
                    chunks: extractedChunks,
                    currentChunk: 0,
                    totalChars: extractedText.length
                  }
                });
                sendResponse({
                  success: true,
                  message: `Extracted ${extractedText.length} characters`,
                  contentAnalysis: {
                    chunks: extractedChunks,
                    currentChunk: 0,
                    totalChars: extractedText.length
                  }
                });
                break;
              case "navigate":
                uiController.navigateChunk(request.direction, audioHandler);
                sendResponse({
                  success: true,
                  message: `Navigated to chunk ${textExtractor.currentChunkIndex + 1}`,
                  contentAnalysis: {
                    chunks: textExtractor.textChunks,
                    currentChunk: textExtractor.currentChunkIndex,
                    totalChars: textExtractor.textChunks.reduce((sum, chunk) => sum + chunk.length, 0)
                  }
                });
                break;
              case "pause":
                audioHandler.pauseResumePlayback();
                uiController.updatePlaybackUI(audioHandler);
                sendResponse({
                  success: true,
                  message: audioHandler.isPaused ? "Paused" : "Resumed"
                });
                break;
              case "stop":
                audioHandler.stopPlayback(textExtractor, highlightingHandler);
                uiController.removeVisualIndicator();
                sendResponse({ success: true, message: "Stopped" });
                break;
              default:
                sendResponse({ success: false, message: "Unknown action" });
            }
          } catch (error) {
            console.error("Content script error:", error);
            uiController.showError(error.message);
            sendResponse({ success: false, message: error.message });
          }
        })();
        return true;
      }
    );
    window.addEventListener("beforeunload", function() {
      audioHandler.stopPlayback(textExtractor, highlightingHandler);
      uiController.removeVisualIndicator();
    });
    console.log("Kokoro TTS content script loaded with modular architecture");
  })();
})();
