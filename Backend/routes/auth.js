// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { JWT_SECRET, authRequired } = require("../middleware/auth");

const router = express.Router();
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";
const validEmail = (e) => typeof e === "string" && /\S+@\S+\.\S+/.test(e);

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email, password required" });
  if (!validEmail(email))
    return res.status(400).json({ error: "Invalid email" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be 6+ characters" });

  const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [
    email.trim().toLowerCase(),
  ]);
  if (existing.length)
    return res.status(409).json({ error: "Email already registered" });

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'coordinator')",
    [name.trim(), email.trim().toLowerCase(), hash],
  );

  const user = {
    id: result.insertId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: "coordinator",
  };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: EXPIRES });
  res.status(201).json({ user, token });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "email and password required" });

  const [rows] = await pool.query(
    "SELECT id, name, email, password, role FROM users WHERE email = ?",
    [email.trim().toLowerCase()],
  );
  if (!rows.length)
    return res.status(401).json({ error: "Invalid email or password" });

  const dbUser = rows[0];
  const ok = await bcrypt.compare(password, dbUser.password);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const user = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
  };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: EXPIRES });
  res.json({ user, token });
});

router.get("/me", authRequired, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, role FROM users WHERE id = ?",
    [req.user.id],
  );
  if (!rows.length) return res.status(401).json({ error: "User not found" });
  res.json({ user: rows[0] });
});

module.exports = router;
