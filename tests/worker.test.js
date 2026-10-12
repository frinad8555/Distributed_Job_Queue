
process.env.NODE_ENV = "test";

const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/db");
const { processJob } = require("../src/workers/worker");

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
