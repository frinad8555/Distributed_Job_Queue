process.env.NODE_ENV = "test";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../src/db");

test("connects to the dedicated test database", async () => {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database"
        );

        assert.equal(result.rows[0].database, "job_queue_test");
    } finally {
        await pool.end();
    }
});
