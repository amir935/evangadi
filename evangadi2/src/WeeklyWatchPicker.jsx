import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "./api";
import { parseImportText } from "./importUtils";

// Weekly Watch List — one simple per-week checklist: add a tutor (with an
// optional student and note), tick it off once watched, delete when done.
// Senior & Good tutors (tagged in Admin → Tutor Roster) are flagged with a
// star automatically since they only need one watch a week — everyone else
// is just a plain row, added manually or via bulk JSON/CSV import.

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
function fmtShort(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function weekKeyOf(monday) {
  const d = new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export default function WeeklyWatchPicker() {
  const [weekMonday, setWeekMonday] = useState(() => getMonday(new Date()));
  const wKey = useMemo(() => weekKeyOf(weekMonday), [weekMonday]);

  const [entries, setEntries] = useState([]);
  const [seniorTutors, setSeniorTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tutorName, setTutorName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [markingSenior, setMarkingSenior] = useState(null);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([api.getNewStudentWatches(wKey), api.getSeniorTutors()])
      .then(([e, s]) => {
        setEntries(e);
        setSeniorTutors(s);
      })
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [wKey]);

  useEffect(() => {
    load();
  }, [load]);

  const isSenior = (name) =>
    seniorTutors.some((n) => n.toLowerCase() === name.toLowerCase());

  const addEntry = async () => {
    if (!tutorName.trim()) {
      setError("Enter a tutor name");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const saved = await api.addNewStudentWatch(
        wKey,
        tutorName,
        studentName,
        note,
      );
      setEntries((prev) => [...prev, saved]);
      // Keep the tutor name filled in — one tutor often has several
      // students, so only the student/note fields reset for the next add.
      setStudentName("");
      setNote("");
    } catch (err) {
      setError(err.message || "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const toggleWatched = async (entry) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, watched: !e.watched } : e)),
    );
    try {
      await api.setNewStudentWatched(entry.id, !entry.watched);
    } catch (err) {
      setError(err.message || "Failed to update");
      load();
    }
  };

  const removeEntry = async (entry) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    try {
      await api.deleteNewStudentWatch(entry.id);
    } catch (err) {
      setError(err.message || "Failed to remove");
      load();
    }
  };

  const markSenior = async (name) => {
    setMarkingSenior(name);
    try {
      await api.markTutorSeniorGood(name);
      setSeniorTutors((prev) =>
        prev.some((n) => n.toLowerCase() === name.toLowerCase())
          ? prev
          : [...prev, name],
      );
    } catch (err) {
      setError(err.message || "Failed to mark as Senior & Good");
    } finally {
      setMarkingSenior(null);
    }
  };

  const importBulk = async () => {
    let items;
    try {
      items = parseImportText(importText);
    } catch {
      setError("Couldn't parse that as JSON or CSV — check the format");
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      setError("Nothing to import — paste a list of tutors");
      return;
    }

    // One tutor commonly has several students — expand a grouped shape like
    // { tutor: "Jane Doe", students: ["Alex K", "Sam W"] } into one row per
    // student, alongside the already-flat { tutor, student } shape.
    const flat = [];
    for (const item of items) {
      const entry = typeof item === "string" ? { tutor: item } : item || {};
      const tutor = entry.tutor || entry.tutorName || entry.name;
      const note = entry.note || entry.notes || "";
      if (Array.isArray(entry.students)) {
        for (const s of entry.students) {
          const student =
            typeof s === "string" ? s : s?.student || s?.name || s?.studentName;
          flat.push({ tutor, student, note: s?.note || note });
        }
      } else {
        flat.push({ tutor, student: entry.student || entry.studentName, note });
      }
    }

    setImporting(true);
    setError("");
    let added = 0;
    let skipped = 0;
    for (const { tutor, student, note } of flat) {
      if (!tutor) {
        skipped++;
        continue;
      }
      try {
        const saved = await api.addNewStudentWatch(wKey, tutor, student, note);
        setEntries((prev) => [...prev, saved]);
        added++;
      } catch {
        skipped++;
      }
    }
    setImporting(false);
    setImportText("");
    if (skipped) {
      setError(`Imported ${added}, skipped ${skipped} (missing tutor name)`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Weekly Watch List</h1>
          <p style={styles.subtitle}>
            Add whoever you need to watch this week. Senior & Good tutors are
            flagged automatically — they only need one watch a week.
          </p>
        </div>
        <div style={styles.weekNav}>
          <button
            style={styles.weekNavBtn}
            onClick={() => setWeekMonday((m) => addDays(m, -7))}
          >
            ← Prev
          </button>
          <span style={styles.weekLabel}>
            {fmtShort(weekMonday)} – {fmtShort(addDays(weekMonday, 6))} (
            {wKey})
          </span>
          <button
            style={styles.weekNavBtn}
            onClick={() => setWeekMonday((m) => addDays(m, 7))}
          >
            Next →
          </button>
          <button
            style={styles.weekNavBtn}
            onClick={() => setWeekMonday(getMonday(new Date()))}
          >
            This week
          </button>
        </div>
      </div>

      <div style={styles.formCard}>
        <div style={styles.formRow}>
          <input
            style={styles.formInput}
            placeholder="Tutor name"
            value={tutorName}
            onChange={(e) => setTutorName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
          />
          <input
            style={styles.formInput}
            placeholder="Student (optional)"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
          />
          <input
            style={{ ...styles.formInput, flex: 1.4 }}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
          />
          <button style={styles.addBtn} disabled={adding} onClick={addEntry}>
            {adding ? "Adding…" : "+ Add"}
          </button>
        </div>

        <button
          style={styles.jsonToggleBtn}
          onClick={() => setShowImport((v) => !v)}
        >
          {showImport ? "▾" : "▸"} 📋 Bulk import from JSON or CSV
        </button>
        {showImport && (
          <div style={styles.importBox}>
            <p style={styles.hint}>
              One row per student — a tutor can appear more than once. JSON:{" "}
              <code>{`[{"tutor":"Jane Doe","student":"Alex K"}]`}</code> or
              grouped:{" "}
              <code>{`[{"tutor":"Jane Doe","students":["Alex K","Sam W"]}]`}</code>
              . CSV: header row <code>tutor,student,note</code>.
            </p>
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={handleFileUpload}
              style={{ marginBottom: 10, fontSize: 12.5 }}
            />
            <textarea
              style={styles.jsonTextarea}
              rows={5}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='[{"tutor":"Jane Doe","student":"Alex K"}]  or  tutor,student&#10;Jane Doe,Alex K'
            />
            <button
              style={styles.addBtnSmall}
              disabled={importing || !importText.trim()}
              onClick={importBulk}
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
        )}
      </div>

      {error && <div style={styles.errorBar}>{error}</div>}

      {loading ? (
        <div style={styles.empty}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={styles.empty}>Nobody added yet this week.</div>
      ) : (
        <>
          <WatchGroup
            title="⭐ Senior & Good"
            hint="One watch a week is enough for these."
            entries={entries.filter((e) => isSenior(e.tutorName))}
            isSenior={isSenior}
            markingSenior={markingSenior}
            onMarkSenior={markSenior}
            onToggleWatched={toggleWatched}
            onRemove={removeEntry}
          />
          <WatchGroup
            title="New tutors & flagged students"
            hint="Everyone else — watch as usual, or mark them Senior & Good once they've proven out."
            entries={entries.filter((e) => !isSenior(e.tutorName))}
            isSenior={isSenior}
            markingSenior={markingSenior}
            onMarkSenior={markSenior}
            onToggleWatched={toggleWatched}
            onRemove={removeEntry}
          />
        </>
      )}
    </div>
  );
}

function WatchGroup({
  title,
  hint,
  entries,
  isSenior,
  markingSenior,
  onMarkSenior,
  onToggleWatched,
  onRemove,
}) {
  const watchedCount = entries.filter((e) => e.watched).length;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={styles.sectionHead}>
        <span style={styles.sectionTitle}>{title}</span>
        <span style={styles.sectionCount}>
          {watchedCount}/{entries.length} watched
        </span>
      </div>
      {hint && entries.length > 0 && <p style={styles.hint}>{hint}</p>}
      {entries.length === 0 ? (
        <div style={styles.empty}>Nobody here yet.</div>
      ) : (
        <div style={styles.list}>
          {entries.map((e) => (
            <div key={e.id} style={styles.row}>
              <span style={styles.rowName}>
                {e.tutorName}
                {e.studentName && (
                  <span style={styles.rowStudent}> — {e.studentName}</span>
                )}
                {e.note && <span style={styles.rowNote}> ({e.note})</span>}
              </span>
              {isSenior(e.tutorName) ? (
                <span style={styles.starBadge}>⭐ Senior & Good</span>
              ) : (
                <button
                  style={styles.promoteBtn}
                  disabled={markingSenior === e.tutorName}
                  onClick={() => onMarkSenior(e.tutorName)}
                  title={`Good session? Mark ${e.tutorName} Senior & Good`}
                >
                  {markingSenior === e.tutorName
                    ? "Marking…"
                    : "⭐ Mark Senior & Good"}
                </button>
              )}
              <label style={styles.watchedLabel}>
                <input
                  type="checkbox"
                  checked={!!e.watched}
                  onChange={() => onToggleWatched(e)}
                />
                {e.watched ? "Watched ✅" : "Mark as watched"}
              </label>
              <button
                style={styles.removeBtn}
                onClick={() => onRemove(e)}
                title="Remove"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: "24px 28px 60px",
    fontFamily: "'Inter', system-ui, sans-serif",
    maxWidth: 900,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 },
  subtitle: {
    fontSize: 13.5,
    color: "#64748b",
    margin: "6px 0 0",
    maxWidth: 480,
    lineHeight: 1.5,
  },
  weekNav: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  weekNavBtn: {
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#334155",
    fontFamily: "inherit",
  },
  weekLabel: { fontSize: 13, fontWeight: 700, color: "#0f172a" },

  formCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    boxShadow: "0 6px 20px -16px rgba(15,23,42,0.1)",
  },
  formRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  formInput: {
    flex: 1,
    minWidth: 140,
    padding: "9px 12px",
    borderRadius: 9,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#0f172a",
    background: "#ffffff",
  },
  addBtn: {
    padding: "9px 16px",
    borderRadius: 9,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  addBtnSmall: {
    padding: "7px 14px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },

  jsonToggleBtn: {
    display: "block",
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
  },
  importBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #f1f5f9",
  },
  hint: {
    fontSize: 12,
    color: "#64748b",
    margin: "0 0 10px",
    lineHeight: 1.5,
  },
  jsonTextarea: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 9,
    border: "1px solid #e2e8f0",
    fontSize: 12.5,
    fontFamily: "'SF Mono', Consolas, monospace",
    color: "#0f172a",
    outline: "none",
    background: "#fff",
    marginBottom: 10,
    boxSizing: "border-box",
    resize: "vertical",
  },

  errorBar: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  empty: {
    padding: "24px 18px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13.5,
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px dashed #e2e8f0",
  },
  sectionHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  sectionCount: { fontSize: 12.5, fontWeight: 600, color: "#64748b" },

  list: { display: "flex", flexDirection: "column", gap: 6 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #f1f5f9",
    background: "#ffffff",
  },
  rowName: { fontSize: 13.5, fontWeight: 700, color: "#0f172a", flex: 1 },
  rowStudent: { fontWeight: 500, color: "#334155" },
  rowNote: { fontWeight: 400, color: "#94a3b8", fontSize: 12.5 },

  starBadge: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#92400e",
    background: "#fef3c7",
    padding: "3px 8px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },
  promoteBtn: {
    padding: "5px 10px",
    borderRadius: 8,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  watchedLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    fontWeight: 600,
    color: "#16a34a",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  removeBtn: {
    padding: "6px 9px",
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    cursor: "pointer",
    fontSize: 12,
  },
};
