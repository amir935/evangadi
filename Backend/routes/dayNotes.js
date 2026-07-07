// routes/dayNotes.js — store notes for a tutor on a specific day
// Used in the Audio Report popup so the user can record why audio was missed.
const express = require("express");
const { pool } = require("../db");

const router = express.Router();

// GET /api/day-notes/:weekKey  → returns all notes for the week
router.get("/:weekKey", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT tutor_name, day_id, note FROM day_notes WHERE week_key = ?",
    [req.params.weekKey]
  );
  // Return as nested object: { tutorName: { dayId: note } }
  const result = {};
  rows.forEach((r) => {
    if (!result[r.tutor_name]) result[r.tutor_name] = {};
    result[r.tutor_name][r.day_id] = r.note || "";
  });
  res.json(result);
});

// PUT /api/day-notes/:weekKey  → save or clear one note
// Body: { tutorName, dayId, note }
router.put("/:weekKey", async (req, res) => {
  const { tutorName, dayId, note } = req.body || {};
  if (!tutorName || !dayId) return res.status(400).json({ error: "tutorName and dayId required" });

  const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  if (!validDays.includes(dayId)) return res.status(400).json({ error: "Invalid dayId" });

  const trimmed = (note || "").trim();
  if (!trimmed) {
    // Empty note → delete the row
    await pool.query(
      "DELETE FROM day_notes WHERE week_key = ? AND tutor_name = ? AND day_id = ?",
      [req.params.weekKey, tutorName, dayId]
    );
  } else {
    await pool.query(
      `INSERT INTO day_notes (week_key, tutor_name, day_id, note)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE note = VALUES(note)`,
      [req.params.weekKey, tutorName, dayId, trimmed]
    );
  }
  res.json({ ok: true });
});

module.exports = router;