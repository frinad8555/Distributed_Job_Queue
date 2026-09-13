const express = require("express");
const pool = require("../db");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { type, payload, priority, idempotency_key } = req.body;

        if (!type || !payload) {
            return res.status(400).json({
                error: "type and payload are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO jobs (type, payload, priority, idempotency_key)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [type, payload, priority || 0, idempotency_key]
        );
        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error.message);

        if (error.code === "23505") { // unique violation
            const existingJob = await pool.query(
                `SELECT *
                 FROM jobs
                 WHERE idempotency_key = $1`,
                [req.body.idempotency_key]
            );
    
            return res.status(409).json({
                error: "Job with this idempotency key already exists",
                job: existingJob.rows[0]
            });
        }

        res.status(500).json({
            error: "Failed to create job"
        });
    }
});

router.get("/dead-letter", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM jobs
             WHERE status = 'DEAD_LETTER'
             ORDER BY created_at`
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            error: "Failed to fetch dead-letter jobs"
        });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM jobs WHERE id = $1",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Job not found"
            });
        }
        res.json(result.rows[0]);

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            error: "Failed to fetch job"
        });
    }
});

module.exports = router;