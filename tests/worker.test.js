process.env.NODE_ENV = "test";

const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");


const pool = require("../src/db");
const { processJob } = require("../src/workers/worker");
const { recoverJobs } = require("../src/workers/recovery");

const { spawn } = require("node:child_process");
const path = require("node:path");

beforeEach(async () => {
    await pool.query("DELETE FROM processed_jobs");
    await pool.query("DELETE FROM jobs");
});

after(async () => {
    await pool.end();
});

test("processJob completes a queued job", async () => {
    const inserted = await pool.query(
        `INSERT INTO jobs (type, payload, status)
         VALUES ($1, $2, 'QUEUED')
         RETURNING id`,
        ["TEST_JOB", JSON.stringify({ message: "hello" })]
    );

    const jobId = inserted.rows[0].id;

    const processed = await processJob();

    assert.equal(processed, true);

    const result = await pool.query(
        "SELECT status, worker_id, completed_at FROM jobs WHERE id = $1",
        [jobId]
    );

    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].status, "COMPLETED");
    assert.equal(result.rows[0].worker_id, null);
    assert.ok(result.rows[0].completed_at);
});


test("processJob schedules a failed job for retry", async () => {
    const inserted = await pool.query(
        `INSERT INTO jobs
            (type, payload, status, retry_count, max_retries)
         VALUES ($1, $2, 'QUEUED', 0, 3)
         RETURNING id`,
        ["TEST_RETRY", JSON.stringify({ message: "retry me" })]
    );

    const jobId = inserted.rows[0].id;

    // The current worker must deliberately throw an error
    // during processing for this test to exercise retry logic.
    const processed = await processJob(async () => {
        throw new Error("Simulated failure for retry test");
    });

    assert.equal(processed, false);

    const result = await pool.query(
        `SELECT status, retry_count, next_retry_at,
                worker_id, last_heartbeat
         FROM jobs
         WHERE id = $1`,
        [jobId]
    );

    assert.equal(result.rows[0].status, "QUEUED");
    assert.equal(result.rows[0].retry_count, 1);
    assert.ok(result.rows[0].next_retry_at);
    assert.equal(result.rows[0].worker_id, null);
    assert.equal(result.rows[0].last_heartbeat, null);
});


test("processJob dead-letters a job after retries are exhausted", async () => {
    const inserted = await pool.query(
        `INSERT INTO jobs
            (type, payload, status, retry_count, max_retries)
         VALUES ($1, $2, 'QUEUED', 3, 3)
         RETURNING id`,
        ["TEST_DEAD_LETTER", JSON.stringify({ message: "fail permanently" })]
    );

    const jobId = inserted.rows[0].id;

    const processed = await processJob(async () => {
        throw new Error("Simulated failure for dead-letter test");
    });

    assert.equal(processed, false);

    const result = await pool.query(
        `SELECT status, retry_count, worker_id, last_heartbeat
         FROM jobs
         WHERE id = $1`,
        [jobId]
    );

    assert.equal(result.rows[0].status, "DEAD_LETTER");
    assert.equal(result.rows[0].retry_count, 3);
    assert.equal(result.rows[0].worker_id, null);
    assert.equal(result.rows[0].last_heartbeat, null);
});


test("two concurrent workers process different jobs", async () => {
    const inserted = await pool.query(
        `INSERT INTO jobs (type, payload, status, priority)
         VALUES
            ('CONCURRENT_TEST', '{"n": 1}', 'QUEUED', 1),
            ('CONCURRENT_TEST', '{"n": 2}', 'QUEUED', 1)
         RETURNING id`
    );

    const jobIds = inserted.rows.map(row => row.id.toString());

    const results = await Promise.all([
        processJob(),
        processJob()
    ]);

    assert.deepEqual(results, [true, true]);

    const completed = await pool.query(
        `SELECT id, status
         FROM jobs
         WHERE id = ANY($1::bigint[])
         ORDER BY id`,
        [jobIds]
    );

    assert.equal(completed.rows.length, 2);
    assert.ok(completed.rows.every(job => job.status === "COMPLETED"));
});


