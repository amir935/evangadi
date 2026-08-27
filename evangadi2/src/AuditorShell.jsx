import React from "react";
import AccountMenu from "./AccountMenu";

// Sidebar + header shell for the redesigned Video Review page ("Auditor
// Center"). Used only for the review tab — every other tab keeps rendering
// under App.jsx's original top bar untouched. The other nav items are a
// best-effort map onto today's tabs; some (Tutor Growth) have no existing
// page to point at yet and stay disabled until their own screen is designed.
const NAV_ITEMS = [
  { label: "Executive Dashboard", icon: "📊", targetTab: "admin" },
  { label: "Auditor Center", icon: "🎬", targetTab: "review" },
  { label: "Tutor Growth", icon: "📈", targetTab: null },
  { label: "Review Queue", icon: "🗂️", targetTab: "report" },
  { label: "Settings", icon: "⚙️", targetTab: "admin" },
];

export default function AuditorShell({
  allowedTabs,
  onNavigate,
  user,
  logout,
  badge,
  meta,
  onStartNewAudit,
  children,
}) {
  const subtitle =
    meta?.tutorName || meta?.studentName
      ? `Reviewing: ${meta.tutorName || "Unnamed tutor"} — ${meta.studentName || "session"}`
      : "Evaluate a recorded tutoring session";

  return (
    <div style={styles.page}>
      <nav style={styles.sidebar}>
        <div style={styles.brandRow}>
          <span style={styles.brandIcon}>🎓</span>
          <div>
            <div style={styles.brandTitle}>Evangadi Video Review</div>
            <div style={styles.brandSubtitle}>Quality Assurance Platform</div>
          </div>
        </div>

        <button style={styles.newAuditBtn} onClick={onStartNewAudit}>
          <span style={{ fontSize: 15 }}>+</span> Start New Audit
        </button>

        <div style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const active = item.targetTab === "review";
            const enabled =
              item.targetTab && allowedTabs.includes(item.targetTab);
            return (
              <button
                key={item.label}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && onNavigate(item.targetTab)}
                title={enabled ? undefined : "Coming soon"}
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navItemActive : {}),
                  ...(enabled ? {} : styles.navItemDisabled),
                }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div style={styles.body}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.headerTitle}>Auditor Center</span>
            <span style={styles.headerSubtitle}>{subtitle}</span>
          </div>
          <div style={styles.headerRight}>
            <button style={styles.iconBtn} title="Notifications">
              🔔
            </button>
            <button style={styles.iconBtn} title="Help">
              ❓
            </button>
            <a style={styles.supportLink} href="mailto:support@evangadi.com">
              Support
            </a>
            <AccountMenu user={user} logout={logout} badge={badge} />
          </div>
        </header>
        <div style={styles.content}>{children}</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },

  sidebar: {
    width: 250,
    flexShrink: 0,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "18px 14px",
    background: "#f8fafc",
    borderRight: "1px solid #e2e8f0",
    boxSizing: "border-box",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "4px 6px 18px",
  },
  brandIcon: { fontSize: 24 },
  brandTitle: { fontSize: 13.5, fontWeight: 800, color: "#1e3a8a", lineHeight: 1.25 },
  brandSubtitle: { fontSize: 11, color: "#64748b", marginTop: 1 },

  newAuditBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "11px 14px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: 14,
  },

  navList: { display: "flex", flexDirection: "column", gap: 2 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "9px 12px",
    borderRadius: 9,
    border: "none",
    background: "transparent",
    color: "#475569",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
  navItemActive: {
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 800,
  },
  navItemDisabled: {
    color: "#cbd5e1",
    cursor: "not-allowed",
  },
  navIcon: { fontSize: 15, width: 18, textAlign: "center", flexShrink: 0 },

  body: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },

  header: {
    position: "sticky",
    top: 0,
    zIndex: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "14px 24px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
  },
  headerLeft: { display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 },
  headerTitle: { fontSize: 17, fontWeight: 800, color: "#1d4ed8", flexShrink: 0 },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  headerRight: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  supportLink: {
    fontSize: 13,
    fontWeight: 600,
    color: "#2563eb",
    textDecoration: "none",
  },

  content: { flex: 1, minWidth: 0 },
};
