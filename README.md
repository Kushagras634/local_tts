# Kokoro TTS Chrome Extension

A Chrome extension that uses your local Kokoro-FastAPI Docker container to read web articles aloud with high-quality text-to-speech in 60+ languages.

## Features

- 🎵 **High-quality TTS**: Uses Kokoro-82M model for natural-sounding speech
- 🌍 **60+ Languages**: Supports a wide range of languages and accents
- 📖 **Smart Article Detection**: Automatically extracts readable content from web pages
- 🎛️ **Customizable Settings**: Adjust voice, speed, and API endpoint
- 🎧 **Audio Format Options**: Choose between PCM (recommended), MP3, or WAV formats
- ⏯️ **Playback Controls**: Play, pause, and stop functionality
- 🎨 **Modern UI**: Beautiful gradient interface with visual indicators
- 🖱️ **Context Menu**: Right-click to read selected text or full articles

## Prerequisites

### Quick Start (docker run)

Pre-built images are available with ARM/multi-arch support and baked-in models:

```bash
# CPU version (recommended for most users)
docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest

# GPU version (requires NVIDIA GPU)
docker run --gpus all -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-gpu:latest
```

**Note**: The `latest` tag can be used, though it may have some unexpected bonus features which impact stability. Named versions should be pinned for regular usage.

### Full Setup Options

1. **Kokoro-FastAPI Docker Container**: You need to have Kokoro-FastAPI running locally

   **Option A: Quick Setup (Recommended)**
   ```bash
   # Clone this repository
   git clone <your-repo-url>
   cd local_tts
   
   # Run the setup script
   ./setup.sh
   ```

   **Option B: Manual Docker Setup**
   ```bash
   # Create necessary directories
   mkdir -p models cache
   
   # Start the Kokoro TTS service
   docker-compose up -d
   
   # Check if service is ready
   curl http://localhost:8880/health
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
   ├── docker-compose.yml
   ├── setup.sh
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

## Docker Setup

This project includes Docker Compose configuration for easy setup of the Kokoro TTS service.

### Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd local_tts

# Run the automated setup script (interactive)
./setup.sh

# Or use Makefile commands
make setup
```

### Quick Docker Run Commands

For the fastest setup, use these simple docker run commands:

```bash
# CPU version (recommended for most users)
docker run -d --name kokoro-tts-cpu -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest

# GPU version (requires NVIDIA GPU)
docker run -d --name kokoro-tts-gpu --gpus all -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-gpu:latest
```

### Manual Docker Setup

```bash
# Create directories for models and cache
mkdir -p models cache

# Start the Kokoro TTS service (CPU)
docker-compose up -d

# Start the Kokoro TTS service (GPU)
docker-compose -f docker-compose.gpu.yml up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f kokoro-tts
```

### Docker Configuration

The project includes multiple Docker Compose configurations:

- **`docker-compose.yml`**: CPU version (recommended for most users)
- **`docker-compose.gpu.yml`**: GPU version (requires NVIDIA GPU)
- **`docker-compose.dev.yml`**: Development environment with testing tools

Each configuration includes:
- **Kokoro TTS Service**: Runs on port 8880
- **Health Check**: Automatically monitors service status
- **Volume Mounts**: Persistent storage for models and cache
- **Network**: Isolated network for service communication

### Environment Variables

You can customize the service by setting environment variables:

```yaml
environment:
  - HOST=0.0.0.0
  - PORT=8880
  - WORKERS=1
  - MODEL_PATH=/app/models
  - CACHE_DIR=/app/cache
  - LOG_LEVEL=INFO
  # GPU-specific (for GPU version)
  - CUDA_VISIBLE_DEVICES=0
  # Refer to core/config.py for full list of configurable variables
  # - VOICE_CACHE_SIZE=100
  # - AUDIO_CACHE_SIZE=100
  # - MAX_TEXT_LENGTH=5000
```

### Useful Docker Commands

```bash
# Start services
docker-compose up -d                    # CPU version
docker-compose -f docker-compose.gpu.yml up -d  # GPU version

# Stop services
docker-compose down
docker-compose -f docker-compose.gpu.yml down

# Restart services
docker-compose restart
docker-compose -f docker-compose.gpu.yml restart

# View logs
docker-compose logs -f kokoro-tts
docker-compose -f docker-compose.gpu.yml logs -f kokoro-tts

# Update to latest version
docker-compose pull
docker-compose up -d

# Quick docker run management
docker stop kokoro-tts-cpu kokoro-tts-gpu
docker rm kokoro-tts-cpu kokoro-tts-gpu

# Check service health
curl http://localhost:8880/health

# Test API endpoint
curl -X POST http://localhost:8880/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"model":"kokoro","input":"Hello World","voice":"en","response_format":"pcm"}'
```

### Makefile Commands

The project includes a comprehensive Makefile for easy management:

```bash
# Setup and installation
make setup          # Interactive setup
make install        # Install dependencies and build

# Docker management
make start          # Start CPU service
make start-gpu      # Start GPU service
make quick-cpu      # Quick CPU docker run
make quick-gpu      # Quick GPU docker run
make stop           # Stop services
make stop-gpu       # Stop GPU services
make stop-quick     # Stop quick docker run containers
make restart        # Restart services
make restart-gpu    # Restart GPU services
make logs           # View logs
make logs-gpu       # View GPU logs
make status         # Check status
make status-gpu     # Check GPU status

# Development
make build          # Build extension
make dev            # Start development environment
make test           # Run API tests

# Maintenance
make clean          # Clean up containers and volumes
make update         # Update to latest version
```

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
- **Audio Format**: Choose between PCM (recommended), MP3 (smaller size), or WAV (high quality)

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

## Build Process

This project uses a modular structure with esbuild bundling:

### Source Structure
- `src/main.js` - Main entry point with modular imports
- `src/text-extraction.js` - Text extraction and processing logic
- `src/audio-handler.js` - Audio playback and streaming functionality
- `src/highlighting.js` - Text highlighting during playback
- `src/ui-controller.js` - UI controls and visual indicators

### Building the Extension

The modular code is bundled into a single `content.js` file using esbuild:

```bash
# Build once
npm run build

# Build and watch for changes
npm run build:watch

# Direct esbuild command
npm run build:esbuild
```

### Build Output
- `content.js` - Bundled content script (replaces the old monolithic content.js)
- All modules are combined into a single IIFE (Immediately Invoked Function Expression)
- Compatible with Chrome extension content script requirements

### Development Workflow
1. Edit files in the `src/` directory
2. Run `npm run build:watch` to automatically rebuild on changes
3. Reload the extension in Chrome to test changes