test("recovery requeues a job with a stale heartbeat", async () => {
    const inserted = await pool.query(
        `INSERT INTO jobs
            (type, payload, status, worker_id,
             started_at, last_heartbeat)
         VALUES (
            $1,
            $2,
            'RUNNING',
            $3,
            CURRENT_TIMESTAMP - INTERVAL '30 seconds',
            CURRENT_TIMESTAMP - INTERVAL '30 seconds'
         )
         RETURNING id`,
        [
            "TEST_RECOVERY",
            JSON.stringify({ message: "recover me" }),
            "worker-stale-test"
        ]
    );

    const jobId = inserted.rows[0].id;

    const recovered = await recoverJobs();

    assert.ok(
        recovered.some(job => String(job.id) === String(jobId)),
        "Expected the stale job to be recovered"
    );

    const result = await pool.query(
        `SELECT status, worker_id, started_at, last_heartbeat
         FROM jobs
         WHERE id = $1`,
        [jobId]
    );

    assert.equal(result.rows[0].status, "QUEUED");
    assert.equal(result.rows[0].worker_id, null);
    assert.equal(result.rows[0].started_at, null);
    assert.equal(result.rows[0].last_heartbeat, null);
});


test("a previously processed idempotency key skips execution", async () => {
    const key = "worker-idempotency-test-001";
    let executionCount = 0;

    await pool.query(
        `INSERT INTO processed_jobs (idempotency_key)
         VALUES ($1)`,
        [key]
    );

    const inserted = await pool.query(
        `INSERT INTO jobs (type, payload, status, idempotency_key)
         VALUES ($1, $2, 'QUEUED', $3)
         RETURNING id`,
        [
            "TEST_IDEMPOTENCY",
            JSON.stringify({ message: "duplicate" }),
            key
        ]
    );

    const jobId = inserted.rows[0].id;

    const processed = await processJob(async () => {
        executionCount++;
    });

    assert.equal(processed, true);
    assert.equal(executionCount, 0);

    const result = await pool.query(
        `SELECT status
         FROM jobs
         WHERE id = $1`,
        [jobId]
    );

    assert.equal(result.rows[0].status, "COMPLETED");
});


test("advisory locks serialize access for the same key", async () => {
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    const key = "lock-test-same-key";
    let lock2Acquired = false;

    try {
        await client1.query(
            "SELECT pg_advisory_lock(hashtextextended($1, 0))",
            [key]
        );

        const waitingLock = client2.query(
            "SELECT pg_advisory_lock(hashtextextended($1, 0))",
            [key]
        ).then(() => {
            lock2Acquired = true;
        });

        // Give the second request an opportunity to block.
        await new Promise(resolve => setTimeout(resolve, 200));

        assert.equal(lock2Acquired, false);

        await client1.query(
            "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
            [key]
        );

        await waitingLock;

        assert.equal(lock2Acquired, true);

        await client2.query(
            "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
            [key]
        );
    } finally {
        client1.release();
        client2.release();
    }
});


test("failed job processing releases its advisory lock", async () => {
    const key = "lock-test-failure-release";

    const inserted = await pool.query(
        `INSERT INTO jobs
            (type, payload, status, retry_count, max_retries,
             idempotency_key)
         VALUES ($1, $2, 'QUEUED', 0, 3, $3)
         RETURNING id`,
        [
            "TEST_LOCK_FAILURE",
            JSON.stringify({ message: "fail once" }),
            key
        ]
    );

    const jobId = inserted.rows[0].id;

    const processed = await processJob(async () => {
        throw new Error("Simulated failure for lock test");
    });

    assert.equal(processed, false);

    const client = await pool.connect();

    try {
        const result = await client.query(
            "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
            [key]
        );

        assert.equal(result.rows[0].acquired, true);

        await client.query(
            "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
            [key]
        );
    } finally {
        client.release();
    }

    const job = await pool.query(
        "SELECT status, retry_count FROM jobs WHERE id = $1",
        [jobId]
    );

    assert.equal(job.rows[0].status, "QUEUED");
    assert.equal(job.rows[0].retry_count, 1);
});


test("previously processed idempotency key skips execution", async () => {
    const key = "lock-test-already-processed";
    let executionCount = 0;

    await pool.query(
        `INSERT INTO processed_jobs (idempotency_key)
         VALUES ($1)`,
        [key]
    );

    const inserted = await pool.query(
        `INSERT INTO jobs
            (type, payload, status, idempotency_key)
         VALUES ($1, $2, 'QUEUED', $3)
         RETURNING id`,
        [
            "TEST_DUPLICATE_WORK",
            JSON.stringify({ message: "duplicate" }),
            key
        ]
    );

    const jobId = inserted.rows[0].id;

    const processed = await processJob(async () => {
        executionCount++;
    });

    assert.equal(processed, true);
    assert.equal(executionCount, 0);

    const result = await pool.query(
        "SELECT status FROM jobs WHERE id = $1",
        [jobId]
    );

    assert.equal(result.rows[0].status, "COMPLETED");
});


