#!/bin/sh
set -euo pipefail

log() {
  echo "[$(date -Iseconds)] [restore] $*"
}

cleanup() {
  status=$?
  if [ $status -eq 0 ]; then
    log "Restore completed successfully"
  else
    log "Restore failed with exit code $status"
  fi
}

log "Starting restore script"
trap cleanup EXIT

if [ -z "${POSTGRES_BACKUP_FILE:-}" ]; then
  log "POSTGRES_BACKUP_FILE is not set"
  exit 1
fi

if [ ! -f "${POSTGRES_BACKUP_FILE}" ]; then
  log "Backup file ${POSTGRES_BACKUP_FILE} does not exist"
  exit 1
fi

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  log "POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB must be set"
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

log "Restoring ${POSTGRES_DB} from ${POSTGRES_BACKUP_FILE} on ${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}"
psql \
  --host "${POSTGRES_HOST:-postgres}" \
  --port "${POSTGRES_PORT:-5432}" \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --file "${POSTGRES_BACKUP_FILE}"
