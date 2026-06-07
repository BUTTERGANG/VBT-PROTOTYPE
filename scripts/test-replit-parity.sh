#!/usr/bin/env bash
# test-replit-parity.sh — Build + run the Docker container that mirrors Replit
#
# Usage:
#   ./scripts/test-replit-parity.sh              # build + serve on :3001
#   ./scripts/test-replit-parity.sh --check      # build + serve + health check + stop
#   DATABASE_URL=... ./scripts/test-replit-parity.sh  # with Neon DB

set -euo pipefail

IMAGE="vbt-tracker-replit"
CONTAINER="vbt-parity-test"
PORT="${VBT_PORT:-3001}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}▶ Building Docker image (mirrors Replit deployment)...${NC}"
docker build -t "$IMAGE" .

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ BUILD FAILED — this would also fail on Replit${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Build succeeded${NC}"

# Stop any previous test container
docker rm -f "$CONTAINER" 2>/dev/null || true

echo -e "${YELLOW}▶ Starting container on port $PORT...${NC}"
docker run -d \
  --name "$CONTAINER" \
  -p "$PORT:3001" \
  ${DATABASE_URL:+-e DATABASE_URL="$DATABASE_URL"} \
  "$IMAGE"

# Wait for server to be ready
echo -e "${YELLOW}▶ Waiting for server...${NC}"
for i in $(seq 1 15); do
  if curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is up — http://localhost:$PORT${NC}"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo -e "${RED}✗ Server did not start within 15s${NC}"
    docker logs "$CONTAINER"
    docker rm -f "$CONTAINER"
    exit 1
  fi
  sleep 1
done

# PWA index.html check
echo -e "${YELLOW}▶ Checking PWA is served...${NC}"
STATUS=$(curl -sf -o /dev/null -w '%{http_code}' "http://localhost:$PORT/")
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✓ PWA index.html returned 200${NC}"
else
  echo -e "${RED}✗ PWA returned $STATUS (expected 200)${NC}"
fi

# Asset check — verify JS bundle was built
echo -e "${YELLOW}▶ Checking PWA assets exist...${NC}"
ASSETS=$(docker exec "$CONTAINER" ls /app/pwa/dist/assets/ 2>/dev/null | wc -l)
if [ "$ASSETS" -gt 0 ]; then
  echo -e "${GREEN}✓ $ASSETS asset file(s) found in pwa/dist/assets/${NC}"
else
  echo -e "${RED}✗ No assets in pwa/dist/assets/ — PWA build may be broken${NC}"
fi

# If --check flag, run full validation then clean up
if [ "${1:-}" = "--check" ]; then
  echo ""
  echo -e "${YELLOW}▶ Full validation mode — checking PWA preview...${NC}"

  # Check that the HTML references actual JS/CSS files
  HTML=$(curl -sf "http://localhost:$PORT/")
  JS_REF=$(echo "$HTML" | grep -o 'src="[^"]*\.js"' | head -1 || true)
  CSS_REF=$(echo "$HTML" | grep -o 'href="[^"]*\.css"' | head -1 || true)

  if [ -n "$JS_REF" ]; then
    echo -e "${GREEN}✓ HTML references JS bundle: $JS_REF${NC}"
  else
    echo -e "${RED}✗ HTML does not reference any JS bundle${NC}"
  fi

  if [ -n "$CSS_REF" ]; then
    echo -e "${GREEN}✓ HTML references CSS: $CSS_REF${NC}"
  else
    echo -e "${YELLOW}⚠ No CSS reference in HTML (may be inlined or missing)${NC}"
  fi

  echo ""
  echo -e "${YELLOW}▶ Container logs:${NC}"
  docker logs "$CONTAINER"

  echo ""
  echo -e "${YELLOW}▶ Stopping test container...${NC}"
  docker rm -f "$CONTAINER"
  echo -e "${GREEN}✓ Done — container removed${NC}"
else
  echo ""
  echo -e "${GREEN}Container running. Open http://localhost:$PORT in your browser.${NC}"
  echo -e "Run 'docker logs $CONTAINER' to see server output."
  echo -e "Run 'docker rm -f $CONTAINER' to stop."
fi
