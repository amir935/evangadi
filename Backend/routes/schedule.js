// routes/schedule.js — per-week schedule + rename + priority
const express = require("express");
const { pool } = require("../db");

const router = express.Router();
const makeId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const VALID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const VALID_PRI = ["normal", "watch", "focus"];

// Helper: MySQL returns Date objects; convert to "YYYY-MM-DD" string
function formatDate(d) {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * GET /api/schedule/:weekKey
 * Returns this week's schedule. If it doesn't exist yet, auto-copy
 * from the most recent earlier week (with fresh IDs).
 */
router.get("/:weekKey", async (req, res) => {
  const { weekKey } = req.params;
  console.log(`[GET /api/schedule/${weekKey}] checking if week exists...`);

  // Check if this week already exists
  const [exists] = await pool.query(
    "SELECT COUNT(*) AS c FROM tutors WHERE week_key = ?",
    [weekKey]
  );
  console.log(`  → ${exists[0].c} tutors found for ${weekKey}`);

  if (exists[0].c === 0) {
    // Find ALL distinct weeks that have data, sorted by which is most recent
    // and earlier than the requested week
    const [allWeeks] = await pool.query(
      "SELECT DISTINCT week_key FROM tutors ORDER BY week_key DESC"
    );
    console.log(`  → all weeks in DB: ${allWeeks.map((r) => r.week_key).join(", ") || "(none)"}`);

    // Find the most recent week that is strictly less than weekKey
    let sourceWeek = null;
    for (const row of allWeeks) {
      if (compareWeekKeys(row.week_key, weekKey) < 0) {
        sourceWeek = row.week_key;
        break;
      }
    }

    if (sourceWeek) {
      console.log(`  → copying from ${sourceWeek} → ${weekKey}`);
      await copyWeek(sourceWeek, weekKey);
    } else {
      console.log(`  → no earlier week to copy from`);
    }
  }

  res.json(await loadWeek(weekKey));
});

// Compare two week keys like "2026-W20" — returns -1/0/1
function compareWeekKeys(a, b) {
  const [ay, aw] = a.split("-W").map(Number);
  const [by, bw] = b.split("-W").map(Number);
  if (ay !== by) return ay - by;
  return aw - bw;
}

/**
 * POST /api/schedule/:weekKey/copy-from/:sourceWeek
 * Replace target week's schedule with a copy of sourceWeek's
 */
router.post("/:weekKey/copy-from/:sourceWeek", async (req, res) => {
  const { weekKey, sourceWeek } = req.params;
  // Delete existing
  await pool.query("DELETE FROM tutors WHERE week_key = ?", [weekKey]);
  await copyWeek(sourceWeek, weekKey);
  res.json(await loadWeek(weekKey));
});

/**
 * DELETE /api/schedule/:weekKey/clear
 */
router.delete("/:weekKey/clear", async (req, res) => {
  await pool.query("DELETE FROM tutors WHERE week_key = ?", [req.params.weekKey]);
  res.json({ ok: true });
});

/**
 * POST /api/schedule/:weekKey/tutors
 * Body: { dayId, tutor }
 */
router.post("/:weekKey/tutors", async (req, res) => {
  const { weekKey } = req.params;
  const { dayId, tutor } = req.body || {};
  if (!dayId || !tutor || !tutor.trim())
    return res.status(400).json({ error: "dayId and tutor required" });
  if (!VALID_DAYS.includes(dayId))
    return res.status(400).json({ error: "Invalid dayId" });

  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) AS c FROM tutors WHERE week_key = ? AND day_id = ?",
    [weekKey, dayId]
  );

  const id = makeId("t");
  await pool.query(
    "INSERT INTO tutors (id, week_key, day_id, tutor_name, position) VALUES (?, ?, ?, ?, ?)",
    [id, weekKey, dayId, tutor.trim(), c]
  );
  res.status(201).json({ id, tutor: tutor.trim(), students: [] });
});

/**
 * PATCH /api/schedule/tutors/:id   (rename)
 * Body: { tutor } or { dayId, position }
 */
