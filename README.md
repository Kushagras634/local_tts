# Local TTS Chrome Extension

A Chrome extension that uses your local TTS API Docker container to read web articles aloud with high-quality text-to-speech in 60+ languages.

## 🎯 Project Overview

Local TTS is a privacy-focused Chrome extension that brings high-quality text-to-speech capabilities directly to your browser. Unlike cloud-based TTS services, this extension runs entirely on your local machine using Docker containers, ensuring your data never leaves your device.

### ✨ Key Features

- 🎵 **High-quality TTS**: Uses Local TTS model for natural-sounding speech
- 🌍 **60+ Languages**: Supports a wide range of languages and accents
- 📖 **Smart Article Detection**: Automatically extracts readable content from web pages
- 🎛️ **Customizable Settings**: Adjust voice, speed, and API endpoint
- 🎧 **Audio Format Options**: Choose between PCM (recommended), MP3, or WAV formats
- ⏯️ **Playback Controls**: Play, pause, and stop functionality
- 🎨 **Modern UI**: Beautiful gradient interface with visual indicators
- 🖱️ **Context Menu**: Right-click to read selected text or full articles
- 🔒 **Privacy-First**: All processing happens locally on your machine
- 🚀 **Easy Setup**: One-command Docker deployment

### 🛠️ Tech Stack

- **Frontend**: Chrome Extension (Manifest V3), HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Local TTS API (Docker container)
- **Build Tools**: esbuild, npm
- **Containerization**: Docker, Docker Compose
- **Languages**: JavaScript, HTML, CSS, YAML

## 🚀 Quick Start

### Prerequisites

- **Docker** (for running the TTS service)
- **Chrome Browser** (Version 88+ for Manifest V3 support)
- **Git** (for cloning the repository)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/local-tts.git
   cd local-tts
   ```

2. **Start the TTS service**
   ```bash
   # Pull the Docker images first
   docker pull ghcr.io/remsky/kokoro-fastapi-cpu:latest
   docker pull ghcr.io/remsky/kokoro-fastapi-gpu:latest
   
   # CPU version (recommended for most users)
   docker run -d --name local-tts-cpu -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
   
   # GPU version (requires NVIDIA GPU)
   docker run -d --name local-tts-gpu --gpus all -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-gpu:latest
   
   # Or use the interactive setup script
   ./setup.sh
   ```

3. **Load the extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `local-tts` folder
   - The extension should now appear in your extensions list

4. **Configure the extension**
   - Click the extension icon
   - Set the API URL to: `http://localhost:8880`
   - Choose your preferred voice and settings

## 🛠️ Local Development

### Development Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/yourusername/local-tts.git
   cd local-tts
   npm install
   ```

2. **Start development environment**
   ```bash
   # Start the TTS service
   make dev
   
   # Or manually:
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Build the extension**
   ```bash
   # Build once
   npm run build
   
   # Watch mode for development
   npm run build:watch
   ```

4. **Load in Chrome for testing**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project folder
   - Click the reload button after making changes

### Development Workflow

1. **Make your changes** in the `src/` directory
2. **Build the extension** with `npm run build` or `npm run build:watch`
3. **Reload the extension** in Chrome's extension page
4. **Test your changes** on any webpage
5. **Commit and push** your changes

### Project Structure

```
local-tts/
├── src/                    # Source code
│   ├── main.js            # Main content script
│   ├── audio-handler.js   # Audio processing
│   ├── text-extraction.js # Text extraction logic
│   ├── highlighting.js    # Text highlighting
│   └── ui-controller.js   # UI management
├── popup.html             # Extension popup UI
├── popup.js               # Popup functionality
├── background.js          # Background service worker
├── content.css            # Content script styles
├── manifest.json          # Extension manifest
├── docker-compose.yml     # Docker configuration
├── setup.sh              # Setup script
└── README.md             # This file
```

### Available Scripts

