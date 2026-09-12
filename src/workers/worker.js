const pool = require("../db");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function giveHeartbeat(jobID) {
    try {
        await pool.query(
            `UPDATE jobs
             SET last_heartbeat = CURRENT_TIMESTAMP
             WHERE id = $1
             AND status = 'RUNNING'`,
            [jobID]
        );
    }
    catch (error) {
        console.error(`Heartbeat failed for job: ${jobID}: `, error.message);
    }
}

async function processJob() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT *
             FROM jobs
             WHERE status = 'QUEUED'
             ORDER BY priority DESC, created_at
             FOR UPDATE SKIP LOCKED
             LIMIT 1`
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            return false;
        }

        const job = result.rows[0];

        await client.query(
            `UPDATE jobs
             SET status = 'RUNNING',
                 started_at = CURRENT_TIMESTAMP,
                 last_heartbeat = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [job.id]
        );

        await client.query("COMMIT");

        console.log(`Worker ${process.pid} picked job ${job.id}`);
        console.log(`Processing job ${job.id}...`);

        const heartbeat = setInterval(() => {
            giveHeartbeat(job.id);
        }, 5000);

        await sleep(20000);

        await client.query(
            `UPDATE jobs
             SET status = 'COMPLETED',
                 completed_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [job.id]
        );
        
        clearInterval(heartbeat);
        console.log(`Job ${job.id} COMPLETED`);

        return true;

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Worker error:", error.message);
        return false;

    } finally {
        client.release();
    }
}

async function startWorker() {
    console.log(`Worker ${process.pid} started`);

    let queueEmpty = false;

    while (true) {
        const processed = await processJob();

        if (!processed) {
            if (!queueEmpty) {
                console.log(
                    "All queued jobs have been processed. Waiting for new jobs..."
                );
                queueEmpty = true;
            }

            await sleep(2000);
        } else {
            queueEmpty = false;
        }
    }
}

startWorker();