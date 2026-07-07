// Reviewable migration: fix session times that were saved 12 hours early
// (an evening/PM session got stored as AM — e.g. 6:00 PM saved as 6:00 AM).
//
// ⚠ Your data is MIXED (some sessions are genuinely AM). A blind +12h would
//   corrupt real morning sessions. So this script is REVIEW-FIRST: by default it
//   only considers entries whose stored time is in the AM (00:00–11:59) — those
//   are the ones that could be a mis-saved PM — and it prints them for you to
//   check. Exclude any that are genuinely morning sessions before applying.
//
// USAGE (from the Backend/ folder):
//   node scripts/fix-session-time-ampm.js
//       → DRY RUN. Lists every AM entry with its proposed +12h change. Writes nothing.
//
//   node scripts/fix-session-time-ampm.js --exclude=12,17
//       → same preview, but skips entries #12 and #17 (your genuine-AM sessions).
//
//   node scripts/fix-session-time-ampm.js --apply --exclude=12,17
//       → applies +12h to every listed AM entry EXCEPT #12 and #17.
//
//   node scripts/fix-session-time-ampm.js --apply --only=3,4,5
//       → applies +12h to ONLY entries #3, #4, #5 (ignore the AM filter).
//
// Run --apply once per entry. Re-running shifts the same rows again.

const { pool } = require("../db");

function idList(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return null;
  return hit
    .split("=")[1]
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));
}

const APPLY = process.argv.includes("--apply");
const EXCLUDE = idList("exclude") || [];
const ONLY = idList("only"); // null unless provided

(async () => {
  const [rows] = await pool.query(
    "SELECT id, tutor_name, student_name, day_id, session_time FROM report_manual_entries WHERE session_time IS NOT NULL ORDER BY id",
  );

  const targets = rows.filter((r) => {
    if (ONLY) return ONLY.includes(r.id);
    if (EXCLUDE.includes(r.id)) return false;
    // default: only AM-stored times (00:00–11:59) are candidates for a PM mis-save
    return new Date(r.session_time).getHours() < 12;
  });

  if (targets.length === 0) {
    console.log("No matching entries to shift.");
    await pool.end();
    return;
  }

  const fmt = (d) =>
    new Date(d).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — +12h on ${targets.length} entr${targets.length === 1 ? "y" : "ies"}\n`,
  );
  for (const r of targets) {
    const after = new Date(new Date(r.session_time).getTime() + 12 * 3600000);
    console.log(
      `  #${String(r.id).padStart(4)}  ${r.tutor_name} / ${r.student_name} (${r.day_id})\n` +
        `        ${fmt(r.session_time)}   ->   ${fmt(after)}`,
    );
  }

  if (!APPLY) {
    console.log(
      `\nDry run only. Review the list above, then re-run with --apply` +
        ` (add --exclude=<ids> for any that are genuinely morning sessions).`,
    );
    await pool.end();
    return;
  }

  const ids = targets.map((r) => r.id);
  const [res] = await pool.query(
    `UPDATE report_manual_entries
       SET session_time = DATE_ADD(session_time, INTERVAL 12 HOUR)
     WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  console.log(`\n✓ Shifted ${res.affectedRows} entr${res.affectedRows === 1 ? "y" : "ies"} by +12h.`);
  await pool.end();
})().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
