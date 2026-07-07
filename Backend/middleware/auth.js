// middleware/auth.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token)
    return res.status(401).json({ error: "Missing authorization token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Usage: requireRole("admin") or requireRole("admin", "coordinator")
// Must run AFTER authRequired so req.user is already populated.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role || "coordinator"; // fallback for tokens issued before roles existed
    if (!allowedRoles.includes(role)) {
      return res
        .status(403)
        .json({ error: "You don't have permission to do this" });
    }
    next();
  };
}

module.exports = { authRequired, requireRole, JWT_SECRET };
