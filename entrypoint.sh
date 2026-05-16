#!/bin/sh
set -e

echo "Running database migrations..."
pnpm run db:push

echo "Starting application..."
exec "$@"
