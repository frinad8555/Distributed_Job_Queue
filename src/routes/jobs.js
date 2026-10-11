const express = require("express");
const pool = require("../db");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { type, payload, priority, idempotency_key } = req.body;

        // Validate type
        if (
            typeof type !== "string" ||
            type.trim().length === 0 ||
            type.length > 100
        ) {
            return res.status(400).json({
                error: "type must be a non-empty string of at most 100 characters"
            });
        }

        // Validate payload
        if (payload === undefined || payload === null) {
            return res.status(400).json({
                error: "payload is required and cannot be null"
            });
        }

        // Validate priority
        if (
            priority !== undefined &&
            (!Number.isInteger(priority) || priority < 0)
        ) {
            return res.status(400).json({
                error: "priority must be a non-negative integer"
            });
        }

        // Validate idempotency_key when provided
        if (
            idempotency_key !== undefined &&
            (
                typeof idempotency_key !== "string" ||
                idempotency_key.trim().length === 0 ||
                idempotency_key.length > 255
            )
        ) {
            return res.status(400).json({
                error: "idempotency_key must be a non-empty string of at most 255 characters"
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

router.post("/:id/retry", async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE jobs
             SET status = 'QUEUED',
                 retry_count = 0,
                 next_retry_at = NULL,
                 started_at = NULL,
                 completed_at = NULL,
                 last_heartbeat = NULL
             WHERE id = $1
               AND status = 'DEAD_LETTER'
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            const existingJob = await pool.query(
                "SELECT * FROM jobs WHERE id = $1",
                [req.params.id]
            );

            if (existingJob.rows.length === 0) {
                return res.status(404).json({
                    error: "Job not found"
                });
            }

            return res.status(409).json({
                error: "Only DEAD_LETTER jobs can be retried",
                status: existingJob.rows[0].status
            });
        }

        res.json({
            message: "Job requeued successfully",
            job: result.rows[0]
        });

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            error: "Failed to retry job"
        });
    }
});

module.exports = router;