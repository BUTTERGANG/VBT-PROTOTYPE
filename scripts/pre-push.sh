#!/bin/env bash
# Pre-push check — lightweight local validation (no Docker required)
# Catches the most common breakages before they hit GitHub/Replit
#
# Install: ln -sf ../../scripts/pre-push.sh .git/hooks/pre-push

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

echo -e "${YELLOW}▶ Pre-push: checking Replit parity...${NC}"

# --- Backend typecheck ---
echo -e "${YELLOW}  backend: tsc -b --noEmit${NC}"
if (cd backend && npx tsc -b --noEmit 2>&1); then
  echo -e "${GREEN}  ✓ backend typecheck${NC}"
else
  echo -e "${RED}  ✗ backend typecheck failed${NC}"
  ERRORS=$((ERRORS + 1))
fi

# --- PWA typecheck ---
echo -e "${YELLOW}  pwa: tsc -b --noEmit${NC}"
if (cd pwa && npx tsc -b --noEmit 2>&1); then
  echo -e "${GREEN}  ✓ pwa typecheck${NC}"
else
  echo -e "${RED}  ✗ pwa typecheck failed${NC}"
  ERRORS=$((ERRORS + 1))
fi

# --- PWA production build ---
echo -e "${YELLOW}  pwa: vite build (production)${NC}"
if (cd pwa && npx vite build 2>&1); then
  echo -e "${GREEN}  ✓ pwa build${NC}"
else
  echo -e "${RED}  ✗ pwa build failed${NC}"
  ERRORS=$((ERRORS + 1))
fi

# --- Validate PWA output ---
if [ -f pwa/dist/index.html ]; then
  if grep -q 'src=' pwa/dist/index.html; then
    echo -e "${GREEN}  ✓ pwa/dist/index.html references JS bundles${NC}"
  else
    echo -e "${RED}  ✗ pwa/dist/index.html has no JS references${NC}"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${RED}  ✗ pwa/dist/index.html not found${NC}"
  ERRORS=$((ERRORS + 1))
fi

ASSETS=$(ls pwa/dist/assets/ 2>/dev/null | wc -l)
if [ "$ASSETS" -gt 0 ]; then
  echo -e "${GREEN}  ✓ $ASSETS asset file(s) in pwa/dist/assets/${NC}"
else
  echo -e "${RED}  ✗ no assets in pwa/dist/assets/${NC}"
  ERRORS=$((ERRORS + 1))
fi

# --- Summary ---
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed — safe to push${NC}"
  exit 0
else
  echo -e "${RED}✗ $ERRORS check(s) failed — fix before pushing${NC}"
  echo -e "${YELLOW}Push anyway? This will likely break on Replit. [y/N]${NC}"
  read -r CONFIRM
  if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
    echo "Pushing with known failures..."
    exit 0
  fi
  exit 1
fi
