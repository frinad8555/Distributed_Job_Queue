const express = require("express");
const pool = require("../db");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { type, payload, priority } = req.body;

        if (!type || !payload) {
            return res.status(400).json({
                error: "type and payload are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO jobs (type, payload, priority)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [type, payload, priority || 0]
        );
        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            error: "Failed to create job"
        });
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

module.exports = router;