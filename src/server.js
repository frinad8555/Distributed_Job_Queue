const express = require("express");
require("dotenv").config();

const jobsRouter = require("./routes/jobs");

const app = express();

app.use(express.json());

app.use("/jobs", jobsRouter);

app.get("/", (req, res) => {
    res.json({
        message: "Job Queue API is running"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});