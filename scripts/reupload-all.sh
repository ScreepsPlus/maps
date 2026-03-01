#!/usr/bin/env bash
# Re-upload all local blob files with gzip compression to reduce R2 storage.
# Replaces any previously uncompressed versions.
set -euo pipefail

BASE_NEW="${MAPS_BASE_URL:?Need MAPS_BASE_URL env var}"
TOKEN="${MAPS_TOKEN:?Need MAPS_TOKEN env var}"
BLOB_DIR="${1:-.data/blob}"

for COLLECTION in maps sectors; do
  DIR="$BLOB_DIR/$COLLECTION"
  if [ ! -d "$DIR" ]; then
    echo "=== $COLLECTION: directory $DIR not found, skipping ==="
    continue
  fi

  echo "=== Reuploading $COLLECTION ==="

  for FILE in "$DIR"/*.json; do
    [ -f "$FILE" ] || continue
    # Skip NuxtHub local filesystem metadata files
    [[ "$FILE" == *'.$meta.json' ]] && continue
    FILENAME="$(basename "$FILE" .json)"
    echo -n "  $COLLECTION/$FILENAME... "
    gzip -c "$FILE" | curl -fsS -X PUT \
      "$BASE_NEW/api/upload/$COLLECTION/$FILENAME" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -H "Content-Encoding: gzip" \
      --data-binary @-
    echo "ok"
  done
done

echo "=== Reupload complete ==="
