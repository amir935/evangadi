// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { initSchema } = require("./db");
const { authRequired, requireRole } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const scheduleRoutes = require("./routes/schedule");
const statusRoutes = require("./routes/status");
const reviewsRoutes = require("./routes/reviews");
const dayNotesRoutes = require("./routes/dayNotes");
const audioReceivedRoutes = require("./routes/audioReceived");
const manualEntriesRoutes = require("./routes/manualEntries");
const expectationsRoutes = require("./routes/expectations");
const tutorGroupsRoutes = require("./routes/tutorGroups");
const adminRoutes = require("./routes/admin");
const rosterRoutes = require("./routes/roster");

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.url}`);
  next();
});

// Public
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() }),
);
app.use("/api/auth", authRoutes);

// Protected
// Protected — Schedule & Video Review data: admin + coordinator only.
// Tutors and students don't get schedule-editing or review-writing access.
app.use(
  "/api/schedule",
  authRequired,
  requireRole("admin", "coordinator"),
  scheduleRoutes,
);
app.use(
  "/api/status",
  authRequired,
  requireRole("admin", "coordinator"),
  statusRoutes,
);
app.use(
  "/api/reviews",
  authRequired,
  requireRole("admin", "coordinator", "video_reviewer", "reviewer"),
  reviewsRoutes,
);
app.use(
  "/api/day-notes",
  authRequired,
  requireRole("admin", "coordinator", "audio_reporter", "reviewer"),
  dayNotesRoutes,
);
app.use(
  "/api/audio-received",
  authRequired,
  requireRole("admin", "coordinator", "audio_reporter", "reviewer"),
  audioReceivedRoutes,
);
app.use(
  "/api/manual-entries",
  authRequired,
  requireRole("admin", "coordinator", "audio_reporter", "reviewer"),
  manualEntriesRoutes,
);
app.use(
  "/api/expectations",
  authRequired,
  requireRole("admin", "coordinator", "audio_reporter", "reviewer"),
  expectationsRoutes,
);
app.use(
  "/api/tutor-groups",
  authRequired,
  requireRole("admin", "coordinator"),
  tutorGroupsRoutes,
);
app.use("/api/admin", authRequired, requireRole("admin"), adminRoutes);
app.use(
  "/api/roster",
  authRequired,
  requireRole("admin", "coordinator"),
  rosterRoutes,
);

app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const { initNotifications } = require("./services/notifications");

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Evangadi backend running at http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      initNotifications();
    });
  })
  .catch((err) => {
    console.error("Failed to init schema:", err);
    process.exit(1);
  });
