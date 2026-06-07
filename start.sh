#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Start autoregulation service in background (deps provided by replit.nix)
echo "Starting autoregulate service..."
cd "$ROOT/autoregulate"
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Build PWA (clean install ensures native bindings match current Node version)
echo "Building PWA..."
cd "$ROOT/pwa"
rm -rf node_modules package-lock.json
npm install --silent
npm run build

# Start backend (serves built PWA + API on port 3001)
echo "Starting backend..."
cd "$ROOT/backend"
npm install --silent
NODE_ENV=production npm run dev
