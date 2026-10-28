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

router.get("/", async (req, res) => {
    try {
        const { status, priority } = req.query;

        // Pagination defaults
        const limit = req.query.limit === undefined
            ? 20
            : Number(req.query.limit);

        const offset = req.query.offset === undefined
            ? 0
            : Number(req.query.offset);

        // Validate status
        const allowedStatuses = [
            "QUEUED",
            "RUNNING",
            "COMPLETED",
            "DEAD_LETTER"
        ];

        if (
            status !== undefined &&
            (typeof status !== "string" ||
             !allowedStatuses.includes(status))
        ) {
            return res.status(400).json({
                error: "Invalid status"
            });
        }

        // Validate priority
        if (
            priority !== undefined &&
            (
                typeof priority !== "string" ||
                !/^\d+$/.test(priority) ||
                !Number.isSafeInteger(Number(priority))
            )
        ) {
            return res.status(400).json({
                error: "priority must be a non-negative integer"
            });
        }

        // Validate pagination
        if (
            req.query.limit !== undefined &&
            (
                typeof req.query.limit !== "string" ||
                !/^\d+$/.test(req.query.limit) ||
                !Number.isSafeInteger(limit) ||
                limit < 1 ||
                limit > 100
            )
        ) {
            return res.status(400).json({
                error: "limit must be an integer between 1 and 100"
            });
        }

        if (
            req.query.offset !== undefined &&
            (
                typeof req.query.offset !== "string" ||
                !/^\d+$/.test(req.query.offset) ||
                !Number.isSafeInteger(offset)
            )
        ) {
            return res.status(400).json({
                error: "offset must be a non-negative integer"
            });
        }

        const conditions = [];
        const values = [];

        if (status !== undefined) {
            values.push(status);
            conditions.push(`status = $${values.length}`);
        }

        if (priority !== undefined) {
            values.push(Number(priority));
            conditions.push(`priority = $${values.length}`);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        values.push(limit);
        const limitParam = `$${values.length}`;

        values.push(offset);
        const offsetParam = `$${values.length}`;

        const result = await pool.query(
            `SELECT *
             FROM jobs
             ${whereClause}
             ORDER BY created_at DESC, id DESC
             LIMIT ${limitParam}
             OFFSET ${offsetParam}`,
            values
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            error: "Failed to fetch jobs"
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


router.get("/stats", async (req, res) => {
    try {
      const statsQuery = `
        SELECT
          COUNT(*)::int AS total_jobs,
          COUNT(*) FILTER (
            WHERE status = 'QUEUED'
          )::int AS queued_jobs,
          COUNT(*) FILTER (
            WHERE status = 'RUNNING'
          )::int AS running_jobs,
          COUNT(*) FILTER (
            WHERE status = 'COMPLETED'
          )::int AS completed_jobs,
          COUNT(*) FILTER (
            WHERE status = 'DEAD_LETTER'
          )::int AS dead_letter_jobs
        FROM jobs;
      `;
  
      const trendQuery = `
        SELECT
          TO_CHAR(day, 'Mon DD') AS date,
          COUNT(j.id)::int AS jobs
        FROM generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS day
        LEFT JOIN jobs j
          ON j.created_at >= day
          AND j.created_at < day + INTERVAL '1 day'
        GROUP BY day
        ORDER BY day;
      `;
  
      const [statsResult, trendResult] = await Promise.all([
        pool.query(statsQuery),
        pool.query(trendQuery),
      ]);
  
      const stats = statsResult.rows[0];
  
      res.json({
        totalJobs: stats.total_jobs,
        queuedJobs: stats.queued_jobs,
        runningJobs: stats.running_jobs,
        completedJobs: stats.completed_jobs,
        deadLetterJobs: stats.dead_letter_jobs,
        dailyJobs: trendResult.rows,
      });
    } catch (error) {
      console.error("Failed to fetch job stats:", error.message);
      res.status(500).json({ error: "Failed to fetch job statistics" });
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