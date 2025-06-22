// Highlighting Module
export class HighlightingHandler {
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

    // Add progress indicator
    const progress = document.createElement('div');
    progress.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #4CAF50 ${(window.textExtractor?.currentChunkIndex / window.textExtractor?.textChunks.length) * 100}%, #e0e0e0 ${(window.textExtractor?.currentChunkIndex / window.textExtractor?.textChunks.length) * 100}%);
      width: 100%;
      z-index: 10001;
    `;
    progress.id = 'kokoro-tts-progress';
    document.body.appendChild(progress);
  }

  // Highlight selected text
  highlightSelectedText(text) {
    try {
      if (this.selectedRange) {
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
          this.selectedRange.surroundContents(span);
          this.highlightedElements.push(span);
        } catch (e) {
          // If surroundContents fails, try extractContents and insert
          const contents = this.selectedRange.extractContents();
          span.appendChild(contents);
          this.selectedRange.insertNode(span);
          this.highlightedElements.push(span);
        }
      }
    } catch (error) {
      console.log('Could not highlight selected text:', error);
    }
  }

  // Highlight text in page content
  highlightPageText(text) {
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
          this.highlightedElements.push(span);

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
  clearHighlights() {
    this.highlightedElements.forEach(element => {
      if (element && element.parentNode) {
        const parent = element.parentNode;
        parent.insertBefore(document.createTextNode(element.textContent), element);
        parent.removeChild(element);
        parent.normalize();
      }
    });
    this.highlightedElements = [];

    const progress = document.getElementById('kokoro-tts-progress');
    if (progress) {
      progress.remove();
    }
  }

  // Add highlight styles to page
  addHighlightStyles() {
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
} 