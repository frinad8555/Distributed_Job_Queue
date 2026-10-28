
const { performance } = require("node:perf_hooks");
const { randomUUID } = require("node:crypto");
const { generateSampleJobs } = require("./sample_jobs");
const pool = require("../src/db");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TOTAL_JOBS = Number(process.env.TOTAL_JOBS || 1000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 500);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 1800000);

function percentile(values, p) {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(p * sorted.length) - 1;

    return sorted[Math.max(0, index)];
}

function average(values) {
    if (values.length === 0) return null;

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function printMetric(label, value) {
    console.log(`${label}: ${value}`);
}

async function submitJob(job) {
    const start = performance.now();

    const response = await fetch(`${BASE_URL}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
    });

    const latency = performance.now() - start;

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
    }

    await response.json();
    return latency;
}

async function fetchBatchJobs(benchmarkId) {
    const result = await pool.query(
        `SELECT id, status, created_at, started_at, completed_at,
                retry_count
         FROM jobs
         WHERE payload->>'benchmarkId' = $1`,
        [benchmarkId]
    );

    return result.rows;
}

function summarizeStatuses(rows) {
    const summary = {
        QUEUED: 0,
        RUNNING: 0,
        COMPLETED: 0,
        DEAD_LETTER: 0,
        OTHER: 0,
    };

    for (const row of rows) {
        if (Object.hasOwn(summary, row.status)) {
            summary[row.status]++;
        } else {
            summary.OTHER++;
        }
    }

    return summary;
}

async function main() {
    if (
        !Number.isSafeInteger(TOTAL_JOBS) ||
        TOTAL_JOBS < 1 ||
        !Number.isSafeInteger(CONCURRENCY) ||
        CONCURRENCY < 1 ||
        !Number.isSafeInteger(POLL_INTERVAL_MS) ||
        POLL_INTERVAL_MS < 1 ||
        !Number.isSafeInteger(TIMEOUT_MS) ||
        TIMEOUT_MS < 1
    ) {
        throw new Error(
            "TOTAL_JOBS, CONCURRENCY, POLL_INTERVAL_MS, and TIMEOUT_MS must be positive integers"
        );
    }

    const benchmarkId = randomUUID();
    const jobs = generateSampleJobs(TOTAL_JOBS, benchmarkId);
    const submissionLatencies = [];

    let nextIndex = 0;
    let accepted = 0;
    let submissionFailures = 0;

    console.log("\n=== End-to-End Job Queue Benchmark ===");
    printMetric("Batch ID", benchmarkId);
    printMetric("Target jobs", TOTAL_JOBS);
    printMetric("Submission concurrency", CONCURRENCY);
    printMetric("API URL", BASE_URL);

    const benchmarkStart = performance.now();

    async function producer() {
        while (true) {
            const index = nextIndex++;

            if (index >= jobs.length) return;

            try {
                const latency = await submitJob(jobs[index]);
                submissionLatencies.push(latency);
                accepted++;
            } catch (error) {
                submissionFailures++;

                if (submissionFailures <= 5) {
                    console.error("Submission failed:", error.message);
                }
            }
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(CONCURRENCY, TOTAL_JOBS) },
            () => producer()
        )
    );

    const submissionEnd = performance.now();
    const submissionSeconds = (submissionEnd - benchmarkStart) / 1000;

    console.log("\n--- Submission Results ---");
    printMetric("Accepted by API", accepted);
    printMetric("Submission failures", submissionFailures);
    printMetric(
        "Submission duration",
        `${submissionSeconds.toFixed(2)} s`
    );
    printMetric(
        "Submission throughput",
        `${(accepted / submissionSeconds).toFixed(2)} jobs/s`
    );

    if (submissionLatencies.length > 0) {
        printMetric(
            "Average HTTP latency",
            `${average(submissionLatencies).toFixed(2)} ms`
        );
        printMetric(
            "HTTP p50 latency",
            `${percentile(submissionLatencies, 0.50).toFixed(2)} ms`
        );
        printMetric(
            "HTTP p95 latency",
            `${percentile(submissionLatencies, 0.95).toFixed(2)} ms`
        );
        printMetric(
            "HTTP p99 latency",
            `${percentile(submissionLatencies, 0.99).toFixed(2)} ms`
        );
    }

    if (accepted === 0) {
        console.log("\nNo jobs were accepted; processing metrics unavailable.");
        process.exitCode = 1;
        return;
    }

    console.log("\nWaiting for this batch to finish...");
    const waitStart = performance.now();
    const deadline = waitStart + TIMEOUT_MS;

    let rows = [];

    while (performance.now() < deadline) {
        rows = await fetchBatchJobs(benchmarkId);

        const statuses = summarizeStatuses(rows);
        const terminal = statuses.COMPLETED + statuses.DEAD_LETTER;

        if (rows.length >= accepted && terminal >= rows.length) {
            break;
        }

        await new Promise(resolve =>
            setTimeout(resolve, POLL_INTERVAL_MS)
        );
    }

    // Fetch once more so the final report uses the latest database state.
    rows = await fetchBatchJobs(benchmarkId);

    const processingEnd = performance.now();
    const totalSeconds = (processingEnd - benchmarkStart) / 1000;
    const drainSeconds = (processingEnd - submissionEnd) / 1000;
    const statuses = summarizeStatuses(rows);

    const completedJobs = rows.filter(
        row => row.status === "COMPLETED" && row.completed_at
    );

    const completedLatencies = completedJobs.map(row =>
        new Date(row.completed_at).getTime() -
        new Date(row.created_at).getTime()
    );

    const queueWaits = completedJobs
        .filter(row => row.started_at && row.created_at)
        .map(row =>
            new Date(row.started_at).getTime() -
            new Date(row.created_at).getTime()
        );

    const unfinished =
        statuses.QUEUED + statuses.RUNNING + statuses.OTHER;

    console.log("\n--- Processing Results ---");
    printMetric("Jobs found in database", rows.length);
    printMetric("Completed", statuses.COMPLETED);
    printMetric("Dead-lettered", statuses.DEAD_LETTER);
    printMetric("Still queued", statuses.QUEUED);
    printMetric("Still running", statuses.RUNNING);
    printMetric("Other statuses", statuses.OTHER);
    printMetric("Unfinished jobs", unfinished);
    printMetric(
        "Completion rate among accepted jobs",
        `${((statuses.COMPLETED / accepted) * 100).toFixed(2)}%`
    );
    printMetric(
        "End-to-end benchmark duration",
        `${totalSeconds.toFixed(2)} s`
    );
    printMetric(
        "Drain time after submissions",
        `${drainSeconds.toFixed(2)} s`
    );
    printMetric(
        "Completed jobs per second (whole run)",
        `${(statuses.COMPLETED / totalSeconds).toFixed(2)} jobs/s`
    );

    if (completedLatencies.length > 0) {
        printMetric(
            "Average completion time",
            `${average(completedLatencies).toFixed(2)} ms`
        );
        printMetric(
            "Completion time p50",
            `${percentile(completedLatencies, 0.50).toFixed(2)} ms`
        );
        printMetric(
            "Completion time p95",
            `${percentile(completedLatencies, 0.95).toFixed(2)} ms`
        );
        printMetric(
            "Completion time p99",
            `${percentile(completedLatencies, 0.99).toFixed(2)} ms`
        );
    }

    if (queueWaits.length > 0) {
        printMetric(
            "Average queue wait",
            `${average(queueWaits).toFixed(2)} ms`
        );
        printMetric(
            "Queue wait p95",
            `${percentile(queueWaits, 0.95).toFixed(2)} ms`
        );
    }

    if (rows.length !== accepted) {
        console.warn(
            `Warning: API accepted ${accepted} jobs, but ${rows.length} batch jobs were found in the database.`
        );
    }

    if (
        unfinished > 0 ||
        statuses.DEAD_LETTER > 0 ||
        submissionFailures > 0 ||
        rows.length !== accepted
    ) {
        console.warn(
            "Benchmark did not finish cleanly. Check worker logs and job statuses."
        );
        process.exitCode = 1;
    } else {
        console.log("\nAll accepted jobs reached COMPLETED.");
    }
}

main()
    .catch(error => {
        console.error("Benchmark failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
