#!/usr/bin/env bash
# Dump the production database to backups/cafeflow-<timestamp>.sql.gz and delete old dumps.
# Run from the repo root on the server:  scripts/backup.sh
# Restore:  gunzip -c backups/<file>.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U cafeflow cafeflow
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p backups
file="backups/cafeflow-$(date +%Y%m%d-%H%M%S).sql.gz"

if ! docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U cafeflow --clean --if-exists cafeflow | gzip > "$file"; then
  rm -f "$file"
  echo "Backup failed" >&2
  exit 1
fi

find backups -name 'cafeflow-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Saved $file"
