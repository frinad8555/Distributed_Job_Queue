
require("dotenv").config();

const express = require("express");
const jobsRouter = require("./routes/jobs");
const workersRouter = require("./routes/workers");

const app = express();

app.use(express.json());
app.use("/jobs", jobsRouter);
app.use("/workers", workersRouter);

app.get("/", (req, res) => {
    res.json({
        message: "Job Queue API is running"
    });
});

module.exports = app;
