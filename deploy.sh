#!/bin/bash
# Ships whatever's currently changed to the live site.
# Usage: ./deploy.sh "short description of what changed"
set -e

MSG="${1:-Update}"

git add -A
git commit -m "$MSG" || echo "(nothing new to commit — pushing anyway in case of unpushed commits)"
git push

echo ""
echo "Pushed. Vercel will pick this up automatically — check progress at:"
echo "https://vercel.com/dashboard"
