const pool = require('../db');
const STALETIME = 15;

async function recoverJobs() {
    try {
        const result = await pool.query(
            `UPDATE jobs
             SET status = 'QUEUED',
                 started_at = NULL
             WHERE status = 'RUNNING'
             AND last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '${STALETIME} seconds'
             RETURNING id`
        );

        if(result.rows.length > 0) {
            for (const job of result.rows) {
                console.log(`Recovered stale job ${job.id}`);
            }
        }
    }
    catch(error) {
        console.error('Error in recovering a job: ', error.message);
    }
}

async function startRecovery() {
    console.log('Recovery Process Started');

    while(true) {
        await recoverJobs();
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

startRecovery();