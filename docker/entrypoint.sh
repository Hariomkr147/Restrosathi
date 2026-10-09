#!/bin/sh
set -e

echo "Deploying database migrations..."
# Use the node_modules we copied to /prisma-cli for the migration
node /prisma-cli/node_modules/prisma/build/index.js migrate deploy

echo "Starting Next.js..."
exec node server.js
