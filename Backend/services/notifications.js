// services/notifications.js
// Sends bi-weekly report reminder every Tuesday at 9:00 PM
// Uses node-cron for scheduling and nodemailer for email

const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { pool } = require("../db");

const ANCHOR_DATE = "2026-05-18"; // first bi-weekly period start

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtISO(date) {
  return date.toISOString().split("T")[0];
}

function fmtNice(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Get current bi-weekly period based on anchor
function getCurrentPeriod() {
  const today = new Date();
  const anchor = new Date(ANCHOR_DATE);
  const diff = Math.floor((today - anchor) / 86400000);
  const periodIndex = Math.floor(diff / 14);
  const start = addDays(anchor, periodIndex * 14);
  const end = addDays(start, 13);

  // Due date = Tuesday after period ends
  const afterEnd = addDays(end, 1);
  const daysUntilTue = (2 - afterEnd.getDay() + 7) % 7;
  const due = afterEnd.getDay() === 2 ? afterEnd : addDays(afterEnd, daysUntilTue);

  return { start, end, due };
}

// Check if today is a due Tuesday
function isTodayDueTuesday() {
  const today = new Date();
  const { due } = getCurrentPeriod();
  return today.getDay() === 2 && fmtISO(today) === fmtISO(due);
}

// Build week key (ISO week)
function weekKey(monday) {
  const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Fetch 2-week summary from DB
async function buildSummary(period) {
  const week1Monday = getMonday(period.start);
  const week2Monday = addDays(week1Monday, 7);
  const wk1 = weekKey(week1Monday);
  const wk2 = weekKey(week2Monday);

  const [rows] = await pool.query(
    `SELECT tutor_name, student_name, status, week_key
     FROM report_manual_entries
     WHERE week_key IN (?, ?)
     ORDER BY tutor_name, student_name`,
    [wk1, wk2]
  );

  const tutorMap = {};
  rows.forEach((r) => {
    if (!tutorMap[r.tutor_name]) {
      tutorMap[r.tutor_name] = { sent: 0, total: 0, missing: 0 };
    }
    const t = tutorMap[r.tutor_name];
    const isSent = r.status === "uploaded" || r.status === "reviewed";
    const skip = r.status === "cancelled" || r.status === "absent";
    if (!skip) {
      t.total++;
      if (isSent) t.sent++;
      else t.missing++;
    }
  });

  return tutorMap;
}

// Build HTML email
function buildEmailHTML(tutorMap, period) {
  const rows = Object.entries(tutorMap).map(([name, t]) => {
    const pct = t.total === 0 ? 100 : Math.round((t.sent / t.total) * 100);
    const status = t.sent === t.total ? "✅ Complete" : t.sent === 0 ? "❌ None sent" : `⚠️ ${t.missing} missing`;
    const color = t.sent === t.total ? "#15803d" : t.sent === 0 ? "#dc2626" : "#d97706";
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 14px;font-weight:700;">${name}</td>
        <td style="padding:10px 14px;text-align:center;font-weight:800;color:${color};">${t.sent}</td>
        <td style="padding:10px 14px;text-align:center;color:#475569;">${t.total}</td>
        <td style="padding:10px 14px;text-align:center;color:${color};font-weight:700;">${status}</td>
        <td style="padding:10px 14px;text-align:center;">
          <div style="background:#e2e8f0;border-radius:999px;height:8px;width:100px;display:inline-block;overflow:hidden;">
            <div style="height:100%;background:${color};width:${pct}%;border-radius:999px;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:'Inter',system-ui,sans-serif;background:#f8fafc;margin:0;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.1);">
        <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:24px 28px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:0.15em;font-weight:700;">EVANGADI TUTOR REVIEW</div>
          <h1 style="margin:8px 0 4px;font-size:22px;color:#fff;font-weight:800;">📊 Bi-Weekly Audio Report</h1>
          <div style="font-size:13px;color:rgba(255,255,255,0.85);">
            ${fmtNice(period.start)} – ${fmtNice(period.end)}
          </div>
        </div>

        <div style="padding:20px 28px;">
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#78350f;">
            🔔 <strong>Reminder:</strong> Bi-weekly report is due today (Tuesday ${fmtNice(period.due)}) at 9:00 PM.
          </div>

          <h2 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 14px;">Audio Submissions Summary</h2>

          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 14px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Tutor</th>
                <th style="padding:8px 14px;text-align:center;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Sent</th>
                <th style="padding:8px 14px;text-align:center;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Expected</th>
                <th style="padding:8px 14px;text-align:center;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
                <th style="padding:8px 14px;text-align:center;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Progress</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div style="margin-top:20px;padding:14px;background:#f8fafc;border-radius:10px;font-size:12px;color:#64748b;text-align:center;">
            Sent automatically by Evangadi Tutor Review App
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send email
async function sendReminderEmail(tutorMap, period) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NOTIFY_EMAIL,
      pass: process.env.NOTIFY_EMAIL_PASSWORD,
    },
  });

  const totalSent = Object.values(tutorMap).reduce((s, t) => s + t.sent, 0);
  const totalExp = Object.values(tutorMap).reduce((s, t) => s + t.total, 0);
  const tutorCount = Object.keys(tutorMap).length;

  await transporter.sendMail({
    from: `"Evangadi Tutor Review" <${process.env.NOTIFY_EMAIL}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `📊 Bi-Weekly Report Due Today — ${totalSent}/${totalExp} audios sent (${tutorCount} tutors)`,
    html: buildEmailHTML(tutorMap, period),
  });

  console.log(`✅ Reminder email sent to ${process.env.NOTIFY_EMAIL}`);
}

// Initialize cron job — every Tuesday at 9:00 PM
function initNotifications() {
  if (!process.env.NOTIFY_EMAIL || !process.env.NOTIFY_EMAIL_PASSWORD) {
    console.log("⚠️  Email notifications disabled — set NOTIFY_EMAIL and NOTIFY_EMAIL_PASSWORD in .env");
    return;
  }

  // Run every Tuesday at 21:00 (9 PM) server time
  cron.schedule("35 14 * * *", async () => {
    try {
      if (!isTodayDueTuesday()) {
        console.log("ℹ️  Tuesday check: not a due date today, skipping notification.");
        return;
      }
      const period = getCurrentPeriod();
      console.log(`🔔 Sending bi-weekly reminder for ${fmtISO(period.start)} – ${fmtISO(period.end)}`);
      const tutorMap = await buildSummary(period);
      if (Object.keys(tutorMap).length === 0) {
        console.log("ℹ️  No entries found, skipping email.");
        return;
      }
      await sendReminderEmail(tutorMap, period);
    } catch (err) {
      console.error("❌ Notification error:", err.message);
    }
  }, {
    timezone: "Africa/Addis_Ababa"  // Ethiopia time (UTC+3)
  });

  console.log("🔔 Notification cron initialized — will send email every due Tuesday at 9:00 PM Addis Ababa time");
}

module.exports = { initNotifications };