test("does not process a job before its retry time", async () => {
    const delayedJob = await pool.query(
      `INSERT INTO jobs (type, payload, next_retry_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 hour')
       RETURNING id`,
      ["delayed-job", JSON.stringify({ test: true })]
    );
  
    const delayedJobId = delayedJob.rows[0].id;
  
    // The worker should find no eligible job.
    const processedEarly = await processJob(async () => {});
  
    assert.equal(processedEarly, false);
  
    let result = await pool.query(
      "SELECT status, next_retry_at FROM jobs WHERE id = $1",
      [delayedJobId]
    );
  
    assert.equal(result.rows[0].status, "QUEUED");
    assert.ok(new Date(result.rows[0].next_retry_at) > new Date());
  
    // Make the job eligible for processing.
    await pool.query(
      `UPDATE jobs
       SET next_retry_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
       WHERE id = $1`,
      [delayedJobId]
    );
  
    const processedAfterEligibility = await processJob(async () => {});
  
    assert.equal(processedAfterEligibility, true);
  
    result = await pool.query(
      "SELECT status FROM jobs WHERE id = $1",
      [delayedJobId]
    );
  
    assert.equal(result.rows[0].status, "COMPLETED");
});


test("processes higher-priority jobs first", async () => {
    // Insert the lower-priority job first.
    await pool.query(
      `INSERT INTO jobs (type, payload, priority)
       VALUES ($1, $2, $3)`,
      ["low-priority", JSON.stringify({}), 1]
    );
  
    await pool.query(
      `INSERT INTO jobs (type, payload, priority)
       VALUES ($1, $2, $3)`,
      ["high-priority", JSON.stringify({}), 10]
    );
  
    const processedTypes = [];
  
    await processJob(async (job) => {
      processedTypes.push(job.type);
    });
  
    await processJob(async (job) => {
      processedTypes.push(job.type);
    });
  
    assert.deepEqual(processedTypes, [
      "high-priority",
      "low-priority",
    ]);
});


test("does not complete a job when worker ownership changes", async () => {
    const inserted = await pool.query(
      `INSERT INTO jobs (type, payload)
       VALUES ($1, $2)
       RETURNING id`,
      ["ownership-test", JSON.stringify({ test: true })]
    );
  
    const jobId = inserted.rows[0].id;
  
    const processed = await processJob(async (job) => {
      // Simulate another worker taking ownership.
      await pool.query(
        `UPDATE jobs
         SET worker_id = $2
         WHERE id = $1`,
        [job.id, "different-worker"]
      );
    });
  
    assert.equal(processed, false);
  
    const result = await pool.query(
      `SELECT status, worker_id
       FROM jobs
       WHERE id = $1`,
      [jobId]
    );
  
    assert.equal(result.rows[0].status, "RUNNING");
    assert.equal(result.rows[0].worker_id, "different-worker");
});  


test("recovery only requeues stale running jobs", async () => {
    const inserted = await pool.query(`
      INSERT INTO jobs
        (type, payload, status, last_heartbeat, worker_id, completed_at)
      VALUES
        ('stale-job', '{}', 'RUNNING',
         CURRENT_TIMESTAMP - INTERVAL '30 seconds', 'worker-old', NULL),
        ('fresh-job', '{}', 'RUNNING',
         CURRENT_TIMESTAMP, 'worker-active', NULL),
        ('completed-job', '{}', 'COMPLETED',
         CURRENT_TIMESTAMP - INTERVAL '30 seconds', NULL,
         CURRENT_TIMESTAMP - INTERVAL '30 seconds'),
        ('dead-job', '{}', 'DEAD_LETTER',
         CURRENT_TIMESTAMP - INTERVAL '30 seconds', NULL, NULL)
      RETURNING id, type
    `);
  
    const ids = Object.fromEntries(
      inserted.rows.map((job) => [job.type, job.id])
    );
  
    const recovered = await recoverJobs();
  
    assert.ok(recovered.some((job) => String(job.id) === String(ids["stale-job"])));
  
    const result = await pool.query(
      `SELECT type, status, worker_id, last_heartbeat
       FROM jobs
       WHERE id = ANY($1::bigint[])`,
      [[
        ids["stale-job"],
        ids["fresh-job"],
        ids["completed-job"],
        ids["dead-job"],
      ]]
    );
  
    const byType = Object.fromEntries(
      result.rows.map((job) => [job.type, job])
    );
  
    assert.equal(byType["stale-job"].status, "QUEUED");
    assert.equal(byType["stale-job"].worker_id, null);
    assert.equal(byType["stale-job"].last_heartbeat, null);
  
    assert.equal(byType["fresh-job"].status, "RUNNING");
    assert.equal(byType["completed-job"].status, "COMPLETED");
    assert.equal(byType["dead-job"].status, "DEAD_LETTER");
});


