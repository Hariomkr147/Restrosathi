#!/bin/sh
set -e

echo "Deploying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Starting Next.js..."
exec node server.js
