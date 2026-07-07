// routes/status.js
const express = require("express");
const { pool } = require("../db");

const router = express.Router();
const VALID = new Set([
  "pending",
  "uploaded",
  "reviewed",
  "absent",
  "cancelled",
  "rescheduled",
]);

router.get("/:weekKey", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT student_id, status FROM weekly_status WHERE week_key = ?",
    [req.params.weekKey],
  );
  const map = {};
  rows.forEach((r) => {
    map[r.student_id] = r.status;
  });
  res.json(map);
});

router.put("/:weekKey/:studentId", async (req, res) => {
  const { weekKey, studentId } = req.params;
  const { status } = req.body || {};
  if (!VALID.has(status))
    return res.status(400).json({ error: "Invalid status" });

  await pool.query(
    `INSERT INTO weekly_status (week_key, student_id, status)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP`,
    [weekKey, studentId, status],
  );
  res.json({ ok: true, status });
});

module.exports = router;
