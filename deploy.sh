#!/usr/bin/env bash
# Redeploy: copy the project (including .env) to the server and rebuild the container.
# Reads DEPLOY_HOST and DEPLOY_DIR from .env.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Missing .env - copy .env.example to .env and edit it." >&2; exit 1; }
set -a; . ./.env; set +a
: "${DEPLOY_HOST:?set DEPLOY_HOST in .env}"
DEPLOY_DIR=${DEPLOY_DIR:-slideshow}

rsync -a --delete --exclude .git --exclude photos ./ "$DEPLOY_HOST:$DEPLOY_DIR/"
# stdin closed (-n, </dev/null): some hosts hang on docker over ssh otherwise.
ssh -n "$DEPLOY_HOST" "cd $DEPLOY_DIR && docker compose up -d --build </dev/null"
