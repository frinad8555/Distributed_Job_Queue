const { Pool } = require("pg");
require("dotenv").config();

const isTest = process.env.NODE_ENV === "test";

if (isTest && process.env.TEST_DB_NAME !== "job_queue_test") {
    throw new Error(
        "Refusing to run tests: TEST_DB_NAME must be job_queue_test"
    );
}

const pool = new Pool(
    isTest
        ? {
              host: process.env.TEST_DB_HOST,
              port: process.env.TEST_DB_PORT,
              database: process.env.TEST_DB_NAME,
              user: process.env.TEST_DB_USER,
              password: process.env.TEST_DB_PASSWORD
          }
        : {
              host: process.env.DB_HOST,
              port: process.env.DB_PORT,
              database: process.env.DB_NAME,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD
          }
);

module.exports = pool;
