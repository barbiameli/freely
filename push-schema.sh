#!/bin/bash
# Pushes prisma/schema.prisma changes to the LIVE (Neon) database.
# Only needed when you've actually edited prisma/schema.prisma — most
# changes don't touch the schema and don't need this at all.
set -e

if [ ! -f .env.production.local ]; then
  echo "Missing .env.production.local — create it once with a single line:"
  echo 'DATABASE_URL="your-neon-connection-string"'
  exit 1
fi

set -a
source .env.production.local
set +a

npx prisma db push
echo "Live database schema updated."
