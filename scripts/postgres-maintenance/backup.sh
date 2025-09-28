#!/bin/sh
set -euo pipefail

if [ -z "${POSTGRES_BACKUP_FILE:-}" ]; then
  echo "POSTGRES_BACKUP_FILE is not set" >&2
  exit 1
fi

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  echo "POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB must be set" >&2
  exit 1
fi

BACKUP_DIR="$(dirname "${POSTGRES_BACKUP_FILE}")"
mkdir -p "${BACKUP_DIR}"
TEMP_FILE="${POSTGRES_BACKUP_FILE}.tmp"

export PGPASSWORD="${POSTGRES_PASSWORD}"

pg_dump \
  --clean \
  --if-exists \
  --no-owner \
  --host "${POSTGRES_HOST:-postgres}" \
  --port "${POSTGRES_PORT:-5432}" \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --file "${TEMP_FILE}"

mv "${TEMP_FILE}" "${POSTGRES_BACKUP_FILE}"

echo "[$(date -Iseconds)] Backup written to ${POSTGRES_BACKUP_FILE}"
