# Use official Node base image (Debian-based for apt support)
FROM node:20-bullseye

# Install Python and Java
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    openjdk-17-jre-headless \
    openjdk-17-jdk-headless \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source code
COPY backend .

RUN mkdir -p /app/temp && chmod 755 /app/temp

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000
ENV EXECUTION_TIMEOUT=5000
ENV MEMORY_LIMIT=128m
ENV MAX_OUTPUT_SIZE=10000
ENV TEMP_DIR=/app/temp

CMD ["node", "src/server.js"]