```bash
# Build the extension
npm run build

# Watch mode for development
npm run build:watch

# Start development environment
make dev

# Run tests
make test

# Clean up
make clean
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute

- 🐛 **Report bugs** - Use [GitHub Issues](../../issues)
- 💡 **Suggest features** - Open a feature request
- 🔧 **Fix bugs** - Submit a pull request
- 📚 **Improve documentation** - Help make the docs better
- 🌍 **Add language support** - Help with translations
- 🎨 **UI/UX improvements** - Enhance the user experience

### Contribution Guidelines

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Test thoroughly**
   ```bash
   npm run build
   make test
   ```
5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new audio format support"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request**

### Code Style

- Use clear, descriptive commit messages
- Follow existing code style and formatting
- Add comments for complex logic
- Test your changes before submitting
- Update documentation if needed

### Testing Your Changes

1. **Build the extension**
   ```bash
   npm run build
   ```

2. **Load in Chrome**
   - Go to `chrome://extensions/`
   - Click reload on the extension
   - Test on various websites

3. **Run API tests**
   ```bash
   make test
   ```

## 📋 Issue Templates

When reporting issues, please include:

- **Browser version** and **OS**
- **Extension version**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Screenshots** (if applicable)
- **Console logs** (if errors occur)

## 🏗️ Architecture

### Extension Components

- **Content Script** (`src/main.js`): Injected into web pages to extract text and handle user interactions
- **Popup** (`popup.html/js`): Extension UI for settings and controls
- **Background Script** (`background.js`): Service worker for background tasks
- **Audio Handler** (`src/audio-handler.js`): Manages TTS API communication and audio playback
- **Text Extractor** (`src/text-extraction.js`): Extracts readable content from web pages
- **UI Controller** (`src/ui-controller.js`): Manages visual indicators and UI state

### Data Flow

1. User clicks "Read" in popup or context menu
2. Content script extracts text from the page
3. Text is sent to local TTS API via audio handler
4. Audio is streamed back and played through Web Audio API
5. UI updates to show progress and current text position

## 🔧 Configuration

### Environment Variables

The TTS service can be configured with these environment variables:

```yaml
environment:
  - HOST=0.0.0.0
  - PORT=8880
  - WORKERS=1
  - MODEL_PATH=/app/models
  - CACHE_DIR=/app/cache
  - LOG_LEVEL=INFO
  - VOICE_CACHE_SIZE=100
  - AUDIO_CACHE_SIZE=100
  - MAX_TEXT_LENGTH=5000
```

### Extension Settings

- **API URL**: Your local TTS service endpoint
- **Voice**: Choose from 60+ available voices
- **Speed**: Adjust playback speed (0.5x to 2.0x)
- **Audio Format**: PCM, MP3, or WAV
- **Chunk Size**: Text chunk size for processing
- **Auto-play**: Automatically play next chunk
- **Highlighting**: Highlight current text being read

## 🐛 Troubleshooting

### Common Issues

1. **"Cannot connect to API"**
   - Ensure Docker container is running
   - Check if port 8880 is accessible
   - Verify API URL in extension settings

2. **"No readable content found"**
   - Try selecting specific text
   - Check if page has detectable content
   - Some JavaScript-heavy sites may not work

3. **Audio not playing**
   - Check browser audio settings
   - Ensure user interaction occurred
   - Try refreshing the page

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=DEBUG` in your Docker environment:

```bash
docker run -d --name local-tts-cpu -p 8880:8880 \
  -e LOG_LEVEL=DEBUG \
  ghcr.io/remsky/kokoro-fastapi-cpu:latest
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Local TTS API](https://github.com/remsky/kokoro-fastapi)
- Chrome Extension Manifest V3
- Web Audio API for audio processing
- Docker for containerization

## 📞 Support

- 📧 **Email**: [your-email@example.com]
- 🐛 **Issues**: [GitHub Issues](../../issues)
- 📖 **Documentation**: [Wiki](../../wiki)
- 💬 **Discussions**: [GitHub Discussions](../../discussions)

## 🚀 Roadmap

- [ ] Support for more TTS models
- [ ] Voice cloning capabilities
- [ ] Offline mode
- [ ] Mobile browser support
- [ ] Advanced text processing
- [ ] Integration with more browsers
- [ ] Plugin system for custom voices

---

**Made with ❤️ by the Local TTS community**

For security issues, see [SECURITY.md](SECURITY.md). For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md). For community standards, see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
