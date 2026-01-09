CREATE TABLE IF NOT EXISTS public_ip_history
(
    id         BIGSERIAL PRIMARY KEY,
    ip         VARCHAR(15) NOT NULL,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);
