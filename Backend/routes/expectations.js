// routes/expectations.js
// Minimum expected audios per tutor — permanent default + per-week override
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// GET /api/expectations — all permanent defaults
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT tutor_name, min_sessions, min_days FROM tutor_expectations ORDER BY tutor_name"
  );
  const result = {};
  rows.forEach((r) => { result[r.tutor_name] = { minSessions: r.min_sessions, minDays: r.min_days }; });
  res.json(result);
});

// PUT /api/expectations/:tutorName — save permanent default
router.put("/:tutorName", async (req, res) => {
  const { minSessions, minDays } = req.body || {};
  const tutorName = req.params.tutorName;
  await pool.query(
    `INSERT INTO tutor_expectations (tutor_name, min_sessions, min_days)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE min_sessions = VALUES(min_sessions), min_days = VALUES(min_days)`,
    [tutorName, minSessions || 0, minDays || 0]
  );
  res.json({ ok: true });
});

// DELETE /api/expectations/:tutorName — clear permanent default
router.delete("/:tutorName", async (req, res) => {
  await pool.query("DELETE FROM tutor_expectations WHERE tutor_name = ?", [req.params.tutorName]);
  res.json({ ok: true });
});

// GET /api/expectations/week/:weekKey — per-week overrides
router.get("/week/:weekKey", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT tutor_name, min_sessions, min_days FROM week_expectations WHERE week_key = ?",
    [req.params.weekKey]
  );
  const result = {};
  rows.forEach((r) => { result[r.tutor_name] = { minSessions: r.min_sessions, minDays: r.min_days }; });
  res.json(result);
});

// PUT /api/expectations/week/:weekKey/:tutorName — save per-week override
router.put("/week/:weekKey/:tutorName", async (req, res) => {
  const { minSessions, minDays } = req.body || {};
  await pool.query(
    `INSERT INTO week_expectations (week_key, tutor_name, min_sessions, min_days)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE min_sessions = VALUES(min_sessions), min_days = VALUES(min_days)`,
    [req.params.weekKey, req.params.tutorName, minSessions || 0, minDays || 0]
  );
  res.json({ ok: true });
});

// DELETE /api/expectations/week/:weekKey/:tutorName — clear per-week override
router.delete("/week/:weekKey/:tutorName", async (req, res) => {
  await pool.query(
    "DELETE FROM week_expectations WHERE week_key = ? AND tutor_name = ?",
    [req.params.weekKey, req.params.tutorName]
  );
  res.json({ ok: true });
});

module.exports = router;