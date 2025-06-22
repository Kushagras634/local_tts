// Audio Handler Module
export class AudioHandler {
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

    // Resume audio context if suspended (required by Chrome's autoplay policy)
    if (this.audioContext.state === "suspended") {
      return this.audioContext.resume();
    }
    return Promise.resolve();
  }

  // Call Kokoro FastAPI to generate speech with streaming
  async generateSpeechStream(text, apiUrl, voice, speed = 1, audioFormat = 'pcm') {
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
          response_format: audioFormat,
          download_format: audioFormat === 'pcm' ? "mp3" : audioFormat,
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
  async processStreamingAudio(text, apiUrl, voice, speed = 1, isSelected = false, autoPlay = true, highlightText = true, textExtractor, highlightingHandler, audioFormat = 'pcm') {
    const chunks = textExtractor.splitTextIntoChunks(text, 500);
    console.log(`Processing ${chunks.length} text chunks for streaming...`);

    // Clear existing queue
    this.audioQueue = [];
    this.isProcessingQueue = true;
    
    // Add highlight styles only if highlighting is enabled
    if (highlightText) {
      highlightingHandler.addHighlightStyles();
    }

    try {
      // Generate audio for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Generating audio for chunk ${i + 1}/${chunks.length}`);

        const audioBuffer = await this.generateSpeechStream(chunk, apiUrl, voice, speed, audioFormat);
        this.audioQueue.push(audioBuffer);

        // Start playing the first chunk immediately if auto-play is enabled
        if (i === 0 && autoPlay) {
          this.playNextInQueue(textExtractor, highlightingHandler, isSelected);
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
      this.isProcessingQueue = false;
      throw error;
    }
  }

  // Convert raw PCM data to AudioBuffer
  createAudioBufferFromPCM(pcmData, sampleRate = 22050, channels = 1) {
    const samples = pcmData.byteLength / 2; // 16-bit samples
    const audioBuffer = this.audioContext.createBuffer(channels, samples, sampleRate);

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
        // First try to decode as encoded audio (MP3, WAV, etc.)
        audioData = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
        console.log("Successfully decoded as encoded audio");
      } catch (decodeError) {
        console.log("Encoded audio decode failed, trying raw PCM...");

        // If that fails, treat as raw PCM data
        try {
          audioData = this.createAudioBufferFromPCM(audioBuffer);
          console.log(`Successfully created AudioBuffer from PCM: ${audioData.duration.toFixed(2)}s`);
        } catch (pcmError) {
          console.error("PCM processing error:", pcmError);

          // Try to continue with next chunk if available
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

      // Connect to destination
      source.connect(this.audioContext.destination);

      // Set up current audio reference
      this.currentAudio = source;
      this.isPlaying = true;
      this.isPaused = false;

      console.log(`Playing audio chunk: ${audioData.duration.toFixed(2)}s`);

      // Handle playback end - play next chunk
      source.onended = () => {
        if (this.audioQueue.length > 0) {
          // Move to next chunk and highlight it if highlighting is enabled
          textExtractor.currentChunkIndex++;
          if (textExtractor.currentChunkIndex < textExtractor.textChunks.length) {
            // Check if highlighting is enabled (we'll need to store this setting)
            const shouldHighlight = true; // This should come from settings
            if (shouldHighlight) {
              highlightingHandler.highlightText(textExtractor.textChunks[textExtractor.currentChunkIndex], isReadingSelected);
            }
          }

          // Play next chunk
          setTimeout(() => this.playNextInQueue(textExtractor, highlightingHandler, isReadingSelected), 50); // Small delay between chunks
        } else {
          this.isPlaying = false;
          this.currentAudio = null;
          this.isProcessingQueue = false;
          highlightingHandler.clearHighlights();
          chrome.runtime.sendMessage({ action: "playbackFinished" });
        }
      };

      // Highlight current chunk when playback starts if highlighting is enabled
      if (textExtractor.currentChunkIndex < textExtractor.textChunks.length) {
        // Check if highlighting is enabled (we'll need to store this setting)
        const shouldHighlight = true; // This should come from settings
        if (shouldHighlight) {
          highlightingHandler.highlightText(textExtractor.textChunks[textExtractor.currentChunkIndex], isReadingSelected);
        }
      }

      // Start playing
      source.start(0);

    } catch (error) {
      console.error("Audio playback error:", error);
      this.isProcessingQueue = false;
      chrome.runtime.sendMessage({
        action: "playbackError",
        error: `Audio playback failed: ${error.message}`,
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
        // Audio might already be stopped
      }
      this.currentAudio = null;
    }

    // Clear queue and highlights
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
} 