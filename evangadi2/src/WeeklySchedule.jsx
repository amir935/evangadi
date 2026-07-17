import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import VideoReviewChecklist from "./VideoReviewChecklist";
import api from "./api";

const MAX_TUTORS_PER_DAY = 10;
const MAX_STUDENTS_PER_TUTOR = 5;

const DAILY_REPORT_SECTIONS = [
  {
    id: "basic",
    title: "Basic Info",
    icon: "📋",
    items: [
      { id: "grade", label: "Grade level included" },
      { id: "date", label: "Date of session included" },
      { id: "subject", label: "Subject included" },
    ],
  },
  {
    id: "topic",
    title: "1. Topic Covered",
    icon: "📖",
    items: [
      { id: "topic_what", label: "What topic was covered today" },
      {
        id: "topic_focus",
        label: "What the lesson focused on (skills, concepts)",
      },
      { id: "topic_review", label: "Whether previous concepts were reviewed" },
    ],
  },
  {
    id: "student_activity",
    title: "2. What Student Did",
    icon: "✏️",
    items: [
      {
        id: "activity_described",
        label: "Student's activities during session are described",
      },
      {
        id: "activity_engagement",
        label: "Student engagement level mentioned",
      },
      {
        id: "activity_participation",
        label: "Student participation described (questions, discussions)",
      },
    ],
  },
  {
    id: "learning_profile",
    title: "3. Student Learning Profile",
    icon: "🎯",
    items: [
      { id: "profile_understanding", label: "Understanding level assessed" },
      { id: "profile_strengths", label: "Student strengths mentioned" },
      {
        id: "profile_gaps",
        label: "Learning gaps or areas needing support identified",
      },
      {
        id: "profile_attitude",
        label: "Student attitude and engagement noted",
      },
    ],
  },
  {
    id: "next_session",
    title: "4. Notes for Next Session",
    icon: "🔮",
    items: [
      { id: "next_plan", label: "Plan for next session described" },
      {
        id: "next_assessment",
        label: "Assessment or review plan mentioned (if applicable)",
      },
      { id: "next_focus", label: "Focus areas for next session noted" },
    ],
  },
];

const DAYS = [
  {
    id: "mon",
    label: "Monday",
    short: "Mon",
    offset: 0,
    color: "#2563eb",
    soft: "#dbeafe",
    bg: "#eff6ff",
    weekend: false,
  },
  {
    id: "tue",
    label: "Tuesday",
    short: "Tue",
    offset: 1,
    color: "#7c3aed",
    soft: "#ede9fe",
    bg: "#f5f3ff",
    weekend: false,
  },
  {
    id: "wed",
    label: "Wednesday",
    short: "Wed",
    offset: 2,
    color: "#db2777",
    soft: "#fce7f3",
    bg: "#fdf2f8",
    weekend: false,
  },
  {
    id: "thu",
    label: "Thursday",
    short: "Thu",
    offset: 3,
    color: "#ea580c",
    soft: "#fed7aa",
    bg: "#fff7ed",
    weekend: false,
  },
  {
    id: "fri",
    label: "Friday",
    short: "Fri",
    offset: 4,
    color: "#059669",
    soft: "#a7f3d0",
    bg: "#ecfdf5",
    weekend: false,
  },
  {
    id: "sat",
    label: "Saturday",
    short: "Sat",
    offset: 5,
    color: "#0284c7",
    soft: "#bae6fd",
    bg: "#f0f9ff",
    weekend: true,
  },
  {
    id: "sun",
    label: "Sunday",
    short: "Sun",
    offset: 6,
    color: "#be185d",
    soft: "#fbcfe8",
    bg: "#fdf2f8",
    weekend: true,
  },
];

const WEEKDAYS = DAYS.filter((d) => !d.weekend);
const WEEKEND = DAYS.filter((d) => d.weekend);
const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.id, d.short]));

// A session counts as "reviewed/sent" if it was uploaded/reviewed, OR if it was
// rescheduled and its make-up class has since been marked done.
const countsAsSent = (e) =>
  e.status === "uploaded" ||
  e.status === "reviewed" ||
  (e.status === "rescheduled" && !!e.makeupDay);

const TUTOR_COLORS = [
  { color: "#0891b2", bg: "#cffafe" },
  { color: "#d97706", bg: "#fef3c7" },
  { color: "#9333ea", bg: "#f3e8ff" },
  { color: "#dc2626", bg: "#fee2e2" },
  { color: "#0d9488", bg: "#ccfbf1" },
];

const STATUS = {
  pending: {
    label: "Pending",
    color: "#64748b",
    bg: "#f1f5f9",
    next: "uploaded",
  },
  uploaded: {
    label: "Uploaded",
    color: "#d97706",
    bg: "#fef3c7",
    next: "reviewed",
  },
  reviewed: {
    label: "Reviewed",
    color: "#16a34a",
    bg: "#dcfce7",
    next: "absent",
  },
  absent: {
    label: "Absent",
    color: "#9a3412",
    bg: "#fed7aa",
    next: "cancelled",
  },
  cancelled: {
    label: "Cancelled",
    color: "#6b21a8",
    bg: "#f3e8ff",
    next: "rescheduled",
  },
  rescheduled: {
    label: "Rescheduled",
    color: "#0369a1",
    bg: "#e0f2fe",
    next: "pending",
  },
};

const PRIORITY = {
  normal: { label: "Normal", color: "#64748b", icon: "", rank: 2 },
  watch: { label: "Watch", color: "#d97706", icon: "⚠️", rank: 1 },
  focus: { label: "Focus", color: "#dc2626", icon: "⭐", rank: 0 },
};