router.patch("/tutors/:id", async (req, res) => {
  const { tutor, dayId, position } = req.body || {};
  const updates = [];
  const values = [];
  if (typeof tutor === "string" && tutor.trim()) {
    updates.push("tutor_name = ?");
    values.push(tutor.trim());
  }
  if (typeof dayId === "string" && VALID_DAYS.includes(dayId)) {
    updates.push("day_id = ?");
    values.push(dayId);
  }
  if (typeof position === "number") {
    updates.push("position = ?");
    values.push(position);
  }
  if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
  values.push(req.params.id);

  const [info] = await pool.query(
    `UPDATE tutors SET ${updates.join(", ")} WHERE id = ?`,
    values
  );
  if (info.affectedRows === 0) return res.status(404).json({ error: "Tutor not found" });
  res.json({ ok: true });
});

/**
 * DELETE /api/schedule/tutors/:id
 */
router.delete("/tutors/:id", async (req, res) => {
  const [info] = await pool.query("DELETE FROM tutors WHERE id = ?", [req.params.id]);
  if (info.affectedRows === 0) return res.status(404).json({ error: "Tutor not found" });
  res.json({ ok: true });
});

/**
 * POST /api/schedule/:weekKey/tutors/:tutorId/duplicate
 * Duplicate a tutor (with all students) in the same day OR a different day
 * Body: { targetDayId? }  — if omitted, uses the tutor's current day
 */
router.post("/:weekKey/tutors/:tutorId/duplicate", async (req, res) => {
  const { weekKey, tutorId } = req.params;
  const { targetDayId } = req.body || {};

  const [tutors] = await pool.query(
    "SELECT id, day_id, tutor_name FROM tutors WHERE id = ? AND week_key = ?",
    [tutorId, weekKey]
  );
  if (!tutors.length) return res.status(404).json({ error: "Tutor not found" });
  const orig = tutors[0];
  const dayId = targetDayId && VALID_DAYS.includes(targetDayId) ? targetDayId : orig.day_id;

  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) AS c FROM tutors WHERE week_key = ? AND day_id = ?",
    [weekKey, dayId]
  );

  const newTutorId = makeId("t");
  await pool.query(
    "INSERT INTO tutors (id, week_key, day_id, tutor_name, position) VALUES (?, ?, ?, ?, ?)",
    [newTutorId, weekKey, dayId, orig.tutor_name, c]
  );

  // Copy students
  const [students] = await pool.query(
    "SELECT student_name, priority, focus_note, end_date, position FROM students WHERE tutor_id = ? ORDER BY position",
    [tutorId]
  );
  const copiedStudents = [];
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const newSid = makeId("s");
    await pool.query(
      "INSERT INTO students (id, tutor_id, student_name, priority, focus_note, end_date, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newSid, newTutorId, s.student_name, s.priority, s.focus_note, s.end_date, i]
    );
    copiedStudents.push({
      id: newSid, name: s.student_name,
      priority: s.priority, focusNote: s.focus_note || "",
      endDate: s.end_date ? formatDate(s.end_date) : null,
    });
  }

  res.status(201).json({
    id: newTutorId, tutor: orig.tutor_name, students: copiedStudents,
  });
});

/**
 * POST /api/schedule/students
 * Body: { tutorId, name, priority?, focusNote? }
 */
router.post("/students", async (req, res) => {
  const { tutorId, name, priority, focusNote } = req.body || {};
  if (!tutorId || !name || !name.trim())
    return res.status(400).json({ error: "tutorId and name required" });
  const pri = VALID_PRI.includes(priority) ? priority : "normal";

  const [tutors] = await pool.query("SELECT id FROM tutors WHERE id = ?", [tutorId]);
  if (!tutors.length) return res.status(404).json({ error: "Tutor not found" });

  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) AS c FROM students WHERE tutor_id = ?",
    [tutorId]
  );

  const id = makeId("s");
  await pool.query(
    "INSERT INTO students (id, tutor_id, student_name, priority, focus_note, position) VALUES (?, ?, ?, ?, ?, ?)",
    [id, tutorId, name.trim(), pri, focusNote || null, c]
  );
  res.status(201).json({
    id, name: name.trim(), priority: pri, focusNote: focusNote || "",
  });
});

