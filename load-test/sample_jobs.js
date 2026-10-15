function generateSampleJobs(count = 1000, benchmarkId) {
    if (!Number.isSafeInteger(count) || count < 1) {
        throw new Error("count must be a positive integer");
    }

    if (!benchmarkId || typeof benchmarkId !== "string") {
        throw new Error("benchmarkId must be a non-empty string");
    }

    return Array.from({ length: count }, (_, index) => ({
        type: "load-test",
        payload: {
            benchmarkId,
            sequence: index + 1,
            message: `Sample job ${index + 1}`,
        },
        priority: (index % 5) + 1,
    }));
}

module.exports = { generateSampleJobs };