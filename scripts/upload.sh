#!/usr/bin/env bash
set -euo pipefail

COLLECTION="${1:?Usage: upload.sh <collection> <file.json>}"
FILE="${2:?Usage: upload.sh <collection> <file.json>}"
TOKEN="${MAPS_TOKEN:?Need MAPS_TOKEN env var}"
BASE_URL="${MAPS_BASE_URL:-https://maps.screepspl.us}"
ID="$(basename "$FILE" .json)"

curl -fsS -X PUT "$BASE_URL/api/upload/$COLLECTION/$ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$FILE" | jq .
