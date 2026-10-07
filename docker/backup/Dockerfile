FROM node:22-alpine

# Install postgres client (pg_dump, pg_restore) and tar
RUN apk add --no-cache postgresql-client tar gzip

WORKDIR /app

# In a real environment, we'd copy built output and node_modules
# For local dev/testing, we'll run via tsx.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Run the cron loop or one-off
CMD ["npx", "tsx", "scripts/backup/run.ts"]
