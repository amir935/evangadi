import React, { useState, useRef, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./Login";
import WeeklySchedule from "./WeeklySchedule";
import VideoReviewChecklist from "./VideoReviewChecklist";
import AdminPanel from "./AdminPanel";

const ROLE_BADGE = {
  admin: { label: "Admin", color: "#dc2626", bg: "#fee2e2" },
  coordinator: { label: "Coordinator", color: "#7c3aed", bg: "#f3e8ff" },
  reviewer: { label: "Reviewer", color: "#7c3aed", bg: "#f3e8ff" },
  video_reviewer: { label: "Video Reviewer", color: "#0891b2", bg: "#cffafe" },
  audio_reporter: { label: "Audio Reporter", color: "#d97706", bg: "#fef3c7" },
  tutor: { label: "Tutor", color: "#0891b2", bg: "#cffafe" },
  student: { label: "Student", color: "#16a34a", bg: "#dcfce7" },
  _unknown: { label: "No role set", color: "#64748b", bg: "#f1f5f9" },
};

// Nav tabs — shown inline on desktop, as a dropdown on mobile
const NAV_TABS = [
  { id: "schedule", label: "Schedule", icon: "📅" },
  { id: "review", label: "Video Review", icon: "🎬" },
  { id: "report", label: "Audio Report", icon: "📊" },
  { id: "admin", label: "Admin", icon: "⚙️" },
];

// Which roles may access each tab. Admin sees everything; coordinator manages the
// schedule and both reviews; the scoped roles see only their granted tool(s).
const TAB_ACCESS = {
  schedule: ["admin", "coordinator"],
  review: ["admin", "coordinator", "video_reviewer", "reviewer"],
  report: ["admin", "coordinator", "audio_reporter", "reviewer"],
  admin: ["admin"],
};

function allowedTabsFor(role) {
  return NAV_TABS.filter((t) => (TAB_ACCESS[t.id] || []).includes(role));
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

function Shell() {
  const { user, loading, logout } = useAuth();
  const allowedTabs = user ? allowedTabsFor(user.role) : [];
  const hasAnyTab = allowedTabs.length > 0;
  const canSchedule = allowedTabs.some((t) => t.id === "schedule");
  const [activeTab, setActiveTab] = useState(null); // set once we know the role, below
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef(null);
  const isMobile = useIsMobile();

  // Close the account dropdown when clicking outside it
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  // Close the mobile nav dropdown when clicking outside it
  useEffect(() => {
    if (!navOpen) return;
    const onDoc = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setNavOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [navOpen]);

  if (loading) {
    return (
      <div style={loadingStyles.page}>
        <div style={loadingStyles.spinner}>Loading…</div>
      </div>
    );
  }

  if (!user) return <Login />;
  const badge = ROLE_BADGE[user.role] || ROLE_BADGE._unknown;
  // Land on the first tab the user is allowed; keep the active one if still valid.
  const tab =
    activeTab && allowedTabs.some((t) => t.id === activeTab)
      ? activeTab
      : allowedTabs[0]?.id || null;

  return (
    <div>
      <div style={topBar.bar}>
        <div style={topBar.brand}>📋 Evangadi Tutor Review</div>
        {hasAnyTab && isMobile && allowedTabs.length > 1 ? (
          // Mobile with several tabs: collapse them into a dropdown
          <div style={topBar.navMenuWrap} ref={navRef}>
            <button
              style={topBar.navTrigger}
              onClick={() => setNavOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={navOpen}
            >
              {(() => {
                const cur =
                  allowedTabs.find((t) => t.id === tab) || allowedTabs[0];
                return (
                  <span>
                    {cur.icon} {cur.label}
                  </span>
                );
              })()}
              <span
                style={{
                  ...topBar.chevron,
                  transform: navOpen ? "rotate(180deg)" : "none",
                }}
              >
                ▾
              </span>
            </button>
            {navOpen && (
              <div style={topBar.navMenu} role="menu">
                {allowedTabs.map((t) => (
                  <button
                    key={t.id}
                    style={{
                      ...topBar.navMenuItem,
                      ...(tab === t.id ? topBar.navMenuItemActive : {}),
                    }}
                    onClick={() => {
                      setActiveTab(t.id);
                      setNavOpen(false);
                    }}
                    role="menuitem"
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : hasAnyTab ? (
          <div style={topBar.tabs}>
            {allowedTabs.map((t) => (
              <button
                key={t.id}
                style={{
                  ...topBar.tab,
                  ...(tab === t.id ? topBar.tabActive : {}),
                }}
                onClick={() => setActiveTab(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        ) : null}
        <div style={topBar.right}>
          <div style={topBar.userMenuWrap} ref={menuRef}>
            <button
              style={topBar.userTrigger}
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span style={topBar.userAvatar}>
                {(user.name || "?").charAt(0).toUpperCase()}
              </span>
              <span style={topBar.userTriggerName}>{user.name}</span>
              <span
                style={{
                  ...topBar.chevron,
                  transform: menuOpen ? "rotate(180deg)" : "none",
                }}
              >
                ▾
              </span>
            </button>
            {menuOpen && (
              <div style={topBar.menu} role="menu">
                <div style={topBar.menuHeader}>
                  <span style={topBar.menuName}>{user.name}</span>
                  {user.email && (
                    <span style={topBar.menuEmail}>{user.email}</span>
                  )}
                  <span
                    style={{
                      ...topBar.roleBadge,
                      background: badge.bg,
                      color: badge.color,
                      marginTop: 8,
                      alignSelf: "flex-start",
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                <button
                  style={topBar.menuLogout}
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  role="menuitem"
                >
                  ⎋ Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasAnyTab && (tab === "schedule" || tab === "report") && (
        <WeeklySchedule
          view={tab === "report" ? "report" : "schedule"}
          scheduleAccess={canSchedule}
          onExitReport={canSchedule ? () => setActiveTab("schedule") : undefined}
        />
      )}
      {hasAnyTab && tab === "review" && <VideoReviewChecklist />}
      {hasAnyTab && tab === "admin" && <AdminPanel />}
      {!hasAnyTab && <RestrictedHome user={user} />}
    </div>
  );
}

function RestrictedHome({ user }) {
  const knownRestrictedRole = user.role === "tutor" || user.role === "student";
  const badge = ROLE_BADGE[user.role] || ROLE_BADGE._unknown;
  return (
    <div style={restrictedStyles.page}>
      <div style={restrictedStyles.card}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>
          {user.role === "tutor" ? "🧑‍🏫" : user.role === "student" ? "🎓" : "⚠️"}
        </div>
        <h2 style={restrictedStyles.title}>Welcome, {user.name}</h2>
        <span
          style={{
            ...topBar.roleBadge,
            background: badge.bg,
            color: badge.color,
            marginBottom: 14,
          }}
        >
          {badge.label}
        </span>
        {knownRestrictedRole ? (
          <>
            <p style={restrictedStyles.text}>
              Your account doesn't have access to the Schedule or Video Review
              sections yet — those are managed by your coordinator or admin.
            </p>
            <p style={restrictedStyles.subtext}>
              If you think you should have access to something here, reach out
              to your coordinator.
            </p>
          </>
        ) : (
          <>
            <p style={restrictedStyles.text}>
              Your account doesn't have a recognized role, so access can't be
              determined right now. This usually means the server you're
              connected to hasn't been fully updated yet.
            </p>
            <p style={restrictedStyles.subtext}>
              Try logging out and back in. If that doesn't help, check that the
              backend you're pointed at is running the latest version.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

const topBar = {
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    fontFamily: "'Inter', system-ui, sans-serif",
    position: "sticky",
    top: 0,
    zIndex: 40,
    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
  },
  brand: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  tabs: {
    display: "flex",
    gap: 4,
    background: "#f1f5f9",
    padding: 4,
    borderRadius: 10,
  },
  tab: {
    padding: "8px 18px",
    borderRadius: 7,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#64748b",
    fontFamily: "inherit",
    transition: "all 150ms ease",
  },
  tabActive: {
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "0 2px 6px -2px rgba(15,23,42,0.15)",
  },
  right: { display: "flex", alignItems: "center", gap: 12 },
  roleBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
  },
  user: { fontSize: 13, color: "#475569", fontWeight: 600 },
  logout: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#b91c1c",
    fontFamily: "inherit",
  },

  // Mobile nav dropdown
  navMenuWrap: { position: "relative" },
  navTrigger: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 9,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    fontFamily: "inherit",
  },
  navMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    minWidth: 180,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 12px 30px -10px rgba(15,23,42,0.25)",
    padding: 6,
    zIndex: 50,
  },
  navMenuItem: {
    width: "100%",
    display: "block",
    padding: "9px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    fontFamily: "inherit",
    textAlign: "left",
  },
  navMenuItemActive: {
    background: "#f1f5f9",
    color: "#0f172a",
    fontWeight: 800,
  },

  // Account dropdown
  userMenuWrap: { position: "relative" },
  userTrigger: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 10px 5px 5px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 999,
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userTriggerName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    maxWidth: 140,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  chevron: {
    fontSize: 10,
    color: "#94a3b8",
    transition: "transform 150ms ease",
  },
  menu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    minWidth: 210,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 12px 30px -10px rgba(15,23,42,0.25)",
    padding: 6,
    zIndex: 50,
  },
  menuHeader: {
    display: "flex",
    flexDirection: "column",
    padding: "8px 10px 10px",
    borderBottom: "1px solid #f1f5f9",
    marginBottom: 6,
  },
  menuName: { fontSize: 13.5, fontWeight: 700, color: "#0f172a" },
  menuEmail: {
    fontSize: 11.5,
    color: "#94a3b8",
    marginTop: 1,
    wordBreak: "break-all",
  },
  menuLogout: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#b91c1c",
    fontFamily: "inherit",
    textAlign: "left",
  },
};

const loadingStyles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  spinner: { color: "#64748b", fontSize: 14, fontWeight: 600 },
};

const restrictedStyles = {
  page: {
    minHeight: "calc(100vh - 57px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(1200px 600px at 0% 0%, #dbeafe 0%, transparent 50%), radial-gradient(1000px 600px at 100% 0%, #fce7f3 0%, transparent 50%), #f8fafc",
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: 20,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "36px 32px",
    maxWidth: 420,
    textAlign: "center",
    boxShadow: "0 10px 30px -12px rgba(15,23,42,0.12)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  title: {
    fontSize: 19,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 10px",
  },
  text: {
    fontSize: 13.5,
    color: "#475569",
    lineHeight: 1.6,
    margin: "6px 0 0",
  },
  subtext: {
    fontSize: 12.5,
    color: "#94a3b8",
    lineHeight: 1.6,
    margin: "10px 0 0",
  },
};
