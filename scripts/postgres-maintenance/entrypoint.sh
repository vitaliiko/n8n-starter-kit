#!/bin/sh
set -euo pipefail

COMMAND="${1:-cron}"

case "${COMMAND}" in
  cron)
    if [ -z "${POSTGRES_BACKUP_CRON:-}" ]; then
      echo "POSTGRES_BACKUP_CRON is not set" >&2
      exit 1
    fi
    if [ -z "${POSTGRES_BACKUP_FILE:-}" ]; then
      echo "POSTGRES_BACKUP_FILE is not set" >&2
      exit 1
    fi

    echo "${POSTGRES_BACKUP_CRON} /usr/local/bin/backup.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root
    echo "[$(date -Iseconds)] Cron schedule '${POSTGRES_BACKUP_CRON}' configured" >> /var/log/cron.log
    exec crond -f -l 2
    ;;
  backup)
    shift 1 || true
    exec /usr/local/bin/backup.sh "$@"
    ;;
  restore)
    shift 1 || true
    exec /usr/local/bin/restore.sh "$@"
    ;;
  *)
    exec "$@"
    ;;
esac

