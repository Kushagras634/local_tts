# Makefile for Kokoro TTS Extension
# Provides convenient commands for development and deployment

.PHONY: help setup start stop restart logs build clean test dev

# Default target
help:
	@echo "🎵 Kokoro TTS Extension - Available Commands"
	@echo "============================================="
	@echo ""
	@echo "Setup & Installation:"
	@echo "  setup     - Run automated setup script"
	@echo "  install   - Install dependencies and build extension"
	@echo ""
	@echo "Docker Management:"
	@echo "  start     - Start Kokoro TTS service"
	@echo "  start-gpu - Start Kokoro TTS GPU service"
	@echo "  quick-cpu - Quick CPU start with docker run"
	@echo "  quick-gpu - Quick GPU start with docker run"
	@echo "  stop      - Stop all services"
	@echo "  stop-gpu  - Stop GPU services"
	@echo "  stop-quick - Stop quick docker run containers"
	@echo "  restart   - Restart all services"
	@echo "  restart-gpu - Restart GPU services"
	@echo "  logs      - View service logs"
	@echo "  logs-gpu  - View GPU service logs"
	@echo "  status    - Check service status"
	@echo "  status-gpu - Check GPU service status"
	@echo ""
	@echo "Development:"
	@echo "  build     - Build the extension"
	@echo "  dev       - Start development environment"
	@echo "  test      - Run API tests"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean     - Clean up containers and volumes"
	@echo "  update    - Update to latest version"
	@echo ""

# Setup and installation
setup:
	@echo "🚀 Running automated setup..."
	@chmod +x setup.sh
	@./setup.sh

install:
	@echo "📦 Installing dependencies..."
	@npm install
	@echo "🔨 Building extension..."
	@npm run build
	@echo "✅ Installation complete!"

# Docker management
start:
	@echo "🚀 Starting Local TTS service..."
	@echo "📥 Pulling latest Docker image..."
	@docker pull ghcr.io/remsky/kokoro-fastapi-cpu:latest
	@docker-compose up -d
	@echo "⏳ Waiting for service to be ready..."
	@timeout 60 bash -c 'until curl -f http://localhost:8880/health; do sleep 2; done' || echo "⚠️  Service may still be starting..."
	@echo "✅ Service started!"

start-gpu:
	@echo "🚀 Starting Local TTS GPU service..."
	@echo "📥 Pulling latest GPU Docker image..."
	@docker pull ghcr.io/remsky/kokoro-fastapi-gpu:latest
	@docker-compose -f docker-compose.gpu.yml up -d
	@echo "⏳ Waiting for service to be ready..."
	@timeout 60 bash -c 'until curl -f http://localhost:8880/health; do sleep 2; done' || echo "⚠️  Service may still be starting..."
	@echo "✅ GPU service started!"

quick-cpu:
	@echo "⚡ Quick CPU start with docker run..."
	@echo "📥 Pulling latest Docker image..."
	@docker pull ghcr.io/remsky/kokoro-fastapi-cpu:latest
	@docker run -d --name local-tts-cpu -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
	@echo "✅ CPU service started with docker run!"

quick-gpu:
	@echo "⚡ Quick GPU start with docker run..."
	@echo "📥 Pulling latest GPU Docker image..."
	@docker pull ghcr.io/remsky/kokoro-fastapi-gpu:latest
	@docker run -d --name local-tts-gpu --gpus all -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-gpu:latest
	@echo "✅ GPU service started with docker run!"

stop:
	@echo "🛑 Stopping services..."
	@docker-compose down
	@echo "✅ Services stopped!"

stop-gpu:
	@echo "🛑 Stopping GPU services..."
	@docker-compose -f docker-compose.gpu.yml down
	@echo "✅ GPU services stopped!"

stop-quick:
	@echo "🛑 Stopping quick docker run containers..."
	@docker stop kokoro-tts-cpu kokoro-tts-gpu 2>/dev/null || true
	@docker rm kokoro-tts-cpu kokoro-tts-gpu 2>/dev/null || true
	@echo "✅ Quick containers stopped!"

restart:
	@echo "🔄 Restarting services..."
	@docker-compose restart
	@echo "✅ Services restarted!"

restart-gpu:
	@echo "🔄 Restarting GPU services..."
	@docker-compose -f docker-compose.gpu.yml restart
	@echo "✅ GPU services restarted!"

logs:
	@echo "📋 Viewing service logs..."
	@docker-compose logs -f kokoro-tts

logs-gpu:
	@echo "📋 Viewing GPU service logs..."
	@docker-compose -f docker-compose.gpu.yml logs -f kokoro-tts

status:
	@echo "📊 Service status:"
	@docker-compose ps
	@echo ""
	@echo "🏥 Health check:"
	@curl -s http://localhost:8880/health || echo "❌ Service not responding"

status-gpu:
	@echo "📊 GPU service status:"
	@docker-compose -f docker-compose.gpu.yml ps
	@echo ""
	@echo "🏥 Health check:"
	@curl -s http://localhost:8880/health || echo "❌ Service not responding"

# Development
build:
	@echo "🔨 Building extension..."
	@npm run build
	@echo "✅ Build complete!"

dev:
	@echo "🛠️  Starting development environment..."
	@docker-compose -f docker-compose.dev.yml up -d
	@echo "✅ Development environment ready!"
	@echo "📋 Available services:"
	@echo "   - Kokoro TTS: http://localhost:8880"
	@echo "   - Dev Tools: http://localhost:3000"
	@echo "   - View logs: make logs"

test:
	@echo "🧪 Running API tests..."
	@curl -f http://localhost:8880/health || (echo "❌ Service not running. Run 'make start' first." && exit 1)
	@echo "✅ Health check passed!"
	@echo "🎵 Testing TTS API..."
	@curl -X POST http://localhost:8880/v1/audio/speech \
		-H 'Content-Type: application/json' \
		-d '{"model":"kokoro","input":"Hello World","voice":"en","response_format":"pcm"}' \
		--output /dev/null --silent --show-error && echo "✅ TTS API test passed!" || echo "❌ TTS API test failed!"

# Maintenance
clean:
	@echo "🧹 Cleaning up..."
	@docker-compose down -v
	@docker system prune -f
	@echo "✅ Cleanup complete!"

update:
	@echo "🔄 Updating to latest version..."
	@docker-compose pull
	@docker-compose up -d
	@echo "✅ Update complete!"

# Quick commands for common tasks
quick-test:
	@echo "⚡ Quick API test..."
	@curl -s http://localhost:8880/health | jq . || echo "❌ Service not available"

check-extension:
	@echo "🔍 Checking extension build..."
	@test -f content.js && echo "✅ Extension built" || echo "❌ Extension not built. Run 'make build'"

# Development workflow
watch:
	@echo "👀 Starting watch mode..."
	@npm run build:watch

lint:
	@echo "🔍 Linting code..."
	@npm run lint || echo "⚠️  No linting configured"

# Production deployment helpers
prod-start:
	@echo "🚀 Starting production services..."
	@docker-compose -f docker-compose.yml up -d
	@echo "✅ Production services started!"

prod-stop:
	@echo "🛑 Stopping production services..."
	@docker-compose -f docker-compose.yml down
	@echo "✅ Production services stopped!" 