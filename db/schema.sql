
CREATE TABLE jobs (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    priority INT NOT NULL DEFAULT 0,

    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    dead_letter_at TIMESTAMP,
    last_heartbeat TIMESTAMP,

    worker_id VARCHAR(100),
    idempotency_key VARCHAR(255) UNIQUE
);

CREATE TABLE processed_jobs (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workers (
    worker_id VARCHAR(100) PRIMARY KEY,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stopped_at TIMESTAMP
);

CREATE TABLE job_events (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT,
    event_type VARCHAR(40) NOT NULL,
    worker_id VARCHAR(100),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    queue_delta INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX job_events_created_at_idx ON job_events (created_at);
CREATE INDEX job_events_worker_id_idx ON job_events (worker_id);

CREATE TABLE metrics_metadata (
    key VARCHAR(100) PRIMARY KEY,
    value TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
