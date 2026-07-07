// routes/reviews.js
const express = require("express");
const { pool } = require("../db");

const router = express.Router();

router.post("/", async (req, res) => {
  const { studentId, tutorName, studentName, reviewDate, reviewer, payload } =
    req.body || {};
  if (!studentId || !tutorName || !studentName || !reviewDate || !payload)
    return res.status(400).json({ error: "Missing required fields" });

  const reviewerId = req.user ? req.user.id : null;
  const reviewerName = reviewer || (req.user ? req.user.name : null);

  const [info] = await pool.query(
    `INSERT INTO reviews (student_id, tutor_name, student_name, review_date, reviewer_id, reviewer, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      studentId,
      tutorName,
      studentName,
      reviewDate,
      reviewerId,
      reviewerName,
      JSON.stringify(payload),
    ],
  );
  res.status(201).json({ id: info.insertId });
});

router.get("/student/:studentId", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, tutor_name, student_name, review_date, reviewer, payload, created_at
     FROM reviews WHERE student_id = ? ORDER BY created_at DESC`,
    [req.params.studentId],
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      tutorName: r.tutor_name,
      studentName: r.student_name,
      reviewDate: r.review_date,
      reviewer: r.reviewer,
      createdAt: r.created_at,
      payload:
        typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
    })),
  );
});

router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, student_id, tutor_name, student_name, review_date, reviewer, created_at
     FROM reviews ORDER BY created_at DESC LIMIT 200`,
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      tutorName: r.tutor_name,
      studentName: r.student_name,
      reviewDate: r.review_date,
      reviewer: r.reviewer,
      createdAt: r.created_at,
    })),
  );
});

module.exports = router;
