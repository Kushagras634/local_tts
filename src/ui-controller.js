// UI Controller Module
export class UIController {
  constructor() {
    this.keyboardHandler = null;
  }

  // Add visual indicator
  addVisualIndicator(audioHandler) {
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
    prevButton.onclick = () => this.navigateChunk(-1, audioHandler);

    const playPauseButton = document.createElement('button');
    playPauseButton.innerHTML = audioHandler.isPaused ? '▶️' : '⏸️';
    playPauseButton.title = 'Play/Pause (Space)';
    playPauseButton.onclick = () => audioHandler.pauseResumePlayback();

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '⏭️';
    nextButton.title = 'Next chunk (Alt + Right)';
    nextButton.onclick = () => this.navigateChunk(1, audioHandler);

    indicator.appendChild(prevButton);
    indicator.appendChild(playPauseButton);
    indicator.appendChild(nextButton);

    document.body.appendChild(indicator);

    // Add keyboard shortcuts
    this.setupKeyboardShortcuts(audioHandler);
  }

  setupKeyboardShortcuts(audioHandler) {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
    }

    this.keyboardHandler = (event) => {
      if (event.altKey) {
        if (event.key === 'ArrowLeft') {
          this.navigateChunk(-1, audioHandler);
        } else if (event.key === 'ArrowRight') {
          this.navigateChunk(1, audioHandler);
        }
      } else if (event.code === 'Space' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        audioHandler.pauseResumePlayback();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  navigateChunk(direction, audioHandler) {
    if (!window.textExtractor?.textChunks.length) return;

    // Stop current playback
    audioHandler.stopPlayback(window.textExtractor, window.highlightingHandler);

    // Update chunk index
    window.textExtractor.currentChunkIndex = Math.max(0, Math.min(window.textExtractor.textChunks.length - 1, window.textExtractor.currentChunkIndex + direction));

    // Start reading from the new chunk
    const text = window.textExtractor.textChunks[window.textExtractor.currentChunkIndex];
    window.highlightingHandler.highlightText(text, window.highlightingHandler.getReadingSelected());
    audioHandler.processStreamingAudio(text, 'http://localhost:5000/tts', 'default', 1, window.highlightingHandler.getReadingSelected(), true, true, window.textExtractor, window.highlightingHandler);
  }

  removeVisualIndicator() {
    const existing = document.getElementById("kokoro-tts-indicator");
    if (existing) {
      existing.remove();
    }

    // Remove keyboard event listener
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
  }

  // Update UI based on playback state
  updatePlaybackUI(audioHandler) {
    const playPauseButton = document.querySelector('#kokoro-tts-indicator button:nth-child(2)');
    if (playPauseButton) {
      playPauseButton.innerHTML = audioHandler.isPaused ? '▶️' : '⏸️';
    }
  }

  // Show error message
  showError(message) {
    const errorDiv = document.createElement('div');
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
    errorDiv.id = 'kokoro-tts-error';

    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 5000);
  }

  // Show success message
  showSuccess(message) {
    const successDiv = document.createElement('div');
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
    successDiv.id = 'kokoro-tts-success';

    document.body.appendChild(successDiv);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.remove();
      }
    }, 3000);
  }

  // Show loading indicator
  showLoading() {
    const loadingDiv = document.createElement('div');
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
    loadingDiv.id = 'kokoro-tts-loading';

    // Add spin animation
    const style = document.createElement('style');
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
    const loadingDiv = document.getElementById('kokoro-tts-loading');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }
} 