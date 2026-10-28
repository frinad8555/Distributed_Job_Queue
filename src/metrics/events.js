const pool = require("../db");

let schemaReady;

async function ensureMetricsSchema() {
    if (!schemaReady) {
        schemaReady = (async () => {
            await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMP");
            await pool.query(
                `CREATE TABLE IF NOT EXISTS job_events (
                    id BIGSERIAL PRIMARY KEY,
                    job_id BIGINT NOT NULL,
                    event_type VARCHAR(40) NOT NULL,
                    queue_delta INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )`
            );
            await pool.query("CREATE INDEX IF NOT EXISTS job_events_created_at_idx ON job_events (created_at)");
            await pool.query(
                `CREATE TABLE IF NOT EXISTS metrics_metadata (
                    key VARCHAR(100) PRIMARY KEY,
                    value TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )`
            );
            const baseline = await pool.query(
                `INSERT INTO metrics_metadata (key)
                 VALUES ('queue_depth_baseline')
                 ON CONFLICT (key) DO NOTHING
                 RETURNING value`
            );
            if (baseline.rowCount) {
                await pool.query(
                    `INSERT INTO job_events (job_id, event_type, queue_delta, created_at)
                     SELECT 0, 'baseline', COUNT(*) FILTER (WHERE status = 'QUEUED')::int, $1
                     FROM jobs`,
                    [baseline.rows[0].value]
                );
            }
        })().catch((error) => {
            schemaReady = null;
            throw error;
        });
    }
    await schemaReady;
}

module.exports = { ensureMetricsSchema };
