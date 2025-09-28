FROM alpine:3.20

RUN apk add --no-cache bash postgresql16-client tzdata

COPY backup.sh /usr/local/bin/backup.sh
COPY restore.sh /usr/local/bin/restore.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh \
    && mkdir -p /var/log && touch /var/log/cron.log

ENV POSTGRES_HOST=postgres \
    POSTGRES_PORT=5432

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["cron"]
