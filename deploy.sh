#!/usr/bin/env bash
# Redeploy: copy the project (including .env) to the server and rebuild the container.
# Reads DEPLOY_HOST and DEPLOY_DIR from .env.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Missing .env - copy .env.example to .env and edit it." >&2; exit 1; }
set -a; . ./.env; set +a
: "${DEPLOY_HOST:?set DEPLOY_HOST in .env}"
DEPLOY_DIR=${DEPLOY_DIR:-slideshow}

if command -v rsync >/dev/null; then
  rsync -a --delete --exclude .git ./ "$DEPLOY_HOST:$DEPLOY_DIR/"
else
  # No rsync (e.g. Git Bash on Windows): replace the remote copy with a tarball.
  tar -czf - --exclude .git . |
    ssh "$DEPLOY_HOST" "mkdir -p $DEPLOY_DIR && cd $DEPLOY_DIR && find . -mindepth 1 -delete && tar -xzf -"
fi
# stdin closed (-n, </dev/null): some hosts hang on docker over ssh otherwise.
ssh -n "$DEPLOY_HOST" "cd $DEPLOY_DIR && docker compose up -d --build </dev/null"
