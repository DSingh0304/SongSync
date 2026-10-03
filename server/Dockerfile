FROM node:20-alpine

WORKDIR /app

# Install Python (required by yt-dlp) and FFmpeg
RUN apk add --no-cache python3 ffmpeg wget

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output and yt-dlp binary
COPY dist/ ./dist/
COPY yt-dlp ./

# Ensure yt-dlp is executable
RUN chmod +x ./yt-dlp

# Expose port
EXPOSE 3000

# Health check for Render
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
