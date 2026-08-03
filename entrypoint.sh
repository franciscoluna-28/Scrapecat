#!/bin/sh
set -e

echo "Running database migrations..."
pnpm run db:migrate

echo "Starting application..."
exec "$@"
