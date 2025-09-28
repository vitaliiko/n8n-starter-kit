#!/bin/sh
set -euo pipefail

if [ -z "${POSTGRES_BACKUP_FILE:-}" ]; then
  echo "POSTGRES_BACKUP_FILE is not set" >&2
  exit 1
fi

if [ ! -f "${POSTGRES_BACKUP_FILE}" ]; then
  echo "Backup file ${POSTGRES_BACKUP_FILE} does not exist" >&2
  exit 1
fi

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  echo "POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB must be set" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

psql \
  --host "${POSTGRES_HOST:-postgres}" \
  --port "${POSTGRES_PORT:-5432}" \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --file "${POSTGRES_BACKUP_FILE}"

echo "[$(date -Iseconds)] Restore completed from ${POSTGRES_BACKUP_FILE}"
