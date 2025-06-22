// Text Extraction Module
export class TextExtractor {
  constructor() {
    this.textChunks = [];
    this.currentChunkIndex = 0;
  }

  // Extract readable text from HTML content with better formatting handling
  extractReadableText(element) {
    const clonedElement = element.cloneNode(true);

    // Remove unwanted elements
    const elementsToRemove = clonedElement.querySelectorAll(
      "script, style, nav, header, footer, aside, .nav, .navigation, .sidebar, .ads, .advertisement",
    );
    elementsToRemove.forEach((el) => el.remove());

    // Process special formatting
    this.processSpecialFormatting(clonedElement);

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

    return this.cleanText(text);
  }

  // Extract article content from the page
  async extractArticleText(includeIframes = true) {
    let text = "";

    // First, try to extract text from iframes if enabled
    if (includeIframes) {
      text = await this.extractTextFromIframes();
      if (text.length > 100) {
        return this.cleanText(text);
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
        text = this.extractReadableText(element);
        if (text.length > 100) break; // Found substantial content
      }
    }

    // Fallback: try to find paragraphs
    if (text.length < 100) {
      const paragraphs = document.querySelectorAll("p");
      const paragraphTexts = Array.from(paragraphs)
        .map((p) => this.extractReadableText(p))
        .filter((text) => text.length > 50); // Filter out short paragraphs

      text = paragraphTexts.join(" ");
    }

    // Final fallback: get readable text from body
    if (text.length < 100) {
      text = this.extractReadableText(document.body);
    }

    return this.cleanText(text);
  }

  // Extract text from iframes
  async extractTextFromIframes() {
    let allText = "";
    
    // Run DOM inspection for debugging
    this.inspectDOMForIframes();
    
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
      const shadowIframes = this.findIframesInShadow();
      console.log(`Method 5 - Shadow DOM iframes: Found ${shadowIframes.length} iframes`);
      iframes = shadowIframes;
    }
    
    // Method 6: Wait for dynamically created iframes
    if (iframes.length === 0) {
      console.log('No iframes found initially, waiting for dynamic iframes...');
      iframes = await this.waitForIframes(3000);
    }
    
    // Method 7: Check if we're inside an iframe ourselves
    if (iframes.length === 0) {
      try {
        if (window.self !== window.top) {
          console.log('We are inside an iframe - extracting content from current document');
          const currentContent = this.extractReadableText(document.body);
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
      console.log('Processing srcdoc:', srcdoc.substring(0, 200) + '...');
      
      // Decode HTML entities
      const decodedHtml = this.decodeHTMLEntities(srcdoc);
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
        extractedText = this.extractReadableText(body);
        console.log('Body text length:', extractedText.length);
      }
      
      // Method 2: If no body, look for paragraphs directly
      if (!extractedText || extractedText.length < 50) {
        const paragraphs = tempDiv.querySelectorAll('p');
        console.log('Found', paragraphs.length, 'paragraphs');
        if (paragraphs.length > 0) {
          const paragraphTexts = Array.from(paragraphs)
            .map(p => this.extractReadableText(p))
            .filter(text => text.length > 10);
          extractedText = paragraphTexts.join(" ");
          console.log('Paragraph text length:', extractedText.length);
        }
      }
      
      // Method 3: Extract all text content as fallback
      if (!extractedText || extractedText.length < 50) {
        console.log('Using fallback text extraction...');
        extractedText = this.extractReadableText(tempDiv);
        console.log('Fallback text length:', extractedText.length);
      }
      
      // Clean up the extracted text
      const cleanedText = this.cleanText(extractedText);
      console.log('Final cleaned text length:', cleanedText.length);
      
      return cleanedText;
    } catch (error) {
      console.log('Error extracting from srcdoc:', error);
      return "";
    }
  }

  // Extract text from iframe src (for same-origin iframes)
  extractTextFromIframeSrc(src) {
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
  decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  // Enhanced iframe content extraction
  extractIframeContent(iframe) {
    let content = "";
    
    try {
      // Try multiple methods to extract content
      
      // Method 1: Direct contentDocument access
      if (iframe.contentDocument && iframe.contentDocument.body) {
        content = this.extractReadableText(iframe.contentDocument.body);
        if (content && content.trim().length > 0) {
          console.log('Successfully extracted content from contentDocument');
          return content;
        }
      }
      
      // Method 2: srcdoc attribute
      if (iframe.srcdoc) {
        content = this.extractTextFromSrcdoc(iframe.srcdoc);
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
  async waitForIframes(maxWaitTime = 3000) {
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
  inspectDOMForIframes() {
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
    const shadowIframes = this.findIframesInShadow();
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
  findIframesInShadow(root = document) {
    const iframes = [];
    const nodes = root.querySelectorAll('*');

    nodes.forEach(node => {
      if (node.shadowRoot) {
        console.log('Found shadow root, searching inside...');
        iframes.push(...this.findIframesInShadow(node.shadowRoot));
      }
      if (node.tagName === 'IFRAME') {
        console.log('Found iframe in shadow DOM:', node);
        iframes.push(node);
      }
    });

    return iframes;
  }

  // Process special formatting like dropcaps to make them readable
  processSpecialFormatting(element) {
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
  processDropcapText(htmlText) {
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
    return this.extractReadableText(tempDiv);
  }

  // Fallback function for complex HTML structures
  extractTextFromComplexHTML(htmlString) {
    // Create a temporary element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    // Process the element with our improved extraction
    return this.extractReadableText(tempDiv);
  }

  // Clean and normalize text
  cleanText(text) {
    return text
      .replace(/\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, "\n") // Remove excessive line breaks
      .replace(/\n/g, " ") // Convert remaining line breaks to spaces
      .replace(/\s+/g, " ") // Clean up any remaining multiple spaces
      .trim();
  }

  // Split text into chunks for streaming and store for highlighting
  splitTextIntoChunks(text, maxChunkSize = 500) {
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

    // Get the selected range
    const range = selection.getRangeAt(0);
    
    // Create a temporary container to process the selected HTML
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(range.cloneContents());
    
    // Use our improved text extraction for the selected content
    return this.extractReadableText(tempContainer);
  }
} 