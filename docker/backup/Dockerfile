FROM postgres:17-alpine

# Install nodejs, npm, and tar
RUN apk add --no-cache nodejs npm tar gzip

WORKDIR /app

# In a real environment, we'd copy built output and node_modules
# For local dev/testing, we'll run via tsx.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --omit=optional --force

COPY . .

# Run the cron loop or one-off
CMD ["npx", "tsx", "scripts/backup/run.ts"]
