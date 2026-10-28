const pool = require("../db");
const { registerWorker, heartbeatWorker, stopWorker } = require("./registry");
const { ensureMetricsSchema } = require("../metrics/events");
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

async function processJob(
    executeJob = async () =>
        sleep(Number(process.env.JOB_PROCESSING_DELAY_MS ?? 3000))
) {
    const client = await pool.connect();
    let job = null;
    let heartbeat = null;
    let transactionOpen = false;
    let idempotencyLockAcquired = false;

    try {
        if (isShuttingDown) {
            return false;
        }

        await client.query("BEGIN");
        transactionOpen = true;

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
            transactionOpen = false;
            return false;
        }

        if (isShuttingDown) {
            await client.query("ROLLBACK");
            transactionOpen = false;
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
        await client.query(
            "INSERT INTO job_events (job_id, event_type, queue_delta) VALUES ($1, 'started', -1)",
            [job.id]
        );

        if (isShuttingDown) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return false;
        }

        await client.query("COMMIT");
        transactionOpen = false;

        heartbeat = setInterval(() => {
            giveHeartbeat(job.id);
        }, 5000);

        console.log(`Worker ${process.pid} picked job ${job.id}`);
        console.log(`Processing job ${job.id}...`);    
        
        let shouldExecute = true;

        if (job.idempotency_key) {
            // Serialize execution for this idempotency key.
            await client.query(
                `SELECT pg_advisory_lock(hashtextextended($1, 0))`,
                [job.idempotency_key]
            );

            idempotencyLockAcquired = true;

            // Recheck after acquiring the lock.
            const processedResult = await client.query(
                `SELECT 1
                FROM processed_jobs
                WHERE idempotency_key = $1`,
                [job.idempotency_key]
            );

            shouldExecute = processedResult.rows.length === 0;
        }

        if (shouldExecute) {
            console.log(`SIDE EFFECT: Executing job ${job.id}`);

            if (job.type === "intentional_failure_test") {
                throw new Error("Intentional failure for dead-letter testing");
            }
            await executeJob(job);

            // Record success only after execution succeeds.
            if (job.idempotency_key) {
                await client.query(
                    `INSERT INTO processed_jobs (idempotency_key)
                    VALUES ($1)
                    ON CONFLICT (idempotency_key) DO NOTHING`,
                    [job.idempotency_key]
                );
            }
        } else {
            console.log(
                `SIDE EFFECT SKIPPED: Job ${job.id} was already processed.`
            );
        }

        const completion = await pool.query(
            `WITH completed_job AS (
                UPDATE jobs
                SET status = 'COMPLETED',
                    completed_at = CURRENT_TIMESTAMP,
                    worker_id = NULL,
                    last_heartbeat = NULL
                WHERE id = $1 AND status = 'RUNNING' AND worker_id = $2
                RETURNING id
             )
             INSERT INTO job_events (job_id, event_type, queue_delta)
             SELECT id, 'completed', 0 FROM completed_job
             RETURNING job_id`,
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
        if (transactionOpen) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed:", rollbackError.message);
            } finally {
                transactionOpen = false;
            }
        }

        console.error(`Job ${job.id} has failed: `, error.message);

        if (job) {
            const retryCount = job.retry_count + 1;

            if (retryCount <= job.max_retries) {
                const delayTime = Math.pow(2, retryCount);

                const result = await pool.query(
                    `WITH retry_job AS (
                        UPDATE jobs
                        SET status = 'QUEUED',
                            retry_count = $3,
                            next_retry_at = CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second'),
                            worker_id = NULL,
                            last_heartbeat = NULL,
                            started_at = NULL,
                            last_error = $5
                        WHERE id = $1 AND status = 'RUNNING' AND worker_id = $2
                        RETURNING id
                     )
                     INSERT INTO job_events (job_id, event_type, queue_delta)
                     SELECT id, 'retry_queued', 1 FROM retry_job
                     RETURNING job_id`,
                    [
                      job.id,
                      workerId,
                      retryCount,
                      delayTime,
                      error?.message || String(error),
                    ]
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
                    `WITH failed_job AS (
                        UPDATE jobs
                        SET status = 'DEAD_LETTER',
                            dead_letter_at = CURRENT_TIMESTAMP,
                            worker_id = NULL,
                            last_heartbeat = NULL,
                            last_error = $3
                        WHERE id = $1 AND status = 'RUNNING' AND worker_id = $2
                        RETURNING id
                     )
                     INSERT INTO job_events (job_id, event_type, queue_delta)
                     SELECT id, 'dead_lettered', 0 FROM failed_job
                     RETURNING job_id`,
                    [
                      job.id,
                      workerId,
                      error?.message || String(error),
                    ]
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

        if (idempotencyLockAcquired && job?.idempotency_key) {
            try {
                await client.query(
                    `SELECT pg_advisory_unlock(hashtextextended($1, 0))`,
                    [job.idempotency_key]
                );
            } catch (error) {
                console.error("Failed to release idempotency lock:", error.message);
                client.release(error);
                return;
            }
        }

        client.release();
    }
}

async function startWorker() {
    console.log(`Worker ${process.pid} started`);

    await ensureMetricsSchema();
    await registerWorker(workerId);
    const registryHeartbeat = setInterval(() => {
        heartbeatWorker(workerId).catch(error => {
            console.error(`Worker heartbeat failed for ${workerId}:`, error.message);
        });
    }, 5000);

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

                await sleep(100);
            } else {
                queueEmpty = false;
            }
        }
    }
    finally {
        clearInterval(registryHeartbeat);
        try {
            await stopWorker(workerId);
        } catch (error) {
            console.error(`Failed to mark ${workerId} as stopped:`, error.message);
        } finally {
            await pool.end();
        }

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

module.exports = { processJob, startWorker };

if (require.main === module) {
    startWorker().catch(error => {
        console.error("Worker terminated unexpectedly:", error);
        process.exitCode = 1;
    });
}
