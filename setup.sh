#!/bin/bash

# Local TTS Setup Script
# This script helps you set up the Local TTS service for the Chrome extension

set -e

echo "🎵 Local TTS Setup Script"
echo "=========================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Pull the Docker images first
echo "📥 Pulling Docker images..."
docker pull ghcr.io/remsky/kokoro-fastapi-cpu:latest
if [ "$GPU_AVAILABLE" = true ]; then
    docker pull ghcr.io/remsky/kokoro-fastapi-gpu:latest
fi
echo "✅ Docker images pulled successfully"

# Check for GPU support
GPU_AVAILABLE=false
if command -v nvidia-smi &> /dev/null; then
    if nvidia-smi &> /dev/null; then
        GPU_AVAILABLE=true
        echo "🎮 NVIDIA GPU detected"
    fi
fi

# Ask user for preference
echo ""
echo "🚀 Choose your setup:"
echo "1) CPU version (recommended for most users)"
echo "2) GPU version (requires NVIDIA GPU)"
echo "3) Quick docker run (CPU)"
echo "4) Quick docker run (GPU)"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        COMPOSE_FILE="docker-compose.yml"
        echo "✅ Using CPU version with Docker Compose"
        ;;
    2)
        if [ "$GPU_AVAILABLE" = true ]; then
            COMPOSE_FILE="docker-compose.gpu.yml"
            echo "✅ Using GPU version with Docker Compose"
        else
            echo "❌ GPU not available, falling back to CPU version"
            COMPOSE_FILE="docker-compose.yml"
        fi
        ;;
    3)
        echo "🚀 Starting CPU version with docker run..."
        docker run -d --name local-tts-cpu -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
        echo "✅ CPU version started with docker run"
        echo "📋 Container name: local-tts-cpu"
        echo "📋 Container name: kokoro-tts-cpu"
        echo "🌐 Service available at: http://localhost:8880"
        echo ""
        echo "🔧 Useful commands:"
        echo "   - View logs: docker logs -f kokoro-tts-cpu"
        echo "   - Stop service: docker stop kokoro-tts-cpu"
        echo "   - Remove container: docker rm kokoro-tts-cpu"
        exit 0
        ;;
    4)
        if [ "$GPU_AVAILABLE" = true ]; then
            echo "🚀 Starting GPU version with docker run..."
            docker run -d --name kokoro-tts-gpu --gpus all -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-gpu:latest
            echo "✅ GPU version started with docker run"
            echo "📋 Container name: kokoro-tts-gpu"
            echo "🌐 Service available at: http://localhost:8880"
            echo ""
            echo "🔧 Useful commands:"
            echo "   - View logs: docker logs -f kokoro-tts-gpu"
            echo "   - Stop service: docker stop kokoro-tts-gpu"
            echo "   - Remove container: docker rm kokoro-tts-gpu"
            exit 0
        else
            echo "❌ GPU not available, falling back to CPU version"
            docker run -d --name kokoro-tts-cpu -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
            echo "✅ CPU version started with docker run"
            exit 0
        fi
        ;;
    *)
        echo "❌ Invalid choice, using CPU version"
        COMPOSE_FILE="docker-compose.yml"
        ;;
esac

# Create models directory if it doesn't exist
if [ ! -d "./models" ]; then
    echo "📁 Creating models directory..."
    mkdir -p ./models
    echo "✅ Models directory created"
else
    echo "✅ Models directory already exists"
fi

# Create cache directory if it doesn't exist
if [ ! -d "./cache" ]; then
    echo "📁 Creating cache directory..."
    mkdir -p ./cache
    echo "✅ Cache directory created"
else
    echo "✅ Cache directory already exists"
fi

echo ""
echo "🚀 Starting Kokoro TTS service..."
echo "   This may take a few minutes on first run as it downloads the model..."

# Start the services
docker-compose -f $COMPOSE_FILE up -d

echo ""
echo "⏳ Waiting for service to be ready..."

# Wait for the service to be ready
timeout=300  # 5 minutes timeout
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if curl -f http://localhost:8880/health &> /dev/null; then
        echo "✅ Kokoro TTS is ready!"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo "   Still waiting... ($elapsed seconds elapsed)"
done

if [ $elapsed -ge $timeout ]; then
    echo "❌ Service didn't start within 5 minutes. Check logs with:"
    echo "   docker-compose -f $COMPOSE_FILE logs kokoro-tts"
    exit 1
fi

echo ""
echo "🎉 Setup complete! Your Kokoro TTS service is running at:"
echo "   http://localhost:8880"
echo ""
echo "📋 Next steps:"
echo "   1. Load the Chrome extension in your browser"
echo "   2. Set the API URL to: http://localhost:8880"
echo "   3. Start reading articles!"
echo ""
echo "🔧 Useful commands:"
echo "   - View logs: docker-compose -f $COMPOSE_FILE logs -f kokoro-tts"
echo "   - Stop service: docker-compose -f $COMPOSE_FILE down"
echo "   - Restart service: docker-compose -f $COMPOSE_FILE restart"
echo "   - Update service: docker-compose -f $COMPOSE_FILE pull && docker-compose -f $COMPOSE_FILE up -d"
echo ""
echo "📖 For more information, see the README.md file" 