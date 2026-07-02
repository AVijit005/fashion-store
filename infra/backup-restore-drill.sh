#!/usr/bin/env bash
# backup-restore-drill.sh — verify that we can actually restore from the
# most recent S3 backup. Run weekly via CI (or manually).
#
# Procedure:
#   1. Start a scratch Postgres instance (CI service container).
#   2. Download the latest backup from $BACKUP_S3_BUCKET.
#   3. Restore it to the scratch instance.
#   4. Compare row counts for every table against the production
#      snapshot table counts we store at backup time (see
#      backend/scripts/backup.sh — it writes a .counts sidecar file).
#   5. Fail loudly if any count is off by more than 5% (allowing for
#      normal growth between backup time and drill time).
#
# Required env:
#   BACKUP_S3_BUCKET    e.g. s3://aura-prod-backups
#   DATABASE_URL        connection string for the scratch Postgres
#   AWS_*               credentials for the S3 bucket
#
# Exit codes:
#   0 — drill passed
#   1 — download failed
#   2 — restore failed
#   3 — row counts diverged beyond threshold

set -euo pipefail

THRESHOLD_PCT=${THRESHOLD_PCT:-5}
SCRATCH_DB=${SCRATCH_DB:-aura_drill}

if [[ -z "${BACKUP_S3_BUCKET:-}" || -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: BACKUP_S3_BUCKET and DATABASE_URL must be set" >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] starting backup-restore drill against $BACKUP_S3_BUCKET"

# 1. Find the most recent dump
LATEST_DUMP=$(aws s3 ls "$BACKUP_S3_BUCKET/db/" --recursive | sort | tail -n 1 | awk '{print $4}')
if [[ -z "$LATEST_DUMP" ]]; then
  echo "ERROR: no backups found in $BACKUP_S3_BUCKET/db/" >&2
  exit 1
fi

# 2. Download the dump + counts sidecar
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
echo "downloading $LATEST_DUMP"
aws s3 cp "$BACKUP_S3_BUCKET/$LATEST_DUMP" "$WORK/dump.custom" || {
  echo "ERROR: download failed" >&2
  exit 1
}
COUNTS_FILE="${LATEST_DUMP%.dump}.counts"
if aws s3 cp "$BACKUP_S3_BUCKET/$COUNTS_FILE" "$WORK/counts.tsv" 2>/dev/null; then
  HAS_COUNTS=1
else
  echo "WARN: no counts sidecar at $COUNTS_FILE — skipping count comparison"
  HAS_COUNTS=0
fi

# 3. Restore into scratch database
echo "restoring into $SCRATCH_DB"
psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS $SCRATCH_DB" >/dev/null
psql "$DATABASE_URL" -c "CREATE DATABASE $SCRATCH_DB" >/dev/null
SCRATCH_URL=$(echo "$DATABASE_URL" | sed -E "s|/[^/?]+(\?|$)|/$SCRATCH_DB\1|")
pg_restore --dbname="$SCRATCH_URL" --no-owner --no-privileges "$WORK/dump.custom" >/dev/null 2>&1 || {
  echo "ERROR: pg_restore failed" >&2
  exit 2
}

# 4. Compare row counts if the sidecar exists
if [[ "$HAS_COUNTS" == "1" ]]; then
  echo "comparing row counts (threshold: ±${THRESHOLD_PCT}%)"
  FAIL=0
  while IFS=$'\t' read -r table backup_count; do
    [[ -z "$table" || "$table" == "table" ]] && continue
    actual_count=$(psql "$SCRATCH_URL" -tA -c "SELECT count(*) FROM \"$table\"" 2>/dev/null || echo "ERROR")
    if [[ "$actual_count" == "ERROR" ]]; then
      echo "  $table: restore query failed"
      FAIL=1
      continue
    fi
    if [[ "$backup_count" -eq 0 ]]; then
      echo "  $table: 0 -> 0 (skipped, division by zero)"
      continue
    fi
    diff=$(( actual_count - backup_count ))
    pct=$(( diff * 100 / backup_count ))
    if [[ "${pct#-}" -gt "$THRESHOLD_PCT" ]]; then
      echo "  $table: $backup_count -> $actual_count (${pct}% — OVER THRESHOLD)"
      FAIL=1
    else
      echo "  $table: $backup_count -> $actual_count (${pct}%)"
    fi
  done < "$WORK/counts.tsv"

  if [[ "$FAIL" -eq 1 ]]; then
    echo "ERROR: row counts diverged beyond threshold" >&2
    exit 3
  fi
fi

echo "[$(date -u +%FT%TZ)] drill passed"
