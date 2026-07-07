// routes/tutorGroups.js
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// GET /api/tutor-groups — all groups with their members
router.get("/", async (req, res) => {
  const [groups] = await pool.query("SELECT * FROM tutor_groups ORDER BY name");
  const [members] = await pool.query("SELECT * FROM tutor_group_members ORDER BY tutor_name");
  const result = groups.map((g) => ({
    id: g.id,
    name: g.name,
    // Use == (loose equality) to handle string/number type mismatch from MySQL driver
    members: members.filter((m) => m.group_id == g.id).map((m) => m.tutor_name),
  }));
  res.json(result);
});

// POST /api/tutor-groups — create group
router.post("/", async (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const [info] = await pool.query("INSERT INTO tutor_groups (name) VALUES (?)", [name.trim()]);
  res.status(201).json({ id: info.insertId, name: name.trim(), members: [] });
});

// DELETE /api/tutor-groups/:id — delete group
router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM tutor_group_members WHERE group_id = ?", [req.params.id]);
  await pool.query("DELETE FROM tutor_groups WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// PUT /api/tutor-groups/:id/members — assign tutor to group
router.put("/:id/members", async (req, res) => {
  const { tutorName } = req.body || {};
  if (!tutorName) return res.status(400).json({ error: "tutorName required" });
  // Remove from any existing group first
  await pool.query("DELETE FROM tutor_group_members WHERE tutor_name = ?", [tutorName]);
  // Add to new group
  await pool.query("INSERT INTO tutor_group_members (group_id, tutor_name) VALUES (?, ?)", [req.params.id, tutorName]);
  res.json({ ok: true });
});

// DELETE /api/tutor-groups/members/:tutorName — remove tutor from all groups
router.delete("/members/:tutorName", async (req, res) => {
  await pool.query("DELETE FROM tutor_group_members WHERE tutor_name = ?", [req.params.tutorName]);
  res.json({ ok: true });
});

module.exports = router;