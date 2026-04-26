#!/usr/bin/env bash
set -euo pipefail

echo "Running tests..."
npm run test:run

echo "Building app..."
npm run build

echo "Checking git status..."
git status --short

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Committing changes..."
  git add .
  git commit -m "${1:-Update app}"
else
  echo "No changes to commit."
fi

echo "Pushing to GitHub..."
git push

echo "Done."