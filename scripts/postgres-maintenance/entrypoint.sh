#!/bin/sh
set -euo pipefail

log() {
  echo "[$(date -Iseconds)] [entrypoint] $*"
}

COMMAND="${1:-cron}"
log "Container started with command: ${COMMAND}"

case "${COMMAND}" in
  cron)
    log "Configuring cron backup schedule"
    if [ -z "${POSTGRES_BACKUP_CRON:-}" ]; then
      log "POSTGRES_BACKUP_CRON is not set"
      exit 1
    fi
    if [ -z "${POSTGRES_BACKUP_FILE:-}" ]; then
      log "POSTGRES_BACKUP_FILE is not set"
      exit 1
    fi

    log "Writing cron entry '${POSTGRES_BACKUP_CRON}'"
    echo "${POSTGRES_BACKUP_CRON} /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
    log "Starting crond in foreground"
    exec crond -f -l 2
    ;;
  backup)
    shift 1 || true
    log "Running one-off backup"
    exec /usr/local/bin/backup.sh "$@"
    ;;
  restore)
    shift 1 || true
    log "Running restore"
    exec /usr/local/bin/restore.sh "$@"
    ;;
  *)
    log "Executing custom command: $*"
    exec "$@"
    ;;
esac