/**
 * PATCH /api/schedule/students/:id  (rename or set priority/focus note/end date)
 * Body: { name?, priority?, focusNote?, endDate?, tutorId?, position? }
 */
router.patch("/students/:id", async (req, res) => {
  const { name, priority, focusNote, endDate, tutorId, position } = req.body || {};
  const updates = [];
  const values = [];

  if (typeof name === "string" && name.trim()) {
    updates.push("student_name = ?");
    values.push(name.trim());
  }
  if (typeof priority === "string" && VALID_PRI.includes(priority)) {
    updates.push("priority = ?");
    values.push(priority);
  }
  if (typeof focusNote === "string") {
    updates.push("focus_note = ?");
    values.push(focusNote || null);
  }
  if (endDate !== undefined) {
    // Accept "YYYY-MM-DD" string, null, or empty string (clears the date)
    updates.push("end_date = ?");
    values.push(endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : null);
  }
  if (typeof tutorId === "string") {
    updates.push("tutor_id = ?");
    values.push(tutorId);
  }
  if (typeof position === "number") {
    updates.push("position = ?");
    values.push(position);
  }
  if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
  values.push(req.params.id);

  const [info] = await pool.query(
    `UPDATE students SET ${updates.join(", ")} WHERE id = ?`,
    values
  );
  if (info.affectedRows === 0) return res.status(404).json({ error: "Student not found" });
  res.json({ ok: true });
});

/**
 * DELETE /api/schedule/students/:id
 */
router.delete("/students/:id", async (req, res) => {
  const [info] = await pool.query("DELETE FROM students WHERE id = ?", [req.params.id]);
  if (info.affectedRows === 0) return res.status(404).json({ error: "Student not found" });
  res.json({ ok: true });
});

/* ---------- helpers ---------- */
async function loadWeek(weekKey) {
  const [tutors] = await pool.query(
    "SELECT id, day_id, tutor_name FROM tutors WHERE week_key = ? ORDER BY day_id, position, id",
    [weekKey]
  );
  if (!tutors.length) return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

  const tutorIds = tutors.map((t) => t.id);
  const [students] = await pool.query(
    `SELECT id, tutor_id, student_name, priority, focus_note, end_date
     FROM students WHERE tutor_id IN (?) ORDER BY tutor_id, position, id`,
    [tutorIds]
  );

  const byTutor = {};
  students.forEach((s) => {
    if (!byTutor[s.tutor_id]) byTutor[s.tutor_id] = [];
    byTutor[s.tutor_id].push({
      id: s.id,
      name: s.student_name,
      priority: s.priority,
      focusNote: s.focus_note || "",
      endDate: s.end_date ? formatDate(s.end_date) : null,
    });
  });

  const result = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  tutors.forEach((t) => {
    if (!result[t.day_id]) result[t.day_id] = [];
    result[t.day_id].push({
      id: t.id,
      tutor: t.tutor_name,
      students: byTutor[t.id] || [],
    });
  });
  return result;
}

async function copyWeek(sourceWeek, targetWeek) {
  const sourceData = await loadWeek(sourceWeek);
  for (const [dayId, list] of Object.entries(sourceData)) {
    for (let tIdx = 0; tIdx < list.length; tIdx++) {
      const t = list[tIdx];
      const newTutorId = makeId("t");
      await pool.query(
        "INSERT INTO tutors (id, week_key, day_id, tutor_name, position) VALUES (?, ?, ?, ?, ?)",
        [newTutorId, targetWeek, dayId, t.tutor, tIdx]
      );
      for (let sIdx = 0; sIdx < t.students.length; sIdx++) {
        const s = t.students[sIdx];
        const newStudentId = makeId("s");
        await pool.query(
          "INSERT INTO students (id, tutor_id, student_name, priority, focus_note, end_date, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [newStudentId, newTutorId, s.name, s.priority || "normal", s.focusNote || null, s.endDate || null, sIdx]
        );
      }
    }
  }
}

module.exports = router;