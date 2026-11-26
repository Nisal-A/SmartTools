# =============================================================================
# SmartTools Backend — Production Dockerfile (Render Docker Web Service)
#
# IMPORTANT: Build with the repository root (`.`) as the Docker Build Context
# and `backend/Dockerfile` as the Dockerfile path so relative imports between
# `backend/` and `shared/` (`../../../../shared/...`) resolve identically.
# =============================================================================

FROM node:20-slim

# Install headless Chromium + standard fonts + dumb-init PID 1 reaper for Puppeteer PDF rendering
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     chromium \
     dumb-init \
     fonts-liberation \
     fonts-noto-core \
     ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    HOME=/tmp \
    NODE_ENV=production

WORKDIR /app

# 1. Install `shared/` production dependencies & copy shared source
COPY shared/package*.json ./shared/
RUN npm --prefix ./shared install --omit=dev
COPY shared/ ./shared/

# 2. Install `backend/` production dependencies (skips 300MB Puppeteer Chromium download)
COPY backend/package*.json ./backend/
RUN npm --prefix ./backend install --omit=dev

# 3. Copy backend application source
COPY backend/ ./backend/

WORKDIR /app/backend

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
