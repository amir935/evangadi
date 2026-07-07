// routes/audioReceived.js
// Manual override: mark a tutor's audio as received for a specific day.
// Used when the tutor sends audio outside the app (WhatsApp, email, etc.)
const express = require("express");
const { pool } = require("../db");

const router = express.Router();
const VALID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// GET /api/audio-received/:weekKey
// Returns { "TutorName": { "mon": true, "fri": true }, ... }
router.get("/:weekKey", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT tutor_name, day_id FROM audio_received WHERE week_key = ?",
    [req.params.weekKey]
  );
  const result = {};
  rows.forEach((r) => {
    if (!result[r.tutor_name]) result[r.tutor_name] = {};
    result[r.tutor_name][r.day_id] = true;
  });
  res.json(result);
});

// PUT /api/audio-received/:weekKey
// Body: { tutorName, dayId, received: true/false }
router.put("/:weekKey", async (req, res) => {
  const { tutorName, dayId, received } = req.body || {};
  if (!tutorName || !dayId) return res.status(400).json({ error: "tutorName and dayId required" });
  if (!VALID_DAYS.includes(dayId)) return res.status(400).json({ error: "Invalid dayId" });

  if (received) {
    await pool.query(
      `INSERT INTO audio_received (week_key, tutor_name, day_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE week_key = week_key`,
      [req.params.weekKey, tutorName, dayId]
    );
  } else {
    await pool.query(
      "DELETE FROM audio_received WHERE week_key = ? AND tutor_name = ? AND day_id = ?",
      [req.params.weekKey, tutorName, dayId]
    );
  }
  res.json({ ok: true, received: !!received });
});

module.exports = router;