const express = require("express");
const pool = require("../db");
const { ensureMetricsSchema } = require("../metrics/events");
const { ensureWorkerRegistry } = require("../workers/registry");

const router = express.Router();
const ranges = {
    "24h": { interval: "1 hour", duration: "24 hours", trunc: "hour" },
    "7d": { interval: "1 day", duration: "7 days", trunc: "day" },
    "30d": { interval: "1 day", duration: "30 days", trunc: "day" },
};

router.get("/", async (req, res) => {
    try {
        const rangeKey = Object.hasOwn(ranges, req.query.range) ? req.query.range : "7d";
        const range = ranges[rangeKey];
        await Promise.all([ensureMetricsSchema(), ensureWorkerRegistry()]);

        const [summaryResult, activityResult, eventSummary, workerSummary] = await Promise.all([
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE status = 'QUEUED')::int AS queued,
                    COUNT(*) FILTER (WHERE status = 'RUNNING')::int AS running,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'DEAD_LETTER')::int AS dead_letter,
                    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (started_at - created_at))) FILTER (WHERE status = 'COMPLETED' AND completed_at >= CURRENT_TIMESTAMP - $1::interval))::int AS p50_wait_seconds,
                    ROUND(AVG(EXTRACT(EPOCH FROM (started_at - created_at))) FILTER (WHERE status = 'COMPLETED' AND completed_at >= CURRENT_TIMESTAMP - $1::interval))::int AS avg_wait_seconds,
                    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (started_at - created_at))) FILTER (WHERE status = 'COMPLETED' AND completed_at >= CURRENT_TIMESTAMP - $1::interval))::int AS p95_wait_seconds,
                    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'COMPLETED' AND completed_at >= CURRENT_TIMESTAMP - $1::interval))::int AS p50_execution_seconds,
                    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'COMPLETED' AND completed_at >= CURRENT_TIMESTAMP - $1::interval))::int AS avg_execution_seconds,
                    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'COMPLETED' AND completed_at >= CURRENT_TIMESTAMP - $1::interval))::int AS p95_execution_seconds
                 FROM jobs`,
                [range.duration]
            ),
            pool.query(
                `WITH buckets AS (
                    SELECT bucket
                    FROM generate_series(
                        date_trunc($1, CURRENT_TIMESTAMP - $2::interval),
                        date_trunc($1, CURRENT_TIMESTAMP),
                        $3::interval
                    ) AS bucket
                 ), baseline AS (
                    SELECT value FROM metrics_metadata WHERE key = 'queue_depth_baseline'
                 )
                 SELECT TO_CHAR(b.bucket, CASE WHEN $1 = 'hour' THEN 'HH24:00' ELSE 'Mon DD' END) AS label,
                        COALESCE(COUNT(e.id) FILTER (WHERE e.event_type = 'completed'), 0)::int AS completed,
                        COALESCE(COUNT(e.id) FILTER (WHERE e.event_type = 'dead_lettered'), 0)::int AS failed,
                        COALESCE(COUNT(e.id) FILTER (WHERE e.event_type IN ('retry_queued', 'recovered')), 0)::int AS retries,
                        CASE WHEN COUNT(e.id) FILTER (WHERE e.event_type IN ('completed', 'dead_lettered')) > 0
                             THEN ROUND((COUNT(e.id) FILTER (WHERE e.event_type = 'dead_lettered')) * 100.0 /
                                        (COUNT(e.id) FILTER (WHERE e.event_type IN ('completed', 'dead_lettered'))), 1)
                        END AS failure_rate,
                        CASE WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'started') > 0
                             THEN ROUND((COUNT(e.id) FILTER (WHERE e.event_type = 'retry_queued')) * 100.0 /
                                        (COUNT(e.id) FILTER (WHERE e.event_type = 'started')), 1)
                        END AS retry_rate,
                        (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (j.started_at - j.created_at))))::int
                         FROM jobs j
                         WHERE j.status = 'COMPLETED' AND j.completed_at >= b.bucket AND j.completed_at < b.bucket + $3::interval) AS wait_seconds,
                        (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (j.completed_at - j.started_at))))::int
                         FROM jobs j
                         WHERE j.status = 'COMPLETED' AND j.completed_at >= b.bucket AND j.completed_at < b.bucket + $3::interval) AS execution_seconds,
                        CASE WHEN b.bucket + $3::interval < (SELECT value FROM baseline) THEN NULL
                             ELSE COALESCE((SELECT SUM(q.queue_delta)::int
                                            FROM job_events q
                                            WHERE q.created_at <= LEAST(b.bucket + $3::interval, CURRENT_TIMESTAMP)), 0)
                        END AS queue_depth
                 FROM buckets b
                 LEFT JOIN job_events e
                   ON e.created_at >= b.bucket
                  AND e.created_at < b.bucket + $3::interval
                  AND e.event_type <> 'baseline'
                 GROUP BY b.bucket
                 ORDER BY b.bucket`,
                [range.trunc, range.duration, range.interval]
            ),
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE event_type = 'completed')::int AS completed,
                    COUNT(*) FILTER (WHERE event_type = 'dead_lettered')::int AS failed,
                    COUNT(*) FILTER (WHERE event_type = 'retry_queued')::int AS retries,
                    COUNT(*) FILTER (WHERE event_type = 'started')::int AS starts,
                    COUNT(*) FILTER (WHERE event_type = 'queued')::int AS enqueued
                 FROM job_events
                 WHERE created_at >= CURRENT_TIMESTAMP - $1::interval
                   AND event_type <> 'baseline'`,
                [range.duration]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS online_workers
                 FROM workers
                 WHERE stopped_at IS NULL
                   AND last_heartbeat >= CURRENT_TIMESTAMP - INTERVAL '15 seconds'`
            ),
        ]);

        const summary = summaryResult.rows[0];
        const events = eventSummary.rows[0];
        const outcomes = Number(events.completed) + Number(events.failed);
        const baselineResult = await pool.query(
            "SELECT value FROM metrics_metadata WHERE key = 'queue_depth_baseline'"
        );
        res.json({
            range: rangeKey,
            historyAvailableFrom: baselineResult.rows[0]?.value,
            summary: {
                queued: summary.queued,
                running: summary.running,
                completed: summary.completed,
                deadLetter: summary.dead_letter,
                completedInRange: events.completed,
                failedInRange: events.failed,
                successRate: outcomes ? Math.round((Number(events.completed) / outcomes) * 100) : null,
                failureRate: outcomes ? Math.round((Number(events.failed) / outcomes) * 100) : null,
                retryEvents: events.retries,
                retryRate: Number(events.starts) ? Math.round((Number(events.retries) / Number(events.starts)) * 100) : null,
                startedAttempts: events.starts,
                enqueuedJobs: events.enqueued,
                onlineWorkers: workerSummary.rows[0].online_workers,
                p50WaitSeconds: summary.p50_wait_seconds,
                averageWaitSeconds: summary.avg_wait_seconds,
                p95WaitSeconds: summary.p95_wait_seconds,
                p50ExecutionSeconds: summary.p50_execution_seconds,
                averageExecutionSeconds: summary.avg_execution_seconds,
                p95ExecutionSeconds: summary.p95_execution_seconds,
            },
            activity: activityResult.rows.map((point) => ({
                ...point,
                failure_rate: point.failure_rate == null ? null : Number(point.failure_rate),
                retry_rate: point.retry_rate == null ? null : Number(point.retry_rate),
            })),
        });
    } catch (error) {
        console.error("Failed to fetch metrics:", error.message);
        res.status(500).json({ error: "Failed to fetch metrics" });
    }
});

module.exports = router;
