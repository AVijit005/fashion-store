#!/usr/bin/env bash
# backup.sh — Daily Postgres dump, upload to S3, prune old backups.
#
# Intended to run inside the `backup` service in docker-compose.yml. Sends
# output to a custom-format pg_dump file, then streams it to S3 (so we
# don't need local disk space).
#
# Required env vars:
#   DATABASE_URL              — postgres connection string
#   AWS_ACCESS_KEY_ID         — S3 credentials
#   AWS_SECRET_ACCESS_KEY
#   AWS_REGION
#   BACKUP_S3_BUCKET          — e.g. s3://aura-prod-backups
# Optional:
#   BACKUP_RETENTION_DAYS     — default 30
#
# Restore procedure (manual):
#   aws s3 cp $BACKUP_S3_BUCKET/db/20260701_020000.dump /tmp/restore.dump
#   createdb -h $PGHOST -U $PGUSER aura_db_restore
#   pg_restore -h $PGHOST -U $PGUSER -d aura_db_restore --no-owner /tmp/restore.dump

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi
if [[ -z "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "ERROR: BACKUP_S3_BUCKET is not set" >&2
  exit 1
fi

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
DUMP_FILE="/tmp/aura-${TIMESTAMP}.dump"

echo "[$(date -u +%FT%TZ)] starting backup to ${BACKUP_S3_BUCKET}/db/${TIMESTAMP}.dump"

# Custom format = compressed, parallel-restore capable, schema-aware.
pg_dump \
  --no-owner \
  --no-privileges \
  --format=custom \
  --compress=6 \
  --file="${DUMP_FILE}" \
  "${DATABASE_URL}"

# Verify the dump is non-empty
DUMP_SIZE=$(stat -c%s "${DUMP_FILE}" 2>/dev/null || echo 0)
if [[ "${DUMP_SIZE}" -lt 1024 ]]; then
  echo "ERROR: dump file is suspiciously small (${DUMP_SIZE} bytes) — aborting upload" >&2
  exit 2
fi

# Stream to S3
aws s3 cp "${DUMP_FILE}" "${BACKUP_S3_BUCKET}/db/${TIMESTAMP}.dump"

echo "[$(date -u +%FT%TZ)] uploaded ${DUMP_FILE} (${DUMP_SIZE} bytes)"

# Retention: delete dumps older than $RETENTION_DAYS days
CUTOFF_DATE=$(date -u -d "${RETENTION_DAYS} days ago" +%Y%m%d 2>/dev/null || \
              date -u -v -${RETENTION_DAYS}d +%Y%m%d)
echo "[$(date -u +%FT%TZ)] pruning dumps older than ${CUTOFF_DATE}"

aws s3 ls "${BACKUP_S3_BUCKET}/db/" --recursive | while read -r line; do
  file_date=$(echo "$line" | awk '{print $4}' | grep -oE '[0-9]{8}' || true)
  if [[ -n "${file_date}" && "${file_date}" < "${CUTOFF_DATE}" ]]; then
    echo "  deleting ${file_date}*"
    aws s3 rm "${BACKUP_S3_BUCKET}/db/${file_date}"* --recursive --quiet || true
  fi
done

# Clean up local temp
rm -f "${DUMP_FILE}"

echo "[$(date -u +%FT%TZ)] backup complete"
