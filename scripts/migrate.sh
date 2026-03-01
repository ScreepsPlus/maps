#!/usr/bin/env bash
set -euo pipefail

BASE_OLD="https://maps.screepspl.us"
BASE_NEW="${MAPS_BASE_URL:?Need MAPS_BASE_URL env var (e.g. https://<name>.workers.dev)}"
TOKEN="${MAPS_TOKEN:?Need MAPS_TOKEN env var}"

for COLLECTION in maps sectors; do
  echo "=== Migrating $COLLECTION ==="
  IDS="$(curl -s "$BASE_OLD/$COLLECTION/index.json" | jq -r '.[].id')"
  if [ -z "$IDS" ]; then
    echo "No entries found for $COLLECTION, skipping."
    continue
  fi

  while IFS= read -r ID; do
    echo "  Migrating $COLLECTION/$ID..."
    TMP="$(mktemp /tmp/migrate_XXXXXX.json)"
    PREFIX="${COLLECTION%s}"  # maps→map, sectors→sector
    curl -fsS "$BASE_OLD/$COLLECTION/$PREFIX-$ID.json" -o "$TMP"
    curl -fsS -X PUT "$BASE_NEW/api/upload/$COLLECTION/$ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      --data-binary "@$TMP"
    echo ""
    rm -f "$TMP"
  done <<< "$IDS"
done

echo "=== Migration complete ==="
