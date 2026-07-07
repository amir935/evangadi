// routes/admin.js — admin-only: manage user accounts and roles
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const router = express.Router();

const VALID_ROLES = [
  "admin",
  "coordinator",
  "tutor",
  "student",
  "video_reviewer",
  "audio_reporter",
  "reviewer",
];
const validEmail = (e) => typeof e === "string" && /\S+@\S+\.\S+/.test(e);

// GET /api/admin/users — list all user accounts
router.get("/users", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC",
  );
  res.json(rows);
});

// POST /api/admin/users — admin creates a new account directly (any role)
router.post("/users", async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email, password required" });
  if (!validEmail(email))
    return res.status(400).json({ error: "Invalid email" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be 6+ characters" });
  const r = VALID_ROLES.includes(role) ? role : "coordinator";

  const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [
    email.trim().toLowerCase(),
  ]);
  if (existing.length)
    return res.status(409).json({ error: "Email already registered" });

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name.trim(), email.trim().toLowerCase(), hash, r],
  );
  res.status(201).json({
    id: result.insertId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: r,
  });
});

// PATCH /api/admin/users/:id — change a user's role or name
router.patch("/users/:id", async (req, res) => {
  const { role, name } = req.body || {};
  if (role && !VALID_ROLES.includes(role))
    return res.status(400).json({ error: "Invalid role" });

  // Safety: prevent an admin from demoting themselves and locking everyone out
  if (Number(req.params.id) === req.user.id && role && role !== "admin") {
    return res.status(400).json({
      error:
        "You can't remove your own admin access. Have another admin do this.",
    });
  }

  const sets = [];
  const vals = [];
  if (role !== undefined) {
    sets.push("role = ?");
    vals.push(role);
  }
  if (name !== undefined && name.trim()) {
    sets.push("name = ?");
    vals.push(name.trim());
  }
  if (sets.length === 0) return res.json({ ok: true });

  vals.push(req.params.id);
  await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, vals);
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id — remove a user account
router.delete("/users/:id", async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({
      error: "You can't delete your own account while logged in as it.",
    });
  }
  await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// GET /api/admin/review-activity?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns review activity across BOTH video reviews and audio entries,
// so an admin can see who reviewed what (and what's still not reviewed).
router.get("/review-activity", async (req, res) => {
  const { from, to } = req.query;
  // Video reviews — each row already records reviewer + who/when
  const videoWhere = [];
  const videoParams = [];
  if (from) {
    videoWhere.push("review_date >= ?");
    videoParams.push(from);
  }
  if (to) {
    videoWhere.push("review_date <= ?");
    videoParams.push(to);
  }
  const videoSql = `
    SELECT id, tutor_name, student_name, review_date, reviewer, created_at
    FROM reviews
    ${videoWhere.length ? "WHERE " + videoWhere.join(" AND ") : ""}
    ORDER BY created_at DESC
  `;
  const [videoRows] = await pool.query(videoSql, videoParams);

  // Audio entries — only those actually reviewed carry a reviewer stamp
  const [audioRows] = await pool.query(`
    SELECT id, week_key, tutor_name, student_name, day_id, status, reviewed_by, reviewed_at
    FROM report_manual_entries
    ORDER BY id DESC
  `);

  // Per-reviewer tally across both systems
  const byReviewer = {};
  const bump = (name, kind) => {
    const key = name || "— (unrecorded)";
    if (!byReviewer[key])
      byReviewer[key] = { reviewer: key, video: 0, audio: 0 };
    byReviewer[key][kind]++;
  };
  videoRows.forEach((r) => bump(r.reviewer, "video"));
  audioRows.forEach((r) => {
    if (r.status === "reviewed") bump(r.reviewed_by, "audio");
  });

  // Audio review status summary
  const audioReviewed = audioRows.filter((r) => r.status === "reviewed").length;
  const audioNotReviewed = audioRows.filter((r) =>
    ["pending", "uploaded"].includes(r.status),
  ).length;

  res.json({
    video: videoRows.map((r) => ({
      id: r.id,
      tutorName: r.tutor_name,
      studentName: r.student_name,
      reviewDate: r.review_date,
      reviewer: r.reviewer || null,
      createdAt: r.created_at,
    })),
    audio: audioRows.map((r) => ({
      id: r.id,
      weekKey: r.week_key,
      tutorName: r.tutor_name,
      studentName: r.student_name,
      dayId: r.day_id,
      status: r.status,
      reviewedBy: r.reviewed_by || null,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    })),
    byReviewer: Object.values(byReviewer).sort(
      (a, b) => b.video + b.audio - (a.video + a.audio),
    ),
    summary: {
      videoTotal: videoRows.length,
      audioReviewed,
      audioNotReviewed,
    },
  });
});

// GET /api/admin/week-status/:weekKey
// Status breakdown for a single week, for BOTH the schedule grid and the audio report.
// Schedule "pending" is implicit (no status row = pending), so we count all scheduled
// students that week and treat missing rows as pending.
router.get("/week-status/:weekKey", async (req, res) => {
  const weekKey = req.params.weekKey;
  const STATUSES = [
    "pending",
    "uploaded",
    "reviewed",
    "absent",
    "cancelled",
    "rescheduled",
  ];

  // --- Schedule side ---
  // All students scheduled this week (their tutor's week_key matches), with any explicit status.
  const [schedRows] = await pool.query(
    `SELECT s.id AS student_id, ws.status AS status
     FROM students s
     JOIN tutors t ON t.id = s.tutor_id
     LEFT JOIN weekly_status ws ON ws.student_id = s.id AND ws.week_key = ?
     WHERE t.week_key = ?`,
    [weekKey, weekKey],
  );
  const schedule = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  schedRows.forEach((r) => {
    const st = r.status || "pending"; // no row = pending
    if (schedule[st] === undefined) schedule[st] = 0;
    schedule[st]++;
  });
  const scheduleTotal = schedRows.length;

  // --- Audio side ---
  const [audioRows] = await pool.query(
    "SELECT status FROM report_manual_entries WHERE week_key = ?",
    [weekKey],
  );
  const audio = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  audioRows.forEach((r) => {
    const st = r.status || "pending";
    if (audio[st] === undefined) audio[st] = 0;
    audio[st]++;
  });
  const audioTotal = audioRows.length;

  res.json({
    weekKey,
    statuses: STATUSES,
    schedule,
    scheduleTotal,
    audio,
    audioTotal,
  });
});

module.exports = router;
