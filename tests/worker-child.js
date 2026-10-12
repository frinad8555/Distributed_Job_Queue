
const { processJob } = require("../src/workers/worker");
const pool = require("../src/db");

processJob(async (job) => {
    console.log(`CLAIMED:${job.id}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
})
    .then(async (processed) => {
        await pool.end();
        process.exitCode = processed ? 0 : 2;
    })
    .catch(async (error) => {
        console.error(error);
        await pool.end();
        process.exitCode = 1;
    });
