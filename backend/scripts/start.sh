#!/bin/sh
set -e

echo "Generating Prisma Client..."
npx prisma generate

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting Room API..."
exec npm run dev
