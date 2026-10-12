
require("dotenv").config();

const express = require("express");
const jobsRouter = require("./routes/jobs");

const app = express();

app.use(express.json());
app.use("/jobs", jobsRouter);

app.get("/", (req, res) => {
    res.json({
        message: "Job Queue API is running"
    });
});

module.exports = app;
