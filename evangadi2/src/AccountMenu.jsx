import React, { useState, useRef, useEffect } from "react";

// Avatar + name trigger that opens a dropdown with the user's email, role
// badge, and a log-out action. Used by both the classic top bar (Schedule /
// Audio Report / Admin) and the Auditor Center header, so the dropdown
// behavior (click-outside-to-close) only has to be written once.
export default function AccountMenu({ user, logout, badge }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  return (
    <div style={styles.wrap} ref={menuRef}>
      <button
        style={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span style={styles.avatar}>
          {(user.name || "?").charAt(0).toUpperCase()}
        </span>
        <span style={styles.triggerName}>{user.name}</span>
        <span
          style={{
            ...styles.chevron,
            transform: open ? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={styles.menu} role="menu">
          <div style={styles.menuHeader}>
            <span style={styles.menuName}>{user.name}</span>
            {user.email && <span style={styles.menuEmail}>{user.email}</span>}
            {badge && (
              <span
                style={{
                  ...styles.roleBadge,
                  background: badge.bg,
                  color: badge.color,
                  marginTop: 8,
                  alignSelf: "flex-start",
                }}
              >
                {badge.label}
              </span>
            )}
          </div>
          <button
            style={styles.logout}
            onClick={() => {
              setOpen(false);
              logout();
            }}
            role="menuitem"
          >
            ⎋ Log out
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: "relative" },
  trigger: {
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
  avatar: {
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
  triggerName: {
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
  roleBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
  },
  logout: {
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
