# ── NEXUS Devcontainer ──
# Dev-focused variant: keeps source code, installs all tools, runs dev server.
FROM node:22-alpine

WORKDIR /app

# Install system dependencies for Playwright and common dev tools
RUN apk add --no-cache \
  git \
  curl \
  bash \
  chromium \
  nss \
  freetype \
  freetype-dev \
  harfbuzz \
  ca-certificates \
  libx11-dev \
  libxcomposite-dev \
  libxdamage-dev \
  libxext-dev \
  libxfixes-dev \
  libxrandr-dev \
  libxrender-dev \
  libxtst-dev \
  libc6-compat

# Install Playwright system deps
RUN npx playwright install-deps chromium

# Copy package files and install all deps (including devDependencies, husky hooks)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source code (will be overridden by volume mount in dev)
COPY . .

# Expose dev server port
EXPOSE 3000

# Default command: start dev server with Turbopack
CMD ["npm", "run", "dev"]
