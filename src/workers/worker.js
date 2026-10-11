const pool = require("../db");
const workerId = `worker-${process.pid}`;

let isShuttingDown = false;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function giveHeartbeat(jobID) {
    try {
        const result = await pool.query(
            `UPDATE jobs
             SET last_heartbeat = CURRENT_TIMESTAMP
             WHERE id = $1
               AND status = 'RUNNING'
               AND worker_id = $2`,
            [jobID, workerId]
        );

        if (result.rowCount === 0) {
            console.log(`Worker ${workerId} no longer owns job ${jobID}`);
        }
    } catch (error) {
        console.error(`Heartbeat failed for job ${jobID}:`, error.message);
    }
}

async function processJob() {
    const client = await pool.connect();
    let job = null;
    let heartbeat = null;

    try {
        if (isShuttingDown) {
            return false;
        }

        await client.query("BEGIN");

        const result = await client.query(
            `SELECT *
            FROM jobs
            WHERE status = 'QUEUED'
              AND (
                    next_retry_at IS NULL
                    OR next_retry_at <= CURRENT_TIMESTAMP
                  )
            ORDER BY priority DESC, created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1;`
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            return false;
        }

        if (isShuttingDown) {
            await client.query("ROLLBACK");
            return false;
        }
        
        job = result.rows[0];

        await client.query(
            `UPDATE jobs
             SET status = 'RUNNING',
                 worker_id = $2,
                 started_at = CURRENT_TIMESTAMP,
                 last_heartbeat = CURRENT_TIMESTAMP,
                 next_retry_at = NULL
             WHERE id = $1`,
            [job.id, workerId]
        );

        if (isShuttingDown) {
            await client.query("ROLLBACK");
            return false;
        }

        await client.query("COMMIT");

        heartbeat = setInterval(() => {
            giveHeartbeat(job.id);
        }, 5000);

        console.log(`Worker ${process.pid} picked job ${job.id}`);
        console.log(`Processing job ${job.id}...`);
        
        const processedResult = await pool.query(
            `INSERT INTO processed_jobs (idempotency_key)
             VALUES ($1)
             ON CONFLICT (idempotency_key) DO NOTHING
             RETURNING idempotency_key`,
            [job.idempotency_key]
        );

        if (processedResult.rows.length === 0) {
            console.log(`SIDE EFFECT SKIPPED: Job ${job.id} was already processed.`);
        } else {
            console.log(`SIDE EFFECT: Executing job ${job.id}`);
        }

        await sleep(3000);

        const completion = await pool.query(
            `UPDATE jobs
            SET status = 'COMPLETED',
                completed_at = CURRENT_TIMESTAMP,
                worker_id = NULL,
                last_heartbeat = NULL
            WHERE id = $1
            AND status = 'RUNNING'
            AND worker_id = $2`,
            [job.id, workerId]
        );

        if (completion.rowCount === 0) {
            console.log(
                `Worker ${workerId} lost ownership of job ${job.id}; completion skipped.`
            );
            return false;
        }

        console.log(`Job ${job.id} COMPLETED`);
        return true;
    } catch (error) {
        await client.query("ROLLBACK");

        console.error(`Job ${job.id} has failed: `, error.message);

        if (job) {
            const retryCount = job.retry_count + 1;

            if (retryCount <= job.max_retries) {
                const delayTime = Math.pow(2, retryCount);

                const result = await pool.query(
                    `UPDATE jobs
             SET status = 'QUEUED',
                 retry_count = $3,
                 next_retry_at =
                     CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second'),
                 worker_id = NULL,
                 last_heartbeat = NULL,
                 started_at = NULL
             WHERE id = $1
               AND status = 'RUNNING'
               AND worker_id = $2`,
                    [job.id, workerId, retryCount, delayTime]
                );

                if (result.rowCount > 0) {
                    console.log(
                        `Retry ${retryCount}/${job.max_retries} scheduled in ${delayTime} seconds.`
                    );
                } else {
                    console.log(
                        `Worker ${workerId} no longer owns job ${job.id}; failure update skipped.`
                    );
                }
            } else {
                const result = await pool.query(
                    `UPDATE jobs
                    SET status = 'DEAD_LETTER',
                        worker_id = NULL,
                        last_heartbeat = NULL
                    WHERE id = $1
                    AND status = 'RUNNING'
                    AND worker_id = $2`,
                    [job.id, workerId]
                );

                if (result.rowCount > 0) {
                    console.log(
                        `Job ${job.id} moved to DEAD_LETTER after exhausting retries.`
                    );
                } else {
                    console.log(
                        `Worker ${workerId} no longer owns job ${job.id}; failure update skipped.`
                    );
                }
            }
        }

        return false;
    } finally {
        if (heartbeat) {
            clearInterval(heartbeat);
        }

        client.release();
    }
}

async function startWorker() {
    console.log(`Worker ${process.pid} started`);

    let queueEmpty = false;

    try {
        while(!isShuttingDown) {
            const processed = await processJob();

            if(isShuttingDown) {
                break;
            }

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
    finally {
        await pool.end();

        console.log(`Worker ${process.pid} shut down cleanly`);
    }
}


function handleShutdown(signal) {
    if (isShuttingDown) {
        console.error(
            `Received ${signal} again. Forcing shutdown.`
        );
        process.exit(1);
    }

    console.log(
        `Received ${signal}. Shutting down worker...`
    );

    isShuttingDown = true;
}

process.once("SIGINT", () => handleShutdown("SIGINT"));
process.once("SIGTERM", () => handleShutdown("SIGTERM"));

startWorker().catch(error => {
    console.error("Worker terminated unexpectedly: ", error);
    process.exitCode = 1;
});
