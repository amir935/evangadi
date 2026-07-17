// db.js — MySQL pool, schema, and seed
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "evangadi_review",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initSchema() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        email      VARCHAR(190) NOT NULL UNIQUE,
        name       VARCHAR(190) NOT NULL,
        password   VARCHAR(255) NOT NULL,
        role       ENUM('admin','coordinator','tutor','student') NOT NULL DEFAULT 'coordinator',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migration: add role column if it doesn't exist yet
    try {
      await conn.query(
        "ALTER TABLE users ADD COLUMN role ENUM('admin','coordinator','tutor','student') NOT NULL DEFAULT 'coordinator'",
      );
      // Anyone who already had an account before roles existed becomes admin —
      // safest default since they were using the app with full access already.
      await conn.query("UPDATE users SET role = 'admin'");
      console.log(
        "Added role column to users table — existing users promoted to admin",
      );
    } catch (e) {
      /* already exists */
    }

    // Master roster — persistent tutor identity, independent of any single week's schedule
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tutor_profiles (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(190) NOT NULL,
        phone       VARCHAR(40),
        email       VARCHAR(190),
        notes       TEXT,
        active      TINYINT(1) NOT NULL DEFAULT 1,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tutor_profile_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Master roster — persistent student identity, independent of any single week's schedule
    await conn.query(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        name             VARCHAR(190) NOT NULL,
        tutor_profile_id INT NULL,
        grade            VARCHAR(60),
        parent_contact   VARCHAR(190),
        notes            TEXT,
        active           TINYINT(1) NOT NULL DEFAULT 1,
        created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tutor_profile_id) REFERENCES tutor_profiles(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS tutors (
        id         VARCHAR(64) PRIMARY KEY,
        week_key   VARCHAR(10) NOT NULL,
        day_id     VARCHAR(8) NOT NULL,
        tutor_name VARCHAR(190) NOT NULL,
        position   INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tutors_week_day (week_key, day_id, position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS students (
        id           VARCHAR(64) PRIMARY KEY,
        tutor_id     VARCHAR(64) NOT NULL,
        student_name VARCHAR(190) NOT NULL,
        priority     ENUM('normal','watch','focus') NOT NULL DEFAULT 'normal',
        focus_note   TEXT,
        end_date     DATE NULL,
        is_temporary TINYINT(1) NOT NULL DEFAULT 0,
        position     INT NOT NULL DEFAULT 0,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_students_tutor (tutor_id, position),
        FOREIGN KEY (tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migration: add end_date if it doesn't exist
    try {
      await conn.query("ALTER TABLE students ADD COLUMN end_date DATE NULL");
      console.log("Added end_date column to students table");
    } catch (e) {
      /* already exists */
    }

    // Migration: add is_temporary if it doesn't exist
    try {
      await conn.query(
        "ALTER TABLE students ADD COLUMN is_temporary TINYINT(1) NOT NULL DEFAULT 0",
      );
      console.log("Added is_temporary column to students table");
    } catch (e) {
      /* already exists */
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS weekly_status (
        week_key   VARCHAR(10) NOT NULL,
        student_id VARCHAR(64) NOT NULL,
        status     ENUM('pending','uploaded','reviewed','absent') NOT NULL DEFAULT 'pending',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (week_key, student_id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migration: add 'absent' and 'cancelled' to existing weekly_status enum
    try {
      await conn.query(
        "ALTER TABLE weekly_status MODIFY status ENUM('pending','uploaded','reviewed','absent','cancelled','rescheduled') NOT NULL DEFAULT 'pending'",
      );
    } catch (e) {
      // Already migrated — fine
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        student_id   VARCHAR(64) NOT NULL,
        tutor_name   VARCHAR(190) NOT NULL,
        student_name VARCHAR(190) NOT NULL,
        review_date  DATE NOT NULL,
        reviewer_id  INT,
        reviewer     VARCHAR(190),
        payload      JSON NOT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reviews_student (student_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Day notes — one note per (week, tutor, day). Used in Audio Report.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS day_notes (
        week_key   VARCHAR(10) NOT NULL,
        tutor_name VARCHAR(190) NOT NULL,
        day_id     VARCHAR(3) NOT NULL,
        note       TEXT,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (week_key, tutor_name, day_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Manual audio received — set when tutor sends audio outside the app.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audio_received (
        week_key   VARCHAR(10) NOT NULL,
        tutor_name VARCHAR(190) NOT NULL,
        day_id     VARCHAR(3) NOT NULL,
        marked_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (week_key, tutor_name, day_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Manual report entries — tutors/students added manually in the Audio Report modal
    await conn.query(`
      CREATE TABLE IF NOT EXISTS report_manual_entries (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        week_key     VARCHAR(10) NOT NULL,
        tutor_name   VARCHAR(190) NOT NULL,
        student_name VARCHAR(190) NOT NULL,
        day_id       VARCHAR(3) NOT NULL,
        status       ENUM('pending','uploaded','reviewed','absent','cancelled','rescheduled') NOT NULL DEFAULT 'pending',
        audio_filename VARCHAR(500) DEFAULT NULL,
        material_added TINYINT(1) NOT NULL DEFAULT 0,
        material_status ENUM('unanswered','sent','none') NOT NULL DEFAULT 'unanswered',
        session_time DATETIME DEFAULT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_manual_week (week_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migration: add audio_filename if it doesn't exist
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries ADD COLUMN audio_filename VARCHAR(500) DEFAULT NULL",
      );
    } catch (e) {
      /* already exists — fine */
    }

    // Migration: add material_added if it doesn't exist
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries ADD COLUMN material_added TINYINT(1) NOT NULL DEFAULT 0",
      );
    } catch (e) {
      /* already exists */
    }

    // Migration: add material_status (3-state: unanswered/sent/none), backfilling from old material_added
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries ADD COLUMN material_status ENUM('unanswered','sent','none') NOT NULL DEFAULT 'unanswered'",
      );
      // Backfill: rows that already had material_added = 1 become 'sent'
      await conn.query(
        "UPDATE report_manual_entries SET material_status = 'sent' WHERE material_added = 1",
      );
    } catch (e) {
      /* already exists */
    }

    // Migration: add session_time if it doesn't exist
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries ADD COLUMN session_time DATETIME DEFAULT NULL",
      );
    } catch (e) {
      /* already exists */
    }

    // Migration: add cancelled and rescheduled to report_manual_entries status
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries MODIFY status ENUM('pending','uploaded','reviewed','absent','cancelled','rescheduled') NOT NULL DEFAULT 'pending'",
      );
    } catch (e) {
      /* already up to date */
    }

    // Migration: track WHO marked an audio entry as reviewed, and when
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries ADD COLUMN reviewed_by_id INT DEFAULT NULL",
      );
    } catch (e) {
      /* already exists */
    }
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries ADD COLUMN reviewed_by VARCHAR(190) DEFAULT NULL",
      );
    } catch (e) {
      /* already exists */
    }
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries ADD COLUMN reviewed_at DATETIME DEFAULT NULL",
      );
    } catch (e) {
      /* already exists */
    }

    // Migration: for rescheduled sessions, record the day the make-up class actually happened.
    // NULL = make-up not done yet. A value (e.g. 'thu') = make-up completed on that day.
    try {
      await conn.query(
        "ALTER TABLE report_manual_entries ADD COLUMN makeup_day VARCHAR(8) DEFAULT NULL",
      );
    } catch (e) {
      /* already exists */
    }

    // Permanent tutor expectations (default min sessions/days per week)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tutor_expectations (
        tutor_name   VARCHAR(190) PRIMARY KEY,
        min_sessions INT NOT NULL DEFAULT 0,
        min_days     INT NOT NULL DEFAULT 0,
        updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Per-week expectation overrides
    await conn.query(`
      CREATE TABLE IF NOT EXISTS week_expectations (
        week_key     VARCHAR(10) NOT NULL,
        tutor_name   VARCHAR(190) NOT NULL,
        min_sessions INT NOT NULL DEFAULT 0,
        min_days     INT NOT NULL DEFAULT 0,
        PRIMARY KEY (week_key, tutor_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Tutor WhatsApp groups (e.g. "Tutor Space 1")
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tutor_groups (
        id   INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(190) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Group members — each tutor belongs to at most one group
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tutor_group_members (
        group_id   INT NOT NULL,
        tutor_name VARCHAR(190) NOT NULL,
        PRIMARY KEY (tutor_name),
        FOREIGN KEY (group_id) REFERENCES tutor_groups(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed sample data only on first run
    const [[{ c }]] = await conn.query("SELECT COUNT(*) AS c FROM tutors");
    if (c === 0) {
      console.log("Seeding sample data...");
      const today = new Date();
      const wk = isoWeekKey(getMonday(today));

      const SEED = {
        mon: [
          {
            tutor: "Sara Bekele",
            students: [
              {
                n: "Emma",
                p: "focus",
                note: "Struggling with multiplication — needs extra patience",
              },
              { n: "Liam" },
            ],
          },
          { tutor: "Daniel Mekuria", students: [{ n: "Noah" }] },
          {
            tutor: "Yonas Alemu",
            students: [
              { n: "Ben", p: "watch", note: "Easily distracted" },
              { n: "Lucas" },
            ],
          },
        ],
        tue: [
          {
            tutor: "Hana Tesfaye",
            students: [
              { n: "Ava" },
              { n: "Mia" },
              { n: "Olivia", p: "focus", note: "Behind on workbook" },
            ],
          },
          { tutor: "Meron Girma", students: [{ n: "Jack" }] },
        ],
        wed: [
          {
            tutor: "Yonas Alemu",
            students: [{ n: "Zoe" }, { n: "Henry", p: "watch" }],
          },
          { tutor: "Sara Bekele", students: [{ n: "Owen" }] },
        ],
        thu: [
          { tutor: "Meron Girma", students: [{ n: "Sofia" }, { n: "Amelia" }] },
        ],
        fri: [
          {
            tutor: "Daniel Mekuria",
            students: [
              { n: "Isla" },
              {
                n: "Aria",
                p: "focus",
                note: "Parent requested closer attention",
              },
              { n: "Chloe" },
            ],
          },
          { tutor: "Yonas Alemu", students: [{ n: "Leo" }] },
        ],
      };

      for (const [dayId, list] of Object.entries(SEED)) {
        for (let tIdx = 0; tIdx < list.length; tIdx++) {
          const t = list[tIdx];
          const tId = `t_${dayId}_${tIdx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await conn.query(
            "INSERT INTO tutors (id, week_key, day_id, tutor_name, position) VALUES (?, ?, ?, ?, ?)",
            [tId, wk, dayId, t.tutor, tIdx],
          );
          for (let sIdx = 0; sIdx < t.students.length; sIdx++) {
            const s = t.students[sIdx];
            const sId = `s_${tId}_${sIdx}`;
            await conn.query(
              "INSERT INTO students (id, tutor_id, student_name, priority, focus_note, position) VALUES (?, ?, ?, ?, ?, ?)",
              [sId, tId, s.n, s.p || "normal", s.note || null, sIdx],
            );
          }
        }
      }
      console.log("Sample data seeded for week:", wk);
    }

    console.log("✅ Database schema ready.");
  } finally {
    conn.release();
  }
}

// Helpers (mirrored from frontend, for seeding)
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function isoWeekKey(monday) {
  const d = new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

module.exports = { pool, initSchema };