const EMPTY_WEEK = () => ({ mon: [], tue: [], wed: [], thu: [], fri: [] });

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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fmtShort(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function weekKey(monday) {
  const d = new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function sortStudentsByPriority(students) {
  return [...students].sort((a, b) => {
    const ra = PRIORITY[a.priority || "normal"].rank;
    const rb = PRIORITY[b.priority || "normal"].rank;
    return ra - rb;
  });
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/**
 * Determine whether a student is active, stopped, or future-stopped for this week.
 * Returns one of:
 *   "active"          → no end date, or end date is in the future (>= this week's end)
 *   "stopping"        → end date falls within this week (last week with this tutor)
 *   "stopped"         → end date was before this week started
 */
function getStudentLifecycle(student, weekMonday) {
  if (!student.endDate) return "active";
  const weekStartISO = fmtISO(weekMonday);
  const weekEndISO = fmtISO(addDays(weekMonday, 6));
  if (student.endDate < weekStartISO) return "stopped";
  if (student.endDate <= weekEndISO) return "stopping";
  return "active";
}

/**
 * Decide if the student should be visible in the schedule grid.
 * - "active" and "stopping": show normally
 * - "stopped": show ONLY if this week is in the past (so user sees history),
 *              hide if this is current or future week.
 */
function shouldShowStudent(student, weekMonday, todayMonday) {
  const lifecycle = getStudentLifecycle(student, weekMonday);
  if (lifecycle !== "stopped") return true;
  // Stopped student — only show in past weeks
  return fmtISO(weekMonday) < fmtISO(todayMonday);
}

/**
 * CalendarGridView — Tutor (rows) x Day (columns) timetable view inside the Audio Report.
 * Each cell shows all sessions for that tutor on that day, with their custom time,
 * student name, and status. Click a session to edit it; click empty space to prefill
 * the Add Session form with that tutor + day.
 */
/**
 * CalendarGridView — Tutor (rows) x Day (columns) timetable view inside the Audio Report.
 * Each cell shows all sessions for that tutor on that day, with their custom time,
 * student name, and status.
 * - Click a session chip to edit it
 * - Drag a session chip onto another cell to move it (Ctrl+drag to copy)
 * - 📋 button on a chip copies it; click an empty/add slot with something copied to paste
 * - + on empty cells / "+ add" under existing sessions opens the Add Session form prefilled
 */
function CalendarGridView({
  entries,
  weekMonday,
  onCellClick,
  onAddClick,
  sessionClipboard,
  onCopySession,
  onPasteSession,
  onMoveSession,
  onDuplicateSession,
  onDeleteSession,
  onMakeupDone,
  onMakeupUndo,
}) {
  const tutorNames = [...new Set(entries.map((e) => e.tutorName))].sort();
  const dragRef = useRef(null);
  const [dragOverCell, setDragOverCell] = useState(null); // `${tutorName}|${dayId}`
  const [makeupMenu, setMakeupMenu] = useState(null); // { entry, x, y }

  if (tutorNames.length === 0) {
    return (
      <div
        style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8" }}
      >
        No sessions yet — add one using the form on the left.
      </div>
    );
  }

  const fmtTime = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleDragStart = (e, entry) => {
    dragRef.current = { entryId: entry.id, isCopy: e.ctrlKey || e.metaKey };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCellDragOver = (e, tutorName, dayId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(`${tutorName}|${dayId}`);
  };

  const handleCellDrop = (e, tutorName, dayId) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!dragRef.current) return;
    const { entryId, isCopy } = dragRef.current;
    dragRef.current = null;
    const entry = entries.find((x) => x.id === entryId);
    if (!entry) return;
    if (isCopy) {
      onDuplicateSession({ ...entry, tutorName, dayId });
    } else {
      onMoveSession(entryId, tutorName, dayId);
    }
  };

  return (
    <div style={styles.gridViewWrap}>
      {sessionClipboard && (
        <div style={styles.gridClipboardBar}>
          <span>
            📋 Copied: <strong>{sessionClipboard.studentName}</strong> (
            {sessionClipboard.tutorName})
          </span>
          <span style={{ color: "#94a3b8" }}>
            — click any + button to paste here
          </span>
        </div>
      )}
      <table style={styles.gridTable}>
        <thead>
          <tr>
            <th style={styles.gridTableTutorHeaderCell}>Tutor</th>
            {DAYS.map((day) => {
              const date = addDays(weekMonday, day.offset);
              return (
                <th
                  key={day.id}
                  style={{
                    ...styles.gridTableDayHeaderCell,
                    background: day.color,
                  }}
                >
                  <div>{day.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>
                    {fmtShort(date)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tutorNames.map((tutorName, ti) => {
            const tutorColor = [
              "#2563eb",
              "#0891b2",
              "#0d9488",
              "#7c3aed",
              "#dc2626",
              "#d97706",
            ][ti % 6];
            return (
              <tr key={tutorName}>
                <td
                  style={{
                    ...styles.gridTableTutorCell,
                    borderLeft: `4px solid ${tutorColor}`,
                  }}
                >
                  <span
                    style={{
                      ...styles.gridTutorAvatar,
                      background: tutorColor,
                    }}
                  >
                    {tutorName.charAt(0).toUpperCase()}
                  </span>
                  {tutorName}
                </td>
                {DAYS.map((day) => {
                  const cellEntries = entries.filter(
                    (e) => e.tutorName === tutorName && e.dayId === day.id,
                  );
                  const cellKey = `${tutorName}|${day.id}`;
                  const isDragOver = dragOverCell === cellKey;
                  return (
                    <td
                      key={day.id}
                      style={{
                        ...styles.gridTableCell,
                        background: isDragOver
                          ? "#dbeafe"
                          : styles.gridTableCell.background,
                        outline: isDragOver ? "2px dashed #2563eb" : "none",
                      }}
                      onDragOver={(e) =>
                        handleCellDragOver(e, tutorName, day.id)
                      }
                      onDragLeave={() => setDragOverCell(null)}
                      onDrop={(e) => handleCellDrop(e, tutorName, day.id)}
                    >
                      {cellEntries.length === 0 ? (
                        <button
                          style={styles.gridEmptyCellBtn}
                          onClick={() =>
                            sessionClipboard
                              ? onPasteSession(tutorName, day.id)
                              : onAddClick(tutorName, day.id)
                          }
                          title={
                            sessionClipboard
                              ? "Click to paste copied session here"
                              : `Add a session for ${tutorName} on ${day.label}`
                          }
                        >
                          {sessionClipboard ? "📋" : "+"}
                        </button>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          {cellEntries
                            .slice()
                            .sort((a, b) => {
                              if (!a.sessionTime) return 1;
                              if (!b.sessionTime) return -1;
                              return (
                                new Date(a.sessionTime) -
                                new Date(b.sessionTime)
                              );
                            })
                            .map((entry) => {
                              const sc =
                                STATUS[entry.status]?.color || "#64748b";
                              const sb = STATUS[entry.status]?.bg || "#f1f5f9";
                              const time = fmtTime(entry.sessionTime);
                              return (
                                <div
                                  key={entry.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, entry)}
                                  onContextMenu={(e) => {
                                    // Only rescheduled sessions get the make-up menu
                                    if (entry.status !== "rescheduled") return;
                                    e.preventDefault();
                                    setMakeupMenu({
                                      entry,
                                      x: e.clientX,
                                      y: e.clientY,
                                    });
                                  }}
                                  style={{
                                    ...styles.gridSessionChip,
                                    background: sb,
                                    borderColor: sc + "55",
                                    cursor: "grab",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 4,
                                    }}
                                  >
                                    <button
                                      style={{
                                        flex: 1,
                                        textAlign: "left",
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: 0,
                                        fontFamily: "inherit",
                                      }}
                                      onClick={() => onCellClick(entry)}
                                      title={
                                        entry.status === "rescheduled"
                                          ? "Click to edit · right-click for make-up options"
                                          : "Click to edit this session"
                                      }
                                    >
                                      {time && (
                                        <div
                                          style={{
                                            fontSize: 9.5,
                                            fontWeight: 800,
                                            color: sc,
                                          }}
                                        >
                                          {time}
                                        </div>
                                      )}
                                      <div
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 700,
                                          color: "#0f172a",
                                        }}
                                      >
                                        {entry.studentName}
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 9.5,
                                            fontWeight: 700,
                                            color: sc,
                                          }}
                                        >
                                          {STATUS[entry.status]?.label}
                                        </span>
                                        <span
                                          title={
                                            entry.materialStatus === "sent"
                                              ? "Material sent"
                                              : entry.materialStatus === "none"
                                                ? "Tutor said no material"
                                                : "Material not answered yet"
                                          }
                                          style={{ fontSize: 9.5 }}
                                        >
                                          {entry.materialStatus === "sent"
                                            ? "📚✅"
                                            : entry.materialStatus === "none"
                                              ? "📚🚫"
                                              : "📚❓"}
                                        </span>
                                        {entry.makeupDay && (
                                          <span
                                            title={`Make-up done on ${DAY_LABEL[entry.makeupDay] || entry.makeupDay}`}
                                            style={{
                                              fontSize: 9,
                                              fontWeight: 800,
                                              color: "#15803d",
                                              background: "#dcfce7",
                                              padding: "1px 5px",
                                              borderRadius: 999,
                                            }}
                                          >
                                            ✓ make-up{" "}
                                            {DAY_LABEL[entry.makeupDay] ||
                                              entry.makeupDay}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                    <button
                                      style={styles.gridChipCopyBtn}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onCopySession(entry);
                                      }}
                                      title="Copy this session"
                                    >
                                      📋
                                    </button>
                                    <button
                                      style={styles.gridChipDeleteBtn}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSession(entry.id);
                                      }}
                                      title="Delete this session"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          <button
                            style={styles.gridAddMoreBtn}
                            onClick={() =>
                              sessionClipboard
                                ? onPasteSession(tutorName, day.id)
                                : onAddClick(tutorName, day.id)
                            }
                            title={
                              sessionClipboard
                                ? "Paste copied session here"
                                : "Add another session"
                            }
                          >
                            {sessionClipboard ? "📋 paste" : "+ add"}
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={styles.gridHint}>
        💡 Drag a session chip to move it · hold{" "}
        <kbd style={styles.kbd}>Ctrl</kbd> while dragging to copy · click 📋 on
        a chip to copy, then click any + to paste ·{" "}
        <strong>right-click a Rescheduled session</strong> to mark its make-up
        done
      </div>

      {makeupMenu && (
        <>
          <div
            onClick={() => setMakeupMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMakeupMenu(null);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
          />
          <div
            style={{
              ...styles.makeupMenu,
              left: Math.min(makeupMenu.x, window.innerWidth - 220),
              top: Math.min(makeupMenu.y, window.innerHeight - 260),
            }}
          >
            <div style={styles.makeupMenuHeader}>
              🔁 {makeupMenu.entry.studentName}
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>
                Rescheduled from{" "}
                {DAY_LABEL[makeupMenu.entry.dayId] || makeupMenu.entry.dayId}
              </div>
            </div>
            {makeupMenu.entry.makeupDay ? (
              <>
                <div style={styles.makeupMenuNote}>
                  ✓ Make-up done on{" "}
                  <strong>
                    {DAY_LABEL[makeupMenu.entry.makeupDay] ||
                      makeupMenu.entry.makeupDay}
                  </strong>
                </div>
                <button
                  style={styles.makeupMenuUndo}
                  onClick={() => {
                    onMakeupUndo(makeupMenu.entry);
                    setMakeupMenu(null);
                  }}
                >
                  ↩ Undo make-up done
                </button>
              </>
            ) : (
              <>
                <div style={styles.makeupMenuLabel}>
                  ✅ Make-up class happened on:
                </div>
                <div style={styles.makeupMenuDays}>
                  {DAYS.map((d) => (
                    <button
                      key={d.id}
                      style={{
                        ...styles.makeupMenuDayBtn,
                        borderColor: d.color + "55",
                        color: d.color,
                      }}
                      onClick={() => {
                        onMakeupDone(makeupMenu.entry, d.id);
                        setMakeupMenu(null);
                      }}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function WeeklySchedule() {
  const today = useMemo(() => new Date(), []);
  const [weekMonday, setWeekMonday] = useState(() => getMonday(today));
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [schedule, setSchedule] = useState(EMPTY_WEEK());
  const [weekStatus, setWeekStatus] = useState({});
  const [dayNotes, setDayNotes] = useState({});
  const [audioReceived, setAudioReceived] = useState({});
  const [manualEntries, setManualEntries] = useState([]);
  const [expectations, setExpectations] = useState({});
  const [weekExpectations, setWeekExpectations] = useState({});
  const [tutorGroups, setTutorGroups] = useState([]); // [{id, name, members:[tutorName]}]
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // shown briefly during any action
  const [error, setError] = useState("");

  const wKey = weekKey(weekMonday);

  // CORE: reload from server — this is the source of truth
  const reload = useCallback(async () => {
    setError("");
    try {
      const [sched, status, notes, received, manual, exp, weekExp, groups] =
        await Promise.all([
          api.getWeek(wKey),
          api.getStatus(wKey),
          api.getDayNotes(wKey).catch(() => ({})),
          api.getAudioReceived(wKey).catch(() => ({})),
          api.getManualEntries(wKey).catch(() => []),
          api.getExpectations().catch(() => ({})),
          api.getWeekExpectations(wKey).catch(() => ({})),
          api.getTutorGroups().catch(() => []),
        ]);
      setSchedule(sched);
      setWeekStatus(status);
      setDayNotes(notes || {});
      setAudioReceived(received || {});
      setManualEntries(manual || []);
      setExpectations(exp || {});
      setWeekExpectations(weekExp || {});
      setTutorGroups(groups || []);
    } catch (err) {
      setError(err.message || "Failed to load");
    }
  }, [wKey]);

  // Initial / week-change load
  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);
  useEffect(() => {
    const ANCHOR = "2026-05-18";
    const anchor = new Date(ANCHOR);
    const now = new Date();
    const diff = Math.floor((now - anchor) / 86400000);
    const periodIndex = Math.floor(diff / 14);
    const periodStart = new Date(anchor);
    periodStart.setDate(anchor.getDate() + periodIndex * 14);
    const periodEnd = addDays(periodStart, 13);
    const afterEnd = addDays(periodEnd, 1);
    const daysUntilTue = (2 - afterEnd.getDay() + 7) % 7;
    const dueDate =
      afterEnd.getDay() === 2 ? afterEnd : addDays(afterEnd, daysUntilTue);

    const isToday = (d) => d.toDateString() === now.toDateString();
    if (!isToday(dueDate)) return; // only act on due Tuesdays

    // Request browser notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Schedule 9:00 PM browser notification
    const ninepm = new Date(now);
    ninepm.setHours(21, 0, 0, 0);
    const msUntil9pm = ninepm - now;

    if (msUntil9pm > 0 && Notification.permission === "granted") {
      const timer = setTimeout(() => {
        new Notification("📊 Bi-Weekly Report Due Now!", {
          body: `Submit the bi-weekly report for ${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          icon: "/favicon.ico",
          tag: "biweekly-reminder",
        });
      }, msUntil9pm);
      return () => clearTimeout(timer);
    }
  }, []);

  // Wrapper that runs an API action, then ALWAYS reloads from server
  const run = async (action, successMsg) => {
    setBusy(true);
    try {
      await action();
      await reload();
      if (successMsg) flash(successMsg);
    } catch (err) {
      flash(err.message || "Error");
      await reload(); // even on error, refetch in case of partial change
    } finally {
      setBusy(false);
    }
  };

  const [tutorModal, setTutorModal] = useState(null);
  const [tutorInput, setTutorInput] = useState("");
  const [studentModal, setStudentModal] = useState(null);
  const [studentForm, setStudentForm] = useState({
    name: "",
    priority: "normal",
    focusNote: "",
  });
  const [activeReview, setActiveReview] = useState(null);

  const [renaming, setRenaming] = useState(null);
  const renameInputRef = useRef(null);
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  const [focusEditor, setFocusEditor] = useState(null);
  const [endDatePicker, setEndDatePicker] = useState(null); // { studentId, studentName, currentEndDate, value }
  const [toast, setToast] = useState(null);
  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const [clipboard, setClipboard] = useState(null);
  const [activeMobileDay, setActiveMobileDay] = useState(() => {
    const day = new Date().getDay(); // 0=Sun,1=Mon,...,6=Sat
    const dayMap = {
      0: "sun",
      1: "mon",
      2: "tue",
      3: "wed",
      4: "thu",
      5: "fri",
      6: "sat",
    };
    return dayMap[day] || "mon";
  });
  const [showReport, setShowReport] = useState(false);
  const [showOverdueView, setShowOverdueView] = useState(false);
  const [showDailyReminder, setShowDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("21:00"); // default 9:00 PM
  const [reminderScheduled, setReminderScheduled] = useState(false);
  const [dailyReportCheck, setDailyReportCheck] = useState(null); // { entryId, tutorName, studentName, dayId, checked: {} }
  const [reportViewMode, setReportViewMode] = useState("grouped"); // "grouped" | "grid"
  const [sessionClipboard, setSessionClipboard] = useState(null);
  const sessionDragRef = useRef(null);
  const formPanelRef = useRef(null);
  const [formHighlight, setFormHighlight] = useState(false);
  const [showBiweeklySummary, setShowBiweeklySummary] = useState(false);
  const [biweeklyStartDate, setBiweeklyStartDate] = useState("");
  const [biweeklyData, setBiweeklyData] = useState(null);
  const [biweeklyLoading, setBiweeklyLoading] = useState(false);
  const BIWEEKLY_ANCHOR = "2026-05-18"; // first period start — adjust as needed

  // Calculate which bi-weekly period today falls in, based on anchor
  const getCurrentBiweeklyStart = () => {
    const anchor = new Date(BIWEEKLY_ANCHOR);
    const diff = Math.floor((today - anchor) / 86400000); // days since anchor
    const periodIndex = Math.floor(diff / 14);
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + periodIndex * 14);
    return fmtISO(start);
  };
  const [reportWeekMonday, setReportWeekMonday] = useState(() =>
    getMonday(today),
  );
  const reportWKey = weekKey(reportWeekMonday);
  const [reportManualEntries, setReportManualEntries] = useState([]);
  const [reportWeekExpectations, setReportWeekExpectations] = useState({});
  const [reportAudioReceived, setReportAudioReceived] = useState({});
  const [reportDayNotes, setReportDayNotes] = useState({});
  const [reportLoading, setReportLoading] = useState(false);
  const [manualForm, setManualForm] = useState({
    tutorName: "",
    studentName: "",
    dayId: "mon",
    status: "pending",
    audioFilename: "",
    groupId: "",
    sessionTime: "",
  });
  const [editingExpectation, setEditingExpectation] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null); // { id, tutorName, studentName, dayId, status, audioFilename }
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const g = await api.createTutorGroup(newGroupName.trim());
      setTutorGroups((p) => [...p, g]);
      setNewGroupName("");
      flash(`Group "${g.name}" created`);
    } catch (err) {
      flash(err.message || "Failed");
    }
  };

  const deleteGroup = async (id, name) => {
    try {
      await api.deleteTutorGroup(id);
      setTutorGroups((p) => p.filter((g) => g.id !== id));
      flash(`Group "${name}" deleted`);
    } catch (err) {
      flash(err.message || "Failed");
    }
  };

  const assignTutorToGroup = async (groupId, tutorName) => {
    try {
      if (!groupId) {
        await api.removeTutorFromGroup(tutorName);
      } else {
        await api.assignTutorToGroup(groupId, tutorName);
      }
      // Reload groups from server to ensure accurate state
      const groups = await api.getTutorGroups().catch(() => []);
      setTutorGroups(groups || []);
      flash(groupId ? `Assigned to group` : `Removed from group`);
    } catch (err) {
      flash(err.message || "Failed");
    }
  };

  // Get group for a tutor name
  const getTutorGroup = (tutorName) =>
    tutorGroups.find((g) => g.members.includes(tutorName)) || null; // { tutorName, minSessions, minDays, weekOverride }

  const saveExpectation = async (tutorName, minSessions, minDays, weekOnly) => {
    try {
      if (weekOnly) {
        if (!minSessions && !minDays) {
          await api.deleteWeekExpectation(wKey, tutorName);
          setWeekExpectations((p) => {
            const n = { ...p };
            delete n[tutorName];
            return n;
          });
        } else {
          await api.setWeekExpectation(wKey, tutorName, minSessions, minDays);
          setWeekExpectations((p) => ({
            ...p,
            [tutorName]: { minSessions, minDays },
          }));
        }
      } else {
        // Save both permanent and week override
        await Promise.all([
          api.setExpectation(tutorName, minSessions, minDays),
          api.setWeekExpectation(wKey, tutorName, minSessions, minDays),
        ]);
        setExpectations((p) => ({
          ...p,
          [tutorName]: { minSessions, minDays },
        }));
        setWeekExpectations((p) => ({
          ...p,
          [tutorName]: { minSessions, minDays },
        }));
      }
      flash("Expectation saved");
    } catch (err) {
      flash(err.message || "Failed to save");
    }
  };

  // Get effective expectation for a tutor (week override takes priority)
  const getExpectation = (tutorName) => {
    return (
      reportWeekExpectations[tutorName] ||
      expectations[tutorName] || { minSessions: 0, minDays: 0 }
    );
  };

  const addManualEntry = async () => {
    const {
      tutorName,
      studentName,
      dayId,
      status,
      audioFilename,
      groupId,
      sessionTime,
    } = manualForm;
    if (!tutorName.trim() || !studentName.trim()) {
      flash("Enter tutor and student name");
      return;
    }
    try {
      const sessionTimeISO = sessionTime
        ? new Date(sessionTime).toISOString()
        : null;
      // If a filename was already typed in, treat that as "the audio was sent" even if
      // the status field itself is still sitting on its default "pending".
      const effectiveStatus =
        audioFilename.trim() && status === "pending" ? "uploaded" : status;
      const entry = await api.addManualEntry(
        reportWKey,
        tutorName.trim(),
        studentName.trim(),
        dayId,
        effectiveStatus,
        audioFilename.trim(),
        sessionTimeISO,
      );
      setReportManualEntries((p) => [...p, entry]);
      if (groupId && !getTutorGroup(tutorName.trim())) {
        await assignTutorToGroup(parseInt(groupId), tutorName.trim());
      }
      setManualForm((p) => ({
        ...p,
        studentName: "",
        audioFilename: "",
        sessionTime: "",
      }));
      flash("Entry added");
    } catch (err) {
      flash(err.message || "Failed to add");
    }
  };

  const deleteManualEntry = async (id) => {
    try {
      await api.deleteManualEntry(id);
      setReportManualEntries((p) => p.filter((e) => e.id !== id));
      flash("Removed");
    } catch (err) {
      flash(err.message || "Failed to remove");
    }
  };

  // Copy a session entry to clipboard
  const copySessionEntry = (entry) => {
    setSessionClipboard(entry);
    flash(`Copied ${entry.studentName}'s session`);
  };

  // Paste the clipboard session into a new tutor/day slot
  const pasteSessionEntry = async (tutorName, dayId) => {
    if (!sessionClipboard) return;
    try {
      const src = sessionClipboard;
      // If pasting onto the same day, shift the session time to the new day but keep the time-of-day
      let newSessionTime = null;
      if (src.sessionTime) {
        const day = DAYS.find((d) => d.id === dayId);
        const targetDate = addDays(reportWeekMonday, day.offset);
        const srcTime = new Date(src.sessionTime);
        const merged = new Date(targetDate);
        merged.setHours(srcTime.getHours(), srcTime.getMinutes(), 0, 0);
        newSessionTime = merged.toISOString();
      }
      const entry = await api.addManualEntry(
        reportWKey,
        tutorName,
        src.studentName,
        dayId,
        "pending",
        src.audioFilename || "",
        newSessionTime,
      );
      setReportManualEntries((p) => [...p, entry]);
      flash(`Pasted ${src.studentName}'s session`);
    } catch (err) {
      flash(err.message || "Failed to paste");
    }
  };

  // Move (drag-drop) a session entry to a new tutor/day slot
  const moveSessionEntry = async (entryId, newTutorName, newDayId) => {
    try {
      await api.patchManualEntry(entryId, {
        tutorName: newTutorName,
        dayId: newDayId,
      });
      setReportManualEntries((p) =>
        p.map((e) =>
          e.id === entryId
            ? { ...e, tutorName: newTutorName, dayId: newDayId }
            : e,
        ),
      );
      flash("Session moved");
    } catch (err) {
      flash(err.message || "Failed to move");
    }
  };

  // Duplicate a session entry into the same slot (e.g. tutor sent 2 audios same day)
  const duplicateSessionEntry = async (entry) => {
    try {
      const newEntry = await api.addManualEntry(
        reportWKey,
        entry.tutorName,
        entry.studentName,
        entry.dayId,
        "pending",
        "",
        entry.sessionTime || null,
      );
      setReportManualEntries((p) => [...p, newEntry]);
      flash("Duplicated session");
    } catch (err) {
      flash(err.message || "Failed to duplicate");
    }
  };

  // Called when clicking "+" in the calendar grid — prefills the form and scrolls/highlights it
  // Build per-tutor WhatsApp reminder messages for sessions not yet uploaded/reviewed
  const buildDailyReminderMessages = () => {
    const now = new Date();
    const todayStr = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
      now.getDay()
    ];

    // Group pending/not-sent entries by tutor for today and overdue days
    const tutorMap = {};
    reportManualEntries.forEach((entry) => {
      const isSent = countsAsSent(entry);
      const isAbsent = entry.status === "absent";
      const isCancelled = entry.status === "cancelled";
      if (isSent || isAbsent || isCancelled) return;

      const day = DAYS.find((d) => d.id === entry.dayId);
      if (!day) return;

      // Include today's sessions AND any earlier days that are still pending
      const sessionDate = addDays(reportWeekMonday, day.offset);
      const sessionDateStr = fmtISO(sessionDate);
      const todayDateStr = fmtISO(now);
      if (sessionDateStr > todayDateStr) return; // skip future sessions

      if (!tutorMap[entry.tutorName]) tutorMap[entry.tutorName] = [];
      tutorMap[entry.tutorName].push({ ...entry, day });
    });

    return tutorMap;
  };

  // Schedule a browser notification at the set reminder time
  const scheduleDailyBrowserReminder = (timeStr) => {
    if (!("Notification" in window)) {
      flash("Browser notifications not supported");
      return;
    }
    if (Notification.permission === "default") Notification.requestPermission();
    const [h, m] = timeStr.split(":").map(Number);
    const now = new Date();
    const trigger = new Date(now);
    trigger.setHours(h, m, 0, 0);
    if (trigger <= now) trigger.setDate(trigger.getDate() + 1); // schedule for tomorrow if time passed
    const msUntil = trigger - now;
    const mins = Math.round(msUntil / 60000);
    setTimeout(() => {
      const overdueCount = Object.keys(buildDailyReminderMessages()).length;
      if (overdueCount > 0 && Notification.permission === "granted") {
        new Notification("🔔 Audio Reminder", {
          body: `${overdueCount} tutor${overdueCount !== 1 ? "s" : ""} haven't sent their audio yet. Open the Audio Report to follow up.`,
          icon: "/favicon.ico",
          tag: "daily-audio-reminder",
        });
      }
    }, msUntil);
    setReminderScheduled(true);
    flash(
      `✅ Browser reminder set for ${timeStr} (in ${mins} min${mins !== 1 ? "s" : ""})`,
    );
  };

  const handleGridAddClick = (tutorName, dayId) => {
    setManualForm((p) => ({ ...p, tutorName, dayId, studentName: "" }));
    if (formPanelRef.current) {
      formPanelRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    setFormHighlight(true);
    setTimeout(() => setFormHighlight(false), 1200);
    // Focus the student name input shortly after scrolling so the user can type immediately
    setTimeout(() => {
      const studentInput = formPanelRef.current?.querySelector(
        'input[placeholder="Student name"]',
      );
      if (studentInput) studentInput.focus();
    }, 350);
  };

  const patchManualEntry = async (id, fields) => {
    try {
      await api.patchManualEntry(id, fields);
      setReportManualEntries((p) =>
        p.map((e) => (e.id === id ? { ...e, ...fields } : e)),
      );
    } catch (err) {
      flash(err.message || "Failed to update");
    }
  };

  // Mark a rescheduled session's make-up as done on a given day.
  // Keeps status "rescheduled" (so the badge/history is preserved) but records makeupDay,
  // which makes it count as reviewed in the totals below.
  const handleMakeupDone = async (entry, makeupDayId) => {
    await patchManualEntry(entry.id, { makeupDay: makeupDayId });
    flash(
      `✅ Make-up marked done on ${DAY_LABEL[makeupDayId] || makeupDayId} — now counts as reviewed`,
    );
  };
  const handleMakeupUndo = async (entry) => {
    await patchManualEntry(entry.id, { makeupDay: null });
    flash("↩ Make-up done cleared");
  };
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (text) =>
    normalizedSearch
      ? (text || "").toLowerCase().includes(normalizedSearch)
      : false;

  const dragRef = useRef(null);
  const [dragHoverDay, setDragHoverDay] = useState(null);
  const [dragHoverTutor, setDragHoverTutor] = useState(null);

  const [ctxMenu, setCtxMenu] = useState(null);
  const closeCtxMenu = () => setCtxMenu(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => closeCtxMenu();
    window.addEventListener("click", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [ctxMenu]);

  const isCurrentWeek = fmtISO(weekMonday) === fmtISO(getMonday(today));
  const goPrev = () => setWeekMonday((d) => addDays(d, -7));
  const goNext = () => setWeekMonday((d) => addDays(d, 7));
  const goNow = () => {
    setWeekMonday(getMonday(new Date()));
    const day = new Date().getDay();
    const dayMap = {
      0: "sun",
      1: "mon",
      2: "tue",
      3: "wed",
      4: "thu",
      5: "fri",
      6: "sat",
    };
    setActiveMobileDay(dayMap[day] || "mon");
  };

  const copyFromPreviousWeek = async () => {
    const prevKey = weekKey(addDays(weekMonday, -7));
    if (
      !window.confirm(
        "Replace this week's schedule with a fresh copy of last week's?",
      )
    )
      return;
    run(() => api.copyWeekFrom(wKey, prevKey), "Copied from previous week");
  };
  const clearThisWeek = async () => {
    if (!window.confirm("Clear ALL tutors and students from this week only?"))
      return;
    run(() => api.clearWeek(wKey), "Cleared this week");
  };

  /* ---- Tutor CRUD ---- */
  const openAddTutor = (dayId) => {
    if ((schedule[dayId] || []).length >= MAX_TUTORS_PER_DAY) {
      flash(`${dayId.toUpperCase()} is full`);
      return;
    }
    setTutorInput("");
    setTutorModal({ dayId });
  };
  const submitTutor = async () => {
    if (!tutorModal) return;
    const name = tutorInput.trim();
    if (!name) {
      setTutorModal(null);
      return;
    }
    const { dayId } = tutorModal;
    setTutorModal(null);
    run(() => api.addTutor(wKey, dayId, name), "Tutor added");
  };
  const removeTutor = (dayId, tutorId) => {
    if (
      !window.confirm(
        "Remove this tutor and all their students from THIS WEEK?",
      )
    )
      return;
    run(() => api.removeTutor(tutorId), "Tutor removed");
  };

  /* ---- Student CRUD ---- */
  const openAddStudent = (dayId, tutor) => {
    if (tutor.students.length >= MAX_STUDENTS_PER_TUTOR) {
      flash(`${tutor.tutor} is full`);
      return;
    }
    setStudentForm({ name: "", priority: "normal", focusNote: "" });
    setStudentModal({
      mode: "add",
      dayId,
      tutorId: tutor.id,
      tutorName: tutor.tutor,
    });
  };
  const openEditStudent = (dayId, tutor, student) => {
    setStudentForm({
      name: student.name,
      priority: student.priority || "normal",
      focusNote: student.focusNote || "",
    });
    setStudentModal({
      mode: "edit",
      dayId,
      tutorId: tutor.id,
      tutorName: tutor.tutor,
      studentId: student.id,
    });
  };
  const submitStudent = async () => {
    if (!studentModal) return;
    const name = studentForm.name.trim();
    if (!name) {
      setStudentModal(null);
      return;
    }
    const sm = studentModal;
    const form = studentForm;
    setStudentModal(null);
    if (sm.mode === "edit") {
      run(
        () =>
          api.patchStudent(sm.studentId, {
            name,
            priority: form.priority,
            focusNote: form.focusNote,
          }),
        "Student updated",
      );
    } else {
      run(
        () => api.addStudent(sm.tutorId, name, form.priority, form.focusNote),
        "Student added",
      );
    }
  };
  const removeStudent = (dayId, tutorId, studentId) => {
    if (!window.confirm("Remove this student from THIS WEEK?")) return;
    run(() => api.removeStudent(studentId), "Student removed");
  };

  /* ---- Rename ---- */
  const startRenameTutor = (dayId, tutor, e) => {
    e?.stopPropagation();
    setRenaming({
      type: "tutor",
      dayId,
      tutorId: tutor.id,
      value: tutor.tutor,
    });
  };
  const startRenameStudent = (dayId, tutorId, student, e) => {
    e?.stopPropagation();
    setRenaming({
      type: "student",
      dayId,
      tutorId,
      studentId: student.id,
      value: student.name,
    });
  };
  const cancelRename = () => setRenaming(null);
  const commitRename = async () => {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (!value) {
      cancelRename();
      return;
    }
    const r = renaming;
    cancelRename();
    if (r.type === "tutor") {
      run(() => api.patchTutor(r.tutorId, { tutor: value }), "Renamed");
    } else {
      run(() => api.patchStudent(r.studentId, { name: value }), "Renamed");
    }
  };

  /* ---- Priority / focus ---- */
  const setStudentPriority = (dayId, tutorId, studentId, priority) => {
    run(
      () => api.patchStudent(studentId, { priority }),
      `Set to ${PRIORITY[priority].label}`,
    );
  };
  const openFocusEditor = (dayId, tutorId, student) => {
    setFocusEditor({
      dayId,
      tutorId,
      studentId: student.id,
      studentName: student.name,
      value: student.focusNote || "",
      priority: student.priority || "normal",
      endDate: student.endDate || "",
      isTemporary: !!student.isTemporary,
    });
  };

  const openEndDatePicker = (dayId, tutorId, student) => {
    setEndDatePicker({
      studentId: student.id,
      studentName: student.name,
      currentEndDate: student.endDate || "",
      value: student.endDate || "",
    });
  };
  const saveEndDate = async () => {
    if (!endDatePicker) return;
    const e = endDatePicker;
    setEndDatePicker(null);
    run(
      () => api.patchStudent(e.studentId, { endDate: e.value || null }),
      e.value
        ? `${e.studentName} will stop on ${e.value}`
        : `Stop date cleared`,
    );
  };
  const saveFocusEditor = async () => {
    if (!focusEditor) return;
    const fe = focusEditor;
    setFocusEditor(null);
    run(
      () =>
        api.patchStudent(fe.studentId, {
          priority: fe.priority,
          focusNote: fe.value,
          endDate: fe.endDate || null,
          isTemporary: fe.isTemporary,
        }),
      "Updated",
    );
  };

  /* ---- Status & session ---- */
  const cycleStatus = async (studentId, e) => {
    e.stopPropagation();
    const current = weekStatus[studentId] || "pending";
    const next = STATUS[current].next;
    setWeekStatus((w) => ({ ...w, [studentId]: next })); // optimistic for snappy feel
    try {
      await api.setStatus(wKey, studentId, next);
    } catch (err) {
      flash(err.message);
      reload();
    }
  };
  const toggleAbsent = async (studentId) => {
    const current = weekStatus[studentId] || "pending";
    const next = current === "absent" ? "pending" : "absent";
    setWeekStatus((w) => ({ ...w, [studentId]: next }));
    try {
      await api.setStatus(wKey, studentId, next);
      flash(next === "absent" ? "Marked as Absent" : "Absent cleared");
    } catch (err) {
      flash(err.message);
      reload();
    }
  };

  const toggleCancel = async (studentId) => {
    const current = weekStatus[studentId] || "pending";
    const next = current === "cancelled" ? "pending" : "cancelled";
    setWeekStatus((w) => ({ ...w, [studentId]: next }));
    try {
      await api.setStatus(wKey, studentId, next);
      flash(next === "cancelled" ? "Marked as Cancelled" : "Cancelled cleared");
    } catch (err) {
      flash(err.message);
      reload();
    }
  };
  const openSession = async (dayOffset, tutorName, student) => {
    const date = addDays(weekMonday, dayOffset);
    setActiveReview({
      tutor: tutorName,
      student: student.name,
      studentId: student.id,
      date: fmtISO(date),
      key: `${student.id}-${Date.now()}`,
    });
    if ((weekStatus[student.id] || "pending") !== "reviewed") {
      setWeekStatus((w) => ({ ...w, [student.id]: "reviewed" }));
      try {
        await api.setStatus(wKey, student.id, "reviewed");
      } catch {}
    }
  };

  /* ---- Copy / paste ---- */
  const copyTutor = (tutor, e) => {
    e?.stopPropagation();
    setClipboard({ type: "tutor", data: tutor });
    flash(`Copied tutor "${tutor.tutor}"`);
  };
  const copyStudent = (student, e) => {
    e?.stopPropagation();
    setClipboard({ type: "student", data: student });
    flash(`Copied student "${student.name}"`);
  };
  const pasteTutor = (targetDayId) => {
    if (!clipboard || clipboard.type !== "tutor") return;
    if ((schedule[targetDayId] || []).length >= MAX_TUTORS_PER_DAY) {
      flash(`${targetDayId.toUpperCase()} is full`);
      return;
    }
    run(
      () => api.duplicateTutor(wKey, clipboard.data.id, targetDayId),
      `Pasted into ${targetDayId.toUpperCase()}`,
    );
  };
  const pasteStudent = (targetDayId, targetTutorId) => {
    if (!clipboard || clipboard.type !== "student") return;
    const tutor = (schedule[targetDayId] || []).find(
      (t) => t.id === targetTutorId,
    );
    if (!tutor) return;
    if (tutor.students.length >= MAX_STUDENTS_PER_TUTOR) {
      flash(`${tutor.tutor} is full`);
      return;
    }
    const d = clipboard.data;
    run(
      () =>
        api.addStudent(
          targetTutorId,
          d.name,
          d.priority || "normal",
          d.focusNote || "",
        ),
      `Pasted student`,
    );
  };
  const duplicateTutorSameDay = (tutor, e) => {
    e?.stopPropagation();
    run(
      () => api.duplicateTutor(wKey, tutor.id),
      `Duplicated "${tutor.tutor}"`,
    );
  };

  /* ---- Drag & drop ---- */
  const onTutorDragStart = (e, dayId, tutor) => {
    e.stopPropagation();
    const isCopy = e.ctrlKey || e.metaKey || e.shiftKey;
    dragRef.current = { type: "tutor", dayId, tutorId: tutor.id, copy: isCopy };
    e.dataTransfer.effectAllowed = isCopy ? "copy" : "move";
    try {
      e.dataTransfer.setData("text/plain", tutor.tutor);
    } catch {}
  };
  const onStudentDragStart = (e, dayId, tutorId, student) => {
    e.stopPropagation();
    const isCopy = e.ctrlKey || e.metaKey || e.shiftKey;
    dragRef.current = {
      type: "student",
      dayId,
      tutorId,
      studentId: student.id,
      copy: isCopy,
    };
    e.dataTransfer.effectAllowed = isCopy ? "copy" : "move";
    try {
      e.dataTransfer.setData("text/plain", student.name);
    } catch {}
  };
  const onDragEnd = () => {
    dragRef.current = null;
    setDragHoverDay(null);
    setDragHoverTutor(null);
  };

  const onDayDragOver = (e, dayId) => {
    if (!dragRef.current || dragRef.current.type !== "tutor") return;
    e.preventDefault();
    e.dataTransfer.dropEffect =
      e.ctrlKey || e.metaKey || e.shiftKey ? "copy" : "move";
    setDragHoverDay(dayId);
  };
  const onDayDragLeave = (e, dayId) => {
    if (dragHoverDay === dayId) setDragHoverDay(null);
  };
  const onDayDrop = async (e, targetDayId) => {
    const drag = dragRef.current;
    setDragHoverDay(null);
    if (!drag || drag.type !== "tutor") return;
    e.preventDefault();
    e.stopPropagation();
    const isCopy = drag.copy || e.ctrlKey || e.metaKey || e.shiftKey;
    if (drag.dayId === targetDayId && !isCopy) return;
    if ((schedule[targetDayId] || []).length >= MAX_TUTORS_PER_DAY) {
      flash(`${targetDayId.toUpperCase()} is full`);
      return;
    }
    if (isCopy) {
      run(
        () => api.duplicateTutor(wKey, drag.tutorId, targetDayId),
        `Copied to ${targetDayId.toUpperCase()}`,
      );
    } else {
      run(
        () => api.patchTutor(drag.tutorId, { dayId: targetDayId }),
        `Moved to ${targetDayId.toUpperCase()}`,
      );
    }
  };

  const onTutorDropZoneDragOver = (e, targetDayId, targetTutorId) => {
    if (!dragRef.current || dragRef.current.type !== "student") return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect =
      e.ctrlKey || e.metaKey || e.shiftKey ? "copy" : "move";
    setDragHoverTutor(targetTutorId);
  };
  const onTutorDropZoneDragLeave = (e, targetTutorId) => {
    if (dragHoverTutor === targetTutorId) setDragHoverTutor(null);
  };
  const onTutorDropZoneDrop = async (e, targetDayId, targetTutorId) => {
    const drag = dragRef.current;
    setDragHoverTutor(null);
    if (!drag || drag.type !== "student") return;
    e.preventDefault();
    e.stopPropagation();
    const isCopy = drag.copy || e.ctrlKey || e.metaKey || e.shiftKey;
    if (drag.tutorId === targetTutorId && !isCopy) return;
    const targetTutor = (schedule[targetDayId] || []).find(
      (t) => t.id === targetTutorId,
    );
    if (!targetTutor) return;
    if (targetTutor.students.length >= MAX_STUDENTS_PER_TUTOR) {
      flash(`${targetTutor.tutor} is full`);
      return;
    }
    const sourceTutor = (schedule[drag.dayId] || []).find(
      (t) => t.id === drag.tutorId,
    );
    const student = sourceTutor?.students.find((s) => s.id === drag.studentId);
    if (!student) return;
    if (isCopy) {
      run(
        () =>
          api.addStudent(
            targetTutorId,
            student.name,
            student.priority || "normal",
            student.focusNote || "",
          ),
        "Student copied",
      );
    } else {
      run(
        () => api.patchStudent(drag.studentId, { tutorId: targetTutorId }),
        "Student moved",
      );
    }
  };

  const todayMonday = useMemo(() => getMonday(today), [today]);

  const summary = useMemo(() => {
    let total = 0,
      uploaded = 0,
      reviewed = 0,
      focusCount = 0,
      watchCount = 0,
      stoppedCount = 0,
      absentCount = 0;
    const perDay = {};
    DAYS.forEach((d) => {
      let dayTotal = 0,
        dayReviewed = 0;
      (schedule[d.id] || []).forEach((t) => {
        t.students.forEach((s) => {
          if (!shouldShowStudent(s, weekMonday, todayMonday)) return;
          const lifecycle = getStudentLifecycle(s, weekMonday);
          if (lifecycle === "stopped") {
            stoppedCount++;
            return;
          }
          const st = weekStatus[s.id] || "pending";
          if (st === "absent") {
            absentCount++;
            return;
          } // skip absent — not expected to attend
          total++;
          dayTotal++;
          if (st === "uploaded") uploaded++;
          if (st === "reviewed") {
            reviewed++;
            dayReviewed++;
          }
          if (s.priority === "focus") focusCount++;
          if (s.priority === "watch") watchCount++;
        });
      });
      perDay[d.id] = { total: dayTotal, reviewed: dayReviewed };
    });
    const pending = total - uploaded - reviewed;
    const remaining = total - reviewed;
    const pct = total === 0 ? 0 : Math.round((reviewed / total) * 100);
    return {
      total,
      uploaded,
      reviewed,
      pending,
      focusCount,
      watchCount,
      stoppedCount,
      absentCount,
      remaining,
      pct,
      perDay,
    };
  }, [schedule, weekStatus, weekMonday, todayMonday]);

  const weekSunday = addDays(weekMonday, 6);
  const weekLabel = `${fmtShort(weekMonday)} – ${fmtShort(weekSunday)}, ${weekSunday.getFullYear()}`;
  const showChecklist = !!activeReview;

  // Load report data for a specific week (independent from schedule week)
  const loadReportWeek = useCallback(async (monday) => {
    setReportLoading(true);
    const rKey = weekKey(monday);
    try {
      const [manual, weekExp, received, notes, groups] = await Promise.all([
        api.getManualEntries(rKey).catch(() => []),
        api.getWeekExpectations(rKey).catch(() => ({})),
        api.getAudioReceived(rKey).catch(() => ({})),
        api.getDayNotes(rKey).catch(() => ({})),
        api.getTutorGroups().catch(() => []),
      ]);
      setReportManualEntries(manual || []);
      setReportWeekExpectations(weekExp || {});
      setReportAudioReceived(received || {});
      setReportDayNotes(notes || {});
      setTutorGroups(groups || []); // always refresh groups when loading a week
    } catch (err) {
      flash("Failed to load report week");
    } finally {
      setReportLoading(false);
    }
  }, []);

  // When report opens or week changes, load that week's data
  const openReport = async () => {
    setShowReport(true);
    setReportLoading(true);
    try {
      // Try current week first, then next week, then prev week — open whichever has data
      const currentMonday = getMonday(today);
      const weeks = [
        addDays(currentMonday, 7), // next week
        currentMonday, // this week
        addDays(currentMonday, -7), // prev week
      ];
      for (const monday of weeks) {
        const entries = await api
          .getManualEntries(weekKey(monday))
          .catch(() => []);
        if (entries && entries.length > 0) {
          setReportWeekMonday(monday);
          const [weekExp, received, notes] = await Promise.all([
            api.getWeekExpectations(weekKey(monday)).catch(() => ({})),
            api.getAudioReceived(weekKey(monday)).catch(() => ({})),
            api.getDayNotes(weekKey(monday)).catch(() => ({})),
          ]);
          setReportManualEntries(entries);
          setReportWeekExpectations(weekExp || {});
          setReportAudioReceived(received || {});
          setReportDayNotes(notes || {});
          return;
        }
      }
      // No entries found anywhere — default to current week empty
      setReportWeekMonday(currentMonday);
      setReportManualEntries([]);
    } catch (err) {
      flash("Failed to load report");
    } finally {
      setReportLoading(false);
    }
  };

  const goReportPrev = () => {
    const m = addDays(reportWeekMonday, -7);
    setReportWeekMonday(m);
    loadReportWeek(m);
  };

  const goReportNext = () => {
    const m = addDays(reportWeekMonday, 7);
    setReportWeekMonday(m);
    loadReportWeek(m);
  };

  const goReportCurrent = () => {
    const m = getMonday(today);
    setReportWeekMonday(m);
    loadReportWeek(m);
    setManualForm((p) => ({ ...p, status: "uploaded" }));
  };

  /**
   * Copy this week's Audio Report calendar to next week.
   * Every session (tutor, student, day, time-of-day) carries over, but the status
   * resets to "pending" and audio filename/material flag are cleared, since next
   * week's sessions haven't happened yet.
   */
  const copyAudioCalendarToNextWeek = async () => {
    if (reportManualEntries.length === 0) {
      flash("Nothing to copy — this week is empty");
      return;
    }
    const nextMonday = addDays(reportWeekMonday, 7);
    const nextKey = weekKey(nextMonday);

    const existingNext = await api.getManualEntries(nextKey).catch(() => []);
    if (existingNext && existingNext.length > 0) {
      const ok = window.confirm(
        `Next week (${weekKey(nextMonday)}) already has ${existingNext.length} entries. Add this week's sessions on top of those?`,
      );
      if (!ok) return;
    }

    setReportLoading(true);
    try {
      const created = [];
      for (const entry of reportManualEntries) {
        // Skip cancelled sessions — no point carrying a cancelled slot forward
        if (entry.status === "cancelled") continue;

        let newSessionTime = null;
        if (entry.sessionTime) {
          const t = new Date(entry.sessionTime);
          newSessionTime = addDays(t, 7).toISOString();
        }

        const newEntry = await api.addManualEntry(
          nextKey,
          entry.tutorName,
          entry.studentName,
          entry.dayId,
          "pending",
          "",
          newSessionTime,
        );
        created.push(newEntry);
      }
      flash(
        `Copied ${created.length} session${created.length !== 1 ? "s" : ""} to next week — all set to Pending`,
      );
      // Jump to next week so the user can see the result immediately
      setReportWeekMonday(nextMonday);
      const refreshed = await api.getManualEntries(nextKey).catch(() => []);
      setReportManualEntries(refreshed || []);
    } catch (err) {
      flash(err.message || "Failed to copy to next week");
    } finally {
      setReportLoading(false);
    }
  };
  const loadBiweeklySummary = async (startDateStr) => {
    if (!startDateStr) return;
    setBiweeklyLoading(true);
    try {
      const start = new Date(startDateStr);
      const week1Monday = getMonday(start);
      const week2Monday = addDays(week1Monday, 7);
      const endDate = addDays(week1Monday, 13); // last day of 2-week period

      // Due date = Tuesday after the period ends
      const afterEnd = addDays(endDate, 1); // day after period ends
      const daysUntilTuesday = (2 - afterEnd.getDay() + 7) % 7; // 2 = Tuesday
      const dueDate = addDays(
        afterEnd,
        daysUntilTuesday === 0 ? 0 : daysUntilTuesday,
      );
      // If afterEnd is already Tuesday, use it; otherwise find next Tuesday
      const dueDateFinal = afterEnd.getDay() === 2 ? afterEnd : dueDate;

      const [entries1, entries2] = await Promise.all([
        api.getManualEntries(weekKey(week1Monday)).catch(() => []),
        api.getManualEntries(weekKey(week2Monday)).catch(() => []),
      ]);

      const allEntries = [...entries1, ...entries2];
      const tutorMap = {};

      allEntries.forEach((entry) => {
        // Key by student+tutor so same student with different tutors are separate
        const key = `${entry.studentName}||${entry.tutorName}`;
        if (!tutorMap[key]) {
          tutorMap[key] = {
            name: entry.studentName,
            tutorName: entry.tutorName,
            expected: 0,
            sent: 0,
            missing: 0,
            cancelled: 0,
            absent: 0,
            week1Sent: 0,
            week2Sent: 0,
            week1Expected: 0,
            week2Expected: 0,
          };
        }
        const t = tutorMap[key];
        const isSent = countsAsSent(entry);
        const isCancelled = entry.status === "cancelled";
        const isAbsent = entry.status === "absent";
        const isWeek1 = entries1.some((e) => e.id === entry.id);

        if (isCancelled) {
          t.cancelled++;
          return;
        } // skip cancelled — not expected
        if (isAbsent) {
          t.absent++;
          return;
        } // skip absent — not expected

        // Count as expected session
        t.expected++;
        if (isWeek1) t.week1Expected++;
        else t.week2Expected++;

        if (isSent) {
          t.sent++;
          if (isWeek1) t.week1Sent++;
          else t.week2Sent++;
        } else {
          t.missing++;
        }
      });

      setBiweeklyData({
        tutors: Object.values(tutorMap).sort((a, b) => b.sent - a.sent),
        week1Label: `${fmtShort(week1Monday)} – ${fmtShort(addDays(week1Monday, 6))}`,
        week2Label: `${fmtShort(week2Monday)} – ${fmtShort(addDays(week2Monday, 6))}`,
        startLabel: fmtShort(week1Monday),
        endLabel: fmtShort(endDate),
        dueLabel: fmtShort(dueDateFinal),
        isEndOfPeriod: fmtISO(today) >= fmtISO(dueDateFinal), // notify on due Tuesday
        isDueSoon:
          fmtISO(today) >= fmtISO(endDate) &&
          fmtISO(today) < fmtISO(dueDateFinal), // period ended, not yet due
      });
    } catch (err) {
      flash("Failed to load summary");
    } finally {
      setBiweeklyLoading(false);
    }
  };

  const saveEditEntry = async () => {
    if (!editingEntry) return;
    const {
      id,
      tutorName,
      studentName,
      dayId,
      status,
      audioFilename,
      sessionTime,
    } = editingEntry;
    // Safety net: a filename with status still left on "pending" is almost certainly an oversight.
    const effectiveStatus =
      audioFilename?.trim() && status === "pending" ? "uploaded" : status;
    try {
      await api.patchManualEntry(id, {
        tutorName,
        studentName,
        dayId,
        status: effectiveStatus,
        audioFilename,
        sessionTime,
      });
      setReportManualEntries((p) =>
        p.map((e) =>
          e.id === id ? { ...e, ...editingEntry, status: effectiveStatus } : e,
        ),
      );
      setEditingEntry(null);
      flash("Entry updated");
    } catch (err) {
      flash(err.message || "Failed to update");
    }
  };

  const markAudioReceived = async (tutorName, dayId, received) => {
    setAudioReceived((prev) => {
      const next = { ...prev };
      if (!next[tutorName]) next[tutorName] = {};
      if (received) next[tutorName][dayId] = true;
      else delete next[tutorName][dayId];
      return next;
    });
    try {
      await api.setAudioReceived(wKey, tutorName, dayId, received);
      flash(received ? `✅ Audio marked as received` : `Marking cleared`);
    } catch (err) {
      flash(err.message || "Failed to save");
      reload();
    }
  };

  // Save a day note (called from Audio Report modal)
  const saveDayNote = async (tutorName, dayId, note) => {
    // Optimistic update
    setDayNotes((prev) => {
      const next = { ...prev };
      if (!next[tutorName]) next[tutorName] = {};
      if (note.trim()) next[tutorName][dayId] = note;
      else delete next[tutorName][dayId];
      return next;
    });
    try {
      await api.setDayNote(wKey, tutorName, dayId, note);
      flash("Note saved");
    } catch (err) {
      flash(err.message || "Failed to save note");
      reload();
    }
  };

  /**
   * REPORT DATA: group sessions by tutor across the week, detect missed audio.
   * - "Audio Sent" = status is "uploaded" or "reviewed"
   * - "Missed" = day has passed AND status is still "pending"
   * - "Upcoming" = day is today or in the future, still pending
   */
  /**
   * Flat index of every student currently on the schedule, with their tutor and day(s).
   * Built from the REAL weekly schedule (not from past manual report entries), so
   * picking a student in the Audio Report form can auto-fill their tutor + day.
   * A student can appear more than once if they have sessions on multiple days.
   */
  const scheduleStudentIndex = useMemo(() => {
    const list = [];
    DAYS.forEach((day) => {
      (schedule[day.id] || []).forEach((tutor) => {
        (tutor.students || []).forEach((student) => {
          list.push({
            studentName: student.name,
            tutorName: tutor.tutor,
            dayId: day.id,
            dayLabel: day.label,
          });
        });
      });
    });
    return list;
  }, [schedule]);

  const reportData = useMemo(() => {
    const todayISO = fmtISO(today);
    const tutorMap = {};

    // Build report ONLY from manual entries — schedule data is not used here
    reportManualEntries.forEach((entry) => {
      const day = DAYS.find((d) => d.id === entry.dayId);
      if (!day) return;
      const dayDate = addDays(reportWeekMonday, day.offset);
      const dayDateISO = fmtISO(dayDate);
      const isPast = dayDateISO < todayISO;
      const isToday = dayDateISO === todayISO;
      const audioSent = countsAsSent(entry);
      const isAbsent = entry.status === "absent";

      if (!tutorMap[entry.tutorName]) {
        tutorMap[entry.tutorName] = {
          name: entry.tutorName,
          totalSessions: 0,
          sentSessions: 0,
          missedSessions: 0,
          upcomingSessions: 0,
          byDay: [],
        };
      }
      const e = tutorMap[entry.tutorName];

      if (!isAbsent) {
        e.totalSessions++;
        if (audioSent) e.sentSessions++;
        else if (isPast) e.missedSessions++;
        else e.upcomingSessions++;
      }

      // Find or create day entry
      let dayEntry = e.byDay.find((d) => d.dayId === entry.dayId);
      if (!dayEntry) {
        let dayStatus = "upcoming";
        if (isPast) dayStatus = audioSent ? "complete" : "missed";
        else if (isToday) dayStatus = audioSent ? "complete" : "today";
        dayEntry = {
          dayId: day.id,
          dayShort: day.short,
          dayColor: day.color,
          date: dayDate,
          isPast,
          isToday,
          dayStatus,
          sessions: [],
          absentStudents: [],
          note:
            (reportDayNotes[entry.tutorName] &&
              reportDayNotes[entry.tutorName][day.id]) ||
            "",
          isReceived: !!(
            reportAudioReceived[entry.tutorName] &&
            reportAudioReceived[entry.tutorName][day.id]
          ),
        };
        e.byDay.push(dayEntry);
      }

      // Update day status based on all sessions
      if (!isAbsent && isPast) {
        const allSent = [...dayEntry.sessions, { audioSent }].every(
          (s) => s.audioSent,
        );
        const someSent = [...dayEntry.sessions, { audioSent }].some(
          (s) => s.audioSent,
        );
        dayEntry.dayStatus = allSent
          ? "complete"
          : someSent
            ? "partial"
            : "missed";
      }

      if (isAbsent) {
        dayEntry.absentStudents.push({
          studentId: `m-${entry.id}`,
          studentName: entry.studentName,
        });
      } else {
        dayEntry.sessions.push({
          studentId: `m-${entry.id}`,
          studentName: entry.studentName,
          status: entry.status,
          audioSent,
          isMissed: isPast && !audioSent,
          isUpcoming: (isToday || !isPast) && !audioSent,
          manualId: entry.id,
        });
      }
    });

    const tutors = Object.values(tutorMap).sort((a, b) => {
      if (a.missedSessions !== b.missedSessions)
        return b.missedSessions - a.missedSessions;
      return a.name.localeCompare(b.name);
    });

    let totalSessions = 0,
      sent = 0,
      missed = 0,
      upcoming = 0,
      tutorsWithMissed = 0;
    let materialSent = 0,
      materialNone = 0,
      materialUnanswered = 0;
    tutors.forEach((t) => {
      totalSessions += t.totalSessions;
      sent += t.sentSessions;
      missed += t.missedSessions;
      upcoming += t.upcomingSessions;
      if (t.missedSessions > 0) tutorsWithMissed++;
    });
    reportManualEntries.forEach((entry) => {
      if (entry.status === "absent" || entry.status === "cancelled") return;
      const ms = entry.materialStatus || "unanswered";
      if (ms === "sent") materialSent++;
      else if (ms === "none") materialNone++;
      else materialUnanswered++;
    });

    return {
      tutors,
      totalSessions,
      sent,
      missed,
      upcoming,
      tutorsWithMissed,
      materialSent,
      materialNone,
      materialUnanswered,
    };
  }, [
    reportManualEntries,
    reportWeekMonday,
    today,
    reportDayNotes,
    reportAudioReceived,
  ]);

  /**
   * 24-Hour Overdue Tracker
   * A session is "overdue" if more than 24 hours have passed since the END of its
   * scheduled day (midnight after the session day) and the audio still hasn't been sent.
   * e.g. Monday session -> deadline is Tuesday midnight (24hrs after Monday ends)
   */
  const overdueData = useMemo(() => {
    const now = new Date();
    const items = [];

    reportManualEntries.forEach((entry) => {
      const day = DAYS.find((d) => d.id === entry.dayId);
      if (!day) return;
      const audioSent = countsAsSent(entry);
      const isAbsent = entry.status === "absent";
      const isCancelled = entry.status === "cancelled";
      if (audioSent || isAbsent || isCancelled) return; // not overdue if sent/absent/cancelled

      // The DAY of the session always comes from dayId (the source of truth) — a session
      // may have been moved to a different day while its old sessionTime date lingered.
      // We only borrow the TIME-OF-DAY from sessionTime, applied onto the correct day.
      let sessionMoment = addDays(reportWeekMonday, day.offset);
      if (entry.sessionTime) {
        const st = new Date(entry.sessionTime);
        sessionMoment.setHours(st.getHours(), st.getMinutes(), 0, 0);
      }
      // Deadline = session moment + 24 hours
      const deadline = new Date(sessionMoment);
      deadline.setHours(deadline.getHours() + 24);

      const hoursLate = Math.floor((now - deadline) / 3600000);
      const isOverdue = now > deadline;

      if (isOverdue) {
        items.push({
          id: entry.id,
          tutorName: entry.tutorName,
          studentName: entry.studentName,
          dayId: entry.dayId,
          dayShort: day.short,
          dayColor: day.color,
          sessionDate: sessionMoment,
          hasExactTime: !!entry.sessionTime,
          deadline,
          hoursLate,
          daysLate: Math.floor(hoursLate / 24),
          status: entry.status,
        });
      }
    });

    // Sort by most overdue first
    items.sort((a, b) => b.hoursLate - a.hoursLate);

    // Group by tutor
    const byTutor = {};
    items.forEach((item) => {
      if (!byTutor[item.tutorName]) byTutor[item.tutorName] = [];
      byTutor[item.tutorName].push(item);
    });

    return { items, byTutor, count: items.length };
  }, [reportManualEntries, reportWeekMonday]);

  // Count search matches across all tutors and students
  const searchMatches = useMemo(() => {
    if (!normalizedSearch) return { tutors: 0, students: 0 };
    let t = 0,
      s = 0;
    DAYS.forEach((d) => {
      (schedule[d.id] || []).forEach((tutor) => {
        if (matchesSearch(tutor.tutor)) t++;
        tutor.students.forEach((stu) => {
          if (matchesSearch(stu.name)) s++;
        });
      });
    });
    return { tutors: t, students: s };
  }, [schedule, normalizedSearch]);

  return (
    <div style={styles.page}>
      <div
        style={{
          ...styles.container,
          gridTemplateColumns: showChecklist
            ? isMobile
              ? "minmax(0,1fr)"
              : "minmax(0, 1fr) minmax(440px, 50%)"
            : "minmax(0, 1fr) 0px",
        }}
      >
        <main style={styles.main}>
          <header
            style={{
              ...styles.header,
              padding: isMobile ? "16px" : "22px 28px",
            }}
          >
            <div style={styles.eyebrow}>EVANGADI · WEEKLY TUTOR SCHEDULE</div>
            <h1 style={styles.title}>
              <span style={styles.titleGradient}>Tutor Sessions</span> This Week
              {busy && <span style={styles.busyDot}>● syncing…</span>}
            </h1>
            <p style={styles.subtitle}>
              <strong>Drag</strong> to move · hold{" "}
              <kbd style={styles.kbd}>Ctrl</kbd> to <strong>copy</strong> ·{" "}
              <strong>right-click</strong> for menu · click name to rename
            </p>

            <div
              style={{
                ...styles.toolbar,
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={styles.navBtn} onClick={goPrev}>
                  ← Prev
                </button>
                <button
                  style={{
                    ...styles.navBtn,
                    ...(isCurrentWeek ? styles.navBtnActive : {}),
                  }}
                  onClick={goNow}
                >
                  This week
                </button>
                <button style={styles.navBtn} onClick={goNext}>
                  Next →
                </button>
                <button
                  style={styles.navBtn}
                  onClick={reload}
                  title="Reload from server"
                >
                  ↻
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={styles.navBtnAlt} onClick={copyFromPreviousWeek}>
                  ↺ Copy last week
                </button>
                <button
                  style={{
                    ...styles.navBtnReport,
                    ...(reportData.missed > 0 ? styles.navBtnReportAlert : {}),
                  }}
                  onClick={openReport}
                >
                  📊 Audio Report
                  {reportData.missed > 0 && (
                    <span style={styles.navBtnBadge}>{reportData.missed}</span>
                  )}
                </button>
                <button style={styles.navBtnDanger} onClick={clearThisWeek}>
                  Clear week
                </button>
              </div>
              <div
                style={{
                  ...styles.weekLabel,
                  marginLeft: isMobile ? 0 : "auto",
                  fontSize: isMobile ? 14 : 16,
                }}
              >
                {weekLabel}
              </div>
            </div>

            {error && <div style={styles.errorBar}>⚠️ {error}</div>}

            {/* === Review Progress Tracker === */}
            {summary.total > 0 && (
              <div style={styles.progressBox}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressIcon}>📊</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.progressTitle}>Review Progress</div>
                    <div style={styles.progressSubtitle}>
                      {summary.reviewed === summary.total
                        ? `🎉 All ${summary.total} videos reviewed!`
                        : `${summary.reviewed} of ${summary.total} reviewed · ${summary.remaining} left`}
                    </div>
                  </div>
                  <div style={styles.progressPct}>{summary.pct}%</div>
                </div>
                <div style={styles.progressBarTrack}>
                  <div
                    style={{
                      ...styles.progressBarFill,
                      width: `${summary.pct}%`,
                      background:
                        summary.pct === 100
                          ? "linear-gradient(90deg, #16a34a, #059669)"
                          : "linear-gradient(90deg, #2563eb 0%, #7c3aed 50%, #16a34a 100%)",
                    }}
                  />
                </div>
                <div style={styles.progressLegend}>
                  <span style={styles.progressLegendItem}>
                    <span
                      style={{
                        ...styles.progressLegendDot,
                        background: STATUS.reviewed.color,
                      }}
                    />
                    Reviewed <strong>{summary.reviewed}</strong>
                  </span>
                  <span style={styles.progressLegendItem}>
                    <span
                      style={{
                        ...styles.progressLegendDot,
                        background: STATUS.uploaded.color,
                      }}
                    />
                    Uploaded <strong>{summary.uploaded}</strong>
                  </span>
                  <span style={styles.progressLegendItem}>
                    <span
                      style={{
                        ...styles.progressLegendDot,
                        background: STATUS.pending.color,
                      }}
                    />
                    Pending <strong>{summary.pending}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* === Search Bar === */}
            <div style={styles.searchBar}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tutors or students..."
                style={styles.searchInput}
              />
              {searchQuery && (
                <>
                  <span style={styles.searchCount}>
                    {searchMatches.tutors + searchMatches.students === 0
                      ? "No matches"
                      : `${searchMatches.tutors} tutor${searchMatches.tutors === 1 ? "" : "s"}, ${searchMatches.students} student${searchMatches.students === 1 ? "" : "s"}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={styles.searchClear}
                  >
                    ×
                  </button>
                </>
              )}
            </div>

            <div style={styles.summary}>
              <div
                style={{
                  ...styles.summaryItem,
                  background: STATUS.pending.bg,
                  color: STATUS.pending.color,
                }}
              >
                <span
                  style={{
                    ...styles.summaryDot,
                    background: STATUS.pending.color,
                  }}
                />
                Pending:{" "}
                <strong style={{ marginLeft: 4 }}>{summary.pending}</strong>
              </div>
              <div
                style={{
                  ...styles.summaryItem,
                  background: STATUS.uploaded.bg,
                  color: STATUS.uploaded.color,
                }}
              >
                <span
                  style={{
                    ...styles.summaryDot,
                    background: STATUS.uploaded.color,
                  }}
                />
                Uploaded:{" "}
                <strong style={{ marginLeft: 4 }}>{summary.uploaded}</strong>
              </div>
              <div
                style={{
                  ...styles.summaryItem,
                  background: STATUS.reviewed.bg,
                  color: STATUS.reviewed.color,
                }}
              >
                <span
                  style={{
                    ...styles.summaryDot,
                    background: STATUS.reviewed.color,
                  }}
                />
                Reviewed:{" "}
                <strong style={{ marginLeft: 4 }}>{summary.reviewed}</strong>
              </div>
              {summary.focusCount > 0 && (
                <div
                  style={{
                    ...styles.summaryItem,
                    background: "#fee2e2",
                    color: "#dc2626",
                  }}
                >
                  ⭐ Focus:{" "}
                  <strong style={{ marginLeft: 4 }}>
                    {summary.focusCount}
                  </strong>
                </div>
              )}
              {summary.watchCount > 0 && (
                <div
                  style={{
                    ...styles.summaryItem,
                    background: "#fef3c7",
                    color: "#d97706",
                  }}
                >
                  ⚠️ Watch:{" "}
                  <strong style={{ marginLeft: 4 }}>
                    {summary.watchCount}
                  </strong>
                </div>
              )}
              {summary.stoppedCount > 0 && (
                <div
                  style={{
                    ...styles.summaryItem,
                    background: "#e2e8f0",
                    color: "#475569",
                  }}
                >
                  🛑 Stopped:{" "}
                  <strong style={{ marginLeft: 4 }}>
                    {summary.stoppedCount}
                  </strong>
                </div>
              )}
              {summary.absentCount > 0 && (
                <div
                  style={{
                    ...styles.summaryItem,
                    background: "#fed7aa",
                    color: "#9a3412",
                  }}
                >
                  🚫 Absent:{" "}
                  <strong style={{ marginLeft: 4 }}>
                    {summary.absentCount}
                  </strong>
                </div>
              )}
              <div style={styles.summaryTotal}>Total: {summary.total}</div>
            </div>

            {clipboard && (
              <div style={styles.clipboardBar}>
                <span style={styles.clipboardIcon}>📋</span>
                <span style={styles.clipboardText}>
                  <strong>Copied {clipboard.type}:</strong>{" "}
                  {clipboard.type === "tutor"
                    ? `${clipboard.data.tutor} (+${clipboard.data.students.length} students)`
                    : clipboard.data.name}
                </span>
                <button
                  type="button"
                  style={styles.clipboardClear}
                  onClick={() => setClipboard(null)}
                >
                  clear
                </button>
              </div>
            )}
          </header>

          {loading ? (
            <div style={styles.loading}>Loading schedule…</div>
          ) : (
            <>
              {/* Mobile day picker */}
              {isMobile && (
                <div style={styles.mobileDayPicker}>
                  {WEEKDAYS.map((day) => {
                    const date = addDays(weekMonday, day.offset);
                    const isToday = fmtISO(date) === fmtISO(today);
                    const isActive = activeMobileDay === day.id;
                    return (
                      <button
                        key={day.id}
                        onClick={() => setActiveMobileDay(day.id)}
                        style={{
                          ...styles.mobileDayBtn,
                          background: isActive
                            ? day.color
                            : isToday
                              ? day.soft
                              : "#ffffff",
                          color: isActive ? "#ffffff" : day.color,
                          borderColor: day.color,
                          fontWeight: isActive ? 800 : 600,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 800 }}>
                          {day.short}
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.8 }}>
                          {fmtShort(date)}
                        </div>
                      </button>
                    );
                  })}
                  {/* Weekend */}
                  {WEEKEND.map((day) => {
                    const date = addDays(weekMonday, day.offset);
                    const isActive = activeMobileDay === day.id;
                    return (
                      <button
                        key={day.id}
                        onClick={() => setActiveMobileDay(day.id)}
                        style={{
                          ...styles.mobileDayBtn,
                          background: isActive ? day.color : "#ffffff",
                          color: isActive ? "#ffffff" : day.color,
                          borderColor: day.color,
                          fontWeight: isActive ? 800 : 600,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 800 }}>
                          {day.short}
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.8 }}>
                          {fmtShort(date)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  ...styles.grid,
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "repeat(5, minmax(0, 1fr))",
                }}
              >
                {WEEKDAYS.filter(
                  (day) => !isMobile || day.id === activeMobileDay,
                ).map((day) => {
                  const date = addDays(weekMonday, day.offset);
                  const isToday = fmtISO(date) === fmtISO(today);
                  const tutors = schedule[day.id] || [];
                  const isHover = dragHoverDay === day.id;

                  return (
                    <div
                      key={day.id}
                      onDragOver={(e) => onDayDragOver(e, day.id)}
                      onDragLeave={(e) => onDayDragLeave(e, day.id)}
                      onDrop={(e) => onDayDrop(e, day.id)}
                      style={{
                        ...styles.dayColumn,
                        background: day.bg,
                        borderColor: isToday ? day.color : day.soft,
                        boxShadow: isHover
                          ? `0 0 0 3px ${day.color}, 0 10px 24px -16px ${day.color}88`
                          : isToday
                            ? `0 0 0 3px ${day.color}33, 0 10px 24px -16px ${day.color}55`
                            : `0 6px 20px -14px ${day.color}33`,
                      }}
                    >
                      <div
                        style={{ ...styles.dayHeader, background: day.color }}
                      >
                        <div>
                          <div style={styles.dayName}>{day.short}</div>
                          <div style={styles.dayDate}>{fmtShort(date)}</div>
                        </div>
                        <div style={styles.dayHeaderRight}>
                          {clipboard && clipboard.type === "tutor" && (
                            <button
                              type="button"
                              onClick={() => pasteTutor(day.id)}
                              style={styles.pasteBtn}
                              title="Paste copied tutor"
                            >
                              📋
                            </button>
                          )}
                          <span style={styles.dayCount}>
                            {tutors.length}/{MAX_TUTORS_PER_DAY}
                          </span>
                        </div>
                      </div>

                      {summary.perDay[day.id] &&
                        summary.perDay[day.id].total > 0 && (
                          <div style={styles.dayProgress}>
                            <div style={styles.dayProgressLabel}>
                              {summary.perDay[day.id].reviewed}/
                              {summary.perDay[day.id].total} reviewed
                            </div>
                            <div style={styles.dayProgressTrack}>
                              <div
                                style={{
                                  ...styles.dayProgressFill,
                                  width: `${summary.perDay[day.id].total === 0 ? 0 : (summary.perDay[day.id].reviewed / summary.perDay[day.id].total) * 100}%`,
                                  background: day.color,
                                }}
                              />
                            </div>
                          </div>
                        )}

                      <div style={styles.tutorsList}>
                        {tutors.map((tutor, tIdx) => {
                          const tc = TUTOR_COLORS[tIdx % TUTOR_COLORS.length];
                          const isRenamingThis =
                            renaming?.type === "tutor" &&
                            renaming.tutorId === tutor.id;
                          const isTutorHover = dragHoverTutor === tutor.id;
                          const sortedStudents = sortStudentsByPriority(
                            tutor.students.filter((s) =>
                              shouldShowStudent(s, weekMonday, todayMonday),
                            ),
                          );
                          return (
                            <div
                              key={tutor.id}
                              draggable={!isRenamingThis}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setCtxMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  type: "tutor",
                                  dayId: day.id,
                                  tutorId: tutor.id,
                                  target: tutor,
                                });
                              }}
                              onDragStart={(e) =>
                                onTutorDragStart(e, day.id, tutor)
                              }
                              onDragEnd={onDragEnd}
                              onDragOver={(e) =>
                                onTutorDropZoneDragOver(e, day.id, tutor.id)
                              }
                              onDragLeave={(e) =>
                                onTutorDropZoneDragLeave(e, tutor.id)
                              }
                              onDrop={(e) => {
                                if (dragRef.current?.type === "student")
                                  onTutorDropZoneDrop(e, day.id, tutor.id);
                              }}
                              style={{
                                ...styles.tutorCard,
                                borderColor: isTutorHover ? tc.color : tc.bg,
                                boxShadow: matchesSearch(tutor.tutor)
                                  ? `inset 4px 0 0 0 ${tc.color}, 0 0 0 3px #fbbf24, 0 0 12px 0 #fbbf2466`
                                  : isTutorHover
                                    ? `inset 4px 0 0 0 ${tc.color}, 0 0 0 2px ${tc.color}66`
                                    : `inset 4px 0 0 0 ${tc.color}`,
                                cursor: isRenamingThis ? "default" : "grab",
                                background: matchesSearch(tutor.tutor)
                                  ? "#fffbeb"
                                  : "#ffffff",
                              }}
                            >
                              <div style={styles.tutorHead}>
                                <span style={styles.dragHandle} title="Drag">
                                  ⋮⋮
                                </span>
                                <div style={styles.tutorNameWrap}>
                                  <span
                                    style={{
                                      ...styles.tutorAvatar,
                                      background: tc.color,
                                    }}
                                  >
                                    {tutor.tutor.charAt(0).toUpperCase()}
                                  </span>
                                  {isRenamingThis ? (
                                    <input
                                      ref={renameInputRef}
                                      type="text"
                                      value={renaming.value}
                                      onChange={(e) =>
                                        setRenaming({
                                          ...renaming,
                                          value: e.target.value,
                                        })
                                      }
                                      onBlur={commitRename}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") commitRename();
                                        else if (e.key === "Escape")
                                          cancelRename();
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        ...styles.renameInput,
                                        color: tc.color,
                                      }}
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        ...styles.tutorName,
                                        color: tc.color,
                                      }}
                                      onClick={(e) =>
                                        startRenameTutor(day.id, tutor, e)
                                      }
                                      title="Click to rename"
                                    >
                                      {tutor.tutor}
                                    </span>
                                  )}
                                </div>
                                <div style={styles.tutorActions}>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      startRenameTutor(day.id, tutor, e)
                                    }
                                    style={styles.iconBtn}
                                    title="Rename"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => copyTutor(tutor, e)}
                                    style={styles.iconBtn}
                                    title="Copy"
                                  >
                                    📋
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      duplicateTutorSameDay(tutor, e)
                                    }
                                    style={styles.iconBtn}
                                    title="Duplicate here"
                                  >
                                    ➕
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeTutor(day.id, tutor.id);
                                    }}
                                    style={styles.tutorRemove}
                                    title="Remove"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>

                              <div style={styles.studentList}>
                                {tutor.students.filter((s) =>
                                  shouldShowStudent(s, weekMonday, todayMonday),
                                ).length === 0 && (
                                  <div style={styles.emptyHint}>
                                    No active students
                                  </div>
                                )}
                                {sortedStudents.map((student) => {
                                  const st =
                                    weekStatus[student.id] || "pending";
                                  const cfg = STATUS[st];
                                  const isActive =
                                    activeReview &&
                                    activeReview.studentId === student.id;
                                  const pri =
                                    PRIORITY[student.priority || "normal"];
                                  const isRenamingStudent =
                                    renaming?.type === "student" &&
                                    renaming.studentId === student.id;
                                  const isFocus = student.priority === "focus";
                                  const isTemporary = !!student.isTemporary;
                                  const lifecycle = getStudentLifecycle(
                                    student,
                                    weekMonday,
                                  );
                                  const isStopping = lifecycle === "stopping";
                                  const isStopped = lifecycle === "stopped";
                                  const isAbsent = st === "absent";

                                  return (
                                    <div
                                      key={student.id}
                                      draggable={
                                        !isRenamingStudent && !isStopped
                                      }
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setCtxMenu({
                                          x: e.clientX,
                                          y: e.clientY,
                                          type: "student",
                                          dayId: day.id,
                                          tutorId: tutor.id,
                                          tutorName: tutor.tutor,
                                          studentId: student.id,
                                          target: student,
                                        });
                                      }}
                                      onDragStart={(e) =>
                                        onStudentDragStart(
                                          e,
                                          day.id,
                                          tutor.id,
                                          student,
                                        )
                                      }
                                      onDragEnd={onDragEnd}
                                      onClick={() => {
                                        if (!isRenamingStudent && !isStopped)
                                          openSession(
                                            day.offset,
                                            tutor.tutor,
                                            student,
                                          );
                                      }}
                                      style={{
                                        ...styles.studentRow,
                                        background: matchesSearch(student.name)
                                          ? "#fef3c7"
                                          : isStopped
                                            ? "#f1f5f9"
                                            : isAbsent
                                              ? "#fed7aa"
                                              : isTemporary
                                                ? "#f0fdf4"
                                                : cfg.bg,
                                        borderColor: isStopped
                                          ? "#cbd5e1"
                                          : isFocus
                                            ? pri.color
                                            : cfg.color,
                                        borderLeftWidth: isFocus ? 4 : 3,
                                        outline: isActive
                                          ? `2px solid ${tc.color}`
                                          : isFocus && !isStopped
                                            ? `2px solid ${pri.color}66`
                                            : "none",
                                        outlineOffset:
                                          isActive || (isFocus && !isStopped)
                                            ? "1px"
                                            : "0",
                                        cursor: isRenamingStudent
                                          ? "text"
                                          : isStopped
                                            ? "default"
                                            : "grab",
                                        boxShadow:
                                          isFocus && !isStopped
                                            ? `0 0 0 1px ${pri.color}44, 0 4px 12px -4px ${pri.color}44`
                                            : "none",
                                        opacity: isStopped
                                          ? 0.55
                                          : isAbsent
                                            ? 0.75
                                            : 1,
                                      }}
                                      title={
                                        isStopped
                                          ? `Stopped on ${student.endDate}`
                                          : isStopping
                                            ? `Stopping this week (${student.endDate})`
                                            : student.focusNote || ""
                                      }
                                    >
                                      {pri.icon && (
                                        <span style={styles.priorityIcon}>
                                          {pri.icon}
                                        </span>
                                      )}
                                      {isTemporary && (
                                        <span
                                          style={styles.tempBadge}
                                          title="Temporary student"
                                        >
                                          🌞
                                        </span>
                                      )}
                                      <span
                                        style={styles.studentDrag}
                                        title="Drag"
                                      >
                                        ⋮
                                      </span>
                                      {isRenamingStudent ? (
                                        <input
                                          ref={renameInputRef}
                                          type="text"
                                          value={renaming.value}
                                          onChange={(e) =>
                                            setRenaming({
                                              ...renaming,
                                              value: e.target.value,
                                            })
                                          }
                                          onBlur={commitRename}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                              commitRename();
                                            else if (e.key === "Escape")
                                              cancelRename();
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            ...styles.renameInputSmall,
                                            color: cfg.color,
                                          }}
                                        />
                                      ) : (
                                        <span
                                          style={{
                                            ...styles.studentName,
                                            color: cfg.color,
                                            fontWeight: isFocus ? 800 : 700,
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startRenameStudent(
                                              day.id,
                                              tutor.id,
                                              student,
                                              e,
                                            );
                                          }}
                                          title="Click to rename"
                                        >
                                          {student.name}
                                        </span>
                                      )}
                                      {isStopping && (
                                        <span
                                          style={styles.stoppingBadge}
                                          title={`Last week — stops ${student.endDate}`}
                                        >
                                          📅 ENDS
                                        </span>
                                      )}
                                      {isStopped ? (
                                        <span
                                          style={styles.stoppedBadge}
                                          title={`Stopped on ${student.endDate}`}
                                        >
                                          🛑 Stopped {student.endDate}
                                        </span>
                                      ) : (
                                        <span
                                          onClick={(e) =>
                                            cycleStatus(student.id, e)
                                          }
                                          style={{
                                            ...styles.statusPill,
                                            background: cfg.color,
                                          }}
                                          title="Click to change status"
                                        >
                                          {cfg.label}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEndDatePicker(
                                            day.id,
                                            tutor.id,
                                            student,
                                          );
                                        }}
                                        style={styles.iconBtnTiny}
                                        title={
                                          student.endDate
                                            ? `Stops ${student.endDate} — click to change`
                                            : "Set stop date"
                                        }
                                      >
                                        📅
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openFocusEditor(
                                            day.id,
                                            tutor.id,
                                            student,
                                          );
                                        }}
                                        style={styles.iconBtnTiny}
                                        title="Focus & note"
                                      >
                                        ⭐
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => copyStudent(student, e)}
                                        style={styles.studentCopy}
                                        title="Copy"
                                      >
                                        📋
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeStudent(
                                            day.id,
                                            tutor.id,
                                            student.id,
                                          );
                                        }}
                                        style={styles.studentRemove}
                                        title="Remove"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}

                                {tutor.students.length <
                                  MAX_STUDENTS_PER_TUTOR && (
                                  <div style={styles.studentAddRow}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openAddStudent(day.id, tutor)
                                      }
                                      style={{
                                        ...styles.addStudent,
                                        color: tc.color,
                                        borderColor: tc.color,
                                      }}
                                    >
                                      + Add student
                                    </button>
                                    {clipboard &&
                                      clipboard.type === "student" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            pasteStudent(day.id, tutor.id)
                                          }
                                          style={{
                                            ...styles.addStudent,
                                            color: tc.color,
                                            borderColor: tc.color,
                                            background: "#fef3c7",
                                          }}
                                          title="Paste copied student here"
                                        >
                                          📋 Paste
                                        </button>
                                      )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {tutors.length < MAX_TUTORS_PER_DAY && (
                          <button
                            type="button"
                            onClick={() => openAddTutor(day.id)}
                            style={{
                              ...styles.addTutor,
                              color: day.color,
                              borderColor: day.color,
                            }}
                          >
                            + Add tutor
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weekend row */}
              <div style={styles.weekendHeader}>
                <span style={styles.weekendLabel}>📅 Weekend</span>
                <span style={styles.weekendSub}>Saturday &amp; Sunday</span>
              </div>
              <div
                style={{
                  ...styles.gridWeekend,
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "repeat(2, minmax(0, 1fr))",
                  maxWidth: isMobile ? "100%" : "60%",
                }}
              >
                {WEEKEND.filter(
                  (day) => !isMobile || day.id === activeMobileDay,
                ).map((day) => {
                  const date = addDays(weekMonday, day.offset);
                  const isToday = fmtISO(date) === fmtISO(today);
                  const tutors = schedule[day.id] || [];
                  const isHover = dragHoverDay === day.id;

                  return (
                    <div
                      key={day.id}
                      onDragOver={(e) => onDayDragOver(e, day.id)}
                      onDragLeave={(e) => onDayDragLeave(e, day.id)}
                      onDrop={(e) => onDayDrop(e, day.id)}
                      style={{
                        ...styles.dayColumn,
                        background: day.bg,
                        borderColor: isToday ? day.color : day.soft,
                        boxShadow: isHover
                          ? `0 0 0 3px ${day.color}, 0 10px 24px -16px ${day.color}88`
                          : isToday
                            ? `0 0 0 3px ${day.color}33, 0 10px 24px -16px ${day.color}55`
                            : `0 6px 20px -14px ${day.color}33`,
                      }}
                    >
                      <div
                        style={{ ...styles.dayHeader, background: day.color }}
                      >
                        <div>
                          <div style={styles.dayName}>{day.short}</div>
                          <div style={styles.dayDate}>{fmtShort(date)}</div>
                        </div>
                        <div style={styles.dayHeaderRight}>
                          {clipboard && clipboard.type === "tutor" && (
                            <button
                              type="button"
                              onClick={() => pasteTutor(day.id)}
                              style={styles.pasteBtn}
                              title="Paste copied tutor"
                            >
                              📋
                            </button>
                          )}
                          <span style={styles.dayCount}>
                            {tutors.length}/{MAX_TUTORS_PER_DAY}
                          </span>
                        </div>
                      </div>

                      {summary.perDay[day.id] &&
                        summary.perDay[day.id].total > 0 && (
                          <div style={styles.dayProgress}>
                            <div style={styles.dayProgressLabel}>
                              {summary.perDay[day.id].reviewed}/
                              {summary.perDay[day.id].total} reviewed
                            </div>
                            <div style={styles.dayProgressTrack}>
                              <div
                                style={{
                                  ...styles.dayProgressFill,
                                  width: `${summary.perDay[day.id].total === 0 ? 0 : (summary.perDay[day.id].reviewed / summary.perDay[day.id].total) * 100}%`,
                                  background: day.color,
                                }}
                              />
                            </div>
                          </div>
                        )}

                      <div style={styles.tutorsList}>
                        {tutors.map((tutor, tIdx) => {
                          const tc = TUTOR_COLORS[tIdx % TUTOR_COLORS.length];
                          const isRenamingThis =
                            renaming?.type === "tutor" &&
                            renaming.tutorId === tutor.id;
                          const isTutorHover = dragHoverTutor === tutor.id;
                          const sortedStudents = sortStudentsByPriority(
                            tutor.students.filter((s) =>
                              shouldShowStudent(s, weekMonday, todayMonday),
                            ),
                          );
                          return (
                            <div
                              key={tutor.id}
                              draggable={!isRenamingThis}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setCtxMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  type: "tutor",
                                  dayId: day.id,
                                  tutorId: tutor.id,
                                  target: tutor,
                                });
                              }}
                              onDragStart={(e) =>
                                onTutorDragStart(e, day.id, tutor)
                              }
                              onDragEnd={onDragEnd}
                              onDragOver={(e) =>
                                onTutorDropZoneDragOver(e, day.id, tutor.id)
                              }
                              onDragLeave={(e) =>
                                onTutorDropZoneDragLeave(e, tutor.id)
                              }
                              onDrop={(e) => {
                                if (dragRef.current?.type === "student")
                                  onTutorDropZoneDrop(e, day.id, tutor.id);
                              }}
                              style={{
                                ...styles.tutorCard,
                                borderColor: isTutorHover ? tc.color : tc.bg,
                                boxShadow: matchesSearch(tutor.tutor)
                                  ? `inset 4px 0 0 0 ${tc.color}, 0 0 0 3px #fbbf24, 0 0 12px 0 #fbbf2466`
                                  : isTutorHover
                                    ? `inset 4px 0 0 0 ${tc.color}, 0 0 0 2px ${tc.color}66`
                                    : `inset 4px 0 0 0 ${tc.color}`,
                                cursor: isRenamingThis ? "default" : "grab",
                                background: matchesSearch(tutor.tutor)
                                  ? "#fffbeb"
                                  : "#ffffff",
                              }}
                            >
                              <div style={styles.tutorHead}>
                                <span style={styles.dragHandle} title="Drag">
                                  ⋮⋮
                                </span>
                                <div style={styles.tutorNameWrap}>
                                  <span
                                    style={{
                                      ...styles.tutorAvatar,
                                      background: tc.color,
                                    }}
                                  >
                                    {tutor.tutor.charAt(0).toUpperCase()}
                                  </span>
                                  {isRenamingThis ? (
                                    <input
                                      ref={renameInputRef}
                                      type="text"
                                      value={renaming.value}
                                      onChange={(e) =>
                                        setRenaming({
                                          ...renaming,
                                          value: e.target.value,
                                        })
                                      }
                                      onBlur={commitRename}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") commitRename();
                                        else if (e.key === "Escape")
                                          cancelRename();
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        ...styles.renameInput,
                                        color: tc.color,
                                      }}
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        ...styles.tutorName,
                                        color: tc.color,
                                      }}
                                      onClick={(e) =>
                                        startRenameTutor(day.id, tutor, e)
                                      }
                                      title="Click to rename"
                                    >
                                      {tutor.tutor}
                                    </span>
                                  )}
                                </div>
                                <div style={styles.tutorActions}>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      startRenameTutor(day.id, tutor, e)
                                    }
                                    style={styles.iconBtn}
                                    title="Rename"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => copyTutor(tutor, e)}
                                    style={styles.iconBtn}
                                    title="Copy"
                                  >
                                    📋
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      duplicateTutorSameDay(tutor, e)
                                    }
                                    style={styles.iconBtn}
                                    title="Duplicate here"
                                  >
                                    ➕
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeTutor(day.id, tutor.id);
                                    }}
                                    style={styles.tutorRemove}
                                    title="Remove"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>

                              <div style={styles.studentList}>
                                {tutor.students.filter((s) =>
                                  shouldShowStudent(s, weekMonday, todayMonday),
                                ).length === 0 && (
                                  <div style={styles.emptyHint}>
                                    No active students
                                  </div>
                                )}
                                {sortedStudents.map((student) => {
                                  const st =
                                    weekStatus[student.id] || "pending";
                                  const cfg = STATUS[st];
                                  const isActive =
                                    activeReview &&
                                    activeReview.studentId === student.id;
                                  const pri =
                                    PRIORITY[student.priority || "normal"];
                                  const isRenamingStudent =
                                    renaming?.type === "student" &&
                                    renaming.studentId === student.id;
                                  const isFocus = student.priority === "focus";
                                  const isTemporary = !!student.isTemporary;
                                  const lifecycle = getStudentLifecycle(
                                    student,
                                    weekMonday,
                                  );
                                  const isStopping = lifecycle === "stopping";
                                  const isStopped = lifecycle === "stopped";
                                  const isAbsent = st === "absent";

                                  return (
                                    <div
                                      key={student.id}
                                      draggable={
                                        !isRenamingStudent && !isStopped
                                      }
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setCtxMenu({
                                          x: e.clientX,
                                          y: e.clientY,
                                          type: "student",
                                          dayId: day.id,
                                          tutorId: tutor.id,
                                          tutorName: tutor.tutor,
                                          studentId: student.id,
                                          target: student,
                                        });
                                      }}
                                      onDragStart={(e) =>
                                        onStudentDragStart(
                                          e,
                                          day.id,
                                          tutor.id,
                                          student,
                                        )
                                      }
                                      onDragEnd={onDragEnd}
                                      onClick={() => {
                                        if (!isRenamingStudent && !isStopped)
                                          openSession(
                                            day.offset,
                                            tutor.tutor,
                                            student,
                                          );
                                      }}
                                      style={{
                                        ...styles.studentRow,
                                        background: matchesSearch(student.name)
                                          ? "#fef3c7"
                                          : isStopped
                                            ? "#f1f5f9"
                                            : isAbsent
                                              ? "#fed7aa"
                                              : isTemporary
                                                ? "#f0fdf4"
                                                : cfg.bg,
                                        borderColor: isStopped
                                          ? "#cbd5e1"
                                          : isFocus
                                            ? pri.color
                                            : cfg.color,
                                        borderLeftWidth: isFocus ? 4 : 3,
                                        outline: isActive
                                          ? `2px solid ${tc.color}`
                                          : isFocus && !isStopped
                                            ? `2px solid ${pri.color}66`
                                            : "none",
                                        outlineOffset:
                                          isActive || (isFocus && !isStopped)
                                            ? "1px"
                                            : "0",
                                        cursor: isRenamingStudent
                                          ? "text"
                                          : isStopped
                                            ? "default"
                                            : "grab",
                                        boxShadow:
                                          isFocus && !isStopped
                                            ? `0 0 0 1px ${pri.color}44, 0 4px 12px -4px ${pri.color}44`
                                            : "none",
                                        opacity: isStopped
                                          ? 0.55
                                          : isAbsent
                                            ? 0.75
                                            : 1,
                                      }}
                                      title={
                                        isStopped
                                          ? `Stopped on ${student.endDate}`
                                          : isStopping
                                            ? `Stopping this week (${student.endDate})`
                                            : student.focusNote || ""
                                      }
                                    >
                                      {pri.icon && (
                                        <span style={styles.priorityIcon}>
                                          {pri.icon}
                                        </span>
                                      )}
                                      {isTemporary && (
                                        <span
                                          style={styles.tempBadge}
                                          title="Temporary student"
                                        >
                                          🌞
                                        </span>
                                      )}
                                      <span
                                        style={styles.studentDrag}
                                        title="Drag"
                                      >
                                        ⋮
                                      </span>
                                      {isRenamingStudent ? (
                                        <input
                                          ref={renameInputRef}
                                          type="text"
                                          value={renaming.value}
                                          onChange={(e) =>
                                            setRenaming({
                                              ...renaming,
                                              value: e.target.value,
                                            })
                                          }
                                          onBlur={commitRename}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                              commitRename();
                                            else if (e.key === "Escape")
                                              cancelRename();
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            ...styles.renameInputSmall,
                                            color: cfg.color,
                                          }}
                                        />
                                      ) : (
                                        <span
                                          style={{
                                            ...styles.studentName,
                                            color: cfg.color,
                                            fontWeight: isFocus ? 800 : 700,
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startRenameStudent(
                                              day.id,
                                              tutor.id,
                                              student,
                                              e,
                                            );
                                          }}
                                          title="Click to rename"
                                        >
                                          {student.name}
                                        </span>
                                      )}
                                      {isStopping && (
                                        <span
                                          style={styles.stoppingBadge}
                                          title={`Last week — stops ${student.endDate}`}
                                        >
                                          📅 ENDS
                                        </span>
                                      )}
                                      {isStopped ? (
                                        <span
                                          style={styles.stoppedBadge}
                                          title={`Stopped on ${student.endDate}`}
                                        >
                                          🛑 Stopped {student.endDate}
                                        </span>
                                      ) : (
                                        <span
                                          onClick={(e) =>
                                            cycleStatus(student.id, e)
                                          }
                                          style={{
                                            ...styles.statusPill,
                                            background: cfg.color,
                                          }}
                                          title="Click to change status"
                                        >
                                          {cfg.label}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEndDatePicker(
                                            day.id,
                                            tutor.id,
                                            student,
                                          );
                                        }}
                                        style={styles.iconBtnTiny}
                                        title={
                                          student.endDate
                                            ? `Stops ${student.endDate} — click to change`
                                            : "Set stop date"
                                        }
                                      >
                                        📅
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openFocusEditor(
                                            day.id,
                                            tutor.id,
                                            student,
                                          );
                                        }}
                                        style={styles.iconBtnTiny}
                                        title="Focus & note"
                                      >
                                        ⭐
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => copyStudent(student, e)}
                                        style={styles.studentCopy}
                                        title="Copy"
                                      >
                                        📋
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeStudent(
                                            day.id,
                                            tutor.id,
                                            student.id,
                                          );
                                        }}
                                        style={styles.studentRemove}
                                        title="Remove"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}

                                {tutor.students.length <
                                  MAX_STUDENTS_PER_TUTOR && (
                                  <div style={styles.studentAddRow}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openAddStudent(day.id, tutor)
                                      }
                                      style={{
                                        ...styles.addStudent,
                                        color: tc.color,
                                        borderColor: tc.color,
                                      }}
                                    >
                                      + Add student
                                    </button>
                                    {clipboard &&
                                      clipboard.type === "student" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            pasteStudent(day.id, tutor.id)
                                          }
                                          style={{
                                            ...styles.addStudent,
                                            color: tc.color,
                                            borderColor: tc.color,
                                            background: "#fef3c7",
                                          }}
                                          title="Paste copied student here"
                                        >
                                          📋 Paste
                                        </button>
                                      )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {tutors.length < MAX_TUTORS_PER_DAY && (
                          <button
                            type="button"
                            onClick={() => openAddTutor(day.id)}
                            style={{
                              ...styles.addTutor,
                              color: day.color,
                              borderColor: day.color,
                            }}
                          >
                            + Add tutor
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={styles.legendBox}>
            <strong>How to use:</strong>
            <ol style={styles.legendList}>
              <li>
                <strong>Drag tutors</strong> between days to move; hold{" "}
                <kbd style={styles.kbd}>Ctrl</kbd> to copy
              </li>
              <li>
                <strong>Drag students</strong> onto another tutor card to move;{" "}
                <kbd style={styles.kbd}>Ctrl</kbd>+drag to copy
              </li>
              <li>
                <strong>Copy via icons:</strong> 📋 = copy · ➕ = duplicate ·
                click 📋 on any day or "📋 Paste" under any tutor
              </li>
              <li>
                <strong>Right-click</strong> any tutor or student for full menu
                (rename, priority, move to day, etc.)
              </li>
              <li>
                <strong>Click a name</strong> to rename inline · click status
                pill to cycle Pending → Uploaded → Reviewed
              </li>
              <li>
                <strong>↻ Reload</strong> button forces a refresh from server if
                something looks off
              </li>
            </ol>
          </div>
        </main>

        {showChecklist && (
          <aside
            style={{
              ...styles.sidebar,
              ...(isMobile
                ? {
                    position: "fixed",
                    inset: 0,
                    zIndex: 60,
                    maxHeight: "100vh",
                    overflow: "hidden",
                  }
                : {}),
            }}
          >
            <div style={styles.sidebarInner}>
              <div style={styles.reviewHeader}>
                <div style={styles.reviewTopRow}>
                  <span style={styles.reviewBadge}>NOW REVIEWING</span>
                  <button
                    style={styles.closeReview}
                    onClick={() => setActiveReview(null)}
                  >
                    ×
                  </button>
                </div>
                <h3 style={styles.reviewStudent}>{activeReview.student}</h3>
                <div style={styles.reviewMeta}>
                  Tutor: <strong>{activeReview.tutor}</strong> ·{" "}
                  {activeReview.date}
                </div>
              </div>
              <div style={styles.checklistWrap}>
                <VideoReviewChecklist
                  key={activeReview.key}
                  initialTutor={activeReview.tutor}
                  initialStudent={activeReview.student}
                  initialDate={activeReview.date}
                  studentId={activeReview.studentId}
                />
              </div>
            </div>
          </aside>
        )}
      </div>

      {ctxMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...styles.ctxMenu,
            top: Math.min(ctxMenu.y, window.innerHeight - 380),
            left: Math.min(ctxMenu.x, window.innerWidth - 240),
          }}
        >
          {ctxMenu.type === "tutor" && (
            <>
              <div style={styles.ctxHeader}>👤 {ctxMenu.target.tutor}</div>
              <button
                style={styles.ctxItem}
                onClick={() => {
                  startRenameTutor(ctxMenu.dayId, ctxMenu.target);
                  closeCtxMenu();
                }}
              >
                ✏️ Rename tutor
              </button>
              <button
                style={styles.ctxItem}
                onClick={() => {
                  copyTutor(ctxMenu.target);
                  closeCtxMenu();
                }}
              >
                📋 Copy (with students)
              </button>
              <button
                style={styles.ctxItem}
                onClick={() => {
                  duplicateTutorSameDay(ctxMenu.target);
                  closeCtxMenu();
                }}
              >
                ➕ Duplicate here
              </button>
              {clipboard && clipboard.type === "tutor" && (
                <button
                  style={styles.ctxItem}
                  onClick={() => {
                    pasteTutor(ctxMenu.dayId);
                    closeCtxMenu();
                  }}
                >
                  📥 Paste copied tutor here
                </button>
              )}
              <div style={styles.ctxDivider} />
              <div style={styles.ctxSubLabel}>Move to day…</div>
              {DAYS.filter((d) => d.id !== ctxMenu.dayId).map((d) => (
                <button
                  key={d.id}
                  style={{ ...styles.ctxItem, color: d.color }}
                  onClick={() => {
                    if ((schedule[d.id] || []).length >= MAX_TUTORS_PER_DAY) {
                      flash(`${d.label} is full`);
                      closeCtxMenu();
                      return;
                    }
                    run(
                      () => api.patchTutor(ctxMenu.tutorId, { dayId: d.id }),
                      `Moved to ${d.label}`,
                    );
                    closeCtxMenu();
                  }}
                >
                  → {d.label}
                </button>
              ))}
              <div style={styles.ctxDivider} />
              <div style={styles.ctxSubLabel}>Copy to day…</div>
              {DAYS.map((d) => (
                <button
                  key={`copy-${d.id}`}
                  style={{ ...styles.ctxItem, color: d.color }}
                  onClick={() => {
                    if ((schedule[d.id] || []).length >= MAX_TUTORS_PER_DAY) {
                      flash(`${d.label} is full`);
                      closeCtxMenu();
                      return;
                    }
                    run(
                      () => api.duplicateTutor(wKey, ctxMenu.tutorId, d.id),
                      `Copied to ${d.label}`,
                    );
                    closeCtxMenu();
                  }}
                >
                  📄 {d.label}
                </button>
              ))}
              <div style={styles.ctxDivider} />
              <button
                style={{ ...styles.ctxItem, color: "#dc2626" }}
                onClick={() => {
                  removeTutor(ctxMenu.dayId, ctxMenu.tutorId);
                  closeCtxMenu();
                }}
              >
                🗑 Delete tutor
              </button>
            </>
          )}
          {ctxMenu.type === "student" && (
            <>
              <div style={styles.ctxHeader}>🎓 {ctxMenu.target.name}</div>
              <button
                style={styles.ctxItem}
                onClick={() => {
                  openEditStudent(
                    ctxMenu.dayId,
                    {
                      id: ctxMenu.tutorId,
                      tutor: ctxMenu.tutorName,
                      students: [],
                    },
                    ctxMenu.target,
                  );
                  closeCtxMenu();
                }}
              >
                ✏️ Edit student…
              </button>
              <button
                style={styles.ctxItem}
                onClick={() => {
                  startRenameStudent(
                    ctxMenu.dayId,
                    ctxMenu.tutorId,
                    ctxMenu.target,
                  );
                  closeCtxMenu();
                }}
              >
                ✏️ Rename only
              </button>
              <button
                style={styles.ctxItem}
                onClick={() => {
                  openFocusEditor(
                    ctxMenu.dayId,
                    ctxMenu.tutorId,
                    ctxMenu.target,
                  );
                  closeCtxMenu();
                }}
              >
                ⭐ Set focus & note…
              </button>
              <button
                style={{ ...styles.ctxItem, color: "#16a34a", fontWeight: 700 }}
                onClick={() => {
                  run(
                    () =>
                      api.patchStudent(ctxMenu.studentId, {
                        isTemporary: !ctxMenu.target.isTemporary,
                      }),
                    ctxMenu.target.isTemporary
                      ? "Marked as regular"
                      : "Marked as temporary",
                  );
                  closeCtxMenu();
                }}
              >
                {ctxMenu.target.isTemporary
                  ? "✅ Mark as Regular"
                  : "🌞 Mark as Temporary"}
              </button>
              <button
                style={{ ...styles.ctxItem, color: "#9a3412", fontWeight: 700 }}
                onClick={() => {
                  toggleAbsent(ctxMenu.studentId);
                  closeCtxMenu();
                }}
              >
                {(weekStatus[ctxMenu.studentId] || "pending") === "absent"
                  ? "✅ Clear Absent (mark Pending)"
                  : "🚫 Mark as Absent"}
              </button>
              <button
                style={{ ...styles.ctxItem, color: "#6b21a8", fontWeight: 700 }}
                onClick={() => {
                  toggleCancel(ctxMenu.studentId);
                  closeCtxMenu();
                }}
              >
                {(weekStatus[ctxMenu.studentId] || "pending") === "cancelled"
                  ? "✅ Clear Cancelled (mark Pending)"
                  : "❌ Mark as Cancelled"}
              </button>
              <button
                style={{ ...styles.ctxItem, color: "#0369a1", fontWeight: 700 }}
                onClick={() => {
                  const current = weekStatus[ctxMenu.studentId] || "pending";
                  const next =
                    current === "rescheduled" ? "pending" : "rescheduled";
                  setWeekStatus((w) => ({ ...w, [ctxMenu.studentId]: next }));
                  api
                    .setStatus(wKey, ctxMenu.studentId, next)
                    .then(() =>
                      flash(
                        next === "rescheduled"
                          ? "Marked as Rescheduled"
                          : "Cleared",
                      ),
                    )
                    .catch((err) => {
                      flash(err.message);
                      reload();
                    });
                  closeCtxMenu();
                }}
              >
                {(weekStatus[ctxMenu.studentId] || "pending") === "rescheduled"
                  ? "✅ Clear Rescheduled"
                  : "🔄 Mark as Rescheduled"}
              </button>
              <button
                style={styles.ctxItem}
                onClick={() => {
                  copyStudent(ctxMenu.target);
                  closeCtxMenu();
                }}
              >
                📋 Copy student
              </button>
              {clipboard && clipboard.type === "student" && (
                <button
                  style={styles.ctxItem}
                  onClick={() => {
                    pasteStudent(ctxMenu.dayId, ctxMenu.tutorId);
                    closeCtxMenu();
                  }}
                >
                  📥 Paste copied student here
                </button>
              )}
              <div style={styles.ctxDivider} />
              <div style={styles.ctxSubLabel}>Priority</div>
              {Object.entries(PRIORITY).map(([key, pri]) => (
                <button
                  key={key}
                  style={{
                    ...styles.ctxItem,
                    color: pri.color,
                    fontWeight: ctxMenu.target.priority === key ? 800 : 500,
                  }}
                  onClick={() => {
                    setStudentPriority(
                      ctxMenu.dayId,
                      ctxMenu.tutorId,
                      ctxMenu.studentId,
                      key,
                    );
                    closeCtxMenu();
                  }}
                >
                  {pri.icon || "○"} {pri.label}
                </button>
              ))}
              <div style={styles.ctxDivider} />
              <button
                style={{ ...styles.ctxItem, color: "#dc2626" }}
                onClick={() => {
                  removeStudent(
                    ctxMenu.dayId,
                    ctxMenu.tutorId,
                    ctxMenu.studentId,
                  );
                  closeCtxMenu();
                }}
              >
                🗑 Delete student
              </button>
            </>
          )}
        </div>
      )}

      {focusEditor && (
        <div style={styles.modalBackdrop} onClick={() => setFocusEditor(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>⭐ Focus Settings</h3>
              <span style={styles.modalDay}>{focusEditor.studentName}</span>
            </div>
            <p style={styles.modalNote}>
              Set this student's priority and an optional note.
            </p>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Priority</span>
              <div style={styles.priorityRow}>
                {Object.entries(PRIORITY).map(([key, pri]) => {
                  const selected = focusEditor.priority === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setFocusEditor({ ...focusEditor, priority: key })
                      }
                      style={{
                        ...styles.priorityChoice,
                        background: selected ? pri.color : "#ffffff",
                        color: selected ? "#ffffff" : pri.color,
                        borderColor: pri.color,
                      }}
                    >
                      {pri.icon || "○"} {pri.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Focus note (optional)</span>
              <textarea
                value={focusEditor.value}
                onChange={(e) =>
                  setFocusEditor({ ...focusEditor, value: e.target.value })
                }
                placeholder="e.g. Struggling with multiplication..."
                style={styles.textarea}
                autoFocus
              />
            </label>
            {/* Temporary toggle */}
            <div
              style={{
                ...styles.field,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: focusEditor.isTemporary ? "#f0fdf4" : "#f8fafc",
                borderRadius: 10,
                border: `1px solid ${focusEditor.isTemporary ? "#86efac" : "#e2e8f0"}`,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 18 }}>🌞</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}
                >
                  Temporary Student
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b" }}>
                  Summer or seasonal — can come back later
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFocusEditor({
                    ...focusEditor,
                    isTemporary: !focusEditor.isTemporary,
                  })
                }
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: focusEditor.isTemporary ? "#16a34a" : "#cbd5e1",
                  position: "relative",
                  transition: "background 200ms ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: focusEditor.isTemporary ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: "#ffffff",
                    transition: "left 200ms ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>📅 Stops on (optional)</span>
              <div style={styles.endDateRow}>
                <input
                  type="date"
                  value={focusEditor.endDate}
                  onChange={(e) =>
                    setFocusEditor({ ...focusEditor, endDate: e.target.value })
                  }
                  style={styles.input}
                />
                {focusEditor.endDate && (
                  <button
                    type="button"
                    onClick={() =>
                      setFocusEditor({ ...focusEditor, endDate: "" })
                    }
                    style={styles.endDateClear}
                  >
                    Clear
                  </button>
                )}
              </div>
              <span style={styles.endDateHint}>
                After this date the student is automatically hidden from the
                schedule. Past weeks still show them.
              </span>
            </label>
            <div style={styles.modalActions}>
              <button
                style={styles.btnGhost}
                onClick={() => setFocusEditor(null)}
              >
                Cancel
              </button>
              <button style={styles.btnPrimary} onClick={saveFocusEditor}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {endDatePicker && (
        <div
          style={styles.modalBackdrop}
          onClick={() => setEndDatePicker(null)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                📅 When does {endDatePicker.studentName} stop?
              </h3>
            </div>
            <p style={styles.modalNote}>
              Pick the last date this student will attend. After that date,
              they're hidden from future weeks. Past weeks still show them as{" "}
              <strong>Stopped</strong>.
            </p>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Stop date</span>
              <input
                type="date"
                value={endDatePicker.value}
                onChange={(e) =>
                  setEndDatePicker({ ...endDatePicker, value: e.target.value })
                }
                style={styles.input}
                autoFocus
              />
            </label>
            <div style={styles.modalActions}>
              {endDatePicker.currentEndDate && (
                <button
                  style={styles.btnGhost}
                  onClick={() =>
                    setEndDatePicker({ ...endDatePicker, value: "" })
                  }
                >
                  Clear stop date
                </button>
              )}
              <button
                style={styles.btnGhost}
                onClick={() => setEndDatePicker(null)}
              >
                Cancel
              </button>
              <button style={styles.btnPrimary} onClick={saveEndDate}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Audio Report Modal === */}
      {showReport && (
        <div
          style={{ ...styles.modalBackdrop, padding: 0 }}
          onClick={() => setShowReport(false)}
        >
          <div
            style={{
              ...styles.reportModal,
              maxWidth: "100%",
              width: "100%",
              maxHeight: "100vh",
              height: "100vh",
              borderRadius: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                ...styles.reportHeader,
                padding: isMobile ? "14px 16px" : "20px 24px",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <div style={styles.reportEyebrow}>WEEKLY AUDIO REPORT</div>
                <h2 style={styles.reportTitle}>📊 Audio Submission Report</h2>
              </div>

              {/* Weekend parent message reminder — Saturday or Sunday only */}
              {(() => {
                const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
                const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
                if (!isWeekend) return null;
                const msg = `To align tutoring with what your child is learning at school, please share any available weekly materials (homework, newsletter, workbook/take-home folder, or anything showing current classroom topics).\n\nNote: Also, please notify the tutor in advance about any upcoming state/class/aptitude tests, school entrance exams, or other important assessments, and share any related study guides or prep materials so we can prepare your child effectively.`;
                return (
                  <div style={styles.parentMsgBanner}>
                    <span style={{ fontSize: 20 }}>📢</span>
                    <div style={{ flex: 1 }}>
                      <div style={styles.parentMsgTitle}>Weekend Reminder</div>
                      <div style={styles.parentMsgSub}>
                        Send the weekly materials message to parents today!
                      </div>
                    </div>
                    <button
                      style={styles.parentMsgBtn}
                      onClick={() =>
                        navigator.clipboard
                          .writeText(msg)
                          .then(() =>
                            flash(
                              "✅ Parent message copied! Paste it in WhatsApp.",
                            ),
                          )
                      }
                    >
                      📋 Copy Message
                    </button>
                  </div>
                );
              })()}
              <div style={styles.reportWeekNav}>
                <button
                  style={styles.reportNavBtn}
                  onClick={goReportPrev}
                  title="Previous week"
                >
                  ‹
                </button>
                <div style={styles.reportWeekLabel}>
                  <div style={styles.reportWeekRange}>
                    {fmtShort(reportWeekMonday)} –{" "}
                    {fmtShort(addDays(reportWeekMonday, 6))}
                  </div>
                  {weekKey(reportWeekMonday) === weekKey(getMonday(today)) && (
                    <span style={styles.reportWeekCurrent}>Current Week</span>
                  )}
                </div>
                <button
                  style={styles.reportNavBtn}
                  onClick={goReportNext}
                  title="Next week"
                >
                  ›
                </button>
                {weekKey(reportWeekMonday) !== weekKey(getMonday(today)) && (
                  <button
                    style={styles.reportNavToday}
                    onClick={goReportCurrent}
                    title="Go to current week"
                  >
                    Today
                  </button>
                )}
              </div>
              {reportLoading && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</div>
              )}
              <button
                style={styles.reportClose}
                onClick={() => setShowReport(false)}
              >
                ×
              </button>
            </div>

            <div
              style={{
                ...styles.reportBody,
                padding: isMobile ? "14px 12px" : styles.reportBody.padding,
              }}
            >
              {/* === TWO-COLUMN LAYOUT: Add Form (left) + Entries (right) === */}
              <div
                style={{
                  ...styles.reportTwoCol,
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : styles.reportTwoCol.gridTemplateColumns,
                  gap: isMobile ? 12 : styles.reportTwoCol.gap,
                }}
              >
                {/* LEFT: Add Entry Form */}
                <div
                  ref={formPanelRef}
                  style={{
                    ...styles.reportFormPanel,
                    position: isMobile ? "static" : "sticky",
                    ...(formHighlight ? styles.reportFormPanelHighlight : {}),
                  }}
                >
                  <div style={styles.reportFormHeader}>
                    <div style={styles.reportFormIcon}>➕</div>
                    <div>
                      <div style={styles.reportFormTitle}>Add Session</div>
                      <div style={styles.reportFormSub}>
                        Enter tutor &amp; student details
                      </div>
                    </div>
                    <button
                      style={styles.manageGroupsBtn}
                      onClick={() => setShowGroupManager(true)}
                    >
                      📱 Groups
                    </button>
                  </div>

                  <datalist id="tutor-suggestions">
                    {[
                      ...new Set([
                        ...scheduleStudentIndex.map((s) => s.tutorName),
                        ...reportManualEntries.map((e) => e.tutorName),
                      ]),
                    ].map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  <datalist id="student-suggestions">
                    {[
                      ...new Set([
                        ...scheduleStudentIndex.map((s) => s.studentName),
                        ...reportManualEntries.map((e) => e.studentName),
                      ]),
                    ].map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>

                  {/* Tutor field */}
                  <div style={styles.reportFormField}>
                    <label style={styles.reportFormLabel}>
                      <span
                        style={{
                          ...styles.reportFormLabelDot,
                          background: "#2563eb",
                        }}
                      />
                      TUTOR
                    </label>
                    <input
                      style={{
                        ...styles.reportFormInput,
                        borderColor: "#bfdbfe",
                      }}
                      placeholder="Tutor name"
                      value={manualForm.tutorName}
                      list="tutor-suggestions"
                      onChange={(e) =>
                        setManualForm((p) => ({
                          ...p,
                          tutorName: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && addManualEntry()}
                    />
                  </div>

                  {/* Student field — picking a known student auto-fills their tutor + day from the schedule */}
                  <div style={styles.reportFormField}>
                    <label style={styles.reportFormLabel}>
                      <span
                        style={{
                          ...styles.reportFormLabelDot,
                          background: "#7c3aed",
                        }}
                      />
                      STUDENT
                    </label>
                    <input
                      style={{
                        ...styles.reportFormInput,
                        borderColor: "#ddd6fe",
                      }}
                      placeholder="Type any name, or pick from schedule"
                      value={manualForm.studentName}
                      list="student-suggestions"
                      onChange={(e) => {
                        const typed = e.target.value;
                        // If the typed value exactly matches a student on the schedule, auto-fill tutor + day
                        const match = scheduleStudentIndex.find(
                          (s) =>
                            s.studentName.toLowerCase() === typed.toLowerCase(),
                        );
                        if (match) {
                          setManualForm((p) => ({
                            ...p,
                            studentName: typed,
                            tutorName: match.tutorName,
                            dayId: match.dayId,
                          }));
                          flash(
                            `Auto-filled: ${match.tutorName} · ${match.dayLabel}`,
                          );
                        } else {
                          setManualForm((p) => ({ ...p, studentName: typed }));
                        }
                      }}
                      onKeyDown={(e) => e.key === "Enter" && addManualEntry()}
                    />
                    {/* Show all of this student's scheduled tutor/day pairs if they appear more than once */}
                    {manualForm.studentName &&
                      (() => {
                        const matches = scheduleStudentIndex.filter(
                          (s) =>
                            s.studentName.toLowerCase() ===
                            manualForm.studentName.toLowerCase(),
                        );
                        if (matches.length === 0) return null;
                        return (
                          <div style={styles.studentMatchHint}>
                            📅 On schedule:{" "}
                            {matches.map((m, i) => (
                              <button
                                key={i}
                                type="button"
                                style={styles.studentMatchChip}
                                onClick={() => {
                                  setManualForm((p) => ({
                                    ...p,
                                    tutorName: m.tutorName,
                                    dayId: m.dayId,
                                  }));
                                  flash(
                                    `Set to ${m.tutorName} · ${m.dayLabel}`,
                                  );
                                }}
                              >
                                {m.tutorName} · {m.dayLabel}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                  </div>

                  {/* Day + Group */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <div style={styles.reportFormField}>
                      <label style={styles.reportFormLabel}>
                        <span
                          style={{
                            ...styles.reportFormLabelDot,
                            background: "#0891b2",
                          }}
                        />
                        DAY
                      </label>
                      <select
                        style={styles.reportFormInput}
                        value={manualForm.dayId}
                        onChange={(e) => {
                          const newDayId = e.target.value;
                          // Keep the time-of-day the user already picked (if any), just move it to the new day
                          setManualForm((p) => {
                            const day = DAYS.find((d) => d.id === newDayId);
                            const calendarDate = addDays(
                              reportWeekMonday,
                              day.offset,
                            );
                            let newSessionTime = p.sessionTime;
                            if (p.sessionTime) {
                              const prevTime = new Date(p.sessionTime);
                              const merged = new Date(calendarDate);
                              merged.setHours(
                                prevTime.getHours(),
                                prevTime.getMinutes(),
                                0,
                                0,
                              );
                              newSessionTime = merged
                                .toISOString()
                                .slice(0, 16);
                            }
                            return {
                              ...p,
                              dayId: newDayId,
                              sessionTime: newSessionTime,
                            };
                          });
                        }}
                      >
                        {DAYS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {tutorGroups.length > 0 && (
                      <div style={styles.reportFormField}>
                        <label style={styles.reportFormLabel}>
                          <span
                            style={{
                              ...styles.reportFormLabelDot,
                              background: "#7c3aed",
                            }}
                          />
                          GROUP
                        </label>
                        <select
                          style={styles.reportFormInput}
                          value={manualForm.groupId}
                          onChange={(e) =>
                            setManualForm((p) => ({
                              ...p,
                              groupId: e.target.value,
                            }))
                          }
                        >
                          <option value="">No group</option>
                          {tutorGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Session Time — date is auto-pulled from the calendar week + selected day; only pick the time */}
                  <div style={styles.reportFormField}>
                    <label style={styles.reportFormLabel}>
                      <span
                        style={{
                          ...styles.reportFormLabelDot,
                          background: "#dc2626",
                        }}
                      />
                      SESSION TIME (optional)
                    </label>
                    {(() => {
                      const day = DAYS.find((d) => d.id === manualForm.dayId);
                      const calendarDate = addDays(
                        reportWeekMonday,
                        day.offset,
                      );
                      const calendarDateStr = calendarDate.toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" },
                      );
                      return (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              padding: "9px 12px",
                              borderRadius: 9,
                              border: "1.5px solid #e2e8f0",
                              background: "#f1f5f9",
                              fontSize: 13,
                              color: "#475569",
                              fontWeight: 600,
                              flex: "0 0 auto",
                              whiteSpace: "nowrap",
                            }}
                          >
                            📅 {calendarDateStr}
                          </div>
                          <input
                            type="time"
                            style={{ ...styles.reportFormInput, flex: 1 }}
                            value={
                              manualForm.sessionTime
                                ? new Date(manualForm.sessionTime)
                                    .toTimeString()
                                    .slice(0, 5)
                                : ""
                            }
                            onChange={(e) => {
                              if (!e.target.value) {
                                setManualForm((p) => ({
                                  ...p,
                                  sessionTime: "",
                                }));
                                return;
                              }
                              const [h, m] = e.target.value
                                .split(":")
                                .map(Number);
                              const merged = new Date(calendarDate);
                              merged.setHours(h, m, 0, 0);
                              setManualForm((p) => ({
                                ...p,
                                sessionTime: merged.toISOString().slice(0, 16),
                              }));
                            }}
                          />
                        </div>
                      );
                    })()}
                    <div
                      style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}
                    >
                      Date comes from the calendar week (
                      {weekLabel || "current week"}) and selected day. Just pick
                      the session time — used for accurate 24hr overdue
                      tracking. Leave blank to estimate from the day.
                    </div>
                  </div>

                  {/* Audio filename */}
                  <div style={styles.reportFormField}>
                    <label style={styles.reportFormLabel}>
                      <span
                        style={{
                          ...styles.reportFormLabelDot,
                          background: "#059669",
                        }}
                      />
                      AUDIO FILE
                    </label>
                    <input
                      style={{
                        ...styles.reportFormInput,
                        borderColor: "#a7f3d0",
                      }}
                      placeholder="e.g. Kalkidan_Emma_May22.m4a"
                      value={manualForm.audioFilename}
                      onChange={(e) =>
                        setManualForm((p) => ({
                          ...p,
                          audioFilename: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && addManualEntry()}
                    />
                  </div>

                  <button style={styles.reportAddBtn} onClick={addManualEntry}>
                    + Add Session Entry
                  </button>
                </div>

                {/* RIGHT: Grouped entries */}
                <div style={styles.reportEntriesPanel}>
                  {reportManualEntries.length === 0 ? (
                    <div style={styles.reportEntriesEmpty}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#64748b",
                          fontSize: 13,
                        }}
                      >
                        No entries yet
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}
                      >
                        Use the form to add sessions
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          ...styles.reportEntriesHeader,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={styles.reportEntriesTitle}>
                          Sessions This Week
                        </span>
                        <span style={styles.reportEntriesBadge}>
                          {reportManualEntries.length}
                        </span>
                        <div style={styles.viewModeToggle}>
                          <button
                            style={{
                              ...styles.viewModeBtn,
                              ...(reportViewMode === "grouped"
                                ? styles.viewModeBtnActive
                                : {}),
                            }}
                            onClick={() => setReportViewMode("grouped")}
                          >
                            📋 List
                          </button>
                          <button
                            style={{
                              ...styles.viewModeBtn,
                              ...(reportViewMode === "grid"
                                ? styles.viewModeBtnActive
                                : {}),
                            }}
                            onClick={() => setReportViewMode("grid")}
                          >
                            🗓️ Calendar Grid
                          </button>
                        </div>
                      </div>
                      {reportViewMode === "grid" ? (
                        <CalendarGridView
                          entries={reportManualEntries}
                          weekMonday={reportWeekMonday}
                          onCellClick={(entry) => setEditingEntry({ ...entry })}
                          onAddClick={handleGridAddClick}
                          sessionClipboard={sessionClipboard}
                          onCopySession={copySessionEntry}
                          onPasteSession={pasteSessionEntry}
                          onMoveSession={moveSessionEntry}
                          onDuplicateSession={duplicateSessionEntry}
                          onDeleteSession={deleteManualEntry}
                          onMakeupDone={handleMakeupDone}
                          onMakeupUndo={handleMakeupUndo}
                        />
                      ) : (
                        (() => {
                          const tutorOrder = [];
                          const grouped = {};
                          reportManualEntries.forEach((entry) => {
                            if (!grouped[entry.tutorName]) {
                              tutorOrder.push(entry.tutorName);
                              grouped[entry.tutorName] = {
                                studentOrder: [],
                                students: {},
                              };
                            }
                            const tg = grouped[entry.tutorName];
                            if (!tg.students[entry.studentName]) {
                              tg.studentOrder.push(entry.studentName);
                              tg.students[entry.studentName] = [];
                            }
                            tg.students[entry.studentName].push(entry);
                          });

                          return tutorOrder.map((tutorName, ti) => {
                            const tg = grouped[tutorName];
                            const allE = tg.studentOrder.flatMap(
                              (s) => tg.students[s],
                            );
                            const sent = allE.filter(countsAsSent).length;
                            const tutorColor = [
                              "#2563eb",
                              "#0891b2",
                              "#0d9488",
                              "#7c3aed",
                              "#dc2626",
                            ][ti % 5];
                            return (
                              <div key={tutorName} style={styles.newTutorCard}>
                                {/* Tutor banner */}
                                <div
                                  style={{
                                    ...styles.newTutorBanner,
                                    background: tutorColor,
                                  }}
                                >
                                  <div style={styles.newTutorBannerLeft}>
                                    <span style={styles.newTutorAvatar}>
                                      {tutorName.charAt(0).toUpperCase()}
                                    </span>
                                    <div>
                                      <div style={styles.newTutorName}>
                                        {tutorName}
                                      </div>
                                      <div style={styles.newTutorRole}>
                                        Tutor · {tg.studentOrder.length} student
                                        {tg.studentOrder.length !== 1
                                          ? "s"
                                          : ""}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={styles.newTutorStats}>
                                    <span style={styles.newTutorStatNum}>
                                      {sent}
                                    </span>
                                    <span style={styles.newTutorStatLabel}>
                                      / {allE.length} sent
                                    </span>
                                  </div>
                                </div>

                                {/* Students */}
                                <div style={styles.newStudentList}>
                                  {tg.studentOrder.map((studentName, si) => {
                                    const entries = tg.students[studentName];
                                    const sSent =
                                      entries.filter(countsAsSent).length;
                                    const studentColors = [
                                      "#7c3aed",
                                      "#db2777",
                                      "#ea580c",
                                      "#059669",
                                      "#0284c7",
                                    ];
                                    const sColor =
                                      studentColors[si % studentColors.length];
                                    return (
                                      <div
                                        key={studentName}
                                        style={styles.newStudentCard}
                                      >
                                        {/* Student header */}
                                        <div style={styles.newStudentHeader}>
                                          <span
                                            style={{
                                              ...styles.newStudentAvatar,
                                              background: sColor,
                                            }}
                                          >
                                            {studentName
                                              .charAt(0)
                                              .toUpperCase()}
                                          </span>
                                          <div style={{ flex: 1 }}>
                                            <span style={styles.newStudentName}>
                                              {studentName}
                                            </span>
                                            <span style={styles.newStudentRole}>
                                              Student
                                            </span>
                                          </div>
                                          <span
                                            style={{
                                              ...styles.newStudentSent,
                                              color: sColor,
                                            }}
                                          >
                                            {sSent}/{entries.length}
                                          </span>
                                        </div>

                                        {/* Session rows */}
                                        {entries.map((entry) => {
                                          const day = DAYS.find(
                                            (d) => d.id === entry.dayId,
                                          );
                                          const st =
                                            STATUS[entry.status] ||
                                            STATUS.pending;
                                          const statusColors = {
                                            pending: "#64748b",
                                            uploaded: "#d97706",
                                            reviewed: "#16a34a",
                                            absent: "#9a3412",
                                            cancelled: "#6b21a8",
                                          };
                                          const sc =
                                            statusColors[entry.status] ||
                                            "#64748b";
                                          return (
                                            <div
                                              key={entry.id}
                                              style={{
                                                ...styles.newSessionRow,
                                                flexWrap: isMobile
                                                  ? "wrap"
                                                  : "nowrap",
                                              }}
                                            >
                                              <div
                                                style={{
                                                  ...styles.newDayPill,
                                                  background:
                                                    day?.color || "#64748b",
                                                }}
                                              >
                                                {day?.short || entry.dayId}
                                              </div>
                                              <div
                                                style={{
                                                  ...styles.newStatusPill,
                                                  background: sc + "18",
                                                  color: sc,
                                                  border: `1px solid ${sc}44`,
                                                }}
                                              >
                                                {st.label}
                                              </div>
                                              <input
                                                style={styles.newFilenameInput}
                                                placeholder="📎 filename…"
                                                value={
                                                  entry.audioFilename || ""
                                                }
                                                onChange={(e) =>
                                                  setReportManualEntries((p) =>
                                                    p.map((x) =>
                                                      x.id === entry.id
                                                        ? {
                                                            ...x,
                                                            audioFilename:
                                                              e.target.value,
                                                          }
                                                        : x,
                                                    ),
                                                  )
                                                }
                                                onBlur={(e) => {
                                                  const val =
                                                    e.target.value.trim();
                                                  // Typing a filename IS "the audio was sent" — auto-advance status so
                                                  // the Daily Reminder / Overdue counts reflect it immediately, instead
                                                  // of silently staying "Pending" until someone separately clicks the status pill.
                                                  const shouldAutoAdvance =
                                                    val &&
                                                    (entry.status ===
                                                      "pending" ||
                                                      !entry.status);
                                                  if (shouldAutoAdvance) {
                                                    patchManualEntry(entry.id, {
                                                      audioFilename: val,
                                                      status: "uploaded",
                                                    });
                                                  } else {
                                                    patchManualEntry(entry.id, {
                                                      audioFilename: val,
                                                    });
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter")
                                                    e.target.blur();
                                                }}
                                              />
                                              <button
                                                type="button"
                                                title={
                                                  entry.materialStatus ===
                                                  "sent"
                                                    ? "Material sent — click to cycle"
                                                    : entry.materialStatus ===
                                                        "none"
                                                      ? "Tutor said no material this session — click to cycle"
                                                      : "Not answered yet — click to mark"
                                                }
                                                onClick={() => {
                                                  const order = [
                                                    "unanswered",
                                                    "sent",
                                                    "none",
                                                  ];
                                                  const current =
                                                    entry.materialStatus ||
                                                    "unanswered";
                                                  const next =
                                                    order[
                                                      (order.indexOf(current) +
                                                        1) %
                                                        order.length
                                                    ];
                                                  patchManualEntry(entry.id, {
                                                    materialStatus: next,
                                                  });
                                                }}
                                                style={{
                                                  ...styles.materialToggle,
                                                  background:
                                                    entry.materialStatus ===
                                                    "sent"
                                                      ? "#dcfce7"
                                                      : entry.materialStatus ===
                                                          "none"
                                                        ? "#fee2e2"
                                                        : "#f1f5f9",
                                                  color:
                                                    entry.materialStatus ===
                                                    "sent"
                                                      ? "#15803d"
                                                      : entry.materialStatus ===
                                                          "none"
                                                        ? "#b91c1c"
                                                        : "#94a3b8",
                                                  border: `1px solid ${
                                                    entry.materialStatus ===
                                                    "sent"
                                                      ? "#86efac"
                                                      : entry.materialStatus ===
                                                          "none"
                                                        ? "#fca5a5"
                                                        : "#e2e8f0"
                                                  }`,
                                                }}
                                              >
                                                {entry.materialStatus === "sent"
                                                  ? "📚✅ Sent"
                                                  : entry.materialStatus ===
                                                      "none"
                                                    ? "📚🚫 None"
                                                    : "📚 ?"}
                                              </button>
                                              <button
                                                type="button"
                                                title="Click to cycle status"
                                                onClick={() => {
                                                  const current =
                                                    entry.status || "pending";
                                                  const next =
                                                    STATUS[current]?.next ||
                                                    "pending";
                                                  patchManualEntry(entry.id, {
                                                    status: next,
                                                  });
                                                }}
                                                style={{
                                                  ...styles.newStatusPill,
                                                  background:
                                                    (STATUS[entry.status]
                                                      ?.color || "#64748b") +
                                                    "18",
                                                  color:
                                                    STATUS[entry.status]
                                                      ?.color || "#64748b",
                                                  border: `1px solid ${STATUS[entry.status]?.color || "#64748b"}44`,
                                                  cursor: "pointer",
                                                  flexShrink: 0,
                                                }}
                                              >
                                                {STATUS[entry.status]?.label ||
                                                  "Pending"}
                                              </button>
                                              <button
                                                style={styles.newEditBtn}
                                                onClick={() =>
                                                  setEditingEntry({ ...entry })
                                                }
                                                title="Edit"
                                              >
                                                ✏️
                                              </button>
                                              <button
                                                style={{
                                                  ...styles.newEditBtn,
                                                  background: "#f0fdf4",
                                                  fontSize: 10,
                                                  padding: "0 4px",
                                                }}
                                                onClick={() =>
                                                  setDailyReportCheck({
                                                    entryId: entry.id,
                                                    tutorName: entry.tutorName,
                                                    studentName:
                                                      entry.studentName,
                                                    dayId: entry.dayId,
                                                    checked: {},
                                                  })
                                                }
                                                title="Check daily report completeness"
                                              >
                                                📋
                                              </button>
                                              <button
                                                style={styles.newDeleteBtn}
                                                onClick={() =>
                                                  deleteManualEntry(entry.id)
                                                }
                                                title="Remove"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Summary cards */}
              {reportData.totalSessions === 0 ? (
                <div style={{ ...styles.reportEmpty, paddingTop: 8 }}>
                  <div style={styles.reportEmptyIcon}>📊</div>
                  <div style={styles.reportEmptyTitle}>No data yet</div>
                  <div style={styles.reportEmptySub}>
                    Add sessions above to see the summary.
                  </div>
                </div>
              ) : (
                <>
                  <div style={styles.reportSummary}>
                    <div
                      style={{
                        ...styles.reportCard,
                        background: "#ecfdf5",
                        borderColor: "#86efac",
                      }}
                    >
                      <div style={styles.reportCardLabel}>✅ Sent</div>
                      <div
                        style={{ ...styles.reportCardValue, color: "#15803d" }}
                      >
                        {reportData.sent}
                      </div>
                      <div style={styles.reportCardSub}>
                        of {reportData.totalSessions}
                      </div>
                    </div>
                    <div
                      style={{
                        ...styles.reportCard,
                        background: "#fef2f2",
                        borderColor: "#fca5a5",
                      }}
                    >
                      <div style={styles.reportCardLabel}>⚠️ Missed</div>
                      <div
                        style={{ ...styles.reportCardValue, color: "#b91c1c" }}
                      >
                        {reportData.missed}
                      </div>
                      <div style={styles.reportCardSub}>
                        {reportData.tutorsWithMissed} tutor
                        {reportData.tutorsWithMissed === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div
                      style={{
                        ...styles.reportCard,
                        background: "#eff6ff",
                        borderColor: "#93c5fd",
                      }}
                    >
                      <div style={styles.reportCardLabel}>⏳ Upcoming</div>
                      <div
                        style={{ ...styles.reportCardValue, color: "#1d4ed8" }}
                      >
                        {reportData.upcoming}
                      </div>
                      <div style={styles.reportCardSub}>still pending</div>
                    </div>
                    <div
                      style={{
                        ...styles.reportCard,
                        background: "#f5f3ff",
                        borderColor: "#c4b5fd",
                      }}
                    >
                      <div style={styles.reportCardLabel}>👥 Tutors</div>
                      <div
                        style={{ ...styles.reportCardValue, color: "#6d28d9" }}
                      >
                        {reportData.tutors.length}
                      </div>
                      <div style={styles.reportCardSub}>active</div>
                    </div>
                    <div
                      style={{
                        ...styles.reportCard,
                        background:
                          reportData.materialUnanswered > 0
                            ? "#fffbeb"
                            : "#ecfdf5",
                        borderColor:
                          reportData.materialUnanswered > 0
                            ? "#fcd34d"
                            : "#86efac",
                      }}
                    >
                      <div style={styles.reportCardLabel}>📚 Material</div>
                      <div
                        style={{
                          ...styles.reportCardValue,
                          color:
                            reportData.materialUnanswered > 0
                              ? "#b45309"
                              : "#15803d",
                          fontSize: 18,
                        }}
                      >
                        ✅{reportData.materialSent} 🚫{reportData.materialNone}{" "}
                        ❓{reportData.materialUnanswered}
                      </div>
                      <div style={styles.reportCardSub}>
                        sent · none · unanswered
                      </div>
                    </div>
                  </div>

                  {/* Material follow-up banner */}
                  {reportData.materialUnanswered > 0 && (
                    <div style={styles.materialAlertBanner}>
                      ❓ <strong>{reportData.materialUnanswered}</strong>{" "}
                      session{reportData.materialUnanswered !== 1 ? "s" : ""}{" "}
                      haven't been asked about in-session material yet. Tutors
                      should report whether material was sent, or explicitly say
                      there was none.
                    </div>
                  )}

                  {/* Alert banner if any missed */}
                  {reportData.missed > 0 && (
                    <div style={styles.reportAlert}>
                      <span style={{ fontSize: 18 }}>⚠️</span>
                      <div>
                        <strong>
                          {reportData.tutorsWithMissed} tutor
                          {reportData.tutorsWithMissed === 1 ? "" : "s"}
                        </strong>{" "}
                        missed <strong>{reportData.missed}</strong> audio
                        submission{reportData.missed === 1 ? "" : "s"} this
                        week.
                      </div>
                    </div>
                  )}

                  {/* Per-tutor audio count table — grouped by WhatsApp group */}
                  <div style={{ ...styles.audioCountTable, overflowX: "auto" }}>
                    <div style={styles.audioCountTitle}>
                      📻 Audio Submissions This Week — Per Tutor
                    </div>
                    {(() => {
                      // Group tutors by their group; ungrouped goes to "No Group"
                      const grouped = {};
                      reportData.tutors.forEach((tutor) => {
                        const g = getTutorGroup(tutor.name);
                        const key = g ? g.name : "__none__";
                        if (!grouped[key])
                          grouped[key] = {
                            label: g ? g.name : "No Group",
                            tutors: [],
                          };
                        grouped[key].tutors.push(tutor);
                      });
                      const groupOrder = [
                        ...tutorGroups
                          .map((g) => g.name)
                          .filter((n) => grouped[n]),
                        ...(grouped["__none__"] ? ["__none__"] : []),
                      ];
                      return groupOrder.map((key) => {
                        const { label, tutors } = grouped[key];
                        const isNoGroup = key === "__none__";
                        return (
                          <div key={key} style={styles.groupBlock}>
                            <div style={styles.groupBlockHeader}>
                              <span style={styles.groupBlockIcon}>
                                {isNoGroup ? "👤" : "📱"}
                              </span>
                              <span style={styles.groupBlockName}>{label}</span>
                              <span style={styles.groupBlockCount}>
                                {tutors.length} tutor
                                {tutors.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <table style={styles.audioTable}>
                              <thead>
                                <tr>
                                  <th
                                    style={{
                                      ...styles.audioTh,
                                      textAlign: "left",
                                    }}
                                  >
                                    Tutor
                                  </th>
                                  <th style={styles.audioTh}>Days Sent</th>
                                  <th style={styles.audioTh}>Min Days</th>
                                  <th style={styles.audioTh}>Sessions Sent</th>
                                  <th style={styles.audioTh}>Min Sessions</th>
                                  <th style={styles.audioTh}>Status</th>
                                  <th style={styles.audioTh}>Set Min</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tutors.map((tutor) => {
                                  const exp = getExpectation(tutor.name);
                                  const minS = exp.minSessions || 0;
                                  const minD = exp.minDays || 0;
                                  const daysSent = tutor.byDay.filter((d) =>
                                    d.sessions.some((s) => s.audioSent),
                                  ).length;
                                  const metSessions =
                                    minS === 0 || tutor.sentSessions >= minS;
                                  const metDays =
                                    minD === 0 || daysSent >= minD;
                                  const allMet = metSessions && metDays;
                                  const noneSet = minS === 0 && minD === 0;
                                  const statusLabel = noneSet
                                    ? "—"
                                    : allMet
                                      ? "✅ Met"
                                      : "❌ Below";
                                  const statusColor = noneSet
                                    ? "#94a3b8"
                                    : allMet
                                      ? "#15803d"
                                      : "#b91c1c";
                                  const avatarBg =
                                    tutor.sentSessions === 0
                                      ? "#dc2626"
                                      : allMet
                                        ? "#16a34a"
                                        : "#d97706";
                                  return (
                                    <tr key={tutor.name} style={styles.audioTr}>
                                      <td
                                        style={{
                                          ...styles.audioTd,
                                          fontWeight: 700,
                                          textAlign: "left",
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 28,
                                            height: 28,
                                            fontSize: 12,
                                            marginRight: 8,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: 999,
                                            color: "#fff",
                                            background: avatarBg,
                                            flexShrink: 0,
                                          }}
                                        >
                                          {tutor.name.charAt(0).toUpperCase()}
                                        </span>
                                        {tutor.name}
                                      </td>
                                      <td
                                        style={{
                                          ...styles.audioTd,
                                          fontWeight: 800,
                                          color:
                                            metDays || noneSet
                                              ? "#15803d"
                                              : "#b91c1c",
                                        }}
                                      >
                                        {daysSent}
                                      </td>
                                      <td
                                        style={{
                                          ...styles.audioTd,
                                          color: "#475569",
                                        }}
                                      >
                                        {minD || "—"}
                                      </td>
                                      <td
                                        style={{
                                          ...styles.audioTd,
                                          fontWeight: 800,
                                          color:
                                            metSessions || noneSet
                                              ? "#15803d"
                                              : "#b91c1c",
                                        }}
                                      >
                                        {tutor.sentSessions}
                                      </td>
                                      <td
                                        style={{
                                          ...styles.audioTd,
                                          color: "#475569",
                                        }}
                                      >
                                        {minS || "—"}
                                      </td>
                                      <td
                                        style={{
                                          ...styles.audioTd,
                                          color: statusColor,
                                          fontWeight: 700,
                                        }}
                                      >
                                        {statusLabel}
                                      </td>
                                      <td style={styles.audioTd}>
                                        <button
                                          style={styles.expEditBtn}
                                          onClick={() =>
                                            setEditingExpectation({
                                              tutorName: tutor.name,
                                              minSessions: minS,
                                              minDays: minD,
                                            })
                                          }
                                        >
                                          ⚙️
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                ...styles.reportFooter,
                padding: isMobile ? "10px 12px" : styles.reportFooter.padding,
              }}
            >
              <span style={styles.reportFooterNote}>
                💡 "Pending" past the day = missed · "Uploaded" or "Reviewed" =
                sent
              </span>
              {(today.getDay() === 6 || today.getDay() === 0) && (
                <button
                  style={{
                    ...styles.btnGhost,
                    color: "#16a34a",
                    borderColor: "#86efac",
                  }}
                  onClick={() => {
                    const msg = `To align tutoring with what your child is learning at school, please share any available weekly materials (homework, newsletter, workbook/take-home folder, or anything showing current classroom topics).\n\nNote: Also, please notify the tutor in advance about any upcoming state/class/aptitude tests, school entrance exams, or other important assessments, and share any related study guides or prep materials so we can prepare your child effectively.`;
                    navigator.clipboard
                      .writeText(msg)
                      .then(() =>
                        flash(
                          "✅ Parent message copied! Paste it in WhatsApp.",
                        ),
                      );
                  }}
                >
                  📋 Copy Parent Message
                </button>
              )}
              <button
                style={{
                  ...styles.btnGhost,
                  color: "#0891b2",
                  borderColor: "#a5f3fc",
                }}
                onClick={copyAudioCalendarToNextWeek}
                title="Copy this week's sessions to next week, reset to Pending"
              >
                📅➡️ Copy to Next Week
              </button>
              <button
                style={{
                  ...styles.btnGhost,
                  color:
                    Object.keys(buildDailyReminderMessages()).length > 0
                      ? "#d97706"
                      : "#64748b",
                  borderColor:
                    Object.keys(buildDailyReminderMessages()).length > 0
                      ? "#fcd34d"
                      : "#e2e8f0",
                  position: "relative",
                }}
                onClick={() => setShowDailyReminder(true)}
                title="Generate WhatsApp reminders for tutors who haven't sent"
              >
                📨 Daily Reminder
                {Object.keys(buildDailyReminderMessages()).length > 0 && (
                  <span style={styles.overdueBadgeBtn}>
                    {Object.keys(buildDailyReminderMessages()).length}
                  </span>
                )}
              </button>
              <button
                style={{
                  ...styles.btnGhost,
                  color: overdueData.count > 0 ? "#dc2626" : "#64748b",
                  borderColor: overdueData.count > 0 ? "#fca5a5" : "#e2e8f0",
                  position: "relative",
                }}
                onClick={() => setShowOverdueView(true)}
              >
                ⏰ 24hr Overdue
                {overdueData.count > 0 && (
                  <span style={styles.overdueBadgeBtn}>
                    {overdueData.count}
                  </span>
                )}
              </button>
              <button
                style={{
                  ...styles.btnGhost,
                  color: "#7c3aed",
                  borderColor: "#c4b5fd",
                }}
                onClick={() => {
                  const start = getCurrentBiweeklyStart();
                  setBiweeklyStartDate(start);
                  setShowBiweeklySummary(true);
                  loadBiweeklySummary(start);
                }}
              >
                📊 2-Week Summary
              </button>
              <button
                style={styles.btnPrimary}
                onClick={() => setShowReport(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Edit Entry Modal === */}
      {editingEntry && (
        <div
          style={{ ...styles.modalBackdrop, zIndex: 200 }}
          onClick={() => setEditingEntry(null)}
        >
          <div
            style={{ ...styles.modal, maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>✏️ Edit Entry</h3>
              <button
                style={styles.modalClose}
                onClick={() => setEditingEntry(null)}
              >
                ×
              </button>
            </div>

            <div style={styles.field}>
              <span style={styles.fieldLabel}>Tutor Name</span>
              <input
                style={styles.input}
                value={editingEntry.tutorName}
                onChange={(e) =>
                  setEditingEntry((p) => ({ ...p, tutorName: e.target.value }))
                }
              />
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Student Name</span>
              <input
                style={styles.input}
                value={editingEntry.studentName}
                onChange={(e) =>
                  setEditingEntry((p) => ({
                    ...p,
                    studentName: e.target.value,
                  }))
                }
              />
            </div>
            <div style={styles.row2}>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Day</span>
                <select
                  style={styles.input}
                  value={editingEntry.dayId}
                  onChange={(e) =>
                    setEditingEntry((p) => ({ ...p, dayId: e.target.value }))
                  }
                >
                  {DAYS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <span style={styles.fieldLabel}>Status</span>
                <select
                  style={styles.input}
                  value={editingEntry.status}
                  onChange={(e) =>
                    setEditingEntry((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="uploaded">Uploaded</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="absent">Absent</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Audio Filename</span>
              <input
                style={styles.input}
                value={editingEntry.audioFilename || ""}
                placeholder="e.g. Kalkidan_Emma_May22.m4a"
                onChange={(e) =>
                  setEditingEntry((p) => ({
                    ...p,
                    audioFilename: e.target.value,
                  }))
                }
              />
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>
                🕐 Exact Session Time (for 24hr overdue tracking)
              </span>
              <input
                type="datetime-local"
                style={styles.input}
                value={
                  editingEntry.sessionTime
                    ? new Date(editingEntry.sessionTime)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  setEditingEntry((p) => ({
                    ...p,
                    sessionTime: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  }))
                }
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                Set the exact date/time this session happened. Used to calculate
                when the 24-hour audio deadline passes.
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.btnGhost}
                onClick={() => setEditingEntry(null)}
              >
                Cancel
              </button>
              <button style={styles.btnPrimary} onClick={saveEditEntry}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Group Manager Modal === */}
      {showGroupManager && (
        <div
          style={{ ...styles.modalBackdrop, zIndex: 200 }}
          onClick={() => setShowGroupManager(false)}
        >
          <div
            style={{ ...styles.modal, maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📱 Manage Tutor Groups</h3>
              <button
                style={styles.modalClose}
                onClick={() => setShowGroupManager(false)}
              >
                ×
              </button>
            </div>
            <p style={styles.modalNote}>
              Create WhatsApp groups and assign tutors. Each tutor can only be
              in one group.
            </p>

            {/* Create new group */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                placeholder="New group name (e.g. Tutor Space 1)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGroup()}
              />
              <button style={styles.btnPrimary} onClick={createGroup}>
                + Create
              </button>
            </div>

            {/* Groups list */}
            {tutorGroups.length === 0 ? (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 13,
                  textAlign: "center",
                  padding: "20px 0",
                }}
              >
                No groups yet — create one above
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {tutorGroups.map((g) => (
                  <div key={g.id} style={styles.groupManagerRow}>
                    <div style={styles.groupManagerHeader}>
                      <span style={styles.groupManagerName}>📱 {g.name}</span>
                      <button
                        style={styles.groupDeleteBtn}
                        onClick={() => deleteGroup(g.id, g.name)}
                        title="Delete group"
                      >
                        🗑
                      </button>
                    </div>
                    {/* Members */}
                    <div style={styles.groupMemberList}>
                      {g.members.length === 0 ? (
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>
                          No tutors assigned yet
                        </span>
                      ) : (
                        g.members.map((m) => (
                          <span key={m} style={styles.groupMemberChip}>
                            {m}
                            <button
                              style={styles.groupMemberRemove}
                              onClick={() => assignTutorToGroup(null, m)}
                              title="Remove from group"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    {/* Assign tutor dropdown */}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <select
                        style={{ ...styles.manualSelect, flex: 1 }}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            assignTutorToGroup(g.id, e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">+ Assign a tutor…</option>
                        {[
                          ...new Set(
                            reportManualEntries.map((e) => e.tutorName),
                          ),
                        ]
                          .filter(
                            (t) =>
                              !tutorGroups.some((gr) => gr.members.includes(t)),
                          )
                          .map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                style={styles.btnPrimary}
                onClick={() => setShowGroupManager(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Expectation Edit Modal === */}
      {editingExpectation && (
        <div
          style={{ ...styles.modalBackdrop, zIndex: 200 }}
          onClick={() => setEditingExpectation(null)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>⚙️ Set Minimum Expectation</h3>
              <span style={styles.modalDay}>
                {editingExpectation.tutorName}
              </span>
            </div>
            <p style={styles.modalNote}>
              Set how many sessions and days this tutor should send audio each
              week.
            </p>

            <div style={styles.row2}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>
                  Min Sessions (audio files)
                </span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  style={styles.input}
                  value={editingExpectation.minSessions}
                  onChange={(e) =>
                    setEditingExpectation((p) => ({
                      ...p,
                      minSessions: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Min Days per week</span>
                <input
                  type="number"
                  min="0"
                  max="7"
                  style={styles.input}
                  value={editingExpectation.minDays}
                  onChange={(e) =>
                    setEditingExpectation((p) => ({
                      ...p,
                      minDays: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </label>
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.btnGhost}
                onClick={() => setEditingExpectation(null)}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.btnGhost,
                  color: "#7c3aed",
                  borderColor: "#c4b5fd",
                }}
                onClick={async () => {
                  await saveExpectation(
                    editingExpectation.tutorName,
                    editingExpectation.minSessions,
                    editingExpectation.minDays,
                    true,
                  );
                  setEditingExpectation(null);
                }}
              >
                Save this week only
              </button>
              <button
                style={styles.btnPrimary}
                onClick={async () => {
                  await saveExpectation(
                    editingExpectation.tutorName,
                    editingExpectation.minSessions,
                    editingExpectation.minDays,
                    false,
                  );
                  setEditingExpectation(null);
                }}
              >
                Save permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === 2-Week Summary Modal === */}
      {showBiweeklySummary && (
        <div
          style={{ ...styles.modalBackdrop, zIndex: 200 }}
          onClick={() => setShowBiweeklySummary(false)}
        >
          <div
            style={{ ...styles.modal, maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📊 2-Week Audio Summary</h3>
              <button
                style={styles.modalClose}
                onClick={() => setShowBiweeklySummary(false)}
              >
                ×
              </button>
            </div>
            <p style={styles.modalNote}>
              Bi-weekly periods start every 14 days from May 18. Due date is
              always the Tuesday after the period ends.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  ...styles.field,
                  flex: 1,
                  marginBottom: 0,
                  minWidth: 160,
                }}
              >
                <span style={styles.fieldLabel}>Period Start Date</span>
                <input
                  type="date"
                  style={styles.input}
                  value={biweeklyStartDate}
                  onChange={(e) => setBiweeklyStartDate(e.target.value)}
                />
              </label>
              <button
                style={{
                  ...styles.btnGhost,
                  whiteSpace: "nowrap",
                  alignSelf: "flex-end",
                }}
                disabled={!biweeklyStartDate}
                onClick={() => {
                  const prev = fmtISO(
                    addDays(new Date(biweeklyStartDate), -14),
                  );
                  setBiweeklyStartDate(prev);
                  loadBiweeklySummary(prev);
                }}
              >
                ‹ Prev 2 weeks
              </button>
              <button
                style={{
                  ...styles.btnPrimary,
                  whiteSpace: "nowrap",
                  alignSelf: "flex-end",
                }}
                onClick={() => loadBiweeklySummary(biweeklyStartDate)}
                disabled={!biweeklyStartDate || biweeklyLoading}
              >
                {biweeklyLoading ? "Loading…" : "Generate"}
              </button>
              <button
                style={{
                  ...styles.btnGhost,
                  whiteSpace: "nowrap",
                  alignSelf: "flex-end",
                }}
                disabled={!biweeklyStartDate}
                onClick={() => {
                  const next = fmtISO(addDays(new Date(biweeklyStartDate), 14));
                  setBiweeklyStartDate(next);
                  loadBiweeklySummary(next);
                }}
              >
                Next 2 weeks ›
              </button>
            </div>

            {biweeklyData && (
              <>
                {/* Period header */}
                <div style={styles.biweeklyHeader}>
                  <span style={styles.biweeklyPeriod}>
                    📅 {biweeklyData.startLabel} – {biweeklyData.endLabel}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Due:{" "}
                    <strong style={{ color: "#7c3aed" }}>
                      Tuesday {biweeklyData.dueLabel}
                    </strong>
                  </span>
                  {biweeklyData.isEndOfPeriod && (
                    <span style={styles.biweeklyEndBadge}>
                      🔔 Report Due Today
                    </span>
                  )}
                  {biweeklyData.isDueSoon && (
                    <span
                      style={{
                        ...styles.biweeklyEndBadge,
                        background: "#fff7ed",
                        color: "#c2410c",
                        border: "1px solid #fed7aa",
                      }}
                    >
                      ⏰ Due {biweeklyData.dueLabel}
                    </span>
                  )}
                </div>

                {/* Week labels */}
                <div style={styles.biweeklyWeekLabels}>
                  <span style={styles.biweeklyWeekLabel}>
                    Week 1: {biweeklyData.week1Label}
                  </span>
                  <span style={styles.biweeklyWeekLabel}>
                    Week 2: {biweeklyData.week2Label}
                  </span>
                </div>

                {/* Tutor rows */}
                {biweeklyData.tutors.length === 0 ? (
                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: 13,
                      textAlign: "center",
                      padding: "20px 0",
                    }}
                  >
                    No entries found for this period
                  </div>
                ) : (
                  <div style={styles.biweeklyList}>
                    {biweeklyData.tutors.map((item) => {
                      const exp = item.expected;
                      const met = exp === 0 || item.sent === exp;
                      const pct =
                        exp === 0
                          ? 100
                          : Math.min(100, Math.round((item.sent / exp) * 100));
                      const color = met
                        ? "#15803d"
                        : item.sent === 0
                          ? "#dc2626"
                          : "#d97706";
                      const bg = met
                        ? "#dcfce7"
                        : item.sent === 0
                          ? "#fee2e2"
                          : "#fef3c7";
                      const statusIcon = met
                        ? "✅"
                        : item.sent === 0
                          ? "❌"
                          : "⚠️";
                      return (
                        <div
                          key={`${item.name}||${item.tutorName}`}
                          style={styles.biweeklyRow}
                        >
                          <span
                            style={{
                              ...styles.biweeklyAvatar,
                              background: color,
                            }}
                          >
                            {item.name.charAt(0).toUpperCase()}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 2,
                              }}
                            >
                              <div>
                                <span style={styles.biweeklyTutorName}>
                                  {item.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    color: "#94a3b8",
                                    marginLeft: 8,
                                  }}
                                >
                                  via {item.tutorName}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                expected:{" "}
                                <strong style={{ color: "#0f172a" }}>
                                  {exp}
                                </strong>
                                {(item.cancelled > 0 || item.absent > 0) && (
                                  <span
                                    style={{ marginLeft: 6, color: "#94a3b8" }}
                                  >
                                    (
                                    {item.cancelled > 0
                                      ? `${item.cancelled} cancelled`
                                      : ""}
                                    {item.absent > 0
                                      ? `${item.cancelled > 0 ? ", " : ""}${item.absent} absent`
                                      : ""}
                                    )
                                  </span>
                                )}
                              </span>
                            </div>
                            <div style={styles.biweeklyBar}>
                              <div
                                style={{
                                  display: "flex",
                                  height: "100%",
                                  borderRadius: 999,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${exp === 0 ? 0 : Math.min(100, Math.round((item.week1Sent / exp) * 100))}%`,
                                    background: "#2563eb",
                                    transition: "width 400ms ease",
                                  }}
                                />
                                <div
                                  style={{
                                    width: `${exp === 0 ? 0 : Math.min(100, Math.round((item.week2Sent / exp) * 100))}%`,
                                    background: "#16a34a",
                                    transition: "width 400ms ease",
                                  }}
                                />
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 12,
                                marginTop: 4,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10.5,
                                  color: "#2563eb",
                                  fontWeight: 600,
                                }}
                              >
                                🔵 W1: {item.week1Sent}/{item.week1Expected}
                              </span>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  color: "#16a34a",
                                  fontWeight: 600,
                                }}
                              >
                                🟢 W2: {item.week2Sent}/{item.week2Expected}
                              </span>
                              {item.missing > 0 && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    color: "#d97706",
                                    fontWeight: 600,
                                    marginLeft: "auto",
                                  }}
                                >
                                  {item.missing} missing
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            style={{
                              textAlign: "right",
                              flexShrink: 0,
                              marginLeft: 8,
                            }}
                          >
                            <div
                              style={{
                                ...styles.biweeklyCount,
                                background: bg,
                                color,
                              }}
                            >
                              {statusIcon} {item.sent}/{exp}
                            </div>
                            <div style={styles.biweeklyPct}>{pct}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Notification banner if period is complete */}
                {biweeklyData.isEndOfPeriod &&
                  biweeklyData.tutors.length > 0 && (
                    <div style={styles.biweeklyNotification}>
                      <div style={styles.biweeklyNotifTitle}>
                        🔔 Bi-Weekly Report Due — {biweeklyData.dueLabel}{" "}
                        (Tuesday)
                      </div>
                      {biweeklyData.tutors.map((t) => {
                        const met = t.expected === 0 || t.sent === t.expected;
                        return (
                          <div
                            key={`${t.name}||${t.tutorName}`}
                            style={styles.biweeklyNotifRow}
                          >
                            <strong>{t.name}</strong>
                            <span style={{ color: "#94a3b8", fontSize: 11 }}>
                              {" "}
                              (via {t.tutorName})
                            </span>{" "}
                            sent <strong>{t.sent}</strong> of {t.expected}{" "}
                            audios
                            {met
                              ? " ✅ Complete"
                              : t.sent === 0
                                ? " ❌ Sent nothing"
                                : ` ⚠️ ${t.missing} missing`}
                            {(t.cancelled > 0 || t.absent > 0) && (
                              <span style={{ color: "#94a3b8", fontSize: 11 }}>
                                {" "}
                                (
                                {t.cancelled > 0
                                  ? `${t.cancelled} cancelled`
                                  : ""}
                                {t.absent > 0
                                  ? `${t.cancelled > 0 ? ", " : ""}${t.absent} absent`
                                  : ""}
                                )
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                style={styles.btnPrimary}
                onClick={() => setShowBiweeklySummary(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === 24-Hour Overdue Modal === */}
      {showOverdueView && (
        <div
          style={{ ...styles.modalBackdrop, zIndex: 200 }}
          onClick={() => setShowOverdueView(false)}
        >
          <div
            style={{
              ...styles.modal,
              maxWidth: 760,
              maxHeight: "88vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>⏰ 24-Hour Overdue Tracker</h3>
              <button
                style={styles.modalClose}
                onClick={() => setShowOverdueView(false)}
              >
                ×
              </button>
            </div>
            <p style={styles.modalNote}>
              Sessions where the audio still hasn't been sent{" "}
              <strong>24+ hours</strong> after the session day ended. Use this
              to follow up with tutors who are behind.
            </p>

            {overdueData.count === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                <div
                  style={{ fontWeight: 800, fontSize: 14, color: "#15803d" }}
                >
                  All caught up!
                </div>
                <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
                  No sessions are overdue by more than 24 hours.
                </div>
              </div>
            ) : (
              <>
                {/* Calendar week strip showing which days have overdue sessions */}
                <div
                  style={{
                    ...styles.overdueCalendarStrip,
                    gridTemplateColumns: isMobile
                      ? "repeat(5, minmax(64px, 1fr))"
                      : styles.overdueCalendarStrip.gridTemplateColumns,
                    overflowX: isMobile ? "auto" : "visible",
                  }}
                >
                  {WEEKDAYS.map((day) => {
                    const dayDate = addDays(reportWeekMonday, day.offset);
                    const dayItems = overdueData.items.filter(
                      (i) => i.dayId === day.id,
                    );
                    const hasOverdue = dayItems.length > 0;
                    return (
                      <div
                        key={day.id}
                        style={{
                          ...styles.overdueCalDay,
                          background: hasOverdue ? "#fef2f2" : "#f8fafc",
                          border: `1.5px solid ${hasOverdue ? "#fca5a5" : "#e2e8f0"}`,
                        }}
                      >
                        <div
                          style={{
                            ...styles.overdueCalDayLabel,
                            color: hasOverdue ? "#b91c1c" : "#94a3b8",
                          }}
                        >
                          {day.short}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#94a3b8",
                            marginBottom: 4,
                          }}
                        >
                          {fmtShort(dayDate)}
                        </div>
                        {hasOverdue ? (
                          <div style={styles.overdueCalCount}>
                            {dayItems.length}
                          </div>
                        ) : (
                          <div style={{ fontSize: 16, color: "#86efac" }}>
                            ✓
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* List grouped by tutor */}
                <div style={{ marginTop: 18 }}>
                  <div style={styles.manualListTitle}>
                    Overdue Sessions ({overdueData.count})
                  </div>
                  {Object.entries(overdueData.byTutor).map(
                    ([tutorName, items]) => (
                      <div key={tutorName} style={styles.overdueTutorGroup}>
                        <div style={styles.overdueTutorHeader}>
                          <span style={styles.overdueTutorAvatar}>
                            {tutorName.charAt(0).toUpperCase()}
                          </span>
                          <span style={styles.overdueTutorName}>
                            {tutorName}
                          </span>
                          <span style={styles.overdueTutorCount}>
                            {items.length} overdue
                          </span>
                        </div>
                        {items.map((item) => (
                          <div key={item.id} style={styles.overdueRow}>
                            <span
                              style={{
                                ...styles.newDayPill,
                                background: item.dayColor,
                              }}
                            >
                              {item.dayShort}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={styles.overdueStudentName}>
                                {item.studentName}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#94a3b8" }}>
                                {item.hasExactTime
                                  ? `Session: ${item.sessionDate.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                                  : `No exact time set — using ${item.dayShort} estimate`}
                              </div>
                            </div>
                            <span style={styles.overdueTimeBadge}>
                              {item.daysLate >= 1
                                ? `${item.daysLate} day${item.daysLate !== 1 ? "s" : ""} late`
                                : `${item.hoursLate}h late`}
                            </span>
                            <button
                              style={styles.newEditBtn}
                              onClick={() => {
                                const fullEntry = reportManualEntries.find(
                                  (e) => e.id === item.id,
                                );
                                if (fullEntry)
                                  setEditingEntry({ ...fullEntry });
                              }}
                              title="Set/edit exact session time"
                            >
                              🕐
                            </button>
                            <button
                              style={styles.overdueWhatsappBtn}
                              onClick={() => {
                                const msg = `Hi ${tutorName}, just a quick check-in — the audio for ${item.studentName}'s session on ${item.dayShort} hasn't come through yet. Could you please send it when you get a chance? Thank you!`;
                                navigator.clipboard
                                  .writeText(msg)
                                  .then(() =>
                                    flash("✅ Reminder message copied!"),
                                  );
                              }}
                              title="Copy friendly WhatsApp reminder"
                            >
                              📋 Copy Reminder
                            </button>
                            <button
                              style={{
                                ...styles.overdueWhatsappBtn,
                                background: "#fef2f2",
                                color: "#b91c1c",
                                borderColor: "#fca5a5",
                              }}
                              onClick={() => {
                                const msg = `Hello ${tutorName},\n\nThe audio for ${item.studentName}'s ${item.dayShort} session is now more than 24 hours overdue. This is not acceptable.\n\nYou already know the guideline. This needs to be sent today — no further delays.\n\nIf something genuinely prevented you from recording it, reply immediately and explain. Otherwise, we expect the audio in our hands right away, and we expect this not to happen again.`;
                                navigator.clipboard
                                  .writeText(msg)
                                  .then(() =>
                                    flash(
                                      "⚠️ Leadership escalation message copied!",
                                    ),
                                  );
                              }}
                              title="Copy firm leadership escalation message"
                            >
                              ⚠️ Escalate
                            </button>
                          </div>
                        ))}
                      </div>
                    ),
                  )}
                </div>
              </>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                style={styles.btnPrimary}
                onClick={() => setShowOverdueView(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Daily Report Completeness Checker === */}
      {dailyReportCheck && (
        <div
          style={{ ...styles.modalBackdrop, zIndex: 300 }}
          onClick={() => setDailyReportCheck(null)}
        >
          <div
            style={{
              ...styles.modal,
              maxWidth: 540,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📋 Daily Report Checklist</h3>
              <button
                style={styles.modalClose}
                onClick={() => setDailyReportCheck(null)}
              >
                ×
              </button>
            </div>

            {/* Session info */}
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 12.5,
              }}
            >
              <div>
                <strong>{dailyReportCheck.tutorName}</strong> →{" "}
                <strong>{dailyReportCheck.studentName}</strong>
              </div>
              <div style={{ color: "#64748b", marginTop: 2 }}>
                {DAYS.find((d) => d.id === dailyReportCheck.dayId)?.label ||
                  dailyReportCheck.dayId}
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: "#64748b", marginBottom: 14 }}>
              Check each item that the tutor included in their written daily
              report:
            </p>

            {/* Sections */}
            {DAILY_REPORT_SECTIONS.map((section) => {
              const sectionChecked = section.items.filter(
                (item) => dailyReportCheck.checked[item.id],
              ).length;
              const sectionTotal = section.items.length;
              const allDone = sectionChecked === sectionTotal;
              return (
                <div key={section.id} style={styles.drSection}>
                  <div style={styles.drSectionHeader}>
                    <span style={{ fontSize: 14 }}>{section.icon}</span>
                    <span style={styles.drSectionTitle}>{section.title}</span>
                    <span
                      style={{
                        ...styles.drSectionBadge,
                        background: allDone ? "#dcfce7" : "#f1f5f9",
                        color: allDone ? "#15803d" : "#64748b",
                      }}
                    >
                      {sectionChecked}/{sectionTotal}
                    </span>
                  </div>
                  {section.items.map((item) => {
                    const checked = !!dailyReportCheck.checked[item.id];
                    return (
                      <label key={item.id} style={styles.drItem}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setDailyReportCheck((p) => ({
                              ...p,
                              checked: { ...p.checked, [item.id]: !checked },
                            }))
                          }
                          style={{
                            width: 16,
                            height: 16,
                            flexShrink: 0,
                            cursor: "pointer",
                          }}
                        />
                        <span
                          style={{
                            ...styles.drItemLabel,
                            color: checked ? "#15803d" : "#374151",
                            textDecoration: checked ? "none" : "none",
                          }}
                        >
                          {checked ? "✅ " : "⬜ "}
                          {item.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            })}

            {/* Overall score */}
            {(() => {
              const totalItems = DAILY_REPORT_SECTIONS.reduce(
                (s, sec) => s + sec.items.length,
                0,
              );
              const totalChecked = Object.values(
                dailyReportCheck.checked,
              ).filter(Boolean).length;
              const pct = Math.round((totalChecked / totalItems) * 100);
              const color =
                pct === 100 ? "#15803d" : pct >= 70 ? "#d97706" : "#dc2626";
              return (
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    background: "#f8fafc",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
                        color: "#0f172a",
                      }}
                    >
                      Overall Completeness
                    </span>
                    <span style={{ fontWeight: 900, fontSize: 18, color }}>
                      {pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "#e2e8f0",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: color,
                        borderRadius: 999,
                        transition: "width 300ms ease",
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color }}>
                    {pct === 100
                      ? "✅ Report is complete!"
                      : pct >= 70
                        ? `⚠️ ${totalItems - totalChecked} item${totalItems - totalChecked !== 1 ? "s" : ""} missing — report is mostly complete`
                        : `❌ ${totalItems - totalChecked} items missing — report needs improvement`}
                  </div>
                </div>
              );
            })()}

            {/* Auto-generated message to tutor */}
            {(() => {
              const missingBySec = DAILY_REPORT_SECTIONS.map((sec) => ({
                ...sec,
                missing: sec.items.filter(
                  (item) => !dailyReportCheck.checked[item.id],
                ),
              })).filter((sec) => sec.missing.length > 0);

              if (missingBySec.length === 0)
                return (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "12px 14px",
                      background: "#f0fdf4",
                      border: "1px solid #86efac",
                      borderRadius: 10,
                      fontSize: 12.5,
                      color: "#15803d",
                      fontWeight: 700,
                    }}
                  >
                    🎉 All sections are complete — great report! No message
                    needed.
                  </div>
                );

              const dayLabel =
                DAYS.find((d) => d.id === dailyReportCheck.dayId)?.label ||
                dailyReportCheck.dayId;

              const message = [
                `Hi ${dailyReportCheck.tutorName},`,
                ``,
                `Thank you for the session report on ${dayLabel}. We really appreciate your effort in documenting the sessions — it helps us support both you and the students better.`,
                ``,
                `We noticed a few things that could make the report even more complete:`,
                ``,
                ...missingBySec.map(
                  (sec) =>
                    `${sec.icon} *${sec.title}*\n${sec.missing.map((item) => `  – ${item.label}`).join("\n")}`,
                ),
                ``,
                `These details help us understand how each session went and how the student is progressing. Going forward, please try to include these in your daily reports.`,
                ``,
                `If you have any questions about what to include, feel free to ask — we're happy to help. Thank you again for your dedication! 🙏`,
              ].join("\n");

              return (
                <div style={{ marginTop: 14 }}>
                  <div style={styles.drMsgLabel}>
                    💬 Message to send to tutor
                  </div>
                  <div style={styles.drMsgBox}>{message}</div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 8,
                      flexDirection: isMobile ? "column" : "row",
                    }}
                  >
                    <button
                      style={{ ...styles.btnPrimary, flex: 1 }}
                      onClick={() => {
                        navigator.clipboard.writeText(message).then(() => {
                          flash(
                            `✅ Message copied! Paste it in WhatsApp for ${dailyReportCheck.tutorName}`,
                          );
                          setDailyReportCheck(null);
                        });
                      }}
                    >
                      📋 Copy Message &amp; Close
                    </button>
                    <button
                      style={styles.btnGhost}
                      onClick={() => setDailyReportCheck(null)}
                    >
                      Close without copying
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* If all checked, just show close */}
            {DAILY_REPORT_SECTIONS.every((sec) =>
              sec.items.every((item) => dailyReportCheck.checked[item.id]),
            ) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 12,
                }}
              >
                <button
                  style={styles.btnGhost}
                  onClick={() =>
                    setDailyReportCheck((p) => ({ ...p, checked: {} }))
                  }
                >
                  Clear All
                </button>
                <button
                  style={{ ...styles.btnPrimary, marginLeft: 8 }}
                  onClick={() => setDailyReportCheck(null)}
                >
                  Done ✅
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Daily Reminder Modal === */}
      {showDailyReminder &&
        (() => {
          const tutorMap = buildDailyReminderMessages();
          const tutorNames = Object.keys(tutorMap);
          return (
            <div
              style={{ ...styles.modalBackdrop, zIndex: 200 }}
              onClick={() => setShowDailyReminder(false)}
            >
              <div
                style={{
                  ...styles.modal,
                  maxWidth: 620,
                  maxHeight: "90vh",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={styles.modalHeader}>
                  <h3 style={styles.modalTitle}>📨 Daily Audio Reminder</h3>
                  <button
                    style={styles.modalClose}
                    onClick={() => setShowDailyReminder(false)}
                  >
                    ×
                  </button>
                </div>

                {/* Time setter */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    marginBottom: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#374151",
                      flex: 1,
                      minWidth: 160,
                    }}
                  >
                    🔔 Set browser reminder time
                  </span>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    style={{ ...styles.input, width: 110, marginBottom: 0 }}
                  />
                  <button
                    style={{
                      ...styles.btnPrimary,
                      padding: "8px 14px",
                      fontSize: 12,
                    }}
                    onClick={() => scheduleDailyBrowserReminder(reminderTime)}
                  >
                    {reminderScheduled ? "✅ Update" : "Set Reminder"}
                  </button>
                </div>

                {tutorNames.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: "#15803d",
                      }}
                    >
                      All caught up!
                    </div>
                    <div
                      style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}
                    >
                      No pending sessions for today or earlier this week.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={styles.manualListTitle}>
                      {tutorNames.length} tutor
                      {tutorNames.length !== 1 ? "s" : ""} with pending sessions
                    </div>

                    {tutorNames.map((tutorName) => {
                      const entries = tutorMap[tutorName];
                      const daysList = entries
                        .map((e) => e.day.label)
                        .join(", ");

                      const message = [
                        `Hi ${tutorName},`,
                        ``,
                        `Just a friendly reminder — we haven't received the audio for your ${daysList} session${entries.length > 1 ? "s" : ""} yet.`,
                        ``,
                        `When you have a moment, could you please send it over? If you weren't able to record it or ran into any issues, just let us know so we can update our records.`,
                        ``,
                        `Thank you! 🙏`,
                      ].join("\n");

                      return (
                        <div key={tutorName} style={styles.reminderTutorCard}>
                          <div style={styles.reminderTutorHeader}>
                            <span style={styles.reminderTutorAvatar}>
                              {tutorName.charAt(0).toUpperCase()}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={styles.reminderTutorName}>
                                {tutorName}
                              </div>
                              <div style={styles.reminderTutorSub}>
                                {entries.length} session
                                {entries.length !== 1 ? "s" : ""} pending:{" "}
                                {daysList}
                              </div>
                            </div>
                          </div>
                          <div style={styles.reminderMsgPreview}>{message}</div>
                          <button
                            style={{
                              ...styles.btnPrimary,
                              width: "100%",
                              marginTop: 8,
                              fontSize: 12,
                            }}
                            onClick={() => {
                              navigator.clipboard
                                .writeText(message)
                                .then(() =>
                                  flash(
                                    `✅ Message copied for ${tutorName}! Paste in WhatsApp.`,
                                  ),
                                );
                            }}
                          >
                            📋 Copy WhatsApp Message for {tutorName}
                          </button>
                        </div>
                      );
                    })}

                    {/* Copy all at once */}
                    {tutorNames.length > 1 && (
                      <button
                        style={{
                          ...styles.btnGhost,
                          width: "100%",
                          marginTop: 8,
                          color: "#7c3aed",
                          borderColor: "#c4b5fd",
                        }}
                        onClick={() => {
                          const allMessages = tutorNames
                            .map((tutorName) => {
                              const entries = tutorMap[tutorName];
                              const daysList = entries
                                .map((e) => e.day.label)
                                .join(", ");
                              return [
                                `Hi ${tutorName},`,
                                ``,
                                `Just a friendly reminder — we haven't received the audio for your ${daysList} session${entries.length > 1 ? "s" : ""} yet.`,
                                ``,
                                `When you have a moment, could you please send it over? If you weren't able to record it or ran into any issues, just let us know so we can update our records.`,
                                ``,
                                `Thank you! 🙏`,
                              ].join("\n");
                            })
                            .join("\n\n---\n\n");
                          navigator.clipboard
                            .writeText(allMessages)
                            .then(() =>
                              flash(
                                `✅ All ${tutorNames.length} messages copied!`,
                              ),
                            );
                        }}
                      >
                        📋 Copy All Messages at Once
                      </button>
                    )}
                  </>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 16,
                  }}
                >
                  <button
                    style={styles.btnPrimary}
                    onClick={() => setShowDailyReminder(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {toast && <div style={styles.toast}>{toast}</div>}

      {tutorModal && (
        <div style={styles.modalBackdrop} onClick={() => setTutorModal(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Tutor</h3>
              <span style={styles.modalDay}>
                {DAYS.find((d) => d.id === tutorModal.dayId)?.label}
              </span>
            </div>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Tutor name</span>
              <input
                type="text"
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitTutor()}
                placeholder="e.g. Sara Bekele"
                style={styles.input}
                autoFocus
              />
            </label>
            <div style={styles.modalActions}>
              <button
                style={styles.btnGhost}
                onClick={() => setTutorModal(null)}
              >
                Cancel
              </button>
              <button style={styles.btnPrimary} onClick={submitTutor}>
                Add tutor
              </button>
            </div>
          </div>
        </div>
      )}

      {studentModal && (
        <div style={styles.modalBackdrop} onClick={() => setStudentModal(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {studentModal.mode === "edit"
                  ? "✏️ Edit Student"
                  : "+ Add Student"}
              </h3>
              <span style={styles.modalDay}>
                Tutor: {studentModal.tutorName}
              </span>
            </div>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Student name</span>
              <input
                type="text"
                value={studentForm.name}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, name: e.target.value })
                }
                onKeyDown={(e) => e.key === "Enter" && submitStudent()}
                placeholder="e.g. Emma"
                style={styles.input}
                autoFocus
              />
            </label>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Priority</span>
              <div style={styles.priorityRow}>
                {Object.entries(PRIORITY).map(([key, pri]) => {
                  const selected = studentForm.priority === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setStudentForm({ ...studentForm, priority: key })
                      }
                      style={{
                        ...styles.priorityChoice,
                        background: selected ? pri.color : "#ffffff",
                        color: selected ? "#ffffff" : pri.color,
                        borderColor: pri.color,
                      }}
                    >
                      {pri.icon || "○"} {pri.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Focus note (optional)</span>
              <textarea
                value={studentForm.focusNote}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, focusNote: e.target.value })
                }
                placeholder="e.g. Struggling with multiplication..."
                style={styles.textarea}
              />
            </label>
            <div style={styles.modalActions}>
              <button
                style={styles.btnGhost}
                onClick={() => setStudentModal(null)}
              >
                Cancel
              </button>
              <button style={styles.btnPrimary} onClick={submitStudent}>
                {studentModal.mode === "edit" ? "Save changes" : "Add student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportTutorCard({ tutor, onSaveNote, onMarkReceived }) {
  const [expanded, setExpanded] = useState(tutor.missedSessions > 0);
  const pct =
    tutor.totalSessions === 0
      ? 0
      : Math.round((tutor.sentSessions / tutor.totalSessions) * 100);
  const hasMissed = tutor.missedSessions > 0;
  const allDone = tutor.sentSessions === tutor.totalSessions;

  return (
    <div
      style={{
        ...styles.reportTutorCard,
        borderColor: hasMissed ? "#fca5a5" : allDone ? "#86efac" : "#e2e8f0",
        background: hasMissed ? "#fffafa" : "#ffffff",
      }}
    >
      <div
        style={styles.reportTutorHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={styles.reportTutorLeft}>
          <span
            style={{
              ...styles.reportTutorAvatar,
              background: hasMissed
                ? "#dc2626"
                : allDone
                  ? "#16a34a"
                  : "#7c3aed",
            }}
          >
            {tutor.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <div style={styles.reportTutorName}>{tutor.name}</div>
            <div style={styles.reportTutorSubtext}>
              {tutor.byDay.length} day{tutor.byDay.length === 1 ? "" : "s"} this
              week
              {hasMissed && (
                <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                  {" "}
                  · ⚠️ {tutor.missedSessions} missed
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={styles.reportTutorRight}>
          <div style={styles.reportTutorStats}>
            <div style={styles.reportTutorStatsNum}>
              {tutor.sentSessions} / {tutor.totalSessions}
            </div>
            <div style={styles.reportTutorStatsLabel}>sent</div>
          </div>
          <div
            style={{
              ...styles.reportTutorPct,
              background: allDone
                ? "#dcfce7"
                : hasMissed
                  ? "#fee2e2"
                  : "#dbeafe",
              color: allDone ? "#15803d" : hasMissed ? "#b91c1c" : "#1d4ed8",
            }}
          >
            {pct}%
          </div>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={styles.reportDaysList}>
          {tutor.byDay.map((day) => {
            const sentList = day.sessions.filter((s) => s.audioSent);
            const missedList = day.sessions.filter((s) => s.isMissed);
            const upcomingList = day.sessions.filter((s) => s.isUpcoming);

            let icon, statusLabel, statusColor, bgColor;
            // Manual "received" overrides everything — turns the day green
            if (day.isReceived) {
              icon = "✅";
              statusLabel = "Received ✓";
              statusColor = "#15803d";
              bgColor = "#f0fdf4";
            } else if (day.dayStatus === "all_absent") {
              icon = "🚫";
              statusLabel = "All Absent";
              statusColor = "#9a3412";
              bgColor = "#fff7ed";
            } else if (day.dayStatus === "complete") {
              icon = "✅";
              statusLabel = "All sent";
              statusColor = "#15803d";
              bgColor = "#f0fdf4";
            } else if (day.dayStatus === "missed") {
              icon = "❌";
              statusLabel = "MISSED";
              statusColor = "#b91c1c";
              bgColor = "#fef2f2";
            } else if (day.dayStatus === "partial") {
              icon = "⚠️";
              statusLabel = "Partial";
              statusColor = "#d97706";
              bgColor = "#fffbeb";
            } else if (day.dayStatus === "today") {
              icon = "📍";
              statusLabel = "Today";
              statusColor = "#1d4ed8";
              bgColor = "#eff6ff";
            } else {
              icon = "⏳";
              statusLabel = "Upcoming";
              statusColor = "#475569";
              bgColor = "#f8fafc";
            }

            return (
              <div
                key={day.dayId}
                style={{
                  ...styles.reportDayRow,
                  background: bgColor,
                  borderLeftColor: day.dayColor,
                }}
              >
                <div style={styles.reportDayHeader}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <div style={styles.reportDayDate}>
                    <strong style={{ color: day.dayColor }}>
                      {day.dayShort}
                    </strong>{" "}
                    {fmtShort(day.date)}
                  </div>
                  <span
                    style={{
                      ...styles.reportDayStatus,
                      color: statusColor,
                      borderColor: statusColor,
                    }}
                  >
                    {statusLabel}
                  </span>
                  <span style={styles.reportDayCount}>
                    {day.dayStatus === "all_absent"
                      ? `All ${day.absentStudents.length} absent`
                      : `${sentList.length} of ${day.sessions.length} sent${day.absentStudents?.length ? ` · ${day.absentStudents.length} absent` : ""}`}
                  </span>
                  {/* Manual Mark Received button */}
                  <button
                    type="button"
                    onClick={() =>
                      onMarkReceived(tutor.name, day.dayId, !day.isReceived)
                    }
                    style={{
                      ...styles.markReceivedBtn,
                      ...(day.isReceived
                        ? styles.markReceivedBtnDone
                        : styles.markReceivedBtnPending),
                    }}
                    title={
                      day.isReceived
                        ? "Click to undo"
                        : "Mark audio as received from tutor"
                    }
                  >
                    {day.isReceived ? "✅ Received" : "📥 Mark Received"}
                  </button>
                </div>
                <div style={styles.reportStudentChips}>
                  {sentList.map((s) => (
                    <span
                      key={s.studentId}
                      style={{
                        ...styles.reportStudentChip,
                        background: "#dcfce7",
                        color: "#15803d",
                        borderColor: "#86efac",
                      }}
                    >
                      ✓ {s.studentName}
                    </span>
                  ))}
                  {missedList.map((s) => (
                    <span
                      key={s.studentId}
                      style={{
                        ...styles.reportStudentChip,
                        background: "#fee2e2",
                        color: "#b91c1c",
                        borderColor: "#fca5a5",
                      }}
                    >
                      ✗ {s.studentName}
                    </span>
                  ))}
                  {upcomingList.map((s) => (
                    <span
                      key={s.studentId}
                      style={{
                        ...styles.reportStudentChip,
                        background: "#f1f5f9",
                        color: "#475569",
                        borderColor: "#cbd5e1",
                      }}
                    >
                      ⏳ {s.studentName}
                    </span>
                  ))}
                  {(day.absentStudents || []).map((s) => (
                    <span
                      key={s.studentId}
                      style={{
                        ...styles.reportStudentChip,
                        background: "#fed7aa",
                        color: "#9a3412",
                        borderColor: "#fb923c",
                      }}
                    >
                      🚫 {s.studentName}{" "}
                      <em style={{ fontSize: 10, opacity: 0.7 }}>(absent)</em>
                    </span>
                  ))}
                </div>
                <DayNoteEditor
                  tutorName={tutor.name}
                  dayId={day.dayId}
                  initialNote={day.note}
                  onSave={onSaveNote}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inline note editor for each day row in the report.
// Shows a small "📝 Add note" button when empty, expands to textarea when clicked.
function DayNoteEditor({ tutorName, dayId, initialNote, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNote || "");

  // Keep local state in sync if note changes from outside
  useEffect(() => {
    setValue(initialNote || "");
  }, [initialNote]);

  const save = () => {
    if (value.trim() !== (initialNote || "").trim()) {
      onSave(tutorName, dayId, value);
    }
    setEditing(false);
  };
  const cancel = () => {
    setValue(initialNote || "");
    setEditing(false);
  };

  if (!editing && !initialNote) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={styles.noteAddBtn}
      >
        📝 Add note for boss…
      </button>
    );
  }

  if (!editing && initialNote) {
    return (
      <div style={styles.notePreview} onClick={() => setEditing(true)}>
        <span style={styles.noteIcon}>📝</span>
        <span style={styles.noteText}>{initialNote}</span>
        <span style={styles.noteEditHint}>click to edit</span>
      </div>
    );
  }

  return (
    <div style={styles.noteEditor}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='e.g. "Kalkidan was sick that day" or "Power outage in the area"'
        style={styles.noteTextarea}
        autoFocus
      />
      <div style={styles.noteActions}>
        <button type="button" onClick={cancel} style={styles.noteBtnGhost}>
          Cancel
        </button>
        <button type="button" onClick={save} style={styles.noteBtnPrimary}>
          💾 Save note
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 0% 0%, #dbeafe 0%, transparent 50%), radial-gradient(1000px 600px at 100% 0%, #fce7f3 0%, transparent 50%), radial-gradient(900px 500px at 50% 100%, #d1fae5 0%, transparent 55%), #f8fafc",
    padding: "12px 8px 40px",
    fontFamily:
      "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    color: "#0f172a",
  },
  container: {
    width: "100%",
    display: "grid",
    gap: 16,
    alignItems: "flex-start",
    transition: "grid-template-columns 200ms ease",
  },
  main: { minWidth: 0 },
  header: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "22px 28px",
    boxShadow: "0 10px 30px -12px rgba(15,23,42,0.12)",
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: "0.18em",
    color: "#7c3aed",
    fontWeight: 700,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    margin: "0 0 6px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  busyDot: {
    marginLeft: 12,
    fontSize: 12,
    color: "#7c3aed",
    fontWeight: 600,
    letterSpacing: 0,
  },
  titleGradient: {
    background:
      "linear-gradient(90deg, #2563eb 0%, #7c3aed 35%, #db2777 65%, #ea580c 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  },
  subtitle: { margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.6 },
  kbd: {
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    padding: "1px 5px",
    fontFamily: "ui-monospace, monospace",
    fontSize: 11,
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    flexWrap: "wrap",
  },
  navBtn: {
    padding: "7px 13px",
    borderRadius: 9,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "inherit",
  },
  navBtnActive: {
    borderColor: "#2563eb",
    color: "#2563eb",
    background: "#eff6ff",
  },
  navBtnAlt: {
    padding: "7px 13px",
    borderRadius: 9,
    border: "1px solid #fcd34d",
    background: "#fffbeb",
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "inherit",
    color: "#78350f",
  },
  navBtnDanger: {
    padding: "7px 13px",
    borderRadius: 9,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "inherit",
    color: "#b91c1c",
  },
  weekLabel: {
    marginLeft: "auto",
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
  },

  errorBar: {
    marginTop: 12,
    padding: "10px 14px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 10,
    color: "#b91c1c",
    fontSize: 13,
  },

  // === Progress Tracker ===
  progressBox: {
    marginTop: 16,
    padding: "16px 20px",
    background:
      "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #ecfdf5 100%)",
    border: "1px solid #c7d2fe",
    borderRadius: 14,
    boxShadow: "0 6px 20px -14px rgba(99,102,241,0.25)",
  },
  progressHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  progressIcon: { fontSize: 24 },
  progressTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  progressSubtitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#475569",
    marginTop: 2,
  },
  progressPct: {
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  progressBarTrack: {
    height: 14,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
    boxShadow: "inset 0 1px 2px rgba(15,23,42,0.1)",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 400ms ease",
  },
  progressLegend: {
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 12,
    fontSize: 12.5,
    color: "#475569",
  },
  progressLegendItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  progressLegendDot: { width: 10, height: 10, borderRadius: 999 },

  // === Search bar ===
  searchBar: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "8px 14px",
    boxShadow: "0 2px 8px -4px rgba(15,23,42,0.08)",
  },
  searchIcon: { fontSize: 16, opacity: 0.6 },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 13.5,
    fontFamily: "inherit",
    color: "#0f172a",
    padding: "4px 0",
  },
  searchCount: {
    fontSize: 12,
    fontWeight: 700,
    color: "#7c3aed",
    background: "#f5f3ff",
    padding: "4px 10px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },
  searchClear: {
    background: "#fee2e2",
    border: "none",
    color: "#dc2626",
    cursor: "pointer",
    width: 22,
    height: 22,
    borderRadius: 999,
    fontSize: 14,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  // === Per-day mini progress bar ===
  dayProgress: {
    padding: "6px 10px",
    background: "rgba(255,255,255,0.7)",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
  },
  dayProgressLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 4,
  },
  dayProgressTrack: {
    height: 4,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  dayProgressFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 300ms ease",
  },

  summary: {
    marginTop: 14,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  summaryItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12.5,
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: 999,
  },
  summaryDot: { width: 7, height: 7, borderRadius: 999 },
  summaryTotal: {
    marginLeft: "auto",
    fontSize: 12.5,
    fontWeight: 700,
    color: "#0f172a",
  },

  clipboardBar: {
    marginTop: 14,
    background: "#fffbeb",
    border: "1px solid #fcd34d",
    borderRadius: 10,
    padding: "8px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12.5,
    color: "#78350f",
  },
  clipboardIcon: { fontSize: 16 },
  clipboardText: { flex: 1 },
  clipboardClear: {
    background: "transparent",
    border: "1px solid #fcd34d",
    padding: "3px 10px",
    borderRadius: 6,
    color: "#78350f",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "inherit",
  },

  loading: {
    background: "#ffffff",
    padding: "40px 20px",
    textAlign: "center",
    color: "#64748b",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontWeight: 600,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
  },
  gridWeekend: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    maxWidth: "60%",
  },
  weekendHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
    marginBottom: 10,
    paddingLeft: 4,
  },
  weekendLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "0.04em",
  },
  weekendSub: { fontSize: 12, color: "#64748b", fontWeight: 600 },
  dayColumn: {
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 14,
    padding: 0,
    minHeight: 380,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
    transition: "box-shadow 150ms ease",
  },
  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    color: "#ffffff",
    gap: 6,
  },
  dayHeaderRight: { display: "flex", alignItems: "center", gap: 5 },
  dayName: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  dayDate: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 1 },
  dayCount: {
    fontSize: 10.5,
    fontWeight: 700,
    background: "rgba(255,255,255,0.25)",
    color: "#ffffff",
    padding: "3px 8px",
    borderRadius: 999,
    flexShrink: 0,
  },
  pasteBtn: {
    fontSize: 10,
    fontWeight: 700,
    background: "rgba(255,255,255,0.95)",
    color: "#78350f",
    padding: "3px 7px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  },

  tutorsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flex: 1,
    padding: 10,
  },
  tutorCard: {
    background: "#ffffff",
    border: "1px solid",
    borderRadius: 9,
    padding: 8,
    transition: "box-shadow 140ms ease, border-color 140ms ease",
  },
  tutorHead: { display: "flex", alignItems: "center", gap: 4, marginBottom: 6 },
  dragHandle: {
    color: "#cbd5e1",
    fontSize: 12,
    cursor: "grab",
    flexShrink: 0,
    userSelect: "none",
  },
  tutorNameWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
    flex: 1,
    minWidth: 0,
  },
  tutorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tutorName: {
    fontSize: 11.5,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
    cursor: "text",
    padding: "1px 3px",
    borderRadius: 3,
  },
  renameInput: {
    fontSize: 11.5,
    fontWeight: 700,
    padding: "2px 4px",
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    outline: "none",
    fontFamily: "inherit",
    background: "#ffffff",
    width: "100%",
    minWidth: 0,
  },
  renameInputSmall: {
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 4px",
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    outline: "none",
    fontFamily: "inherit",
    background: "#ffffff",
    flex: 1,
    minWidth: 0,
  },
  tutorActions: { display: "flex", gap: 1, flexShrink: 0 },
  iconBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 10,
    lineHeight: 1,
    padding: "2px 3px",
    fontFamily: "inherit",
    opacity: 0.7,
  },
  iconBtnTiny: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 10,
    lineHeight: 1,
    padding: "0 2px",
    fontFamily: "inherit",
    opacity: 0.6,
  },
  tutorRemove: {
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    padding: "0 4px",
    fontFamily: "inherit",
    flexShrink: 0,
  },

  studentList: { display: "flex", flexDirection: "column", gap: 4 },
  studentRow: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    padding: "5px 5px 5px 6px",
    border: "1px solid",
    borderRadius: 7,
    fontFamily: "inherit",
    textAlign: "left",
    transition: "all 140ms ease",
    minWidth: 0,
  },
  priorityIcon: { fontSize: 11, lineHeight: 1, flexShrink: 0 },
  tempBadge: { fontSize: 11, lineHeight: 1, flexShrink: 0 },
  studentName: {
    flex: 1,
    fontSize: 11,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
    cursor: "text",
    padding: "1px 3px",
    borderRadius: 3,
  },
  statusPill: {
    fontSize: 9,
    fontWeight: 700,
    padding: "1px 6px",
    borderRadius: 999,
    color: "#ffffff",
    letterSpacing: "0.02em",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  stoppedBadge: {
    fontSize: 9,
    fontWeight: 700,
    padding: "1px 6px",
    borderRadius: 999,
    background: "#64748b",
    color: "#ffffff",
    whiteSpace: "nowrap",
    flexShrink: 0,
    letterSpacing: "0.02em",
  },
  stoppingBadge: {
    fontSize: 9,
    fontWeight: 800,
    padding: "1px 6px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    whiteSpace: "nowrap",
    flexShrink: 0,
    letterSpacing: "0.05em",
  },
  studentCopy: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 10,
    lineHeight: 1,
    padding: "0 2px",
    fontFamily: "inherit",
    opacity: 0.6,
  },
  studentRemove: {
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: "0 3px",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  emptyHint: {
    fontSize: 10.5,
    color: "#94a3b8",
    fontStyle: "italic",
    padding: "5px 3px",
  },

  studentAddRow: { display: "flex", gap: 4, marginTop: 2 },
  addStudent: {
    border: "1px dashed",
    background: "transparent",
    fontSize: 10.5,
    fontWeight: 600,
    padding: "4px",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    opacity: 0.85,
    flex: 1,
  },
  addTutor: {
    border: "1px dashed",
    background: "#ffffff",
    fontSize: 11,
    fontWeight: 700,
    padding: "8px",
    borderRadius: 9,
    cursor: "pointer",
    fontFamily: "inherit",
  },

  // Mobile day picker
  mobileDayPicker: {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    padding: "8px 4px 12px",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  mobileDayBtn: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: 10,
    border: "2px solid",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "center",
    minWidth: 54,
    transition: "all 150ms ease",
  },

  legendBox: {
    marginTop: 16,
    padding: "12px 18px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 12.5,
    color: "#475569",
    lineHeight: 1.55,
    boxShadow: "0 6px 20px -14px rgba(15,23,42,0.08)",
  },
  legendList: { margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.7 },

  sidebar: {
    position: "sticky",
    top: 24,
    alignSelf: "flex-start",
    maxHeight: "calc(100vh - 48px)",
    overflow: "hidden",
    minWidth: 0,
  },
  sidebarInner: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    boxShadow: "0 10px 30px -12px rgba(15,23,42,0.15)",
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 48px)",
    overflow: "hidden",
  },
  reviewHeader: {
    padding: "16px 20px",
    borderBottom: "2px solid #ede9fe",
    background: "linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%)",
    flexShrink: 0,
  },
  reviewTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewBadge: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    color: "#ffffff",
    background: "#7c3aed",
    padding: "3px 10px",
    borderRadius: 999,
  },
  closeReview: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    width: 28,
    height: 28,
    borderRadius: 999,
    fontFamily: "inherit",
  },
  reviewStudent: {
    margin: "6px 0 4px",
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.01em",
  },
  reviewMeta: { fontSize: 12.5, color: "#475569" },
  checklistWrap: { flex: 1, overflowY: "auto" },

  toast: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 18px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    boxShadow: "0 10px 30px -10px rgba(15,23,42,0.5)",
    zIndex: 100,
  },

  ctxMenu: {
    position: "fixed",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    boxShadow: "0 12px 30px -10px rgba(15,23,42,0.35)",
    padding: 4,
    minWidth: 220,
    maxHeight: 520,
    overflowY: "auto",
    zIndex: 200,
    fontSize: 12.5,
  },
  ctxHeader: {
    padding: "8px 12px 6px",
    fontWeight: 700,
    color: "#0f172a",
    borderBottom: "1px solid #f1f5f9",
    marginBottom: 4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 13,
  },
  ctxSubLabel: {
    padding: "6px 12px 2px",
    fontSize: 10,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  ctxItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "7px 12px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 12.5,
    fontFamily: "inherit",
    color: "#0f172a",
    borderRadius: 6,
  },
  ctxDivider: { height: 1, background: "#f1f5f9", margin: "4px 0" },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px 8px",
    zIndex: 50,
  },
  modal: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "20px 16px",
    width: "100%",
    maxWidth: 460,
    boxShadow: "0 20px 50px -20px rgba(15,23,42,0.4)",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: { margin: 0, fontSize: 18, fontWeight: 700 },
  modalDay: {
    fontSize: 12.5,
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 700,
    background: "#eff6ff",
    color: "#1e40af",
  },
  modalNote: { margin: "0 0 14px", fontSize: 12.5, color: "#64748b" },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    color: "#0f172a",
    background: "#ffffff",
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 13.5,
    outline: "none",
    fontFamily: "inherit",
    color: "#0f172a",
    background: "#ffffff",
    minHeight: 80,
    resize: "vertical",
    lineHeight: 1.5,
  },
  priorityRow: { display: "flex", gap: 8 },
  priorityChoice: {
    flex: 1,
    padding: "10px 8px",
    borderRadius: 10,
    border: "2px solid",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 140ms ease",
  },
  endDateRow: { display: "flex", gap: 8, alignItems: "center" },
  endDateClear: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#b91c1c",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  endDateHint: {
    fontSize: 11.5,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 1.5,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  btnGhost: {
    padding: "9px 16px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  btnPrimary: {
    padding: "9px 16px",
    borderRadius: 10,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
  },

  // === Report button in toolbar ===
  navBtnReport: {
    position: "relative",
    padding: "7px 13px",
    borderRadius: 9,
    border: "1px solid #c4b5fd",
    background: "#f5f3ff",
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 700,
    fontFamily: "inherit",
    color: "#6d28d9",
  },
  navBtnReportAlert: {
    borderColor: "#fca5a5",
    background: "#fef2f2",
    color: "#b91c1c",
    animation: "pulse 2s infinite",
  },
  navBtnBadge: {
    marginLeft: 6,
    padding: "1px 7px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: 800,
  },

  // === Report Modal ===
  reportModal: {
    background: "#ffffff",
    borderRadius: 18,
    width: "100%",
    maxWidth: 1200,
    maxHeight: "90vh",
    boxShadow: "0 20px 60px -20px rgba(15,23,42,0.5)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  reportHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #e2e8f0",
    background: "linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  reportWeekNav: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "6px 10px",
  },
  reportNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    fontSize: 20,
    fontFamily: "inherit",
    color: "#374151",
    lineHeight: 1,
  },
  reportWeekLabel: { textAlign: "center", minWidth: 160 },
  reportWeekRange: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  reportWeekCurrent: {
    fontSize: 10,
    fontWeight: 700,
    color: "#16a34a",
    background: "#dcfce7",
    borderRadius: 999,
    padding: "1px 7px",
    display: "inline-block",
    marginTop: 2,
  },
  reportNavToday: {
    padding: "4px 10px",
    borderRadius: 7,
    border: "1px solid #c4b5fd",
    background: "#f5f3ff",
    color: "#7c3aed",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: "inherit",
  },
  reportEyebrow: {
    fontSize: 10,
    fontWeight: 800,
    color: "#7c3aed",
    letterSpacing: "0.14em",
  },

  parentMsgBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 10,
    background: "#f0fdf4",
    border: "1px solid #86efac",
    flex: "0 0 auto",
    maxWidth: 380,
  },
  parentMsgTitle: { fontSize: 13, fontWeight: 800, color: "#15803d" },
  parentMsgSub: { fontSize: 11.5, color: "#166534", marginTop: 2 },
  parentMsgBtn: {
    padding: "7px 14px",
    borderRadius: 8,
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  reportTitle: {
    margin: "4px 0 4px",
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.01em",
  },
  reportSubtitle: { fontSize: 13, color: "#64748b", fontWeight: 600 },
  reportClose: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    width: 32,
    height: 32,
    borderRadius: 999,
    fontFamily: "inherit",
    flexShrink: 0,
  },
  reportBody: {
    padding: "20px 32px",
    overflowY: "auto",
    flex: 1,
    width: "100%",
    boxSizing: "border-box",
  },
  reportFooter: {
    padding: "12px 24px",
    borderTop: "1px solid #e2e8f0",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  reportFooterNote: {
    fontSize: 11.5,
    color: "#64748b",
    fontStyle: "italic",
    marginRight: "auto",
    flexShrink: 1,
    minWidth: 0,
  },

  // 2-week summary styles
  biweeklyHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  biweeklyPeriod: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  biweeklyEndBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fcd34d",
  },
  biweeklyWeekLabels: { display: "flex", gap: 16, marginBottom: 12 },
  biweeklyWeekLabel: { fontSize: 11.5, color: "#64748b", fontWeight: 600 },
  biweeklyList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 14,
  },
  biweeklyRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
  },
  biweeklyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  biweeklyTutorName: {
    fontSize: 13.5,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  biweeklyBar: {
    height: 6,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 4,
  },
  biweeklyBarFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 400ms ease",
  },
  biweeklyWeekBreak: { fontSize: 11, color: "#64748b" },
  biweeklyCount: {
    fontSize: 13,
    fontWeight: 800,
    padding: "3px 10px",
    borderRadius: 999,
    textAlign: "center",
  },
  biweeklyPct: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    marginTop: 2,
  },
  biweeklyNotification: {
    marginTop: 14,
    padding: "14px 16px",
    background: "#fffbeb",
    border: "1px solid #fcd34d",
    borderRadius: 10,
  },
  biweeklyNotifTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#78350f",
    marginBottom: 8,
  },
  biweeklyNotifRow: {
    fontSize: 12.5,
    color: "#451a03",
    padding: "4px 0",
    borderBottom: "1px solid #fef3c7",
  },

  // 24hr Overdue tracker styles
  overdueBadgeBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    background: "#dc2626",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    marginLeft: 6,
    padding: "0 5px",
  },
  overdueCalendarStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
    marginBottom: 6,
  },
  overdueCalDay: {
    borderRadius: 10,
    padding: "10px 6px",
    textAlign: "center",
  },
  overdueCalDayLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.04em",
  },
  overdueCalCount: { fontSize: 18, fontWeight: 900, color: "#dc2626" },
  overdueTutorGroup: {
    marginBottom: 12,
    border: "1px solid #fee2e2",
    borderRadius: 10,
    overflow: "hidden",
  },
  overdueTutorHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#fef2f2",
    borderBottom: "1px solid #fee2e2",
  },
  overdueTutorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#dc2626",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  overdueTutorName: {
    fontWeight: 800,
    fontSize: 13,
    color: "#0f172a",
    flex: 1,
  },
  overdueTutorCount: { fontSize: 11, fontWeight: 700, color: "#dc2626" },
  overdueRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "9px 14px",
    borderBottom: "1px solid #fef2f2",
    background: "#fffbfb",
  },
  overdueStudentName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    flex: 1,
  },
  overdueTimeBadge: {
    fontSize: 11,
    fontWeight: 800,
    padding: "3px 10px",
    borderRadius: 999,
    background: "#fee2e2",
    color: "#b91c1c",
    flexShrink: 0,
  },
  overdueWhatsappBtn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #86efac",
    background: "#f0fdf4",
    color: "#15803d",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: "inherit",
    flexShrink: 0,
  },

  reportEmpty: { padding: "40px 20px", textAlign: "center" },
  reportEmptyIcon: { fontSize: 48, marginBottom: 12 },
  reportEmptyTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  reportEmptySub: { fontSize: 13, color: "#64748b" },

  reportSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginBottom: 16,
  },
  materialAlertBanner: {
    background: "#fffbeb",
    border: "1px solid #fcd34d",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12.5,
    color: "#92400e",
    marginBottom: 16,
  },

  // Daily report checklist styles
  drSection: {
    marginBottom: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  drSectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },
  drSectionTitle: { fontWeight: 800, fontSize: 13, color: "#0f172a", flex: 1 },
  drSectionBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
  },
  drItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "9px 14px",
    borderBottom: "1px solid #f8fafc",
    cursor: "pointer",
    background: "#ffffff",
  },
  drItemLabel: { fontSize: 12.5, lineHeight: 1.5, flex: 1 },
  drMsgLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: "#374151",
    marginBottom: 6,
    letterSpacing: "0.02em",
  },
  drMsgBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "14px 16px",
    fontSize: 12.5,
    color: "#374151",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    maxHeight: 240,
    overflowY: "auto",
    fontFamily: "inherit",
  },

  // Daily reminder modal styles
  reminderTutorCard: {
    marginBottom: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    padding: "14px",
  },
  reminderTutorHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  reminderTutorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "#d97706",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reminderTutorName: { fontWeight: 800, fontSize: 14, color: "#0f172a" },
  reminderTutorSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  reminderMsgPreview: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 12.5,
    color: "#374151",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
  },
  reportCard: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid",
    textAlign: "left",
  },
  reportCardLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#475569",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  reportCardValue: {
    fontSize: 26,
    fontWeight: 800,
    marginTop: 2,
    lineHeight: 1,
    letterSpacing: "-0.02em",
  },
  reportCardSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 3,
    fontWeight: 500,
  },

  reportAlert: {
    padding: "10px 14px",
    marginBottom: 14,
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 10,
    color: "#7f1d1d",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  // Per-tutor audio count table
  audioCountTable: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 16,
    width: "100%",
    boxSizing: "border-box",
  },
  audioCountTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 12,
  },
  audioTable: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  audioTh: {
    padding: "8px 12px",
    background: "#f1f5f9",
    color: "#475569",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    textAlign: "center",
    borderBottom: "2px solid #e2e8f0",
  },
  audioTd: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    textAlign: "center",
    verticalAlign: "middle",
    color: "#0f172a",
    fontSize: 13,
  },
  audioTr: { transition: "background 150ms ease" },
  audioBar: {
    height: 4,
    background: "#e2e8f0",
    borderRadius: 999,
    marginTop: 5,
    overflow: "hidden",
  },
  audioBarFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 400ms ease",
  },
  expEditBtn: {
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 13,
    fontFamily: "inherit",
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 2,
  },

  // Group styles
  manualTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  manageGroupsBtn: {
    padding: "5px 12px",
    borderRadius: 8,
    border: "1px solid #c4b5fd",
    background: "#f5f3ff",
    color: "#7c3aed",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
  },
  groupBlock: { marginBottom: 16 },
  groupBlockHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#f1f5f9",
    borderRadius: "8px 8px 0 0",
    borderBottom: "2px solid #e2e8f0",
  },
  groupBlockIcon: { fontSize: 16 },
  groupBlockName: { fontWeight: 800, fontSize: 13, color: "#0f172a", flex: 1 },
  groupBlockCount: { fontSize: 11, color: "#64748b", fontWeight: 600 },
  groupManagerRow: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "12px 14px",
  },
  groupManagerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  groupManagerName: { fontWeight: 700, fontSize: 13.5, color: "#0f172a" },
  groupDeleteBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    color: "#94a3b8",
    padding: "2px 4px",
  },
  groupMemberList: { display: "flex", flexWrap: "wrap", gap: 6 },
  groupMemberChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 999,
    background: "#ede9fe",
    color: "#6d28d9",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #c4b5fd",
  },
  groupMemberRemove: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9333ea",
    fontSize: 14,
    padding: 0,
    lineHeight: 1,
  },

  reportTutorList: { display: "flex", flexDirection: "column", gap: 10 },
  reportTutorCard: {
    border: "2px solid",
    borderRadius: 12,
    overflow: "hidden",
  },
  reportTutorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    cursor: "pointer",
    gap: 10,
  },
  reportTutorLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  reportTutorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reportTutorName: {
    fontSize: 14.5,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.01em",
  },
  reportTutorSubtext: { fontSize: 11.5, color: "#64748b", marginTop: 1 },
  reportTutorRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  reportTutorStats: { textAlign: "right" },
  reportTutorStatsNum: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1,
  },
  reportTutorStatsLabel: {
    fontSize: 9.5,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginTop: 2,
  },
  reportTutorPct: {
    padding: "5px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    minWidth: 44,
    textAlign: "center",
  },

  reportDaysList: {
    borderTop: "1px solid #e2e8f0",
    background: "#fafafa",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  reportDayRow: {
    borderRadius: 8,
    padding: "8px 12px",
    borderLeft: "3px solid",
    boxShadow: "0 1px 4px -2px rgba(15,23,42,0.06)",
  },
  reportDayHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  reportDayDate: { fontSize: 12.5, fontWeight: 600, color: "#0f172a" },
  reportDayStatus: {
    fontSize: 9.5,
    fontWeight: 800,
    padding: "2px 7px",
    borderRadius: 999,
    border: "1px solid",
    background: "#ffffff",
    letterSpacing: "0.04em",
  },
  reportDayCount: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
  },
  reportStudentChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 6,
    paddingLeft: 26,
  },
  reportStudentChip: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 9px",
    borderRadius: 999,
    border: "1px solid",
    whiteSpace: "nowrap",
  },

  // Manual entry section
  manualSection: {
    marginTop: 16,
    padding: "16px 18px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  },
  manualTitle: {
    fontSize: 13.5,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 4,
  },
  manualNote: { fontSize: 12, color: "#64748b", margin: "0 0 12px" },
  manualForm: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  manualInput: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#0f172a",
    outline: "none",
    flex: 1,
    minWidth: 120,
  },
  manualSelect: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 12.5,
    fontFamily: "inherit",
    color: "#0f172a",
    background: "#ffffff",
    cursor: "pointer",
  },
  manualAddBtn: {
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    background: "#7c3aed",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  manualList: { marginTop: 14 },
  // Report redesign styles
  reportTwoCol: {
    display: "grid",
    gridTemplateColumns: "340px minmax(0,1fr)",
    gap: 20,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  reportFormPanel: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "16px",
    position: "sticky",
    top: 0,
    boxShadow: "0 4px 14px -8px rgba(15,23,42,0.1)",
    transition: "box-shadow 300ms ease, border-color 300ms ease",
  },
  reportFormPanelHighlight: {
    border: "1px solid #2563eb",
    boxShadow:
      "0 0 0 4px rgba(37,99,235,0.18), 0 4px 14px -8px rgba(15,23,42,0.1)",
  },
  reportFormHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottom: "1px solid #f1f5f9",
  },
  reportFormIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
  },
  reportFormTitle: { fontSize: 13, fontWeight: 800, color: "#0f172a" },
  reportFormSub: { fontSize: 11, color: "#64748b" },
  reportFormField: { marginBottom: 10 },
  studentMatchHint: {
    marginTop: 6,
    fontSize: 10.5,
    color: "#7c3aed",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
  },
  studentMatchChip: {
    background: "#f5f3ff",
    border: "1px solid #ddd6fe",
    color: "#6d28d9",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 10.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  reportFormLabel: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10,
    fontWeight: 800,
    color: "#475569",
    letterSpacing: "0.1em",
    marginBottom: 5,
  },
  reportFormLabelDot: { width: 7, height: 7, borderRadius: 999, flexShrink: 0 },
  reportFormInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 11px",
    borderRadius: 9,
    border: "1.5px solid #e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#0f172a",
    outline: "none",
    background: "#fafafa",
  },
  reportAddBtn: {
    width: "100%",
    padding: "10px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    marginTop: 4,
    boxShadow: "0 4px 12px -4px rgba(124,58,237,0.4)",
  },
  reportEntriesPanel: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    overflow: "auto",
    minHeight: 200,
  },
  reportEntriesEmpty: { padding: "40px 20px", textAlign: "center" },
  reportEntriesHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
  },
  reportEntriesTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    flex: 1,
  },
  reportEntriesBadge: {
    fontSize: 11,
    fontWeight: 800,
    padding: "2px 9px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#2563eb",
    border: "1px solid #bfdbfe",
  },

  // View mode toggle (List / Calendar Grid)
  viewModeToggle: {
    display: "flex",
    gap: 2,
    background: "#f1f5f9",
    borderRadius: 8,
    padding: 2,
  },
  viewModeBtn: {
    padding: "5px 10px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  viewModeBtnActive: {
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
  },

  // Calendar Grid view (tutor x day timetable)
  gridViewWrap: { overflowX: "auto", padding: "12px" },
  gridTable: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "6px",
    minWidth: 760,
  },
  gridTableTutorHeaderCell: {
    textAlign: "left",
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "6px 10px",
    minWidth: 130,
  },
  gridTableDayHeaderCell: {
    textAlign: "center",
    fontSize: 12.5,
    fontWeight: 800,
    color: "#ffffff",
    padding: "8px 6px",
    borderRadius: 8,
    minWidth: 110,
  },
  gridTableTutorCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px",
    background: "#ffffff",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  gridTutorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 999,
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  gridTableCell: {
    background: "#f8fafc",
    borderRadius: 8,
    padding: 6,
    verticalAlign: "top",
    minWidth: 110,
  },
  gridSessionChip: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: 7,
    border: "1px solid",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  gridEmptyCellBtn: {
    width: "100%",
    padding: "14px 0",
    borderRadius: 7,
    border: "1.5px dashed #e2e8f0",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  gridAddMoreBtn: {
    width: "100%",
    padding: "4px 0",
    borderRadius: 6,
    border: "1px dashed #cbd5e1",
    background: "transparent",
    color: "#94a3b8",
    fontSize: 10.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  gridClipboardBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 9,
    fontSize: 12,
    color: "#1d4ed8",
    marginBottom: 10,
    fontWeight: 600,
  },
  gridChipCopyBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    padding: "1px 3px",
    borderRadius: 4,
    flexShrink: 0,
    opacity: 0.6,
  },
  gridChipDeleteBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "#dc2626",
    padding: "0px 3px",
    borderRadius: 4,
    flexShrink: 0,
    opacity: 0.6,
    fontWeight: 800,
    lineHeight: 1,
  },
  gridHint: {
    fontSize: 11,
    color: "#94a3b8",
    padding: "10px 4px 2px",
    textAlign: "center",
  },

  makeupMenu: {
    position: "fixed",
    zIndex: 999,
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 32px -8px rgba(15,23,42,0.25)",
    padding: 12,
    width: 210,
  },
  makeupMenuHeader: {
    fontSize: 12.5,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: "1px solid #f1f5f9",
  },
  makeupMenuLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 6,
  },
  makeupMenuDays: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 5,
  },
  makeupMenuDayBtn: {
    padding: "6px 0",
    borderRadius: 7,
    border: "1.5px solid",
    background: "#fff",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
    fontFamily: "inherit",
  },
  makeupMenuNote: {
    fontSize: 11.5,
    color: "#15803d",
    background: "#dcfce7",
    borderRadius: 8,
    padding: "8px 10px",
    marginBottom: 8,
  },
  makeupMenuUndo: {
    width: "100%",
    padding: "8px 0",
    borderRadius: 8,
    border: "1px solid #fca5a5",
    background: "#fef2f2",
    color: "#b91c1c",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: "inherit",
  },

  // Tutor card (blue identity)
  newTutorCard: {
    marginBottom: 1,
    overflow: "hidden",
    borderBottom: "2px solid #e2e8f0",
  },
  newTutorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    gap: 10,
  },
  newTutorBannerLeft: { display: "flex", alignItems: "center", gap: 10 },
  newTutorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "rgba(255,255,255,0.25)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "2px solid rgba(255,255,255,0.4)",
  },
  newTutorName: { fontSize: 14, fontWeight: 800, color: "#ffffff" },
  newTutorRole: {
    fontSize: 10.5,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  newTutorStats: { display: "flex", alignItems: "baseline", gap: 3 },
  newTutorStatNum: {
    fontSize: 22,
    fontWeight: 900,
    color: "#ffffff",
    lineHeight: 1,
  },
  newTutorStatLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)" },

  // Student card (purple/teal identity)
  newStudentList: {
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "#f8fafc",
  },
  newStudentCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 2px 6px -3px rgba(15,23,42,0.06)",
    minWidth: 0,
  },
  newStudentHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderBottom: "1px solid #f1f5f9",
    background: "#fafafa",
  },
  newStudentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  newStudentName: {
    fontSize: 12.5,
    fontWeight: 800,
    color: "#0f172a",
    marginRight: 6,
  },
  newStudentRole: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: 600,
    background: "#f1f5f9",
    padding: "1px 6px",
    borderRadius: 999,
  },
  newStudentSent: { fontSize: 12, fontWeight: 800, marginLeft: "auto" },

  // Session row inside student card
  newSessionRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderBottom: "1px solid #f8fafc",
    flexWrap: "nowrap",
    overflow: "hidden",
  },
  newDayPill: {
    fontSize: 11,
    fontWeight: 800,
    padding: "3px 10px",
    borderRadius: 999,
    color: "#ffffff",
    letterSpacing: "0.04em",
    flexShrink: 0,
  },
  newStatusPill: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    letterSpacing: "0.02em",
    flexShrink: 0,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  newFilenameInput: {
    flex: 1,
    minWidth: 0,
    padding: "5px 8px",
    borderRadius: 6,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    fontSize: 11,
    fontFamily: "inherit",
    color: "#475569",
    outline: "none",
  },
  materialToggle: {
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flexShrink: 0,
    transition: "all 150ms ease",
  },
  newStatusSelect: {
    padding: "5px 8px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontFamily: "inherit",
    color: "#0f172a",
    background: "#fff",
    cursor: "pointer",
    flexShrink: 0,
  },
  newEditBtn: {
    background: "#eff6ff",
    border: "none",
    cursor: "pointer",
    width: 22,
    height: 22,
    borderRadius: 6,
    fontSize: 11,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  newDeleteBtn: {
    background: "#fee2e2",
    border: "none",
    color: "#dc2626",
    cursor: "pointer",
    width: 22,
    height: 22,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  manualListTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  tutorEntryGroup: {
    marginBottom: 10,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  tutorEntryGroupHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#f1f5f9",
    borderBottom: "1px solid #e2e8f0",
  },
  tutorEntryGroupAvatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#7c3aed",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tutorEntryGroupName: {
    fontWeight: 800,
    fontSize: 13,
    color: "#0f172a",
    flex: 1,
  },
  tutorEntryGroupCount: { fontSize: 11, fontWeight: 700, color: "#64748b" },

  studentEntryGroup: {
    borderTop: "1px solid #f1f5f9",
  },
  studentEntryGroupHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px 6px 28px",
    background: "#fafafa",
    borderBottom: "1px solid #f1f5f9",
  },
  studentEntryGroupIcon: { fontSize: 12 },
  studentEntryGroupName: {
    fontWeight: 700,
    fontSize: 12,
    color: "#374151",
    flex: 1,
  },
  studentEntryGroupCount: { fontSize: 10.5, color: "#94a3b8", fontWeight: 600 },
  manualEntry: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    padding: "8px 12px 8px 28px",
    background: "#ffffff",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 12.5,
  },
  manualEntryStatus: {
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 999,
    color: "#ffffff",
  },
  manualEntryDay: { fontWeight: 700, color: "#7c3aed", fontSize: 12 },
  manualEntryTutor: { fontWeight: 700, color: "#0f172a" },
  manualEntryArrow: { color: "#94a3b8" },
  manualEntryStudent: { color: "#374151" },
  manualFilenameInput: {
    flex: 1,
    minWidth: 140,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px dashed #c4b5fd",
    background: "#faf5ff",
    fontSize: 11.5,
    fontFamily: "inherit",
    color: "#5b21b6",
    outline: "none",
  },
  manualEntrySelect: {
    marginLeft: "auto",
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 11.5,
    fontFamily: "inherit",
    color: "#0f172a",
    background: "#f8fafc",
    cursor: "pointer",
  },
  manualEntryDelete: {
    background: "#fee2e2",
    border: "none",
    color: "#dc2626",
    cursor: "pointer",
    width: 22,
    height: 22,
    borderRadius: 999,
    fontSize: 14,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  manualEntryEdit: {
    background: "#eff6ff",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    width: 22,
    height: 22,
    borderRadius: 999,
    fontSize: 12,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  // Mark Received button
  markReceivedBtn: {
    padding: "4px 10px",
    borderRadius: 7,
    border: "1.5px solid",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  markReceivedBtnPending: {
    background: "#ffffff",
    color: "#7c3aed",
    borderColor: "#c4b5fd",
  },
  markReceivedBtnDone: {
    background: "#dcfce7",
    color: "#15803d",
    borderColor: "#86efac",
  },

  // === Day note editor ===
  noteAddBtn: {
    marginTop: 8,
    marginLeft: 26,
    background: "transparent",
    border: "1px dashed #cbd5e1",
    padding: "4px 10px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  notePreview: {
    marginTop: 8,
    marginLeft: 26,
    background: "#fffbeb",
    border: "1px solid #fcd34d",
    padding: "7px 12px",
    borderRadius: 8,
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    cursor: "pointer",
    fontSize: 12,
    color: "#78350f",
    lineHeight: 1.5,
  },
  noteIcon: { fontSize: 14, flexShrink: 0 },
  noteText: {
    flex: 1,
    fontWeight: 600,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  noteEditHint: {
    fontSize: 10,
    fontStyle: "italic",
    opacity: 0.6,
    flexShrink: 0,
  },
  noteEditor: {
    marginTop: 8,
    marginLeft: 26,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    padding: 8,
    borderRadius: 8,
  },
  noteTextarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 12.5,
    fontFamily: "inherit",
    color: "#0f172a",
    minHeight: 50,
    resize: "vertical",
    outline: "none",
    lineHeight: 1.4,
  },
  noteActions: {
    display: "flex",
    gap: 6,
    marginTop: 6,
    justifyContent: "flex-end",
  },
  noteBtnGhost: {
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 600,
    fontFamily: "inherit",
  },
  noteBtnPrimary: {
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #7c3aed",
    background: "#7c3aed",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 600,
    fontFamily: "inherit",
  },
};
