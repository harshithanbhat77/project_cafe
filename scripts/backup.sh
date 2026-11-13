#!/usr/bin/env bash
# Back up the production database and uploaded images to backups/, and delete old backups.
#   backups/cafeflow-<timestamp>.sql.gz          the database
#   backups/cafeflow-uploads-<timestamp>.tar.gz  menu photos and logos
# Run from the repo root on the server:  scripts/backup.sh
# Restore the database:  gunzip -c backups/<file>.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U cafeflow cafeflow
# Restore the images:    docker compose -f docker-compose.prod.yml exec -T api tar -xzf - -C /data < backups/<file>.tar.gz
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
file="backups/cafeflow-$stamp.sql.gz"
uploads="backups/cafeflow-uploads-$stamp.tar.gz"

if ! docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U cafeflow --clean --if-exists cafeflow | gzip > "$file"; then
  rm -f "$file"
  echo "Backup failed" >&2
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" exec -T api tar -czf - -C /data uploads > "$uploads"; then
  rm -f "$uploads"
  echo "Image backup failed" >&2
  exit 1
fi

find backups \( -name 'cafeflow-*.sql.gz' -o -name 'cafeflow-uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "Saved $file and $uploads"