test("schedules retry with the expected backoff", async () => {
    const inserted = await pool.query(
      `INSERT INTO jobs (type, payload, max_retries)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ["backoff-test", JSON.stringify({}), 3]
    );
  
    const jobId = inserted.rows[0].id;
  
    await processJob(async () => {
      throw new Error("Simulated failure for backoff test");
    });
  
    const result = await pool.query(
      `SELECT status, retry_count, next_retry_at,
              next_retry_at > CURRENT_TIMESTAMP AS retry_is_future,
              next_retry_at <= CURRENT_TIMESTAMP + INTERVAL '5 seconds'
                AS retry_is_within_expected_window
       FROM jobs
       WHERE id = $1`,
      [jobId]
    );
  
    const job = result.rows[0];
  
    assert.equal(job.status, "QUEUED");
    assert.equal(job.retry_count, 1);
    assert.equal(job.retry_is_future, true);
    assert.equal(job.retry_is_within_expected_window, true);
});


test("two independent worker processes cannot claim the same job", async () => {
    const inserted = await pool.query(
      `INSERT INTO jobs (type, payload)
       VALUES ($1, $2)
       RETURNING id`,
      ["cross-process-test", JSON.stringify({})]
    );
  
    const jobId = inserted.rows[0].id;
    const childScript = path.join(__dirname, "worker-child.js");
  
    function runChild() {
      return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [childScript], {
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        });
  
        let stdout = "";
        let stderr = "";
  
        child.stdout.on("data", data => {
          stdout += data.toString();
        });
  
        child.stderr.on("data", data => {
          stderr += data.toString();
        });
  
        child.on("error", reject);
  
        child.on("close", code => {
          resolve({ code, stdout, stderr });
        });
      });
    }
  
    const results = await Promise.all([runChild(), runChild()]);
  
    const claims = results.flatMap(result =>
      result.stdout
        .split(/\r?\n/)
        .filter(line => line.startsWith("CLAIMED:"))
    );
  
    assert.equal(
        claims.length,
        1,
        `Expected exactly one claim.\nChild results:\n${JSON.stringify(results, null, 2)}`
    );
    assert.equal(claims[0], `CLAIMED:${jobId}`);
  
    const result = await pool.query(
      "SELECT status FROM jobs WHERE id = $1",
      [jobId]
    );
  
    assert.equal(result.rows[0].status, "COMPLETED");
});

test("concurrent processing executes a keyed job once", async () => {
    const key = `concurrent-key-${Date.now()}`;
  
    const inserted = await pool.query(
      `INSERT INTO jobs (type, payload, idempotency_key)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ["idempotency-concurrency-test", JSON.stringify({}), key]
    );
  
    const jobId = inserted.rows[0].id;
    let executionCount = 0;
  
    const executeJob = async () => {
      executionCount++;
      await new Promise(resolve => setTimeout(resolve, 200));
    };
  
    const results = await Promise.all([
      processJob(executeJob),
      processJob(executeJob),
    ]);
  
    assert.equal(executionCount, 1);
    assert.equal(results.filter(Boolean).length, 1);
  
    const jobResult = await pool.query(
      "SELECT status FROM jobs WHERE id = $1",
      [jobId]
    );
  
    assert.equal(jobResult.rows[0].status, "COMPLETED");
  
    const processedResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM processed_jobs WHERE idempotency_key = $1",
      [key]
    );
  
    assert.equal(processedResult.rows[0].count, 1);
});
  