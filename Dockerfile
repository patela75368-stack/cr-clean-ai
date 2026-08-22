FROM node:20-bookworm-slim

# Install FFmpeg
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application
COPY . .

# Render provides PORT automatically
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
