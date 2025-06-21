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

  // Extract readable text from HTML content with better formatting handling
  function extractReadableText(element) {
    const clonedElement = element.cloneNode(true);

    // Remove unwanted elements
    const elementsToRemove = clonedElement.querySelectorAll(
      "script, style, nav, header, footer, aside, .nav, .navigation, .sidebar, .ads, .advertisement",
    );
    elementsToRemove.forEach((el) => el.remove());

    // Process special formatting
    processSpecialFormatting(clonedElement);

    // Extract text while preserving logical flow
    let text = "";
    const walker = document.createTreeWalker(
      clonedElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent || 
              parent.tagName === 'SCRIPT' || 
              parent.tagName === 'STYLE' ||
              parent.style.display === 'none' ||
              parent.style.visibility === 'hidden') {
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

    return cleanText(text);
  }

  // Extract article content from the page
  async function extractArticleText(includeIframes = true) {
    let text = "";

    // First, try to extract text from iframes if enabled
    if (includeIframes) {
      text = await extractTextFromIframes();
      if (text.length > 100) {
        return cleanText(text);
      }
    }

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
        text = extractReadableText(element);
        if (text.length > 100) break; // Found substantial content
      }
    }

    // Fallback: try to find paragraphs
    if (text.length < 100) {
      const paragraphs = document.querySelectorAll("p");
      const paragraphTexts = Array.from(paragraphs)
        .map((p) => extractReadableText(p))
        .filter((text) => text.length > 50); // Filter out short paragraphs

      text = paragraphTexts.join(" ");
    }

    // Final fallback: get readable text from body
    if (text.length < 100) {
      text = extractReadableText(document.body);
    }

    return cleanText(text);
  }

  // Extract text from iframes
  async function extractTextFromIframes() {
    let allText = "";
    
    // Run DOM inspection for debugging
    inspectDOMForIframes();
    
    // Try multiple iframe detection methods
    let iframes = document.querySelectorAll('iframe');
    console.log(`Method 1 - querySelectorAll('iframe'): Found ${iframes.length} iframes`);
    
    // Method 2: Look for iframes in different ways
    if (iframes.length === 0) {
      iframes = document.getElementsByTagName('iframe');
      console.log(`Method 2 - getElementsByTagName('iframe'): Found ${iframes.length} iframes`);
    }
    
    // Method 3: Look for iframe-like elements
    if (iframes.length === 0) {
      const frameElements = document.querySelectorAll('frame, embed, object');
      console.log(`Method 3 - frame/embed/object elements: Found ${frameElements.length} elements`);
      iframes = frameElements;
    }
    
    // Method 4: Look for elements with iframe-like attributes
    if (iframes.length === 0) {
      const iframeLike = document.querySelectorAll('[src*="iframe"], [srcdoc], [data-iframe]');
      console.log(`Method 4 - iframe-like attributes: Found ${iframeLike.length} elements`);
      iframes = iframeLike;
    }
    
    // Method 5: Search for iframes in Shadow DOM
    if (iframes.length === 0) {
      console.log('Method 5 - Searching for iframes in Shadow DOM...');
      const shadowIframes = findIframesInShadow();
      console.log(`Method 5 - Shadow DOM iframes: Found ${shadowIframes.length} iframes`);
      iframes = shadowIframes;
    }
    
    // Method 6: Wait for dynamically created iframes
    if (iframes.length === 0) {
      console.log('No iframes found initially, waiting for dynamic iframes...');
      iframes = await waitForIframes(3000);
    }
    
    // Method 7: Check if we're inside an iframe ourselves
    if (iframes.length === 0) {
      try {
        if (window.self !== window.top) {
          console.log('We are inside an iframe - extracting content from current document');
          const currentContent = extractReadableText(document.body);
          if (currentContent && currentContent.trim().length > 0) {
            allText = currentContent;
            console.log(`Extracted ${allText.length} characters from current iframe content`);
          }
        }
      } catch (e) {
        console.log('Cross-origin iframe detected, cannot access parent');
      }
    }
    
    console.log(`Final iframe count: ${iframes.length}`);
    
    for (let i = 0; i < iframes.length; i++) {
      const iframe = iframes[i];
      try {
        console.log(`Processing iframe ${i + 1}:`, iframe);
        console.log(`Iframe tagName: ${iframe.tagName}`);
        console.log(`Iframe src: ${iframe.src}`);
        console.log(`Iframe srcdoc: ${iframe.srcdoc ? 'Present (' + iframe.srcdoc.length + ' chars)' : 'Not present'}`);
        console.log(`Iframe contentDocument: ${iframe.contentDocument ? 'Available' : 'Not available'}`);
        console.log(`Iframe in Shadow DOM: ${iframe.getRootNode() !== document ? 'Yes' : 'No'}`);
        
        // Use enhanced iframe content extraction
        const iframeText = extractIframeContent(iframe);
        
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
  function extractTextFromSrcdoc(srcdoc) {
    try {
      console.log('Processing srcdoc:', srcdoc.substring(0, 200) + '...');
      
      // Decode HTML entities
      const decodedHtml = decodeHTMLEntities(srcdoc);
      console.log('Decoded HTML length:', decodedHtml.length);
      
      // Create a temporary element to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = decodedHtml;
      
      // Look for specific content patterns in the iframe
      let extractedText = "";
      
      // Method 1: Try to find body content
      const body = tempDiv.querySelector('body');
      if (body) {
        console.log('Found body element, extracting text...');
        extractedText = extractReadableText(body);
        console.log('Body text length:', extractedText.length);
      }
      
      // Method 2: If no body, look for paragraphs directly
      if (!extractedText || extractedText.length < 50) {
        const paragraphs = tempDiv.querySelectorAll('p');
        console.log('Found', paragraphs.length, 'paragraphs');
        if (paragraphs.length > 0) {
          const paragraphTexts = Array.from(paragraphs)
            .map(p => extractReadableText(p))
            .filter(text => text.length > 10);
          extractedText = paragraphTexts.join(" ");
          console.log('Paragraph text length:', extractedText.length);
        }
      }
      
      // Method 3: Extract all text content as fallback
      if (!extractedText || extractedText.length < 50) {
        console.log('Using fallback text extraction...');
        extractedText = extractReadableText(tempDiv);
        console.log('Fallback text length:', extractedText.length);
      }
      
      // Clean up the extracted text
      const cleanedText = cleanText(extractedText);
      console.log('Final cleaned text length:', cleanedText.length);
      
      return cleanedText;
    } catch (error) {
      console.log('Error extracting from srcdoc:', error);
      return "";
    }
  }

  // Extract text from iframe src (for same-origin iframes)
  function extractTextFromIframeSrc(src) {
    try {
      // This would require additional permissions and handling
      // For now, we'll return empty string as this is complex
      return "";
    } catch (error) {
      console.log('Error extracting from iframe src:', error);
      return "";
    }
  }

  // Decode HTML entities
  function decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  // Enhanced iframe content extraction
  function extractIframeContent(iframe) {
    let content = "";
    
    try {
      // Try multiple methods to extract content
      
      // Method 1: Direct contentDocument access
      if (iframe.contentDocument && iframe.contentDocument.body) {
        content = extractReadableText(iframe.contentDocument.body);
        if (content && content.trim().length > 0) {
          console.log('Successfully extracted content from contentDocument');
          return content;
        }
      }
      
      // Method 2: srcdoc attribute
      if (iframe.srcdoc) {
        content = extractTextFromSrcdoc(iframe.srcdoc);
        if (content && content.trim().length > 0) {
          console.log('Successfully extracted content from srcdoc');
          return content;
        }
      }
      
      // Method 3: Try to access iframe content after a delay (for dynamic content)
      if (iframe.src && !iframe.srcdoc) {
        // For iframes with src, we might need to wait for content to load
        console.log('Iframe has src but no srcdoc, content might be dynamic');
        return "";
      }
      
    } catch (error) {
      console.log('Error in enhanced iframe extraction:', error);
    }
    
    return content;
  }

  // Wait for iframes to load and retry detection
  async function waitForIframes(maxWaitTime = 3000) {
    const startTime = Date.now();
    let iframes = [];
    
    while (Date.now() - startTime < maxWaitTime) {
      iframes = document.querySelectorAll('iframe');
      if (iframes.length > 0) {
        console.log(`Found ${iframes.length} iframes after waiting ${Date.now() - startTime}ms`);
        return iframes;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('No iframes found after waiting', maxWaitTime, 'ms');
    return [];
  }

  // Debug function to inspect DOM structure
  function inspectDOMForIframes() {
    console.log('=== DOM Inspection for Iframes ===');
    
    // Check all elements that might contain iframes
    const allElements = document.querySelectorAll('*');
    console.log(`Total elements on page: ${allElements.length}`);
    
    // Look for iframe-related elements
    const iframeElements = document.querySelectorAll('iframe');
    const frameElements = document.querySelectorAll('frame');
    const embedElements = document.querySelectorAll('embed');
    const objectElements = document.querySelectorAll('object');
    
    console.log(`iframe elements: ${iframeElements.length}`);
    console.log(`frame elements: ${frameElements.length}`);
    console.log(`embed elements: ${embedElements.length}`);
    console.log(`object elements: ${objectElements.length}`);
    
    // Check for Shadow DOM iframes
    const shadowIframes = findIframesInShadow();
    console.log(`Shadow DOM iframes: ${shadowIframes.length}`);
    
    // Check for elements with iframe-like attributes
    const srcElements = document.querySelectorAll('[src]');
    const srcdocElements = document.querySelectorAll('[srcdoc]');
    
    console.log(`Elements with src attribute: ${srcElements.length}`);
    console.log(`Elements with srcdoc attribute: ${srcdocElements.length}`);
    
    // Log details of iframe-like elements
    if (iframeElements.length > 0) {
      iframeElements.forEach((iframe, index) => {
        console.log(`Iframe ${index + 1}:`, {
          tagName: iframe.tagName,
          src: iframe.src,
          srcdoc: iframe.srcdoc ? `Present (${iframe.srcdoc.length} chars)` : 'Not present',
          contentDocument: iframe.contentDocument ? 'Available' : 'Not available',
          className: iframe.className,
          id: iframe.id,
          inShadowDOM: iframe.getRootNode() !== document ? 'Yes' : 'No'
        });
      });
    }
    
    // Log details of Shadow DOM iframes
    if (shadowIframes.length > 0) {
      shadowIframes.forEach((iframe, index) => {
        console.log(`Shadow DOM Iframe ${index + 1}:`, {
          tagName: iframe.tagName,
          src: iframe.src,
          srcdoc: iframe.srcdoc ? `Present (${iframe.srcdoc.length} chars)` : 'Not present',
          contentDocument: iframe.contentDocument ? 'Available' : 'Not available',
          className: iframe.className,
          id: iframe.id,
          shadowRoot: iframe.getRootNode()
        });
      });
    }
    
    // Check if we're inside an iframe
    try {
      if (window.self !== window.top) {
        console.log('We are inside an iframe!');
        console.log('Current document URL:', window.location.href);
        console.log('Parent document URL:', window.parent.location.href);
      } else {
        console.log('We are in the main document');
      }
    } catch (e) {
      console.log('Cross-origin iframe detected');
    }
    
    console.log('=== End DOM Inspection ===');
  }

  // Find iframes in Shadow DOM
  function findIframesInShadow(root = document) {
    const iframes = [];
    const nodes = root.querySelectorAll('*');

    nodes.forEach(node => {
      if (node.shadowRoot) {
        console.log('Found shadow root, searching inside...');
        iframes.push(...findIframesInShadow(node.shadowRoot));
      }
      if (node.tagName === 'IFRAME') {
        console.log('Found iframe in shadow DOM:', node);
        iframes.push(node);
      }
    });

    return iframes;
  }

  // Process special formatting like dropcaps to make them readable
  function processSpecialFormatting(element) {
    // Handle dropcaps - convert them to readable text
    // Look for various dropcap implementations
    const dropcapSelectors = [
      '.dropcap',
      '[class*="dropcap"]',
      'span.dropcap',
      'p.dropcap span',
      'p:first-letter',
      'span[class*="dropcap"]'
    ];
    
    dropcapSelectors.forEach(selector => {
      const dropcaps = element.querySelectorAll(selector);
      dropcaps.forEach(dropcap => {
        // Add a space after the dropcap letter to ensure proper word separation
        const text = dropcap.textContent;
        if (text && text.length > 0) {
          dropcap.textContent = text + ' ';
        }
      });
    });

    // Handle first-letter pseudo-elements by processing the first character of paragraphs
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(p => {
      const text = p.textContent;
      if (text && text.length > 0) {
        // Check if this paragraph has a dropcap class
        if (p.classList.contains('dropcap') || p.querySelector('.dropcap')) {
          // Ensure proper spacing after the first character
          const firstChar = text.charAt(0);
          const restOfText = text.substring(1);
          if (restOfText && !restOfText.startsWith(' ')) {
            p.textContent = firstChar + ' ' + restOfText;
          }
        }
      }
    });

    // Handle other special formatting that might affect readability
    const specialElements = element.querySelectorAll('span, em, strong, b, i, mark');
    specialElements.forEach(el => {
      // Ensure proper spacing around styled elements
      const text = el.textContent;
      if (text && text.length > 0) {
        // Add spaces if the element is not already properly spaced
        const parentText = el.parentElement.textContent;
        const beforeChar = parentText.charAt(parentText.indexOf(text) - 1);
        const afterChar = parentText.charAt(parentText.indexOf(text) + text.length);
        
        if (beforeChar && beforeChar !== ' ' && beforeChar !== '\n') {
          el.textContent = ' ' + text;
        }
        if (afterChar && afterChar !== ' ' && afterChar !== '\n') {
          el.textContent = text + ' ';
        }
      }
    });

    // Handle line breaks and paragraph breaks
    const blockElements = element.querySelectorAll('p, div, br');
    blockElements.forEach(p => {
      if (p.tagName === 'BR') {
        p.textContent = '\n';
      } else if (p.textContent.trim()) {
        // Add double line break for paragraphs
        p.textContent = p.textContent.trim() + '\n\n';
      }
    });
  }

  // Special function to handle dropcap text extraction
  function processDropcapText(htmlText) {
    // Create a temporary element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlText;
    
    // Process dropcaps specifically
    const dropcaps = tempDiv.querySelectorAll('.dropcap, span.dropcap');
    dropcaps.forEach(dropcap => {
      const text = dropcap.textContent;
      if (text && text.length > 0) {
        // Replace the dropcap with the letter plus a space
        dropcap.textContent = text + ' ';
      }
    });
    
    // Extract clean text
    return extractReadableText(tempDiv);
  }

  // Fallback function for complex HTML structures
  function extractTextFromComplexHTML(htmlString) {
    // Create a temporary element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    // Process the element with our improved extraction
    return extractReadableText(tempDiv);
  }

  // Clean and normalize text
  function cleanText(text) {
    return text
      .replace(/\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, "\n") // Remove excessive line breaks
      .replace(/\n/g, " ") // Convert remaining line breaks to spaces
      .replace(/\s+/g, " ") // Clean up any remaining multiple spaces
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
  async function processStreamingAudio(text, apiUrl, voice, speed = 1, isSelected = false, autoPlay = true, highlightText = true) {
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
    
    // Add highlight styles only if highlighting is enabled
    if (highlightText) {
      addHighlightStyles();
    }

    try {
      // Generate audio for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Generating audio for chunk ${i + 1}/${chunks.length}`);

        const audioBuffer = await generateSpeechStream(chunk, apiUrl, voice, speed);
        audioQueue.push(audioBuffer);

        // Start playing the first chunk immediately if auto-play is enabled
        if (i === 0 && autoPlay) {
          playNextInQueue();
        }

        // Update progress
        chrome.runtime.sendMessage({
          action: "updateProgress",
          progress: Math.round(((i + 1) / chunks.length) * 100),
        });

        // Update content analysis
        chrome.runtime.sendMessage({
          action: "updateContentAnalysis",
          data: {
            chunks: chunks,
            currentChunk: i,
            totalChars: text.length
          }
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
          // Move to next chunk and highlight it if highlighting is enabled
          currentChunkIndex++;
          if (currentChunkIndex < textChunks.length) {
            // Check if highlighting is enabled (we'll need to store this setting)
            const shouldHighlight = true; // This should come from settings
            if (shouldHighlight) {
              highlightText(textChunks[currentChunkIndex], isReadingSelected);
            }
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

      // Highlight current chunk when playback starts if highlighting is enabled
      if (currentChunkIndex < textChunks.length) {
        // Check if highlighting is enabled (we'll need to store this setting)
        const shouldHighlight = true; // This should come from settings
        if (shouldHighlight) {
          highlightText(textChunks[currentChunkIndex], isReadingSelected);
        }
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
    
    if (!selection.rangeCount) {
      return "";
    }

    // Get the selected range
    const range = selection.getRangeAt(0);
    
    // Create a temporary container to process the selected HTML
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(range.cloneContents());
    
    // Use our improved text extraction for the selected content
    return extractReadableText(tempContainer);
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

              // Extract text from page based on settings
              let text = "";
              if (request.includeSelected && getSelectedText().length > 5) {
                text = getSelectedText();
              } else {
                text = await extractArticleText(request.includeIframes);
              }

              if (!text || text.length < 10) {
                sendResponse({
                  success: false,
                  message: "No readable content found on this page",
                });
                return;
              }

              console.log(`Reading page content: ${text.length} characters`);

              // Split text into chunks based on user settings
              const chunkSize = request.chunkSize || 500;
              const chunks = splitTextIntoChunks(text, chunkSize);

              sendResponse({
                success: true,
                message: `Found ${text.length} characters in ${chunks.length} chunks. Starting streaming playback...`,
                contentAnalysis: {
                  chunks: chunks,
                  currentChunk: 0,
                  totalChars: text.length
                }
              });

              try {
                // Show visual indicator
                addVisualIndicator();

                // Process streaming audio for page content
                await processStreamingAudio(
                  text,
                  request.apiUrl,
                  request.voice,
                  request.speed || 1,
                  false,
                  request.autoPlay,
                  request.highlightText
                );

              } catch (error) {
                removeVisualIndicator();
                chrome.runtime.sendMessage({
                  action: "playbackError",
                  error: error.message,
                });
              }
              break;

            case "analyze":
              // Analyze content without starting playback
              const analysisText = await extractArticleText();
              const analysisChunks = splitTextIntoChunks(analysisText, request.chunkSize || 500);
              
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
              // Extract and return text content
              const extractedText = await extractArticleText();
              const extractedChunks = splitTextIntoChunks(extractedText, request.chunkSize || 500);
              
              // Send content analysis update
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
              // Navigate between chunks
              navigateChunk(request.direction);
              sendResponse({
                success: true,
                message: `Navigated to chunk ${currentChunkIndex + 1}`,
                contentAnalysis: {
                  chunks: textChunks,
                  currentChunk: currentChunkIndex,
                  totalChars: textChunks.reduce((sum, chunk) => sum + chunk.length, 0)
                }
              });
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
