import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import api from "./api";

const ROLE_INFO = {
  admin: { label: "Admin", color: "#dc2626", bg: "#fee2e2", icon: "👑" },
  coordinator: {
    label: "Coordinator",
    color: "#7c3aed",
    bg: "#f3e8ff",
    icon: "🧭",
  },
  reviewer: {
    label: "Reviewer (video + audio)",
    color: "#7c3aed",
    bg: "#f3e8ff",
    icon: "🕵️",
  },
  video_reviewer: {
    label: "Video Reviewer",
    color: "#0891b2",
    bg: "#cffafe",
    icon: "🎬",
  },
  audio_reporter: {
    label: "Audio Reporter",
    color: "#d97706",
    bg: "#fef3c7",
    icon: "📊",
  },
  tutor: { label: "Tutor", color: "#0891b2", bg: "#cffafe", icon: "🧑‍🏫" },
  student: { label: "Student", color: "#16a34a", bg: "#dcfce7", icon: "🎓" },
};

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

// Current ISO week key, matching the format the schedule uses (e.g. "2026-W27").
function currentWeekKey() {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const STATUS_STYLE = {
  pending: { label: "Pending", color: "#64748b", bg: "#f1f5f9" },
  uploaded: { label: "Uploaded", color: "#d97706", bg: "#fef3c7" },
  reviewed: { label: "Reviewed", color: "#16a34a", bg: "#dcfce7" },
  absent: { label: "Absent", color: "#9a3412", bg: "#fed7aa" },
  cancelled: { label: "Cancelled", color: "#6b21a8", bg: "#f3e8ff" },
  rescheduled: { label: "Rescheduled", color: "#0369a1", bg: "#e0f2fe" },
};

export default function AdminPanel() {
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isAdmin = user?.role === "admin";
  const [section, setSection] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const sections = [
    { id: "dashboard", label: "Dashboard", icon: "📊", visible: true },
    { id: "activity", label: "Review Activity", icon: "🔍", visible: true },
    { id: "tutors", label: "Tutor Roster", icon: "🧑‍🏫", visible: true },
    { id: "students", label: "Student Roster", icon: "🎓", visible: true },
    { id: "users", label: "User Accounts", icon: "👥", visible: isAdmin },
  ].filter((s) => s.visible);

  return (
    <div style={styles.page}>
      <div
        style={{
          ...styles.container,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <nav
          style={{
            ...styles.sideNav,
            width: isMobile ? "100%" : 220,
            flexDirection: isMobile ? "row" : "column",
            overflowX: isMobile ? "auto" : "visible",
          }}
        >
          <div style={styles.sideNavHeader}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            {!isMobile && <span style={styles.sideNavTitle}>Admin Panel</span>}
          </div>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                ...styles.navBtn,
                ...(section === s.id ? styles.navBtnActive : {}),
                flexShrink: isMobile ? 0 : 1,
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <main style={styles.main}>
          {section === "dashboard" && <DashboardSection />}
          {section === "activity" && <ReviewActivitySection flash={flash} />}
          {section === "tutors" && <TutorRosterSection flash={flash} />}
          {section === "students" && <StudentRosterSection flash={flash} />}
          {section === "users" && isAdmin && (
            <UserManagementSection flash={flash} currentUserId={user.id} />
          )}
        </main>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

/* ============================= DASHBOARD ============================= */

function DashboardSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getRosterDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>Loading dashboard…</div>;
  if (!data) return <div style={styles.loading}>Couldn't load dashboard.</div>;

  return (
    <div>
      <h2 style={styles.sectionTitle}>📊 Overview Dashboard</h2>
      <p style={styles.sectionSub}>
        A snapshot of your roster and team at a glance.
      </p>

      <div style={styles.statGrid}>
        <div
          style={{
            ...styles.statCard,
            background: "#eff6ff",
            borderColor: "#bfdbfe",
          }}
        >
          <div style={styles.statLabel}>🧑‍🏫 Tutors</div>
          <div style={{ ...styles.statValue, color: "#1d4ed8" }}>
            {data.tutors.active}
          </div>
          <div style={styles.statSub}>active of {data.tutors.total} total</div>
        </div>
        <div
          style={{
            ...styles.statCard,
            background: "#f0fdf4",
            borderColor: "#86efac",
          }}
        >
          <div style={styles.statLabel}>🎓 Students</div>
          <div style={{ ...styles.statValue, color: "#15803d" }}>
            {data.students.active}
          </div>
          <div style={styles.statSub}>
            active of {data.students.total} total
          </div>
        </div>
        <div
          style={{
            ...styles.statCard,
            background: "#f5f3ff",
            borderColor: "#c4b5fd",
          }}
        >
          <div style={styles.statLabel}>👥 Team Members</div>
          <div style={{ ...styles.statValue, color: "#6d28d9" }}>
            {data.users.total}
          </div>
          <div style={styles.statSub}>user accounts</div>
        </div>
        <div
          style={{
            ...styles.statCard,
            background: "#fff7ed",
            borderColor: "#fed7aa",
          }}
        >
          <div style={styles.statLabel}>📅 Weeks Tracked</div>
          <div style={{ ...styles.statValue, color: "#c2410c" }}>
            {data.weeksTracked}
          </div>
          <div style={styles.statSub}>in the schedule history</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Team by Role</div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}
        >
          {data.users.byRole.map((r) => {
            const info = ROLE_INFO[r.role] || ROLE_INFO.coordinator;
            return (
              <div
                key={r.role}
                style={{
                  ...styles.roleChip,
                  background: info.bg,
                  color: info.color,
                }}
              >
                {info.icon} {info.label}: <strong>{r.count}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ========================== REVIEW ACTIVITY ========================== */

function ReviewActivitySection({ flash }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("reviewer"); // "reviewer" | "session"
  const [audioFilter, setAudioFilter] = useState("all"); // all | reviewed | notReviewed
  const [weekStatus, setWeekStatus] = useState(null);
  const weekKey = currentWeekKey();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getReviewActivity(),
      api.getWeekStatus(weekKey).catch(() => null),
    ])
      .then(([act, ws]) => {
        setData(act);
        setWeekStatus(ws);
      })
      .catch(() => flash("Failed to load review activity"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div style={styles.loading}>Loading review activity…</div>;
  if (!data)
    return <div style={styles.loading}>Couldn't load review activity.</div>;

  const audioFiltered = data.audio.filter((a) => {
    if (audioFilter === "reviewed") return a.status === "reviewed";
    if (audioFilter === "notReviewed")
      return a.status === "pending" || a.status === "uploaded";
    return true;
  });

  return (
    <div>
      <h2 style={styles.sectionTitle}>🔍 Review Activity</h2>
      <p style={styles.sectionSub}>
        See who reviewed each video and audio session — and which audio sessions
        still haven't been reviewed.
      </p>

      {/* This week's status breakdown — schedule + audio, shown separately */}
      {weekStatus && (
        <div style={styles.card}>
          <div
            style={{
              ...styles.cardTitle,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            📅 This Week's Status Breakdown
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#94a3b8",
                background: "#f1f5f9",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {weekStatus.weekKey}
            </span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={styles.breakdownLabel}>
              🗓️ Schedule Grid{" "}
              <span style={styles.breakdownTotal}>
                {weekStatus.scheduleTotal} sessions
              </span>
            </div>
            <div style={styles.breakdownRow}>
              {weekStatus.statuses.map((s) => {
                const cfg = STATUS_STYLE[s];
                return (
                  <div
                    key={s}
                    style={{
                      ...styles.breakdownChip,
                      background: cfg.bg,
                      color: cfg.color,
                    }}
                  >
                    <span style={styles.breakdownNum}>
                      {weekStatus.schedule[s] || 0}
                    </span>
                    <span>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={styles.breakdownLabel}>
              🎧 Audio Report{" "}
              <span style={styles.breakdownTotal}>
                {weekStatus.audioTotal} entries
              </span>
            </div>
            <div style={styles.breakdownRow}>
              {weekStatus.statuses.map((s) => {
                const cfg = STATUS_STYLE[s];
                return (
                  <div
                    key={s}
                    style={{
                      ...styles.breakdownChip,
                      background: cfg.bg,
                      color: cfg.color,
                    }}
                  >
                    <span style={styles.breakdownNum}>
                      {weekStatus.audio[s] || 0}
                    </span>
                    <span>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={styles.statGrid}>
        <div
          style={{
            ...styles.statCard,
            background: "#eff6ff",
            borderColor: "#bfdbfe",
          }}
        >
          <div style={styles.statLabel}>🎬 Video Checklists Saved</div>
          <div style={{ ...styles.statValue, color: "#1d4ed8" }}>
            {data.summary.videoTotal}
          </div>
          <div style={styles.statSub}>all-time</div>
        </div>
        <div
          style={{
            ...styles.statCard,
            background: "#f0fdf4",
            borderColor: "#86efac",
          }}
        >
          <div style={styles.statLabel}>🎧 Audio Reviewed</div>
          <div style={{ ...styles.statValue, color: "#15803d" }}>
            {data.summary.audioReviewed}
          </div>
          <div style={styles.statSub}>marked reviewed</div>
        </div>
        <div
          style={{
            ...styles.statCard,
            background: "#fff7ed",
            borderColor: "#fed7aa",
          }}
        >
          <div style={styles.statLabel}>⏳ Audio Not Reviewed</div>
          <div style={{ ...styles.statValue, color: "#c2410c" }}>
            {data.summary.audioNotReviewed}
          </div>
          <div style={styles.statSub}>pending / uploaded</div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          style={{
            ...styles.toggleBtn,
            ...(view === "reviewer" ? styles.toggleBtnActive : {}),
          }}
          onClick={() => setView("reviewer")}
        >
          👤 By Reviewer
        </button>
        <button
          style={{
            ...styles.toggleBtn,
            ...(view === "session" ? styles.toggleBtnActive : {}),
          }}
          onClick={() => setView("session")}
        >
          📋 By Session
        </button>
      </div>

      {view === "reviewer" ? (
        <div style={styles.card}>
          <div style={styles.cardTitle}>What each person has reviewed</div>
          {data.byReviewer.length === 0 ? (
            <div style={styles.empty}>No reviews recorded yet.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: "left" }}>Reviewer</th>
                  <th style={styles.th}>🎬 Video</th>
                  <th style={styles.th}>🎧 Audio</th>
                  <th style={styles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.byReviewer.map((r) => (
                  <tr key={r.reviewer}>
                    <td
                      style={{
                        ...styles.td,
                        textAlign: "left",
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          ...styles.avatar,
                          width: 26,
                          height: 26,
                          fontSize: 12,
                          marginRight: 8,
                          background: r.reviewer.startsWith("—")
                            ? "#94a3b8"
                            : "#7c3aed",
                        }}
                      >
                        {r.reviewer.charAt(0).toUpperCase()}
                      </span>
                      {r.reviewer}
                    </td>
                    <td style={styles.td}>{r.video}</td>
                    <td style={styles.td}>{r.audio}</td>
                    <td style={{ ...styles.td, fontWeight: 800 }}>
                      {r.video + r.audio}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          {/* Video sessions */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>
              🎬 Video Reviews ({data.video.length})
            </div>
            {data.video.length === 0 ? (
              <div style={styles.empty}>No video reviews yet.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, textAlign: "left" }}>
                      Tutor → Student
                    </th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Reviewed by</th>
                  </tr>
                </thead>
                <tbody>
                  {data.video.map((v) => (
                    <tr key={v.id}>
                      <td style={{ ...styles.td, textAlign: "left" }}>
                        <strong>{v.tutorName}</strong> → {v.studentName}
                      </td>
                      <td style={styles.td}>
                        {String(v.reviewDate).slice(0, 10)}
                      </td>
                      <td style={styles.td}>
                        {v.reviewer ? (
                          <span style={styles.reviewerChip}>{v.reviewer}</span>
                        ) : (
                          <span style={styles.unknownChip}>— unrecorded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Audio sessions */}
          <div style={styles.card}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ ...styles.cardTitle, marginBottom: 0 }}>
                🎧 Audio Sessions ({audioFiltered.length})
              </div>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {[
                  ["all", "All"],
                  ["reviewed", "Reviewed"],
                  ["notReviewed", "Not reviewed"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    style={{
                      ...styles.miniToggle,
                      ...(audioFilter === key ? styles.miniToggleActive : {}),
                    }}
                    onClick={() => setAudioFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {audioFiltered.length === 0 ? (
              <div style={styles.empty}>Nothing to show for this filter.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, textAlign: "left" }}>
                      Tutor → Student
                    </th>
                    <th style={styles.th}>Week / Day</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Reviewed by</th>
                  </tr>
                </thead>
                <tbody>
                  {audioFiltered.map((a) => {
                    const isReviewed = a.status === "reviewed";
                    return (
                      <tr key={a.id}>
                        <td style={{ ...styles.td, textAlign: "left" }}>
                          <strong>{a.tutorName}</strong> → {a.studentName}
                        </td>
                        <td style={styles.td}>
                          {a.weekKey} · {a.dayId}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusChip,
                              background: isReviewed ? "#dcfce7" : "#fef3c7",
                              color: isReviewed ? "#15803d" : "#92400e",
                            }}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {a.reviewedBy ? (
                            <span style={styles.reviewerChip}>
                              {a.reviewedBy}
                            </span>
                          ) : isReviewed ? (
                            <span style={styles.unknownChip}>— unrecorded</span>
                          ) : (
                            <span style={{ color: "#cbd5e1" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================ TUTOR ROSTER ============================ */

function TutorRosterSection({ flash }) {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .getTutorRoster()
      .then(setTutors)
      .catch(() => flash("Failed to load tutors"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const addTutor = async () => {
    if (!form.name.trim()) {
      flash("Enter a tutor name");
      return;
    }
    try {
      await api.createTutorProfile(form);
      setForm({ name: "", phone: "", email: "", notes: "" });
      flash(`Added ${form.name} to the roster`);
      load();
    } catch (err) {
      flash(err.message || "Failed to add tutor");
    }
  };

  const toggleActive = async (t) => {
    try {
      await api.updateTutorProfile(t.id, { active: !t.active });
      flash(t.active ? `${t.name} marked inactive` : `${t.name} marked active`);
      load();
    } catch (err) {
      flash(err.message || "Failed");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.updateTutorProfile(editing.id, {
        name: editing.name,
        phone: editing.phone,
        email: editing.email,
        notes: editing.notes,
      });
      setEditing(null);
      flash("Tutor updated");
      load();
    } catch (err) {
      flash(err.message || "Failed to update");
    }
  };

  const removeTutor = async (t) => {
    if (
      !window.confirm(
        `Remove ${t.name} from the roster? Their students will become unassigned, not deleted.`,
      )
    )
      return;
    try {
      await api.deleteTutorProfile(t.id);
      flash(`Removed ${t.name}`);
      load();
    } catch (err) {
      flash(err.message || "Failed to remove");
    }
  };

  const filtered = tutors.filter((t) =>
    t.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <h2 style={styles.sectionTitle}>🧑‍🏫 Tutor Roster</h2>
      <p style={styles.sectionSub}>
        A master list of all tutors, independent of any single week's schedule.
        This is separate from the weekly schedule grid — use this to track
        contact info and see how many active students each tutor has.
      </p>

      <div style={styles.card}>
        <div style={styles.cardTitle}>+ Add Tutor</div>
        <div style={styles.formGrid}>
          <input
            style={styles.input}
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            style={styles.input}
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
          <input
            style={styles.input}
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
          <input
            style={styles.input}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>
        <button style={styles.btnPrimary} onClick={addTutor}>
          + Add to Roster
        </button>
      </div>

      <input
        style={{ ...styles.input, marginBottom: 14, maxWidth: 300 }}
        placeholder="🔍 Search tutors…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div style={styles.loading}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>No tutors in the roster yet.</div>
      ) : (
        <div style={styles.list}>
          {filtered.map((t) => (
            <div
              key={t.id}
              style={{ ...styles.rosterRow, opacity: t.active ? 1 : 0.55 }}
            >
              <span
                style={{
                  ...styles.avatar,
                  background: t.active ? "#0891b2" : "#94a3b8",
                }}
              >
                {t.name.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editing?.id === t.id ? (
                  <div style={styles.formGrid}>
                    <input
                      style={styles.input}
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Phone"
                      value={editing.phone || ""}
                      onChange={(e) =>
                        setEditing({ ...editing, phone: e.target.value })
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Email"
                      value={editing.email || ""}
                      onChange={(e) =>
                        setEditing({ ...editing, email: e.target.value })
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Notes"
                      value={editing.notes || ""}
                      onChange={(e) =>
                        setEditing({ ...editing, notes: e.target.value })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div style={styles.rowName}>
                      {t.name}{" "}
                      {!t.active && (
                        <span style={styles.inactiveTag}>inactive</span>
                      )}
                    </div>
                    <div style={styles.rowMeta}>
                      {t.phone && <span>📞 {t.phone}</span>}
                      {t.email && <span>✉️ {t.email}</span>}
                      <span>
                        🎓 {t.studentCount} active student
                        {t.studentCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {t.notes && <div style={styles.rowNotes}>{t.notes}</div>}
                  </>
                )}
              </div>
              <div style={styles.rowActions}>
                {editing?.id === t.id ? (
                  <>
                    <button
                      style={styles.iconActionBtn}
                      onClick={saveEdit}
                      title="Save"
                    >
                      💾
                    </button>
                    <button
                      style={styles.iconActionBtn}
                      onClick={() => setEditing(null)}
                      title="Cancel"
                    >
                      ✖️
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      style={styles.iconActionBtn}
                      onClick={() => setEditing({ ...t })}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      style={styles.iconActionBtn}
                      onClick={() => toggleActive(t)}
                      title={t.active ? "Mark inactive" : "Mark active"}
                    >
                      {t.active ? "⏸️" : "▶️"}
                    </button>
                    <button
                      style={{ ...styles.iconActionBtn, color: "#dc2626" }}
                      onClick={() => removeTutor(t)}
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================== STUDENT ROSTER =========================== */

function StudentRosterSection({ flash }) {
  const [students, setStudents] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    tutorProfileId: "",
    grade: "",
    parentContact: "",
    notes: "",
  });
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getStudentRoster(), api.getTutorRoster()])
      .then(([s, t]) => {
        setStudents(s);
        setTutors(t);
      })
      .catch(() => flash("Failed to load students"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const addStudent = async () => {
    if (!form.name.trim()) {
      flash("Enter a student name");
      return;
    }
    try {
      await api.createStudentProfile({
        ...form,
        tutorProfileId: form.tutorProfileId || null,
      });
      setForm({
        name: "",
        tutorProfileId: "",
        grade: "",
        parentContact: "",
        notes: "",
      });
      flash(`Added ${form.name} to the roster`);
      load();
    } catch (err) {
      flash(err.message || "Failed to add student");
    }
  };

  const toggleActive = async (s) => {
    try {
      await api.updateStudentProfile(s.id, { active: !s.active });
      flash(s.active ? `${s.name} marked inactive` : `${s.name} marked active`);
      load();
    } catch (err) {
      flash(err.message || "Failed");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.updateStudentProfile(editing.id, {
        name: editing.name,
        tutorProfileId: editing.tutor_profile_id || null,
        grade: editing.grade,
        parentContact: editing.parent_contact,
        notes: editing.notes,
      });
      setEditing(null);
      flash("Student updated");
      load();
    } catch (err) {
      flash(err.message || "Failed to update");
    }
  };

  const removeStudent = async (s) => {
    if (!window.confirm(`Remove ${s.name} from the roster?`)) return;
    try {
      await api.deleteStudentProfile(s.id);
      flash(`Removed ${s.name}`);
      load();
    } catch (err) {
      flash(err.message || "Failed to remove");
    }
  };

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <h2 style={styles.sectionTitle}>🎓 Student Roster</h2>
      <p style={styles.sectionSub}>
        A master list of all students, independent of any single week's
        schedule. Assign each student to a tutor from the roster above.
      </p>

      <div style={styles.card}>
        <div style={styles.cardTitle}>+ Add Student</div>
        <div style={styles.formGrid}>
          <input
            style={styles.input}
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <select
            style={styles.input}
            value={form.tutorProfileId}
            onChange={(e) =>
              setForm((p) => ({ ...p, tutorProfileId: e.target.value }))
            }
          >
            <option value="">No tutor assigned</option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            style={styles.input}
            placeholder="Grade"
            value={form.grade}
            onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
          />
          <input
            style={styles.input}
            placeholder="Parent contact"
            value={form.parentContact}
            onChange={(e) =>
              setForm((p) => ({ ...p, parentContact: e.target.value }))
            }
          />
          <input
            style={{ ...styles.input, gridColumn: "1 / -1" }}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>
        <button style={styles.btnPrimary} onClick={addStudent}>
          + Add to Roster
        </button>
      </div>

      <input
        style={{ ...styles.input, marginBottom: 14, maxWidth: 300 }}
        placeholder="🔍 Search students…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div style={styles.loading}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>No students in the roster yet.</div>
      ) : (
        <div style={styles.list}>
          {filtered.map((s) => (
            <div
              key={s.id}
              style={{ ...styles.rosterRow, opacity: s.active ? 1 : 0.55 }}
            >
              <span
                style={{
                  ...styles.avatar,
                  background: s.active ? "#7c3aed" : "#94a3b8",
                }}
              >
                {s.name.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editing?.id === s.id ? (
                  <div style={styles.formGrid}>
                    <input
                      style={styles.input}
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                    />
                    <select
                      style={styles.input}
                      value={editing.tutor_profile_id || ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          tutor_profile_id: e.target.value,
                        })
                      }
                    >
                      <option value="">No tutor assigned</option>
                      {tutors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <input
                      style={styles.input}
                      placeholder="Grade"
                      value={editing.grade || ""}
                      onChange={(e) =>
                        setEditing({ ...editing, grade: e.target.value })
                      }
                    />
                    <input
                      style={styles.input}
                      placeholder="Parent contact"
                      value={editing.parent_contact || ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          parent_contact: e.target.value,
                        })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div style={styles.rowName}>
                      {s.name}{" "}
                      {!s.active && (
                        <span style={styles.inactiveTag}>inactive</span>
                      )}
                    </div>
                    <div style={styles.rowMeta}>
                      <span>🧑‍🏫 {s.tutorName || "No tutor assigned"}</span>
                      {s.grade && <span>🏫 Grade {s.grade}</span>}
                      {s.parent_contact && <span>👪 {s.parent_contact}</span>}
                    </div>
                    {s.notes && <div style={styles.rowNotes}>{s.notes}</div>}
                  </>
                )}
              </div>
              <div style={styles.rowActions}>
                {editing?.id === s.id ? (
                  <>
                    <button
                      style={styles.iconActionBtn}
                      onClick={saveEdit}
                      title="Save"
                    >
                      💾
                    </button>
                    <button
                      style={styles.iconActionBtn}
                      onClick={() => setEditing(null)}
                      title="Cancel"
                    >
                      ✖️
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      style={styles.iconActionBtn}
                      onClick={() => setEditing({ ...s })}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      style={styles.iconActionBtn}
                      onClick={() => toggleActive(s)}
                      title={s.active ? "Mark inactive" : "Mark active"}
                    >
                      {s.active ? "⏸️" : "▶️"}
                    </button>
                    <button
                      style={{ ...styles.iconActionBtn, color: "#dc2626" }}
                      onClick={() => removeStudent(s)}
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================== USER MANAGEMENT =========================== */

function UserManagementSection({ flash, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "coordinator",
  });
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    api
      .getUsers()
      .then(setUsers)
      .catch(() => flash("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const addUser = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      flash("Fill in name, email, and a password of 6+ characters");
      return;
    }
    try {
      await api.createUser(
        form.name.trim(),
        form.email.trim(),
        form.password,
        form.role,
      );
      setForm({ name: "", email: "", password: "", role: "coordinator" });
      setShowAdd(false);
      flash(`Created account for ${form.name}`);
      load();
    } catch (err) {
      flash(err.message || "Failed to create account");
    }
  };

  const changeRole = async (u, role) => {
    try {
      await api.updateUserRole(u.id, { role });
      flash(`${u.name} is now ${ROLE_INFO[role]?.label || role}`);
      load();
    } catch (err) {
      flash(err.message || "Failed to update role");
    }
  };

  const removeUser = async (u) => {
    if (
      !window.confirm(
        `Remove ${u.name}'s account? They won't be able to log in anymore.`,
      )
    )
      return;
    try {
      await api.deleteUser(u.id);
      flash(`Removed ${u.name}'s account`);
      load();
    } catch (err) {
      flash(err.message || "Failed to remove account");
    }
  };

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!q) return true;
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <h2 style={styles.sectionTitle}>👥 User Accounts</h2>
      <p style={styles.sectionSub}>
        Create logins for coordinators, tutors, or others, and control what each
        person can access.
      </p>

      {!showAdd ? (
        <button
          style={{ ...styles.btnPrimary, marginBottom: 18 }}
          onClick={() => setShowAdd(true)}
        >
          + Create User Account
        </button>
      ) : (
        <div style={styles.card}>
          <div style={styles.cardTitle}>+ Create User Account</div>
          <div style={styles.formGrid}>
            <input
              style={styles.input}
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              style={styles.input}
              placeholder="Email *"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
            />
            <input
              style={styles.input}
              placeholder="Password (6+ chars) *"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
            />
            <select
              style={styles.input}
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            >
              {Object.entries(ROLE_INFO).map(([key, r]) => (
                <option key={key} value={key}>
                  {r.icon} {r.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.btnGhost} onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button style={styles.btnPrimary} onClick={addUser}>
              Create Account
            </button>
          </div>
        </div>
      )}

      {/* Search + filter by role */}
      {!loading && users.length > 0 && (
        <div style={styles.userFilterBar}>
          <input
            style={styles.userSearchInput}
            placeholder="🔍 Search users by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={styles.roleChipRow}>
            <button
              style={{
                ...styles.roleFilterChip,
                ...(roleFilter === "all" ? styles.roleFilterChipActive : {}),
              }}
              onClick={() => setRoleFilter("all")}
            >
              All ({users.length})
            </button>
            {Object.entries(ROLE_INFO)
              .filter(([key]) => roleCounts[key])
              .map(([key, r]) => {
                const active = roleFilter === key;
                return (
                  <button
                    key={key}
                    style={{
                      ...styles.roleFilterChip,
                      ...(active
                        ? {
                            background: r.bg,
                            color: r.color,
                            borderColor: r.color,
                            fontWeight: 800,
                          }
                        : {}),
                    }}
                    onClick={() => setRoleFilter(key)}
                  >
                    {r.icon} {r.label} ({roleCounts[key]})
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.loading}>Loading…</div>
      ) : filteredUsers.length === 0 ? (
        <div style={styles.loading}>
          {users.length === 0
            ? "No user accounts yet."
            : "No users match your search."}
        </div>
      ) : (
        <div style={styles.list}>
          {filteredUsers.map((u) => {
            const info = ROLE_INFO[u.role] || ROLE_INFO.coordinator;
            const isSelf = u.id === currentUserId;
            return (
              <div key={u.id} style={styles.rosterRow}>
                <span style={{ ...styles.avatar, background: info.color }}>
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.rowName}>
                    {u.name} {isSelf && <span style={styles.youTag}>you</span>}
                  </div>
                  <div style={styles.rowMeta}>
                    <span>✉️ {u.email}</span>
                    <span>Joined {String(u.created_at).slice(0, 10)}</span>
                  </div>
                </div>
                <select
                  style={{
                    ...styles.roleSelect,
                    background: info.bg,
                    color: info.color,
                    borderColor: info.color + "55",
                  }}
                  value={u.role}
                  disabled={isSelf}
                  title={
                    isSelf ? "You can't change your own role" : "Change role"
                  }
                  onChange={(e) => changeRole(u, e.target.value)}
                >
                  {Object.entries(ROLE_INFO).map(([key, r]) => (
                    <option key={key} value={key}>
                      {r.icon} {r.label}
                    </option>
                  ))}
                </select>
                <button
                  style={{
                    ...styles.iconActionBtn,
                    color: "#dc2626",
                    opacity: isSelf ? 0.3 : 1,
                  }}
                  onClick={() => !isSelf && removeUser(u)}
                  disabled={isSelf}
                  title={
                    isSelf
                      ? "You can't remove your own account"
                      : "Remove account"
                  }
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "calc(100vh - 57px)",
    background:
      "radial-gradient(1200px 600px at 0% 0%, #dbeafe 0%, transparent 50%), radial-gradient(1000px 600px at 100% 0%, #fce7f3 0%, transparent 50%), #f8fafc",
    fontFamily:
      "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    color: "#0f172a",
  },
  container: {
    display: "flex",
    maxWidth: 1200,
    margin: "0 auto",
    gap: 20,
    padding: "20px 16px 60px",
  },

  sideNav: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 10,
    height: "fit-content",
    boxShadow: "0 6px 20px -14px rgba(15,23,42,0.1)",
  },
  sideNavHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px 12px",
    borderBottom: "1px solid #f1f5f9",
    marginBottom: 6,
  },
  sideNavTitle: { fontSize: 13, fontWeight: 800, color: "#0f172a" },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 9,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#64748b",
    fontFamily: "inherit",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  navBtnActive: { background: "#eff6ff", color: "#1d4ed8" },

  main: { flex: 1, minWidth: 0 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 800,
    margin: "0 0 4px",
    letterSpacing: "-0.01em",
  },
  sectionSub: {
    fontSize: 13,
    color: "#64748b",
    margin: "0 0 18px",
    lineHeight: 1.6,
    maxWidth: 640,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 20,
  },
  statCard: { padding: "16px 18px", borderRadius: 14, border: "1px solid" },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    letterSpacing: "0.04em",
  },
  statValue: {
    fontSize: 30,
    fontWeight: 900,
    marginTop: 4,
    letterSpacing: "-0.02em",
  },
  statSub: { fontSize: 11.5, color: "#64748b", marginTop: 2 },

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    boxShadow: "0 6px 20px -16px rgba(15,23,42,0.1)",
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 12,
  },
  roleChip: {
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 700,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    padding: "9px 12px",
    borderRadius: 9,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#0f172a",
    outline: "none",
    background: "#fff",
  },
  btnPrimary: {
    padding: "9px 18px",
    borderRadius: 10,
    border: "none",
    background: "#0f172a",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
  },
  btnGhost: {
    padding: "9px 18px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
  },

  loading: {
    padding: "40px 0",
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
  },
  empty: {
    padding: "40px 0",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
  },

  userFilterBar: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 14,
  },
  userSearchInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  roleChipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  roleFilterChip: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#475569",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  roleFilterChipActive: {
    background: "#0f172a",
    color: "#ffffff",
    borderColor: "#0f172a",
    fontWeight: 800,
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  rosterRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 14px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    flexWrap: "wrap",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowName: { fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 3 },
  rowMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    fontSize: 11.5,
    color: "#64748b",
  },
  rowNotes: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4,
    fontStyle: "italic",
  },
  rowActions: { display: "flex", gap: 4, flexShrink: 0 },
  iconActionBtn: {
    background: "#f1f5f9",
    border: "none",
    cursor: "pointer",
    width: 30,
    height: 30,
    borderRadius: 8,
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveTag: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#64748b",
    background: "#f1f5f9",
    padding: "2px 7px",
    borderRadius: 999,
    marginLeft: 6,
    textTransform: "uppercase",
  },
  youTag: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#1d4ed8",
    background: "#dbeafe",
    padding: "2px 7px",
    borderRadius: 999,
    marginLeft: 6,
  },
  roleSelect: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    flexShrink: 0,
  },

  toggleBtn: {
    padding: "8px 16px",
    borderRadius: 9,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    color: "#64748b",
  },
  toggleBtnActive: {
    background: "#eff6ff",
    borderColor: "#93c5fd",
    color: "#1d4ed8",
  },
  miniToggle: {
    padding: "5px 11px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: "inherit",
    color: "#64748b",
  },
  miniToggleActive: {
    background: "#0f172a",
    borderColor: "#0f172a",
    color: "#fff",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "8px 12px",
    background: "#f1f5f9",
    color: "#475569",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    textAlign: "center",
    borderBottom: "2px solid #e2e8f0",
  },
  td: {
    padding: "9px 12px",
    borderBottom: "1px solid #f1f5f9",
    textAlign: "center",
    color: "#0f172a",
    verticalAlign: "middle",
  },
  reviewerChip: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: "#ede9fe",
    color: "#6d28d9",
    fontSize: 12,
    fontWeight: 700,
  },
  unknownChip: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#94a3b8",
    fontSize: 11.5,
    fontWeight: 600,
    fontStyle: "italic",
  },
  statusChip: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 700,
    textTransform: "capitalize",
  },
  breakdownLabel: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  breakdownTotal: {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    background: "#f8fafc",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
  },
  breakdownRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  breakdownChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
  },
  breakdownNum: { fontSize: 15, fontWeight: 800 },

  toast: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0f172a",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    boxShadow: "0 10px 30px -10px rgba(15,23,42,0.5)",
    zIndex: 200,
  },
};
