#!/bin/sh
set -e

mkdir -p \
  "${SUPERPRINT_DATA_ROOT:-/data}/uploads" \
  "${SUPERPRINT_DATA_ROOT:-/data}/sliced" \
  "${SUPERPRINT_DATA_ROOT:-/data}/videos" \
  "${SUPERPRINT_DATA_ROOT:-/data}/timelapses" \
  "${SUPERPRINT_DATA_ROOT:-/data}/thumbnails" \
  "${SUPERPRINT_DATA_ROOT:-/data}/logs" \
  "${SUPERPRINT_DATA_ROOT:-/data}/backup-staging"

npm run db:deploy
npm run start
