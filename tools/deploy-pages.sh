#!/usr/bin/env bash
# Builds the game and publishes dist/ to the gh-pages branch (GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."
npx vite build
tmp=$(mktemp -d)
cp -r dist/* "$tmp/" && touch "$tmp/.nojekyll"
cd "$tmp"
git init -q -b gh-pages && git add -A
git -c user.email=noreply@anthropic.com -c user.name=Claude commit -qm "Deploy game build to GitHub Pages"
git push -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
echo "Deployed: https://lhc6835-hue.github.io/Glacion-kingdom/"
