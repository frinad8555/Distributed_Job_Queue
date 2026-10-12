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
