#!/bin/sh
set -euo pipefail

log() {
  echo "[$(date -Iseconds)] [backup] $*"
}

cleanup() {
  status=$?
  if [ $status -eq 0 ]; then
    log "Backup completed successfully"
  else
    log "Backup failed with exit code $status"
  fi
}

log "Starting backup script"
trap cleanup EXIT

if [ -z "${POSTGRES_BACKUP_FILE:-}" ]; then
  log "POSTGRES_BACKUP_FILE is not set"
  exit 1
fi

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  log "POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB must be set"
  exit 1
fi

BACKUP_DIR="$(dirname "${POSTGRES_BACKUP_FILE}")"
log "Ensuring backup directory ${BACKUP_DIR} exists"
mkdir -p "${BACKUP_DIR}"
TEMP_FILE="${POSTGRES_BACKUP_FILE}.tmp"

export PGPASSWORD="${POSTGRES_PASSWORD}"

log "Running pg_dump for ${POSTGRES_DB} on ${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}"
pg_dump \
  --clean \
  --if-exists \
  --no-owner \
  --host "${POSTGRES_HOST:-postgres}" \
  --port "${POSTGRES_PORT:-5432}" \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --file "${TEMP_FILE}"

log "Moving temporary backup to ${POSTGRES_BACKUP_FILE}"
mv "${TEMP_FILE}" "${POSTGRES_BACKUP_FILE}"

log "Backup written to ${POSTGRES_BACKUP_FILE}"
