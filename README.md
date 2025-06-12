# Kokoro TTS Chrome Extension

A Chrome extension that uses your local Kokoro-FastAPI Docker container to read web articles aloud with high-quality text-to-speech in 60+ languages.

## Features

- 🎵 **High-quality TTS**: Uses Kokoro-82M model for natural-sounding speech
- 🌍 **60+ Languages**: Supports a wide range of languages and accents
- 📖 **Smart Article Detection**: Automatically extracts readable content from web pages
- 🎛️ **Customizable Settings**: Adjust voice, speed, and API endpoint
- ⏯️ **Playback Controls**: Play, pause, and stop functionality
- 🎨 **Modern UI**: Beautiful gradient interface with visual indicators
- 🖱️ **Context Menu**: Right-click to read selected text or full articles

## Prerequisites

1. **Kokoro-FastAPI Docker Container**: You need to have Kokoro-FastAPI running locally

   ```bash
   docker run -p 8880:8880 your-kokoro-fastapi-image
   ```

2. **Chrome Browser**: Version 88+ (Manifest V3 support)

## Installation

1. **Download Extension Files**: Save all the provided files in a folder called `kokoro-tts-extension`:

   ```
   kokoro-tts-extension/
   ├── manifest.json
   ├── popup.html
   ├── popup.js
   ├── content.js
   ├── content.css
   ├── background.js
   └── icons/ (create this folder)
       ├── icon16.png
       ├── icon48.png
       └── icon128.png
   ```

2. **Create Icons**: Create simple icon files or download them:

   - 16x16 pixels for `icon16.png`
   - 48x48 pixels for `icon48.png`
   - 128x128 pixels for `icon128.png`

3. **Load Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select your `kokoro-tts-extension` folder
   - The extension should now appear in your extensions list

## Usage

### Basic Usage

1. **Configure API URL**: Click the extension icon and ensure the API URL points to your Kokoro-FastAPI instance (default: `http://localhost:8880`)

2. **Read Articles**:

   - Navigate to any article or webpage
   - Click the extension icon
   - Click "▶️ Read" to start reading
   - Use "⏸️ Pause" and "⏹️ Stop" for playback control

3. **Customize Settings**:
   - Choose from 60+ voice languages
   - Adjust playback speed (0.5x to 2.0x)
   - Settings are automatically saved

### Advanced Features

- **Right-click Reading**: Right-click on selected text or anywhere on the page for quick reading options
- **Visual Indicators**: The extension shows a floating indicator while reading
- **Smart Content Detection**: Automatically finds and extracts article content from various website layouts

## Supported Websites

The extension works on most websites and automatically detects content from:

- News websites (CNN, BBC, Reuters, etc.)
- Blog posts and articles
- Wikipedia pages
- Medium articles
- General web content with article structure

## Settings

- **API URL**: Your Kokoro-FastAPI endpoint (usually `http://localhost:8880`)
- **Voice**: Choose from 60+ languages including English, Spanish, French, German, Japanese, Chinese, etc.
- **Speed**: Adjust playback speed from 0.5x (slow) to 2.0x (fast)

## Troubleshooting

### Common Issues

1. **"Cannot connect to API" error**:

   - Ensure Kokoro-FastAPI Docker container is running
   - Check that port 8880 is accessible
   - Verify the API URL in extension settings

2. **"No readable content found"**:

   - The page might not have detectable article content
   - Try selecting specific text and using right-click context menu
   - Some sites with heavy JavaScript might not work properly

3. **Audio not playing**:
   - Chrome requires user interaction before playing audio
   - Try clicking on the page first, then using the extension
   - Check browser audio settings

### Docker Container Issues

Make sure your Kokoro-FastAPI container:

- Is running on the correct port (8880)
- Has the `/v1/audio/speech` endpoint available
- Supports the OpenAI-compatible API format

### Extension Permissions

The extension requires:

- `activeTab`: To read content from the current page
- `storage`: To save your settings
- `host_permissions`: To connect to your local API

## Development

### File Structure

- `manifest.json`: Extension configuration
- `popup.html/js`: Extension popup interface
- `content.js/css`: Scripts injected into web pages
- `background.js`: Service worker for background tasks

### Customization

You can modify the extension by:

- Editing CSS for different visual styles
- Adjusting content detection selectors in `content.js`
- Adding new voice options in `popup.html`
- Modifying API request format for different TTS services

## API Compatibility

This extension is designed for Kokoro-FastAPI with OpenAI-compatible endpoints:

```
POST /v1/audio/speech
{
  "model": "kokoro",
  "input": "text to speak",
  "voice": "en",
  "response_format": "mp3"
}
```

## Security Notes

- Extension only communicates with your local API
- No data is sent to external servers
- All processing happens locally on your machine
- Content is temporarily stored in memory only

## License

This extension is provided as-is for educational and personal use. Make sure to comply with the licensing terms of the Kokoro-82M model and FastAPI wrapper you're using.

## Support

For issues related to:

- **Extension functionality**: Check the browser console for error messages
- **Kokoro-FastAPI**: Refer to the Kokoro-FastAPI documentation
- **Chrome Extension APIs**: Check Chrome Extension documentation

## Version History

- **v1.0**: Initial release with basic TTS functionality
  - Article content extraction
  - 60+ language support
  - Playback controls
  - Modern UI design
