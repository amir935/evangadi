// routes/newStudentWatches.js — the Weekly Watch List: one simple per-week
// checklist of tutor (+ optional student, + optional note), checked off
// once watched. Senior & Good tutors are flagged in the UI via GET
// /senior-tutors below, but are otherwise just rows in the same list.
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

const SELECT_FIELDS =
  "id, week_key AS weekKey, tutor_name AS tutorName, student_name AS studentName, note, watched, created_at AS createdAt";

// GET /api/new-student-watches/senior-tutors — read-only list of tutors
// flagged senior_good in the roster, so reviewers (who can't read the full
// roster) still know who qualifies for the once-a-week shortcut. Registered
// before GET /:weekKey so the literal path wins over the :weekKey param.
router.get("/senior-tutors", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT name FROM tutor_profiles WHERE senior_good = 1 AND active = 1",
  );
  res.json(rows.map((r) => r.name));
});

// POST /api/new-student-watches/mark-senior-tutor — promote a tutor (by
// name) to Senior & Good right from this list, e.g. after watching a new
// tutor's session and deciding they qualify. Creates their roster profile
// if they don't have one yet. Registered before POST /:weekKey so the
// literal path wins over the :weekKey param.
router.post("/mark-senior-tutor", async (req, res) => {
  const { tutorName } = req.body || {};
  if (!tutorName?.trim())
    return res.status(400).json({ error: "tutorName required" });
  await pool.query(
    `INSERT INTO tutor_profiles (name, senior_good) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE senior_good = 1`,
    [tutorName.trim()],
  );
  res.json({ ok: true });
});

// GET /api/new-student-watches/:weekKey — this week's watch list. Every
// Senior & Good tutor is auto-seeded a row here if they don't already have
// one for this week, so tagging a tutor once is enough — no manual re-add
// needed every week.
router.get("/:weekKey", async (req, res) => {
  const { weekKey } = req.params;

  const [seniorRows] = await pool.query(
    "SELECT name FROM tutor_profiles WHERE senior_good = 1 AND active = 1",
  );
  if (seniorRows.length) {
    const [existingRows] = await pool.query(
      "SELECT DISTINCT tutor_name FROM new_student_watches WHERE week_key = ?",
      [weekKey],
    );
    const existingNames = new Set(
      existingRows.map((r) => r.tutor_name.toLowerCase()),
    );
    const missing = seniorRows
      .map((r) => r.name)
      .filter((name) => !existingNames.has(name.toLowerCase()));
    for (const name of missing) {
      await pool.query(
        "INSERT INTO new_student_watches (week_key, tutor_name) VALUES (?, ?)",
        [weekKey, name],
      );
    }
  }

  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM new_student_watches WHERE week_key = ? ORDER BY created_at ASC`,
    [weekKey],
  );
  res.json(rows.map((r) => ({ ...r, watched: !!r.watched })));
});

// POST /api/new-student-watches/:weekKey — add a row to this week's list
// Body: { tutorName, studentName?, note? }
router.post("/:weekKey", async (req, res) => {
  const { weekKey } = req.params;
  const { tutorName, studentName, note } = req.body || {};
  if (!tutorName?.trim())
    return res.status(400).json({ error: "tutorName required" });

  const [result] = await pool.query(
    "INSERT INTO new_student_watches (week_key, tutor_name, student_name, note) VALUES (?, ?, ?, ?)",
    [weekKey, tutorName.trim(), studentName?.trim() || null, note || null],
  );
  const [[row]] = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM new_student_watches WHERE id = ?`,
    [result.insertId],
  );
  res.status(201).json({ ...row, watched: !!row.watched });
});

// PATCH /api/new-student-watches/:id — mark watched/unwatched or edit note
router.patch("/:id", async (req, res) => {
  const { watched, note } = req.body || {};
  const sets = [];
  const vals = [];
  if (watched !== undefined) {
    sets.push("watched = ?");
    vals.push(watched ? 1 : 0);
  }
  if (note !== undefined) {
    sets.push("note = ?");
    vals.push(note || null);
  }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(
    `UPDATE new_student_watches SET ${sets.join(", ")} WHERE id = ?`,
    vals,
  );
  res.json({ ok: true });
});

// DELETE /api/new-student-watches/:id
router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM new_student_watches WHERE id = ?", [
    req.params.id,
  ]);
  res.json({ ok: true });
});

module.exports = router;
