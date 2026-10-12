const pool = require("../db");

const STALE_TIME_SECONDS = 15;
const POLL_INTERVAL_MS = 5000;

async function recoverJobs() {
    const result = await pool.query(
        `UPDATE jobs
         SET status = 'QUEUED',
             started_at = NULL,
             worker_id = NULL,
             last_heartbeat = NULL
         WHERE status = 'RUNNING'
           AND last_heartbeat <
               CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
         RETURNING id`,
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
