// routes/roster.js — admin + coordinator: manage the master tutor/student roster
// (independent of any single week's schedule)
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// ===== Tutors =====

// GET /api/roster/tutors — list all tutor profiles, with a live count of their roster students
router.get("/tutors", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT tp.id, tp.name, tp.phone, tp.email, tp.notes, tp.active, tp.created_at,
           COUNT(sp.id) AS studentCount
    FROM tutor_profiles tp
    LEFT JOIN student_profiles sp ON sp.tutor_profile_id = tp.id AND sp.active = 1
    GROUP BY tp.id
    ORDER BY tp.active DESC, tp.name ASC
  `);
  res.json(
    rows.map((r) => ({
      ...r,
      active: !!r.active,
      studentCount: Number(r.studentCount),
    })),
  );
});

// POST /api/roster/tutors — add a tutor to the master roster
router.post("/tutors", async (req, res) => {
  const { name, phone, email, notes } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  try {
    const [result] = await pool.query(
      "INSERT INTO tutor_profiles (name, phone, email, notes) VALUES (?, ?, ?, ?)",
      [name.trim(), phone || null, email || null, notes || null],
    );
    res
      .status(201)
      .json({
        id: result.insertId,
        name: name.trim(),
        phone,
        email,
        notes,
        active: true,
        studentCount: 0,
      });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({ error: "A tutor with this name already exists in the roster" });
    throw err;
  }
});

// PATCH /api/roster/tutors/:id
router.patch("/tutors/:id", async (req, res) => {
  const { name, phone, email, notes, active } = req.body || {};
  const sets = [];
  const vals = [];
  if (name !== undefined) {
    sets.push("name = ?");
    vals.push(name.trim());
  }
  if (phone !== undefined) {
    sets.push("phone = ?");
    vals.push(phone || null);
  }
  if (email !== undefined) {
    sets.push("email = ?");
    vals.push(email || null);
  }
  if (notes !== undefined) {
    sets.push("notes = ?");
    vals.push(notes || null);
  }
  if (active !== undefined) {
    sets.push("active = ?");
    vals.push(active ? 1 : 0);
  }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(
    `UPDATE tutor_profiles SET ${sets.join(", ")} WHERE id = ?`,
    vals,
  );
  res.json({ ok: true });
});

// DELETE /api/roster/tutors/:id — permanently remove (students under them become unassigned, not deleted)
router.delete("/tutors/:id", async (req, res) => {
  await pool.query("DELETE FROM tutor_profiles WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ===== Students =====

// GET /api/roster/students — list all student profiles with their assigned tutor's name
router.get("/students", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT sp.id, sp.name, sp.grade, sp.parent_contact, sp.notes, sp.active, sp.created_at,
           sp.tutor_profile_id, tp.name AS tutorName
    FROM student_profiles sp
    LEFT JOIN tutor_profiles tp ON tp.id = sp.tutor_profile_id
    ORDER BY sp.active DESC, sp.name ASC
  `);
  res.json(rows.map((r) => ({ ...r, active: !!r.active })));
});

// POST /api/roster/students
router.post("/students", async (req, res) => {
  const { name, tutorProfileId, grade, parentContact, notes } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const [result] = await pool.query(
    "INSERT INTO student_profiles (name, tutor_profile_id, grade, parent_contact, notes) VALUES (?, ?, ?, ?, ?)",
    [
      name.trim(),
      tutorProfileId || null,
      grade || null,
      parentContact || null,
      notes || null,
    ],
  );
  res.status(201).json({
    id: result.insertId,
    name: name.trim(),
    tutor_profile_id: tutorProfileId || null,
    grade,
    parent_contact: parentContact,
    notes,
    active: true,
  });
});

// PATCH /api/roster/students/:id — including reassigning to a different tutor
router.patch("/students/:id", async (req, res) => {
  const { name, tutorProfileId, grade, parentContact, notes, active } =
    req.body || {};
  const sets = [];
  const vals = [];
  if (name !== undefined) {
    sets.push("name = ?");
    vals.push(name.trim());
  }
  if (tutorProfileId !== undefined) {
    sets.push("tutor_profile_id = ?");
    vals.push(tutorProfileId || null);
  }
  if (grade !== undefined) {
    sets.push("grade = ?");
    vals.push(grade || null);
  }
  if (parentContact !== undefined) {
    sets.push("parent_contact = ?");
    vals.push(parentContact || null);
  }
  if (notes !== undefined) {
    sets.push("notes = ?");
    vals.push(notes || null);
  }
  if (active !== undefined) {
    sets.push("active = ?");
    vals.push(active ? 1 : 0);
  }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(req.params.id);
  await pool.query(
    `UPDATE student_profiles SET ${sets.join(", ")} WHERE id = ?`,
    vals,
  );
  res.json({ ok: true });
});

// DELETE /api/roster/students/:id
router.delete("/students/:id", async (req, res) => {
  await pool.query("DELETE FROM student_profiles WHERE id = ?", [
    req.params.id,
  ]);
  res.json({ ok: true });
});

// GET /api/roster/dashboard — quick aggregate stats for the overview dashboard
router.get("/dashboard", async (req, res) => {
  const [[tutorStats]] = await pool.query(
    "SELECT COUNT(*) AS total, SUM(active) AS activeCount FROM tutor_profiles",
  );
  const [[studentStats]] = await pool.query(
    "SELECT COUNT(*) AS total, SUM(active) AS activeCount FROM student_profiles",
  );
  const [[userStats]] = await pool.query("SELECT COUNT(*) AS total FROM users");
  const [roleBreakdown] = await pool.query(
    "SELECT role, COUNT(*) AS count FROM users GROUP BY role",
  );
  const [[weekStats]] = await pool.query(
    "SELECT COUNT(DISTINCT week_key) AS totalWeeks FROM tutors",
  );

  res.json({
    tutors: {
      total: tutorStats.total,
      active: Number(tutorStats.activeCount) || 0,
    },
    students: {
      total: studentStats.total,
      active: Number(studentStats.activeCount) || 0,
    },
    users: { total: userStats.total, byRole: roleBreakdown },
    weeksTracked: weekStats.totalWeeks,
  });
});

module.exports = router;
