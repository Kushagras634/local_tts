// Main Content Script for Kokoro TTS Extension
import { TextExtractor } from './text-extraction.js';
import { AudioHandler } from './audio-handler.js';
import { HighlightingHandler } from './highlighting.js';
import { UIController } from './ui-controller.js';

(function () {
  // Initialize modules
  const textExtractor = new TextExtractor();
  const audioHandler = new AudioHandler();
  const highlightingHandler = new HighlightingHandler();
  const uiController = new UIController();

  // Make modules globally accessible for cross-module communication
  window.textExtractor = textExtractor;
  window.audioHandler = audioHandler;
  window.highlightingHandler = highlightingHandler;
  window.uiController = uiController;

  // Message listener
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      (async function () {
        try {
          console.log("Received request:", request);

          switch (request.action) {
            case "readSelected":
              // Stop any current playback
              audioHandler.stopPlayback(textExtractor, highlightingHandler);

              // Get selected text from the page (not from request)
              const selectedText = textExtractor.getSelectedText();

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
                // Set selected range for highlighting
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                  highlightingHandler.setSelectedRange(selection.getRangeAt(0).cloneRange());
                  highlightingHandler.setReadingSelected(true);
                }

                // Show visual indicator
                uiController.addVisualIndicator(audioHandler);

                // Process streaming audio for selected text
                await audioHandler.processStreamingAudio(
                  selectedText,
                  request.apiUrl,
                  request.voice,
                  request.speed || 1,
                  true, // isSelected
                  true, // autoPlay
                  request.highlightText || true,
                  textExtractor,
                  highlightingHandler,
                  request.audioFormat || 'pcm'
                );

              } catch (error) {
                uiController.removeVisualIndicator();
                uiController.showError(error.message);
                chrome.runtime.sendMessage({
                  action: "playbackError",
                  error: error.message,
                });
              }
              break;

            case "read":
              // Stop any current playback
              audioHandler.stopPlayback(textExtractor, highlightingHandler);

              // Extract text from page based on settings
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
                  message: "No readable content found on this page",
                });
                return;
              }

              console.log(`Reading page content: ${text.length} characters`);

              // Split text into chunks based on user settings
              const chunkSize = request.chunkSize || 500;
              const chunks = textExtractor.splitTextIntoChunks(text, chunkSize);

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
                uiController.addVisualIndicator(audioHandler);

                // Process streaming audio for page content
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
                  request.audioFormat || 'pcm'
                );

              } catch (error) {
                uiController.removeVisualIndicator();
                uiController.showError(error.message);
                chrome.runtime.sendMessage({
                  action: "playbackError",
                  error: error.message,
                });
              }
              break;

            case "analyze":
              // Analyze content without starting playback
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
              // Extract and return text content
              const extractedText = await textExtractor.extractArticleText();
              const extractedChunks = textExtractor.splitTextIntoChunks(extractedText, request.chunkSize || 500);
              
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
                message: audioHandler.isPaused ? "Paused" : "Resumed",
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

      return true; // Keep the message channel open for async response
    },
  );

  // Clean up on page unload
  window.addEventListener("beforeunload", function () {
    audioHandler.stopPlayback(textExtractor, highlightingHandler);
    uiController.removeVisualIndicator();
  });

  console.log("Kokoro TTS content script loaded with modular architecture");
})(); 