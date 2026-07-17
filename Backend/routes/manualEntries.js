// routes/manualEntries.js
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

const VALID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const VALID_STATUS = [
  "pending",
  "uploaded",
  "reviewed",
  "absent",
  "cancelled",
  "rescheduled",
];
const VALID_MATERIAL_STATUS = ["unanswered", "sent", "none"];

// GET /api/manual-entries/:weekKey
router.get("/:weekKey", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, tutor_name, student_name, day_id, status, audio_filename, material_status, session_time, reviewed_by, reviewed_at, makeup_day FROM report_manual_entries WHERE week_key = ? ORDER BY id",
    [req.params.weekKey],
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      tutorName: r.tutor_name,
      studentName: r.student_name,
      dayId: r.day_id,
      status: r.status,
      audioFilename: r.audio_filename || "",
      materialStatus: r.material_status || "unanswered",
      sessionTime: r.session_time
        ? new Date(r.session_time).toISOString()
        : null,
      reviewedBy: r.reviewed_by || null,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
      makeupDay: r.makeup_day || null,
    })),
  );
});

// POST /api/manual-entries/:weekKey — add one entry
router.post("/:weekKey", async (req, res) => {
  const {
    tutorName,
    studentName,
    dayId,
    status,
    audioFilename,
    materialStatus,
    sessionTime,
    makeupDay,
  } = req.body || {};
  if (!tutorName || !studentName || !dayId)
    return res
      .status(400)
      .json({ error: "tutorName, studentName, dayId required" });
  if (!VALID_DAYS.includes(dayId))
    return res.status(400).json({ error: "Invalid dayId" });
  const st = VALID_STATUS.includes(status) ? status : "pending";
  const ms = VALID_MATERIAL_STATUS.includes(materialStatus)
    ? materialStatus
    : "unanswered";
  const sessionTimeVal = sessionTime ? new Date(sessionTime) : null;
  // If created directly as "reviewed", stamp the reviewer right away.
  const revById = st === "reviewed" && req.user ? req.user.id : null;
  const revBy = st === "reviewed" && req.user ? req.user.name : null;
  const revAt = st === "reviewed" ? new Date() : null;
  const [info] = await pool.query(
    "INSERT INTO report_manual_entries (week_key, tutor_name, student_name, day_id, status, audio_filename, material_status, session_time, reviewed_by_id, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      req.params.weekKey,
      tutorName,
      studentName,
      dayId,
      st,
      audioFilename || null,
      ms,
      sessionTimeVal,
      revById,
      revBy,
      revAt,
    ],
  );
  res.status(201).json({
    id: info.insertId,
    tutorName,
    studentName,
    dayId,
    status: st,
    audioFilename: audioFilename || "",
    materialStatus: ms,
    sessionTime: sessionTimeVal ? sessionTimeVal.toISOString() : null,
    reviewedBy: revBy,
    reviewedAt: revAt ? revAt.toISOString() : null,
  });
});

// PATCH /api/manual-entries/:id — update any fields
router.patch("/:id", async (req, res) => {
  const {
    status,
    audioFilename,
    tutorName,
    studentName,
    dayId,
    materialStatus,
    sessionTime,
    makeupDay,
  } = req.body || {};
  if (status && !VALID_STATUS.includes(status))
    return res.status(400).json({ error: "Invalid status" });
  if (dayId !== undefined && !VALID_DAYS.includes(dayId))
    return res.status(400).json({ error: "Invalid dayId" });
  if (
    materialStatus !== undefined &&
    !VALID_MATERIAL_STATUS.includes(materialStatus)
  )
    return res.status(400).json({ error: "Invalid materialStatus" });

  const sets = [];
  const vals = [];
  if (tutorName !== undefined) {
    sets.push("tutor_name = ?");
    vals.push(tutorName);
  }
  if (studentName !== undefined) {
    sets.push("student_name = ?");
    vals.push(studentName);
  }
  if (dayId !== undefined) {
    sets.push("day_id = ?");
    vals.push(dayId);
  }
  if (status !== undefined) {
    sets.push("status = ?");
    vals.push(status);
  }
  if (audioFilename !== undefined) {
    sets.push("audio_filename = ?");
    vals.push(audioFilename || null);
  }
  if (materialStatus !== undefined) {
    sets.push("material_status = ?");
    vals.push(materialStatus);
  }
  if (sessionTime !== undefined) {
    sets.push("session_time = ?");
    vals.push(sessionTime ? new Date(sessionTime) : null);
  }
  if (makeupDay !== undefined) {
    sets.push("makeup_day = ?");
    vals.push(makeupDay || null);
  }

  // Track who reviewed: when status becomes "reviewed", stamp the current user + time.
  // When it moves away from "reviewed", clear the stamp so stale reviewer info doesn't linger.
  if (status !== undefined) {
    if (status === "reviewed") {
      sets.push("reviewed_by_id = ?");
      vals.push(req.user ? req.user.id : null);
      sets.push("reviewed_by = ?");
      vals.push(req.user ? req.user.name : null);
      sets.push("reviewed_at = ?");
      vals.push(new Date());
    } else {
      sets.push("reviewed_by_id = ?");
      vals.push(null);
      sets.push("reviewed_by = ?");
      vals.push(null);
      sets.push("reviewed_at = ?");
      vals.push(null);
    }
  }

  if (sets.length === 0) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(
    `UPDATE report_manual_entries SET ${sets.join(", ")} WHERE id = ?`,
    vals,
  );
  res.json({ ok: true });
});

// DELETE /api/manual-entries/:id
router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM report_manual_entries WHERE id = ?", [
    req.params.id,
  ]);
  res.json({ ok: true });
});

module.exports = router;
