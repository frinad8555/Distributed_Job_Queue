const express = require("express");
const pool = require("../db");
const { ensureMetricsSchema } = require("../metrics/events");

const router = express.Router();
const ranges = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };
const eventTypes = [
    "queued",
    "started",
    "completed",
    "retry_queued",
    "dead_lettered",
    "recovered",
    "worker_started",
    "worker_heartbeat",
    "worker_stopped",
];
const jobStatuses = ["QUEUED", "RUNNING", "COMPLETED", "DEAD_LETTER"];

router.get("/", async (req, res) => {
    try {
        await ensureMetricsSchema();
        const rangeKey = Object.hasOwn(ranges, req.query.range) ? req.query.range : "24h";
        const eventType = req.query.type || "ALL";
        const status = req.query.status || "ALL";
        const workerId = typeof req.query.workerId === "string" ? req.query.workerId.trim().slice(0, 100) : "";
        const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
        const limit = Number(req.query.limit ?? 50);
        const offset = Number(req.query.offset ?? 0);

        if (eventType !== "ALL" && !eventTypes.includes(eventType)) {
            return res.status(400).json({ error: "Invalid event type" });
        }
        if (status !== "ALL" && !jobStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid job status" });
        }
        if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
            return res.status(400).json({ error: "Invalid pagination values" });
        }

        const values = [ranges[rangeKey]];
        const conditions = ["e.created_at >= CURRENT_TIMESTAMP - $1::interval", "e.event_type <> 'baseline'"];
        if (eventType !== "ALL") {
            values.push(eventType);
            conditions.push(`e.event_type = $${values.length}`);
        }
        if (status !== "ALL") {
            values.push(status);
            conditions.push(`j.status = $${values.length}`);
        }
        if (workerId) {
            values.push(`%${workerId}%`);
            conditions.push(`e.worker_id ILIKE $${values.length}`);
        }
        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(e.job_id::text ILIKE $${values.length} OR j.type ILIKE $${values.length})`);
        }

        const whereClause = `WHERE ${conditions.join(" AND ")}`;
        const [countResult, eventResult] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM job_events e
                 LEFT JOIN jobs j ON j.id = e.job_id
                 ${whereClause}`,
                values
            ),
            pool.query(
                `SELECT e.id, e.event_type, e.created_at, e.job_id, j.type AS job_type,
                        e.worker_id, e.details
                 FROM job_events e
                 LEFT JOIN jobs j ON j.id = e.job_id
                 ${whereClause}
                 ORDER BY e.created_at DESC, e.id DESC
                 LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
                [...values, limit, offset]
            ),
        ]);

        res.json({
            events: eventResult.rows.map((event) => ({
                id: event.id,
                type: event.event_type,
                occurredAt: event.created_at,
                jobId: event.job_id,
                jobType: event.job_type,
                workerId: event.worker_id,
                details: event.details,
            })),
            total: countResult.rows[0].total,
            limit,
            offset,
            eventTypes,
        });
    } catch (error) {
        console.error("Failed to fetch activity logs:", error.message);
        res.status(500).json({ error: "Failed to fetch activity logs" });
    }
});

module.exports = router;
