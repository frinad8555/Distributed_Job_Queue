const pool = require("../db");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processJob() {
    try {
        const result = await pool.query(
            `SELECT *
             FROM jobs
             WHERE status = 'QUEUED'
             ORDER BY priority DESC, created_at
             LIMIT 1`
        );

        if (result.rows.length === 0) {
            return false;
        }

        const job = result.rows[0];
        console.log(`Worker ${process.pid} selected job ${job.id}`);
        await sleep(2000);

        await pool.query(
            `UPDATE jobs
             SET status = 'RUNNING',
                 started_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [job.id]
        );

        console.log(`Job ${job.id} is RUNNING`);
        console.log(`Processing job ${job.id}...`);

        await sleep(3000);

        await pool.query(
            `UPDATE jobs
             SET status = 'COMPLETED',
                 completed_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [job.id]
        );

        console.log(`Job ${job.id} COMPLETED`);

        return true;

    } catch (error) {
        console.error("Worker error:", error.message);
        return false;
    }
}

async function startWorker() {
    console.log("Worker started");
    let queueEmpty = false;

    while (true) {
        const processed = await processJob();

        if (!processed) {
            if (!queueEmpty) {
                console.log("All queued jobs have been processed. Waiting for new jobs...");
                queueEmpty = true;
            }
            await sleep(2000);
        } else {
            queueEmpty = false;
        }
    }
}

startWorker();