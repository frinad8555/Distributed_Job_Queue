const express = require("express");
const pool = require("../db");
const { ensureWorkerRegistry } = require("../workers/registry");

const router = express.Router();

router.get("/", async (_req, res) => {
    try {
        await ensureWorkerRegistry();
        const result = await pool.query(
            `SELECT w.worker_id,
                    w.started_at,
                    w.last_heartbeat,
                    w.stopped_at,
                    COUNT(j.id)::int AS running_jobs,
                    MIN(j.started_at) AS oldest_job_started_at,
                    COALESCE(JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', j.id,
                            'type', j.type,
                            'startedAt', j.started_at,
                            'lastHeartbeat', j.last_heartbeat
                        ) ORDER BY j.started_at
                    ) FILTER (WHERE j.id IS NOT NULL), '[]'::json) AS jobs
             FROM workers w
             LEFT JOIN jobs j
               ON j.worker_id = w.worker_id
              AND j.status = 'RUNNING'
             GROUP BY w.worker_id, w.started_at, w.last_heartbeat, w.stopped_at
             ORDER BY w.stopped_at DESC NULLS FIRST, w.worker_id`
        );

        res.json(result.rows.map((worker) => ({
            workerId: worker.worker_id,
            startedAt: worker.started_at,
            runningJobs: worker.running_jobs,
            lastHeartbeat: worker.last_heartbeat,
            stoppedAt: worker.stopped_at,
            oldestJobStartedAt: worker.oldest_job_started_at,
            jobs: worker.jobs,
        })));
    } catch (error) {
        console.error("Failed to fetch workers:", error.message);
        res.status(500).json({ error: "Failed to fetch workers" });
    }
});

module.exports = router;
