# Mirrors Replit's Nix stable-24_05 / nodejs_20 environment
# Build + serve sequence matches .replit [deployment] exactly

FROM node:20-bookworm AS builder

WORKDIR /app

# --- Backend build ---
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install
COPY backend/ ./
RUN npm run build

# --- PWA build ---
WORKDIR /app
COPY pwa/package.json pwa/package-lock.json* ./pwa/
WORKDIR /app/pwa
RUN npm install
COPY pwa/ ./
RUN npm run build

# --- Production image ---
FROM node:20-bookworm-slim

WORKDIR /app

# Copy built backend + installed prod deps
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/package.json

# Copy built PWA (static assets only)
COPY --from=builder /app/pwa/dist ./pwa/dist

# Replit maps localPort 3001 → externalPort 80
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

# Matches .replit [deployment] run command exactly:
# "cd backend && NODE_ENV=production npm run start"
CMD ["node", "backend/dist/index.js"]
