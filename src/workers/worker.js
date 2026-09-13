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
    let job = null;

    try {
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

        job = result.rows[0];

        await client.query(
            `UPDATE jobs
             SET status = 'RUNNING',
                 started_at = CURRENT_TIMESTAMP,
                 last_heartbeat = CURRENT_TIMESTAMP,
                 next_retry_at = NULL
             WHERE id = $1`,
            [job.id]
        );

        await client.query("COMMIT");

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
            console.log(
                `SIDE EFFECT SKIPPED: Job ${job.id} was already processed.`
            );
        } else {
            console.log(`SIDE EFFECT: Executing job ${job.id}`);
        }

        await sleep(3000);
        throw new error('Job failed deliberately');
        const heartbeat = setInterval(() => {
            giveHeartbeat(job.id);
        }, 5000);

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
    
        console.error(`Job ${job.id} has failed: `, error.message);
    
        if (job) {
            const rtCount = job.retry_count + 1;

            if(rtCount <= job.max_retries) {
                const delayTime = Math.pow(2, rtCount);
                await pool.query(
                    `UPDATE jobs
                     SET status = 'QUEUED',
                         retry_count = $2,
                         next_retry_at = CURRENT_TIMESTAMP + ($3*INTERVAL '1 second')
                     WHERE id = $1`,
                    [job.id, rtCount, delayTime]
                );

                console.log(`Retry ${rtCount}/${job.max_retries} scheduled in ${delayTime} seconds.`);
            }
            else {
                await pool.query(
                    `UPDATE jobs
                     SET status = 'DEAD_LETTER'
                     WHERE id = $1`,
                    [job.id]
                );

                console.log(`Job ${job.id} has been added to Dead Letter Queue as it exhausted its max retries.`);
            }
        }
    
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