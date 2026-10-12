process.env.NODE_ENV = "test";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const pool = require("../src/db");
const app = require("../src/app");

before(async () => {
    await pool.query("DELETE FROM processed_jobs");
    await pool.query("DELETE FROM jobs");
});

beforeEach(async () => {
    await pool.query("DELETE FROM processed_jobs");
    await pool.query("DELETE FROM jobs");
});

after(async () => {
    await pool.end();
});

test("GET / returns API status", async () => {
    const response = await request(app).get("/");

    assert.equal(response.status, 200);
    assert.equal(response.body.message, "Job Queue API is running");
});

test("POST /jobs creates a valid job", async () => {
    const response = await request(app)
        .post("/jobs")
        .send({
            type: "TEST_JOB",
            payload: { message: "hello" },
            priority: 1,
            idempotency_key: "api-test-001"
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.type, "TEST_JOB");
    assert.equal(response.body.status, "QUEUED");
    assert.equal(response.body.priority, 1);
});

test("POST /jobs accepts a false payload", async () => {
    const response = await request(app)
        .post("/jobs")
        .send({
            type: "TEST_JOB",
            payload: false
        });

    assert.equal(response.status, 201);
    assert.equal(response.body.payload, false);
});

test("POST /jobs rejects a missing payload", async () => {
    const response = await request(app)
        .post("/jobs")
        .send({ type: "TEST_JOB" });

    assert.equal(response.status, 400);
});

test("POST /jobs rejects a negative priority", async () => {
    const response = await request(app)
        .post("/jobs")
        .send({
            type: "TEST_JOB",
            payload: {},
            priority: -1
        });

    assert.equal(response.status, 400);
});

test("POST /jobs rejects duplicate idempotency keys", async () => {
    const job = {
        type: "TEST_JOB",
        payload: { message: "hello" },
        idempotency_key: "duplicate-test-001"
    };

    const first = await request(app).post("/jobs").send(job);
    const second = await request(app).post("/jobs").send(job);

    assert.equal(first.status, 201);
    assert.equal(second.status, 409);
    assert.ok(second.body.job);
});

test("GET /jobs/:id returns 404 for a missing job", async () => {
    const response = await request(app).get("/jobs/999999999");

    assert.equal(response.status, 404);
});


test("rejects an empty job type", async () => {
    const response = await request(app)
      .post("/jobs")
      .send({
        type: "   ",
        payload: { test: true },
      });
  
    assert.equal(response.status, 400);
    assert.ok(response.body.error);
});
  
  test("rejects an empty idempotency key", async () => {
    const response = await request(app)
      .post("/jobs")
      .send({
        type: "idempotency-test",
        payload: { test: true },
        idempotency_key: "   ",
      });
  
    assert.equal(response.status, 400);
    assert.ok(response.body.error);
});


test("GET /jobs returns all jobs newest first", async () => {
    await pool.query(
        `INSERT INTO jobs (type, payload, priority)
         VALUES
            ($1, $2, $3),
            ($4, $5, $6)`,
        [
            "older-job", JSON.stringify({}), 1,
            "newer-job", JSON.stringify({}), 1
        ]
    );

    // Ensure deterministic creation order for the test.
    await pool.query(`
        UPDATE jobs
        SET created_at = CASE
            WHEN type = 'older-job' THEN CURRENT_TIMESTAMP - INTERVAL '1 minute'
            WHEN type = 'newer-job' THEN CURRENT_TIMESTAMP
        END
        WHERE type IN ('older-job', 'newer-job')
    `);

    const response = await request(app).get("/jobs");

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body));

    const types = response.body
        .filter(job => ["older-job", "newer-job"].includes(job.type))
        .map(job => job.type);

    assert.deepEqual(types, ["newer-job", "older-job"]);
});


test("GET /jobs filters by status", async () => {
    await pool.query(
        `INSERT INTO jobs (type, payload, status)
         VALUES
            ('queued-test', '{}', 'QUEUED'),
            ('completed-test', '{}', 'COMPLETED')`
    );

    const response = await request(app)
        .get("/jobs?status=QUEUED");

    assert.equal(response.status, 200);
    assert.ok(response.body.length > 0);
    assert.ok(
        response.body.every(job => job.status === "QUEUED")
    );
});


test("GET /jobs filters by priority", async () => {
    await pool.query(
        `INSERT INTO jobs (type, payload, priority)
         VALUES
            ('priority-one', '{}', 1),
            ('priority-five', '{}', 5)`
    );

    const response = await request(app)
        .get("/jobs?priority=5");

    assert.equal(response.status, 200);
    assert.ok(response.body.length > 0);
    assert.ok(
        response.body.every(job => job.priority === 5)
    );
});


test("GET /jobs supports limit and offset", async () => {
    await pool.query(
        `INSERT INTO jobs (type, payload)
         VALUES
            ('page-job-1', '{}'),
            ('page-job-2', '{}'),
            ('page-job-3', '{}')`
    );

    const firstPage = await request(app)
        .get("/jobs?limit=2&offset=0");

    const secondPage = await request(app)
        .get("/jobs?limit=2&offset=2");

    assert.equal(firstPage.status, 200);
    assert.equal(secondPage.status, 200);
    assert.equal(firstPage.body.length, 2);
    assert.equal(secondPage.body.length, 1);

    const firstIds = firstPage.body.map(job => job.id);
    const secondIds = secondPage.body.map(job => job.id);

    assert.ok(
        firstIds.every(id => !secondIds.includes(id))
    );
});


test("GET /jobs combines status and priority filters", async () => {
    await pool.query(
        `INSERT INTO jobs (type, payload, status, priority)
         VALUES
            ('match-job', '{}', 'QUEUED', 5),
            ('wrong-status', '{}', 'COMPLETED', 5),
            ('wrong-priority', '{}', 'QUEUED', 1)`
    );

    const response = await request(app)
        .get("/jobs?status=QUEUED&priority=5");

    assert.equal(response.status, 200);
    assert.ok(response.body.length > 0);

    assert.ok(response.body.every(job =>
        job.status === "QUEUED" && job.priority === 5
    ));
});


test("GET /jobs rejects invalid query parameters", async () => {
    const invalidRequests = [
        "/jobs?status=UNKNOWN",
        "/jobs?priority=-1",
        "/jobs?limit=0",
        "/jobs?limit=101",
        "/jobs?offset=-1"
    ];

    for (const url of invalidRequests) {
        const response = await request(app).get(url);
        assert.equal(response.status, 400, url);
    }
});
