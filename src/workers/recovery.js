const pool = require("../db");
const { ensureMetricsSchema } = require("../metrics/events");

const STALE_TIME_SECONDS = 15;
const POLL_INTERVAL_MS = 5000;

async function recoverJobs() {
    await ensureMetricsSchema();
    const result = await pool.query(
        `WITH recovered_jobs AS (
            UPDATE jobs
            SET status = 'QUEUED',
                started_at = NULL,
                worker_id = NULL,
                last_heartbeat = NULL
            WHERE status = 'RUNNING'
              AND last_heartbeat < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
            RETURNING id
         ), logged_events AS (
            INSERT INTO job_events (job_id, event_type, details, queue_delta)
            SELECT id, 'recovered', JSON_BUILD_OBJECT('source', 'heartbeat timeout'), 1 FROM recovered_jobs
            RETURNING job_id
         )
         SELECT id FROM recovered_jobs`,
        [STALE_TIME_SECONDS]
    );

    for (const job of result.rows) {
        console.log(`Recovered stale job ${job.id}`);
    }

    return result.rows;
}

async function startRecovery() {
    console.log("Recovery Process Started");

    while (true) {
        try {
            await recoverJobs();
        } catch (error) {
            console.error("Error recovering jobs:", error.message);
        }

        await new Promise(resolve =>
            setTimeout(resolve, POLL_INTERVAL_MS)
        );
    }
}

module.exports = { recoverJobs, startRecovery };

if (require.main === module) {
    startRecovery().catch(error => {
        console.error("Recovery process terminated:", error);
        process.exitCode = 1;
    });
}
