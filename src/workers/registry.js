const pool = require("../db");
const { ensureMetricsSchema } = require("../metrics/events");
let registryReady;

async function ensureWorkerRegistry() {
    if (!registryReady) {
        registryReady = pool.query(
            `CREATE TABLE IF NOT EXISTS workers (
                worker_id VARCHAR(100) PRIMARY KEY,
                started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                stopped_at TIMESTAMP
            )`
        ).catch((error) => {
            registryReady = null;
            throw error;
        });
    }
    await registryReady;
}

async function registerWorker(workerId) {
    await ensureMetricsSchema();
    await ensureWorkerRegistry();
    await pool.query(
        `INSERT INTO workers (worker_id, started_at, last_heartbeat, stopped_at)
         VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
         ON CONFLICT (worker_id) DO UPDATE
         SET started_at = CURRENT_TIMESTAMP,
             last_heartbeat = CURRENT_TIMESTAMP,
             stopped_at = NULL`,
        [workerId]
    );
    await pool.query(
        `INSERT INTO job_events (event_type, worker_id, details)
         VALUES ('worker_started', $1, '{}'::jsonb)`,
        [workerId]
    );
}

async function heartbeatWorker(workerId) {
    const result = await pool.query(
        `UPDATE workers
         SET last_heartbeat = CURRENT_TIMESTAMP
         WHERE worker_id = $1 AND stopped_at IS NULL`,
        [workerId]
    );

    if (result.rowCount) {
        await pool.query(
            `INSERT INTO job_events (event_type, worker_id, details)
             SELECT 'worker_heartbeat', $1, '{}'::jsonb
             WHERE NOT EXISTS (
                 SELECT 1 FROM job_events
                 WHERE worker_id = $1
                   AND event_type = 'worker_heartbeat'
                   AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
             )`,
            [workerId]
        );
    }
}

async function stopWorker(workerId) {
    const result = await pool.query(
        `UPDATE workers
         SET stopped_at = CURRENT_TIMESTAMP,
             last_heartbeat = CURRENT_TIMESTAMP
         WHERE worker_id = $1`,
        [workerId]
    );

    if (result.rowCount) {
        await pool.query(
            `INSERT INTO job_events (event_type, worker_id, details)
             VALUES ('worker_stopped', $1, '{}'::jsonb)`,
            [workerId]
        );
    }
}

module.exports = { ensureWorkerRegistry, registerWorker, heartbeatWorker, stopWorker };
